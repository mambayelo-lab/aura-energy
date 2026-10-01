import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  AlertOctagon, AlertTriangle, BarChart3, Boxes, Clock, Database, Expand, FileSpreadsheet, Globe, Info, Layers, Pencil, Plus, Radar, Radio, Search, Server, ShieldAlert, ShieldCheck, Share2, Tag, Target, Wallet, Waves, X,
} from "lucide-react";
import { type AlertSeverity, type CatalogueAlert, situationContextSynthesis, type Situation } from "../../lib/v4/alert-catalogue";
import {
  liveOverlayForCatalogueAlert, liveOverlayForSituation, relativeFreshness,
  MAISON_LUCIE_PORTAL, type LiveAlertsResponse, type LiveOverlay,
} from "../../lib/v4/maison-lucie-live";
import { ONTOLOGY_CATALOGUE } from "../../lib/v4/ontology-catalogue";
import { SUPPLY_FAMILIES, supplyFamilyOf } from "../../lib/v4/supply-families";
import { loadVocab, onVocabChange, evaluateCausalRules, kpiStatus, deriveCurrentValue, deriveObservation, kpiSeries, type ArgusVocab, type CausalRule, type CausalRuleEvaluation } from "../../lib/v4/argus-vocab-store";
import { newSession, saveSession, loadSessions, onSessionsChange, type AtelierCriterion, type AtelierLevierDef, type AtelierOptionDef } from "../../lib/v4/atelier-store";
import { AlertChainDiagram } from "./AlertChainDiagram";
import { seedFromAlert } from "../../lib/v4/decision-express";
import { STRATEGIC_DECISIONS } from "../../lib/v4/strategic-decisions";
import { loadCockpitSnapshot, onCockpitSnapshot, toCockpitAlerts } from "../../lib/integration/cockpit";
import { audit, useAccess } from "../../lib/security/use-access";

// Décider depuis une alerte : réservé aux analystes et administrateurs.
function OpenDecisionButton({ onClick }: { onClick: () => void }) {
  const access = useAccess();
  const ok = access.can("decision.write");
  return <button type="button" className="ct-primary" disabled={!ok} title={ok ? undefined : "Réservé aux analystes et administrateurs"} onClick={onClick}>Ouvrir une décision →</button>;
}
import { CommitteeExport, DecisionJournal, useSupplyMemory } from "./SupplyMemoryUI";
import { decisionJournal, observedImpact } from "../../lib/v4/supply-memory";
import { CopilotPanel, type CopilotPastSession, type CopilotSeries } from "./CopilotPanel";
import { SupplyDemoBanner, SupplyDemoLauncher, useSupplyDemoRefresh } from "./SupplyDemo";
import { isSupplyDemo, markGuideStep } from "../../lib/v4/supply-demo";
import { AtelierPage } from "../../routes/cockpit.atelier";
import { DETROIT_AVERTISSEMENT, detroitPreset, estRouteAsieEurope, pestelAnswers } from "../../lib/v4/cas-detroits";
import { buildDemoElicitation, enrichDecisionDemoCase } from "../../lib/v4/demo-enrichment";
import { SUPPLY_PROFILES } from "../../lib/v4/supply-profiles";
import { faitsSanitaires, pandemieDecisionContext, pandemiePestelAnswers, pandemiePreset } from "../../lib/v4/cas-pandemie";
import { OPTIONS_NOEUD, OPTIONS_PANDEMIE, computeResilience, joursAvantImpact, resilienceAlerts, signauxSanitaires } from "../../lib/v4/resilience-tts";
import { exposureFor, illustrativeNote } from "../../lib/v4/supply-derived";
import { CollabPanel } from "./CollabPanel";
import { ResilienceView, type ResilienceDecision } from "./ResilienceView";

// ControlTowerShell — scaffold "Supply Chain Resilience Agent" (lot pilotage),
// spécialisé Supply Chain.
//
// Périmètre volontairement restreint : ceci est une coquille UI posée
// AU-DESSUS du moteur Décider existant, pas un nouveau moteur. Le mode
// "Cockpit" ci-dessous n'a aucune ontologie ni connecteur réel derrière —
// les tuiles KPI sont des valeurs statiques d'exemple, clairement annotées
// comme telles, en attendant un vrai flux de données. Les 15 alertes du mode
// Cockpit sont en revanche le contenu réel du catalogue Supply Chain complet
// fourni (voir alert-catalogue.ts) : leur libellé/signal/options ne sont pas
// fabriqués.
//
// Le mode "Décision" ne réimplémente rien : il renvoie vers la route
// /cockpit/atelier existante (le parcours Comprendre → Suivre), inchangée.
//
// Navigation : la section affichée (cockpit/decision/ontologie/sources/
// regles/administration) vient du paramètre d'URL `section`, piloté par
// l'accordéon du rail de navigation GLOBAL (GuidedAuraRail) — ce shell ne
// pose plus sa propre colonne de nav verticale, pour n'avoir qu'UNE seule
// colonne visible à la fois. Seul un onglet horizontal Cockpit/Décision
// subsiste en haut du contenu (même registre que l'existant), pas une
// deuxième colonne.

type Section = "cockpit" | "decision" | "ontologie" | "resilience";

// Badge honnête "Ancré Maison Lucie" vs "Exemple illustratif" — réutilisé
// sur les cartes Cockpit (alertes + situations) ET Règles & alertes, pour
// ne jamais laisser deviner si une valeur affichée est traçable à un
// enregistrement réel du SI de démonstration Maison Lucie ou une valeur
// d'exemple inventée pour l'affichage. Une `Situation` est TOUJOURS ancrée
// (par construction, voir alert-catalogue.ts) ; une `CatalogueAlert` ne
// l'est que si son champ `grounded` est renseigné.
function GroundedBadge({ grounded, title, live }: { grounded: boolean; title?: string; live?: { generatedAt: string } }) {
  if (grounded && live) {
    return (
      <span className="ct-grounded-badge ct-grounded-live" title={`Confirmé par une lecture live de la source connectée — ${title ?? MAISON_LUCIE_PORTAL}`}>
        <Radio size={11} /> Source connectée · Live <span className="ct-grounded-live-ts">{relativeFreshness(live.generatedAt)}</span>
      </span>
    );
  }
  return grounded
    ? <span className="ct-grounded-badge ct-grounded-yes" title={title ?? "Valeur lue dans un champ explicitement mappé depuis Studio"}><Database size={11} /> Donnée source vérifiée</span>
    : <span className="ct-grounded-badge ct-grounded-no" title="Valeur d'exemple illustrative — aucun enregistrement réel derrière">Exemple illustratif</span>;
}

// Construit les leviers structurés (Comprendre) à partir des options RÉELLES
// du catalogue (alert.options / situation.optionsPossibles) — jamais une
// liste séparée inventée, juste la même liste sous la forme attendue par
// `newSession({ leviersDef })` (voir pack-supply.ts pour le même patron).
function buildLeviersDefFromOptions(id: string, label: string, optionLabels: string[]): AtelierLevierDef[] {
  const options: AtelierOptionDef[] = optionLabels.map((label2, i) => ({ id: `${id}-opt-${i}`, label: label2, impacts: {} }));
  return [{ id: `${id}-L1`, label, type: "decision", description: "Options telles que définies par le catalogue Supply Chain / la situation corrélée — à qualifier avec l'utilisateur.", options }];
}

// TPM structuré dérivé d'un score de risque RÉEL (Lucie SpendGuard overallRisk/
// capacityRisk) — poids = capacityRisk tel que lu dans le dataset Maison
// Lumen (pas un poids par défaut), importance dérivée du même barème que
// `importanceFromPoids` (atelier-store.ts).
function riskCriterion(realFields: Record<string, string | number>, sourceRecord: string): AtelierCriterion {
  const capacityRisk = typeof realFields.capacityRisk === "number" ? realFields.capacityRisk : 50;
  const overallRisk = typeof realFields.overallRisk === "number" ? realFields.overallRisk : capacityRisk;
  const importance = capacityRisk >= 70 ? "Essentiel" : capacityRisk >= 40 ? "Important" : capacityRisk >= 20 ? "Secondaire" : "Faible";
  return {
    id: "tpm-risque-reel",
    label: `Risque fournisseur réel (${realFields.supplierId ?? realFields.supplier ?? sourceRecord})`,
    poids: capacityRisk,
    importance,
    level: "TPM",
    description: `capacityRisk ${capacityRisk} / overallRisk ${overallRisk} — ${sourceRecord}`,
  };
}

// Point d'entrée unique pour le seed structuré d'une alerte ancrée
// Maison Lucie — retourne undefined pour une alerte illustrative (aucune
// donnée fabriquée en aval).
function buildGroundedSeedFromAlert(alert: CatalogueAlert): { leviersDef: AtelierLevierDef[]; criteria: AtelierCriterion[] } | undefined {
  if (!alert.grounded) return undefined;
  return {
    leviersDef: buildLeviersDefFromOptions(alert.id, `${alert.label} — options réelles`, alert.options),
    criteria: [riskCriterion(alert.grounded.realFields, alert.grounded.sourceRecord)],
  };
}

function buildGroundedSeedFromSituation(situation: Situation): { leviersDef: AtelierLevierDef[]; criteria: AtelierCriterion[] } {
  return {
    leviersDef: buildLeviersDefFromOptions(situation.id, `${situation.titre} — options réelles`, situation.optionsPossibles.map(o => o.action)),
    criteria: [riskCriterion(
      { supplierId: situation.realRiskScore.supplierId, supplier: situation.realRiskScore.supplier, capacityRisk: situation.realRiskScore.capacityRisk, overallRisk: situation.realRiskScore.overallRisk },
      `Lucie SpendGuard — SupplierRiskAssessment ${situation.realRiskScore.supplierId}`,
    )],
  };
}

// Pour les 5 signaux ancrés Maison Lucie, quelle clé de `grounded.realFields`
// (et, quand l'unité correspond, quel `delaiLabel` affiché) doit être
// recalculée depuis la vraie valeur importée (Studio → Applications &
// connexions) plutôt que rester la valeur figée au moment où la règle a été
// rédigée. Le KPI cité est le même que celui de la condition de la règle :
// s'il a déclenché l'alerte, deriveCurrentValue a nécessairement une valeur.
const GROUNDED_LIVE_FIELD: Record<string, { kpiId: string; realFieldKey: string; delaiFormat?: (n: number) => string }> = {
  S1: { kpiId: "k-s1", realFieldKey: "capacityRisk" },
  S2: { kpiId: "k-s2", realFieldKey: "daysOfCover", delaiFormat: n => `${n.toLocaleString("fr-FR")} jours` },
  S4: { kpiId: "k-s4", realFieldKey: "delayHours", delaiFormat: n => `${n} h` },
  S6: { kpiId: "k-s6", realFieldKey: "forecastGapPct" },
  S9: { kpiId: "k-s10", realFieldKey: "geopoliticalRisk" },
};

// Adapte une CausalRule (Studio → référentiel de gouvernance, éditable) vers la forme
// CatalogueAlert déjà consommée par CockpitView/AlertBody/openDecisionFromAlert
// — évite de réécrire tout le rendu existant pendant la bascule de source
// (catalogue statique → configuration réelle de Studio). `recurrence` n'a
// pas d'équivalent dans CausalRule (jamais renseignée par Studio) : reste
// vide plutôt qu'inventée. Pour les règles ancrées, `grounded.realFields`
// (et delaiAvantImpactExemple quand l'unité correspond) sont recalculés
// depuis la valeur Studio réellement importée — jamais la valeur figée au
// moment de la rédaction de la règle, pour que la décision ouverte derrière
// ne reparte pas d'un chiffre obsolète (expositionExempleEur reste, lui, une
// estimation d'impact métier propre à Aura — aucun champ du SI ne l'expose
// directement, donc rien à recalculer depuis une donnée source).
function causalRuleToAlert(rule: CausalRule, vocab: ArgusVocab, evaluation?: CausalRuleEvaluation): CatalogueAlert {
  // Entité qui déclenche la règle (toutes ses conditions vraies pour elle) :
  // la plus grave en tête, les autres listées.
  const top = evaluation?.matches[0];
  // Le KPI de la condition fait foi ; la clé « ancrée » ne s'applique que
  // s'il s'agit bien du même indicateur (règle non modifiée dans le Studio).
  const conditionKpiId = rule.conditions.find(condition => condition.kpiId)?.kpiId ?? GROUNDED_LIVE_FIELD[rule.id]?.kpiId;
  const live = GROUNDED_LIVE_FIELD[rule.id]?.kpiId === conditionKpiId ? GROUNDED_LIVE_FIELD[rule.id] : undefined;
  const topFact = top?.facts.find(fact => fact.kpiId === conditionKpiId);
  const liveValue = topFact?.value ?? (conditionKpiId ? deriveCurrentValue(vocab, conditionKpiId) : undefined);
  const sourceMapping = conditionKpiId
    ? (vocab.mappings.find(mapping => mapping.kpiId === conditionKpiId && !mapping.condition)
      ?? vocab.mappings.find(mapping => mapping.kpiId === conditionKpiId))
    : undefined;
  const sourceField = sourceMapping ? vocab.fields.find(field => field.id === sourceMapping.fieldId) : undefined;
  const sourceApp = sourceMapping ? vocab.apps.find(app => app.id === sourceMapping.appId) : undefined;
  const sourceKpi = conditionKpiId ? vocab.kpis.find(kpi => kpi.id === conditionKpiId) : undefined;
  const observation = conditionKpiId ? deriveObservation(vocab, conditionKpiId) : undefined;
  const recordLabel = top ? top.label : observation?.record
    ? ["supplierId", "supplier", "sku", "siteId", "week", "shipmentId", "purchaseOrderId", "id"].map(key => observation.record?.[key]).filter(Boolean).slice(0, 2).join(" · ")
    : "";
  const mappedGrounded = liveValue !== undefined && sourceMapping && sourceField && sourceApp
    ? {
        sourceRecord: `${sourceApp.label} · ${sourceField.name}`,
        realFields: {
          value: liveValue,
          unit: sourceKpi?.unit ?? "",
          kpiId: conditionKpiId ?? "",
          ...(recordLabel ? { record: recordLabel } : {}),
          ...(observation && (rule.conditions.length === 1 || !top) ? { breaches: `${observation.breachCount}/${observation.recordCount}` } : {}),
          ...(evaluation?.matches.length ? { entities: evaluation.matches.map(m => m.label).join(" | "), scope: evaluation.scope.entityName ?? "" } : {}),
          ...(live ? { [live.realFieldKey]: liveValue } : {}),
        },
      }
    : undefined;
  const grounded = rule.grounded && live && liveValue !== undefined
    ? { ...rule.grounded, realFields: { ...rule.grounded.realFields, [live.realFieldKey]: liveValue, value: liveValue, unit: sourceKpi?.unit ?? "", ...(recordLabel ? { record: recordLabel } : {}), ...(evaluation?.matches.length ? { entities: evaluation.matches.map(m => m.label).join(" | "), scope: evaluation.scope.entityName ?? "" } : {}) } }
    : (rule.grounded ?? mappedGrounded);
  // La gravité suit la donnée observée : un indicateur au-delà de son seuil
  // critique rend l'alerte critique, quelle que soit la gravité par défaut.
  const observedCritical = top
    ? top.facts.some(fact => fact.status === "critique")
    : sourceKpi && liveValue !== undefined && kpiStatus({ ...sourceKpi, currentValue: liveValue }) === "critique";
  const severity3 = observedCritical ? "critique" : rule.displaySeverity ?? (rule.severity === "critique" ? "critique" : "majeure");
  const delaiAvantImpactExemple = live?.delaiFormat && liveValue !== undefined ? live.delaiFormat(liveValue) : (rule.delaiLabel ?? "—");
  return {
    id: rule.id,
    label: rule.label,
    sector: "supply-chain",
    signal: rule.causes?.join(" ") ?? rule.conclusion,
    decisionQuestion: rule.decisionQuestion ?? rule.conclusion,
    options: rule.options ?? [],
    recurrence: "",
    severity: severity3,
    siteLabelExemple: top?.label ?? rule.siteLabel ?? "",
    // Montant calculé sur les données branchées (source indiquée) ; sinon « à renseigner », jamais l'exemple du catalogue.
    ...(() => { const e = exposureFor(vocab, rule.id, evaluation); return e ? { expositionExempleEur: e.eur, exposition: e } : { expositionExempleEur: 0 }; })(),
    ...(() => { const n = illustrativeNote(vocab, rule.id); return n ? { illustratif: n } : {}; })(),
    delaiAvantImpactExemple,
    causes: rule.causes ?? [rule.conclusion],
    causalRule: { condition: rule.causes?.join(", ") ?? rule.conclusion, consequence: rule.conclusion },
    variables: rule.causes ?? [],
    grounded,
  };
}

// Pont Ontologie → Copilote de configuration (voir ControlTowerShell()) —
// défini ici (avant usage) car partagé entre OntologieView et CopilotPanel.
export type OntologySuggestion = { attribut: string; applicationId: string; champGuess: string; alertesLiees: string[]; note: string };
export type OntologyConfigBridge = {
  objectName: string;
  existingAttributes: string[];
  sourceCards: { id: string; nom: string; type: string }[];
  onAccept: (s: OntologySuggestion) => void;
};

// En-tête de page — eyebrow (petit label majuscule) + H1 + sous-titre.
// Appliqué systématiquement sur chaque page SCRA (hors Cockpit/Décision qui
// gardent leur propre bandeau ct-topbar) pour porter le nom complet "Supply
// Chain Resilience Agent" quelque part de visible, puisque le rail de
// navigation ne l'affiche plus qu'en abrégé ("SCRA").
function PageHeader({ eyebrow, title, subtitle, icon }: { eyebrow: string; title: string; subtitle?: string; icon: typeof Radar }) {
  const Icon = icon;
  // Épuré : le sous-titre explicatif devient une info-bulle du titre.
  return (
    <header className="ct-pagehead">
      <span className="ct-pagehead-eyebrow">{eyebrow}</span>
      <h1 title={subtitle}><span className="ct-pagehead-icon"><Icon size={20} /></span>{title}</h1>
    </header>
  );
}


// Faits qui justifient une alerte, lus dans Studio : valeur la plus
// défavorable, enregistrement qui la porte, nombre d'enregistrements hors
// seuil, source et heure de lecture, conditions de la règle. Sert à préremplir
// la décision ; l'utilisateur complète le reste.
function alertEvidence(alert: CatalogueAlert, vocab: ArgusVocab | undefined): string {
  if (!vocab) return "";
  const rule = vocab.causalRules.find(r => r.id === alert.id);
  const evaluations = evaluateCausalRules(vocab);
  const evaluation = evaluations.find(r => r.rule.id === alert.id);
  const top = evaluation?.matches[0];
  const facts: string[] = [];
  for (const condition of rule?.conditions ?? []) {
    if (!condition.kpiId) continue;
    const kpi = vocab.kpis.find(k => k.id === condition.kpiId);
    const obs = deriveObservation(vocab, condition.kpiId);
    if (!kpi || !obs) continue;
    // Valeur lue pour l'entité qui déclenche la règle, pas le pire enregistrement global.
    const fact = top?.facts.find(f => f.kpiId === condition.kpiId);
    const value = fact?.value ?? obs.value;
    const who = top ? "" : obs.record ? ["supplierId", "supplier", "sku", "siteId", "week", "shipmentId", "id"].map(k => obs.record?.[k]).filter(Boolean).slice(0, 2).join(" ") : "";
    facts.push(`${kpi.label} : ${value.toLocaleString("fr-FR")} ${kpi.unit}${who ? ` (${who})` : ""}, seuil ${kpi.seuilAlerte} ; ${obs.breachCount}/${obs.recordCount} concernés. Source : ${obs.appLabel.split(" · ")[0]}, ${obs.fetchedAt ? new Date(obs.fetchedAt).toLocaleDateString("fr-FR") : "lecture Studio"}.`);
  }
  const others = evaluations.filter(r => r.triggered && r.rule.id !== alert.id).map(r => r.rule.label);
  const entities = evaluation?.matches ?? [];
  return [
    top ? `Entité concernée : ${top.label}${entities.length > 1 ? ` (la plus exposée ; aussi : ${entities.slice(1, 6).map(m => m.label).join(", ")})` : ""}.` : "",
    facts.length ? `Faits : ${facts.join(" ")}` : "",
    others.length ? `Autres signaux : ${others.join(", ")}.` : "",
    "À compléter : horizon, contraintes, options.",
  ].filter(Boolean).join("\n");
}

