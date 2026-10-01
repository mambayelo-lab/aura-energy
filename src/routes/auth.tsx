// auth.tsx — NOUVEAU (lot sécurité).
//
// Un seul écran pour entrer dans Aura : mot de passe, Google, second facteur.
// Trois règles :
//  1. Aucun droit n'est décidé ici. Cet écran obtient une session ; ce sont les
//     règles serveur qui autorisent ensuite la lecture des données.
//  2. Le second facteur est vérifié par le backend d'authentification
//     (challenge TOTP), pas par une comparaison dans le navigateur.
//  3. Une invitation reçue par lien (?invite=…) est consommée après connexion,
//     jamais avant : le jeton seul n'ouvre rien.
import { useEffect, useState } from "react";
import { audit, resetAccessCache } from "@/lib/security/use-access";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/org.functions";
import { AuraLogo } from "@/components/aura/AuraUI";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Connexion — Aura" },
      { name: "description", content: "Accédez à la plateforme Aura : décision augmentée et architecture de transformation." },
      { property: "og:title", content: "Connexion — Aura" },
      { property: "og:description", content: "Accès sécurisé à la plateforme Aura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCENT = "#6C5CE7";
const field: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
  border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text1)",
};
const primary: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 8, border: "none", cursor: "pointer",
  background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700,
};
const ghost: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 8, cursor: "pointer",
  border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text1)",
  fontSize: 13, fontWeight: 600,
};

function AuthPage() {
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvitation);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [ssoDomain, setSsoDomain] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("invite");
    if (t) setInvite(t);
  }, []);

  /** Après session valide : consommer l'invitation éventuelle, puis entrer. */
  async function afterSession() {
    resetAccessCache();
    audit("connexion", email || "sso");
    if (invite) {
      try { await accept({ data: { token: invite } }); }
      catch (e: any) { setNote(e?.message ?? "Invitation non appliquée"); }
    }
    navigate({ to: "/cockpit/home" });
  }

  /** Le second facteur est-il exigé ? On lit le niveau d'assurance de la session. */
  async function checkMfaThenEnter() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.nextLevel === "aal2" && data.nextLevel !== data.currentLevel) {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const factor = f?.totp?.[0];
      if (factor) { setMfa({ factorId: factor.id }); return; }
    }
    await afterSession();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setNote(null); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth${invite ? `?invite=${invite}` : ""}` },
        });
        if (error) throw error;
        setNote("Compte créé. Vérifiez votre messagerie pour confirmer l'adresse.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await checkMfaThenEnter();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Échec de la connexion");
    } finally { setBusy(false); }
  }

  // SSO entreprise : Microsoft Entra ID (OAuth, fournisseur « azure » de Supabase) et SAML 2.0 par domaine.
  async function microsoft() {
    setErr(null);
    const redirectTo = `${window.location.origin}/auth${invite ? `?invite=${invite}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo, scopes: "openid email profile" } });
    if (error) setErr(error.message);
  }
  async function saml() {
    setErr(null);
    const domain = (ssoDomain || email.split("@")[1] || "").trim();
    if (!domain) { setErr("Indiquez le domaine de votre entreprise (ex. entreprise.fr)."); return; }
    const { data, error } = await supabase.auth.signInWithSSO({ domain, options: { redirectTo: `${window.location.origin}/auth` } });
    if (error) setErr(`SSO SAML : ${error.message}`); else if (data?.url) window.location.href = data.url;
  }

  async function google() {
    setErr(null);
    const redirectTo = `${window.location.origin}/auth${invite ? `?invite=${invite}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setErr(error.message);
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfa) return;
    setBusy(true); setErr(null);
    try {
      const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: mfa.factorId });
      if (e1) throw e1;
      const { error: e2 } = await supabase.auth.mfa.verify({
        factorId: mfa.factorId, challengeId: ch!.id, code: code.trim(),
      });
      if (e2) throw e2;
      await afterSession();
    } catch (e: any) {
      setErr(e?.message ?? "Code refusé");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--v4-bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}><AuraLogo size="lg" /></div>

        <div style={{
          border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface)",
          padding: "24px 22px", boxShadow: "0 10px 30px rgba(20,20,50,.06)",
        }}>
          {invite && (
            <div style={{ fontSize: 13, color: ACCENT, marginBottom: 14, fontWeight: 600 }}>
              Invitation à rejoindre une organisation — connectez-vous avec l'adresse invitée.
            </div>
          )}

          {mfa ? (
            <form onSubmit={verifyMfa}>
              <h1 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Second facteur</h1>
              <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "0 0 16px" }}>
                Code à six chiffres de votre application d'authentification.
              </p>
              <input style={{ ...field, letterSpacing: ".3em", textAlign: "center", fontSize: 16 }}
                inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value)} placeholder="••••••" />
              <div style={{ height: 12 }} />
              <button style={primary} disabled={busy || code.length < 6}>Valider</button>
            </form>
          ) : (
            <form onSubmit={submit}>
              <h1 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>
                {mode === "signin" ? "Connexion" : "Créer un compte"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "0 0 16px" }}>
                Décision augmentée et architecture de transformation.
              </p>

              <button type="button" style={{ ...primary, marginBottom: 8 }} onClick={microsoft} data-testid="sso-microsoft">Se connecter avec Microsoft</button>
              <button type="button" style={ghost} onClick={google}>Continuer avec Google</button>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input style={{ ...field, flex: 1 }} value={ssoDomain} onChange={e => setSsoDomain(e.target.value)} placeholder="entreprise.fr" aria-label="Domaine SSO" />
                <button type="button" style={{ ...ghost, width: "auto", padding: "0 12px" }} onClick={saml}>SSO entreprise</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--v4-border)" }} />
                <span style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>OU</span>
                <div style={{ flex: 1, height: 1, background: "var(--v4-border)" }} />
              </div>

              <input style={field} type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="Adresse professionnelle" />
              <div style={{ height: 10 }} />
              <input style={field} type="password" required minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" />
              <div style={{ height: 14 }} />
              <button style={primary} disabled={busy}>
                {mode === "signin" ? "Se connecter" : "Créer le compte"}
              </button>
            </form>
          )}

          {err && <div style={{ marginTop: 12, fontSize: 13, color: "#c0392b" }}>{err}</div>}
          {note && <div style={{ marginTop: 12, fontSize: 13, color: ACCENT }}>{note}</div>}

          {!mfa && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--v4-text3)", textAlign: "center" }}>
              {mode === "signin" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); }}
                style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                {mode === "signin" ? "Créer un compte" : "Se connecter"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
