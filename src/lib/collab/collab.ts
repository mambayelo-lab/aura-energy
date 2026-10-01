// Collaboration dans Supply : commentaires (alerte, décision) avec mentions @,
// assignation d'une alerte avec statut, fil d'activité. Logique pure et repli
// local (navigateur) quand il n'y a pas de session ; avec une session, les mêmes
// objets sont lus et écrits dans Supabase (collab.functions.ts, RLS par rôle).
export type TargetType = "alerte" | "decision";
export type AssignStatus = "a_traiter" | "en_cours" | "traite";
export const STATUS_LABEL: Record<AssignStatus, string> = { a_traiter: "À traiter", en_cours: "En cours", traite: "Traité" };

export interface Comment { id: string; targetType: TargetType; targetId: string; user: string; body: string; mentions: string[]; at: string }
export interface Assignment { alertId: string; assignee: string | null; status: AssignStatus; by: string; at: string }
export interface Activity { id: string; user: string; kind: "commentaire" | "mention" | "assignation" | "statut"; targetType: TargetType; targetId: string; summary: string; at: string }
export interface CollabSnapshot { comments: Comment[]; assignments: Assignment[]; activity: Activity[]; shared: boolean }

/** Mentions « @adresse » ou « @prénom.nom » d'un commentaire (sans doublon, en minuscules). */
export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/(^|[\s(])@([\p{L}\d._%+-]+(?:@[\w.-]+\.[a-z]{2,})?)/giu)) out.add(m[2].replace(/[.,;:]+$/, "").toLowerCase());
  return [...out];
}
/** Rapproche une mention des membres de l'espace (adresse exacte, ou partie avant « @ »). */
export function resolveMentions(mentions: string[], members: string[]): string[] {
  const lower = members.map(m => m.toLowerCase());
  return mentions.map(m => lower.find(x => x === m) ?? lower.find(x => x.split("@")[0] === m) ?? m);
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

/** Ajoute un commentaire et ses entrées d'activité (commentaire, une par mention). */
export function withComment(s: CollabSnapshot, c: { targetType: TargetType; targetId: string; user: string; body: string; members?: string[] }): CollabSnapshot {
  const body = c.body.trim().slice(0, 4000);
  if (!body) return s;
  const mentions = resolveMentions(parseMentions(body), c.members ?? []);
  const comment: Comment = { id: id(), targetType: c.targetType, targetId: c.targetId, user: c.user, body, mentions, at: now() };
  const acts: Activity[] = [
    { id: id(), user: c.user, kind: "commentaire", targetType: c.targetType, targetId: c.targetId, summary: `a commenté : « ${body.slice(0, 80)}${body.length > 80 ? "…" : ""} »`, at: comment.at },
    ...mentions.map(m => ({ id: id(), user: c.user, kind: "mention" as const, targetType: c.targetType, targetId: c.targetId, summary: `a mentionné ${m}`, at: comment.at })),
  ];
  return { ...s, comments: [...s.comments, comment], activity: [...acts, ...s.activity] };
}
/** Assigne une alerte ou change son statut ; trace l'activité. */
export function withAssignment(s: CollabSnapshot, a: { alertId: string; assignee?: string | null; status?: AssignStatus; user: string }): CollabSnapshot {
  const prev = s.assignments.find(x => x.alertId === a.alertId);
  const next: Assignment = { alertId: a.alertId, assignee: a.assignee !== undefined ? a.assignee || null : prev?.assignee ?? null, status: a.status ?? prev?.status ?? "a_traiter", by: a.user, at: now() };
  const acts: Activity[] = [];
  if (next.assignee !== (prev?.assignee ?? null)) acts.push({ id: id(), user: a.user, kind: "assignation", targetType: "alerte", targetId: a.alertId, summary: next.assignee ? `a assigné l'alerte à ${next.assignee}` : "a retiré l'assignation", at: next.at });
  if (next.status !== (prev?.status ?? "a_traiter")) acts.push({ id: id(), user: a.user, kind: "statut", targetType: "alerte", targetId: a.alertId, summary: `statut : ${STATUS_LABEL[next.status]}`, at: next.at });
  if (!acts.length && prev) return s;
  return { ...s, assignments: [...s.assignments.filter(x => x.alertId !== a.alertId), next], activity: [...acts, ...s.activity] };
}
export const commentsOf = (s: CollabSnapshot, t: TargetType, targetId: string) => s.comments.filter(c => c.targetType === t && c.targetId === targetId);
export const assignmentOf = (s: CollabSnapshot, alertId: string) => s.assignments.find(a => a.alertId === alertId);

// ── Repli local (sans session) : navigateur uniquement, non partagé ────────────
const KEY = "aura.collab.v1";
export const EMPTY: CollabSnapshot = { comments: [], assignments: [], activity: [], shared: false };
export function loadLocal(): CollabSnapshot {
  if (typeof localStorage === "undefined") return EMPTY;
  try { const j = JSON.parse(localStorage.getItem(KEY) ?? "null"); return j ? { ...EMPTY, ...j, shared: false } : EMPTY; } catch { return EMPTY; }
}
export function saveLocal(s: CollabSnapshot) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, activity: s.activity.slice(0, 500) })); } catch { /* stockage indisponible */ }
}
