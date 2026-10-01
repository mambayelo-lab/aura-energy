import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string };
function userId(context: Ctx) {
  if (!context.supabase || !context.userId || context.userId === "anonymous") throw new Error("Connexion requise");
  return context.userId;
}

const DraftInput = z.object({
  contextId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160).default("SCRA Studio"),
  sector: z.string().trim().min(2).max(80).default("Supply Chain"),
  clientName: z.string().trim().max(160).optional(),
  draft: z.record(z.string(), z.unknown()),
});

export const loadStudioDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = userId(context as Ctx);
    const { data: rows, error } = await context.supabase
      .from("aura_studio_contexts")
      .select("id,name,sector,client_name,status,draft,version,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    if (rows?.length) return { context: rows[0], contexts: rows };

    const { data: created, error: createError } = await context.supabase
      .from("aura_studio_contexts")
      .insert({ owner_id: uid, name: "SCRA Studio", sector: "Supply Chain", client_name: null })
      .select("id,name,sector,client_name,status,draft,version,updated_at")
      .single();
    if (createError) throw new Error(createError.message);
    return { context: created, contexts: [created] };
  });

export const saveStudioDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const uid = userId(context as Ctx);
    const payload = {
      name: data.name,
      sector: data.sector,
      client_name: data.clientName ?? null,
      draft: data.draft,
      updated_at: new Date().toISOString(),
    };
    if (data.contextId) {
      const { data: saved, error } = await context.supabase
        .from("aura_studio_contexts")
        .update(payload)
        .eq("id", data.contextId)
        .select("id,version,updated_at")
        .single();
      if (error) throw new Error(error.message);
      return { context: saved };
    }
    const { data: saved, error } = await context.supabase
      .from("aura_studio_contexts")
      .insert({ ...payload, owner_id: uid })
      .select("id,version,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { context: saved };
  });

export const publishStudioContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contextId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const uid = userId(context as Ctx);
    const now = new Date().toISOString();
    const { data: saved, error } = await context.supabase
      .from("aura_studio_contexts")
      .update({ status: "published", published_at: now, updated_at: now })
      .eq("id", data.contextId)
      .select("id,status,published_at,draft")
      .single();
    if (error) throw new Error(error.message);
    // Matérialise le mapping ontologie ↔ SI dans les tables structurées
    // (aura_studio_elements / aura_studio_relations / aura_connect_sources /
    // aura_connect_fields) au moment de la publication — jusqu'ici seul le
    // brouillon JSON (draft) était persisté. On réutilise le schéma existant
    // plutôt que d'en inventer un parallèle. Best-effort : une erreur ici ne
    // doit jamais faire échouer la publication elle-même, qui a déjà réussi.
    try {
      await materializeConnectMapping(context.supabase, data.contextId, uid, saved?.draft ?? {});
    } catch {
      // La publication reste valide même si la matérialisation échoue ;
      // la vue "brouillon" (draft) reste la source de vérité pour l'UI.
    }
    return { context: saved };
  });

// ── Matérialisation ontologie ↔ SI ──────────────────────────────────────────
// Traduit le vocabulaire de AURA Connect (BusinessEntity/EntityAttribute/
// AppCredential/AppField/EntityMapping, tel que défini dans
// argus-vocab-store.ts) vers le schéma relationnel de la migration
// 20260907193000_aura_studio_connect.sql. Idempotent : on repart d'un état
// propre pour ce contexte à chaque publication (delete puis reinsert).
type DraftVocab = {
  entities?: { id: string; name: string; description?: string; attributes?: { id: string; name: string; type?: string }[] }[];
  apps?: { id: string; label: string; type?: string; environment?: string; endpoint?: string; authMode?: string; secretRef?: string; enabled?: boolean; sourceStatus?: string }[];
  fields?: { id: string; appId: string; name: string; sampleValues?: string[] }[];
  entityMappings?: { entityId: string; attributeId: string; appId: string; fieldId: string; isMaster: boolean; confidence?: number }[];
};

