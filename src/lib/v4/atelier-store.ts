import { audit } from "../security/use-access";
// atelier-store.ts — localStorage CRUD for Atelier decision sessions

export type ImportanceBadge = "Essentiel" | "Important" | "Secondaire" | "Faible";
export type LeverType = "budget" | "ressource" | "temps" | "risque" | "decision" | "technique" | "autre";

export interface AtelierCriterion {
  id: string;
  label: string;
  poids: number;       // 0–100 → maps to ωᵢ ordinal weight
  description: string;
  importance: ImportanceBadge;
  locked?: boolean;    // user edited — don't overwrite
  level?: "MOE" | "MOP" | "TPM"; // position in the indicator hierarchy
  children?: AtelierCriterion[]; // sub-indicators (MOP under MOE, TPM under MOP)
  // Besoin exprimé (partie prenante/capacité/performance/contexte) que ce MOE trace — traçabilité amont, jamais chiffrée.
  besoinTrace?: string;
  // TPM uniquement : true si un modèle de comportement réel pourrait calculer cette valeur —
  // absent = jugement d'expert qualitatif (le cas normal, sans modèle physique disponible).
  modelisable?: boolean;
  // Objectifs (MOE) uniquement : axe couvert. N'entre dans AUCUN calcul — garantit seulement que
  // le modèle ne se limite pas à l'efficacité (perspective ch. VI de la thèse : étendre au coût
  // et au risque). Un coût élevé reste évalué en ordinal (−/−−), jamais en valeur chiffrée.
  nature?: "efficacite" | "cout" | "risque";
  // TPM uniquement : true si Aura juge cet indicateur particulièrement juste, précis et
  // inspirant — un angle de mesure auquel le décideur n'aurait probablement pas pensé seul.
  // Purement indicatif (même badge que les options de levier "exploratoire") : n'entre dans
  // aucun calcul, ne change ni l'importance ni le poids.
  exploratoire?: boolean;
}

// 5-level qualitative impact vocabulary (scales PS/NS of Lo MCD-E thesis) + U (unknown)
// PS (positive scale): ++ > + > 0   NS (negative scale): -- < - < 0
// Échelle ordinale de la thèse (NUL < L < M < H), avec le sens de l'effet :
// "+L" / "-L" = faible, "+" / "-" = moyen, "++" / "--" = fort.
export type QualitativeImpact = "++" | "+" | "+L" | "0" | "-L" | "-" | "--" | "U";

// Provenance d'un impact : qui a produit ce jugement, et a-t-il été validé par un humain ?
export type ImpactOrigin = "aura-llm" | "aura-heuristique" | "donnees";

export interface AtelierOptionDef {
  id: string;
  label: string;
  impacts: Record<string, QualitativeImpact>; // criterionId → impact
  // criterionId → origine, présent UNIQUEMENT tant que la cellule n'a pas été validée/modifiée par un humain.
  // Absent = jugement humain (ou confirmé). Permet d'afficher « Hypothèse Aura — à confirmer ».
  impactOrigins?: Record<string, ImpactOrigin>;
  // criterionId → raison qualitative de l'effet supposé (hypothèse d'Aura, jamais un chiffre).
  impactReasons?: Record<string, string>;
  // Option latérale proposée par Aura (Phase Exploration) — « on n'y avait pas pensé »
  exploratoire?: boolean;
  // Option suggérée par Aura (exploratoire) validée par l'utilisateur : elle entre alors dans le classement.
  validated?: boolean;
  // Justification qualitative courte : quel TPM/besoin cette option satisfait et comment — jamais un score.
  justification?: string;
  // Ids d'options d'autres leviers structurellement incompatibles avec celle-ci (couplage fort).
  incompatibleAvec?: string[];
}

export interface AtelierLevier {
  id: string;
  label: string;
  valeur: string;      // optionDef.id sélectionné
  type: LeverType;
  locked?: boolean;
  impact?: QualitativeImpact; // LEGACY — ignoré par le nouveau moteur
}

// Frame-level lever definition (Comprendre step) — options available for this lever
export interface AtelierLevierDef {
  id: string;
  label: string;
  type: LeverType;
  description?: string;
  options: AtelierOptionDef[];
}

export interface AtelierScenario {
  id: string;
  label: string;
  color: string;
  description: string;
  leviers: AtelierLevier[];
  scores: Record<string, number>; // criterionId → 0–100
  valeur: number;       // 0–100
  faisabilite: number;  // 0–100
  auraInsight?: string;
}

