// cockpit.comptes.tsx — NOUVEAU (lot sécurité).
//
// Écran d'administration des comptes : organisation, membres, invitations,
// second facteur. Toute écriture passe par org.functions.ts, sous les règles
// d'accès serveur — l'écran ne fait qu'afficher ce que le rôle autorise.
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyOrg, createOrg, inviteMember, revokeInvitation, setMemberRole, removeMember,
} from "@/lib/org.functions";

export const Route = createFileRoute("/cockpit/comptes")({
  component: ComptesPage,
  head: () => ({
    meta: [
      { title: "Comptes et accès — Aura" },
      { name: "description", content: "Organisation, membres, invitations et second facteur de la plateforme Aura." },
      { property: "og:title", content: "Comptes et accès — Aura" },
      { property: "og:description", content: "Administration des comptes et des accès Aura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCENT = "#6C5CE7";
const card: React.CSSProperties = {
  border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface)", padding: "18px 20px",
};
const eyebrow: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--v4-text3)",
};
const field: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, fontSize: 13,
  border: "1px solid var(--v4-border)", background: "var(--v4-bg)", color: "var(--v4-text1)",
};
const btn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
  background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700,
};
const btnGhost: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
  border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)",
};

type OrgState = Awaited<ReturnType<typeof getMyOrg>>;

