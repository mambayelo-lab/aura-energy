// platform.functions.ts — NOUVEAU (lot pilotage de plateforme).
//
// Trois besoins d'exploitation, un seul module :
//   1. Adoption : qui vient, où, combien de fois (app_events).
//   2. Boucle de retour sur décision : un rappel daté, un verdict simple
//      (bonne / nuancée / mauvaise / trop tôt), visible de l'administrateur.
//   3. Retours utilisateurs : note et message, traités par l'administrateur.
//
// Aucun calcul de décision ici : ce module ne touche ni à BORA ni à
// l'agrégation ordinale. Il observe, il ne juge pas.
//
// Les droits sont portés par les règles d'accès serveur : un utilisateur ne
// lit que ses lignes, un administrateur (has_role 'admin') lit tout.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string; claims: any };

function requireUser(ctx: Ctx) {
  if (!ctx.supabase || !ctx.userId || ctx.userId === "anonymous") throw new Error("Connexion requise");
  return ctx.userId;
}

async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return data === true;
}

// ── 1. Télémétrie d'adoption ────────────────────────────────────────────────
/** Écrit un événement d'usage. Volontairement sans donnée métier sensible. */
export const logEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.string().min(2).max(40),
    space: z.string().max(40).optional(),
    path: z.string().max(200).optional(),
    session_id: z.string().max(64).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // La télémétrie ne doit jamais interrompre l'usage : visiteur non connecté
    // ou écriture refusée → on ignore silencieusement.
    const ctx = context as Ctx;
    if (!ctx.supabase || !ctx.userId || ctx.userId === "anonymous") return { ok: false, skipped: true };
    try {
      await ctx.supabase.from("app_events").insert({ ...data, user_id: ctx.userId });
      return { ok: true };
    } catch {
      return { ok: false, skipped: true };
    }
  });


// ── 2. Rappels de revue de décision ─────────────────────────────────────────
export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(3).max(200),
    space: z.enum(["decider", "copilote", "architecturer"]).default("decider"),
    decision_ref: z.string().max(120).optional(),
    chosen_option: z.string().max(200).optional(),
    horizon_days: z.number().int().min(1).max(730).default(30),
    horizon_label: z.string().max(60).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = requireUser(context as Ctx);
    const due = new Date(Date.now() + data.horizon_days * 86_400_000).toISOString();
    const { data: row, error } = await context.supabase.from("decision_reviews").insert({
      user_id: uid, title: data.title, space: data.space,
      decision_ref: data.decision_ref ?? null, chosen_option: data.chosen_option ?? null,
      horizon_label: data.horizon_label ?? `${data.horizon_days} jours`, due_at: due,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return { review: row };
  });

/** Mes rappels : ceux qui arrivent à échéance d'abord. */
export const myReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = requireUser(context as Ctx);
    const { data } = await context.supabase.from("decision_reviews")
      .select("*").eq("user_id", uid).order("due_at", { ascending: true }).limit(100);
    const rows = data ?? [];
    const now = Date.now();
    return {
      due: rows.filter((r: any) => r.status === "pending" && new Date(r.due_at).getTime() <= now),
      upcoming: rows.filter((r: any) => r.status === "pending" && new Date(r.due_at).getTime() > now),
      answered: rows.filter((r: any) => r.status !== "pending"),
    };
  });

/** Verdict de l'utilisateur. Qualitatif, quatre modalités, aucun score. */
export const answerReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    verdict: z.enum(["bonne", "nuancee", "mauvaise", "trop_tot"]),
    verdict_comment: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    requireUser(context as Ctx);
    const patch = data.verdict === "trop_tot"
      // « Trop tôt » ne clôt pas : le rappel est repoussé de 30 jours.
      ? { due_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), reminded_at: new Date().toISOString() }
      : { status: "answered", verdict: data.verdict, verdict_comment: data.verdict_comment ?? null, answered_at: new Date().toISOString() };
    const { error } = await context.supabase.from("decision_reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    requireUser(context as Ctx);
    await context.supabase.from("decision_reviews").delete().eq("id", data.id);
    return { ok: true };
  });

// ── 3. Retours utilisateurs ─────────────────────────────────────────────────
export const sendFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    message: z.string().min(3).max(4000),
    rating: z.number().int().min(1).max(5).optional(),
    category: z.enum(["utile", "confus", "anomalie", "idee"]).optional(),
    space: z.string().max(40).optional(),
    path: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = requireUser(context as Ctx);
    const { error } = await context.supabase.from("user_feedback").insert({ ...data, user_id: uid });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── 4. Tableau de bord administrateur ───────────────────────────────────────
export interface AdminKpis {
  isAdmin: boolean;
  utilisateurs: { total: number; nouveaux30j: number; actifs7j: number; actifs30j: number };
  usage: { evenements30j: number; connexions30j: number; parEspace: { space: string; n: number }[]; parJour: { jour: string; n: number }[] };
  decisions: { total: number; revuesEnAttente: number; revuesEchues: number; verdicts: { verdict: string; n: number }[] };
  retours: { total: number; nouveaux: number; noteMoyenne: number | null; derniers: any[] };
  abonnements: { plan: string; status: string; n: number }[];
  ia: { requetes30j: number; tokens30j: number };
  revuesRecentes: any[];
}

