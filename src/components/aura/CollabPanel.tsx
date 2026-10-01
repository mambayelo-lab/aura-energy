// Collaboration sur une alerte ou une décision : commentaires avec mentions @,
// assignation et statut (alerte), fil d'activité de l'espace. Avec une session,
// l'espace est l'organisation (Supabase, droits par rôle) ; sans session, repli
// local dans ce navigateur, signalé. Rafraîchissement simple (bouton et 30 s).
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Users } from "lucide-react";
import { useAccess } from "../../lib/security/use-access";
import { addComment, getCollab, setAssignment } from "../../lib/collab/collab.functions";
import { EMPTY, STATUS_LABEL, assignmentOf, commentsOf, loadLocal, saveLocal, withAssignment, withComment, type AssignStatus, type CollabSnapshot, type TargetType } from "../../lib/collab/collab";

type State = CollabSnapshot & { members: string[]; me: string | null };
const LOCAL_USER = "moi (ce navigateur)";

export function CollabPanel({ targetType, targetId, label }: { targetType: TargetType; targetId: string; label: string }) {
  const access = useAccess();
  const [s, setS] = useState<State>({ ...EMPTY, members: [], me: null });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const r = await getCollab(); setS(r.shared ? r : { ...loadLocal(), members: [], me: null }); }
    catch { setS({ ...loadLocal(), members: [], me: null }); }
  }, []);
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 30_000); return () => clearInterval(t); }, [refresh]);
  const canWrite = access.can("comment.write");
  const local = (next: CollabSnapshot) => { saveLocal(next); setS({ ...next, members: [], me: null }); };

  async function send() {
    if (!draft.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (s.shared) { await addComment({ data: { targetType, targetId, body: draft, members: s.members } }); await refresh(); }
      else local(withComment(s, { targetType, targetId, user: LOCAL_USER, body: draft }));
      setDraft("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function assign(patch: { assignee?: string | null; status?: AssignStatus }) {
    setErr(null);
    try {
      if (s.shared) { await setAssignment({ data: { alertId: targetId, ...patch } }); await refresh(); }
      else local(withAssignment(s, { alertId: targetId, user: LOCAL_USER, ...patch }));
    } catch (e) { setErr((e as Error).message); }
  }
  const comments = commentsOf(s, targetType, targetId), a = targetType === "alerte" ? assignmentOf(s, targetId) : undefined;
  const feed = s.activity.slice(0, 15);
  return (
    <section className="cp" aria-label={`Collaboration : ${label}`} data-testid="collab-panel">
      <style>{CSS}</style>
      <header>
        <b><MessageSquare size={14} /> Commentaires ({comments.length})</b>
        <span className={`cp-mode${s.shared ? " shared" : ""}`} data-testid="collab-mode" title={s.shared ? "Espace partagé : votre organisation (Supabase, droits par rôle)." : "Sans session : les commentaires restent dans ce navigateur et ne sont pas partagés."}>
          <Users size={12} /> {s.shared ? `espace partagé${access.orgName ? ` · ${access.orgName}` : ""}` : "local (sans session)"}
        </span>
        <button type="button" className="cp-ico" onClick={() => void refresh()} aria-label="Rafraîchir" title="Rafraîchir"><RefreshCw size={13} /></button>
      </header>
      {targetType === "alerte" && (
        <div className="cp-assign">
          <label>Assignée à
            {s.shared
              ? <select aria-label="Assignée à" disabled={!canWrite} value={a?.assignee ?? ""} onChange={e => void assign({ assignee: e.target.value || null })}><option value="">Personne</option>{s.members.map(m => <option key={m} value={m}>{m}</option>)}</select>
              : <input aria-label="Assignée à" disabled={!canWrite} defaultValue={a?.assignee ?? ""} placeholder="nom ou adresse" onBlur={e => { if ((a?.assignee ?? "") !== e.target.value.trim()) void assign({ assignee: e.target.value.trim() || null }); }} />}
          </label>
          <label>Statut
            <select aria-label="Statut" disabled={!canWrite} value={a?.status ?? "a_traiter"} onChange={e => void assign({ status: e.target.value as AssignStatus })}>
              {(Object.keys(STATUS_LABEL) as AssignStatus[]).map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
            </select>
          </label>
        </div>
      )}
      <ul className="cp-list">
        {comments.map(c => <li key={c.id}><small>{c.user || "—"} · {new Date(c.at).toLocaleString("fr-FR")}</small><p>{c.body.split(/(@[\p{L}\d._%+@-]+)/u).map((part, i) => part.startsWith("@") ? <mark key={i}>{part}</mark> : part)}</p></li>)}
        {!comments.length && <li className="cp-empty">Aucun commentaire.</li>}
      </ul>
      {canWrite
        ? <div className="cp-new">
            <textarea aria-label="Nouveau commentaire" value={draft} onChange={e => setDraft(e.target.value)} placeholder={s.shared && s.members.length ? `Commenter ; mentionner avec @, ex. @${s.members[0].split("@")[0]}` : "Commenter ; mentionner avec @nom"} rows={2} />
            <button type="button" disabled={busy || !draft.trim()} onClick={() => void send()}>Publier</button>
          </div>
        : <p className="cp-empty">Lecture seule : votre rôle ne permet pas de commenter.</p>}
      {err && <p className="cp-err" role="alert">{err}</p>}
      <details className="cp-feed" data-testid="collab-activity">
        <summary>Fil d'activité ({feed.length})</summary>
        <ul>{feed.map(x => <li key={x.id}><small>{new Date(x.at).toLocaleString("fr-FR")}</small> <b>{x.user || "—"}</b> {x.summary} <small>({x.targetType} {x.targetId})</small></li>)}</ul>
        {!s.shared && <p className="cp-empty">Pour partager cet espace avec des collègues : connectez-vous, puis invitez-les dans <a href="/cockpit/utilisateurs">Compte → Équipe &amp; accès</a>.</p>}
      </details>
    </section>
  );
}

const CSS = `
.cp{border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;padding:10px 12px;margin-top:12px;background:var(--v4-surface,#fff);display:grid;gap:8px;font-size:13px}
.cp header{display:flex;align-items:center;gap:8px}
.cp header b{display:inline-flex;gap:5px;align-items:center}
.cp-mode{font-size:12px;padding:1px 8px;border-radius:999px;background:#fff4e0;color:#8a5a00;display:inline-flex;gap:4px;align-items:center}
.cp-mode.shared{background:#e8f7ef;color:#0d7a54}
.cp-ico{margin-left:auto;border:0;background:none;cursor:pointer;color:#4c3d7a}
.cp-assign{display:flex;gap:10px;flex-wrap:wrap}
.cp-assign label{display:grid;gap:2px;font-size:12px;color:#4c3d7a}
.cp-assign select,.cp-assign input{padding:4px 7px;border:1px solid #d9d6f5;border-radius:7px;font:inherit;font-size:13px}
.cp-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:220px;overflow:auto}
.cp-list li p{margin:2px 0 0;white-space:pre-wrap}
.cp-list mark{background:#ecebff;color:#4743E6;border-radius:4px;padding:0 2px}
.cp-empty{color:#8a86a8;margin:0;font-size:12.5px}
.cp-new{display:flex;gap:8px;align-items:flex-start}
.cp-new textarea{flex:1;padding:6px 8px;border:1px solid #d9d6f5;border-radius:8px;font:inherit;font-size:13px}
.cp-new button{padding:6px 12px;border-radius:8px;border:1px solid #4743E6;background:#4743E6;color:#fff;font-weight:700;cursor:pointer;font-family:inherit}
.cp-new button:disabled{opacity:.5;cursor:default}
.cp-err{color:#c0392b;margin:0}
.cp-feed summary{cursor:pointer;font-weight:600;color:#4c3d7a}
.cp-feed ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:4px;font-size:12.5px}
`;
