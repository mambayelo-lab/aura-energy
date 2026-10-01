import {
  evaluateCausalRules, importMaisonLucieLive, maisonLucieVocab, withSupplyChainRulebook,
  type ArgusVocab,
} from "./argus-vocab-store";
import { applyProposals, proposeMappings, withSupplyChainModel } from "./supply-model";
import { withDerivedIndicators } from "./supply-derived";
import { loadStandardSi } from "./supply-standard";
import { semanticMatch, type EntityMapping } from "./argus-vocab-store";

/**
 * Questionnaire de la démo Maison Lucie (SI historique) : les attributs que le
 * moteur sémantique ne rapproche pas seul (vocabulaire trop éloigné du nom de
 * colonne) sont déclarés comme un client les déclarerait dans le questionnaire
 * « Cartographie des sources ». Chaque correspondance garde son score calculé.
 */
export const MAISON_LUCIE_DECLARED: [string, string][] = [
  ["sc-article.alternatif", "Material.alternateSupplierId"],
  ["sc-article.delai", "Material.leadTimeDays"],
  ["sc-article.prix", "Material.sellingPriceEur"],
  ["sc-article.marge", "Material.grossMarginPct"],
  ["sc-article.cout", "Material.standardCostEur"],
  ["sc-fournisseur.delai", "SupplierScorecard.leadTimeDays"],
  ["sc-prevision.quantite", "DemandForecast.promoted"],
  ["sc-etape.expedition", "Shipment.shipmentId"],
  ["sc-etape.lieu", "Shipment.route"],
];
export function applyDeclaredMappings(vocab: ArgusVocab, declared: [string, string][]): ArgusVocab {
  const out: EntityMapping[] = [];
  for (const [attributeId, fieldName] of declared) {
    const entityId = attributeId.slice(0, attributeId.lastIndexOf("."));
    const field = vocab.fields.find(f => f.name === fieldName);
    const entity = (vocab.entities ?? []).find(e => e.id === entityId);
    const attr = entity?.attributes.find(a => a.id === attributeId);
    if (!field || !attr) continue;
    const existing = (vocab.entityMappings ?? []).filter(m => m.attributeId === attributeId);
    if (existing.some(m => m.fieldId === field.id)) continue;
    const score = semanticMatch(`${entity!.name} ${attr.name}`, fieldName).score;
    out.push({ id: `decl:${attributeId}`, entityId, attributeId, appId: field.appId, fieldId: field.id, isMaster: !existing.length, confidence: score, method: "manuel", rationale: `Déclaré dans le questionnaire Maison Lucie (score du rapprochement ${Math.round(score * 100)} %).` });
  }
  return { ...vocab, entityMappings: [...(vocab.entityMappings ?? []), ...out] };
}

// Jeu de démonstration Supply Chain « Maison Lucie » en un clic.
// Enchaîne les mêmes fonctions que le Studio (aucune donnée inventée) :
// sources déclarées → lecture live du SI synthétique → modèle objet →
// validation des propositions de mapping au-dessus du seuil → alertes
// issues des règles causales évaluées sur les valeurs lues.

export const MAISON_LUCIE_DEMO_DOMAIN = "SCRA · Démo Maison Lucie explicite";
export const SUPPLY_DEMO_NOTICE = "Données de démonstration — SI synthétique Maison Lucie";
export const SUPPLY_DEMO_THRESHOLD = 0.75;
/**
 * Version de la chaîne de démo (lecture, modèle objet, mappings déclarés).
 * Une démo enregistrée dans le navigateur avec une autre version a été
 * produite par un code ou des données antérieurs (mappings manquants, tables
 * absentes) : elle est relue automatiquement au lieu d'afficher des calculs
 * faux (ex. stress-test « détroit » à 0 €). À incrémenter à chaque changement
 * de la chaîne ou du contrat du SI Maison Lucie.
 */
export const SUPPLY_DEMO_VERSION = "2026-09-30.3";

export type SupplyDemoStepId = "sources" | "import" | "model" | "mapping" | "alerts";
export const SUPPLY_DEMO_STEPS: { id: SupplyDemoStepId; label: string }[] = [
  { id: "sources", label: "Installer les sources Maison Lucie" },
  { id: "import", label: "Lire les données du SI (import live)" },
  { id: "model", label: "Charger le modèle objet Supply Chain" },
  { id: "mapping", label: "Valider les propositions de mapping (≥ 75 %)" },
  { id: "alerts", label: "Évaluer les règles causales → alertes" },
];
export type SupplyDemoStepState = "pending" | "running" | "done" | "error";
export type SupplyDemoProgress = Record<SupplyDemoStepId, { state: SupplyDemoStepState; detail?: string }>;

