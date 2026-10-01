// Accès (rôle, organisation) et journal d'audit, côté serveur.
// Connecté : rôle lu sous RLS dans organization_members, journal dans aura_audit_log
// (ajout seul). Sans authentification : mode démo, étiqueté, journal en mémoire.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can, normalizeRole, type Action, type AccessRole } from "./access";

type Ctx = { supabase: any; userId: string; claims: any };
export interface Access { role: AccessRole | null; demo: boolean; orgId: string | null; orgName: string | null; email: string | null }
export interface AuditEntry { id: string; at: string; user: string; action: string; target: string; details: Record<string, string | number | boolean | null>; org: string | null }

const DEMO_ALLOWED = () => process.env.AURA_DEMO_MODE !== "off";
// Partagé entre modules serveur (globalThis) : un seul journal démo par processus.
const demoLog: AuditEntry[] = ((globalThis as any).__auraDemoAudit ??= []);

export async function resolveAccess(ctx: Ctx): Promise<Access> {
  if (!ctx.supabase || !ctx.userId || ctx.userId === "anonymous") return { role: DEMO_ALLOWED() ? "demo" : null, demo: DEMO_ALLOWED(), orgId: null, orgName: null, email: null };
  const { data: m } = await ctx.supabase.from("organization_members").select("org_id, role").eq("user_id", ctx.userId).limit(1).maybeSingle();
  const { data: org } = m ? await ctx.supabase.from("organizations").select("name").eq("id", m.org_id).maybeSingle() : { data: null };
  return { role: normalizeRole(m?.role), demo: false, orgId: m?.org_id ?? null, orgName: org?.name ?? null, email: ctx.claims?.email ?? null };
}

/** Refuse côté serveur toute action non autorisée pour le rôle. */
export async function requireAction(ctx: Ctx, action: Action): Promise<Access> {
  const a = await resolveAccess(ctx);
  if (!can(a.role, action)) throw new Error(`Droits insuffisants : ${action} (rôle ${a.role ?? "aucun"}).`);
  return a;
}

export async function writeAudit(ctx: Ctx, access: Access, action: string, target = "", details: Record<string, string | number | boolean | null> = {}): Promise<void> {
  const entry: AuditEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), user: access.email ?? (access.demo ? "démo (sans authentification)" : ctx.userId), action, target, details, org: access.orgName };
  if (access.demo || !ctx.supabase) { demoLog.push(entry); if (demoLog.length > 5000) demoLog.shift(); return; }
  await ctx.supabase.from("aura_audit_log").insert({ org_id: access.orgId, user_id: ctx.userId, user_email: access.email, action, target, details });
}

export const getMyAccess = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => resolveAccess(context as Ctx));

export const logAudit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { action: string; target?: string; details?: Record<string, string | number | boolean | null> }) => d)
  .handler(async ({ data, context }) => {
    const a = await resolveAccess(context as Ctx);
    if (!a.role) return { ok: false };
    await writeAudit(context as Ctx, a, data.action.slice(0, 80), (data.target ?? "").slice(0, 200), data.details ?? {});
    return { ok: true };
  });

export const listAudit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { action?: string; user?: string; from?: string; to?: string; limit?: number }) => d)
  .handler(async ({ data, context }): Promise<{ entries: AuditEntry[]; demo: boolean }> => {
    const a = await requireAction(context as Ctx, "audit.read");
    const lim = Math.min(data.limit ?? 500, 5000);
    const keep = (e: AuditEntry) => (!data.action || e.action.startsWith(data.action)) && (!data.user || e.user.toLowerCase().includes(data.user.toLowerCase())) && (!data.from || e.at >= data.from) && (!data.to || e.at <= `${data.to}T23:59:59`);
    if (a.demo) return { entries: [...demoLog].reverse().filter(keep).slice(0, lim), demo: true };
    let q = (context as Ctx).supabase.from("aura_audit_log").select("id, created_at, user_email, action, target, details").eq("org_id", a.orgId).order("created_at", { ascending: false }).limit(lim);
    if (data.action) q = q.like("action", `${data.action}%`);
    if (data.user) q = q.ilike("user_email", `%${data.user}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { entries: (rows ?? []).map((r: any) => ({ id: String(r.id), at: r.created_at, user: r.user_email ?? "", action: r.action, target: r.target ?? "", details: r.details ?? {}, org: a.orgName })), demo: false };
  });

/** CSV (séparateur ;) : horodatage, utilisateur, action, cible, détails. */
export function auditCsv(entries: AuditEntry[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return ["horodatage;utilisateur;action;cible;details", ...entries.map(e => [e.at, e.user, e.action, e.target, JSON.stringify(e.details)].map(esc).join(";"))].join("\n") + "\n";
}