async function materializeConnectMapping(supabase: any, contextId: string, uid: string, draft: unknown) {
  const v = (draft ?? {}) as DraftVocab;
  const entities = v.entities ?? [];
  const apps = v.apps ?? [];
  const fields = v.fields ?? [];
  const entityMappings = v.entityMappings ?? [];
  if (!entities.length && !apps.length) return;

  // Repart d'un état propre pour ce contexte (relations puis éléments : les
  // relations référencent les éléments par clé étrangère avec cascade).
  await supabase.from("aura_studio_relations").delete().eq("context_id", contextId);
  await supabase.from("aura_studio_elements").delete().eq("context_id", contextId);

  // 1) Objets métier + attributs → aura_studio_elements (kind business_object / attribute)
  const objectIdByEntity = new Map<string, string>();
  for (const e of entities) {
    const { data: row, error } = await supabase.from("aura_studio_elements")
      .insert({ context_id: contextId, kind: "business_object", external_key: e.id, label: e.name, metadata: { description: e.description ?? null } })
      .select("id").single();
    if (error) throw new Error(error.message);
    objectIdByEntity.set(e.id, row.id);
  }
  const attributeIdByKey = new Map<string, string>(); // `${entityId}:${attributeId}` -> elementId
  for (const e of entities) {
    const parentId = objectIdByEntity.get(e.id);
    if (!parentId) continue;
    for (const a of e.attributes ?? []) {
      const { data: row, error } = await supabase.from("aura_studio_elements")
        .insert({ context_id: contextId, kind: "attribute", external_key: `${e.id}:${a.id}`, label: a.name, parent_id: parentId, metadata: { dataType: a.type ?? null } })
        .select("id").single();
      if (error) throw new Error(error.message);
      attributeIdByKey.set(`${e.id}:${a.id}`, row.id);
    }
  }

  // 2) Applications sources → aura_connect_sources (schéma dédié SI, pas aura_studio_elements)
  //    + un élément "application" léger pour pouvoir les relier aux relations master/contributor.
  const appElementIdByApp = new Map<string, string>();
  const sourceIdByApp = new Map<string, string>();
  for (const app of apps) {
    const { data: appEl, error: appElError } = await supabase.from("aura_studio_elements")
      .insert({ context_id: contextId, kind: "application", external_key: app.id, label: app.label, metadata: { type: app.type ?? null } })
      .select("id").single();
    if (appElError) throw new Error(appElError.message);
    appElementIdByApp.set(app.id, appEl.id);

    const { data: src, error: srcError } = await supabase.from("aura_connect_sources")
      .insert({
        context_id: contextId, application_element_id: appEl.id, label: app.label,
        source_type: app.type ?? "API", environment: app.environment ?? null, endpoint: app.endpoint ?? null,
        auth_mode: app.authMode ?? null, secret_ref: app.secretRef ?? null, enabled: app.enabled !== false,
        status: app.sourceStatus === "connected" ? "connected" : app.sourceStatus === "error" ? "error" : "configured",
        created_by: uid,
      })
      .select("id").single();
    if (srcError) throw new Error(srcError.message);
    sourceIdByApp.set(app.id, src.id);
  }

  // 3) Champs sources → aura_connect_fields (rattachés à leur aura_connect_sources)
  const fieldSourceIdByField = new Map<string, string>();
  for (const f of fields) {
    const sourceId = sourceIdByApp.get(f.appId);
    if (!sourceId) continue;
    const { data: row, error } = await supabase.from("aura_connect_fields")
      .insert({ source_id: sourceId, path: f.name, sample_masked: f.sampleValues ?? [] })
      .select("id").single();
    if (error) throw new Error(error.message);
    fieldSourceIdByField.set(f.id, row.id);
  }

  // 4) Branchements attribut ↔ application source → aura_studio_relations
  //    (relation "master" ou "contributor", entre l'élément attribut et
  //    l'élément application — le champ précis et sa fraîcheur restent
  //    consultables via aura_connect_fields/metadata pour cette même paire).
  for (const m of entityMappings) {
    const fromId = attributeIdByKey.get(`${m.entityId}:${m.attributeId}`);
    const toId = appElementIdByApp.get(m.appId);
    if (!fromId || !toId) continue;
    const field = fields.find(f => f.id === m.fieldId);
    await supabase.from("aura_studio_relations").insert({
      context_id: contextId, from_element_id: fromId, to_element_id: toId,
      relation: m.isMaster ? "master" : "contributor",
      metadata: { fieldName: field?.name ?? null, confidence: m.confidence ?? null },
    });
  }
}
