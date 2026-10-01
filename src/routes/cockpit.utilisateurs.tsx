// Administration : utilisateurs et rôles de l'organisation, journal d'audit (filtres, export CSV).
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageBody, PageHeader } from "../components/aura/AuraUI";
import { getMyOrg, inviteMember, removeMember, setMemberRole } from "@/lib/org.functions";
import { auditCsv, listAudit, type AuditEntry } from "@/lib/security/security.functions";
import { audit, useAccess } from "@/lib/security/use-access";
import { ROLES, normalizeRole } from "@/lib/security/access";

export const Route = createFileRoute("/cockpit/utilisateurs")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Utilisateurs et audit — Aura" }] }),
});

const ACTIONS = ["", "connexion", "sources", "mappings", "regles", "seuils", "decision", "export", "synchronisation", "utilisateurs"];
// Rôle affiché → valeur enregistrée (valeurs historiques conservées pour les policies existantes).
const STORED: Record<string, string> = { administrateur: "admin", analyste: "member", lecteur: "lecteur" };

function UsersPage() {
  const access = useAccess();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [org, setOrg] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [f, setF] = useState({ action: "", user: "", from: "", to: "" });

  const loadOrg = useCallback(() => { if (!access.demo && access.role) getMyOrg().then(setOrg).catch(e => setErr(e.message)); }, [access.demo, access.role]);
  const loadAudit = useCallback(() => { listAudit({ data: { ...f } }).then(r => setEntries(r.entries)).catch(e => setErr(e.message)); }, [f]);
  useEffect(loadOrg, [loadOrg]);
  useEffect(() => { if (tab === "audit") loadAudit(); }, [tab, loadAudit]);

  if (!access.can("users.manage")) return <div className="us-page"><PageHeader title="Utilisateurs et audit" /><PageBody width={1100}><p role="alert">Écran réservé aux administrateurs.</p></PageBody></div>;

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([auditCsv(entries)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    audit("export", "journal d'audit (CSV)", { lignes: entries.length });
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function guard(fn: () => Promise<unknown>, action: string, target: string) {
    try { await fn(); audit(action, target); loadOrg(); } catch (e) { setErr((e as Error).message); }
  }

  return <div className="us-page">
    <PageHeader title="Utilisateurs et audit" badge={access.demo ? "Mode démo" : access.orgName ?? undefined} />
    <PageBody width={1100}>
      <style>{CSS}</style>
      <div className="us-tabs" role="tablist" aria-label="Administration">
        <button role="tab" aria-selected={tab === "users"} onClick={() => setTab("users")}>Utilisateurs et rôles</button>
        <button role="tab" aria-selected={tab === "audit"} onClick={() => setTab("audit")}>Journal d'audit</button>
      </div>
      {err && <p className="us-err" role="alert">{err}</p>}

      {tab === "users" && <section aria-label="Utilisateurs et rôles">
        <ul className="us-roles">{ROLES.map(r => <li key={r.id}><b>{r.label}</b> : {r.hint}</li>)}</ul>
        {access.demo ? <p className="us-note">Mode démo : aucun utilisateur. Connectez-vous (SSO Microsoft, Google ou SAML) pour gérer les membres de votre organisation.</p>
          : !org?.org ? <p className="us-note">Aucune organisation : créez-la depuis « Équipe & accès ».</p> : <>
          <table className="us-table"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Arrivée</th><th /></tr></thead><tbody>
            {org.members.map((m: any) => <tr key={m.user_id}>
              <td>{m.email ?? m.user_id}</td>
              <td><select aria-label={`Rôle de ${m.email ?? m.user_id}`} value={normalizeRole(m.role) ?? "lecteur"} onChange={e => guard(() => setMemberRole({ data: { org_id: org.org.id, user_id: m.user_id, role: STORED[e.target.value] as any } }), "utilisateurs.role", `${m.email ?? m.user_id} → ${e.target.value}`)}>
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td>
              <td>{m.joined_at ? new Date(m.joined_at).toLocaleDateString("fr-FR") : "invité"}</td>
              <td><button onClick={() => guard(() => removeMember({ data: { org_id: org.org.id, user_id: m.user_id } }), "utilisateurs.retrait", m.email ?? m.user_id)}>Retirer</button></td>
            </tr>)}
          </tbody></table>
          <form className="us-invite" onSubmit={e => { e.preventDefault(); void guard(() => inviteMember({ data: { org_id: org.org.id, email: invite.email, role: invite.role as any } }), "utilisateurs.invitation", invite.email); }}>
            <input type="email" required placeholder="Adresse professionnelle" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} aria-label="Adresse à inviter" />
            <select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })} aria-label="Rôle de l'invité"><option value="lecteur">Lecteur</option><option value="member">Analyste</option><option value="admin">Administrateur</option></select>
            <button>Inviter</button>
          </form>
        </>}
      </section>}

      {tab === "audit" && <section aria-label="Journal d'audit">
        <p className="us-note">Qui a fait quoi et quand. Journal en ajout seul : aucune ligne ne peut être modifiée ni supprimée{access.demo ? " (mode démo : journal de la session serveur)" : ""}.</p>
        <div className="us-filters">
          <label>Action<select value={f.action} onChange={e => setF({ ...f, action: e.target.value })}>{ACTIONS.map(a => <option key={a} value={a}>{a || "Toutes"}</option>)}</select></label>
          <label>Utilisateur<input value={f.user} onChange={e => setF({ ...f, user: e.target.value })} placeholder="adresse ou nom" /></label>
          <label>Du<input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></label>
          <label>Au<input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></label>
          <button onClick={exportCsv} disabled={!entries.length}>Exporter en CSV</button>
        </div>
        <table className="us-table" data-testid="audit-table"><thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Objet</th><th>Détails</th></tr></thead><tbody>
          {entries.map(e => <tr key={e.id}><td>{new Date(e.at).toLocaleString("fr-FR")}</td><td>{e.user}</td><td><code>{e.action}</code></td><td>{e.target}</td><td>{Object.entries(e.details).map(([k, v]) => `${k} : ${v}`).join(" · ")}</td></tr>)}
          {!entries.length && <tr><td colSpan={5}>Aucune entrée pour ces filtres.</td></tr>}
        </tbody></table>
      </section>}
    </PageBody>
  </div>;
}

const CSS = `
.us-page{display:flex;flex-direction:column;flex:1;background:#fff}
.us-tabs{display:flex;gap:6px;border-bottom:1px solid #e3e1ee;margin-bottom:12px}.us-tabs button{border:0;background:none;padding:9px 12px;font-weight:600;color:#5b5f7a;cursor:pointer;border-bottom:3px solid transparent}.us-tabs button[aria-selected=true]{color:#2a1d73;border-bottom-color:#6d4bdf}
.us-roles{margin:0 0 12px;padding-left:18px;font-size:13px;color:#3b3f5c}.us-note{font-size:13px;color:#5b5f7a}.us-err{color:#b42318}
.us-table{width:100%;border-collapse:collapse;font-size:13px}.us-table th{text-align:left;font-size:11px;color:#6b6f8a;padding:6px}.us-table td{padding:6px;border-top:1px solid #f0eef7;vertical-align:top}
.us-table select,.us-invite input,.us-invite select,.us-filters input,.us-filters select{padding:6px 8px;border:1px solid #dcd9ea;border-radius:7px}
.us-table button,.us-invite button,.us-filters button{padding:6px 12px;border-radius:8px;border:1px solid #cfc9ea;background:#fff;cursor:pointer;font-weight:600;color:#4b3fa8}
.us-invite{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.us-filters{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:10px 0}.us-filters label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#5b5f7a}
`;