// New 4-step structure: Comprendre (merged context+criteria) → Impacter → Composer → Décider
// Legacy steps "amorce" | "criteres" | "scenarios" | "analyse" are migrated on load
export type AtelierStep = "comprendre" | "impacter" | "composer" | "decider" | "suivi";

export interface AtelierSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  contextRaw: string;        // user's natural language input
  problemType?: string;      // classified by LLM
  dimensions?: string[];     // 3–4 dimensions suggested by LLM
  playbookId?: string;       // matched playbook if any
  step: AtelierStep;
  attitude: "Pessimiste" | "Optimiste";  // persistent attitude selector
  criteria: AtelierCriterion[];
  leviersDef: AtelierLevierDef[]; // frame-level lever definitions (Comprendre)
  scenarios: AtelierScenario[];
  hypotheses: string[];      // decision hypotheses as chips
  contraintes: string[];     // constraints as chips
  auraRecommendation?: string;  // final LLM recommendation text
  alertId?: string;             // if created from an Argus alert
  alertLabel?: string;
  shared?: boolean;             // visible to other users when true
  discriminatingQuestions?: DiscriminatingQuestion[];  // adaptive questions generated after model
  discriminatingAnswers?: Record<string, string>;      // questionId → chosen answer
  contextEnriched?: string;  // contextRaw + discriminating answers, injected into downstream LLM calls
  caseType?: string;  // selected case type card (e.g. "nouveau_produit", "mecatronique", "strategique")
  archPattern?: "entreprise" | "applicative" | "data" | "infra" | "cyber";  // sub-pattern when caseType === "architecture"
  archAnswers?: Record<string, string>;  // réponses au questionnaire du pattern d'architecture choisi
  sector?: string;    // business domain / sector (e.g. "Transport", "Industrie", "Finance")
  elicitation?: Partial<ElicitationData>;
  modelValidated?: boolean;
  tieBreak?: { scenarioId: string; rationale: string; date: string }; // départage hors modèle, documenté (parmi des scénarios non discriminés)
  /** Fiche de décision signée depuis Arbitrer — conditions, preuves, hypothèses, alternative de repli. Jamais un score : uniquement ce qui a été lu tel quel dans le modèle. */
  decisionRecord?: {
    scenarioId: string; conditions: string[]; preuves: string[]; hypotheses: string[];
    fallbackScenarioId?: string; signedAt: string;
  };
  retainedScenarioId?: string; // "Option retenue" choisie explicitement par l'utilisateur (sinon la Recommandation Aura s'applique) — pilote la Carte, l'OKR et le Suivi
  /** Plan d'action de Suivre — généré par l'IA ou saisi à la main, toujours relatif à cette décision. Additif, optionnel. */
  actionPlan?: ActionPlan;
  /** Suivre : décision prise, 1 à 3 résultats clés mesurables, date de revue. */
  followUp?: import("./decision-express").DecisionFollowUp;
  /** Suivis des décisions précédentes, conservés quand la décision est révisée. */
  previousFollowUps?: import("./decision-express").DecisionFollowUp[];
  /** Décalages des nœuds de l'arbre d'Impacter déplacés à la main. */
  treeLayout?: Record<string, { x: number; y: number }>;
  /** Fil du mode « Décider vite » (mêmes données de modèle que le mode Détail). */
  dialogue?: { messages: { role: "aura" | "user"; text: string }[]; validated?: boolean; deductions?: import("./decision-dialogue").Deduction[] };
}

export interface ActionPlanAction {
  id: string;
  label: string;
  owner: string;
  dueDate: string; // libellé libre (ex. "J+15", "Q1 2026", ou une date ISO)
  status: "todo" | "progress" | "done";
  /** KR auquel cette action se rattache — même identifiant que le Suivi OKR
   *  (`${moeId}__${mopId}`). Absent ou ne correspondant à aucun KR réel de la
   *  session → l'action reste "non rattachée", jamais forcée sur un mauvais KR. */
  krId?: string;
}

export interface ActionPlan {
  actions: ActionPlanAction[];
  scenarioId?: string;   // scénario sur lequel le plan a été bâti
  generatedAt?: string;  // ISO date de la dernière génération IA
}