/**
 * Un seul aller-retour pour l'écran d'administration. Les agrégats sont
 * calculés ici : le navigateur ne reçoit jamais les lignes brutes des autres
 * utilisateurs, seulement des compteurs et les derniers retours.
 */
export const getAdminKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminKpis> => {
    requireUser(context as Ctx);
    const admin = await isAdmin(context as Ctx);
    const empty: AdminKpis = {
      isAdmin: false,
      utilisateurs: { total: 0, nouveaux30j: 0, actifs7j: 0, actifs30j: 0 },
      usage: { evenements30j: 0, connexions30j: 0, parEspace: [], parJour: [] },
      decisions: { total: 0, revuesEnAttente: 0, revuesEchues: 0, verdicts: [] },
      retours: { total: 0, nouveaux: 0, noteMoyenne: null, derniers: [] },
      abonnements: [], ia: { requetes30j: 0, tokens30j: 0 }, revuesRecentes: [],
    };
    if (!admin) return empty;

    const sb: any = context.supabase;
    const d30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const now = new Date().toISOString();

    const [profiles, events, decisions, reviews, feedback, subs, ai] = await Promise.all([
      sb.from("profiles").select("id, email, full_name, created_at"),
      sb.from("app_events").select("user_id, kind, space, created_at").gte("created_at", d30).limit(20000),
      sb.from("decisions").select("id", { count: "exact", head: true }),
      sb.from("decision_reviews").select("id, title, space, status, verdict, verdict_comment, due_at, answered_at, user_id, chosen_option").order("due_at", { ascending: true }).limit(500),
      sb.from("user_feedback").select("*").order("created_at", { ascending: false }).limit(200),
      sb.from("subscriptions").select("plan, status"),
      sb.from("ai_usage").select("prompt_tokens, completion_tokens").gte("created_at", d30).limit(20000),
    ]);

    const ev = events.data ?? [];
    const byDay = new Map<string, number>();
    const bySpace = new Map<string, number>();
    const users7 = new Set<string>(); const users30 = new Set<string>();
    let connexions = 0;
    for (const e of ev) {
      const jour = String(e.created_at).slice(0, 10);
      byDay.set(jour, (byDay.get(jour) ?? 0) + 1);
      const sp = e.space ?? "autre";
      bySpace.set(sp, (bySpace.get(sp) ?? 0) + 1);
      users30.add(e.user_id);
      if (e.created_at >= d7) users7.add(e.user_id);
      if (e.kind === "signin") connexions++;
    }

    const revs = reviews.data ?? [];
    const verdicts = new Map<string, number>();
    for (const r of revs) if (r.verdict) verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);

    const fbs = feedback.data ?? [];
    const notes = fbs.map((f: any) => f.rating).filter((n: any) => typeof n === "number");

    const subMap = new Map<string, number>();
    for (const s of subs.data ?? []) {
      const k = `${s.plan}|${s.status}`;
      subMap.set(k, (subMap.get(k) ?? 0) + 1);
    }

    const aiRows = ai.data ?? [];

    return {
      isAdmin: true,
      utilisateurs: {
        total: (profiles.data ?? []).length,
        nouveaux30j: (profiles.data ?? []).filter((p: any) => p.created_at >= d30).length,
        actifs7j: users7.size,
        actifs30j: users30.size,
      },
      usage: {
        evenements30j: ev.length,
        connexions30j: connexions,
        parEspace: [...bySpace.entries()].map(([space, n]) => ({ space, n })).sort((a, b) => b.n - a.n),
        parJour: [...byDay.entries()].map(([jour, n]) => ({ jour, n })).sort((a, b) => a.jour.localeCompare(b.jour)),
      },
      decisions: {
        total: decisions.count ?? 0,
        revuesEnAttente: revs.filter((r: any) => r.status === "pending").length,
        revuesEchues: revs.filter((r: any) => r.status === "pending" && r.due_at <= now).length,
        verdicts: [...verdicts.entries()].map(([verdict, n]) => ({ verdict, n })),
      },
      retours: {
        total: fbs.length,
        nouveaux: fbs.filter((f: any) => f.status === "new").length,
        noteMoyenne: notes.length ? Math.round((notes.reduce((a: number, b: number) => a + b, 0) / notes.length) * 10) / 10 : null,
        derniers: fbs.slice(0, 25),
      },
      abonnements: [...subMap.entries()].map(([k, n]) => {
        const [plan, status] = k.split("|");
        return { plan: plan!, status: status!, n };
      }),
      ia: {
        requetes30j: aiRows.length,
        tokens30j: aiRows.reduce((a: number, r: any) => a + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0), 0),
      },
      revuesRecentes: revs.slice(0, 40),
    };
  });

/** Traitement d'un retour par l'administrateur (règle d'accès : admin seul). */
export const updateFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["new", "seen", "planned", "done", "rejected"]),
    admin_reply: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    requireUser(context as Ctx);
    const { error } = await context.supabase.from("user_feedback")
      .update({ status: data.status, admin_reply: data.admin_reply ?? null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