export function ControlTowerShell() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/cockpit/resilience" });
  // "situations" a existé comme section séparée puis a été fusionné dans
  // Cockpit (les 2 cartes Situation sont maintenant la section "Situations
  // transverses" en tête de Cockpit) — un lien externe/historique vers
  // ?section=situations retombe proprement sur Cockpit plutôt que sur une
  // page vide.
  const rawSection = search.section as string | undefined;
  const { decisions: supplyDecisions } = useSupplyMemory();
  // "situations" (ex-page séparée), "sources"/"mapping" et "regles" (pages
  // SCRA natives, retirées au profit des équivalents Studio Aura plus
  // riches — voir /cockpit/studio, /cockpit/connecteurs, l'onglet "Règles
  // causales" de Studio) retombent proprement sur Cockpit plutôt que sur
  // une page vide pour un lien historique.
  // Sections retirées (capabilities, administration) et anciennes URL : retour au cockpit.
  const section: Section = rawSection === "decision" || rawSection === "ontologie" || rawSection === "resilience" ? rawSection : "cockpit";
  const [hoveredAlert, setHoveredAlert] = useState<CatalogueAlert | null>(null);
  // Session active du parcours Décider embarqué en mode « Décision ». Le
  // shell la porte lui-même (au lieu de dépendre de l'URL /cockpit/atelier)
  // puisque le parcours est désormais rendu ICI, pas sur une autre route.
  const [decisionSessionId, setDecisionSessionId] = useState<string | undefined>(undefined);
  // Ouverture depuis l'historique du menu latéral (?sessionId=…).
  const urlSessionId = (search as { sessionId?: string }).sessionId;
  useEffect(() => { if (urlSessionId) setDecisionSessionId(urlSessionId); }, [urlSessionId]);
  // Pont Ontologie → Copilote : OntologieView y publie (via useEffect) l'objet
  // métier actuellement affiché, ses attributs déjà connus et un callback
  // d'application, pour que le Copilote de configuration (rendu ICI, au
  // niveau du shell, pas dans OntologieView) puisse appeler
  // suggestOntologyConfig avec un contexte réel et appliquer une suggestion
  // acceptée via le même mécanisme d'édition (OntologyEdits/sessionStorage).
  const [ontologyBridge, setOntologyBridge] = useState<OntologyConfigBridge | null>(null);
  // Vocab + sessions réels, chargés au niveau du shell (pas seulement dans
  // CockpitView/DecisionEntry) pour que le Copilote Aura (rendu ICI) puisse
  // voir les mêmes données que le Cockpit et la même liste de décisions déjà
  // évaluées que Décider, sans les redemander depuis un composant enfant.
  const [copilotVocab, setCopilotVocab] = useState<ArgusVocab | undefined>(undefined);
  useEffect(() => {
    const sync = () => { try { setCopilotVocab(loadVocab()); } catch { /* pas de vocab local dispo */ } };
    sync();
    return onVocabChange(sync);
  }, []);
  useSupplyDemoRefresh(copilotVocab);
  const [supplySessions, setSupplySessions] = useState<ReturnType<typeof loadSessions>>([]);
  useEffect(() => {
    const sync = () => { try {
      const list = loadSessions().filter(s => s.sector === "Supply chain");
      setSupplySessions(list);
      if (list.some(s => s.alertId && (s.step === "decider" || s.step === "suivi"))) markGuideStep("arbitrate");
    } catch { setSupplySessions([]); } };
    sync();
    return onSessionsChange(sync);
  }, []);

  function goSection(s: Section) {
    navigate({ to: "/cockpit/resilience", search: { section: s } });
  }

  function openDecisionFromAlert(alert: CatalogueAlert) {
    // Alerte ancrée Maison Lucie → seed structuré (leviersDef + critère TPM
    // dérivé d'un score de risque réel), visible dès Comprendre/Impacter au
    // lieu d'un simple texte libre. Alerte illustrative → contextRaw seul,
    // inchangé (pas de fait structuré fabriqué).
    // Options de la règle et critères de l'alerte pré-remplis : on arrive
    // directement sur « Options et critères », le résultat est à un clic.
    const rule = copilotVocab?.causalRules.find(r => r.id === alert.id);
    const kpiLabel = copilotVocab?.kpis.find(k => k.id === rule?.conditions.find(c => c.kpiId)?.kpiId)?.label;
    const options = alert.options.length ? alert.options : rule?.options ?? [];
    // Impacts mesurés : décisions passées sur la même alerte, dont l'effet sur l'indicateur a été relevé.
    const journal = copilotVocab ? decisionJournal(copilotVocab, supplyDecisions) : [];
    const observed = (option: string) => {
      const r = observedImpact(journal, alert.label, option);
      return r ? { outcome: r.outcome, before: r.before, now: r.now, unit: r.unit, date: r.date, entity: r.entity, resolved: r.statusBefore !== "ok" && r.statusNow === "ok", critical: r.statusNow === "critique" && r.statusBefore !== "critique" } : undefined;
    };
    // Retard sur un trajet Asie → Europe (ex. Shenzhen → Paris) : profil « détroit maritime », PESTEL sourcé joint.
    const pick = (r: Record<string, unknown> | undefined, re: RegExp) => r ? String(Object.entries(r).find(([k]) => re.test(k))?.[1] ?? "") : "";
    const route = (r: Record<string, unknown> | undefined) => `${pick(r, /^orig/i)} → ${pick(r, /^dest/i)}`;
    // Enregistrements de toutes les entités qui déclenchent l'alerte (expéditions, perturbations) : route, lieu, origine → destination.
    const records = copilotVocab ? (evaluateCausalRules(copilotVocab).find(r => r.rule.id === alert.id)?.matches ?? []).flatMap(m => m.facts.map(f => f.record)) : [];
    const routes = [alert.siteLabelExemple ?? "", route(alert.grounded?.realFields), ...records.map(route), ...records.map(r => `${pick(r, /^route$/i)} ${pick(r, /^location$/i)}`)].join("\n");
    const asieEurope = /retard|delay/i.test(`${alert.label} ${alert.id}`) && (estRouteAsieEurope(routes) || /suez|mer rouge|red sea|bab el|ormuz|hormuz/i.test(routes));
    // Signal « crise sanitaire » : faits Maison Lucie (pic, amplification, ruptures, absentéisme) et PESTEL sourcé joints.
    const sanitaire = alert.id === "RES-PANDEMIE";
    const faitsCrise = sanitaire && copilotVocab ? faitsSanitaires(signauxSanitaires(copilotVocab, computeResilience(copilotVocab))) : [];
    const seed = options.length >= 2 ? seedFromAlert({ id: asieEurope ? `INT-RETARD-ASIE-${alert.id}` : alert.id, kpiLabel, alertLabel: alert.label, options, observed }) : undefined;
    const legacy = seed ? undefined : buildGroundedSeedFromAlert(alert);
    const session = newSession({
      contextRaw: [`${alert.label} — ${alert.decisionQuestion}`, alertEvidence(alert, copilotVocab), asieEurope ? `Route Asie → Europe exposée à la perturbation d'un détroit (mer Rouge, Bab el-Mandeb). ${DETROIT_AVERTISSEMENT}` : "", sanitaire ? pandemieDecisionContext(faitsCrise) : ""].filter(Boolean).join("\n"),
      title: alert.decisionQuestion || `${alert.id} — ${alert.label}`,
      alertId: alert.id,
      alertLabel: `Depuis l'alerte « ${alert.label} »${alert.siteLabelExemple ? ` · ${alert.siteLabelExemple}` : ""}`,
      criteria: seed?.criteria ?? legacy?.criteria,
      sector: "Supply chain",
    });
    if (seed) {
      session.leviersDef = seed.leviersDef; session.scenarios = seed.scenarios; session.step = "impacter"; session.modelValidated = true;
      session.elicitation = { ...(session.elicitation ?? {}), step: 6, objectif: kpiLabel ? `Réduire : ${kpiLabel}` : alert.label, risques: seed.risques, ...(asieEurope ? { pestelSelected: Object.keys(pestelAnswers()), pestelAnswers: pestelAnswers() } : {}), ...(sanitaire ? { pestelSelected: Object.keys(pandemiePestelAnswers()), pestelAnswers: pandemiePestelAnswers() } : {}) } as typeof session.elicitation;
    }
    else if (legacy) session.leviersDef = legacy.leviersDef;
    saveSession(session);
    markGuideStep("decision");
    setDecisionSessionId(session.id);
    goSection("decision");
  }

  // Nœud critique ou scénario de stress-test (vue Résilience) : même mécanisme
  // que depuis une alerte, avec le profil du scénario et les valeurs lues.
  function openDecisionFromResilience(d: ResilienceDecision) {
    if (d.kind === "noeud") {
      const a = d.article;
      openDecisionFromAlert(resilienceAlerts(copilotVocab).find(x => x.id === `RES-TTS-${a.sku}`) ?? {
        id: `RES-TTS-${a.sku}`, label: `Nœud critique : ${a.designation} (${a.sku})`, sector: "supply-chain",
        signal: `TTS ${a.tts ?? "?"} j < TTR ${a.ttr ?? "?"} j. ${a.ttrDetail}`, decisionQuestion: `Comment ramener le délai de reprise de ${a.sku} sous son délai de survie ?`,
        options: OPTIONS_NOEUD, recurrence: "", severity: "majeure", siteLabelExemple: a.fournisseurNom ?? "", expositionExempleEur: a.caRisque ?? 0,
        delaiAvantImpactExemple: a.tts !== undefined ? `${a.tts} j` : "", causes: [a.ttrDetail], causalRule: { condition: "TTR > TTS", consequence: "Décider d'une protection" }, variables: ["TTS", "TTR"],
      });
      return;
    }
    const r = d.result;
    const ids: Record<string, string> = { detroit: "INT-RETARD-ASIE-RES", fournisseur: "S1-RES", port: "INT-RETARD-RES" };
    const profile = SUPPLY_PROFILES.find(p => p.id === ({ detroit: "detroit", fournisseur: "appro", port: "transport" } as Record<string, string>)[r.kind]);
    const options = (profile?.levers.find(l => l.options.length >= 3) ?? profile?.levers[0])?.options.map(o => o.label) ?? [];
    const seed = seedFromAlert({ id: ids[r.kind], alertLabel: `Arrêt : ${r.cibleLabel}`, kpiLabel: "Articles qui rompent avant la fin de l'arrêt", options });
    const facts = [
      `Scénario d'arrêt : ${r.cibleLabel} pendant ${r.duree} jours. ${r.perimetre}`,
      `Règle : ${r.regle} ${r.exposes.length} article(s) exposé(s) sur ${r.lignes.length} : ${r.exposes.slice(0, 6).map(l => `${l.article.sku} (TTS lu ${l.article.tts} j)`).join(", ") || "aucun"}. Valeurs lues dans le SI, aucun montant calculé.`,
      ...(r.kind === "detroit" ? [DETROIT_AVERTISSEMENT] : []),
    ];
    const session = newSession({ contextRaw: facts.join("\n"), title: `Arrêt : ${r.cibleLabel} (${r.duree} j)`, alertId: ids[r.kind], alertLabel: `Depuis le scénario d'arrêt « ${r.cibleLabel} »`, criteria: seed.criteria, sector: "Supply chain" });
    session.leviersDef = seed.leviersDef; session.scenarios = seed.scenarios; session.step = "impacter"; session.modelValidated = true;
    const pestel = r.kind === "detroit" ? pestelAnswers() : undefined;
    session.elicitation = { ...(session.elicitation ?? {}), step: 6, objectif: "Réduire le nombre d'articles qui rompent avant la fin de l'arrêt", risques: seed.risques, ...(pestel ? { pestelSelected: Object.keys(pestel), pestelAnswers: pestel } : {}) } as typeof session.elicitation;
    saveSession(session);
    setDecisionSessionId(session.id);
    goSection("decision");
  }

  // Même mécanisme que openDecisionFromAlert ci-dessus (newSession/
  // saveSession), étendu pour accepter une Situation (objet plus riche
  // qu'une CatalogueAlert) au lieu de dupliquer la logique d'ouverture. Une
  // Situation est TOUJOURS ancrée Maison Lucie → seed structuré systématique.
  function openDecisionFromSituation(situation: Situation) {
    const seed = buildGroundedSeedFromSituation(situation);
    const session = newSession({
      contextRaw: situationContextSynthesis(situation),
      title: `${situation.id} — ${situation.titre}`,
      alertId: situation.id,
      alertLabel: `Créée depuis la situation #${situation.id} (corrèle ${situation.alertesCorrelees.join(", ")}) — ancrée Maison Lucie (leviers/critère réels pré-remplis)`,
      criteria: seed.criteria,
      sector: "Supply chain",
    });
    session.leviersDef = seed.leviersDef;
    saveSession(session);
    setDecisionSessionId(session.id);
    goSection("decision");
  }

  const vocabSummary = useMemo(() => {
    if (!copilotVocab) return undefined;
    const activeApps = copilotVocab.apps.filter(app => app.enabled !== false);
    const kpiLines = copilotVocab.kpis.map(k => {
      const observed = deriveCurrentValue(copilotVocab, k.id);
      if (observed === undefined) return `${k.label} : non alimenté (aucun mapping de valeur)`;
      const st = kpiStatus({ ...k, currentValue: observed });
      return `${k.label} : ${observed} ${k.unit} — ${st === "ok" ? "normal" : st} — seuil alerte ${k.seuilAlerte} ${k.unit}, seuil critique ${k.seuilCritique} ${k.unit}`;
    });
    const triggered = evaluateCausalRules(copilotVocab).filter(r => r.triggered).map(r => `${r.rule.label} (déclenchée${r.matches[0] ? ` pour ${r.matches[0].label}${r.matches.length > 1 ? ` et ${r.matches.length - 1} autre(s) ${r.scope.entityName?.toLowerCase() ?? "entité"}` : ""}` : ""})`);
    const mappedFacts = (copilotVocab.entityMappings ?? []).slice(0, 12).map(mapping => {
      const app = activeApps.find(a => a.id === mapping.appId);
      const field = copilotVocab.fields.find(f => f.id === mapping.fieldId);
      const entity = (copilotVocab.entities ?? []).find(e => e.id === mapping.entityId);
      const attribute = entity?.attributes.find(a => a.id === mapping.attributeId);
      const label = entity && attribute ? `${entity.name}.${attribute.name}` : field?.name ?? mapping.fieldId;
      const value = field?.sampleValues?.[0] ?? "valeur non disponible";
      return `${label} = ${value} (source : ${app?.label ?? mapping.appId}${mapping.isMaster ? ", source maîtresse" : ""})`;
    });
    const snapshots = (copilotVocab.siTables ?? []).length;
    if (activeApps.length === 0 && kpiLines.length === 0 && triggered.length === 0 && mappedFacts.length === 0) return undefined;
    return [
      activeApps.length ? `Sources Studio actives : ${activeApps.length} — ${activeApps.slice(0, 8).map(a => a.label).join(", ")}` : undefined,
      copilotVocab.fields.length ? `Métadonnées disponibles : ${copilotVocab.fields.length}` : undefined,
      snapshots ? `Échantillons de données lus : ${snapshots}` : undefined,
      mappedFacts.length ? `Faits gouvernés issus des mappings : ${mappedFacts.join(" ; ")}` : undefined,
      kpiLines.length ? `Indicateurs : ${kpiLines.join(" ; ")}` : undefined,
      triggered.length ? `Règles causales déclenchées : ${triggered.join(" ; ")}` : undefined,
      "Consigne : distinguer explicitement les faits observés, les hypothèses et les recommandations. Ne jamais inventer une donnée absente.",
    ].filter(Boolean).join("\n");
  }, [copilotVocab]);

  const copilotSeries: CopilotSeries[] = useMemo(() => {
    if (!copilotVocab) return [];
    return copilotVocab.kpis.flatMap(kpi => {
      const points = kpiSeries(copilotVocab, kpi.id);
      const obs = deriveObservation(copilotVocab, kpi.id);
      return points.length ? [{ label: kpi.label, unit: kpi.unit, alert: kpi.seuilAlerte, critical: kpi.seuilCritique, source: obs ? `${obs.appLabel} · ${obs.fieldName}` : "Studio", points }] : [];
    });
  }, [copilotVocab]);
  const focusKpiLabel = useMemo(() => {
    const kpiId = hoveredAlert && copilotVocab ? copilotVocab.causalRules.find(r => r.id === hoveredAlert.id)?.conditions.find(c => c.kpiId)?.kpiId : undefined;
    return kpiId ? copilotVocab?.kpis.find(k => k.id === kpiId)?.label : undefined;
  }, [hoveredAlert, copilotVocab]);

  const pastSessionsList: CopilotPastSession[] = useMemo(() => supplySessions.slice(0, 6).map(s => ({ id: s.id, title: s.title, step: s.step, updatedAt: s.updatedAt })), [supplySessions]);
  const pastSessionsSummary = useMemo(() => {
    if (supplySessions.length === 0) return undefined;
    return supplySessions.slice(0, 6).map(s => `« ${s.title} » — étape ${s.step}${s.retainedScenarioId ? ", option retenue" : ""}`).join(" ; ");
  }, [supplySessions]);

  const copilotContext = useMemo(() => {
    if (section === "cockpit") {
      return { mode: "cockpit" as const, alertId: hoveredAlert?.id, onClearAlert: () => setHoveredAlert(null), onOpenDecision: hoveredAlert ? () => openDecisionFromAlert(hoveredAlert) : undefined, alertLabel: hoveredAlert ? `${hoveredAlert.id.length <= 8 ? `${hoveredAlert.id} — ${hoveredAlert.label}` : hoveredAlert.label}${hoveredAlert.siteLabelExemple ? ` · ${hoveredAlert.siteLabelExemple}` : ""}` : undefined, alertSignal: hoveredAlert?.signal, vocabSummary, pastSessionsSummary, pastSessions: pastSessionsList, series: copilotSeries, focusKpiLabel };
    }
    if (section === "ontologie") {
      return { mode: "decision" as const, objectif: ontologyBridge ? `Configuration de l'ontologie — objet « ${ontologyBridge.objectName} »` : "Configuration de l'ontologie", contextRaw: undefined, vocabSummary, pastSessionsSummary, pastSessions: pastSessionsList };
    }
    const current = supplySessions.find(s => s.id === decisionSessionId);
    return { mode: "decision" as const, objectif: current?.title, contextRaw: current?.contextRaw, vocabSummary, pastSessionsSummary, pastSessions: pastSessionsList, series: copilotSeries };
  }, [section, hoveredAlert, ontologyBridge, vocabSummary, pastSessionsSummary, pastSessionsList, supplySessions, decisionSessionId, copilotSeries, focusKpiLabel]);

  const showCopilot = section === "cockpit" || section === "decision" || section === "ontologie";

  function resumeSession(id: string) {
    setDecisionSessionId(id);
    goSection("decision");
  }


  return (
    <div className="ct-shell">
      <div className="ct-main">
        {(section === "cockpit" || section === "decision" || section === "resilience") && (
          <header className="ct-topbar aura-hero-band">
            <div className="ct-topbar-title">
              <span className="ct-topbar-eyebrow aura-hero-eyebrow">SUPPLY CHAIN</span>
              <h1 title="Anticipe les risques. Éclaire les décisions.">Aura Supply Chain</h1>
            </div>
            <div className="ct-toggle" role="tablist" aria-label="Mode d'affichage">
              <button role="tab" aria-selected={section === "cockpit"} className={section === "cockpit" ? "active" : ""} onClick={() => goSection("cockpit")}>Cockpit</button>
              <button role="tab" aria-selected={section === "resilience"} className={section === "resilience" ? "active" : ""} onClick={() => goSection("resilience")} title="Combien de temps tenez-vous si un fournisseur, un port ou un détroit s'arrête ?">Exposition</button>
              <button role="tab" aria-selected={section === "decision"} className={section === "decision" ? "active" : ""} onClick={() => goSection("decision")}>Décision</button>
            </div>
          </header>
        )}

        <main className="ct-content">
          {(section === "cockpit" || section === "decision") && <SupplyDemoBanner vocab={copilotVocab} />}
          {section === "cockpit" && <CockpitView onOpenDecision={openDecisionFromAlert} onOpenSituationDecision={openDecisionFromSituation} onHoverAlert={setHoveredAlert} />}
          {section === "decision" && <DecisionEntry sessionId={decisionSessionId} onSessionIdChange={setDecisionSessionId} suggestions={DECISION_SUGGESTIONS} />}
          {section === "ontologie" && <OntologieView onBridgeChange={setOntologyBridge} />}
          {section === "resilience" && <ResilienceView vocab={copilotVocab} decisions={supplyDecisions.length} rulesTriggered={copilotVocab ? evaluateCausalRules(copilotVocab).filter(r => r.triggered).length : 0} onOpenDecision={openDecisionFromResilience} />}
        </main>
      </div>

      {showCopilot && <CopilotPanel collapsed={section === "decision"} context={copilotContext} ontologyConfig={section === "ontologie" ? ontologyBridge ?? undefined : undefined} onResumeSession={resumeSession} />}

      <style>{CSS}</style>
    </div>
  );
}

type CasType = {
  id: string;
  titre: string;
  question: string;
  inputs: string;
  outputs: string;
  particularite?: string;
};

// Cas types Supply Chain — synthèse des cas métier détaillés du
// catalogue produit (AURA_VERTICALS_ENERGY_SUPPLY_CHAIN_SPEC.md §6).
// Donne au décideur une idée des types de décisions couverts, en
// complément (pas en remplacement) des alertes live du Cockpit.
// Table authoritative fournie par l'utilisateur (lot consolidation) — les
// libellés Décision/Inputs/Livrables ci-dessous transcrivent fidèlement
// cette table ; les 4 cas déjà présents ont été réconciliés mot pour mot
// sur elle, et 2 nouveaux cas (Make Buy, Assortiment et marge) ajoutés.
const CAS_TYPES: CasType[] = [
  {
    id: "S1",
    titre: "Résilience fournisseur",
    question: "Conserver, sécuriser, doubler ou remplacer un fournisseur critique ?",
    inputs: "OTIF, qualité, dépendance, capacité, contrats, stock, pays et finance",
    outputs: "Stratégie fournisseur, coût de résilience et déclencheurs",
  },
  {
    id: "S2",
    titre: "Stock service marge",
    question: "Réapprovisionner, transférer, promouvoir ou arrêter un SKU ?",
    inputs: "Stocks, demande, marge, saisonnalité, cash, délais et capacité",
    outputs: "Action par famille et protection contre rupture ou obsolescence",
  },
  {
    id: "S3",
    titre: "Réseau logistique",
    question: "Centraliser, régionaliser, nearshorer ou externaliser ?",
    inputs: "Coût, délai, service, carbone, géopolitique, capacité et résilience",
    outputs: "Réseau cible, scénarios et trajectoire de migration",
  },
  {
    id: "S5",
    titre: "Make Buy",
    question: "Produire en interne ou externaliser une famille ?",
    inputs: "Coûts, qualité, capacité, compétences, dépendance et propriété intellectuelle",
    outputs: "Décision par famille, seuils et risques",
  },
  {
    id: "S6",
    titre: "Assortiment et marge",
    question: "Quels produits conserver, lancer ou retirer ?",
    inputs: "Marge, ventes, différenciation, stock, cannibalisation, fournisseurs et image",
    outputs: "Portefeuille produit et plan de transition",
  },
  {
    id: "S4",
    titre: "Control Tower décisionnelle",
    question: "Quelle action prendre après une alerte ?",
    inputs: "Alertes WMS ERP APS TMS, causes, impacts et contraintes",
    outputs: "Alerte vers options vers arbitrage vers action vers résultat",
    particularite: "Aura ne remplace pas SAP IBP, o9, Kinaxis, WMS ou TMS ; elle relie alerte → contexte → causes → options → arbitrage → validation → action → résultat.",
  },
];

