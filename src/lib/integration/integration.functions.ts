// Fonctions serveur du dispositif d'intégration (Studio).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAction, writeAudit } from "../security/security.functions";
import type { ImportedSetup } from "./questionnaire";
import type { SourceConfig } from "./types";
import type { IntegrationState } from "./pipeline";

const WORKSPACE = "default";

/** Vue compacte renvoyée au navigateur : jamais de ligne brute, ni de secret. */
export interface IntegrationView {
  asOf: string;
  reports: IntegrationState["reports"];
  review: IntegrationState["review"];
  alerts: IntegrationState["alerts"];
  divergences: IntegrationState["divergences"];
  divergenceCount: number;
  series: IntegrationState["series"];
  runs: IntegrationState["runs"];
  counts: { suppliers: number; products: number; sites: number; stockouts: number; crosswalk: number };
  usage: Record<string, { calls: number; rows: number; maxCalls: number; mode: string; breaker: string }>;
  persistence: string;
}

function view(state: IntegrationState, usage: IntegrationView["usage"], persistence: string): IntegrationView {
  return {
    asOf: state.asOf, reports: state.reports.map(r => ({ ...r, orphans: r.orphans.slice(0, 20), duplicates: r.duplicates.slice(0, 20), conflicts: r.conflicts.slice(0, 20) })),
    review: state.review.slice(0, 200), alerts: state.alerts, divergences: state.divergences.slice(0, 100), divergenceCount: state.divergenceCount, series: state.series, runs: state.runs.slice(0, 40),
    counts: { suppliers: state.masters.supplier.length, products: state.masters.product.length, sites: state.masters.site.length, stockouts: Object.keys(state.stockouts).length, crosswalk: state.crosswalk.length },
    usage, persistence,
  };
}

export const saveIntegrationSetup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { setup: ImportedSetup }) => d)
  .handler(async ({ data, context }) => {
    const access = await requireAction(context as any, "sources.edit");
    await writeAudit(context as any, access, "sources.enregistrement", `${data.setup.sources.length} source(s)`);
    const { literalSecretFields } = await import("./secrets");
    const leaks = data.setup.sources.flatMap(s => literalSecretFields(s.params).map(f => `${s.label} · ${f}`));
    if (leaks.length) return { ok: false as const, error: `Secret en clair refusé (${leaks.join(", ")}) : utilisez une référence {{env:NOM}}.` };
    const { saveConfig, storeInfo } = await import("./store.server");
    const c = await saveConfig(WORKSPACE, data.setup, "studio");
    return { ok: true as const, version: c.version, persistence: (await storeInfo()).persistence };
  });

export const loadIntegrationSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { loadConfig } = await import("./store.server");
  const c = await loadConfig(WORKSPACE);
  // Transmis en JSON : la configuration ne contient aucun secret (références {{env:…}}).
  return c ? { version: c.version, setupJson: JSON.stringify(c.setup), savedAt: c.savedAt } : null;
});

export const testIntegrationSource = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { source: SourceConfig }) => d)
  .handler(async ({ data, context }) => {
    const access = await requireAction(context as any, "sources.edit");
    await writeAudit(context as any, access, "sources.test", data.source.label);
    const { testSource } = await import("./runtime.server");
    return testSource(data.source);
  });

export const syncIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { setup: ImportedSetup; mode: "full" | "incremental"; asOf?: string; decisions?: Record<string, "validated" | "rejected"> }) => d)
  .handler(async ({ data, context }): Promise<{ ok: true; viewJson: string } | { ok: false; error: string }> => {
    const access = await requireAction(context as any, "thresholds.edit");
    await writeAudit(context as any, access, "synchronisation", data.mode);
    try {
      const { syncSetup, usage } = await import("./runtime.server");
      const { storeInfo } = await import("./store.server");
      const state = await syncSetup(WORKSPACE, data.setup, data.mode, data.asOf, data.decisions);
      const u = Object.fromEntries(data.setup.sources.map(s => [s.id, usage(s)]));
      return { ok: true, viewJson: JSON.stringify(view(state, u, (await storeInfo()).persistence)) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });

export const discoverIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: { setup: ImportedSetup; sampleRows?: number }) => d)
  .handler(async ({ data, context }) => {
    const access = await requireAction(context as any, "sources.edit");
    await writeAudit(context as any, access, "metadonnees.lecture", `${data.setup.sources.length} source(s)`);
    try {
      const { discoverSetup } = await import("./runtime.server");
      return { ok: true as const, json: JSON.stringify(await discoverSetup(data.setup, Math.min(200, data.sampleRows ?? 50))) };
    } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  });