export function initialDemoProgress(): SupplyDemoProgress {
  return Object.fromEntries(SUPPLY_DEMO_STEPS.map(s => [s.id, { state: "pending" }])) as SupplyDemoProgress;
}

/** Démo enregistrée par une version antérieure de la chaîne : à relire. */
export function isStaleSupplyDemo(vocab: ArgusVocab | undefined): boolean {
  return isSupplyDemo(vocab) && vocab!.demoVersion !== SUPPLY_DEMO_VERSION;
}

export function isSupplyDemo(vocab: ArgusVocab | undefined): boolean {
  return !!vocab && vocab.domaine === MAISON_LUCIE_DEMO_DOMAIN && vocab.apps.some(a => a.id.startsWith("ml-"));
}

// Déclare les applications Maison Lucie (avec leurs identifiants de
// démonstration) sans créer de mapping ; remplace une installation antérieure.
export function installMaisonLucieSources(vocab: ArgusVocab): ArgusVocab {
  const demo = maisonLucieVocab();
  const demoAppIds = new Set(demo.apps.map(app => app.id));
  const demoFieldIds = new Set(demo.fields.map(field => field.id));
  return {
    ...vocab,
    domaine: MAISON_LUCIE_DEMO_DOMAIN,
    apps: [
      ...vocab.apps.filter(app => !demoAppIds.has(app.id)),
      ...demo.apps.map(app => ({ ...app, sourceStatus: "configured" as const, lastSyncAt: undefined })),
    ],
    fields: [
      ...vocab.fields.filter(field => !demoAppIds.has(field.appId)),
      ...demo.fields.map(field => ({ ...field, sampleValues: [] })),
    ],
    mappings: vocab.mappings.filter(m => !demoAppIds.has(m.appId) && !demoFieldIds.has(m.fieldId)),
    entityMappings: (vocab.entityMappings ?? []).filter(m => !demoAppIds.has(m.appId) && !demoFieldIds.has(m.fieldId)),
    siTables: (vocab.siTables ?? []).filter(s => !demoAppIds.has(s.appId)),
  };
}

// Retire tout ce que la démo a installé (sources ml-*, champs, mappings,
// échantillons). Le modèle objet et les règles standard restent.
export function resetSupplyDemo(vocab: ArgusVocab): ArgusVocab {
  const ids = new Set(vocab.apps.filter(a => a.id.startsWith("ml-")).map(a => a.id));
  const fieldIds = new Set(vocab.fields.filter(f => ids.has(f.appId)).map(f => f.id));
  return withSupplyChainRulebook({
    ...vocab,
    domaine: vocab.domaine === MAISON_LUCIE_DEMO_DOMAIN ? undefined : vocab.domaine,
    demoVersion: undefined,
    apps: vocab.apps.filter(a => !ids.has(a.id)),
    fields: vocab.fields.filter(f => !ids.has(f.appId)),
    mappings: vocab.mappings.filter(m => !ids.has(m.appId) && !fieldIds.has(m.fieldId)),
    entityMappings: (vocab.entityMappings ?? []).filter(m => !ids.has(m.appId) && !fieldIds.has(m.fieldId)),
    siTables: (vocab.siTables ?? []).filter(s => !ids.has(s.appId)),
    capabilities: (vocab.capabilities ?? []).map(c => ({ ...c, appIds: c.appIds.filter(id => !ids.has(id)) })),
  });
}

export function triggeredAlerts(vocab: ArgusVocab) {
  return evaluateCausalRules(vocab).filter(r => r.triggered).map(r => r.rule);
}

export type SupplyDemoResult =
  | { ok: true; vocab: ArgusVocab; alerts: number; mappings: number }
  | { ok: false; error: string; step: SupplyDemoStepId };