// Note de cadrage démonstrateur — verbatim utilisateur, callout de clôture
// de la page Décisions/cas-types.

// Suggestions de départ pour l'entrée Comprendre en mode « Décision »
// embarqué — reprises verbatim des `question` des cas types S1-S3 ci-dessus
// (eux-mêmes issus du catalogue produit §6), pas inventées séparément. S4
// (« Comment transformer une alerte en décision tracée et justifiée ? »)
// est exclue : c'est une description du parcours lui-même, pas une question
// de départ actionnable pour une décision libre.
const DECISION_SUGGESTIONS = CAS_TYPES.filter(c => c.id !== "S4").map(c => c.question);

// Entrée stratégique sans données : le décideur peut commencer avant tout
// raccordement SI. Les critères sont explicitement qualitatifs et modifiables ;
// ils structurent l'échange sans simuler de faits ni de précision chiffrée.

// Cadrage expert Supply Chain Resilience — additif, transmis à AtelierPage
// UNIQUEMENT ici (le shell Supply Chain Resilience Agent), via
// `embeddedDomainExpertise` sur le même patron que `embeddedSuggestions` ci-
// dessus. Construit à partir du vocabulaire RÉELLEMENT configuré dans Studio
// (règles causales + familles d'objets), jamais du souvenir d'un catalogue
// figé — un Studio vide donne un cadrage minimal, honnête sur ce qui manque,
// plutôt qu'un hint fabriqué. Le Décider "nu" (/cockpit/atelier) ne reçoit
// jamais cette valeur.
// Retour de test réel : le LLM répondait "sans données Lucie ni sources
// citées" — cette fonction ne citait que le libellé/la logique STATIQUE des
// règles (jamais une valeur ni une provenance), même une fois l'import live
// réussi. Elle cite maintenant, pour chaque règle ancrée dont
// deriveCurrentValue a une valeur réelle, cette valeur ET sa source exacte
// (rule.grounded.sourceRecord — ex. "Lucie SpendGuard — SupplierRiskAssessment
// SUP-001"), pour que le LLM puisse répondre avec un chiffre réel et sa
// traçabilité plutôt qu'une reformulation de la règle elle-même.
function buildDomainExpertiseHint(vocab: ArgusVocab | undefined): string {
  const familles = ONTOLOGY_CATALOGUE["supply-chain"].map(f => f.famille).join(", ");
  const rules = vocab?.causalRules ?? [];
  const rulesText = rules.length
    ? rules.map(r => {
        const cond = r.conditions?.[0];
        const liveValue = vocab && cond?.kpiId ? deriveCurrentValue(vocab, cond.kpiId) : undefined;
        const provenance = r.grounded && liveValue !== undefined
          ? ` — valeur live actuelle : ${liveValue} (source : ${r.grounded.sourceRecord})`
          : r.grounded
            ? ` — ancré Maison Lucie (${r.grounded.sourceRecord}) mais aucune valeur live disponible actuellement : ne pas citer de chiffre pour ce signal`
            : "";
        return `${r.label} (${r.id}) survient quand ${r.causes?.join(", ") ?? r.conclusion}, en s'appuyant sur ${(r.causes ?? []).join(", ") || "le seuil du KPI associé"}${provenance}`;
      }).join(". ")
    : "aucun signal n'est encore configuré dans Studio — ne pas inventer d'alerte, dire clairement qu'aucune règle n'est disponible si l'utilisateur en demande une.";
  return `Cet échange se déroule dans l'agent "Supply Chain Resilience" : le périmètre est la résilience de chaîne d'approvisionnement (tous secteurs — retail, pharma/santé, automobile, agroalimentaire, électronique/semi-conducteurs, chimie, aéronautique, luxe/mode, etc.).
Les familles d'objets déjà modélisées dans l'ontologie produit : ${familles}.
Le catalogue de signaux réellement configuré dans Studio (référentiel à réutiliser, jamais une liste figée à réciter telle quelle) raconte, pour chacun, ce qui se passe et pourquoi : ${rulesText}.
Quand une valeur live et sa source sont données ci-dessus, CITE-les explicitement (valeur + source) dans ta réponse ; sans valeur live, dis-le explicitement plutôt que de citer le seuil de la règle comme si c'était une mesure actuelle.`;
}

function DecisionEntry({ sessionId, onSessionIdChange, suggestions }: { sessionId: string | undefined; onSessionIdChange: (id: string | undefined) => void; suggestions: string[] }) {
  const [vocab, setVocab] = useState<ArgusVocab | undefined>(undefined);
  useEffect(() => {
    const sync = () => { try { setVocab(loadVocab()); } catch { /* pas de vocab local dispo */ } };
    sync();
    return onVocabChange(sync);
  }, []);
  const domainExpertiseHint = useMemo(() => buildDomainExpertiseHint(vocab), [vocab]);
  return (
    <div className="ct-decision">
      {/* Le parcours Décider (Comprendre → Impacter → Scénarios → Arbitrer →
          Suivre) est embarqué ici directement — ce n'est plus un renvoi vers
          la route /cockpit/atelier, la même page continue de fonctionner
          seule à cette route, inchangée. */}
      {/* Évaluation prédéfinie, sans alerte : cas illustratif « détroit maritime », Comprendre pré-rempli (PESTEL sourcé et daté). */}
      <div className="ct-decision-presets">
        <button type="button" className="ct-secondary" data-testid="preset-detroit" onClick={() => {
          const s = detroitPreset(newSession({ contextRaw: "", sector: "Supply chain" }), enrichDecisionDemoCase, buildDemoElicitation);
          saveSession(s); onSessionIdChange(s.id);
        }}>Évaluation prédéfinie : perturbation d'un détroit maritime</button>
        <button type="button" className="ct-secondary" data-testid="preset-pandemie" onClick={() => {
          const s = pandemiePreset(newSession({ contextRaw: "", sector: "Supply chain" }), enrichDecisionDemoCase, buildDemoElicitation);
          saveSession(s); onSessionIdChange(s.id);
        }}>Évaluation prédéfinie : pandémie</button>
      </div>
      {/* Décisions d'investissement et stratégiques, hors alertes : modèle prérempli (leviers, options, indicateurs) et faits Maison Lucie lus sur les données. */}
      <details className="ct-strategic" data-testid="strategic-decisions">
        <summary>Décisions stratégiques <small>(investissement, réseau, sourcing, S&amp;OP : hors alertes)</small></summary>
        <p className="ct-strategic-note">Les options peuvent venir d'un outil d'optimisation ou d'un expert ; Aura les évalue. Aura n'exécute aucune optimisation ni prévision : elle ne calcule pas de réseau ni de stock de sécurité optimal. Les effets proposés sont des hypothèses à confirmer.</p>
        <div className="ct-decision-presets">
          {STRATEGIC_DECISIONS.map(d => (
            <button key={d.id} type="button" className="ct-secondary" data-testid={`strategic-${d.id}`} onClick={() => {
              const seed = seedFromAlert({ id: d.id, alertLabel: d.titre, kpiLabel: d.indicateur, options: d.options });
              const session = newSession({ contextRaw: [d.question, ...d.faits(vocab)].join("\n"), title: d.titre, criteria: seed.criteria, sector: "Supply chain" });
              session.leviersDef = seed.leviersDef; session.scenarios = seed.scenarios; session.step = "impacter"; session.modelValidated = true;
              session.elicitation = { ...(session.elicitation ?? {}), step: 6, objectif: d.question, risques: seed.risques } as typeof session.elicitation;
              saveSession(session); onSessionIdChange(session.id);
            }}>{d.titre}</button>
          ))}
        </div>
      </details>
      <div className="ct-decision-embed">
        <AtelierPage embeddedSessionId={sessionId} embeddedSetSessionId={onSessionIdChange} embeddedSuggestions={suggestions} embeddedDomainExpertise={domainExpertiseHint} embeddedDefaultSector="Supply chain" />
      </div>

    </div>
  );
}

const SEVERITY_META: Record<AlertSeverity, { label: string; icon: typeof AlertOctagon; className: string }> = {
  critique: { label: "Critique", icon: AlertOctagon, className: "sev-critique" },
  majeure: { label: "Majeure", icon: AlertTriangle, className: "sev-majeure" },
  mineure: { label: "Mineure", icon: Info, className: "sev-mineure" },
};

// Overlay générique zoom/expand — même contenu que la carte d'origine,
// juste présenté plus grand et plus lisible (typographie agrandie via
// `.ct-zoom-modal`), avec bouton de fermeture + Échap. Ne réinvente aucun
// champ : le contenu passé en `children` est construit par l'appelant à
// partir des mêmes données que la carte (alerte/situation réelle).
function ZoomModal({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="ct-zoom-backdrop" onClick={onClose} role="presentation">
      <div className="ct-zoom-modal" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <button type="button" className="ct-zoom-close" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

function CockpitView({ onOpenDecision, onOpenSituationDecision, onHoverAlert }: { onOpenDecision: (alert: CatalogueAlert) => void; onOpenSituationDecision: (situation: Situation) => void; onHoverAlert: (a: CatalogueAlert | null) => void }) {
  const [zoomedAlert, setZoomedAlert] = useState<CatalogueAlert | null>(null);
  const { decisions } = useSupplyMemory();
  const [zoomedSituation, setZoomedSituation] = useState<Situation | null>(null);
  // Le Cockpit n'affiche plus un catalogue statique : les alertes viennent
  // des règles causales configurées dans Studio (Signaux & règles), évaluées
  // en direct contre les KPI mappés — un Studio vide donne un Cockpit vide,
  // jamais une donnée de secours inventée. État initial `undefined`
  // (identique au rendu serveur, qui n'a pas accès à localStorage) pour ne
  // pas provoquer de mismatch d'hydratation — voir useRealAttributeMappingLookup.
  const [vocab, setVocab] = useState<ArgusVocab | undefined>(undefined);
  useEffect(() => {
    const sync = () => { try { setVocab(loadVocab()); } catch { /* pas de vocab local dispo */ } };
    sync();
    return onVocabChange(sync);
  }, []);

  // Alertes calculées sur les sources connectées (couche d'intégration) : lues dans
  // l'instantané publié par le Studio, jamais directement à la source.
  const [integration, setIntegration] = useState<ReturnType<typeof loadCockpitSnapshot>>(null);
  useEffect(() => { const sync = () => setIntegration(loadCockpitSnapshot()); sync(); return onCockpitSnapshot(sync); }, []);
  const alerts: CatalogueAlert[] = useMemo(() => {
    const fromSources = integration ? toCockpitAlerts(integration.alerts) : [];
    if (!vocab) return fromSources;
    return [...fromSources, ...evaluateCausalRules(vocab)
      .filter(r => r.triggered)
      .map(r => causalRuleToAlert(r.rule, vocab, r)), ...resilienceAlerts(vocab)];
  }, [vocab, integration]);
  // Décluttering Cockpit (demande utilisateur) : les Situations transverses
  // ne dominent plus le haut de page — repli en un lien d'entrée d'une
  // ligne, replié par défaut, pour laisser les tuiles KPI + la grille
  // d'alertes prioritaires porter l'essentiel du Cockpit.

  const latestSnapshot = useMemo(() => {
    const snapshots = vocab?.siTables ?? [];
    return snapshots.reduce<(typeof snapshots)[number] | undefined>((latest, current) =>
      !latest || current.fetchedAt > latest.fetchedAt ? current : latest, undefined);
  }, [vocab]);
  const latestSource = latestSnapshot ? vocab?.apps.find(app => app.id === latestSnapshot.appId) : undefined;
  const liveData: LiveAlertsResponse | null = null;
  const freshnessKpi = latestSnapshot
    ? { label: "Fraîcheur données", value: relativeFreshness(latestSnapshot.fetchedAt), hint: latestSource?.label ?? "Source Studio", icon: Radio, tone: "green" as const }
    : { label: "Fraîcheur données", value: "Non connecté", hint: "aucun échantillon publié par Studio", icon: Clock, tone: "muted" as const };

  // Exposition et sites critiques dérivés des alertes réellement configurées
  // dans Studio (plus des valeurs d'exemple fixes) — un Studio vide donne
  // 0 M€ / 0 site / 0 alerte, jamais un chiffre de remplissage.
  // Vue exécutive : quatre repères utiles au décideur, pas à l'intégrateur.
  const [openDecisions, setOpenDecisions] = useState(0);
  useEffect(() => {
    const sync = () => { try { setOpenDecisions(loadSessions().filter(x => x.sector === "Supply chain" && x.step !== "suivi").length); } catch { setOpenDecisions(0); } };
    sync();
    return onSessionsChange(sync);
  }, []);
  const critical = alerts.filter(a => a.severity === "critique").length;
  const watch = alerts.length - critical;
  const ageHours = latestSnapshot ? (Date.now() - Date.parse(latestSnapshot.fetchedAt)) / 3_600_000 : undefined;
  const kpis: { label: string; value: string; hint: string; icon: typeof Wallet; tone: "accent" | "green" | "amber" | "red" | "muted" }[] = [
    { label: "Alertes critiques", value: `${critical}`, hint: critical ? "à traiter en priorité" : "aucune", icon: AlertOctagon, tone: critical ? "red" : "green" },
    { label: "À surveiller", value: `${watch}`, hint: watch ? "signaux à suivre" : "aucun", icon: AlertTriangle, tone: watch ? "amber" : "green" },
    { label: "Décisions en cours", value: `${openDecisions}`, hint: openDecisions ? "à faire avancer" : "aucune ouverte", icon: Target, tone: "accent" },
    ageHours === undefined
      ? { label: "Données", value: "Hors ligne", hint: "sources non connectées — voir le Studio", icon: Clock, tone: "muted" }
      : { label: "Données", value: relativeFreshness(latestSnapshot!.fetchedAt), hint: ageHours < 24 ? "à jour" : "à rafraîchir", icon: Radio, tone: ageHours < 24 ? "green" : "amber" },
  ];
  void freshnessKpi; void latestSource;

  // À gravité égale, l'alerte dont le délai avant rupture est le plus court passe devant.
  // Tri ordinal : gravité de la règle, puis délai avant impact lu. Jamais par montant en euros.
  const sortedAlerts = useMemo(() => [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (joursAvantImpact(a) === joursAvantImpact(b) ? 0 : joursAvantImpact(a) < joursAvantImpact(b) ? -1 : 1)), [alerts]);
  const families = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of sortedAlerts) { const f = alertFamily(a, vocab); counts.set(f, (counts.get(f) ?? 0) + 1); }
    return FAMILIES.filter(f => counts.has(f.id)).map(f => ({ ...f, count: counts.get(f.id)! }));
  }, [sortedAlerts, vocab]);
  const [family, setFamily] = useState<string>("toutes");
  const activeFamily = families.some(f => f.id === family) ? family : "toutes";
  const visibleAlerts = activeFamily === "toutes" ? sortedAlerts : sortedAlerts.filter(a => alertFamily(a, vocab) === activeFamily);

  const noData = vocab !== undefined && !latestSnapshot && alerts.length === 0;
  const status: "red" | "amber" | "green" | "muted" = vocab === undefined || noData ? "muted" : critical ? "red" : watch ? "amber" : "green";
  const headline = vocab === undefined
    ? "Lecture des données…"
    : noData
      ? "En attente de données : aucune source n’est connectée"
    : critical
      ? `Décision requise : ${critical} ${critical > 1 ? "alertes au seuil critique" : "alerte au seuil critique"}`
      : watch
        ? `${watch} ${watch > 1 ? "signaux à surveiller" : "signal à surveiller"}, aucun critique`
        : "Situation maîtrisée : aucun seuil franchi";
  const subline = vocab === undefined ? "" : noData ? "Connectez une source dans le Studio ou chargez la démo pour évaluer les règles" : critical && watch
    ? `et ${watch} ${watch > 1 ? "signaux" : "signal"} à surveiller`
    : alerts.length ? "Alertes issues des règles causales, évaluées sur les valeurs réelles" : "Toutes les règles causales sont évaluées sur les données actuelles";

  return (
    <div className="ct-cockpit">
      <section className={`ct-sitrep ct-sitrep-${status}`} aria-label="État de la situation" title={`Fraîcheur : ${latestSnapshot ? relativeFreshness(latestSnapshot.fetchedAt) : "données hors ligne"} · Source : ${latestSource?.label ?? (latestSnapshot ? "Studio" : "aucune source connectée")}${vocab && isSupplyDemo(vocab) ? " · Démonstration" : ""}`}>
        <div className="ct-sitrep-main">
          <span className="ct-sitrep-light" aria-hidden="true" />
          <div className="ct-sitrep-text">
            <p className="ct-sitrep-headline" role="status">{headline}</p>
            {subline && <span className="ct-sitrep-sub">{subline}</span>}
          </div>
        </div>
      </section>

      <section className="ct-kpis" aria-label="Indicateurs">
        {kpis.map(kpi => {
          const KpiIcon = kpi.icon;
          return (
            <div key={kpi.label} className={`ct-kpi ct-kpi-${kpi.tone}`} title={kpi.hint}>
              <div className="ct-kpi-head">
                <span className="ct-kpi-label">{kpi.label}</span>
                <span className="ct-kpi-icon"><KpiIcon size={15} /></span>
              </div>
              <span className={`ct-kpi-value${/^\d/.test(kpi.value) ? "" : " ct-kpi-value-text"}`}>{kpi.value}</span>
            </div>
          );
        })}
      </section>

      <section className="ct-alerts" aria-label="Alertes prioritaires">
        <div className="ct-alerts-head">
          <div>
            <h2><ShieldAlert size={16} /> Alertes prioritaires</h2>
            {vocab === undefined && <p className="ct-alerts-note">Chargement…</p>}
          </div>
          {families.length > 1 && (
            <div className="ct-family-filter" role="group" aria-label="Filtrer par famille">
              <button type="button" aria-pressed={activeFamily === "toutes"} onClick={() => setFamily("toutes")}>Toutes <span>{sortedAlerts.length}</span></button>
              {families.map(f => (
                <button key={f.id} type="button" aria-pressed={activeFamily === f.id} onClick={() => setFamily(f.id)}>{f.label} <span>{f.count}</span></button>
              ))}
            </div>
          )}
        </div>
        {vocab !== undefined && alerts.length === 0 && (
          <div className="ct-empty-state">
            <span className="ct-empty-icon"><ShieldCheck size={22} /></span>
            <div>
              <strong>Rien à signaler</strong>
              <p>Aucun signal ne dépasse ses seuils sur les données actuelles.</p>
              {!isSupplyDemo(vocab) && <SupplyDemoLauncher variant="cockpit" vocab={vocab} />}
            </div>
          </div>
        )}
        <div className="ct-alert-cards">
          {visibleAlerts.map((alert, index) => {
            const sev = SEVERITY_META[alert.severity];
            const fam = FAMILIES.find(f => f.id === alertFamily(alert, vocab));
            return (
              <article
                key={alert.id}
                className={`ct-alert-card ${sev.className}`}
                style={{ "--ct-i": Math.min(index, 8) } as CSSProperties}
                onMouseEnter={() => { onHoverAlert(alert); if (alert.severity === "critique") markGuideStep("alert"); }}
              >
                <div className="ct-alert-top">
                  <span className="ct-alert-pill"><i className="ct-sev-dot" aria-hidden="true" />{sev.label}</span>
                  {fam && <span className="ct-alert-family">{fam.label}</span>}
                  <button type="button" className="ct-zoom-trigger" title="Voir le détail" aria-label={`Agrandir l'alerte ${alert.label}`} onClick={() => { setZoomedAlert(alert); if (alert.severity === "critique") markGuideStep("alert"); markGuideStep("detail"); }}><Expand size={14} /></button>
                </div>
                <h4 className="ct-alert-name">{alert.label}</h4>
                <AlertCardBody alert={alert} vocab={vocab} onOpenDecision={onOpenDecision} />
              </article>
            );
          })}
        </div>
        {vocab && <DecisionJournal vocab={vocab} decisions={decisions} />}
      </section>

      {zoomedSituation && (
        <ZoomModal label={`Situation ${zoomedSituation.titre}`} onClose={() => setZoomedSituation(null)}>
          <div className="ct-zoom-large ct-situation-card">
            <header className="ct-situation-head">
              <span className="ct-situation-badge"><AlertOctagon size={20} /></span>
              <div>
                <span className="ct-situation-id">{zoomedSituation.id} · corrèle {zoomedSituation.alertesCorrelees.join(", ")}</span>
                <h3>{zoomedSituation.titre}</h3>
              </div>
            </header>
            <SituationBody situation={zoomedSituation} onOpenSituationDecision={s => { setZoomedSituation(null); onOpenSituationDecision(s); }} liveOverlay={liveOverlayForSituation(zoomedSituation.id, liveData, zoomedSituation.valeurExposeeEur)} compact />
          </div>
        </ZoomModal>
      )}

      {zoomedAlert && (
        <ZoomModal label={`Alerte ${zoomedAlert.label}`} onClose={() => setZoomedAlert(null)}>
          <AlertZoom alert={zoomedAlert} vocab={vocab} onOpenDecision={a => { setZoomedAlert(null); onOpenDecision(a); }} liveOverlay={liveOverlayForCatalogueAlert(zoomedAlert.id, liveData, zoomedAlert.expositionExempleEur)} />
        </ZoomModal>
      )}
    </div>
  );
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { critique: 0, majeure: 1, mineure: 2 };