export interface ElicitationData {
  step: number;                           // current active step 0-5
  objectif: string;                       // step 2: main objective
  horizon: string;                        // step 2: time horizon pill
  decideurs: string;                      // step 3: who decides
  impactes: string;                       // step 3: who is impacted
  resistances: string;                    // step 3: who might resist
  exigencesNonNeg: string;               // step 3: non-negotiable requirements → MOE "Essentiel"
  risques: string[];                      // step 4: risk/constraint chips
  leviersDDP: string;                    // step 4: controllable variables (DDPs)
  contraintesDIP: string;               // step 4: imposed / uncontrollable factors (DIPs)
  pestelSelected: string[];               // step 5: checked PESTEL dimensions
  pestelAnswers: Record<string, string>;  // step 5: answer per dimension
  questionsCadrage?: string[];            // questions de cadrage proposées (Comprendre)
  /** Divergence entre une réponse déjà donnée et une nouvelle proposition (document, relecture) — jamais résolue en silence. */
  conflicts?: Array<{ field: string; label: string; current: string; suggested: string; source: string }>;
  /** Trace des divergences déjà tranchées par l'utilisateur — gardée pour audit. */
  resolutions?: Array<{ field: string; label: string; current: string; suggested: string; source: string; action: "use" | "keep"; at: string }>;
  /** Noms des documents déjà pris en compte — permet d'en ajouter d'autres ensuite sans perdre la trace des précédents. */
  documents?: string[];
}

export interface DiscriminatingQuestion {
  id: string;
  question: string;
  rationale: string;   // why this question matters for the arbitrage
  choices: Array<{ id: string; label: string }>;
}

const KEY = "aura-v4-atelier-sessions";
const listeners = new Set<() => void>();

// Migrate legacy step names to new 4-step structure
function migrateStep(step: string): AtelierStep {
  if (step === "amorce" || step === "criteres") return "comprendre";
  if (step === "scenarios") return "impacter";
  if (step === "analyse") return "decider";
  if (["comprendre", "impacter", "composer", "decider", "suivi"].includes(step)) return step as AtelierStep;
  return "comprendre";
}

function migrateCriterion(c: AtelierCriterion & { importance?: ImportanceBadge }): AtelierCriterion {
  const poids = c.poids ?? 20;
  return {
    ...c,
    importance: c.importance ?? (poids >= 35 ? "Essentiel" : poids >= 20 ? "Important" : poids >= 12 ? "Secondaire" : "Faible"),
  };
}

const LEGACY_IMPACT: Record<string, QualitativeImpact> = { "+": "+", "-": "-", "~": "0", "U": "U" };

// Normalize any stored impact symbol to the current 5-level PS/NS scale
function normalizeImpact(raw: string): QualitativeImpact {
  if (raw === "L+") return "+";
  if (raw === "L-") return "-";
  if (["++", "+", "0", "-", "--", "U"].includes(raw)) return raw as QualitativeImpact;
  return LEGACY_IMPACT[raw] ?? "0";
}

function migrateLevier(l: AtelierLevier & { type?: LeverType; impact?: string }): AtelierLevier {
  const raw = l.impact as string | undefined;
  const impact: QualitativeImpact | undefined = raw ? normalizeImpact(raw) : undefined;
  return { ...l, type: l.type ?? "autre", ...(impact !== undefined ? { impact } : {}) };
}

function migrateLevierDef(l: Record<string, unknown>): AtelierLevierDef {
  const rawOptions = (l.options as unknown[]) ?? [];
  const options: AtelierOptionDef[] = rawOptions.map((o, i) => {
    if (typeof o === "string") {
      return { id: `opt_${String(l.id)}_${i}`, label: o, impacts: {} };
    }
    const obj = o as AtelierOptionDef;
    // Normalize all stored impacts to current scale
    const impacts: Record<string, QualitativeImpact> = {};
    for (const [k, v] of Object.entries(obj.impacts ?? {})) {
      impacts[k] = normalizeImpact(String(v));
    }
    return {
      id: obj.id ?? `opt_${String(l.id)}_${i}`, label: obj.label ?? String(o), impacts,
      // Préserver la provenance des impacts proposés par Aura (à valider)
      ...(obj.impactOrigins ? { impactOrigins: obj.impactOrigins } : {}),
      ...(obj.impactReasons ? { impactReasons: obj.impactReasons } : {}),
      ...(obj.justification ? { justification: obj.justification } : {}),
      ...(obj.exploratoire ? { exploratoire: true } : {}),
      ...(obj.validated ? { validated: true } : {}),
    };
  });
  return { ...(l as unknown as AtelierLevierDef), options };
}

function migrateCriterionTree(c: AtelierCriterion): AtelierCriterion {
  return {
    ...migrateCriterion(c),
    children: c.children?.map(migrateCriterionTree),
  };
}