// Orchestration pure (hors persistance) : `onStep` reçoit l'avancement,
// `importLive` est injectable pour les tests. En cas d'échec de lecture du
// SI, on s'arrête : rien n'est inventé ni enregistré.
export async function runSupplyDemo(
  start: ArgusVocab,
  onStep: (id: SupplyDemoStepId, state: SupplyDemoStepState, detail?: string) => void = () => {},
  importLive: typeof importMaisonLucieLive = importMaisonLucieLive,
  loadStandard: (v: ArgusVocab) => Promise<{ ok: true; vocab: ArgusVocab } | { ok: false; error: string }> = v => loadStandardSi(v),
): Promise<SupplyDemoResult> {
  onStep("sources", "running");
  let vocab = installMaisonLucieSources(withSupplyChainRulebook(start));
  onStep("sources", "done", `${vocab.apps.filter(a => a.id.startsWith("ml-")).length} sources`);

  onStep("import", "running");
  let imported: Awaited<ReturnType<typeof importMaisonLucieLive>>;
  try { imported = await importLive(vocab); }
  catch (e) { imported = { ok: false, error: e instanceof Error ? e.message : "Lecture impossible" }; }
  if (!imported.ok) {
    const error = `SI Maison Lucie injoignable : ${imported.error}`;
    onStep("import", "error", error);
    return { ok: false, error, step: "import" };
  }
  vocab = imported.vocab;
  onStep("import", "done", `${(vocab.siTables ?? []).length} tables lues`);

  onStep("model", "running");
  vocab = withSupplyChainModel(vocab);
  onStep("model", "done", `${(vocab.entities ?? []).length} objets`);

  onStep("mapping", "running");
  const proposals = proposeMappings(vocab, SUPPLY_DEMO_THRESHOLD);
  vocab = withSupplyChainRulebook(applyDeclaredMappings(applyProposals(vocab, proposals), MAISON_LUCIE_DECLARED));
  onStep("mapping", "done", `${proposals.length} propositions validées`);

  onStep("alerts", "running");
  // Toutes les alertes au même endroit : les 15 alertes du catalogue (lues
  // ci-dessus) et les règles de résilience calculées sur les données standard
  // (SAP, SRM, QMS, TMS…). Si les tables standard ne sont pas joignables, les
  // règles de résilience sont calculées sur ce qui a été lu, sans rien inventer.
  let std: Awaited<ReturnType<typeof loadStandard>>;
  // Le modèle objet est lu sur les tables standard (une seule source par attribut) ;
  // les indicateurs des 15 alertes gardent leurs branchements sur le SI historique.
  try { std = await loadStandard({ ...vocab, entityMappings: (vocab.entityMappings ?? []).filter(m => !m.appId.startsWith("ml-")) }); } catch (e) { std = { ok: false, error: (e as Error).message }; }
  vocab = std.ok ? std.vocab : withDerivedIndicators(vocab);
  const alerts = triggeredAlerts(vocab).length;
  onStep("alerts", "done", `${alerts} alerte(s)`);
  return { ok: true, vocab: { ...vocab, demoVersion: SUPPLY_DEMO_VERSION }, alerts, mappings: proposals.length };
}

// ── Scénario guidé (bandeau optionnel du cockpit) ──
export type GuidedStepId = "alert" | "detail" | "copilot" | "decision" | "arbitrate";
export const GUIDED_STEPS: { id: GuidedStepId; label: string; hint: string }[] = [
  { id: "alert", label: "Voir l’alerte critique", hint: "Repérez la carte rouge en tête des alertes prioritaires." },
  { id: "detail", label: "Ouvrir le détail", hint: "Bouton ⤢ de la carte : faits sources, seuils, conséquences." },
  { id: "copilot", label: "Questionner le copilote", hint: "Demandez « Pourquoi cette alerte ? » dans le copilote." },
  { id: "decision", label: "Ouvrir la décision préremplie", hint: "« Décider » depuis l’alerte : contexte et leviers repris." },
  { id: "arbitrate", label: "Arbitrer", hint: "Comparez les options et tranchez à l’étape Arbitrer." },
];
const GUIDE_KEY = "aura-supply-demo-guide";
export type GuideState = { dismissed: boolean; done: GuidedStepId[] };
export function loadGuide(): GuideState {
  try { const raw = localStorage.getItem(GUIDE_KEY); if (raw) return { dismissed: false, done: [], ...JSON.parse(raw) }; } catch { /* stockage indisponible */ }
  return { dismissed: false, done: [] };
}
export function saveGuide(state: GuideState): void {
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify(state)); window.dispatchEvent(new Event("aura-supply-guide")); } catch { /* stockage indisponible */ }
}
export function markGuideStep(id: GuidedStepId): void {
  const s = loadGuide();
  if (!s.done.includes(id)) saveGuide({ ...s, done: [...s.done, id] });
}
export function clearGuide(): void {
  try { localStorage.removeItem(GUIDE_KEY); window.dispatchEvent(new Event("aura-supply-guide")); } catch { /* stockage indisponible */ }
}
