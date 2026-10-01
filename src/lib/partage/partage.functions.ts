// partage.functions.ts — travailler une analyse V2 à plusieurs.
//
// Règle de gouvernance : un invité ne modifie jamais l'analyse. Il dépose une
// proposition (levier, option, critère, réserve) que le propriétaire accepte ou
// refuse avec un motif. Chaque geste laisse une notification à celui qui doit
// savoir. Aucun calcul, aucun vote, aucune moyenne : on transporte des textes
// et des décisions humaines.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Sans compte, la couche de partage ne s'adresse à personne : on ne présente
 * pas un identifiant fictif à la base, on renonce proprement.
 */
function moi(ctx: { userId?: string }): string | null {
  const u = ctx.userId;
  return !u || u === "anonymous" ? null : u;
}
const SANS_COMPTE = "Cette partie demande un compte : connectez-vous pour travailler l'analyse à plusieurs.";

const typeProposition = z.enum(["levier", "option", "critere", "reserve"]);

/** Publie l'analyse courante (ou la met à jour) pour pouvoir la partager. */
export const publierAnalyse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      threadId: z.string().min(1),
      titre: z.string().max(200).default(""),
      contenu: z.record(z.any()).default({}),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!moi(context)) throw new Error(SANS_COMPTE);
    const sb = context.supabase as any;
    const { data: saved, error } = await sb
      .from("v2_analyses")
      .upsert(
        { owner_id: context.userId, thread_id: data.threadId, titre: data.titre, contenu: data.contenu },
        { onConflict: "owner_id,thread_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return { analyseId: saved.id as string };
  });

/** Donne accès à quelqu'un, en lecture ou en contribution. */
export const partager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      analyseId: z.string().uuid(),
      email: z.string().email(),
      droit: z.enum(["lecture", "contribution"]).default("contribution"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("v2_partages").insert({
      analyse_id: data.analyseId,
      invite_email: data.email.toLowerCase().trim(),
      droit: data.droit,
    });
    if (error) throw error;
    return { ok: true as const };
  });

/** Retire un accès. */
export const retirerPartage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ partageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("v2_partages").delete().eq("id", data.partageId);
    if (error) throw error;
    return { ok: true as const };
  });

/** Ce que le propriétaire voit d'une analyse publiée : accès donnés et propositions reçues. */
export const etatPartage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = moi(context);
    if (!uid) return { publiee: false as const, partages: [], propositions: [] };
    const sb = context.supabase as any;
    const { data: analyse, error } = await sb
      .from("v2_analyses")
      .select("id, titre")
      .eq("owner_id", uid)
      .eq("thread_id", data.threadId)
      .maybeSingle();
    if (error) throw error;
    if (!analyse) return { publiee: false as const, partages: [], propositions: [] };
    const [{ data: partages }, { data: propositions }] = await Promise.all([
      sb.from("v2_partages").select("id, invite_email, droit, created_at").eq("analyse_id", analyse.id),
      sb
        .from("v2_propositions")
        .select("id, auteur_nom, type, label, detail, statut, motif, created_at")
        .eq("analyse_id", analyse.id)
        .order("created_at", { ascending: false }),
    ]);
    return {
      publiee: true as const,
      analyseId: analyse.id as string,
      partages: partages ?? [],
      propositions: propositions ?? [],
    };
  });

/** Les analyses qu'on a partagées avec moi. */
export const analysesPartagees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = moi(context);
    if (!uid) return { analyses: [] as any[] };
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("v2_analyses")
      .select("id, titre, contenu, updated_at, owner_id")
      .neq("owner_id", uid)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { analyses: data ?? [] };
  });

/** Un invité dépose une proposition : elle n'entre pas au dossier avant validation. */
export const proposer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      analyseId: z.string().uuid(),
      type: typeProposition.default("levier"),
      label: z.string().min(1).max(160),
      detail: z.string().max(800).default(""),
      auteurNom: z.string().max(120).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const auteur = moi(context);
    if (!auteur) throw new Error(SANS_COMPTE);
    const sb = context.supabase as any;
    const { error } = await sb.from("v2_propositions").insert({
      analyse_id: data.analyseId,
      auteur_id: auteur,
      auteur_nom: data.auteurNom,
      type: data.type,
      label: data.label.trim(),
      detail: data.detail.trim(),
    });
    if (error) throw error;
    // Le propriétaire est averti qu'une proposition l'attend.
    const { data: analyse } = await sb.from("v2_analyses").select("owner_id, titre").eq("id", data.analyseId).maybeSingle();
    if (analyse) {
      await sb.from("v2_notifications").insert({
        destinataire_id: analyse.owner_id,
        analyse_id: data.analyseId,
        type: "proposition",
        titre: "Nouvelle proposition à trancher",
        corps: `${data.auteurNom || "Un contributeur"} propose « ${data.label.trim()} » sur ${analyse.titre || "votre analyse"}.`,
      });
    }
    return { ok: true as const };
  });

/** Le propriétaire tranche : accepté ou refusé, avec motif. L'auteur est averti. */
export const trancherProposition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      propositionId: z.string().uuid(),
      statut: z.enum(["acceptee", "refusee"]),
      motif: z.string().max(600).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prop, error } = await sb
      .from("v2_propositions")
      .update({ statut: data.statut, motif: data.motif.trim() })
      .eq("id", data.propositionId)
      .select("id, analyse_id, auteur_id, label")
      .single();
    if (error) throw error;
    await sb.from("v2_notifications").insert({
      destinataire_id: prop.auteur_id,
      analyse_id: prop.analyse_id,
      type: "reponse",
      titre: data.statut === "acceptee" ? "Proposition retenue" : "Proposition écartée",
      corps: `« ${prop.label} » — ${data.motif.trim() || "sans motif précisé"}.`,
    });
    return { ok: true as const, statut: data.statut };
  });

/** Mes notifications non lues, puis les dernières lues. */
export const mesNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = moi(context);
    if (!uid) return { notifications: [] };
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("v2_notifications")
      .select("id, titre, corps, lu, type, created_at")
      .eq("destinataire_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return { notifications: data ?? [] };
  });

/** Marque tout comme lu. */
export const lireNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = moi(context);
    if (!uid) return { ok: true as const };
    const sb = context.supabase as any;
    const { error } = await sb
      .from("v2_notifications")
      .update({ lu: true })
      .eq("destinataire_id", uid)
      .eq("lu", false);
    if (error) throw error;
    return { ok: true as const };
  });
