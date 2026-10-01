// Configuration versionnée et état d'intégration, côté serveur.
// Supabase (service role) si configuré ; sinon mémoire du processus (signalé).
import type { IntegrationState } from "./pipeline";
import type { ImportedSetup } from "./questionnaire";

export interface StoredConfig { version: number; setup: ImportedSetup; savedAt: string; savedBy: string }
export interface StoreInfo { persistence: "supabase" | "mémoire"; note?: string }

const mem = { configs: new Map<string, StoredConfig[]>(), state: new Map<string, IntegrationState>() };

async function admin(): Promise<any | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; } catch { return null; }
}

export async function storeInfo(): Promise<StoreInfo> {
  return (await admin()) ? { persistence: "supabase" } : { persistence: "mémoire", note: "Supabase non configuré côté serveur : la configuration vit le temps de l'instance." };
}

export async function saveConfig(workspace: string, setup: ImportedSetup, by: string): Promise<StoredConfig> {
  const sb = await admin();
  if (sb) {
    const { data: last } = await sb.from("aura_int_configs").select("version").eq("workspace", workspace).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = (last?.version ?? 0) + 1;
    const row = { workspace, version, setup, saved_by: by };
    const { error } = await sb.from("aura_int_configs").insert(row);
    if (!error) return { version, setup, savedAt: new Date().toISOString(), savedBy: by };
  }
  const list = mem.configs.get(workspace) ?? [];
  const c = { version: (list.at(-1)?.version ?? 0) + 1, setup, savedAt: new Date().toISOString(), savedBy: by };
  mem.configs.set(workspace, [...list, c].slice(-20));
  return c;
}

export async function loadConfig(workspace: string): Promise<StoredConfig | null> {
  const sb = await admin();
  if (sb) {
    const { data } = await sb.from("aura_int_configs").select("version, setup, created_at, saved_by").eq("workspace", workspace).order("version", { ascending: false }).limit(1).maybeSingle();
    if (data) return { version: data.version, setup: data.setup, savedAt: data.created_at, savedBy: data.saved_by };
  }
  return mem.configs.get(workspace)?.at(-1) ?? null;
}

export async function saveState(workspace: string, state: IntegrationState): Promise<void> {
  const sb = await admin();
  if (sb) {
    // État léger uniquement : référentiel produits et crosswalk volumineux restent en stockage objet (voir la doc).
    const light = { ...state, crosswalk: state.crosswalk.length > 50_000 ? [] : state.crosswalk, masters: { ...state.masters, product: state.masters.product.length > 50_000 ? [] : state.masters.product } };
    const { error } = await sb.from("aura_int_state").upsert({ workspace, state: light, updated_at: new Date().toISOString() });
    if (!error) { await sb.from("aura_int_runs").insert(state.runs.slice(0, 20).map(r => ({ workspace, run: r }))); }
  }
  mem.state.set(workspace, state);
}

export async function loadState(workspace: string): Promise<IntegrationState | null> {
  if (mem.state.has(workspace)) return mem.state.get(workspace)!;
  const sb = await admin();
  if (sb) { const { data } = await sb.from("aura_int_state").select("state").eq("workspace", workspace).maybeSingle(); if (data?.state) return data.state as IntegrationState; }
  return null;
}
