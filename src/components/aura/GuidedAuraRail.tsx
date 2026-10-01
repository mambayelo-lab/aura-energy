import { useEffect, useMemo, useRef, useState } from "react";
import { audit, useAccess } from "../../lib/security/use-access";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, ChevronLeft, ChevronRight, Home, LayoutDashboard, Menu, Settings2, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import { AuraLogo } from "./AuraUI";
import { loadSessions, saveSession, deleteSession, onSessionsChange, type AtelierSession } from "@/lib/v4/atelier-store";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/platform.functions";
import { LanguageToggle, useT } from "@/lib/i18n";


// AccountFooter — reprend l'ancien bandeau plein-largeur "Mode découverte /
// FR·EN / Compte" (retiré du haut de page, demande utilisateur), recasé en
// bas de la barre latérale pour ne perdre aucun accès (Studio Aura admin,
// Équipe & accès, Abonnement, Déconnexion).
function AccountFooter() {
  const access = useAccess();
  const t = useT();
  const [email, setEmail] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const logSignin = useServerFn(logEvent);
  const traced = useRef(false);

  useEffect(() => {
    let dead = false;
    supabase.auth.getUser().then(async ({ data }) => {
      if (dead) return;
      const u = data.user;
      setEmail(u?.email ?? null);
      if (!u) return;
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.id, _role: "admin" });
      if (!dead) setAdmin(isAdmin === true);
      if (!traced.current && !sessionStorage.getItem("aura_signin_traced")) {
        traced.current = true;
        sessionStorage.setItem("aura_signin_traced", "1");
        logSignin({ data: { kind: "signin", space: "plateforme", path: window.location.pathname } }).catch(() => {});
        audit("connexion", window.location.pathname);
      }
    });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function seDeconnecter() {
    await supabase.auth.signOut();
    sessionStorage.removeItem("aura_signin_traced");
    window.location.href = "/auth";
  }

  return (
    <div className="aura-account-footer">
      {access.demo && <span className="aura-demo-mode" data-testid="demo-mode" title="Démonstration sans authentification : aucune donnée client, tous les écrans ouverts.">Mode démo · sans authentification</span>}
      {!access.demo && access.role && <span className="aura-account-status" title={access.orgName ?? ""}>{access.role}{access.orgName ? ` · ${access.orgName}` : ""}</span>}
      {email && <span className="aura-account-status" title={email}><i aria-hidden="true" className="online" />{email}</span>}
      <div className="aura-account-row">
        <LanguageToggle />
        <details className="aura-account-menu">
          <summary>{t("account.menu", "Compte")}</summary>
          <div>
            {admin && <Link to="/cockpit/admin-plateforme">{t("account.admin", "Administration")}</Link>}
            <Link to="/cockpit/comptes">{t("account.teamAccess", "Équipe & accès")}</Link>
            {access.can("audit.read") && <Link to="/cockpit/utilisateurs">Utilisateurs et audit</Link>}
            <Link to="/cockpit/abonnement">{t("account.subscription", "Abonnement")}</Link>
            {email
              ? <button onClick={seDeconnecter}>{t("account.signout", "Déconnexion")}</button>
              : <Link className="primary" to="/auth">{t("account.signinCompact", "Se connecter")}</Link>}
          </div>
        </details>
      </div>
    </div>
  );
}

type Product = "decide" | "supply";
const LAST_PRODUCT_KEY = "aura.lastProduct";

function productOfPath(path: string): Product | null {
  if (path.includes("/energie") || path.includes("/resilience") || path.includes("/studio")) return "supply";
  if (path.includes("/home") || path.includes("/atelier") || path.includes("/demos") || path.includes("/cas-references")) return "decide";
  return null;
}

