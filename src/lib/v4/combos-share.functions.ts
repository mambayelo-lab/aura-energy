// combos-share.functions.ts — multi-utilisateurs sur le registre de Suivi.
//
// Une combinaison suivie reste locale au décideur ; elle devient partageable
// dès qu'il publie sa fiche. Les parties prenantes déposent alors leur position
// via un lien porteur d'un jeton, sans compte. Aucun calcul ici : ni vote,
// ni moyenne — on collecte des positions et des réserves, lues une par une.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const positionSchema = z.enum(["pour", "reserve", "contre"]);

const comboSchema = z.object({
  localId: z.string().min(1),
  sessionId: z.string().min(1),
  sessionTitle: z.string().default(""),
  name: z.string().min(1),
  statut: z.string().default("candidate"),
  version: z.number().int().min(1).default(1),
  leviers: z.array(z.any()).default([]),
  verdictInitial: z.record(z.any()).default({}),
  comments: z.array(z.any()).default([]),
  timeline: z.array(z.any()).default([]),
  preuves: z.array(z.any()).default([]),
  signature: z.any().nullable().optional(),
});

/** Publie (ou met à jour) la fiche et renvoie le jeton de partage. */
export const publishCombo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => comboSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      owner_id: context.userId,
      local_id: data.localId,
      session_id: data.sessionId,
      session_title: data.sessionTitle,
      name: data.name,
      statut: data.statut,
      version: data.version,
      leviers: data.leviers,
      verdict_initial: data.verdictInitial,
      comments: data.comments,
      timeline: data.timeline,
      preuves: data.preuves,
      signature: data.signature ?? null,
    };
    const { data: saved, error } = await sb
      .from("tracked_combos")
      .upsert(row, { onConflict: "owner_id,local_id" })
      .select("id, share_token")
      .single();
    if (error) throw error;
    return { id: saved.id as string, shareToken: saved.share_token as string };
  });

/** Récupère les avis déposés par les parties prenantes sur une fiche publiée. */
export const pullComboAvis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ localId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: combo, error } = await sb
      .from("tracked_combos")
      .select("id, share_token")
      .eq("owner_id", context.userId)
      .eq("local_id", data.localId)
      .maybeSingle();
    if (error) throw error;
    if (!combo) return { shareToken: null, avis: [] as any[] };
    const { data: avis, error: e2 } = await sb
      .from("combo_avis")
      .select("id, nom, role, position, reserve, levee, created_at")
      .eq("combo_id", combo.id)
      .order("created_at", { ascending: true });
    if (e2) throw e2;
    return { shareToken: combo.share_token as string, avis: avis ?? [] };
  });

/** Lecture publique par jeton : ce que voit une partie prenante invitée. */
export const getSharedCombo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: combo, error } = await sb
      .from("tracked_combos")
      .select("id, name, session_title, statut, leviers, verdict_initial, version, signature")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!combo) return { found: false as const };
    const { data: avis } = await sb
      .from("combo_avis")
      .select("id, nom, role, position, reserve, levee, created_at")
      .eq("combo_id", combo.id)
      .order("created_at", { ascending: true });
    return {
      found: true as const,
      combo: {
        name: combo.name as string,
        sessionTitle: combo.session_title as string,
        statut: combo.statut as string,
        version: combo.version as number,
        leviers: (combo.leviers ?? []) as any[],
        verdictInitial: (combo.verdict_initial ?? {}) as any,
        signee: Boolean(combo.signature),
      },
      avis: (avis ?? []) as any[],
    };
  });

/** Dépôt d'une position par une partie prenante invitée (sans compte). */
export const submitSharedAvis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().min(8).max(128),
    nom: z.string().min(1).max(120),
    role: z.string().max(120).optional(),
    position: positionSchema,
    reserve: z.string().max(600).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: combo, error } = await sb
      .from("tracked_combos")
      .select("id, signature")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!combo) return { ok: false as const, reason: "introuvable" };
    if (combo.signature) return { ok: false as const, reason: "signee" };
    const { error: e2 } = await sb.from("combo_avis").insert({
      combo_id: combo.id,
      nom: data.nom.trim(),
      role: data.role?.trim() || null,
      position: data.position,
      reserve: data.reserve?.trim() || null,
    });
    if (e2) throw e2;
    return { ok: true as const };
  });