function ComptesPage() {
  const load = useServerFn(getMyOrg);
  const create = useServerFn(createOrg);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvitation);
  const setRole = useServerFn(setMemberRole);
  const kick = useServerFn(removeMember);

  const [state, setState] = useState<OrgState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const refresh = useCallback(() => {
    load().then(setState).catch(() => setErr("Connectez-vous pour administrer les comptes."));
  }, [load]);
  useEffect(refresh, [refresh]);

  const isAdmin = state?.role === "owner" || state?.role === "admin";

  async function guard(fn: () => Promise<unknown>) {
    setErr(null);
    try { await fn(); refresh(); }
    catch (e: any) { setErr(e?.message ?? "Action refusée"); }
  }

  return (
    <div style={{ padding: "26px 30px", maxWidth: 1000 }}>
      <div style={eyebrow}>Sécurité</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>Comptes et accès</h1>
      <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "0 0 22px" }}>
        Une organisation, des rôles, un second facteur. Rien d'autre.
      </p>

      {err && (
        <div style={{ ...card, borderColor: "#e5b4ae", marginBottom: 18, fontSize: 13, color: "#c0392b" }}>
          {err} <Link to="/auth" style={{ color: ACCENT, fontWeight: 700 }}>Connexion</Link>
        </div>
      )}

      {state && !state.org && (
        <section style={{ ...card, marginBottom: 18 }}>
          <div style={eyebrow}>Organisation</div>
          <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "6px 0 12px" }}>
            Créez votre organisation pour inviter vos équipes.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...field, flex: 1 }} value={orgName} onChange={(e) => setOrgName(e.target.value)}
              placeholder="Nom de l'entreprise" />
            <button style={btn} disabled={orgName.trim().length < 2}
              onClick={() => guard(() => create({ data: { name: orgName.trim() } }))}>Créer</button>
          </div>
        </section>
      )}

      {state?.org && (
        <>
          <section style={{ ...card, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={eyebrow}>Organisation</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{state.org.name}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>
                Votre rôle : <strong style={{ color: "var(--v4-text1)" }}>{state.role}</strong> · Formule {state.org.plan}
              </div>
            </div>
          </section>

          <section style={{ ...card, marginBottom: 18 }}>
            <div style={eyebrow}>Membres ({state.members.length})</div>
            <div style={{ marginTop: 12 }}>
              {state.members.map((m: any) => (
                <div key={m.user_id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "9px 0",
                  borderTop: "1px solid var(--v4-border)", fontSize: 13,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{m.email ?? m.name ?? m.user_id.slice(0, 8)}{m.isMe ? " · vous" : ""}</div>
                  </div>
                  {isAdmin && !m.isMe ? (
                    <>
                      <select style={field} value={m.role}
                        onChange={(e) => guard(() => setRole({ data: { org_id: state.org!.id, user_id: m.user_id, role: e.target.value as any } }))}>
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                      <button style={btnGhost}
                        onClick={() => guard(() => kick({ data: { org_id: state.org!.id, user_id: m.user_id } }))}>Retirer</button>
                    </>
                  ) : (
                    <span style={{ color: "var(--v4-text3)" }}>{m.role}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {isAdmin && (
            <section style={{ ...card, marginBottom: 18 }}>
              <div style={eyebrow}>Invitations</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <input style={{ ...field, flex: 1, minWidth: 220 }} type="email" value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@entreprise.com" />
                <select style={field} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <button style={btn} disabled={!inviteEmail.includes("@")} onClick={() => guard(async () => {
                  const r: any = await invite({ data: { org_id: state.org!.id, email: inviteEmail, role: inviteRole } });
                  setLastLink(`${window.location.origin}/auth?invite=${r.invitation.token}`);
                  setInviteEmail("");
                })}>Inviter</button>
              </div>

              {lastLink && (
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--v4-text2)", wordBreak: "break-all" }}>
                  Lien d'invitation à transmettre : <code style={{ color: ACCENT }}>{lastLink}</code>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                {state.invitations.map((i: any) => {
                  const status = i.revoked_at ? "révoquée" : i.accepted_at ? "acceptée"
                    : new Date(i.expires_at) < new Date() ? "expirée" : "en attente";
                  return (
                    <div key={i.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
                      borderTop: "1px solid var(--v4-border)", fontSize: 13,
                    }}>
                      <div style={{ flex: 1 }}>{i.email} <span style={{ color: "var(--v4-text3)" }}>· {i.role}</span></div>
                      <span style={{ fontSize: 13, color: status === "en attente" ? ACCENT : "var(--v4-text3)" }}>{status}</span>
                      {status === "en attente" && (
                        <button style={btnGhost} onClick={() => guard(() => revoke({ data: { id: i.id } }))}>Révoquer</button>
                      )}
                    </div>
                  );
                })}
                {state.invitations.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucune invitation.</div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <MfaSection />
    </div>
  );
}

/**
 * Second facteur (TOTP). L'inscription se fait en deux temps : on obtient un
 * secret et un QR code, puis on prouve la possession par un premier code.
 * Aucun secret n'est stocké côté application.
 */
function MfaSection() {
  const [factors, setFactors] = useState<any[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => setFactors(data?.totp ?? []));
  }, []);
  useEffect(refresh, [refresh]);

  async function start() {
    setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) { setMsg(error.message); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code });
  }

  async function confirm() {
    if (!enroll) return;
    setMsg(null);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    if (e1) { setMsg(e1.message); return; }
    const { error: e2 } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
    if (e2) { setMsg(e2.message); return; }
    setEnroll(null); setCode(""); setMsg("Second facteur activé."); refresh();
  }

  async function remove(id: string) {
    await supabase.auth.mfa.unenroll({ factorId: id });
    refresh();
  }

  const active = factors.filter((f) => f.status === "verified");

  return (
    <section style={card}>
      <div style={eyebrow}>Second facteur</div>
      <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "6px 0 12px" }}>
        Code temporaire exigé à chaque connexion. Recommandé pour tout accès aux décisions.
      </p>

      {active.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          <span style={{ color: ACCENT, fontWeight: 700 }}>Activé</span>
          <button style={btnGhost} onClick={() => remove(active[0].id)}>Désactiver</button>
        </div>
      ) : enroll ? (
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <img src={enroll.qr} alt="QR code d'inscription au second facteur" width={148} height={148}
            style={{ border: "1px solid var(--v4-border)", borderRadius: 8, background: "#fff" }} />
          <div>
            <div style={{ fontSize: 13, color: "var(--v4-text2)", marginBottom: 12 }}>
              Scannez, puis saisissez le code affiché.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...field, letterSpacing: ".2em", width: 120 }} inputMode="numeric" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" />
              <button style={btn} disabled={code.length < 6} onClick={confirm}>Activer</button>
            </div>
          </div>
        </div>
      ) : (
        <button style={btn} onClick={start}>Activer le second facteur</button>
      )}

      {msg && <div style={{ marginTop: 10, fontSize: 13, color: ACCENT }}>{msg}</div>}
    </section>
  );
}
