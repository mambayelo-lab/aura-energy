// Exécution serveur : connecteurs (identifiants juste-à-temps), pipeline, état stocké.
import { createConnector } from "./connectors";
import { driverFor } from "./connectors/drivers.server";
import { emptyState, runPipeline, type IntegrationState, type SyncMode } from "./pipeline";
import { allGovernorStats, governorFor } from "./budget";
import { loadState, saveState } from "./store.server";
import { buildTemplate, effectiveAcv, isActive, type ImportedSetup } from "./questionnaire";
import { ATTRIBUTE_SPECS, profileColumns, proposeMappings, type FieldProposal, type ColumnProfile } from "./discovery";
import { Q_ONTOLOGY } from "./questionnaire";
import type { SourceConfig, TestResult } from "./types";

// Jeton public de démonstration de Maison Lucie (documenté dans son dépôt) : repli
// côté serveur uniquement, quand LUCIE_GATEWAY_TOKEN n'est pas défini.
const env = () => ({ ...process.env, LUCIE_GATEWAY_TOKEN: process.env.LUCIE_GATEWAY_TOKEN ?? "lucie_aura_gateway_demo_token" });
const factories = () => ({ env: env(), sqlDriver: (d: string) => driverFor(d) });

export async function testSource(source: SourceConfig): Promise<TestResult & { budget: ReturnType<typeof usage> }> {
  const c = createConnector(source, factories());
  try { return { ...(await c.testConnection()), budget: usage(source) }; }
  finally { await c.close(); }
}

export function usage(source: SourceConfig) {
  const g = governorFor(source.id, source.budget).stats();
  return { calls: g.callsToday, rows: g.rowsToday, maxCalls: g.budget.maxCallsPerDay, rpm: g.budget.maxRequestsPerMinute, rowsPerCall: g.budget.maxRowsPerCall, mode: g.mode, breaker: g.breaker };
}

export async function syncSetup(workspace: string, setup: ImportedSetup, mode: SyncMode, asOf = new Date().toISOString().slice(0, 10), decisions?: Record<string, "validated" | "rejected">): Promise<IntegrationState> {
  const { template: t, missing } = buildTemplate(setup);
  if (missing.length) throw new Error(`Correspondances à valider avant la synchronisation : ${missing.join(", ")}.`);
  const prev = (await loadState(workspace)) ?? null;
  const base = prev && prev.templateId === t.id && mode === "incremental" ? prev : emptyState(t.id, asOf);
  if (prev?.decisions) base.decisions = { ...prev.decisions };
  if (decisions) Object.assign(base.decisions, decisions);
  const connectors = Object.fromEntries(t.sources.map(s => [s.id, createConnector(s, factories())]));
  const state = await runPipeline({ template: t, connectors, state: base, mode: prev && base === prev ? mode : "full", asOf, acv: effectiveAcv(setup).acv, settings: setup.alertSettings });
  await saveState(workspace, state);
  return state;
}

export function budgets() { return allGovernorStats(); }

/** Métadonnées réelles + échantillon limité (1 appel par entité, sous budget) → profils et correspondances proposées. */
export async function discoverSetup(setup: ImportedSetup, sampleRows = 50): Promise<{ proposals: FieldProposal[]; profiles: Record<string, { source: string; entity: string; metadata: string; columns: ColumnProfile[]; error?: string }> }> {
  const proposals: FieldProposal[] = [];
  const profiles: Record<string, { source: string; entity: string; metadata: string; columns: ColumnProfile[]; error?: string }> = {};
  for (const o of setup.objects) {
    const s = setup.sources.find(x => x.id === o.sourceId);
    if (!s || !isActive(s)) continue;
    const key = `${o.sourceId}|${o.entity}`;
    if (!profiles[key]) {
      const c = createConnector(s, factories());
      try {
        const schema = await c.discoverSchema().catch(() => []);
        const declared = Object.fromEntries((schema.find(e => e.name === o.entity)?.columns ?? []).map(col => [col.name, col.type]));
        const rows = await c.sample(o.entity, sampleRows);
        profiles[key] = { source: s.id, entity: o.entity, metadata: metadataKind(s.kind, Object.keys(declared).length > 0), columns: profileColumns(rows, declared) };
      } catch (e) { profiles[key] = { source: s.id, entity: o.entity, metadata: "indisponible", columns: [], error: (e as Error).message }; }
      finally { await c.close(); }
    }
    const attrs = ATTRIBUTE_SPECS.filter(a => a.id.startsWith(`${o.group}.`));
    proposals.push(...proposeMappings(attrs, profiles[key].columns, { sourceId: o.sourceId, entity: o.entity, hints: setup.hints }));
  }
  void Q_ONTOLOGY;
  return { proposals, profiles };
}
function metadataKind(kind: string, declared: boolean) {
  if (kind === "odata") return declared ? "$metadata OData" : "échantillon JSON";
  if (kind === "sql") return "information_schema";
  if (kind === "file") return "schéma Parquet / en-têtes CSV";
  if (kind === "odata4") return declared ? "$metadata OData v4 (CSDL)" : "échantillon JSON";
  if (kind === "graphql") return "introspection GraphQL";
  if (kind === "soap") return declared ? "WSDL (XSD)" : "échantillon XML";
  if (kind === "salesforce") return "describe Salesforce";
  if (kind === "sqlhttp") return "catalogue SQL (types de colonnes)";
  if (kind === "mcp") return declared ? "catalogue MCP (outils, ressources, schémas)" : "échantillon MCP";
  if (kind === "rfc") return "RFC_READ_TABLE (FIELDS)";
  if (kind === "grpcweb") return "colonnes gRPC (proto)";
  if (["idoc", "edifact", "x12", "as2"].includes(kind)) return "structure du message (segments normalisés)";
  return "échantillon JSON";
}