function migrateSession(raw: Record<string, unknown>): AtelierSession {
  const rawAttitude = raw.attitude as string;
  const attitude: "Pessimiste" | "Optimiste" =
    rawAttitude === "Optimiste" ? "Optimiste" : "Pessimiste"; // "Prudent" → "Pessimiste"
  return {
    ...(raw as unknown as AtelierSession),
    step: migrateStep(raw.step as string),
    attitude,
    hypotheses: (raw.hypotheses as string[]) ?? [],
    contraintes: (raw.contraintes as string[]) ?? [],
    leviersDef: ((raw.leviersDef as Record<string, unknown>[]) ?? []).map(migrateLevierDef),
    criteria: ((raw.criteria as AtelierCriterion[]) ?? []).map(migrateCriterionTree),
    scenarios: ((raw.scenarios as AtelierScenario[]) ?? []).map(s => ({
      ...s,
      leviers: (s.leviers ?? []).map(migrateLevier),
    })),
  };
}

export function loadSessions(): AtelierSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Record<string, unknown>[];
    return raw.map(migrateSession);
  }
  catch { return []; }
}

function persist(sessions: AtelierSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 20)));
  listeners.forEach(fn => fn());
}

const auditedAt = new Map<string, number>();
export function saveSession(s: AtelierSession): void {
  // Journal d'audit : une trace par décision et par minute au plus.
  const t = Date.now(); if ((t - (auditedAt.get(s.id) ?? 0)) > 60_000) { auditedAt.set(s.id, t); audit("decision.modification", s.title ?? s.id, { etape: String(s.step ?? "") }); }
  const all = loadSessions().filter(x => x.id !== s.id);
  persist([{ ...s, updatedAt: new Date().toISOString() }, ...all]);
}

// Clés annexes rattachées à une session (Sow, Transform, Exigences).
// Supprimées avec la session : aucune donnée fantôme ne survit à une analyse.
const SESSION_SCOPED_PREFIXES = ["aura-sow-mu-", "aura-transform-", "aura-exigences-"];

function purgeSessionKeys(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && SESSION_SCOPED_PREFIXES.some(p => k.startsWith(p) && k.slice(p.length).startsWith(sessionId))) doomed.push(k);
    }
    doomed.forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible */ }
}

/**
 * Nettoyage au lancement : les analyses enregistrées (sessions) sont MÉMORISÉES,
 * mais les données annexes orphelines (sessions supprimées ou évincées de la
 * limite de 20) sont vidées. Appelé une fois au montage de l'Atelier.
 */
export function garbageCollectSessionData(): void {
  if (typeof window === "undefined") return;
  try {
    const alive = new Set(loadSessions().map(s => s.id));
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const p of SESSION_SCOPED_PREFIXES) {
        if (!k.startsWith(p)) continue;
        const rest = k.slice(p.length);
        // l'id de session est le préfixe de `rest` (transform ajoute -<moeId>)
        if (![...alive].some(id => rest.startsWith(id))) doomed.push(k);
      }
    }
    doomed.forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible */ }
}

export function deleteSession(id: string): void {
  persist(loadSessions().filter(s => s.id !== id));
  purgeSessionKeys(id);
}

export function loadSession(id: string): AtelierSession | undefined {
  return loadSessions().find(s => s.id === id);
}

// Helpers for importance badge derivation from poids
export function importanceFromPoids(poids: number): ImportanceBadge {
  if (poids >= 35) return "Essentiel";
  if (poids >= 20) return "Important";
  if (poids >= 12) return "Secondaire";
  return "Faible";
}

export function onSessionsChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function newSession(opts: {
  contextRaw: string;
  title?: string;
  alertId?: string;
  alertLabel?: string;
  playbookId?: string;
  criteria?: AtelierCriterion[];
  scenarios?: AtelierScenario[];
  sector?: string;
}): AtelierSession {
  const id = `atelier-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id, createdAt: now, updatedAt: now,
    title: opts.title || opts.alertLabel || opts.contextRaw.slice(0, 60),
    contextRaw: opts.contextRaw,
    step: "comprendre",
    // Attitude par défaut : pessimiste (prudente) — choix du propriétaire d'Aura,
    // recommandé pour les décisions à fort enjeu (thèse M. Lô, ch. IV §3.1 p. 78 :
    // aversion au risque ; voir docs/guides/aura-decider-methode.pdf). Modifiable
    // par session (sélecteur d'attitude).
    attitude: "Pessimiste",
    hypotheses: [],
    contraintes: [],
    leviersDef: [],
    criteria: (opts.criteria ?? []).map(migrateCriterion),
    scenarios: (opts.scenarios ?? []).map(s => ({ ...s, leviers: s.leviers.map(migrateLevier) })),
    alertId: opts.alertId,
    alertLabel: opts.alertLabel,
    playbookId: opts.playbookId,
    sector: opts.sector,
  };
}

