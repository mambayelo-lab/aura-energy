import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { STRATEGIC_EXAMPLES } from "../lib/v4/strategic-examples";
import { useEffect, useState } from "react";
import {
  ArrowRight, BriefcaseBusiness, CheckCircle2, FileText, Layers3, PackagePlus, Compass, Route as RouteIcon,
  ShieldCheck, Sparkles, Target, Users2,
} from "lucide-react";
import { loadSessions, type AtelierSession } from "../lib/v4/atelier-store";

export const Route = createFileRoute("/cockpit/home")({ component: HomePage });

const INTENTS = [
  { key: "produit", title: "Construire ou améliorer un produit", detail: "Clarifier la valeur, confronter les options et préparer l'exécution.", icon: PackagePlus, color: "#4743E6" },
  { key: "offre", title: "Construire ou améliorer une offre", detail: "Aligner promesse, modèle économique, faisabilité et risques.", icon: BriefcaseBusiness, color: "#4743E6" },
  { key: "strategie", title: "Construire ou consolider une stratégie", detail: "Choisir un cap, tester les compromis et ordonner la trajectoire.", icon: Compass, color: "#4743E6" },
] as const;

const STEP_LABEL: Record<string, string> = {
  comprendre: "Cadrage", impacter: "Critères & impacts", composer: "Options",
  decider: "Arbitrage", suivi: "Suivi",
};

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function HomePage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AtelierSession[]>([]);
  useEffect(() => setSessions(loadSessions()), []);
  const recents = sessions.filter(session => session.title?.trim()).slice(0, 5);

  function begin(intent: string) {
    try {
      const current = JSON.parse(localStorage.getItem("aura.pendingContext.v1") || "[]");
      localStorage.setItem("aura.pendingContext.v1", JSON.stringify([...current, { text: intent }].slice(-12)));
    } catch {
      localStorage.setItem("aura.pendingContext.v1", JSON.stringify([{ text: intent }]));
    }
    navigate({ to: "/cockpit/atelier", search: { sessionId: undefined, alertId: undefined, demo: undefined, finalite: "decision", title: undefined } });
  }

  return (
    <div className="aura-home">
      <header className="aura-home-top aura-hero-band">
        <div><span className="aura-hero-eyebrow">AURA ÉNERGIE · ESPACE DE TRAVAIL</span> <a href="/cockpit/energie" data-testid="home-energy-link" style={{ marginLeft: 8, fontWeight: 700 }}>Cockpit énergie →</a><h1 className="aura-hero-title">Bonjour, que faisons-nous <em className="aura-kw-hero">avancer</em> ?</h1></div>
        <div className="aura-home-trust aura-hero-sub" title="IA guidée · validation humaine"><ShieldCheck size={14} /></div>
      </header>

      <main className="aura-home-main">
        <section className="aura-home-hero">
          <div className="aura-home-orbit" aria-hidden="true">
            <i /><i /><i /><i />
            <span><Sparkles size={23} /></span>
          </div>
          <div>
            <h1 title="Aura structure votre décision : questions, critères, options et arbitrage — avec validation humaine à chaque étape.">Une intention.<br />Un chemin clair jusqu'à l'action.</h1>
          </div>
        </section>

        <section className="aura-intent-grid" aria-label="Intentions de travail">
          {INTENTS.map(intent => {
            const Icon = intent.icon;
            return <article key={intent.key}>
              <span className="aura-icon-pill" data-testid="intent-icon"><Icon /></span>
              <h2 title={intent.detail}>{intent.title}</h2>
              <div>
                <button onClick={() => begin(intent.title)}>Décider <ArrowRight size={13} /></button>
              </div>
            </article>;
          })}
          <article className="aura-intent-other">
            <span className="aura-icon-pill" data-testid="intent-icon"><RouteIcon /></span>
            <h2 title="Décrivez-le librement : Aura vous guide pas à pas sans vous enfermer dans une catégorie.">Un autre enjeu</h2>
            <button onClick={() => begin("Un autre enjeu")}>Décrire mon besoin <ArrowRight size={13} /></button>
          </article>
        </section>

        <section className="aura-home-examples" aria-label="Exemples stratégiques Supply Chain">
          <div className="aura-home-section-head"><div><span className="eyebrow">EXEMPLES</span><h2>Décisions Supply Chain stratégiques</h2></div></div>
          <div className="aura-example-grid">
            {STRATEGIC_EXAMPLES.map(ex => <button key={ex.titre} data-testid="strategic-example" onClick={() => begin(ex.question)} title={ex.question}><small>{ex.secteur}</small><strong>{ex.titre}</strong></button>)}
          </div>
        </section>

        <section className="aura-home-work">
          <div className="aura-home-section-head">
            <div><span className="eyebrow">REPRENDRE</span><h2>Vos travaux récents</h2></div>
          </div>
          <div className="aura-recent-grid">
            {recents.length ? recents.map(session =>
              <a key={session.id} href={`/cockpit/atelier?sessionId=${session.id}`}>
                <span className="aura-recent-kind"><Target size={13} />DÉCISION</span>
                <strong>{session.title}</strong>
                <small><i />{STEP_LABEL[session.step] || session.step} · {timeAgo(session.updatedAt)}</small>
                <ArrowRight className="arrow" size={15} />
              </a>
            ) : <button className="aura-empty" onClick={() => begin("Nouvelle décision")}>
              <Target size={18} /><span><strong>Première décision</strong><small>Commencer un dossier guidé</small></span><ArrowRight size={15} />
            </button>}
          </div>
        </section>

        <section className="aura-home-capabilities">
          <div title="PDF, Word, Excel, images"><FileText size={16} /><span><b>Documents</b></span></div>
          <div title="Propositions à valider"><Sparkles size={16} /><span><b>Génération contrôlée</b></span></div>
          <div title="Rôles et propositions"><Users2 size={16} /><span><b>Travail collectif</b></span></div>
          <div title="Sources, choix et preuves"><CheckCircle2 size={16} /><span><b>Traçabilité</b></span></div>
        </section>
      </main>


      <style>{`
        .aura-home-examples{margin:18px 0}.aura-example-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}.aura-example-grid button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border:1px solid #e6e3f4;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font:inherit}.aura-example-grid button:hover{border-color:#6750df}.aura-example-grid small{font-size:12px;color:#6b6f8a;text-transform:uppercase;letter-spacing:.04em}.aura-example-grid strong{font-size:13px;color:#18162d}
        .aura-home{min-height:100%;background:#fff;color:#18162d;font-family:var(--font-sans);background-image:radial-gradient(#6750df0c 1px,transparent 1px);background-size:24px 24px}.aura-home-top{min-height:76px;padding:14px 30px;display:flex;align-items:center;justify-content:space-between;gap:16px;position:sticky;top:0;z-index:5}.aura-home-top>div:first-child span{display:block;font-size:12px;font-weight:800}.aura-home-top h1{margin:4px 0 0;font-size:18.5px;line-height:1.15}.aura-home-trust{display:flex;align-items:center;gap:6px;font-size:13px;padding:6px 10px;border-radius:999px;border:1px solid var(--aura-hero-line);background:rgb(255 255 255 / .04)}.aura-home-main{max-width:1120px;margin:0 auto;padding:26px 34px 34px}.aura-home-hero{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:30px;padding:0 10px 26px}.eyebrow{font-size:12px;letter-spacing:.15em;font-weight:850;color:#6848dd}.aura-home-hero h1{font:600 clamp(24.5px,2.78vw,35px)/1.08 var(--font-display);letter-spacing:-.025em;margin:9px 0 13px;max-width:660px}.aura-home-hero p{font-size:13px;line-height:1.65;color:#666079;max-width:650px;margin:0}.aura-home-orbit{width:140px;height:140px;border-radius:50%;position:relative;background:radial-gradient(circle,#f2efff 0 28%,transparent 29%),conic-gradient(from 10deg,#6645df22,#0f9f751b,#de8a141a,#6645df22);box-shadow:inset 0 0 0 1px #e8e3fb}.aura-home-orbit:after{content:"";position:absolute;inset:28px;border:1px solid #dcd5f7;border-radius:50%}.aura-home-orbit>span{position:absolute;inset:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:8px;background:linear-gradient(145deg,#5030d1,#7759ef);color:#fff;display:grid;place-items:center;box-shadow:0 14px 30px #6042e43d;z-index:2}.aura-home-orbit i{position:absolute;width:10px;height:10px;border-radius:50%;background:#6645df;box-shadow:0 0 0 5px #fff}.aura-home-orbit i:nth-child(1){top:13px;left:74px}.aura-home-orbit i:nth-child(2){right:12px;top:74px;background:#0f9f75}.aura-home-orbit i:nth-child(3){bottom:13px;left:74px;background:#de8a14}.aura-home-orbit i:nth-child(4){left:12px;top:74px;background:#e24e67}.aura-intent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.aura-intent-grid article{background:var(--aura-glass-bg);border:1px solid var(--aura-glass-border);border-radius:12px;padding:18px;box-shadow:var(--aura-glass-shadow);backdrop-filter:blur(8px);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.aura-intent-grid article:hover{transform:translateY(-2px);border-color:rgb(71 67 230 / .3);box-shadow:var(--aura-glass-shadow-hover)}@media (prefers-reduced-motion:reduce){.aura-intent-grid article,.aura-intent-grid article:hover{transition:none;transform:none}}.aura-intent-icon{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;background:#f0edfa;color:#6856a8}.aura-intent-grid h2{font-size:13px;margin:12px 0 6px;letter-spacing:-.01em}.aura-intent-grid p{font-size:12.5px;line-height:1.55;color:#77718a;margin:0;min-height:33px}.aura-intent-grid article>div:last-child{display:flex;gap:7px;margin-top:13px}.aura-intent-grid button{border:0;background:#f2effd;color:#5a3dd1;border-radius:8px;padding:7px 9px;font:750 12px var(--font-sans);display:flex;align-items:center;gap:5px;cursor:pointer}.aura-intent-grid button+button{background:#f4f8f7;color:#177b61}.aura-intent-other>button{margin-top:13px!important;background:#211d48!important;color:#fff!important}.aura-home-work{margin-top:36px}.aura-home-section-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:11px}.aura-home-section-head h2{font:600 17.5px var(--font-display);margin:5px 0 0}.aura-home-section-head>a{display:flex;align-items:center;gap:6px;color:#6042d9;text-decoration:none;font-size:12.5px;font-weight:750}.aura-recent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.aura-recent-grid>a,.aura-empty{position:relative;min-height:94px;border:1px solid #e9e5f4;border-radius:8px;background:#fff;padding:14px;text-decoration:none;color:#211e3a;display:flex;flex-direction:column;align-items:flex-start;text-align:left}.aura-recent-grid>a:hover{border-color:#cfc5f7}.aura-recent-kind{display:flex;align-items:center;gap:5px;color:#6346d8;font-size:12px;font-weight:850;letter-spacing:.1em}.aura-recent-grid strong{font-size:13px;margin-top:9px;max-width:85%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.aura-recent-grid small{font-size:12px;color:#827c94;margin-top:6px;display:flex;align-items:center;gap:5px}.aura-recent-grid small i{width:5px;height:5px;border-radius:50%;background:#17aa7d}.aura-recent-grid .arrow{position:absolute;right:14px;top:39px;color:#8875db}.aura-recent-grid .architecture .aura-recent-kind{color:#0b8a68}.aura-empty{width:100%;flex-direction:row;align-items:center;gap:10px;color:#6346d8;cursor:pointer}.aura-empty span{display:flex;flex-direction:column}.aura-empty strong{margin:0}.aura-empty small{margin-top:3px}.aura-empty>svg:last-child{margin-left:auto}.aura-home-capabilities{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:30px;border-top:1px solid #ece9f4;padding-top:18px}.aura-home-capabilities>div{display:flex;align-items:center;gap:9px;color:#6046c3}.aura-home-capabilities span,.aura-home-capabilities b,.aura-home-capabilities small{display:block}.aura-home-capabilities b{font-size:12px;color:#3a3550}.aura-home-capabilities small{font-size:12px;color:#8d879c;margin-top:2px}@media(max-width:920px){.aura-home-main{padding:30px 22px}.aura-home-hero{grid-template-columns:1fr}.aura-home-orbit{display:none}.aura-home-capabilities{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.aura-intent-grid,.aura-recent-grid{grid-template-columns:1fr}.aura-home-top{padding:0 18px}.aura-home-trust{display:none}}
      `}</style>
    </div>
  );
}