const FAMILIES = SUPPLY_FAMILIES;

function alertKpi(alert: CatalogueAlert, vocab: ArgusVocab | undefined) {
  if (!vocab) return undefined;
  const kpiId = String(alert.grounded?.realFields.kpiId || vocab.causalRules.find(r => r.id === alert.id)?.conditions.find(c => c.kpiId)?.kpiId || GROUNDED_LIVE_FIELD[alert.id]?.kpiId || "");
  return kpiId ? vocab.kpis.find(k => k.id === kpiId) : undefined;
}

function alertFamily(alert: CatalogueAlert, vocab: ArgusVocab | undefined): string {
  return supplyFamilyOf(alert.label, alertKpi(alert, vocab)?.label);
}

type GaugeInfo = { value: number; unit: string; alerte: number; critique: number; higherIsWorse: boolean; status: "ok" | "alerte" | "critique" };

// Jauge valeur observée vs seuils — uniquement quand la valeur réelle ET les
// seuils du KPI existent ; sinon rien n'est dessiné.
function gaugeFor(alert: CatalogueAlert, vocab: ArgusVocab | undefined): GaugeInfo | undefined {
  const raw = alert.grounded?.realFields.value;
  if (typeof raw !== "number") return undefined;
  const kpi = alertKpi(alert, vocab);
  if (!kpi || !Number.isFinite(kpi.seuilAlerte) || !Number.isFinite(kpi.seuilCritique)) return undefined;
  return { value: raw, unit: kpi.unit, alerte: kpi.seuilAlerte, critique: kpi.seuilCritique, higherIsWorse: kpi.direction === "au_dessus_alerte", status: kpiStatus({ ...kpi, currentValue: raw }) };
}

function ThresholdGauge({ g }: { g: GaugeInfo }) {
  const lo = Math.min(0, g.value);
  const hi = Math.max(g.value, g.alerte, g.critique) * 1.12 || 1;
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  const [a, c] = [pct(g.alerte), pct(g.critique)];
  const zones = g.higherIsWorse
    ? [["ok", 0, a], ["warn", a, c], ["crit", c, 100]] as const
    : [["crit", 0, c], ["warn", c, a], ["ok", a, 100]] as const;
  const cmp = g.higherIsWorse ? "≥" : "≤";
  const fmt = (n: number) => n.toLocaleString("fr-FR");
  return (
    <div className={`ct-gauge ct-gauge-${g.status}`}>
      <div className="ct-gauge-track" role="img" aria-label={`Valeur ${fmt(g.value)} ${g.unit} ; seuil d'alerte ${cmp} ${fmt(g.alerte)}, seuil critique ${cmp} ${fmt(g.critique)}`}>
        {zones.map(([k, from, to]) => <span key={k} className={`ct-gauge-zone ct-gauge-${k}`} style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }} />)}
        <span className="ct-gauge-tick" style={{ left: `${a}%` }} />
        <span className="ct-gauge-tick" style={{ left: `${c}%` }} />
        <span className="ct-gauge-marker" style={{ left: `${pct(g.value)}%` }} />
      </div>
      <div className="ct-gauge-legend" aria-hidden="true">
        <span><i className="ct-gauge-key ct-gauge-warn" />Alerte {cmp} {fmt(g.alerte)}</span>
        <span><i className="ct-gauge-key ct-gauge-crit" />Critique {cmp} {fmt(g.critique)}</span>
      </div>
    </div>
  );
}