export function GuidedAuraRail() {
  const path = useRouterState({ select: state => state.location.pathname });
  const search = useRouterState({ select: state => state.location.search as Record<string, unknown> });
  const [open, setOpen] = useState(true);
  // Mobile (< 768 px) : le menu devient un tiroir ouvert par le bouton « Menu ».
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);
  // Deux applications étanches : chacune a sa navigation et ne renvoie
  // jamais vers une autre. Le Studio fait partie d'Aura Énergie. Les
  // pages partagées (compte, abonnement, administration) gardent la
  // navigation de l'application d'où l'on vient.
  const own = productOfPath(path);
  const [remembered, setRemembered] = useState<Product>("decide");
  useEffect(() => {
    try {
      if (own) sessionStorage.setItem(LAST_PRODUCT_KEY, own);
      else setRemembered((sessionStorage.getItem(LAST_PRODUCT_KEY) === "supply" ? "supply" : "decide"));
    } catch { /* navigation privée : on garde Décider par défaut */ }
  }, [own]);
  const product: Product = own ?? remembered;

  const productNav = useMemo(() => {
    if (product === "supply") {
      return {
        label: "Aura Énergie",
        home: "/cockpit/energie" as const,
        icon: <ShieldCheck size={15}/>,
        links: [
          // Le cockpit est à double usage (Cockpit / Décision) : pas d'entrée Décider séparée.
          { label: "Cockpit énergie", to: "/cockpit/energie" as const, active: path.includes("/energie"), icon: <LayoutDashboard size={11}/> },
          { label: "Studio", to: "/cockpit/studio" as const, active: path.includes("/studio"), icon: <Settings2 size={11}/> },
        ],
      };
    }
    return {
      label: "Aura Décider",
      home: "/cockpit/home" as const,
      icon: <Target size={15}/>,
      links: [
        { label: "Accueil", to: "/cockpit/home" as const, active: path.includes("/home"), icon: <Home size={11}/> },
        { label: "Nouvelle décision", to: "/cockpit/atelier" as const, active: path.includes("/atelier"), icon: <Target size={11}/> },
        { label: "Démonstrations", to: "/cockpit/demos" as const, active: path.includes("/demos"), icon: <Sparkles size={11}/> },
      ],
    };
  }, [path, product]);

  const expanded = open || drawer;
  return <>
    {drawer && <div className="aura-nav-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />}
    <aside id="aura-nav-sidebar" className={`aura-nav-sidebar ${expanded ? "open" : "closed"}${drawer ? " drawer-open" : ""}`} aria-label="Navigation Aura">
      <header className="aura-nav-head aura-hero-band aura-topbar-side">
        <Link to={productNav.home} aria-label={productNav.label} title={productNav.label}><AuraLogo size="sm" product={productNav.label.replace(/^Aura\s+/, "")} /></Link>
        <button className="aura-nav-collapse" onClick={() => setOpen(v => !v)} aria-label={open ? "Réduire le menu" : "Ouvrir le menu"}>{open ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}</button>
        <button className="aura-nav-close" onClick={() => setDrawer(false)} aria-label="Fermer le menu"><X size={18}/></button>
      </header>
      <nav className="aura-nav-main" aria-label={productNav.label}>
        {productNav.links.map(item => (
          <Link key={item.label} className={item.active ? "active" : ""} to={item.to} search={("search" in item ? item.search : undefined) as never} title={item.label}>
            <span className="aura-nav-icon">{item.icon}</span><span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {expanded && <NavHistory product={product} />}
      <div className="aura-nav-bottom">
        {expanded && <AccountFooter />}
      </div>
    </aside>
    {/* Barre mobile : placée après le menu dans le DOM (le logo du rail reste le premier), remontée en tête par order:-1. */}
    <div className="aura-mobile-bar aura-hero-band">
      <button type="button" className="aura-mobile-menu" onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" aria-expanded={drawer} aria-controls="aura-nav-sidebar"><Menu size={20}/><span>Menu</span></button>
      <Link to={productNav.home} aria-label={productNav.label} className="aura-mobile-brand"><AuraLogo size="sm" product={productNav.label.replace(/^Aura\s+/, "")} /></Link>
    </div>

    {/* Le bouton flottant "Demander à Aura" et son panneau de dialogue LLM
       ont été retirés (lot pilotage — demande explicite : "supprime le
       bouton LLM existant"). Le copilote LLM en volet droit n'est pas dans
       le périmètre de ce lot ; seule la navigation latérale ci-dessus est
       conservée. */}

    <style>{`
      .aura-nav-sidebar{width:280px;flex:0 0 280px;min-width:0;display:flex;flex-direction:column;background:#ffffff;border-right:0;box-shadow:inset -1px 0 0 #d4d4d4;color:#2b2b2b;z-index:30;transition:width .2s cubic-bezier(.4,0,.2,1),flex-basis .2s cubic-bezier(.4,0,.2,1);position:relative;height:100vh;overflow-y:auto;overscroll-behavior:contain}
      .aura-nav-sidebar.closed{width:64px;flex-basis:64px}.aura-nav-head{padding:12px 14px;display:flex;align-items:center}.aura-nav-head>a{display:flex;min-width:0;overflow:hidden;transition:opacity .15s}.aura-nav-head>a:hover{opacity:.82}.aura-nav-collapse{margin-left:auto;width:26px;height:26px;border:1px solid var(--aura-hero-line);background:rgb(255 255 255 / .06);border-radius:999px;color:#fff;display:grid;place-items:center;flex:0 0 auto;transition:background .15s,box-shadow .15s,transform .15s}.aura-nav-collapse:hover{background:rgb(255 255 255 / .16);transform:scale(1.05)}
      .aura-nav-main{display:flex;flex-direction:column;gap:2px;padding:10px 8px}
      .aura-nav-main>a{display:flex;align-items:center;gap:9px;min-height:33px;padding:0 8px;border-radius:8px;color:#4a4a4a;text-decoration:none;font-size:13.5px;font-weight:650;white-space:nowrap;position:relative;transition:background .15s,color .15s}
      .aura-nav-main>a:hover{background:#f6f3ff;color:#4a3fb0}
      .aura-nav-main>a:hover .aura-nav-icon{background:#ece6ff;color:#5637df}
      .aura-nav-main>a.active{background:#ededed;color:#1a1a1a;font-weight:800;box-shadow:inset 0 0 0 1px #c4c4c4}
      .aura-nav-main>a.active::before{content:"";position:absolute;left:-10px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--v4-accent,#7c3aed)}
      .aura-nav-main>a.active .aura-nav-icon{background:var(--v4-accent,#7c3aed);color:#ffffff}
      .aura-nav-icon{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:transparent;color:#8f88a8;flex:0 0 auto;transition:background .15s,color .15s}
      .aura-nav-separator{display:flex;align-items:center;gap:8px;margin:12px 4px 6px;padding-left:2px}
      .aura-nav-separator::after{content:"";flex:1;height:1px;background:#ece8f6}
      .aura-nav-separator span{font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#b3acc9;white-space:nowrap}
      .aura-connect-shortcuts{display:grid;gap:3px;margin:2px 0 4px 36px}.aura-connect-shortcuts a{font-size:13px;color:#4a4a4a;text-decoration:none;padding:6px;display:flex;align-items:center;gap:5px;border-radius:6px;transition:color .15s,background .15s}.aura-connect-shortcuts a:hover{color:#2b2b2b;background:#f2f2f2}.aura-connect-shortcuts a.sub-active{color:#1a1a1a;background:#ededed;font-weight:800}
      .aura-connect-shortcuts-l2{display:grid;gap:3px;margin:2px 0 2px 16px;padding-left:8px;border-left:1px solid #ece8f6}
      .aura-nav-history{min-height:0;margin:2px 10px 8px;padding-top:12px;border-top:1px solid #f0ecf9;overflow:auto}
      .aura-nav-history>header{display:flex;align-items:center;justify-content:space-between;margin:0 3px 6px}.aura-nav-history>header span{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#b3acc9}
      .aura-nav-history>div{display:grid;gap:2px}
      .aura-nav-history a{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;text-decoration:none;color:#2d2850;transition:background .15s,transform .12s}
      .aura-nav-history a:hover{background:#f6f3ff;transform:translateX(1px)}
      .aura-nav-history-dot{width:6px;height:6px;border-radius:999px;flex:0 0 auto;background:#c4bcf0}
      .aura-nav-history-dot.decision{background:#5637df}.aura-nav-history-dot.architecture{background:#0f9f7a}
      .aura-nav-history-text{display:grid;gap:1px;min-width:0}
      .aura-nav-history a small{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#958cae}
      .aura-nav-history a span:not(.aura-nav-history-dot){overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:650}
      .aura-nav-hist-row{display:flex;align-items:center;gap:2px;min-width:0}.aura-nav-hist-row>a{flex:1;min-width:0}.aura-nav-hist-row>input{flex:1;min-width:0;font-size:12.5px;padding:5px 6px;border:1px solid #c9bffd;border-radius:6px}.aura-nav-hist-row>button{border:0;background:transparent;color:#958cae;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;flex:0 0 auto}.aura-nav-hist-row>button:hover{background:#f0ecff;color:#5637df}.aura-nav-history{flex:1 1 50%}
      .aura-nav-history>p{margin:4px 8px;font-size:12px;line-height:1.45;color:#a29bb8}
      .aura-nav-bottom{margin-top:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
      .aura-account-footer{display:flex;flex-direction:column;gap:4px;padding:6px 8px;border-top:1px solid var(--aura-line,#e6e4f5)}
      .aura-demo-mode{display:block;font-size:12px;font-weight:700;color:#9a5b00;background:#fff4dc;border:1px solid #f3d08a;border-radius:7px;padding:3px 7px;margin-bottom:6px}
      .aura-account-status{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#4a4a4a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .aura-account-status i{width:7px;height:7px;border-radius:50%;background:#c9c4d8;flex:0 0 auto}
      .aura-account-status i.online{background:#18b981;box-shadow:0 0 0 3px #18b98122}
      .aura-account-row{display:flex;align-items:center;justify-content:space-between;gap:6px}
      .aura-account-menu{position:relative}
      .aura-account-menu summary{list-style:none;cursor:pointer;padding:6px 10px;border:1px solid #d4d4d4;border-radius:8px;color:#1a1a1a;font-size:13px;font-weight:750;background:#ffffff}
      .aura-account-menu summary::-webkit-details-marker{display:none}
      .aura-account-menu[open] summary{border-color:#c9bffd;color:#7c3aed}
      .aura-account-menu>div{position:absolute;bottom:calc(100% + 7px);left:0;min-width:180px;padding:6px;border:1px solid #ece6fb;border-radius:8px;background:#fff;box-shadow:0 18px 45px rgba(35,25,85,.14);display:grid;gap:2px;z-index:40}
      .aura-account-menu a,.aura-account-menu button{border:0;background:transparent;color:#1a1a1a;text-align:left;text-decoration:none;padding:9px 10px;border-radius:8px;font:650 13px var(--font-sans);cursor:pointer}
      .aura-account-menu a:hover,.aura-account-menu button:hover{background:#f0ecff;color:#7c3aed}
      .aura-account-menu a.primary{background:var(--v4-accent,#7c3aed);color:#fff}
      .aura-nav-status{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;background:#ffffff;border:1px solid #d4d4d4;color:#4a4a4a}
      .aura-nav-status svg{color:#059669;flex:0 0 auto}
      .aura-nav-status span{font-size:12.5px;line-height:1.5;font-weight:650}
      .aura-nav-status.closed{justify-content:center;padding:9px 0;background:transparent;border-color:transparent}
      .aura-nav-sidebar.closed .aura-nav-head{padding:6px 8px;justify-content:center;flex-direction:column;gap:4px}.aura-nav-sidebar.closed .aura-nav-head>a{width:28px}.aura-nav-sidebar.closed .aura-nav-head .aura-official-artwork img{display:none}.aura-nav-sidebar.closed .aura-nav-head .aura-brand-lockup>span:last-child{display:none}.aura-nav-sidebar.closed .aura-nav-collapse{margin:0}.aura-nav-sidebar.closed .aura-nav-main{padding:12px 10px}.aura-nav-sidebar.closed .aura-nav-main a{justify-content:center;padding:0}.aura-nav-sidebar.closed .aura-nav-main span:not(.aura-nav-icon){display:none}.aura-nav-sidebar.closed .aura-nav-main a.active::before{left:-10px}.aura-nav-sidebar.closed .aura-nav-separator{justify-content:center;margin:12px 0 6px}.aura-nav-sidebar.closed .aura-nav-separator::after{display:none}.aura-nav-sidebar.closed .aura-nav-separator span{display:none}
      .aura-mobile-bar,.aura-nav-close{display:none}
      .aura-nav-collapse{width:32px;height:32px}.aura-account-menu summary{min-height:32px;display:flex;align-items:center}.aura-account-menu a,.aura-account-menu button{min-height:36px;display:flex;align-items:center}.aura-account-row button{min-height:32px}.aura-nav-main>a{min-height:40px}
      @media(max-width:767px){
        .v4-shell{flex-direction:column}
        .v4-main{padding-bottom:0!important}
        .aura-mobile-bar{order:-1;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:60;min-height:56px;padding:8px 16px;border-bottom-color:transparent!important;flex:0 0 auto}
        .aura-mobile-menu{display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:0 12px;border:1px solid var(--aura-hero-line);border-radius:10px;background:rgb(255 255 255 / .08);color:#fff;font:700 13.5px var(--font-sans);cursor:pointer}
        .aura-mobile-brand{display:flex;min-width:0;overflow:hidden}
        .aura-nav-sidebar,.aura-nav-sidebar.closed{position:fixed;top:0;left:0;bottom:0;height:100dvh;width:min(300px,86vw);flex-basis:auto;transform:translateX(-105%);transition:transform .22s cubic-bezier(.4,0,.2,1);z-index:210;box-shadow:0 20px 60px rgba(20,12,50,.25);visibility:hidden}
        .aura-nav-sidebar.drawer-open{transform:none;visibility:visible}
        .aura-nav-backdrop{position:fixed;inset:0;z-index:205;background:rgba(15,12,30,.35)}
        .aura-nav-collapse{display:none}.aura-nav-close{display:grid;place-items:center;margin-left:auto;width:44px;height:44px;border:1px solid var(--aura-hero-line);border-radius:10px;background:rgb(255 255 255 / .08);color:#fff;cursor:pointer}
        .aura-nav-main>a{min-height:44px;font-size:14px}
        .aura-account-menu summary,.aura-account-row button{min-height:40px}.aura-account-menu a,.aura-account-menu button{min-height:40px}
      }
      @media(min-width:821px) and (max-width:1279px){.aura-nav-sidebar{width:228px;flex-basis:228px}}
      @media(min-width:768px) and (max-width:820px){.aura-nav-sidebar{width:68px;flex-basis:68px}.aura-nav-sidebar .aura-nav-head>a,.aura-nav-sidebar .aura-nav-main>a>span:not(.aura-nav-icon),.aura-nav-sidebar .aura-connect-shortcuts,.aura-nav-sidebar .aura-nav-status span,.aura-nav-sidebar .aura-nav-separator span{display:none}.aura-nav-head{justify-content:center;padding:10px}.aura-nav-collapse{margin:0}.aura-nav-main{padding:12px 8px}.aura-nav-main>a{justify-content:center;padding:0}.aura-nav-separator{justify-content:center}.aura-nav-status{justify-content:center;padding:9px 0;background:transparent;border-color:transparent}.aura-nav-bottom{padding:8px}.aura-account-footer{padding:6px 0}.aura-account-row{flex-direction:column;align-items:stretch}.aura-account-status{display:none}.aura-account-row>*{max-width:100%;overflow:hidden;transform:scale(.9);transform-origin:center}.aura-account-menu summary{padding:6px 4px;text-align:center;font-size:12.5px}}
    `}</style>
  </>;
}

/** Moitié basse du menu : décisions / études enregistrées (ouvrir, renommer, supprimer). */
function NavHistory({ product }: { product: Product }) {
  const [list, setList] = useState<AtelierSession[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const sync = () => { try { setList(loadSessions().filter(s => product === "supply" ? s.sector === "Supply chain" : s.sector !== "Supply chain")); } catch { setList([]); } };
    sync();
    return onSessionsChange(sync);
  }, [product]);
  const rename = (s: AtelierSession) => {
    const t = draft.trim();
    if (t && t !== s.title) saveSession({ ...s, title: t, updatedAt: new Date().toISOString() });
    setEditing(null);
  };
  return (
    <section className="aura-nav-history" data-testid="nav-history" aria-label="Décisions enregistrées">
      <header><span>{product === "supply" ? "Décisions enregistrées" : "Études enregistrées"}</span></header>
      {list.length === 0 ? <p>Aucune décision enregistrée pour l'instant.</p> : (
        <div>{list.map(s => (
          <div key={s.id} className="aura-nav-hist-row">
            {editing === s.id ? (
              <input autoFocus value={draft} aria-label="Nouveau nom" onChange={e => setDraft(e.target.value)} onBlur={() => rename(s)} onKeyDown={e => { if (e.key === "Enter") rename(s); if (e.key === "Escape") setEditing(null); }} />
            ) : product === "supply" ? (
              <Link to="/cockpit/resilience" search={{ section: "decision", sessionId: s.id }} title={s.title}><span className="aura-nav-history-dot decision" /><span className="aura-nav-history-text"><span>{s.title}</span></span></Link>
            ) : (
              <Link to="/cockpit/atelier" search={{ sessionId: s.id } as never} title={s.title}><span className="aura-nav-history-dot decision" /><span className="aura-nav-history-text"><span>{s.title}</span></span></Link>
            )}
            <button type="button" title="Renommer" aria-label={`Renommer ${s.title}`} onClick={() => { setEditing(s.id); setDraft(s.title); }}>✎</button>
            <button type="button" title="Supprimer" aria-label={`Supprimer ${s.title}`} onClick={() => { if (window.confirm(`Supprimer « ${s.title} » ?`)) deleteSession(s.id); }}>×</button>
          </div>
        ))}</div>
      )}
    </section>
  );
}
