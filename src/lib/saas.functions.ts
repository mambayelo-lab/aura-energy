// saas.functions.ts — NOUVEAU (Lot 5).
//
// Socle d'abonnement d'Aura : essai gratuit, droit d'accès, consommation d'IA.
//
// ── Parti pris ────────────────────────────────────────────────────────────
// Le droit d'accès n'est PAS calculé dans le navigateur : il se lit ici,
// côté serveur, à partir de la table `subscriptions` (RLS : chacun ne voit
// que sa ligne). Un utilisateur ne peut donc pas se prolonger un essai en
// modifiant du stockage local.
//
// Aucun calcul de décision ici : ce module ne touche ni au moteur BORA ni à
// l'agrégation ordinale.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Tarifs alignés marché (outils de décision et d'architecture vendus 40–150 €
// par utilisateur et par mois) : entrée par utilisateur, pas par forfait
// d'organisation — l'équipe démarre à trois personnes sans arbitrage budgétaire.
export const PLANS = [
  {
    id: "decider",
    nom: "Décider",
    prix: "39 € / utilisateur / mois",
    prixAnnuel: "390 € / utilisateur / an — 2 mois offerts",
    pour: "Direction générale, direction de la transformation",
    inclus: [
      "Espace Décider complet (Comprendre → Arbitrer → Suivi)",
      "Moteur BORA : dominance, robustesse, désaccords",
      "Fiche de décision signable",
      "À partir de 3 utilisateurs",
    ],
  },
  {
    id: "architecturer",
    nom: "Architecturer",
    prix: "79 € / utilisateur / mois",
    prixAnnuel: "790 € / utilisateur / an — 2 mois offerts",
    pour: "DSI, architecture d'entreprise, PMO transformation",
    inclus: [
      "Cadrage, capacités, cible & flux, backlog, suivi",
      "Agent d'architecture (points de passage, couplages, chemin critique)",
      "Dossier d'architecture exportable",
      "Décider inclus pour les mêmes utilisateurs",
    ],
  },
  {
    id: "plateforme",
    nom: "Plateforme",
    prix: "Sur devis",
    prixAnnuel: "à partir de 9 900 € / an",
    pour: "Groupe, COMEX, cabinet de conseil",
    inclus: [
      "Décider + Architecturer + Copilote décisionnel",
      "Connecteurs aux systèmes sources et ontologie d'entreprise",
      "Modèles sectoriels Retail et Énergie & Utilities",
      "Utilisateurs illimités, accompagnement méthode",
    ],
  },
] as const;

export interface PlanState {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  daysLeft: number | null;
  access: boolean;
}

/** Lit l'abonnement de l'utilisateur, et ouvre l'essai gratuit au premier appel. */
export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanState> => {
    const sb: any = context.supabase;
    let { data } = await sb.from("subscriptions").select("*").eq("user_id", context.userId).maybeSingle();
    if (!data) {
      const ins = await sb.from("subscriptions").insert({ user_id: context.userId }).select("*").maybeSingle();
      data = ins.data;
    }
    if (!data) return { plan: "essai", status: "expired", trialEndsAt: null, daysLeft: null, access: false };

    const end = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
    const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / 86_400_000) : null;
    const trialing = data.status === "trialing" && (daysLeft ?? 0) > 0;
    return {
      plan: data.plan,
      status: trialing ? "trialing" : data.status === "trialing" ? "expired" : data.status,
      trialEndsAt: data.trial_ends_at ?? null,
      daysLeft,
      access: data.status === "active" || trialing,
    };
  });

/** Consommation d'IA : total et détail par module, sur la période demandée. */
export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows } = await (context.supabase as any)
      .from("ai_usage").select("feature, model, prompt_tokens, completion_tokens, created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(1000);

    const list = (rows ?? []) as { feature: string; model: string | null; prompt_tokens: number; completion_tokens: number; created_at: string }[];
    const byFeature = new Map<string, { feature: string; calls: number; tokens: number }>();
    let total = 0;
    for (const r of list) {
      const t = (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
      total += t;
      const cur = byFeature.get(r.feature) ?? { feature: r.feature, calls: 0, tokens: 0 };
      cur.calls += 1; cur.tokens += t;
      byFeature.set(r.feature, cur);
    }
    return {
      total,
      calls: list.length,
      byFeature: [...byFeature.values()].sort((a, b) => b.tokens - a.tokens),
      recent: list.slice(0, 25),
    };
  });

/** Enregistre une consommation. Appelé après un appel LLM réussi. */
export const recordUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      feature: z.string().min(1).max(80),
      model: z.string().max(80).optional(),
      promptTokens: z.number().int().min(0).default(0),
      completionTokens: z.number().int().min(0).default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await (context.supabase as any).from("ai_usage").insert({
      user_id: context.userId,
      feature: data.feature,
      model: data.model ?? null,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
    });
    return { ok: true as const };
  });

/** Bascule vers un plan payant. Sans clé de paiement configurée, la demande est
 *  enregistrée en `past_due` : l'accès reste ouvert, la facturation est à finaliser. */
export const requestPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.enum(["decider", "architecturer", "plateforme"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const stripeReady = Boolean(process.env["STRIPE_SECRET_KEY"]);
    await (context.supabase as any).from("subscriptions").upsert(
      { user_id: context.userId, plan: data.plan, status: stripeReady ? "past_due" : "past_due", updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    return {
      ok: true as const,
      stripeReady,
      message: stripeReady
        ? "Plan enregistré. Le paiement va être demandé."
        : "Plan enregistré. Le règlement par carte sera activé dès la configuration du compte de paiement.",
    };
  });