const euros = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€` : n >= 10_000 ? `${Math.round(n / 1000).toLocaleString("fr-FR")} k€` : `${Math.round(n).toLocaleString("fr-FR")} €`;
function AlertFacts({ alert, vocab }: { alert: CatalogueAlert; vocab: ArgusVocab | undefined }) {
  const observedRaw = alert.grounded?.realFields.value;
  const observed = typeof observedRaw === "number" ? observedRaw : undefined;
  const gauge = gaugeFor(alert, vocab);
  const record = alert.grounded?.realFields.record ? String(alert.grounded.realFields.record) : alert.siteLabelExemple;
  const breaches = alert.grounded?.realFields.breaches ? String(alert.grounded.realFields.breaches).split("/") : undefined;
  const entities = alert.grounded?.realFields.entities ? String(alert.grounded.realFields.entities).split(" | ") : [];
  const scope = alert.grounded?.realFields.scope ? String(alert.grounded.realFields.scope) : "";
  if (observed === undefined && !record && !breaches) return null;
  return (
    <div className="ct-facts">
      {observed !== undefined && (
        <div className="ct-exec">
          <strong className={`ct-exec-value${gauge ? ` ct-exec-${gauge.status}` : ""}`}>{observed.toLocaleString("fr-FR")}<small> {String(alert.grounded?.realFields.unit ?? "")}</small></strong>
        </div>
      )}
      {gauge && <ThresholdGauge g={gauge} />}
      {(record || breaches) && (
        <div className="ct-exec-meta">
          {record && <span className="ct-exec-record" title={breaches ? `${breaches[0]} sur ${breaches[1]} concernés` : undefined}><Target size={12} /> <span data-no-translate>{record}</span></span>}
          {!breaches && entities.length > 1 && (
            <span className="ct-exec-count" data-testid="alert-entities" title={entities.join("\n")}>
              {entities.length} entités{scope ? ` (${scope})` : ""} : {entities.slice(0, 3).map(e => e.split(" · ")[0]).join(", ")}{entities.length > 3 ? "…" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Badge discret : l'alerte vient d'un cas réglé à la main sur la démo (infobulle : ce qui a été calibré). */
function IllustrativeBadge({ note }: { note: string }) {
  return <span className="ct-illustratif" data-testid="alert-illustratif" title={note} aria-label={note} tabIndex={0}>scénario illustratif</span>;
}

function AlertCardBody({ alert, vocab, onOpenDecision }: { alert: CatalogueAlert; vocab: ArgusVocab | undefined; onOpenDecision: (alert: CatalogueAlert) => void }) {
  return (
    <>
      <AlertFacts alert={alert} vocab={vocab} />
      {alert.illustratif && <IllustrativeBadge note={alert.illustratif} />}
      <p className="ct-card-exposure" data-testid="card-exposure" title={alert.exposition ? `${alert.exposition.what} — source : ${alert.exposition.source}` : "CA à risque : donnée non fournie par le SI"}><Wallet size={12} /> {alert.expositionExempleEur > 0 ? <><b>{euros(alert.expositionExempleEur)}</b> {alert.exposition?.what ?? ""}</> : <span>CA à risque : donnée non fournie par le SI</span>}</p>
      <div className="ct-alert-foot">
        <button type="button" className="ct-primary ct-decide" title={`${alert.decisionQuestion}${alert.grounded ? ` — source : ${alert.grounded.sourceRecord}` : ""}`} onClick={() => onOpenDecision(alert)}>Décider →</button>
      </div>
    </>
  );
}

// Vue agrandie : mêmes données que la carte et que l'ancienne vue détaillée
// (faits observés, exposition, causes, règle causale, options), en 2 colonnes.
function AlertZoom({ alert, vocab, onOpenDecision, liveOverlay }: { alert: CatalogueAlert; vocab: ArgusVocab | undefined; onOpenDecision: (alert: CatalogueAlert) => void; liveOverlay?: LiveOverlay }) {
  const { decisions } = useSupplyMemory();
  const sev = SEVERITY_META[alert.severity];
  const exposition = liveOverlay?.matches ? liveOverlay.exposureEur : alert.expositionExempleEur;
  return (
    <div className={`ct-zoom-large ct-alert-zoom ${sev.className}`}>
      <header className="ct-az-head">
        <div className="ct-alert-top">
          <span className="ct-alert-pill"><i className="ct-sev-dot" aria-hidden="true" />{sev.label}</span>
          <GroundedBadge grounded={!!alert.grounded} title={alert.grounded ? alert.grounded.sourceRecord : undefined} live={liveOverlay?.matches ? { generatedAt: liveOverlay.generatedAt } : undefined} />
        </div>
        <h3>{alert.label}</h3>
        {alert.siteLabelExemple && <span className="ct-alert-site" data-no-translate>{alert.siteLabelExemple}</span>}
      </header>
      <div className="ct-az-grid">
        <section className="ct-az-col" aria-label="Faits observés">
          <h5>Faits observés</h5>
          <AlertFacts alert={alert} vocab={vocab} />
          <h5>Chaîne de causalité</h5>
          <AlertChainDiagram vocab={vocab} ruleId={alert.id} large />
          <div className="ct-alert-metric-row">
            <div className="ct-alert-metric" data-testid="alert-exposure" title={alert.exposition ? `${alert.exposition.what} — source : ${alert.exposition.source}` : "CA à risque : donnée non fournie par le SI"}><Wallet size={14} /><div>{exposition > 0
              ? <><strong>{euros(exposition)}</strong><span>{alert.exposition?.what ?? "exposition"}{liveOverlay?.matches ? " (live)" : ""}</span></>
              : <><strong>donnée non fournie par le SI</strong><span>CA à risque</span></>}</div></div>
            <div className="ct-alert-metric"><Clock size={14} /><div><strong>{alert.delaiAvantImpactExemple || "—"}</strong><span>avant impact</span></div></div>
          </div>
          {alert.illustratif && <IllustrativeBadge note={alert.illustratif} />}
          {alert.exposition && <p className="ct-exposure-src" data-testid="alert-exposure-source">Valeur lue, source : {alert.exposition.source}</p>}
          {alert.grounded && (
            <div className="ct-alert-metric"><Database size={14} /><div><strong>{alert.grounded.sourceRecord.split(" · ")[0]}</strong><span>{alert.grounded.sourceRecord.split(" · ").slice(1).join(" · ") || "source"}</span></div></div>
          )}
        </section>
        <section className="ct-az-col" aria-label="Causes et options">
          <h5>Règle causale</h5>
          {alert.causalRule.condition !== alert.causalRule.consequence
            ? <p className="ct-az-rule"><span>Si</span> {alert.causalRule.condition} <span>alors</span> {alert.causalRule.consequence}</p>
            : <p className="ct-az-rule">{alert.causalRule.consequence}</p>}
          {alert.causes.length > 0 && <>
            <h5>Causes</h5>
            <ul className="ct-az-causes">{alert.causes.map(c => <li key={c}>{c}</li>)}</ul>
          </>}
          {alert.options.length > 0 && <>
            <h5>Options</h5>
            <ul className="ct-az-options">{alert.options.map(o => <li key={o}>{o}</li>)}</ul>
          </>}
        </section>
      </div>
      <CollabPanel targetType="alerte" targetId={alert.id} label={alert.label} />
      <footer className="ct-az-foot">
        <p className="ct-exec-question">{alert.decisionQuestion}</p>
        <CommitteeExport vocab={vocab} alertId={alert.id} decisions={decisions} />
        <OpenDecisionButton onClick={() => { audit("decision.ouverture", alert.label); onOpenDecision(alert); }} />
      </footer>
    </div>
  );
}

// Corps d'une carte situation — même principe que AlertBody ci-dessus,
// factorisé entre la grille et le modal zoom. En zoom (`compact`), la vue
// est réduite à l'essentiel — décision de l'utilisateur suite au test :
// la version zoomée d'origine (tout affiché en une fois : signaux,
// périmètre, causes, options, contraintes, systèmes) était jugée "trop
// verbeuse". On garde en avant les 4 faits qu'un décideur regarde en
// premier (titre, valeur exposée, urgence, confiance) + les signaux les
// plus concrets (identifiants réels Maison Lucie) + le périmètre ; le
// reste (causes probables, options, contraintes, systèmes sources) est
// condensé sous un <details> "Voir le détail complet" plutôt que
// supprimé — aucune donnée réelle (id, montant) n'est retirée, seulement
// repositionnée.
function SituationBody({ situation, onOpenSituationDecision, liveOverlay, compact = false }: { situation: Situation; onOpenSituationDecision: (situation: Situation) => void; liveOverlay?: LiveOverlay; compact?: boolean }) {
  const valeurExposee = liveOverlay?.matches ? liveOverlay.exposureEur : situation.valeurExposeeEur;
  const urgence = liveOverlay?.matches ? liveOverlay.decisionWindowHours : situation.urgenceHeures;
  const liveBadgeProps = liveOverlay?.matches ? { generatedAt: liveOverlay.generatedAt } : undefined;
  if (!compact) {
    return (
      <>
        <GroundedBadge grounded title="Maison Lucie (SI de démonstration)" live={liveBadgeProps} />
        <div className="ct-situation-grid">
          <section>
            <h4><Radar size={13} /> Signaux observés</h4>
            <ul>{situation.signauxObserves.map(s => <li key={s}>{s}</li>)}</ul>
          </section>

          <section>
            <h4><Target size={13} /> Périmètre affecté</h4>
            <dl className="ct-situation-perimetre">
              <dt>Produits</dt><dd>{situation.perimetreAffecte.produits.join(", ")}</dd>
              <dt>Sites</dt><dd>{situation.perimetreAffecte.sites.join(", ")}</dd>
              <dt>Fournisseurs</dt><dd>{situation.perimetreAffecte.fournisseurs.join(", ")}</dd>
              {situation.perimetreAffecte.clients && <><dt>Clients</dt><dd>{situation.perimetreAffecte.clients.join(", ")}</dd></>}
            </dl>
          </section>

          <section>
            <h4><BarChart3 size={13} /> Causes probables</h4>
            <ul>{situation.causesProbables.map(c => <li key={c}>{c}</li>)}</ul>
          </section>

          <section className="ct-situation-metrics">
            <div className="ct-alert-metric">
              <Wallet size={14} />
              <div><strong>{(valeurExposee / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€</strong><span>valeur économique exposée{liveOverlay?.matches ? " (live)" : ""}</span></div>
            </div>
            <div className="ct-alert-metric">
              <Clock size={14} />
              <div><strong>{urgence} h</strong><span>urgence / horizon de décision{liveOverlay?.matches ? " (live)" : ""}</span></div>
            </div>
            <div className="ct-alert-metric">
              <ShieldCheck size={14} />
              <div><strong>{situation.niveauConfiance}</strong><span>niveau de confiance</span></div>
            </div>
          </section>

          <section>
            <h4><Layers size={13} /> Options possibles</h4>
            <ul className="ct-situation-options">
              {situation.optionsPossibles.map(o => (
                <li key={o.action}>
                  <strong>{o.action}</strong>
                  {(o.delaiEstime || o.contrainte) && (
                    <span className="ct-situation-option-meta">
                      {o.delaiEstime && <>délai estimé : {o.delaiEstime}</>}
                      {o.delaiEstime && o.contrainte && " — "}
                      {o.contrainte && <>contrainte : {o.contrainte}</>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4><ShieldAlert size={13} /> Contraintes d'exécution</h4>
            <ul>{situation.contraintesExecution.map(c => <li key={c}>{c}</li>)}</ul>
          </section>

          <section>
            <h4><Database size={13} /> Systèmes sources</h4>
            <div className="ct-rule-variables">
              {situation.sourceSystemes.map(s => <span key={s} className="ct-rule-variable-chip">{s}</span>)}
            </div>
          </section>
        </div>

        <footer className="ct-situation-footer">
          <span className="ct-situation-decideur"><Info size={12} /> Décideur responsable : <strong>{situation.decideurResponsable}</strong></span>
          <OpenDecisionButton onClick={() => onOpenSituationDecision(situation)} />
        </footer>
      </>
    );
  }

  // Vue zoomée condensée : les 2-3 signaux les plus chargés en identifiants
  // réels (SHP-xxx, PO-xxxx, SUP-xxx, scores) plutôt que la liste complète.
  const topSignaux = situation.signauxObserves.slice(0, 3);

  return (
    <>
      <GroundedBadge grounded title="Maison Lucie (SI de démonstration)" live={liveBadgeProps} />
      <section className="ct-situation-metrics ct-situation-essentiel">
        <div className="ct-alert-metric">
          <Wallet size={16} />
          <div><strong>{(valeurExposee / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€</strong><span>valeur économique exposée{liveOverlay?.matches ? " (live)" : ""}</span></div>
        </div>
        <div className="ct-alert-metric">
          <Clock size={16} />
          <div><strong>{urgence} h</strong><span>urgence / horizon de décision{liveOverlay?.matches ? " (live)" : ""}</span></div>
        </div>
        <div className="ct-alert-metric">
          <ShieldCheck size={16} />
          <div><strong>{situation.niveauConfiance}</strong><span>niveau de confiance</span></div>
        </div>
      </section>

      <section>
        <h4><Radar size={13} /> Signaux clés</h4>
        <ul>{topSignaux.map(s => <li key={s}>{s}</li>)}</ul>
      </section>

      <section>
        <h4><Target size={13} /> Périmètre affecté</h4>
        <dl className="ct-situation-perimetre">
          <dt>Produits</dt><dd>{situation.perimetreAffecte.produits.join(", ")}</dd>
          <dt>Sites</dt><dd>{situation.perimetreAffecte.sites.join(", ")}</dd>
          <dt>Fournisseurs</dt><dd>{situation.perimetreAffecte.fournisseurs.join(", ")}</dd>
          {situation.perimetreAffecte.clients && <><dt>Clients</dt><dd>{situation.perimetreAffecte.clients.join(", ")}</dd></>}
        </dl>
      </section>

      <details className="ct-situation-detail-toggle">
        <summary>Voir le détail complet (causes, options, contraintes, systèmes sources)</summary>
        <div className="ct-situation-grid">
          {situation.signauxObserves.length > topSignaux.length && (
            <section>
              <h4><Radar size={13} /> Autres signaux observés</h4>
              <ul>{situation.signauxObserves.slice(3).map(s => <li key={s}>{s}</li>)}</ul>
            </section>
          )}

          <section>
            <h4><BarChart3 size={13} /> Causes probables</h4>
            <ul>{situation.causesProbables.map(c => <li key={c}>{c}</li>)}</ul>
          </section>

          <section>
            <h4><Layers size={13} /> Options possibles</h4>
            <ul className="ct-situation-options ct-situation-options-compact">
              {situation.optionsPossibles.map(o => (
                <li key={o.action}>
                  <strong>{o.action}</strong>
                  {(o.delaiEstime || o.contrainte) && (
                    <span className="ct-situation-option-meta">
                      {o.delaiEstime && <>{o.delaiEstime}</>}
                      {o.delaiEstime && o.contrainte && " — "}
                      {o.contrainte && <>{o.contrainte}</>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4><ShieldAlert size={13} /> Contraintes d'exécution</h4>
            <ul>{situation.contraintesExecution.map(c => <li key={c}>{c}</li>)}</ul>
          </section>

          <section>
            <h4><Database size={13} /> Systèmes sources</h4>
            <div className="ct-rule-variables">
              {situation.sourceSystemes.map(s => <span key={s} className="ct-rule-variable-chip">{s}</span>)}
            </div>
          </section>
        </div>
      </details>

      <footer className="ct-situation-footer">
        <span className="ct-situation-decideur"><Info size={12} /> Décideur responsable : <strong>{situation.decideurResponsable}</strong></span>
        <OpenDecisionButton onClick={() => onOpenSituationDecision(situation)} />
      </footer>
    </>
  );
}

// Graphe Business Object → Attributs → Application → Champ physique, pour
// l'objet métier représentatif "Supplier" — reprend fidèlement les mêmes
// attributs et le même exemple SAP S/4HANA déjà établis dans MappingView
// (CANONICAL_MODEL_ROWS / SOURCE_FIELD_ROWS ci-dessous), pas une nouvelle
// donnée inventée séparément. Le "contrat sémantique" affiché dans le
// panneau de détail est illustratif (donnée documentée, pas live), sur le
// même principe d'honnêteté que le reste de MappingView.
type SupplierAttributeNode = {
  key: string;
  attribut: string;
  couleur: string;
  application: string;
  champPhysique: string;
  contract: {
    definition: string;
    businessKey: string;
    unite: string;
    source: string;
    freshness: string;
    confidence: string;
    validation: string;
  };
};

const SUPPLIER_ATTRIBUTE_NODES: SupplierAttributeNode[] = [
  {
    key: "supplierId", attribut: "supplierId", couleur: "#7c3aed", application: "SAP S/4HANA", champPhysique: "LIFNR",
    contract: { definition: "Identifiant unique du fournisseur.", businessKey: "Supplier ID", unite: "—", source: "SAP S/4HANA (Achats)", freshness: "Quotidienne", confidence: "96 %", validation: "Validé — mapping accepté" },
  },
  {
    key: "criticality", attribut: "criticality", couleur: "#ea580c", application: "SAP S/4HANA", champPhysique: "Aucun champ fiable",
    contract: { definition: "Niveau de criticité du fournisseur pour la continuité d'approvisionnement.", businessKey: "Supplier ID", unite: "Échelle qualitative", source: "SAP S/4HANA (Achats)", freshness: "—", confidence: "—", validation: "Non résolu — donnée absente de la source" },
  },
  {
    key: "plannedDeliveryDate", attribut: "plannedDeliveryDate", couleur: "#0ea5e9", application: "SAP S/4HANA", champPhysique: "EINDT",
    contract: { definition: "Date de livraison planifiée pour une ligne de commande d'achat.", businessKey: "Supplier ID + Purchase Order ID", unite: "Date", source: "SAP S/4HANA (Achats)", freshness: "Quotidienne", confidence: "91 %", validation: "Validé — mapping accepté" },
  },
  {
    key: "actualDeliveryDate", attribut: "actualDeliveryDate", couleur: "#16a34a", application: "SAP S/4HANA", champPhysique: "ELIKZ",
    contract: { definition: "Date de livraison réelle constatée à réception.", businessKey: "Supplier ID + Purchase Order ID", unite: "Date", source: "SAP S/4HANA (Achats)", freshness: "Quotidienne", confidence: "87 %", validation: "Validé — mapping accepté" },
  },
  {
    key: "deliveryDelay", attribut: "deliveryDelay", couleur: "#d946ef", application: "SAP S/4HANA", champPhysique: "WEMNG (calculé)",
    contract: { definition: "Délai réel moins délai promis, en jours — calculé, pas un champ source direct.", businessKey: "Supplier ID + Purchase Order ID", unite: "jours", source: "SAP S/4HANA (Achats)", freshness: "Quotidienne", confidence: "87 %", validation: "Validé — mapping accepté" },
  },
];

// Alertes associées à chaque attribut Supplier — dérivées des `variables`
// déjà déclarées dans ALERT_CATALOGUE (alert-catalogue.ts), pas une
// association inventée séparément : deliveryDelay/plannedDeliveryDate/
// actualDeliveryDate se lisent dans les variables de S1 ("Probabilité de
// retard fournisseur") et de S5 ("Taux OTIF fournisseur" — l'OTIF se
// dégrade par les retards de livraison) ; criticality se lit dans les
// variables de S1 ("Criticité du composant") et de S9 (le risque
// géopolitique/pays s'évalue notamment via la criticité du flux/fournisseur
// concerné) ; supplierId est un identifiant pur, sans variable causale
// associée dans le catalogue.
const SUPPLIER_ATTRIBUTE_ALERTS: Record<string, string[]> = {
  supplierId: [],
  criticality: ["S1", "S9"],
  plannedDeliveryDate: ["S1", "S5"],
  actualDeliveryDate: ["S1", "S5"],
  deliveryDelay: ["S1", "S5"],
};

// Édition en session de l'ontologie (illustratif, cf. bandeau honnêteté) :
// les changements faits dans le panneau "Contrat sémantique" ou dans la
// table de référence sont conservés en sessionStorage, scoped au shell SCRA,
// pour survivre à une navigation entre pages sans persister au-delà de la
// session du navigateur.
// `attributes` : édition des champs du "Contrat sémantique" + du nom
// (`attribut`) + de l'application source (`application`, choisie parmi
// SOURCE_CARDS) pour un attribut existant (par défaut ou ajouté).
// `customAttributes` : attributs ajoutés par l'utilisateur, par objet métier
// (clé = nom de l'objet, ex. "Fournisseur"), en plus des 5 attributs de base.
// `hiddenAttributes` : clés d'attributs masqués dans le graphe, par objet
// métier — pilote la checklist "Attributs à afficher" ET le petit bouton de
// suppression par nœud (masquer = même mécanisme, cf. commentaire sur
// SupplierRichGraph).
type OntologyEdits = {
  attributes: Record<string, Partial<SupplierAttributeNode["contract"]> & { attribut?: string; application?: string }>;
  families: Record<string, { objetsMinimaux?: string[]; alertesAlimentees?: string[] }>;
  customAttributes: Record<string, SupplierAttributeNode[]>;
  hiddenAttributes: Record<string, string[]>;
};
const ONTOLOGY_EDITS_KEY = "ct-ontologie-edits-v1";
function loadOntologyEdits(): OntologyEdits {
  try {
    const raw = sessionStorage.getItem(ONTOLOGY_EDITS_KEY);
    if (raw) return { attributes: {}, families: {}, customAttributes: {}, hiddenAttributes: {}, ...JSON.parse(raw) };
  } catch { /* sessionStorage indisponible — on repart d'un état vide */ }
  return { attributes: {}, families: {}, customAttributes: {}, hiddenAttributes: {} };
}
function saveOntologyEdits(edits: OntologyEdits) {
  try { sessionStorage.setItem(ONTOLOGY_EDITS_KEY, JSON.stringify(edits)); } catch { /* ignoré */ }
}

// Champ texte éditable en ligne — même pattern réutilisé pour le panneau
// "Contrat sémantique" et pour les cellules de la table de référence :
// affichage en lecture, clic → input, Entrée/blur → sauvegarde, Échap →
// annule. Pas de modale.
function InlineEditableText({ value, onChange, multiline }: { value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button type="button" className="ct-inline-editable" onClick={() => { setDraft(value); setEditing(true); }} title="Cliquer pour modifier">
        <span>{value || <em>—</em>}</span>
        <Pencil size={10} className="ct-inline-editable-icon" />
      </button>
    );
  }
  const commit = () => { setEditing(false); if (draft !== value) onChange(draft); };
  const Field = multiline ? "textarea" : "input";
  return (
    <Field
      autoFocus
      className="ct-inline-editable-input"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter" && !multiline) { commit(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
    />
  );
}

// Tous les objets métier sélectionnables, à travers toutes les familles du
// catalogue Supply Chain — utilisé par le sélecteur global/scoped de la vue
// Ontologie. `richExample` : seul "Fournisseur"/"Supplier" bénéficie
// aujourd'hui du graphe détaillé Attribut→Application→Champ (repris de
// MappingView) ; les autres objets n'ont, dans le catalogue fourni, que leur
// rattachement famille + alertes, affiché en version simplifiée honnête.
type BusinessObjectRef = { name: string; famille: string; richExample: boolean };
const ALL_BUSINESS_OBJECTS: BusinessObjectRef[] = ONTOLOGY_CATALOGUE["supply-chain"].flatMap(f =>
  f.objetsMinimaux.map(o => ({ name: o, famille: f.famille, richExample: o === "Fournisseur" }))
);

// Insère des points d'insécabilité de mot (zero-width space) avant chaque
// majuscule d'un nom camelCase, pour que le retour à la ligne d'un attribut
// long ("actualDeliveryDate") se fasse proprement entre "mots" plutôt qu'au
// milieu d'un mot ("actualD" / "elivery" / "Date") — combiné avec des
// boîtes assez larges et `overflow-wrap:normal` en CSS.
function splitCamelCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1​$2");
}

function textMatches(query: string, ...fields: string[]): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return fields.some(f => f.toLowerCase().includes(q));
}

// Géométrie des connecteurs — mesurée sur les nœuds RÉELLEMENT rendus (via
// des refs + ResizeObserver), pas déduite d'une hauteur de ligne supposée.
// Certains nœuds (ex. "Aucun champ fiable") passent sur deux lignes et ont
// donc une hauteur différente des autres : les arêtes doivent partir/
// arriver exactement au centre vertical de la boîte réelle de chaque nœud,
// quelle que soit sa hauteur.
type OntologyGeometry = { height: number; objectY: number; attrY: number[]; appY: number[]; fieldY: number[] };
const EMPTY_GEOMETRY: OntologyGeometry = { height: 0, objectY: 0, attrY: [], appY: [], fieldY: [] };

// Pont Ontologie ↔ Mapping/Correspondances (Studio) — début d'unification
// demandée par l'utilisateur : au lieu de laisser le graphe Ontologie
// dépendre UNIQUEMENT de son édition en session (OntologyEdits, ci-dessus),
// on cherche d'abord si un branchement RÉEL existe côté Studio (vocabulaire Studio.
// entityMappings, posé via "Poser des candidats" dans OntologyMappingSection
// — cockpit.connecteurs.tsx). Match par NOM (l'objet "Fournisseur"/"Supplier"
// et le nom d'attribut, insensible à la casse) car les deux systèmes n'ont
// pas d'identifiant partagé aujourd'hui — voir note dans le rapport de session
// : une unification complète demanderait de définir "Fournisseur" comme
// BusinessEntity avec ces 5 attributs canoniques dans vocabulaire Studio.entities
// (aujourd'hui les entités du pack Maison Lucie n'en déclarent aucune), ce
// qui dépasse le périmètre sûr de cette session. Ce lookup est donc déjà
// câblé et prioritaire dès qu'un tel branchement existera, mais ne trouve
// rien à afficher tant que cette entité n'est pas modélisée côté Studio —
// repli intact sur OntologyEdits/valeurs illustratives par défaut.
function useRealAttributeMappingLookup(entityNames: string[]) {
  // État initial toujours `undefined`, identique au rendu serveur (qui n'a pas
  // accès à localStorage) — lire le vocab dans l'initialiseur de useState
  // provoquait un mismatch d'hydratation (le premier rendu client, avant tout
  // effet, lisait déjà localStorage alors que le serveur ne le pouvait pas).
  // Le vrai vocab n'est chargé qu'après montage, via l'effet ci-dessous.
  const [vocab, setVocab] = useState<ArgusVocab | undefined>(undefined);
  useEffect(() => {
    const sync = () => { try { setVocab(loadVocab()); } catch { /* pas de vocab local dispo */ } };
    sync();
    return onVocabChange(sync);
  }, []);
  return useMemo(() => {
    const map = new Map<string, { appLabel: string; fieldName: string }>();
    if (!vocab?.entities?.length || !vocab.entityMappings?.length) return map;
    const normalize = (s: string) => s.trim().toLowerCase();
    const wantedEntities = new Set(entityNames.map(normalize));
    for (const entity of vocab.entities) {
      if (!wantedEntities.has(normalize(entity.name))) continue;
      for (const attr of entity.attributes) {
        const links = vocab.entityMappings.filter(l => l.entityId === entity.id && l.attributeId === attr.id);
        const master = links.find(l => l.isMaster) ?? links[0];
        if (!master) continue;
        const app = vocab.apps.find(a => a.id === master.appId);
        const field = vocab.fields.find(f => f.id === master.fieldId);
        if (!app || !field) continue;
        map.set(normalize(attr.name), { appLabel: app.label, fieldName: field.name });
      }
    }
    return map;
  }, [vocab, entityNames]);
}

// Graphe riche Objet→Attributs→Application→Champ, réservé à Fournisseur
// (Supplier) — seul objet pour lequel un exemple SAP S/4HANA détaillé est
// documenté (voir MappingView). `edits`/`onEditAttribute` permettent
// d'éditer le contrat sémantique de l'attribut sélectionné ; `query` pilote
// le surlignage recherche ; `showAlerts` affiche ou masque le badge
// d'alertes par attribut.
function SupplierRichGraph({
  edits, onEditAttribute, onRenameAttribute, onChangeApplication, onAddAttribute, onRemoveAttribute, query, showAlerts,
}: {
  edits: OntologyEdits;
  onEditAttribute: (key: string, field: keyof SupplierAttributeNode["contract"], value: string) => void;
  onRenameAttribute: (key: string, value: string) => void;
  onChangeApplication: (key: string, sourceCardId: string) => void;
  onAddAttribute: () => void;
  onRemoveAttribute: (key: string) => void;
  query: string;
  showAlerts: boolean;
}) {
  // Attributs de base + attributs ajoutés par l'utilisateur pour cet objet
  // ("Fournisseur"), moins ceux masqués via la checklist "Attributs à
  // afficher" (même mécanisme que le petit bouton de suppression par nœud —
  // cf. commentaire sur OntologyEdits.hiddenAttributes). Le nombre de lignes
  // du graphe est donc variable, pas figé à 5.
  const custom = edits.customAttributes["Fournisseur"] ?? [];
  const hidden = new Set(edits.hiddenAttributes["Fournisseur"] ?? []);
  const realMappings = useRealAttributeMappingLookup(["Fournisseur", "Supplier"]);
  const nodes = [...SUPPLIER_ATTRIBUTE_NODES, ...custom]
    .filter(n => !hidden.has(n.key))
    .map(n => {
      const e = edits.attributes[n.key];
      const real = realMappings.get((e?.attribut ?? n.attribut).trim().toLowerCase());
      if (real) {
        // Mapping confirmé côté Studio (Correspondances) — source de vérité,
        // prioritaire sur l'édition illustrative en session.
        return {
          ...n,
          attribut: e?.attribut ?? n.attribut,
          application: real.appLabel,
          champPhysique: real.fieldName,
          contract: { ...n.contract, ...e, source: real.appLabel, validation: "Validé — mapping confirmé (Correspondances)" },
        };
      }
      return { ...n, attribut: e?.attribut ?? n.attribut, application: e?.application ?? n.application, contract: { ...n.contract, ...e } };
    });
  const [selectedKey, setSelectedKey] = useState<string>(nodes[0]?.key ?? "");
  const selected = nodes.find(n => n.key === selectedKey) ?? nodes[0];

  const graphRef = useRef<HTMLDivElement>(null);
  const objectCardRef = useRef<HTMLDivElement>(null);
  const attrNodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const appNodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fieldNodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Les tableaux de refs sont ré-initialisés à chaque rendu (avant d'être
  // repeuplés par les callback refs ci-dessous) : le nombre de nœuds varie
  // désormais (ajout/suppression/masquage d'attributs), donc on ne peut pas
  // compter sur d'anciennes entrées d'un rendu précédent avec plus de lignes
  // pour disparaître toutes seules à temps pour la mesure suivante.
  attrNodeRefs.current = [];
  appNodeRefs.current = [];
  fieldNodeRefs.current = [];
  const [geometry, setGeometry] = useState<OntologyGeometry>(EMPTY_GEOMETRY);

  useLayoutEffect(() => {
    const measure = () => {
      const container = graphRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const centerOf = (el: Element | null): number => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return (r.top - containerRect.top) + r.height / 2;
      };
      setGeometry({
        height: containerRect.height,
        objectY: centerOf(objectCardRef.current),
        attrY: attrNodeRefs.current.map(centerOf),
        appY: appNodeRefs.current.map(centerOf),
        fieldY: fieldNodeRefs.current.map(centerOf),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (graphRef.current) ro.observe(graphRef.current);
    ([objectCardRef.current, ...attrNodeRefs.current, ...appNodeRefs.current, ...fieldNodeRefs.current] as (HTMLElement | null)[])
      .forEach(el => { if (el) ro.observe(el); });
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [nodes.length]);

  const svgH = geometry.height || 1;
  const ready = geometry.attrY.length === nodes.length && nodes.length > 0;
  const objectMatches = textMatches(query, "Fournisseur", "Supplier");

  if (nodes.length === 0 || !selected) {
    return (
      <div className="ct-ontology-graph-empty">
        <p className="ct-page-note">Tous les attributs de cet objet sont masqués — cochez-en au moins un dans « Attributs à afficher », ou <button type="button" className="ct-inline-link" onClick={onAddAttribute}>ajoutez-en un nouveau</button>.</p>
      </div>
    );
  }

  return (
    <div className="ct-ontology-graph" ref={graphRef}>
      <div className="ct-ontology-col ct-ontology-object">
        <div className={`ct-ontology-object-card ${objectMatches && query.trim() ? "ct-search-match" : ""}`} ref={objectCardRef}>
          <span className="ct-ontology-object-chip"><Boxes size={16} /></span>
          <strong>Supplier</strong>
          <span>Objet métier — Famille Réseau</span>
        </div>
        <button type="button" className="ct-ontology-add-attr" onClick={onAddAttribute}>
          <Plus size={12} /> Ajouter un attribut
        </button>
      </div>

      <svg className="ct-ontology-connectors" viewBox={`0 0 80 ${svgH}`} width="80" height={svgH} preserveAspectRatio="none" aria-hidden="true">
        {ready && nodes.map((n, i) => {
          const y = geometry.attrY[i];
          const midY = geometry.objectY;
          return <path key={n.key} d={`M0,${midY} C30,${midY} 40,${y} 80,${y}`} stroke={n.couleur} strokeWidth={selectedKey === n.key ? 2.4 : 1.4} fill="none" opacity={selectedKey === n.key ? 0.9 : 0.35} />;
        })}
      </svg>

      <div className="ct-ontology-col">
        {nodes.map((n, i) => {
          const matches = query.trim() && textMatches(query, n.attribut);
          const alertIds = SUPPLIER_ATTRIBUTE_ALERTS[n.key] ?? [];
          return (
            <div key={n.key} className="ct-ontology-node-wrap" ref={el => { attrNodeRefs.current[i] = el as unknown as HTMLButtonElement | null; }}>
              <button type="button" className={`ct-ontology-node ${selectedKey === n.key ? "selected" : ""} ${matches ? "ct-search-match" : query.trim() ? "ct-search-dim" : ""}`} style={{ "--node-color": n.couleur } as CSSProperties} onClick={() => setSelectedKey(n.key)}>
                <span className="ct-ontology-node-dot" />
                <strong>{splitCamelCase(n.attribut)}</strong>

                {showAlerts && (
                  <span className="ct-ontology-attr-alerts">
                    {alertIds.length > 0
                      ? alertIds.map(id => <span key={id} className="ct-ontology-attr-alert-chip">{id}</span>)
                      : <span className="ct-ontology-attr-alert-chip ct-ontology-attr-alert-none">aucune</span>}
                  </span>
                )}
              </button>
              <button type="button" className="ct-ontology-node-remove" title="Masquer cet attribut du graphe" aria-label={`Retirer ${n.attribut} du graphe`} onClick={() => onRemoveAttribute(n.key)}>
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      <svg className="ct-ontology-connectors" viewBox={`0 0 80 ${svgH}`} width="80" height={svgH} preserveAspectRatio="none" aria-hidden="true">
        {ready && nodes.map((n, i) => {
          const y1 = geometry.attrY[i];
          const y2 = geometry.appY[i];
          return <path key={n.key} d={`M0,${y1} C30,${y1} 50,${y2} 80,${y2}`} stroke={n.couleur} strokeWidth={selectedKey === n.key ? 2.4 : 1.4} fill="none" opacity={selectedKey === n.key ? 0.9 : 0.35} />;
        })}
      </svg>

      <div className="ct-ontology-col">
        {nodes.map((n, i) => (
          <div key={n.key} ref={el => { appNodeRefs.current[i] = el; }} className={`ct-ontology-node ct-ontology-node-app ${selectedKey === n.key ? "selected" : ""}`} style={{ "--node-color": n.couleur } as CSSProperties}>
            <span className="ct-ontology-node-dot" />
            <AppPicker application={n.application} onChange={id => onChangeApplication(n.key, id)} />
          </div>
        ))}
      </div>

      <svg className="ct-ontology-connectors" viewBox={`0 0 80 ${svgH}`} width="80" height={svgH} preserveAspectRatio="none" aria-hidden="true">
        {ready && nodes.map((n, i) => {
          const y1 = geometry.appY[i];
          const y2 = geometry.fieldY[i];
          return <path key={n.key} d={`M0,${y1} C30,${y1} 50,${y2} 80,${y2}`} stroke={n.couleur} strokeWidth={selectedKey === n.key ? 2.4 : 1.4} fill="none" opacity={selectedKey === n.key ? 0.9 : 0.35} />;
        })}
      </svg>

      <div className="ct-ontology-col">
        {nodes.map((n, i) => (
          <div key={n.key} ref={el => { fieldNodeRefs.current[i] = el; }} className={`ct-ontology-node ct-ontology-node-field ${selectedKey === n.key ? "selected" : ""}`} style={{ "--node-color": n.couleur } as CSSProperties}>
            <span className="ct-ontology-node-dot" />
            <strong title="Champ physique">{n.champPhysique}</strong>
          </div>
        ))}
      </div>

      <aside className="ct-ontology-detail">
        <header title="Cliquer un champ pour l'éditer">Contrat sémantique — {selected.attribut}</header>
        <dl>
          <dt>Nom de l'attribut</dt><dd><InlineEditableText value={selected.attribut} onChange={v => onRenameAttribute(selected.key, v)} /></dd>
          <dt>Définition</dt><dd><InlineEditableText value={selected.contract.definition} onChange={v => onEditAttribute(selected.key, "definition", v)} multiline /></dd>
          <dt>Clé métier</dt><dd><InlineEditableText value={selected.contract.businessKey} onChange={v => onEditAttribute(selected.key, "businessKey", v)} /></dd>
          <dt>Unité</dt><dd><InlineEditableText value={selected.contract.unite} onChange={v => onEditAttribute(selected.key, "unite", v)} /></dd>
          <dt>Source</dt><dd><InlineEditableText value={selected.contract.source} onChange={v => onEditAttribute(selected.key, "source", v)} /></dd>
          <dt>Champ</dt><dd>{selected.champPhysique}</dd>
          <dt>Fraîcheur</dt><dd><InlineEditableText value={selected.contract.freshness} onChange={v => onEditAttribute(selected.key, "freshness", v)} /></dd>
          <dt>Confiance</dt><dd><InlineEditableText value={selected.contract.confidence} onChange={v => onEditAttribute(selected.key, "confidence", v)} /></dd>
          <dt>Statut de validation</dt><dd><InlineEditableText value={selected.contract.validation} onChange={v => onEditAttribute(selected.key, "validation", v)} /></dd>
          {showAlerts && (
            <>
              <dt>Alertes associées</dt>
              <dd>
                {(SUPPLIER_ATTRIBUTE_ALERTS[selected.key] ?? []).length > 0
                  ? (SUPPLIER_ATTRIBUTE_ALERTS[selected.key] ?? []).join(", ")
                  : "Aucune — identifiant, sans variable causale associée dans le catalogue."}
              </dd>
            </>
          )}
        </dl>
      </aside>
    </div>
  );
}

// Version simplifiée du graphe, pour tout objet métier du catalogue AUTRE
// que Fournisseur : honnête sur le fait qu'il n'existe pas d'exemple
// applicatif/champ documenté pour ces objets — seulement leur rattachement
// à une famille et les alertes qu'elle alimente.
function SimpleObjectGraph({ object, query }: { object: BusinessObjectRef; query: string }) {
  const family = ONTOLOGY_CATALOGUE["supply-chain"].find(f => f.famille === object.famille);
  const matches = query.trim() && textMatches(query, object.name, object.famille, ...(family?.alertesAlimentees ?? []));
  return (
    <div className={`ct-ontology-simple-card ${matches ? "ct-search-match" : query.trim() ? "ct-search-dim" : ""}`}>
      <div className="ct-ontology-simple-head">
        <span className="ct-ontology-object-chip ct-ontology-object-chip-small"><Boxes size={14} /></span>
        <div>
          <strong>{object.name}</strong>
          <span className="ct-ontology-node-sub">Objet métier — Famille {object.famille}</span>
        </div>
      </div>
      <p className="ct-page-note ct-honest ct-ontology-simple-note"><Info size={11} /> Pas d'exemple applicatif détaillé documenté pour cet objet (seul Fournisseur/Supplier en a un) — rattachement famille uniquement.</p>
      <div className="ct-ontology-simple-alerts">
        <span className="ct-ontology-node-sub">Alertes alimentées par la famille :</span>
        <div className="ct-rule-variables">
          {(family?.alertesAlimentees ?? []).map(a => <span key={a} className="ct-rule-variable-chip">{a}</span>)}
        </div>
      </div>
    </div>
  );
}

// Vue d'ensemble globale : toutes les familles avec leurs objets et le
// nombre d'alertes qu'elles alimentent — préférée à un graphe unique de
// tous les objets, illisible à cette échelle.
function GlobalOverview({ query }: { query: string }) {
  return (
    <div className="ct-ontology-global-grid">
      {ONTOLOGY_CATALOGUE["supply-chain"].map(f => {
        const famMatches = query.trim() && textMatches(query, f.famille);
        return (
          <article key={f.famille} className={`ct-ontology-global-card ${famMatches ? "ct-search-match" : ""}`}>
            <header>
              <strong>{f.famille}</strong>
              <span className="ct-ontology-alert-count">{f.alertesAlimentees.length} alerte{f.alertesAlimentees.length > 1 ? "s" : ""}</span>
            </header>
            <div className="ct-ontology-global-objects">
              {f.objetsMinimaux.map(o => {
                const objMatches = query.trim() && textMatches(query, o);
                return <span key={o} className={`ct-ontology-object-pill ${objMatches ? "ct-search-match" : query.trim() ? "ct-search-dim" : ""}`}>{o}</span>;
              })}
            </div>
            <div className="ct-rule-variables">
              {f.alertesAlimentees.map(a => {
                const alertMatches = query.trim() && textMatches(query, a);
                return <span key={a} className={`ct-rule-variable-chip ${alertMatches ? "ct-search-match" : ""}`}>{a}</span>;
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function OntologieView({ onBridgeChange }: { onBridgeChange: (b: OntologyConfigBridge | null) => void }) {
  const [edits, setEdits] = useState<OntologyEdits>(() => loadOntologyEdits());
  const [selectedObjects, setSelectedObjects] = useState<string[]>(["Fournisseur"]);
  const [query, setQuery] = useState("");
  const [showAlerts, setShowAlerts] = useState(true);
  const [objectPickerOpen, setObjectPickerOpen] = useState(false);
  const [attrPickerOpen, setAttrPickerOpen] = useState(false);

  const updateEdits = (next: OntologyEdits) => { setEdits(next); saveOntologyEdits(next); };
  const onEditAttribute = (key: string, field: keyof SupplierAttributeNode["contract"], value: string) => {
    updateEdits({ ...edits, attributes: { ...edits.attributes, [key]: { ...edits.attributes[key], [field]: value } } });
  };
  const onEditFamily = (famille: string, field: "objetsMinimaux" | "alertesAlimentees", value: string) => {
    const list = value.split(",").map(s => s.trim()).filter(Boolean);
    updateEdits({ ...edits, families: { ...edits.families, [famille]: { ...edits.families[famille], [field]: list } } });
  };
  const onRenameAttribute = (key: string, value: string) => {
    updateEdits({ ...edits, attributes: { ...edits.attributes, [key]: { ...edits.attributes[key], attribut: value } } });
  };
  // Choix d'application — repris directement de SOURCE_CARDS (pas de
  // duplication de la liste des sources) : on met à jour à la fois
  // `application` (affiché dans le nœud du graphe) et `contract.source`
  // (affiché dans le panneau "Contrat sémantique"), reste ensuite librement
  // éditable comme les autres champs du contrat.
  const onChangeApplication = (key: string, sourceCardId: string) => {
    const card = SOURCE_CARDS.find(s => s.id === sourceCardId);
    if (!card) return;
    updateEdits({ ...edits, attributes: { ...edits.attributes, [key]: { ...edits.attributes[key], application: card.nom, source: card.nom } } });
  };
  const onAddAttributeTo = (objectName: string, preset?: Partial<SupplierAttributeNode> & { attribut?: string; applicationNom?: string }) => {
    const key = `custom-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const attribut = preset?.attribut?.trim() || "nouvelAttribut";
    const applicationNom = preset?.applicationNom || SOURCE_CARDS[0].nom;
    const newNode: SupplierAttributeNode = {
      key,
      attribut,
      couleur: "#64748b",
      application: applicationNom,
      champPhysique: preset?.champPhysique || "À définir",
      contract: {
        definition: "Attribut ajouté — à documenter.",
        businessKey: "—",
        unite: "—",
        source: applicationNom,
        freshness: "—",
        confidence: "—",
        validation: "Non validé — ajouté manuellement",
      },
    };
    const existing = edits.customAttributes[objectName] ?? [];
    updateEdits({ ...edits, customAttributes: { ...edits.customAttributes, [objectName]: [...existing, newNode] } });
    return key;
  };
  const onAddAttribute = () => onAddAttributeTo("Fournisseur");
  // "Retirer" un attribut du graphe = le masquer (checklist "Attributs à
  // afficher" et petit bouton "×" par nœud pilotent le même ensemble) —
  // c'est réversible, donc pas de perte de données pour les 5 attributs de
  // base ni pour un attribut ajouté par erreur.
  const onHideAttribute = (objectName: string, key: string) => {
    const current = edits.hiddenAttributes[objectName] ?? [];
    if (current.includes(key)) return;
    updateEdits({ ...edits, hiddenAttributes: { ...edits.hiddenAttributes, [objectName]: [...current, key] } });
  };
  const onShowAttribute = (objectName: string, key: string) => {
    const current = edits.hiddenAttributes[objectName] ?? [];
    updateEdits({ ...edits, hiddenAttributes: { ...edits.hiddenAttributes, [objectName]: current.filter(k => k !== key) } });
  };
  const onToggleAttributeVisible = (objectName: string, key: string, visible: boolean) => {
    if (visible) onShowAttribute(objectName, key); else onHideAttribute(objectName, key);
  };
  // Applique une suggestion du Copilote de configuration : ajoute un
  // attribut avec son application/son champ deviné, comme un ajout manuel —
  // rien n'est jamais appliqué automatiquement sans ce clic explicite.
  const onAcceptSuggestion = (objectName: string, s: { attribut: string; applicationNom: string; champGuess: string }) => {
    onAddAttributeTo(objectName, { attribut: s.attribut, applicationNom: s.applicationNom, champPhysique: s.champGuess });
  };

  // Publie le contexte "objet actuellement affiché" vers le Copilote de
  // configuration (rendu au niveau du shell) — uniquement quand Fournisseur
  // (seul objet avec un graphe riche éditable aujourd'hui) est parmi les
  // objets sélectionnés.
  useEffect(() => {
    if (!selectedObjects.includes("Fournisseur")) { onBridgeChange(null); return; }
    const existing = [...SUPPLIER_ATTRIBUTE_NODES, ...(edits.customAttributes["Fournisseur"] ?? [])].map(n => edits.attributes[n.key]?.attribut ?? n.attribut);
    onBridgeChange({
      objectName: "Fournisseur",
      existingAttributes: existing,
      sourceCards: SOURCE_CARDS.map(s => ({ id: s.id, nom: s.nom, type: s.type })),
      onAccept: (s: OntologySuggestion) => {
        const card = SOURCE_CARDS.find(c => c.id === s.applicationId);
        onAcceptSuggestion("Fournisseur", { attribut: s.attribut, applicationNom: card?.nom ?? SOURCE_CARDS[0].nom, champGuess: s.champGuess });
      },
    });
    return () => onBridgeChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObjects.join(","), edits]);

  const familiesWithEdits = ONTOLOGY_CATALOGUE["supply-chain"].map(f => ({
    ...f,
    objetsMinimaux: edits.families[f.famille]?.objetsMinimaux ?? f.objetsMinimaux,
    alertesAlimentees: edits.families[f.famille]?.alertesAlimentees ?? f.alertesAlimentees,
  }));

  const toggleObject = (name: string) => {
    setSelectedObjects(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const isGlobal = selectedObjects.length === 0;

  return (
    <div className="ct-page ct-page-wide">
      <PageHeader eyebrow="ONTOLOGIE SUPPLY CHAIN" icon={Radar} title={isGlobal ? "Vue globale de l'ontologie" : `Business object${selectedObjects.length > 1 ? "s" : ""} : ${selectedObjects.join(", ")}`} />

      <div className="ct-ontology-toolbar">
        <label className="ct-ontology-search">
          <Search size={13} />
          <input type="text" placeholder="Rechercher un objet, un attribut, une famille, une alerte…" value={query} onChange={e => setQuery(e.target.value)} />
        </label>

        <div className="ct-ontology-object-picker">
          <button type="button" className="ct-secondary" onClick={() => setObjectPickerOpen(v => !v)}>
            <Layers size={13} /> {isGlobal ? "Vue globale" : `${selectedObjects.length} objet(s) sélectionné(s)`}
          </button>
          {objectPickerOpen && (
            <div className="ct-ontology-object-picker-panel">
              <button type="button" className={`ct-ontology-object-picker-option ${isGlobal ? "selected" : ""}`} onClick={() => setSelectedObjects([])}>
                Vue globale (toutes familles)
              </button>
              {ONTOLOGY_CATALOGUE["supply-chain"].map(f => (
                <div key={f.famille} className="ct-ontology-object-picker-group">
                  <span className="ct-ontology-object-picker-famille">{f.famille}</span>
                  {f.objetsMinimaux.map(o => (
                    <label key={o} className="ct-ontology-object-picker-option">
                      <input type="checkbox" checked={selectedObjects.includes(o)} onChange={() => toggleObject(o)} />
                      {o}{o === "Fournisseur" ? " ★" : ""}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="ct-ontology-alert-toggle">
          <input type="checkbox" checked={showAlerts} onChange={e => setShowAlerts(e.target.checked)} />
          <Tag size={12} /> Afficher les alertes par attribut
        </label>

        {selectedObjects.includes("Fournisseur") && (
          <div className="ct-ontology-object-picker">
            <button type="button" className="ct-secondary" onClick={() => setAttrPickerOpen(v => !v)}>
              <Layers size={13} /> Attributs à afficher
            </button>
            {attrPickerOpen && (
              <div className="ct-ontology-object-picker-panel">
                {[...SUPPLIER_ATTRIBUTE_NODES, ...(edits.customAttributes["Fournisseur"] ?? [])].map(n => {
                  const name = edits.attributes[n.key]?.attribut ?? n.attribut;
                  const visible = !(edits.hiddenAttributes["Fournisseur"] ?? []).includes(n.key);
                  return (
                    <label key={n.key} className="ct-ontology-object-picker-option">
                      <input type="checkbox" checked={visible} onChange={e => onToggleAttributeVisible("Fournisseur", n.key, e.target.checked)} />
                      {name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {isGlobal ? (
        <GlobalOverview query={query} />
      ) : (
        <div className="ct-ontology-multi-graph">
          {selectedObjects.map(name => {
            const ref = ALL_BUSINESS_OBJECTS.find(o => o.name === name);
            if (!ref) return null;
            return ref.richExample
              ? (
                <SupplierRichGraph
                  key={name}
                  edits={edits}
                  onEditAttribute={onEditAttribute}
                  onRenameAttribute={onRenameAttribute}
                  onChangeApplication={onChangeApplication}
                  onAddAttribute={onAddAttribute}
                  onRemoveAttribute={key => onHideAttribute("Fournisseur", key)}
                  query={query}
                  showAlerts={showAlerts}
                />
              )
              : <SimpleObjectGraph key={name} object={ref} query={query} />;
          })}
        </div>
      )}

      <h3 title="Édition en session, cliquer une cellule pour la modifier — pas encore reliée à un connecteur réel.">Familles ontologiques</h3>
      <table className="ct-table">
        <thead><tr><th>Famille</th><th>Objets minimaux</th><th>Alertes alimentées</th></tr></thead>
        <tbody>
          {familiesWithEdits.map(f => {
            const famMatches = query.trim() && textMatches(query, f.famille, f.objetsMinimaux.join(" "), f.alertesAlimentees.join(" "));
            return (
              <tr key={f.famille} className={famMatches ? "ct-search-match" : query.trim() ? "ct-search-dim" : ""}>
                <td>{f.famille}</td>
                <td><InlineEditableText value={f.objetsMinimaux.join(", ")} onChange={v => onEditFamily(f.famille, "objetsMinimaux", v)} /></td>
                <td><InlineEditableText value={f.alertesAlimentees.join(", ")} onChange={v => onEditFamily(f.famille, "alertesAlimentees", v)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Grille "Connecter une source" — inspirée d'une maquette utilisateur
// (grille de cartes cliquables + assistant à droite), adaptée au registre
// visuel violet/lavande déjà en place. Purement illustratif : sélectionner
// une carte affiche l'assistant Connexion → Permissions → Test, sans
// connexion réelle établie (voir bandeau honnêteté ci-dessous).
export type SourceCard = { id: string; nom: string; type: string; icon: typeof Database; marketReference?: string };
// Les 6 premières cartes (isMaisonLucie: true, via marketReference)
// correspondent aux 6 applications RÉELLES du SI de démonstration Maison
// Lumen (github.com/mambayelo-lab/maison-lucie-si, lib/demo-data.js) — le
// SI de référence pour l'agent Supply Chain Resilience. Les cartes
// suivantes restent le registre générique déjà présent (type de connexion
// illustratif, sans application nommée), notamment utilisé comme options
// dans le sélecteur d'application du graphe Ontologie ci-dessus.
export const SOURCE_CARDS: SourceCard[] = [
  { id: "lucie-erp", nom: "Lucie ERP", marketReference: "SAP S/4HANA", type: "ERP — fournisseurs, commandes", icon: Server },
  { id: "lucie-wms", nom: "Lucie WMS", marketReference: "Manhattan Active WM", type: "WMS — inventaire, safety stock", icon: Boxes },
  { id: "lucie-tms", nom: "Lucie TMS", marketReference: "Blue Yonder", type: "TMS — expéditions, retards", icon: Waves },
  { id: "lucie-risk", nom: "Lucie Supplier Risk", marketReference: "Coupa", type: "Risque fournisseur", icon: ShieldAlert },
  { id: "lucie-demand", nom: "Lucie Demand Data Cloud", marketReference: "Snowflake", type: "Prévision de demande", icon: BarChart3 },
  { id: "lucie-hub", nom: "Lucie Integration Hub", marketReference: "MuleSoft/Kafka", type: "Événements & intégration", icon: Share2 },
  { id: "sap-s4", nom: "SAP S/4HANA", type: "ERP", icon: Server },
  { id: "sap-ariba", nom: "SAP Ariba", type: "Procurement", icon: Boxes },
  { id: "rest", nom: "REST API", type: "API", icon: Globe },
  { id: "graphql", nom: "GraphQL", type: "API", icon: Share2 },
  { id: "kafka", nom: "Kafka", type: "Flux d'événements", icon: Waves },
  { id: "sql", nom: "Base SQL", type: "Base de données", icon: Database },
  { id: "files", nom: "CSV / Excel", type: "Fichier", icon: FileSpreadsheet },
];


// Sources et Mapping "maison" de SCRA (SourcesView/MappingView, purement
// illustratives) ont été retirées (lot consolidation Studio) : elles
// faisaient doublon avec les équivalents Studio Aura (AURA Connect —
// /cockpit/connecteurs), jugés plus riches et mieux structurés (6 vraies
// cartes d'applications Maison Lucie avec endpoints/identifiants, mapping
// interactif avec suivi de complétion). Ces pages SCRA natives sont
// supprimées ; `SOURCE_CARDS`/`SourceCard`/`WIZARD_STEPS` ci-dessus
// restent car réutilisées par le sélecteur d'application de l'Ontologie.
// La page "Règles & alertes" SCRA (ex-ReglesView, catalogue statique
// ALERT_CATALOGUE) a été retirée pour la même raison : Studio (onglet
// "Règles causales") est désormais la seule source, éditable et réellement
// raccordée aux KPI/mappings, alors que ReglesView ne faisait que relire le
// catalogue figé — elle n'était plus liée depuis la navigation.



const CSS = `
.ct-shell{display:flex;height:100%;min-height:0;width:100%;background:var(--v4-bg,#f5f5f5);color:var(--v4-text,#2b2b2b);font-family:inherit}
.ct-main{flex:1;display:flex;flex-direction:column;min-width:0}
@media(max-width:640px){.ct-decision-embed{margin:-12px -12px 0}.ct-shell{flex-direction:column;overflow:auto;height:auto;min-height:100%}.ct-main{flex:none}.ct-content{overflow:visible;padding:12px}.ct-shell>.cp-panel{width:100%!important;flex-basis:auto!important;height:auto!important;min-height:300px;border-left:0;border-top:1px solid var(--v4-border,#e8e5f8)}.ct-topbar{padding:12px 14px}.ct-topbar-title h1{font-size:18px}}
.ct-topbar{padding:6px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.ct-topbar-title{display:flex;flex-direction:column;gap:0}
.ct-topbar-title h1{margin:0;font-size:20px;line-height:1.15;color:var(--v4-text,#1a1433)}
.ct-topbar-title p{margin:0;font-size:13px;color:var(--v4-text3,#9585c4)}
.ct-toggle{display:inline-flex;background:var(--v4-panel,#faf9ff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:3px}
.ct-toggle button{border:0;background:transparent;padding:6px 16px;border-radius:8px;font:700 13px var(--font-sans);color:var(--v4-text2,#4c3d7a);cursor:pointer}
.ct-toggle button.active{background:var(--aura-ink,#15121f);color:#fff}
.aura-hero-band .ct-toggle{background:rgb(255 255 255 / .06);border-color:var(--aura-hero-line)}
.aura-hero-band .ct-toggle button{color:var(--aura-indigo-200);transition:background .15s,color .15s}
.aura-hero-band .ct-toggle button:hover{color:#fff;background:rgb(255 255 255 / .08)}
.aura-hero-band .ct-toggle button.active{background:#fff;color:var(--aura-night);box-shadow:0 0 0 1px rgb(255 255 255 / .4),0 6px 18px -6px rgb(71 67 230 / .7)}
.ct-content{flex:1;overflow:auto;padding:16px}
.ct-cockpit{--ct-red:#d92d20;--ct-amber:#c4560a;--ct-green:#0f8a67;--ct-muted:#6b6f8a;--ct-line:rgb(21 29 82 / .1);display:flex;flex-direction:column;gap:18px}
@keyframes ct-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes ct-pulse{0%,100%{box-shadow:0 0 0 0 var(--ct-glow)}50%{box-shadow:0 0 0 5px transparent}}
.ct-sitrep{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:16px 28px;flex-wrap:wrap;padding:16px 20px;border-radius:14px;background:radial-gradient(90% 160% at 100% 0%,rgb(71 67 230 / .38),transparent 60%),linear-gradient(120deg,var(--aura-night,#0a0b1e),#12143a 60%,var(--aura-navy,#151d52));color:#fff;box-shadow:0 18px 40px -24px rgb(21 29 82 / .7);animation:ct-rise .35s ease both}
.ct-sitrep::before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--aura-hero-grid,rgb(165 163 245 / .09)) 1px,transparent 1px),linear-gradient(90deg,var(--aura-hero-grid,rgb(165 163 245 / .09)) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(90deg,transparent,#000 70%);pointer-events:none}
.ct-sitrep::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,var(--ct-tone,#a5a3f5),transparent);opacity:.8}
.ct-sitrep-red{--ct-tone:#ff6b5e}.ct-sitrep-amber{--ct-tone:#ffae4a}.ct-sitrep-green{--ct-tone:#3ddc97}.ct-sitrep-muted{--ct-tone:#a5a3f5}
.ct-sitrep-main{position:relative;display:flex;align-items:center;gap:14px;min-width:0;flex:1 1 320px}
.ct-sitrep-light{flex:0 0 auto;width:12px;height:12px;border-radius:50%;background:var(--ct-tone);--ct-glow:color-mix(in srgb,var(--ct-tone) 55%,transparent);box-shadow:0 0 0 4px color-mix(in srgb,var(--ct-tone) 18%,transparent),0 0 16px var(--ct-tone);animation:ct-pulse 2.4s ease-in-out infinite}
.ct-sitrep-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.ct-sitrep-eyebrow{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--aura-indigo-200,#c9c8fb)}
.ct-sitrep-headline{margin:0;font-family:var(--font-display);font-size:clamp(17px,1.9vw,21px);font-weight:600;letter-spacing:-.01em;line-height:1.25;color:#fff}
.ct-sitrep-sub{font-size:13px;color:rgb(255 255 255 / .72)}
.ct-sitrep-meta{position:relative;display:flex;gap:10px 24px;flex-wrap:wrap;margin:0}
.ct-sitrep-meta>div{display:flex;flex-direction:column;gap:2px;padding-left:12px;border-left:1px solid var(--aura-hero-line,rgb(165 163 245 / .28))}
.ct-sitrep-meta dt{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--aura-indigo-200,#c9c8fb)}
.ct-sitrep-meta dd{margin:0;font-size:13.5px;font-weight:600;color:#fff}
.ct-sitrep-demo{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;border:1px solid rgb(255 255 255 / .3);background:rgb(255 255 255 / .08)}
.ct-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}@media(max-width:900px){.ct-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ct-kpi{--ct-tone:var(--aura-indigo,#4743e6);position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px;padding:14px 16px 13px;border-radius:12px;background:var(--aura-glass-bg,rgb(255 255 255 / .72));background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--ct-tone) 3%,#fff));border:1px solid var(--ct-line);box-shadow:var(--aura-glass-shadow);transition:box-shadow .2s,transform .2s;animation:ct-rise .35s ease both}
.ct-kpi::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--ct-tone) 30%,var(--ct-tone) 70%,transparent);opacity:.85}
.ct-kpi::after{content:"";position:absolute;left:20%;right:20%;top:0;height:18px;background:radial-gradient(50% 100% at 50% 0%,color-mix(in srgb,var(--ct-tone) 22%,transparent),transparent);pointer-events:none}
.ct-kpi:hover{box-shadow:var(--aura-glass-shadow-hover);transform:translateY(-1px)}
.ct-kpi-red{--ct-tone:var(--ct-red)}.ct-kpi-amber{--ct-tone:var(--ct-amber)}.ct-kpi-green{--ct-tone:var(--ct-green)}.ct-kpi-muted{--ct-tone:var(--ct-muted)}.ct-kpi-accent{--ct-tone:var(--aura-indigo,#4743e6)}
.ct-kpi-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ct-kpi-icon{flex:0 0 auto;display:grid;place-items:center;width:26px;height:26px;border-radius:7px;color:var(--ct-tone);background:color-mix(in srgb,var(--ct-tone) 9%,#fff)}
.ct-kpi-value{font-family:var(--font-display);font-size:clamp(22px,2.4vw,30px);font-weight:600;letter-spacing:-.02em;line-height:1.05;color:var(--aura-ink,#15121f);font-variant-numeric:tabular-nums;overflow-wrap:normal;word-break:keep-all}
.ct-kpi-label{font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:#4a4f6e}
.ct-kpi-hint{display:flex;align-items:baseline;gap:6px;line-height:1.35;font-size:12px;color:#5b5f7a}
.ct-kpi-value-text{font-size:clamp(18px,1.7vw,22px);padding:4px 0 2px}
.ct-kpi-dot{flex:0 0 auto;transform:translateY(-1px);width:6px;height:6px;border-radius:50%;background:var(--ct-tone);box-shadow:0 0 6px var(--ct-tone)}

.ct-alerts-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin-bottom:12px}
.ct-alerts h2{display:flex;align-items:center;gap:8px;font-family:var(--font-display);font-size:var(--aura-t2,18px);font-weight:600;margin:0 0 3px;color:var(--aura-ink,#15121f)}
.ct-alerts-note{font-size:13px;color:#5b5f7a;line-height:1.5;margin:0;max-width:760px}
.ct-family-filter{display:flex;flex-wrap:wrap;gap:6px}
.ct-family-filter button{display:inline-flex;align-items:center;gap:6px;min-height:32px;border:1px solid var(--ct-line);background:#fff;color:#3b3f5c;border-radius:999px;padding:4px 12px;font:500 13px var(--font-sans);cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.ct-family-filter button span{font-size:12px;color:#5b5f7a;font-variant-numeric:tabular-nums}
.ct-family-filter button:hover{border-color:var(--aura-indigo-300,#a5a3f5)}
.ct-family-filter button[aria-pressed=true]{background:var(--aura-ink,#15121f);border-color:var(--aura-ink,#15121f);color:#fff}
.ct-family-filter button[aria-pressed=true] span{color:var(--aura-indigo-200,#c9c8fb)}
.ct-empty-state{display:flex;align-items:flex-start;gap:14px;padding:20px 22px;border:1px solid var(--ct-line);border-radius:14px;background:radial-gradient(80% 140% at 0% 0%,rgb(15 138 103 / .07),transparent 60%),#fff;box-shadow:var(--aura-glass-shadow);color:#5b5f7a;margin-bottom:18px;animation:ct-rise .35s ease both}
.ct-empty-icon{flex:0 0 auto;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;color:var(--ct-green);background:rgb(15 138 103 / .08);box-shadow:0 0 0 6px rgb(15 138 103 / .05)}
.ct-empty-state strong{display:block;font-family:var(--font-display);font-weight:600;color:var(--aura-ink,#15121f);font-size:16px;margin-bottom:3px}
.ct-empty-state p{margin:0 0 10px;font-size:13.5px;line-height:1.5;max-width:520px}
.ct-alert-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.ct-alert-card{--ct-tone:var(--ct-muted);position:relative;overflow:hidden;background:#fff;border:1px solid var(--ct-line);border-radius:12px;padding:14px 16px 14px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--aura-glass-shadow);transition:box-shadow .2s,transform .2s,border-color .2s;animation:ct-rise .35s ease both;animation-delay:calc(var(--ct-i,0) * 40ms)}
.ct-alert-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--ct-tone),color-mix(in srgb,var(--ct-tone) 20%,transparent))}
.ct-alert-card:hover,.ct-alert-card:focus-within{border-color:color-mix(in srgb,var(--ct-tone) 40%,var(--ct-line));box-shadow:var(--aura-glass-shadow-hover);transform:translateY(-2px)}
.ct-alert-card.sev-critique,.ct-alert-zoom.sev-critique{--ct-tone:var(--ct-red)}
.ct-alert-card.sev-majeure,.ct-alert-zoom.sev-majeure{--ct-tone:var(--ct-amber)}
.ct-alert-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ct-alert-pill{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:3px 10px 3px 8px;color:var(--ct-tone);background:color-mix(in srgb,var(--ct-tone) 9%,#fff);border:1px solid color-mix(in srgb,var(--ct-tone) 22%,transparent)}
.ct-sev-dot{width:7px;height:7px;border-radius:50%;background:var(--ct-tone);--ct-glow:color-mix(in srgb,var(--ct-tone) 50%,transparent);box-shadow:0 0 8px var(--ct-tone)}
.sev-critique .ct-sev-dot{animation:ct-pulse 2.4s ease-in-out infinite}
.ct-alert-family{font-size:12px;color:#5b5f7a;padding:2px 8px;border-radius:6px;background:#f3f3f8}
.ct-alert-top .ct-zoom-trigger{margin-left:auto;width:30px;height:30px;color:#4a4f6e;border-color:var(--ct-line)}
.ct-alert-name{margin:0;font-family:var(--font-display);font-size:var(--aura-t3,16px);font-weight:600;line-height:1.3;letter-spacing:-.005em;color:var(--aura-ink,#15121f)}
.ct-alert-site{font-size:12px;color:#5b5f7a}
.ct-facts{display:flex;flex-direction:column;gap:9px}
.ct-exec{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.ct-exec-value{font-family:var(--font-display);font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1;color:var(--aura-ink,#15121f);font-variant-numeric:tabular-nums}
.ct-exec-value small{font-family:var(--font-sans);font-size:13px;font-weight:500;letter-spacing:0;color:#5b5f7a}
.ct-exec-critique{color:var(--ct-red)}.ct-exec-alerte{color:var(--ct-amber)}
.ct-exec-caption{font-size:12px;color:#5b5f7a}
.ct-exec-meta{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px;color:#3b3f5c}
.ct-exec-record{display:inline-flex;align-items:center;gap:5px;font-weight:600;min-width:0;overflow-wrap:anywhere}
.ct-exec-count{color:#5b5f7a;font-variant-numeric:tabular-nums}
.ct-exec-question{margin:0;font-size:13.5px;line-height:1.45;color:#3b3f5c;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ct-alert-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:10px;border-top:1px solid var(--ct-line)}
.ct-alert-source{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#5b5f7a;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct-decide{margin-left:auto;flex:0 0 auto;min-height:36px}
.ct-gauge{display:flex;flex-direction:column;gap:5px}
.ct-gauge-track{position:relative;height:8px;border-radius:999px;background:#eef0f6;overflow:visible}
.ct-gauge-zone{position:absolute;top:0;bottom:0}
.ct-gauge-zone:first-child{border-radius:999px 0 0 999px}.ct-gauge-zone:nth-child(3){border-radius:0 999px 999px 0}
.ct-gauge-ok{background:rgb(15 138 103 / .22)}
.ct-gauge-warn{background:rgb(232 140 30 / .42)}
.ct-gauge-crit{background:rgb(217 45 32 / .45)}
.ct-gauge-tick{position:absolute;top:-2px;bottom:-2px;width:1px;background:rgb(21 29 82 / .35)}
.ct-gauge-marker{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;border:3px solid var(--ct-green);box-shadow:0 0 0 3px rgb(255 255 255 / .9),0 2px 6px rgb(21 29 82 / .25);transition:left .5s cubic-bezier(.2,.8,.2,1)}
.ct-gauge-alerte .ct-gauge-marker{border-color:var(--ct-amber)}
.ct-gauge-critique .ct-gauge-marker{border-color:var(--ct-red);box-shadow:0 0 0 3px rgb(255 255 255 / .9),0 0 10px rgb(217 45 32 / .55)}
.ct-gauge-legend span{display:inline-flex;align-items:center;gap:5px}.ct-gauge-key{width:10px;height:4px;border-radius:2px}
.ct-gauge-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:#5b5f7a;font-variant-numeric:tabular-nums}
.ct-alert-metrics{display:flex;flex-direction:column;gap:6px}
.ct-alert-metric-row{display:flex;gap:16px;flex-wrap:wrap}
.ct-card-exposure{margin:6px 0 0;font-size:12.5px;color:#4c3d7a;display:flex;gap:5px;align-items:center}
.ct-illustratif{display:inline-block;margin:6px 0 0;font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px;border:1px dashed #b88a2b;color:#8a5a00;background:#fffaf0;cursor:help;width:fit-content}
.ct-card-exposure b{color:#1a1433}
.ct-exposure-src{margin:4px 0 0;font-size:12px;color:#6b6f8a}
.ct-alert-metric{display:flex;align-items:flex-start;gap:6px;color:#5b5f7a}
.ct-alert-metric>div{display:flex;flex-direction:column}
.ct-alert-metric strong{font-size:14px;font-weight:600;color:var(--aura-ink,#15121f);line-height:1.3}
.ct-alert-metric span{font-size:12px;color:#5b5f7a}
.ct-alert-zoom{--ct-tone:var(--ct-muted);display:flex;flex-direction:column;gap:18px}
.ct-az-head{display:flex;flex-direction:column;gap:8px;padding-right:40px}
.ct-az-head h3{margin:0;font-family:var(--font-display);font-size:22px;font-weight:600;letter-spacing:-.01em;color:var(--aura-ink,#15121f)}
.ct-az-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
@media(max-width:720px){.ct-az-grid{grid-template-columns:1fr}}
.ct-az-col{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:12px;border:1px solid var(--ct-line);background:linear-gradient(180deg,#fbfbfe,#fff)}
.ct-az-col h5{margin:4px 0 0;font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#4a4f6e}
.ct-az-col h5:first-child{margin-top:0}
.ct-az-col .ct-exec-value{font-size:34px}
.ct-az-rule{margin:0;font-size:14px;line-height:1.5;color:#2c3050}
.ct-az-rule span{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--aura-indigo,#4743e6);margin:0 2px}
.ct-az-causes{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.ct-az-causes li{position:relative;padding-left:16px;font-size:14px;line-height:1.4;color:#2c3050}
.ct-az-causes li::before{content:"";position:absolute;left:2px;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--ct-tone)}
.ct-az-options{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.ct-az-options li{font-size:13px;padding:4px 10px;border-radius:999px;border:1px solid var(--ct-line);background:#fff;color:#2c3050}
.ct-az-foot{display:flex;align-items:center;justify-content:space-between;gap:12px 20px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--ct-line)}
.ct-az-foot .ct-exec-question{-webkit-line-clamp:unset;flex:1 1 280px;font-size:14px}
.ct-cockpit button:focus-visible{outline:2px solid var(--aura-indigo,#4743e6);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.ct-cockpit *,.ct-cockpit *::before,.ct-cockpit,.ct-zoom-modal{animation:none!important;transition:none!important}}
@media(max-width:640px){.ct-sitrep{padding:14px 16px}.ct-sitrep-meta{width:100%}.ct-alert-cards{grid-template-columns:1fr}.ct-az-head h3{font-size:19px}.ct-kpi{padding:12px}}
.ct-primary{margin-top:0;align-self:flex-start;border:0;background:var(--aura-ink,#15121f);color:#fff;border-radius:8px;padding:8px 14px;font:700 13px var(--font-sans);cursor:pointer}
.ct-primary-full{align-self:stretch;text-align:center;border-radius:8px;background:var(--aura-ink,#15121f);color:#fff;margin-top:auto;padding:8px 10px;font-size:13px}
.ct-primary-full:hover{background:var(--v4-accent,#7c3aed);color:#fff}
.ct-primary:hover{background:var(--aura-indigo,#4743e6)}
.ct-zoom-trigger{flex:0 0 auto;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-surface,#fff);color:var(--v4-text3,#9585c4);border-radius:8px;width:26px;height:26px;display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s}
.ct-zoom-trigger:hover{background:var(--v4-accent-bg,#f0ecff);color:var(--v4-accent2,#6d28d9)}
.ct-zoom-backdrop{position:fixed;inset:0;background:rgba(10,11,30,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:32px;z-index:200}
.ct-zoom-modal{position:relative;max-width:980px;width:100%;max-height:88vh;overflow:auto;background:var(--v4-surface,#fff);border-radius:16px;border:1px solid rgb(165 163 245 / .25);box-shadow:0 30px 80px -24px rgba(10,11,30,.6);padding:28px;animation:ct-rise .25s ease both}
@media(max-width:640px){.ct-zoom-backdrop{padding:12px}.ct-zoom-modal{padding:18px}}
.ct-zoom-close{position:absolute;top:14px;right:14px;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-panel,#faf9ff);color:var(--v4-text2,#4c3d7a);border-radius:8px;width:32px;height:32px;display:grid;place-items:center;cursor:pointer}
.ct-zoom-close:hover{background:var(--v4-accent-bg,#f0ecff);color:var(--v4-accent2,#6d28d9)}
.ct-zoom-large{box-shadow:none;border:0;padding:0;font-size:1.08em}
.ct-zoom-large.ct-alert-card h4{font-size:19px}
.ct-zoom-large.ct-alert-card .ct-alert-metric strong{font-size:16px}
.ct-zoom-large.ct-alert-card .ct-alert-causes li{font-size:13px}
.ct-zoom-large.ct-situation-card h3{font-size:20px}
.ct-zoom-large.ct-situation-card .ct-situation-grid{font-size:13px}
.ct-zoom-large .ct-zoom-trigger{display:none}
.ct-decision{display:flex;flex-direction:column;height:100%}
.ct-decision-presets{display:flex;justify-content:flex-end;margin:-8px 0 12px}.ct-strategic{margin:0 0 12px;font-size:13px}.ct-strategic summary{cursor:pointer;font-weight:600}.ct-strategic summary small{font-weight:400;opacity:.7}.ct-strategic-note{margin:6px 0;font-size:12px;opacity:.8}.ct-strategic .ct-decision-presets{flex-wrap:wrap;justify-content:flex-start;gap:6px;margin:6px 0 0}.ct-decision-presets button{font-size:12px;padding:6px 10px;border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;background:var(--v4-surface,#fff);color:inherit;cursor:pointer}
.ct-decision-embed{flex:1;min-height:560px;margin:0 -16px;border-bottom:1px solid var(--v4-border,#e8e5f8);overflow:hidden;position:relative}
.ct-cas-toggle{align-self:flex-start;margin-top:16px;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-surface,#fff);color:var(--v4-accent2,#6d28d9);border-radius:8px;padding:8px 14px;font:700 13px var(--font-sans);cursor:pointer;box-shadow:0 1px 2px rgba(20,10,60,.03),0 8px 18px -14px rgba(86,55,223,.16);transition:box-shadow .15s,background .15s}
.ct-situations-toggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-surface,#fff);color:var(--v4-accent2,#6d28d9);border-radius:8px;padding:7px 13px;font:700 13px var(--font-sans);cursor:pointer;margin-bottom:2px;align-self:flex-start}
.ct-cas-toggle:hover{background:var(--v4-accent-bg,#f0ecff);box-shadow:0 10px 22px -14px rgba(86,55,223,.3)}

.ct-admin-scopes{display:grid;gap:12px;margin-top:16px;max-width:640px}
.ct-admin-scope-card{display:flex;align-items:flex-start;gap:12px;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:14px 16px;box-shadow:0 1px 2px rgba(20,10,60,.03),0 8px 18px -14px rgba(86,55,223,.16);transition:box-shadow .15s,transform .1s}
.ct-admin-scope-card:hover{box-shadow:0 10px 22px -14px rgba(86,55,223,.28);transform:translateY(-1px)}
.ct-admin-scope-icon{flex:0 0 auto;display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--v4-accent-bg,#f0ecff),#fff);color:var(--v4-accent2,#6d28d9);box-shadow:inset 0 0 0 1px rgba(120,90,240,.14)}
.ct-admin-scope-card div{flex:1;min-width:0}
.ct-admin-scope-card strong{font-size:13.5px;font-weight:800;color:var(--v4-text,#1a1433)}
.ct-admin-scope-card p{margin:3px 0 0;font-size:13px;color:var(--v4-text2,#4c3d7a);line-height:1.45}
.ct-admin-scope-status{flex:0 0 auto;font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--v4-text3,#9585c4);background:var(--v4-panel,#faf9ff);border:1px solid var(--v4-border,#efedfc);border-radius:999px;padding:4px 10px;white-space:nowrap}
.ct-page{max-width:720px}
.ct-page-wide{max-width:920px}
.ct-page h2{margin:0 0 8px;display:flex;align-items:center;gap:8px}
.ct-page h3{margin:24px 0 6px;font-size:13px;font-weight:800;color:var(--v4-text2,#4c3d7a);display:flex;align-items:center;gap:6px}
.ct-illustrative{font-size:12.5px;font-weight:600;font-style:italic;color:var(--v4-text3,#9585c4);text-transform:none}
.ct-parcours{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--v4-text,#1a1433);line-height:1.6}
.ct-parcours ul{margin:4px 0 4px;padding-left:18px;list-style:disc}
.ct-parcours li{margin-bottom:6px}
.ct-contract-fields,.ct-gardefous{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--v4-text,#1a1433);line-height:1.6;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:2px 12px}
.ct-mapping-studio{display:grid;grid-template-columns:1fr 44px 1fr 1.2fr;gap:0 14px;margin-top:10px;align-items:start}
.ct-mapping-connectors{width:100%;flex:0 0 auto}
.ct-mapping-connector-line{fill:none;stroke:var(--v4-accent,#7c3aed);stroke-width:1.6;opacity:.45}
.ct-mapping-row-fixed{height:58px;overflow:hidden}
.ct-mapping-row-fixed p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct-mapping-col{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:12px;min-width:0;box-shadow:0 1px 2px rgba(20,10,60,.03),0 10px 22px -16px rgba(86,55,223,.18)}
.ct-mapping-col>header{font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--v4-accent2,#6d28d9);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--v4-border,#efedfc)}
.ct-mapping-rows{display:flex;flex-direction:column;gap:8px}
.ct-mapping-row{position:relative;border:1px solid var(--v4-border,#efedfc);border-radius:8px;padding:8px 22px 8px 10px;background:var(--v4-panel,#faf9ff);transition:border-color .15s,box-shadow .15s}
.ct-mapping-row:hover{border-color:var(--v4-accent,#7c3aed);box-shadow:0 4px 12px -6px rgba(86,55,223,.22)}
.ct-mapping-row-main{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--v4-text,#1a1433)}
.ct-mapping-row p{margin:2px 0 0;font-size:12.5px;color:var(--v4-text3,#9585c4);line-height:1.35}
.ct-mapping-type-badge{font-size:12px;font-weight:700;color:var(--v4-accent2,#6d28d9);background:var(--v4-accent-bg,#f0ecff);border-radius:999px;padding:1px 7px}
.ct-mapping-arrow{color:var(--v4-text3,#9585c4);font-weight:700}
.ct-mapping-dot{position:absolute;top:10px;right:9px;width:8px;height:8px;border-radius:50%;background:#7c3aed}
.ct-mapping-dot.unmatched{background:transparent;border:1.5px dashed #c9c2e8}
.ct-mapping-reco-row{border:1px solid var(--v4-border,#efedfc);border-radius:8px;padding:9px 11px;background:var(--v4-panel,#faf9ff);transition:border-color .15s,box-shadow .15s}
.ct-mapping-reco-row:not(.ct-mapping-reco-empty):hover{border-color:var(--v4-accent,#7c3aed);box-shadow:0 4px 12px -6px rgba(86,55,223,.22)}
.ct-mapping-reco-row.ct-mapping-reco-empty{border-style:dashed;opacity:.8}
.ct-mapping-reco-top{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--v4-text,#1a1433);flex-wrap:wrap}
.ct-mapping-reco-top span:not(.ct-mapping-confidence){color:var(--v4-text3,#9585c4)}
.ct-mapping-confidence{margin-left:auto;font-size:12.5px;font-weight:800;color:#0f9f7a;background:#e9faf3;border-radius:999px;padding:1px 8px}
.ct-mapping-reco-row p{margin:3px 0 8px;font-size:12.5px;color:var(--v4-text3,#9585c4);line-height:1.35}
.ct-mapping-actions{display:flex;gap:6px}
.ct-mapping-actions button{flex:1;border:1px solid var(--v4-border,#e8e5f8);background:#fff;color:var(--v4-text2,#4c3d7a);border-radius:8px;padding:4px 6px;font:700 12.5px var(--font-sans);cursor:not-allowed;opacity:.7}
@media(max-width:960px){.ct-mapping-studio{grid-template-columns:1fr}.ct-mapping-connectors{display:none}}
.ct-page-note{color:var(--v4-text2,#4c3d7a);font-size:13.5px;line-height:1.55}
.ct-page-note.ct-honest{display:flex;align-items:flex-start;gap:6px;color:#9a5b00;background:#fff7ed;border:1px solid #fde5c2;border-radius:8px;padding:8px 12px}
.ct-cas-types{margin-top:24px}
.ct-cas-types h3{display:flex;align-items:center;gap:6px;font-size:13px;margin:0 0 4px;color:var(--v4-text2,#4c3d7a)}
.ct-cas-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:10px}
.ct-cas-card{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:14px 16px;box-shadow:0 1px 2px rgba(20,10,60,.03),0 8px 18px -14px rgba(86,55,223,.16);transition:box-shadow .15s,transform .1s}
.ct-cas-card:hover{box-shadow:0 10px 22px -14px rgba(86,55,223,.28);transform:translateY(-1px)}
.ct-cas-card h4{margin:0 0 6px;font-size:13.5px;font-weight:800;color:var(--v4-text,#1a1433)}
.ct-cas-question{margin:0 0 8px;font-size:13px;color:var(--v4-text2,#4c3d7a);line-height:1.45}
.ct-cas-card dl{margin:0}
.ct-cas-card dt{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:var(--v4-text3,#9585c4);margin-top:6px}
.ct-cas-card dd{margin:2px 0 0;font-size:13px;color:var(--v4-text,#1a1433);line-height:1.4}
.ct-cas-note{margin:8px 0 0;font-size:13px;font-style:italic;color:var(--v4-text3,#9585c4);line-height:1.4}
.ct-cas-demonstrateur{margin-top:16px;padding:12px 14px;border-radius:8px;background:var(--v4-accent-bg,#ededed);border:1px solid var(--v4-border,#cfcfcf);font-style:normal;font-weight:650;color:var(--v4-text2,#4a4a4a)}
.ct-table{width:100%;border-collapse:collapse;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;overflow:hidden;font-size:13px;box-shadow:0 1px 2px rgba(20,10,60,.03),0 8px 18px -14px rgba(86,55,223,.16)}
.ct-table th{text-align:left;background:var(--v4-panel,#faf9ff);color:var(--v4-text2,#4c3d7a);font-weight:800;padding:8px 10px;border-bottom:1px solid var(--v4-border,#e8e5f8)}
.ct-table td{padding:8px 10px;border-bottom:1px solid var(--v4-border,#e8e5f8);vertical-align:top;color:var(--v4-text,#1a1433)}
.ct-table tr:last-child td{border-bottom:0}
.ct-sources-layout{display:grid;grid-template-columns:1fr 300px;gap:18px;margin-top:16px;align-items:start}
.ct-source-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.ct-source-card{display:flex;flex-direction:column;align-items:flex-start;gap:8px;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:14px;cursor:pointer;text-align:left;font:inherit;color:var(--v4-text,#1a1433);box-shadow:0 1px 2px rgba(20,10,60,.03),0 8px 18px -14px rgba(86,55,223,.16);transition:border-color .15s,box-shadow .15s,transform .1s}
.ct-source-card:hover{border-color:var(--v4-accent,#7c3aed);box-shadow:0 10px 22px -14px rgba(86,55,223,.3);transform:translateY(-1px)}
.ct-source-card.selected{border-color:var(--v4-accent,#7c3aed);box-shadow:0 0 0 2px var(--v4-accent-bg,#f0ecff);background:var(--v4-accent-bg,#f0ecff)}
.ct-source-card-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--v4-accent-bg,#f0ecff),#fff);color:var(--v4-accent2,#6d28d9);box-shadow:inset 0 0 0 1px rgba(120,90,240,.14)}
.ct-source-card strong{font-size:13.5px;font-weight:800}
.ct-source-card-type{font-size:12px;font-weight:700;color:var(--v4-text3,#9585c4);text-transform:uppercase;letter-spacing:.03em}
.ct-source-wizard{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:16px;position:sticky;top:0;box-shadow:0 1px 2px rgba(20,10,60,.03),0 10px 24px -16px rgba(86,55,223,.18)}
.ct-source-wizard>header{font-size:13px;font-weight:800;color:var(--v4-text,#1a1433);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--v4-border,#efedfc)}
.ct-wizard-steps{margin:0 0 14px;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px}
.ct-wizard-steps li{display:flex;gap:10px;align-items:flex-start}
.ct-wizard-step-num{flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--v4-accent,#7c3aed),var(--v4-accent2,#6d28d9));color:#fff;display:grid;place-items:center;font-size:12.5px;font-weight:800;box-shadow:0 3px 8px rgba(86,55,223,.28)}
.ct-wizard-steps strong{font-size:13px;color:var(--v4-text,#1a1433)}
.ct-wizard-steps p{margin:2px 0 0;font-size:12.5px;color:var(--v4-text3,#9585c4);line-height:1.4}
@media(max-width:820px){.ct-sources-layout{grid-template-columns:1fr}.ct-source-wizard{position:static}}
.ct-sources-modes{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:14px}
.ct-sources-modes article{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:14px 16px;box-shadow:0 1px 2px rgba(20,10,60,.03),0 8px 18px -14px rgba(86,55,223,.14);transition:box-shadow .15s,transform .1s}
.ct-sources-modes article:hover{box-shadow:0 10px 22px -14px rgba(86,55,223,.26);transform:translateY(-1px)}
.ct-sources-modes h4{margin:0 0 6px;font-size:13.5px;font-weight:800;color:var(--v4-text,#1a1433)}
.ct-sources-modes p{margin:0;font-size:13px;line-height:1.5;color:var(--v4-text2,#4c3d7a)}


/* --- Design system SCRA : eyebrow + H1 + sous-titre, cartes élevées, chips
   d'icônes teintées, rythme d'espacement cohérent — construit à partir des
   tokens --v4-accent/--v4-accent2/--v4-accent-bg déjà en place. --- */
.ct-topbar-eyebrow{font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--v4-accent2,#6d28d9)}
.ct-pagehead{margin:0 0 22px;display:flex;flex-direction:column;gap:4px}
.ct-pagehead-eyebrow{font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--v4-accent2,#6d28d9)}
.ct-pagehead h1{margin:0;display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800;color:var(--v4-text,#1a1433);letter-spacing:-.01em}
.ct-pagehead-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--v4-accent-bg,#f0ecff),#fff);color:var(--v4-accent2,#6d28d9);box-shadow:inset 0 0 0 1px rgba(120,90,240,.14)}
.ct-pagehead p{margin:0;font-size:13.5px;color:var(--v4-text3,#9585c4);max-width:640px;line-height:1.5}

.ct-rule-variables{display:flex;flex-wrap:wrap;gap:4px}
.ct-rule-variable-chip{font-size:12.5px;font-weight:700;color:var(--v4-accent2,#6d28d9);background:var(--v4-accent-bg,#f0ecff);border-radius:999px;padding:3px 9px}

.ct-ontology-graph{display:grid;grid-template-columns:180px 60px minmax(150px,1fr) 60px minmax(140px,1fr) 60px minmax(150px,1fr) 280px;gap:0;align-items:center;margin:4px 0 26px;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:18px;box-shadow:0 1px 2px rgba(20,10,60,.03),0 10px 24px -14px rgba(86,55,223,.16)}
.ct-ontology-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.ct-ontology-object{justify-content:center}
.ct-ontology-object-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;background:var(--v4-accent,#2b2b2b);color:var(--v4-bg,#fff);border-radius:8px;padding:14px;box-shadow:none}
.ct-ontology-object-chip{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.2)}
.ct-ontology-object-card strong{font-size:14px;font-weight:800}
.ct-ontology-object-card span{font-size:12px;opacity:.85}
.ct-ontology-connectors{width:100%;height:100%;overflow:visible}
.ct-ontology-node{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-height:72px;justify-content:center;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-panel,#faf9ff);border-radius:8px;padding:10px 14px 10px 12px;text-align:left;font:inherit;cursor:pointer;border-left:3px solid var(--node-color,#7c3aed);transition:box-shadow .15s,transform .1s}
.ct-ontology-node-app,.ct-ontology-node-field{cursor:default}
.ct-ontology-node strong{font-size:13px;font-weight:800;color:var(--v4-text,#1a1433);line-height:1.3;white-space:normal;word-break:normal;overflow-wrap:normal}
.ct-ontology-node-sub{font-size:12px;color:var(--v4-text3,#9585c4)}
.ct-ontology-node.selected{box-shadow:0 0 0 2px var(--node-color,#7c3aed);transform:translateX(2px)}
.ct-ontology-node-dot{position:absolute;top:8px;right:8px;width:6px;height:6px;border-radius:50%;background:var(--node-color,#7c3aed)}
.ct-ontology-detail{background:var(--v4-panel,#faf9ff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:14px;align-self:stretch}
.ct-ontology-detail>header{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--v4-accent2,#6d28d9);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--v4-border,#efedfc);display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.ct-ontology-detail-hint{font-size:12px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--v4-text3,#9585c4)}
.ct-ontology-detail dl{margin:0;display:grid;gap:8px}
.ct-ontology-detail dt{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--v4-text3,#9585c4)}
.ct-ontology-detail dd{margin:1px 0 0;font-size:13px;color:var(--v4-text,#1a1433);line-height:1.4}
@media(max-width:1180px){.ct-ontology-graph{grid-template-columns:1fr;padding:14px}.ct-ontology-connectors{display:none}.ct-ontology-detail{margin-top:8px}}
.ct-ontology-graph-empty{background:var(--v4-surface,#fff);border:1px dashed var(--v4-border,#e8e5f8);border-radius:8px;padding:18px;margin:4px 0 26px}
.ct-inline-link{border:0;background:transparent;color:var(--v4-accent2,#6d28d9);font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;padding:0}
.ct-ontology-add-attr{align-self:flex-start;display:inline-flex;align-items:center;gap:5px;border:1px dashed var(--v4-accent,#7c3aed);background:transparent;color:var(--v4-accent2,#6d28d9);border-radius:8px;padding:5px 9px;font:700 12.5px var(--font-sans);cursor:pointer}
.ct-ontology-add-attr:hover{background:var(--v4-accent-bg,#f0ecff)}
.ct-ontology-node-wrap{position:relative}
.ct-ontology-node-wrap .ct-ontology-node{width:100%}
.ct-ontology-node-remove{position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;border:0;background:var(--v4-panel,#faf9ff);color:var(--v4-text3,#9585c4);display:grid;place-items:center;cursor:pointer;opacity:0;transition:opacity .15s}
.ct-ontology-node-wrap:hover .ct-ontology-node-remove{opacity:1}
.ct-ontology-node-remove:hover{background:#fef2f2;color:#dc2626}
.ct-ontology-node .ct-ontology-node-dot{right:8px}
.ct-ontology-app-select{font:800 13px var(--font-sans);color:var(--v4-text,#1a1433);background:transparent;border:0;padding:0;cursor:pointer;max-width:100%}
.ct-ontology-app-select:focus{outline:1px solid var(--v4-accent,#7c3aed)}

/* Édition en ligne (Contrat sémantique + table de référence) */
.ct-inline-editable{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;padding:2px 4px;border-radius:6px;max-width:100%}
.ct-inline-editable:hover{background:var(--v4-accent-bg,#f0ecff)}
.ct-inline-editable-icon{opacity:.45;flex:0 0 auto}
.ct-inline-editable-input{width:100%;font:inherit;color:inherit;background:var(--v4-surface,#fff);border:1px solid var(--v4-accent,#7c3aed);border-radius:6px;padding:3px 6px}

/* Recherche : surlignage / atténuation, réutilisé dans le graphe, la vue
   globale et la table de référence. */
.ct-search-match{outline:2px solid var(--v4-accent,#7c3aed);outline-offset:1px;background:var(--v4-accent-bg,#f0ecff) !important}
.ct-search-dim{opacity:.35}
tr.ct-search-dim{opacity:.4}
tr.ct-search-match{background:var(--v4-accent-bg,#f0ecff)}

/* Toolbar Ontologie : recherche + sélecteur d'objets + toggle alertes */
.ct-ontology-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px}
.ct-ontology-search{display:flex;align-items:center;gap:6px;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:7px 10px;color:var(--v4-text3,#9585c4);min-width:260px;flex:1 1 260px}
.ct-ontology-search input{border:0;outline:0;background:transparent;font:inherit;color:var(--v4-text,#1a1433);width:100%}
.ct-secondary{border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-surface,#fff);color:var(--v4-text,#1a1433);border-radius:8px;padding:7px 12px;font:700 13px var(--font-sans);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.ct-secondary:hover{border-color:var(--v4-accent,#7c3aed)}
.ct-ontology-object-picker{position:relative}
.ct-ontology-object-picker-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:5;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:10px;box-shadow:0 10px 30px -10px rgba(20,10,60,.25);min-width:260px;max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:4px}
.ct-ontology-object-picker-option{display:flex;align-items:center;gap:8px;font-size:13px;padding:5px 6px;border-radius:8px;border:0;background:transparent;text-align:left;cursor:pointer;color:var(--v4-text,#1a1433)}
.ct-ontology-object-picker-option:hover{background:var(--v4-accent-bg,#f0ecff)}
.ct-ontology-object-picker-option.selected{background:var(--v4-accent-bg,#f0ecff);font-weight:800}
.ct-ontology-object-picker-group{border-top:1px solid var(--v4-border,#efedfc);padding-top:6px;margin-top:4px;display:flex;flex-direction:column;gap:2px}
.ct-ontology-object-picker-famille{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--v4-text3,#9585c4);padding:2px 6px}
.ct-ontology-alert-toggle{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--v4-text2,#4c3d7a);white-space:nowrap}

/* Badge alertes par attribut (dans le graphe riche) */
.ct-ontology-attr-alerts{display:flex;flex-wrap:wrap;gap:3px;margin-top:2px}
.ct-ontology-attr-alert-chip{font-size:12px;font-weight:600;background:transparent;color:var(--v4-text2,#4c3d7a);border:1px solid var(--v4-border,#e8e5f8);border-radius:999px;padding:1px 6px}
.ct-ontology-attr-alert-none{background:transparent;border:1px solid var(--v4-border,#e8e5f8);color:var(--v4-text3,#9585c4)}

/* Graphes multiples empilés + carte simplifiée pour objets sans exemple riche */
.ct-ontology-multi-graph{display:flex;flex-direction:column;gap:16px}
.ct-ontology-simple-card{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.ct-ontology-simple-head{display:flex;align-items:center;gap:10px}
.ct-ontology-simple-head strong{font-size:13px;font-weight:700;color:var(--v4-text,#1a1433);display:block}
.ct-ontology-object-chip-small{width:26px;height:26px;background:var(--v4-panel,#faf9ff);color:var(--v4-text2,#4c3d7a)}
.ct-ontology-simple-note{margin:0}
.ct-ontology-simple-alerts{display:flex;flex-direction:column;gap:4px}

/* Vue globale */
.ct-ontology-global-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1px;margin-bottom:20px;background:var(--v4-border,#e8e5f8);border:1px solid var(--v4-border,#e8e5f8)}
.ct-ontology-global-card{background:var(--v4-surface,#fff);border:0;border-radius:0;padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:none}
.ct-ontology-global-card>header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ct-ontology-global-card strong{font-size:13px;font-weight:700;color:var(--v4-text,#1a1433)}
.ct-ontology-alert-count{font-size:12px;font-weight:600;color:var(--v4-text2,#4c3d7a);background:transparent;border:1px solid var(--v4-border,#efedfc);border-radius:999px;padding:3px 9px;white-space:nowrap}
.ct-ontology-global-objects{display:flex;flex-wrap:wrap;gap:6px}
.ct-ontology-object-pill{font-size:12.5px;font-weight:600;background:transparent;border:1px solid var(--v4-border,#efedfc);color:var(--v4-text2,#4c3d7a);border-radius:999px;padding:3px 9px}

.ct-capmap{display:grid;grid-template-columns:1fr 300px;gap:18px;align-items:start;margin-top:6px}
.ct-capmap-tiers{display:flex;flex-direction:column;gap:20px}
.ct-capmap-tier h3{margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--v4-text3,#9585c4);display:flex;align-items:center;gap:8px}
.ct-capmap-tier h3::after{content:"";flex:1;height:1px;background:var(--v4-border,#e8e5f8)}
.ct-capmap-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1px;background:var(--v4-border,#e8e5f8);border:1px solid var(--v4-border,#e8e5f8)}
.ct-capmap-card{text-align:left;font:inherit;cursor:pointer;background:var(--v4-surface,#fff);border:0;border-radius:0;padding:13px;display:flex;flex-direction:column;gap:8px;box-shadow:none;transition:background .12s}
.ct-capmap-card:hover{background:var(--v4-panel,#faf9ff);box-shadow:none}
.ct-capmap-card.selected{box-shadow:inset 0 0 0 2px var(--v4-text,#1a1433);background:var(--v4-panel,#faf9ff)}
.ct-capmap-card strong{font-size:13.5px;font-weight:700;color:var(--v4-text,#1a1433)}
.ct-capmap-card p{margin:0;font-size:12.5px;color:var(--v4-text2,#4c3d7a);line-height:1.4}
.ct-capmap-counts{display:flex;gap:8px;margin-top:auto}
.ct-capmap-counts span{font-size:12px;font-weight:600;color:var(--v4-text2,#4c3d7a);background:transparent;border:1px solid var(--v4-border,#efedfc);border-radius:999px;padding:2px 8px}
.ct-capmap-detail{position:sticky;top:0;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:16px}
.ct-capmap-detail>header{font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--v4-text3,#9585c4);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--v4-border,#efedfc)}
.ct-capmap-detail h4{margin:0 0 4px;font-size:14px;font-weight:700;color:var(--v4-text,#1a1433)}
.ct-capmap-detail dl{margin:12px 0 0;display:grid;gap:8px}
.ct-capmap-detail dt{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--v4-text3,#9585c4)}
.ct-capmap-detail dd{margin:1px 0 0;font-size:13px;color:var(--v4-text,#1a1433);line-height:1.4}
@media(max-width:900px){.ct-capmap{grid-template-columns:1fr}.ct-capmap-detail{position:static}}
.ct-grounded-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;width:fit-content}
.ct-grounded-yes{background:#eafbf3;color:#0f9f7a;box-shadow:inset 0 0 0 1px rgba(15,159,122,.24)}
.ct-grounded-no{background:#f5f3fb;color:#8f88a8;box-shadow:inset 0 0 0 1px rgba(120,110,160,.18)}
.ct-grounded-live{background:#e8fbf0;color:#0a8f5c;box-shadow:inset 0 0 0 1px rgba(10,143,92,.3)}
.ct-grounded-live-ts{font-weight:700;opacity:.8;text-transform:none;letter-spacing:0}
.ct-live-note{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#8f88a8;margin:-6px 0 0;padding:8px 10px;background:#faf9ff;border-radius:8px}
.ct-situations-section{margin-bottom:8px}
.ct-situations{display:flex;flex-direction:column;gap:18px}
.ct-situation-card{background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:20px;box-shadow:0 8px 24px -18px rgba(86,55,223,.28);display:flex;flex-direction:column;gap:16px}
.ct-situation-head{display:flex;align-items:flex-start;gap:12px}
.ct-situation-badge{flex:0 0 auto;display:grid;place-items:center;width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#fdeceb,#fff);color:#dc2626;box-shadow:inset 0 0 0 1px rgba(220,38,38,.16)}
.ct-situation-id{display:block;font-size:12.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--v4-text3,#9585c4);margin-bottom:2px}
.ct-situation-head h3{margin:0;font-size:16px;font-weight:800;color:var(--v4-text,#1a1433);line-height:1.35}
.ct-situation-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.ct-situation-grid section h4{margin:0 0 8px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--v4-accent2,#6d28d9)}
.ct-situation-grid ul{margin:0;padding:0 0 0 16px;font-size:13px;color:var(--v4-text2,#4c3d7a);line-height:1.55;display:flex;flex-direction:column;gap:5px}
.ct-situation-perimetre{margin:0;display:grid;gap:6px}
.ct-situation-perimetre dt{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--v4-text3,#9585c4)}
.ct-situation-perimetre dd{margin:1px 0 0;font-size:13px;color:var(--v4-text,#1a1433)}
.ct-situation-metrics{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
.ct-situation-options{list-style:none}
.ct-situation-options li{display:flex;flex-direction:column;gap:2px}
.ct-situation-options strong{font-size:13px;color:var(--v4-text,#1a1433)}
.ct-situation-option-meta{font-size:12.5px;color:var(--v4-text3,#9585c4)}
.ct-situation-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--v4-border,#efedfc);padding-top:14px}
.ct-alert-record{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--v4-text2,#4c3d7a)}.ct-alert-record span{display:inline-flex;align-items:center;gap:5px}.ct-light{display:inline-block;width:8px;height:8px;border-radius:50%}.ct-light-orange{background:#d97706;box-shadow:0 0 0 3px #d9770622}.ct-light-green{background:#16a34a;box-shadow:0 0 0 3px #16a34a22}.ct-light-red{background:#dc2626;box-shadow:0 0 0 3px #dc262622}
.ct-situation-decideur{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--v4-text2,#4c3d7a)}
.ct-situation-decideur strong{color:var(--v4-text,#1a1433)}
`;

// Application d'un attribut : le nom seul ; la liste de choix s'ouvre au clic.
function AppPicker({ application, onChange }: { application: string; onChange: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button type="button" className="ct-ontology-app-select" title="Application — cliquer pour changer" onClick={e => { e.stopPropagation(); setEditing(true); }}>{application}</button>;
  return (
    <select autoFocus className="ct-ontology-app-select" aria-label="Application" value={SOURCE_CARDS.find(s => s.nom === application)?.id ?? ""} onBlur={() => setEditing(false)} onChange={e => { onChange(e.target.value); setEditing(false); }} onClick={e => e.stopPropagation()}>
      {!SOURCE_CARDS.some(s => s.nom === application) && <option value="">{application}</option>}
      {SOURCE_CARDS.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
    </select>
  );
}
