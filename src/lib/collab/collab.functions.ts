// Collaboration partagée (Supabase, RLS par rôle) : l'espace est l'organisation.
// Sans session (mode démo), ces fonctions renvoient { shared: false } et
// l'interface garde le repli local du navigateur (collab.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAction, resolveAccess, writeAudit } from "../security/security.functions";
import { parseMentions, resolveMentions, STATUS_LABEL, type AssignStatus, type CollabSnapshot, type TargetType } from "./collab";

type Ctx = { supabase: any; userId: string; claims: any };
const STATUSES: AssignStatus[] = ["a_traiter", "en_cours", "traite"];

/** Commentaires, assignations, activité récente et membres (pour les mentions) de l'espace. */
export const getCollab = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollabSnapshot & { members: string[]; me: string | null }> => {
    const ctx = context as Ctx, a = await resolveAccess(ctx);
    if (a.demo || !a.orgId) return { comments: [], assignments: [], activity: [], shared: false, members: [], me: a.email };
    const sb = ctx.supabase;
    const [c, s, act, mem] = await Promise.all([
      sb.from("aura_comments").select("id, target_type, target_id, user_email, body, mentions, created_at").eq("org_id", a.orgId).order("created_at").limit(2000),
      sb.from("aura_assignments").select("alert_id, assignee_email, status, updated_by_email, updated_at").eq("org_id", a.orgId),
      sb.from("aura_activity").select("id, user_email, kind, target_type, target_id, summary, created_at").eq("org_id", a.orgId).order("created_at", { ascending: false }).limit(100),
      sb.from("organization_members").select("user_id").eq("org_id", a.orgId),
    ]);
    const err = c.error ?? s.error ?? act.error;
    if (err) throw new Error(err.message);
    const ids = (mem.data ?? []).map((m: any) => m.user_id);
    const { data: profiles } = ids.length ? await sb.from("profiles").select("email").in("id", ids) : { data: [] };
    return {
      shared: true, me: a.email,
      members: (profiles ?? []).map((p: any) => p.email).filter(Boolean),
      comments: (c.data ?? []).map((r: any) => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, user: r.user_email ?? "", body: r.body, mentions: r.mentions ?? [], at: r.created_at })),
      assignments: (s.data ?? []).map((r: any) => ({ alertId: r.alert_id, assignee: r.assignee_email, status: r.status, by: r.updated_by_email ?? "", at: r.updated_at })),
      activity: (act.data ?? []).map((r: any) => ({ id: String(r.id), user: r.user_email ?? "", kind: r.kind, targetType: r.target_type, targetId: r.target_id, summary: r.summary, at: r.created_at })),
    };
  });

export const addComment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { targetType: TargetType; targetId: string; body: string; members?: string[] }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx, a = await requireAction(ctx, "comment.write");
    if (a.demo || !a.orgId) return { ok: false as const, reason: "sans session : commentaire gardé dans ce navigateur" };
    if (!["alerte", "decision"].includes(data.targetType)) throw new Error("Cible inconnue");
    const body = String(data.body ?? "").trim().slice(0, 4000);
    if (!body) throw new Error("Commentaire vide");
    const mentions = resolveMentions(parseMentions(body), data.members ?? []);
    const { error } = await ctx.supabase.from("aura_comments").insert({ org_id: a.orgId, target_type: data.targetType, target_id: data.targetId.slice(0, 200), user_id: ctx.userId, user_email: a.email, body, mentions });
    if (error) throw new Error(error.message);
    const acts = [{ kind: "commentaire", summary: `a commenté : « ${body.slice(0, 80)}${body.length > 80 ? "…" : ""} »` }, ...mentions.map(m => ({ kind: "mention", summary: `a mentionné ${m}` }))];
    await ctx.supabase.from("aura_activity").insert(acts.map(x => ({ org_id: a.orgId, user_id: ctx.userId, user_email: a.email, target_type: data.targetType, target_id: data.targetId.slice(0, 200), ...x })));
    await writeAudit(ctx, a, "collab.commentaire", `${data.targetType}:${data.targetId}`, { mentions: mentions.length });
    return { ok: true as const };
  });

export const setAssignment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { alertId: string; assignee?: string | null; status?: AssignStatus }) => d)
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx, a = await requireAction(ctx, "comment.write");
    if (a.demo || !a.orgId) return { ok: false as const, reason: "sans session : assignation gardée dans ce navigateur" };
    if (data.status && !STATUSES.includes(data.status)) throw new Error("Statut inconnu");
    const { data: prev } = await ctx.supabase.from("aura_assignments").select("assignee_email, status").eq("org_id", a.orgId).eq("alert_id", data.alertId).maybeSingle();
    const assignee = data.assignee !== undefined ? (data.assignee || null) : prev?.assignee_email ?? null, status = data.status ?? prev?.status ?? "a_traiter";
    const { error } = await ctx.supabase.from("aura_assignments").upsert({ org_id: a.orgId, alert_id: data.alertId.slice(0, 200), assignee_email: assignee, status, updated_by: ctx.userId, updated_by_email: a.email, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    const acts: { kind: string; summary: string }[] = [];
    if (assignee !== (prev?.assignee_email ?? null)) acts.push({ kind: "assignation", summary: assignee ? `a assigné l'alerte à ${assignee}` : "a retiré l'assignation" });
    if (status !== (prev?.status ?? "a_traiter")) acts.push({ kind: "statut", summary: `statut : ${STATUS_LABEL[status as AssignStatus]}` });
    if (acts.length) await ctx.supabase.from("aura_activity").insert(acts.map(x => ({ org_id: a.orgId, user_id: ctx.userId, user_email: a.email, target_type: "alerte", target_id: data.alertId.slice(0, 200), ...x })));
    await writeAudit(ctx, a, "collab.assignation", data.alertId, { assignee, status });
    return { ok: true as const };
  });
