// studio-vocab-store — vocabulaire métier minimal, applications sources
// (déclaratives), échantillons de données, mappings (vocab ↔ champ
// applicatif) et lecture "ontologie vivante" qui en résulte. Défini par un
// administrateur (cockpit.studio.tsx), consommé uniquement par
// Copilote Décideur. Local à ce module : ni Décider ni Architecturer n'y
// touchent, ni n'en dépendent.

import type { LiveEndpoint } from "./si-connector";
import { entityLabel, projectKey, rowLookup, ruleScope, type RowLookup, type RuleScope } from "./rule-scope";
import { fetchMaisonLucieCatalog, fetchMaisonLucieAppData, fetchMaisonLucieEvents, fetchMaisonLucieFile, MAISON_LUCIE_PORTAL } from "./maison-lucie-live";

export type KpiDirection = "au_dessus_alerte" | "en_dessous_alerte";

export interface KpiDef {
  id: string;
  label: string;        // ex. "Marge brute"
  unit: string;          // ex. "%", "K€", "jours"
  direction: KpiDirection; // le sens dans lequel franchir le seuil est mauvais
  seuilAlerte: number;
  seuilCritique: number;
  currentValue?: number; // dérivée du mapping si renseigné, sinon saisie manuelle
  updatedAt?: string;
  owner?: string;         // qui est responsable de cet indicateur — jamais un rôle système
  // Une alerte désactivée reste un indicateur suivi (affiché, mappé) mais ne
  // déclenche jamais le flux Comprendre→Impacter→Arbitrer ni les règles
  // causales qui en dépendent — géré depuis le Cockpit ou depuis Studio,
  // les deux lisent/écrivent le même vocabulaire.
  alertEnabled?: boolean; // par défaut true (undefined = activée)
  // Périmètre fonctionnel d'origine (Commercial, Finance, Supply Chain…) —
  // sert à organiser les suggestions LLM par domaine métier, jamais un calcul.
  perimetre?: string;
  // Attributs de l'objet métier que représente cet indicateur (ex. pour
  // "Marge brute" : "chiffre d'affaires", "coût des ventes") — proposés par
  // le LLM ou ajoutés à la main. Ce sont CES attributs, pas le libellé de
  // l'indicateur lui-même, qui doivent guider le rapprochement avec les
  // métadonnées des sources (voir semanticMatchKpi).
  attributs?: string[];
  // Rattachement optionnel à une entité métier du modèle entités-relations —
  // dit "cet indicateur mesure/concerne CET objet", au-delà du seul chiffre.
  entityId?: string;
}

// Une application source — déclarative : ce démonstrateur ne se connecte à
// rien de réel. Le "secret" n'est jamais stocké, seulement un indicateur
// symbolique qu'il a été renseigné (évite de faire croire à un vrai coffre).
export interface AppCredential {
  id: string;
  label: string;         // ex. "SAP S/4HANA — FI/CO"
  type: string;           // ex. "ERP", "CRM", "Data Warehouse"
  connectionHint: string; // ex. "API REST — endpoint interne, OAuth2"
  secretConfigured: boolean;
  // Métadonnées de configuration visibles dans Studio. Aucun secret brut :
  // secretRef pointe vers le coffre du déploiement et n'est jamais transmis au LLM.
  environment?: string;
  endpoint?: string;
  authMode?: string;
  secretRef?: string;
  // Identifiants strictement synthétiques, affichables dans les packs de démonstration.
  // Ne jamais utiliser ce champ pour un secret client ou de production.
  demoCredentials?: Array<{ label: string; value: string }>;
  sourceStatus?: "demo" | "configured" | "connected" | "error";
  lastSyncAt?: string;
  // Connexion réelle optionnelle vers un SI effectivement joignable (ex. le
  // banc de test aura-poc-paris-v2 sur AWS). Absent partout ailleurs : le
  // reste d'Aura reste 100% déclaratif. Le mot de passe n'est conservé que
  // le temps de la session admin — ce n'est pas un coffre-fort.
  liveEndpoint?: LiveEndpoint;
  // Une application désactivée reste déclarée (crédentials et mappings
  // conservés) mais ses champs ne remontent plus aucune valeur — l'équivalent
  // d'un "déconnecter" réversible, sans perdre la config. Par défaut activée
  // (undefined = true), pour ne pas casser les vocabulaires déjà enregistrés.
  enabled?: boolean;
}

// Un champ observé dans une application, avec un échantillon de valeurs —
// représentatif de ce qu'un vrai connecteur remonterait, jamais généré à la
// volée par une IA : saisi une fois par l'admin, pour rester crédible.
export interface AppField {
  id: string;
  appId: string;
  name: string;          // ex. "CO-PA.marge_brute_pct"
  sampleValues: string[]; // 3-6 valeurs d'exemple
  // Nom de la table/route côté SI réel (ex. "materials") — sert uniquement
  // si l'app parente a un liveEndpoint configuré, pour savoir quelle route
  // /api/<liveTable> interroger lors d'un rafraîchissement.
  liveTable?: string;
}

export type MappingMethod = "manuel" | "semantique" | "llm";

export interface MappingDef {
  id: string;
  kpiId: string;
  appId: string;
  fieldId: string;
  confidence?: number;   // 0–1, si issu d'un rapprochement automatique
  method: MappingMethod;
  rationale?: string;    // explication courte (LLM ou heuristique)
  // Sur quel attribut de l'objet métier ce champ a été rapproché (ex.
  // "coût des ventes") — absent si le rapprochement s'est fait sur le
  // libellé de l'indicateur faute d'attributs définis.
  attribut?: string;
  // Mapping contextuel — double-run legacy/nouveau SI : ce mapping n'est
  // actif que si la règle causale désignée a (ou n'a pas) été déclenchée.
  // Plusieurs mappings du même KPI peuvent coexister avec des conditions
  // différentes ; un seul sans condition sert de repli par défaut.
  condition?: { ruleId: string; whenTriggered: boolean };
}

// Une règle causale relie plusieurs indicateurs — "si A ET B sont en
// alerte/critique en même temps, c'est probablement Y" — propre à un
// secteur ou une problématique, jamais générique. Évaluée en continu contre
// les valeurs réelles (mappées via Studio), jamais simulée.
export type RuleSeverity = "alerte" | "critique";

// Une condition porte SOIT sur un KPI (feuille), SOIT sur le déclenchement
// d'une autre règle (chaînage) — jamais les deux. Le chaînage permet une
// "profondeur systématique" : une règle de niveau 2 peut conclure à partir
// de règles de niveau 1 déjà déclenchées, sans dupliquer leurs conditions.
export interface CausalCondition {
  kpiId?: string;
  minStatus?: RuleSeverity; // le KPI doit être au moins à ce niveau (avec kpiId)
  ruleId?: string;          // référence une autre CausalRule.id (chaînage)
}

export interface CausalRule {
  id: string;
  label: string;         // ex. "Risque de rupture de trésorerie"
  domaine?: string;
  // 1 condition = une alerte simple (un seul KPI franchit son seuil) ; 2+ =
  // une vraie corrélation causale entre plusieurs signaux. Les deux formes
  // partagent la même structure pour rester éditables au même endroit
  // (fusion demandée : "les règles causales" et "les alertes" ne sont qu'une
  // seule liste éditable, distinguée seulement par le nombre de conditions).
  conditions: CausalCondition[];
  conclusion: string;     // phrase causale en langage métier
  severity: RuleSeverity;
  origin: "manuel" | "llm";
  alertEnabled?: boolean; // par défaut true (undefined = activée)
  // Une règle suggérée par le LLM reste "à valider" tant qu'un humain ne l'a
  // pas revue — elle continue d'être évaluée (pour ne rien manquer) mais
  // s'affiche distinctement, jusqu'à validation ou rejet explicite. Une règle
  // créée manuellement est validée d'emblée.
  validation?: "validee" | "a_valider";
  // Étiquette de catégorie libre (ex. "Rupture", "Dégradation d'activité") —
  // sert uniquement à trier/filtrer dans Studio, aucun effet sur l'évaluation.
  tags?: string[];
  // ── Champs d'affichage riches (Cockpit) ──────────────────────────────────
  // Optionnels : une règle créée à la main dans Studio peut s'en passer
  // (la conclusion suffit). Portés ici pour que le Cockpit affiche une carte
  // complète sans dépendre d'un catalogue statique séparé — une règle EST
  // l'alerte, il n'y a plus deux objets à synchroniser.
  causes?: string[];               // puces courtes affichées sous la carte
  // Conséquences en chaîne (retard → TTS dépassé → rupture → marge perdue → décision),
  // affichées dans la chaîne de causalité de l'alerte.
  consequences?: string[];
  options?: string[];              // options de décision déjà identifiées
  decisionQuestion?: string;       // question posée au décideur
  expositionEur?: number;          // exposition financière — valeur d'exemple si non mappée à un KPI réel
  delaiLabel?: string;             // ex. "24 h" — délai avant impact, en texte libre
  siteLabel?: string;              // ex. "Fournisseur SUP-001 — Tessitura Milano"
  // Présent uniquement quand un enregistrement réel d'une source connectée
  // (Studio → Sources) correspond au signal — jamais une donnée inventée.
  grounded?: { sourceRecord: string; realFields: Record<string, string | number> };
  // `severity` (2 niveaux : alerte/critique) pilote l'évaluation en direct
  // (STATUS_RANK) ; `displaySeverity` (3 niveaux, optionnel) porte la
  // nuance d'affichage du catalogue d'origine ("majeure"/"mineure" se
  // rangent toutes deux sous "alerte" côté moteur). Absent = utiliser
  // `severity` tel quel pour l'affichage.
  displaySeverity?: "critique" | "majeure" | "mineure";
}

// Une capacité métier L4 (feuille d'une carte de capabilities L1→L4 générée
// pour un secteur) — associée à une ou plusieurs applications du catalogue
// ou déclarées à la main. Purement déclaratif : Aura n'exécute rien à
// partir de cette association, elle sert à documenter "quelle application
// répond à quelle capacité".
export interface CapabilityDef {
  id: string;
  l1: string;
  l2: string;
  l3: string;
  l4: string;
  appIds: string[];
}

// ── Modèle entités-relations ────────────────────────────────────────────────
// La couche "sémantique" qui grounde le Copilote au-delà des seuls KPI :
// un objet métier réel (Client, Fournisseur, Devis…), ses attributs propres
// (pas les mêmes que ceux d'un KPI — un attribut d'entité est un fait brut,
// un attribut de KPI est un signal de rapprochement), et les relations entre
// objets (Client --passe--> Commande). Un KPI peut être rattaché à une entité
// pour dire "cet indicateur mesure/concerne CET objet du métier" — c'est ce
// rattachement qui permettra un jour au Copilote de répondre "quels clients
// sont concernés par cette alerte", pas seulement "quelle est la valeur".
export interface EntityAttribute {
  id: string;
  name: string;          // ex. "Segment", "Date de dernière commande"
  type: "text" | "number" | "date" | "boolean";
}

export interface BusinessEntity {
  id: string;
  name: string;           // ex. "Client"
  description?: string;
  attributes: EntityAttribute[];
}

export type RelationshipCardinality = "1-1" | "1-N" | "N-N";

export interface EntityRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  label: string;           // ex. "passe" (Client passe Commande)
  cardinality: RelationshipCardinality;
}

// Un branchement "objet métier . attribut ← champ source" — la couche de
// mapping ontologique (distincte des MappingDef, qui relient un INDICATEUR à
// un champ). Un attribut peut avoir plusieurs branchements : un seul MASTER
// (source de référence) et des contributeurs. Rien n'est jamais deviné : un
// branchement n'existe que si un humain l'a posé (éventuellement en acceptant
// une suggestion du moteur de rapprochement).
export interface EntityMapping {
  id: string;
  entityId: string;
  attributeId: string;
  appId: string;
  fieldId: string;
  isMaster: boolean;
  confidence?: number;      // score du moteur de rapprochement, si accepté depuis une suggestion
  method: "manuel" | "semantique" | "hybride";
  rationale?: string;
}

// Un instantané de table lue sur un SI source réel — colonnes issues des
// métadonnées de la source, lignes telles que renvoyées par l'API. Jamais
// généré : uniquement ce que la source a réellement retourné, avec l'heure
// de lecture pour ne pas faire passer une lecture ancienne pour du temps réel.
export interface SiTableSnapshot {
  id: string;
  appId: string;
  table: string;
  columns: string[];
  rows: Record<string, string>[];
  fetchedAt: string;
}

export interface ArgusVocab {
  /** Version de la chaîne de démo Maison Lucie qui a produit ce vocabulaire (voir SUPPLY_DEMO_VERSION). */
  demoVersion?: string;
  domaine?: string;       // domaine métier courant — sert de contexte au LLM de vocabulaire
  kpis: KpiDef[];
  apps: AppCredential[];
  fields: AppField[];
  mappings: MappingDef[];
  causalRules: CausalRule[];
  capabilities?: CapabilityDef[];
  entities?: BusinessEntity[];
  relationships?: EntityRelationship[];
  entityMappings?: EntityMapping[];
  siTables?: SiTableSnapshot[];
  // Indicateurs et règles du catalogue standard que l'utilisateur a
  // supprimés : le catalogue ne les réinjecte plus.
  removedStandard?: { kpis?: string[]; rules?: string[] };
  // Positions des nœuds déplacés à la main, par schéma (« ontologie »,
  // « causal ») : versionnées avec le modèle, effacées par « Réorganiser ».
  layout?: Record<string, Record<string, { x: number; y: number }>>;
}


const KEY = "aura-v4-studio-vocab";
const LEGACY_KEY = "aura-v4-argus-vocab";
const listeners = new Set<() => void>();

export function onVocabChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function emptyVocab(): ArgusVocab {
  return { kpis: [], apps: [], fields: [], mappings: [], causalRules: [] };
}

// Exposé pour Studio ("Repartir de zéro") — un vocabulaire réellement vide,
// pas une démo. Distinct de buildDemoVocab : ne charge ni Maison Lucie ni
// aucun autre pack sectoriel, pour que l'utilisateur reparte connecter
// exactement les applications de son choix, sans rien à retirer d'abord.
export function blankVocab(): ArgusVocab {
  return emptyVocab();
}

// Catalogue standard de règles Supply Chain d'Aura, toujours présent : on
// fournit la logique (indicateurs, seuils, règles), jamais les faits d'un
// client (site, exposition, délai, enregistrement source) — ceux-ci viennent
// uniquement des sources connectées et mappées dans le Studio. Les réglages
// déjà faits par l'utilisateur (seuils, libellés, règles ajoutées) sont
// conservés.
/** Catalogue S14 (réseau) et S15 (transformation SI) : sortis des alertes, portés par les décisions stratégiques. */
export const MOVED_TO_STRATEGIC = new Set(["S14", "S15"]);
export function withSupplyChainRulebook(vocab: ArgusVocab): ArgusVocab {
  const standard = maisonLucieVocab();
  const currentKpis = new Map(vocab.kpis.map(kpi => [kpi.id, kpi]));
  const currentRules = new Map(vocab.causalRules.map(rule => [rule.id, rule]));
  const standardKpiIds = new Set(standard.kpis.map(kpi => kpi.id));
  const standardRuleIds = new Set(standard.causalRules.map(rule => rule.id));
  const removedKpis = new Set(vocab.removedStandard?.kpis ?? []);
  const removedRules = new Set(vocab.removedStandard?.rules ?? []);
  const kpis = [
    ...standard.kpis.filter(kpi => !removedKpis.has(kpi.id)).map(kpi => {
      const current = currentKpis.get(kpi.id);
      // Anciennes étiquettes propres à la démo ("… — SUP-001 (…)") ramenées au libellé générique.
      return current ? migrateStandardKpi({ ...current, label: current.label.includes(" — ") ? kpi.label : current.label }, kpi) : { ...kpi, currentValue: undefined, updatedAt: undefined };
    }),
    ...vocab.kpis.filter(kpi => !standardKpiIds.has(kpi.id)),
  ];
  const gapInPercent = kpis.find(kpi => kpi.id === "k-s6")?.unit === "%";
  return {
    ...vocab,
    kpis,
    causalRules: [
      ...standard.causalRules.filter(rule => !removedRules.has(rule.id)).map(rule => {
        const saved = currentRules.get(rule.id);
        const current = saved ? migrateStandardRule(saved, rule) : rule;
        // Les faits d'exemple du catalogue ne sont jamais publiés ; une valeur
        // saisie par l'utilisateur (différente du catalogue) est conservée.
        const own = <K extends "siteLabel" | "expositionEur" | "delaiLabel">(k: K) => current[k] === rule[k] ? undefined : current[k];
        // S14 et S15 ne sont pas des alertes quotidiennes : décisions stratégiques (strategic-decisions.ts).
        return { ...current, grounded: undefined, siteLabel: own("siteLabel"), expositionEur: own("expositionEur"), delaiLabel: own("delaiLabel"), ...(MOVED_TO_STRATEGIC.has(rule.id) ? { alertEnabled: false } : {}) };
      }),
      ...vocab.causalRules.filter(rule => !standardRuleIds.has(rule.id)),
    ],
    // L'ancien « Prévision de demande promue » lisait la quantité promue
    // (DemandForecast.promoted) : ce branchement n'a plus de sens pour
    // l'écart en %, il est retiré pour être reproposé sur la bonne colonne.
    mappings: vocab.mappings.filter(m => !(gapInPercent && m.kpiId === "k-s6" && /^DemandForecast\.promoted\b/.test(vocab.fields.find(f => f.id === m.fieldId)?.name ?? ""))),
  };
}

export function loadVocab(): ArgusVocab {
  if (typeof window === "undefined") return withSupplyChainRulebook(emptyVocab());
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? ({ ...emptyVocab(), ...JSON.parse(raw) } as ArgusVocab) : emptyVocab();
    if (raw && !localStorage.getItem(KEY)) localStorage.setItem(KEY, raw);
    // Anciennes connexions fictives (Maison Lumen, banc aura-poc-paris) retirées partout.
    const legacy = new Set(parsed.apps.filter(a => /lumen|aura-poc-paris|duckdns|nexerp|meridian/i.test([a.label, a.endpoint, a.connectionHint, (a.liveEndpoint as { baseUrl?: string } | undefined)?.baseUrl].filter(Boolean).join(" "))).map(a => a.id));
    if (legacy.size) {
      parsed.apps = parsed.apps.filter(a => !legacy.has(a.id));
      parsed.fields = parsed.fields.filter(f => !legacy.has(f.appId));
      parsed.mappings = parsed.mappings.filter(m => !legacy.has(m.appId));
      parsed.entityMappings = (parsed.entityMappings ?? []).filter(m => !legacy.has(m.appId));
      parsed.siTables = (parsed.siTables ?? []).filter(t => !legacy.has(t.appId));
    }
    return withSupplyChainRulebook(parsed);
  } catch {
    return withSupplyChainRulebook(emptyVocab());
  }
}

export function saveVocab(v: ArgusVocab): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(v));
  listeners.forEach(fn => fn());
}

export function kpiStatus(kpi: KpiDef): "ok" | "alerte" | "critique" {
  if (kpi.currentValue === undefined) return "ok";
  const v = kpi.currentValue;
  const worse = kpi.direction === "au_dessus_alerte"
    ? (a: number, b: number) => a >= b
    : (a: number, b: number) => a <= b;
  if (worse(v, kpi.seuilCritique)) return "critique";
  if (worse(v, kpi.seuilAlerte)) return "alerte";
  return "ok";
}

// Une alerte KPI n'est "active" que si son statut a franchi un seuil ET que
// l'alerte n'a pas été désactivée par le décideur ou l'admin — un indicateur
// désactivé reste visible mais ne déclenche jamais rien.
export function isAlertActive(kpi: KpiDef): boolean {
  return kpi.alertEnabled !== false && kpiStatus(kpi) !== "ok";
}

// Rapprochement sémantique — combine deux signaux lexicaux complémentaires,
// tous deux explicables (pas un embedding boîte noire) :
//  1. Jaccard sur tokens normalisés — capte les mots partagés ("Marge brute"
//     vs "marge_brute_pct").
//  2. Jaccard sur trigrammes de caractères — capte les abréviations et
//     variantes morphologiques que le découpage en mots rate ("Trésorerie"
//     vs "tresorerie_k", "CO-PA" vs "COPA").
// Le score retenu est le meilleur des deux : un fort recouvrement sur l'un
// suffit, inutile de les moyenner et de diluer un bon signal.
// Lexique métier FR → EN (et variantes) : les SI exposent souvent des noms
// anglais en camelCase (capacityRisk, daysOfCover) quand les indicateurs sont
// libellés en français. Chaque mot est ramené à une forme canonique commune.
const SYNONYMS: Record<string, string> = {
  risque: "risk", capacite: "capacity", fournisseur: "supplier", fournisseurs: "supplier", vendor: "supplier",
  global: "overall", globale: "overall", total: "overall", couverture: "cover", coverage: "cover",
  jours: "days", jour: "days", retard: "delay", retards: "delay", delai: "delay", lateness: "delay",
  transport: "shipment", expedition: "shipment", expeditions: "shipment", livraison: "shipment",
  prevision: "forecast", previsions: "forecast", demande: "demand", promue: "promoted", promo: "promoted", promotion: "promoted",
  article: "sku", produit: "sku", product: "sku", commande: "order", achat: "purchase", quantite: "quantity",
  heures: "hours", heure: "hours", site: "site", entrepot: "warehouse", securite: "safety", disponible: "available",
  inventory: "stock", inventaire: "stock", cout: "cost", marge: "margin", qualite: "quality", pays: "country", statut: "status",
  ecart: "gap", ecarts: "gap", geopolitique: "geopolitical", geopolitiques: "geopolitical",
  identifiant: "ident", identifier: "ident", client: "customer", clients: "customer", confirmee: "confirmed", confirme: "confirmed",
  transporteur: "carrier", origine: "origin", designation: "description", principal: "primary", material: "sku",
  perturbation: "disruption", perturbations: "disruption", gravite: "severity", intitule: "title", nom: "name",
  famille: "family", unitaire: "unit", journaliere: "daily", reserve: "reserved", semaine: "week", confiance: "confidence",
};

function tokenize(s: string): Set<string> {
  return new Set(
    s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      // « Id » (supplierId, purchaseOrderId) est le marqueur d'identifiant :
      // conservé sous une forme canonique au lieu d'être filtré (trop court).
      .map(w => w === "id" ? "ident" : w)
      .filter(w => w.length > 2 && !["des", "les", "the", "par", "and"].includes(w))
      .map(w => SYNONYMS[w] ?? w)
  );
}

function trigrams(s: string): Set<string> {
  const clean = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  if (clean.length < 3) return new Set(clean ? [clean] : []);
  const grams = new Set<string>();
  for (let i = 0; i <= clean.length - 3; i++) grams.add(clean.slice(i, i + 3));
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach(w => { if (b.has(w)) inter++; });
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

export interface MatchBreakdown {
  score: number;
  method: "tokens" | "trigrammes";
  tokenScore: number;
  trigramScore: number;
}

export function semanticMatch(kpiLabel: string, fieldName: string): MatchBreakdown {
  // Recouvrement mesuré sur le libellé recherché (le nom du champ porte en
  // plus son préfixe de table, qui ne doit pas diluer le score).
  // Couverture du libellé par le nom complet (table + champ), pondérée par la
  // précision sur le seul champ : « capacityRisk » bat « overallRisk » pour
  // « Risque de capacité fournisseur », même si les deux vivent dans la même table.
  const want = tokenize(kpiLabel);
  const splitCamel = (x: string) => x.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const column = fieldName.includes(".") ? fieldName.slice(fieldName.lastIndexOf(".") + 1) : fieldName;
  const haveAll = new Set([...tokenize(splitCamel(fieldName.split(".").slice(0, -1).join(" ").replace(/\(.*?\)/g, ""))), ...tokenize(column)]);
  const haveCol = tokenize(column);
  const coverage = want.size === 0 ? 0 : [...want].filter(w => haveAll.has(w)).length / want.size;
  const precision = haveCol.size === 0 ? 0 : [...haveCol].filter(w => want.has(w)).length / haveCol.size;
  const tokenScore = Math.round((0.6 * coverage + 0.4 * precision) * 100) / 100;
  const trigramScore = jaccard(trigrams(kpiLabel), trigrams(fieldName));
  return tokenScore >= trigramScore
    ? { score: tokenScore, method: "tokens", tokenScore, trigramScore }
    : { score: trigramScore, method: "trigrammes", tokenScore, trigramScore };
}

export function semanticScore(kpiLabel: string, fieldName: string): number {
  return semanticMatch(kpiLabel, fieldName).score;
}

export interface KpiMatchBreakdown extends MatchBreakdown {
  // Sur quoi le meilleur score a été trouvé — un attribut précis de l'objet
  // métier, ou à défaut le libellé de l'indicateur lui-même (aucun attribut
  // défini). C'est CE texte qui doit apparaître dans l'UI de mapping.
  matchedOn: string;
}

// Rapproche un champ applicatif du MEILLEUR candidat parmi les attributs de
// l'objet métier (kpi.attributs) — et seulement à défaut, du libellé de
// l'indicateur. Un indicateur enrichi d'attributs par le LLM se mappe donc
// sur ses attributs, pas sur son nom générique.
export function semanticMatchKpi(kpi: KpiDef, fieldName: string): KpiMatchBreakdown {
  const candidates = kpi.attributs?.length ? kpi.attributs : [kpi.label];
  let best: KpiMatchBreakdown = { ...semanticMatch(kpi.label, fieldName), matchedOn: kpi.label };
  for (const c of candidates) {
    const m = semanticMatch(c, fieldName);
    if (m.score > best.score) best = { ...m, matchedOn: c };
  }
  return best;
}

function toNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (raw === true || raw === "true") return 1;
  if (raw === false || raw === "false") return 0;
  const n = Number(String(raw).replace(",", ".").replace(/[^0-9.eE+-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

// Observation d'un indicateur : la valeur la plus défavorable parmi les
// enregistrements réellement lus (sens de l'alerte respecté), avec
// l'enregistrement source qui la porte — c'est ce qui justifie une alerte.
export interface KpiObservation {
  value: number;
  appId: string;
  appLabel: string;
  fieldName: string;
  table?: string;
  column: string;
  record?: Record<string, string>;
  recordCount: number;
  breachCount: number;
  fetchedAt?: string;
}

function observeMapping(vocab: ArgusVocab, mapping: MappingDef | undefined): KpiObservation | undefined {
  if (!mapping) return undefined;
  const field = vocab.fields.find(f => f.id === mapping.fieldId);
  if (!field) return undefined;
  // Une application déconnectée ne doit plus alimenter aucun indicateur —
  // le mapping reste défini (pour être repris tel quel à la reconnexion)
  // mais la valeur redevient "non dérivable", comme un champ jamais mappé.
  const app = vocab.apps.find(a => a.id === field.appId);
  if (app && app.enabled === false) return undefined;
  const kpi = vocab.kpis.find(k => k.id === mapping.kpiId);
  const higherIsWorse = kpi ? kpi.direction === "au_dessus_alerte" : true;
  const column = field.name.includes(".") ? field.name.slice(field.name.lastIndexOf(".") + 1).replace(/\s*\(.*\)$/, "") : field.name;
  const table = field.liveTable ?? (field.name.includes(".") ? field.name.slice(0, field.name.lastIndexOf(".")) : undefined);
  const snapshot = (vocab.siTables ?? []).find(t => t.appId === field.appId && (t.table === table || t.table === field.liveTable) && t.columns.includes(column));
  const candidates: { value: number; record?: Record<string, string> }[] = snapshot
    ? snapshot.rows.map(row => ({ value: toNumber(row[column]), record: row })).filter((c): c is { value: number; record: Record<string, string> } => c.value !== undefined)
    : field.sampleValues.map(v => ({ value: toNumber(v) })).filter((c): c is { value: number } => c.value !== undefined);
  if (candidates.length === 0) return undefined;
  const worst = candidates.reduce((a, b) => (higherIsWorse ? b.value > a.value : b.value < a.value) ? b : a);
  const breachCount = kpi ? candidates.filter(c => kpiStatus({ ...kpi, currentValue: c.value }) !== "ok").length : 0;
  return {
    value: worst.value, appId: field.appId, appLabel: app?.label ?? field.appId, fieldName: field.name, table, column,
    record: worst.record, recordCount: candidates.length, breachCount, fetchedAt: snapshot?.fetchedAt,
  };
}

function valueFromMapping(vocab: ArgusVocab, mapping: MappingDef | undefined): number | undefined {
  return observeMapping(vocab, mapping)?.value;
}

// Résolution "de base" (observedRows, plus bas) — ignore tout mapping conditionnel, prend le premier
// mapping SANS condition (ou à défaut le premier tout court). C'est
// volontairement cette version, jamais la version conditionnelle publique
// ci-dessous, qu'utilise l'évaluation des règles causales : une règle qui
// choisirait elle-même son mapping selon son propre résultat créerait un
// cycle valeur↔règle sans issue garantie.

// Valeur "actuelle" dérivée d'un mapping — prend le premier échantillon
// numérique du champ mappé. Un vrai connecteur remplacerait cette fonction,
// pas le reste du modèle.
//
// Double-run legacy/nouveau SI : un même concept (KPI) peut avoir PLUSIEURS
// mappings, chacun actif sous une condition différente (ex. "tant que la
// règle causale X n'est pas déclenchée, lire depuis l'ERP legacy ; une fois
// déclenchée [migration terminée], lire depuis le nouveau SI"). Les règles
// causales sont évaluées une seule fois avec la résolution DE BASE
// (observedRows, jamais conditionnelle) pour éviter tout cycle, puis le
// mapping dont la condition correspond à cet état est choisi ; à défaut, le
// mapping sans condition sert de repli.
export function deriveCurrentValue(vocab: ArgusVocab, kpiId: string): number | undefined {
  const mappings = vocab.mappings.filter(m => m.kpiId === kpiId);
  if (mappings.length === 0) return undefined;
  const conditional = mappings.filter(m => m.condition);
  if (conditional.length === 0) return valueFromMapping(vocab, mappings[0]);

  const ruleStates = evaluateCausalRules(vocab);
  const match = conditional.find(m => {
    const state = ruleStates.find(r => r.rule.id === m.condition!.ruleId);
    return state ? state.triggered === m.condition!.whenTriggered : false;
  });
  const fallback = mappings.find(m => !m.condition);
  return valueFromMapping(vocab, match ?? fallback ?? mappings[0]);
}

// Même résolution que deriveCurrentValue, avec la provenance complète.
export function deriveObservation(vocab: ArgusVocab, kpiId: string): KpiObservation | undefined {
  const mappings = vocab.mappings.filter(m => m.kpiId === kpiId);
  if (mappings.length === 0) return undefined;
  const conditional = mappings.filter(m => m.condition);
  if (conditional.length === 0) return observeMapping(vocab, mappings[0]);
  const ruleStates = evaluateCausalRules(vocab);
  const match = conditional.find(m => {
    const state = ruleStates.find(r => r.rule.id === m.condition!.ruleId);
    return state ? state.triggered === m.condition!.whenTriggered : false;
  });
  return observeMapping(vocab, match ?? mappings.find(m => !m.condition) ?? mappings[0]);
}

// Série par enregistrement d'un indicateur (un point par fournisseur, SKU,
// expédition…) lue dans l'instantané de la table source mappée.
export interface KpiSeriesPoint { name: string; value: number; status: "ok" | "alerte" | "critique" }
const ID_COLUMNS = ["supplierId", "supplier_id", "shipmentId", "purchaseOrderId", "sku", "siteId", "site_id", "id", "week", "period"];
export function kpiSeries(vocab: ArgusVocab, kpiId: string, limit = 24): KpiSeriesPoint[] {
  const kpi = vocab.kpis.find(k => k.id === kpiId);
  const mapping = vocab.mappings.find(m => m.kpiId === kpiId && !m.condition) ?? vocab.mappings.find(m => m.kpiId === kpiId);
  const field = mapping ? vocab.fields.find(f => f.id === mapping.fieldId) : undefined;
  if (!kpi || !field) return [];
  const base = field.name.replace(/\s*\(.*\)$/, "");
  const column = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  const table = field.liveTable ?? (base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : undefined);
  const snap = (vocab.siTables ?? []).find(t => t.appId === field.appId && t.table === table && t.columns.includes(column));
  if (!snap) return [];
  const ids = ID_COLUMNS.filter(c => snap.columns.includes(c) && c !== column).slice(0, 2);
  return snap.rows.flatMap((row, index) => {
    const value = toNumber(row[column]);
    if (value === undefined) return [];
    const name = ids.map(c => row[c]).filter(Boolean).join(" · ") || `#${index + 1}`;
    return [{ name, value, status: kpiStatus({ ...kpi, currentValue: value }) }];
  }).slice(0, limit);
}

const STATUS_RANK: Record<"ok" | RuleSeverity, number> = { ok: 0, alerte: 1, critique: 2 };

// ── Évaluation par entité ────────────────────────────────────────────────────
// Une règle se déclenche quand TOUTES ses conditions sont vraies POUR LA MÊME
// ENTITÉ MÉTIER (même fournisseur, même SKU sur un site, même expédition…),
// objet déduit de l'ontologie (voir rule-scope.ts). Une condition KPI se lit
// contre les valeurs réellement mappées (jamais sur une hypothèse : un KPI
// non mappé ne peut jamais déclencher) ; une condition "ruleId" se lit contre
// le résultat déjà connu d'une autre règle — c'est le mécanisme de chaînage.
export interface RuleEntityFact {
  kpiId: string;
  value: number;
  status: RuleSeverity;
  record?: Record<string, string>;
}

export interface RuleEntityMatch {
  entityId: string;
  key: string;       // ex. "SUP-003"
  label: string;     // ex. "SUP-003 · Shenzhen Atelier Components"
  gravity: number;   // plus grand = plus grave
  facts: RuleEntityFact[];
}

export interface CausalRuleEvaluation {
  rule: CausalRule;
  triggered: boolean;
  scope: RuleScope;
  // Entités qui déclenchent la règle, la plus grave en tête. Vide pour une
  // règle « globale » (valeurs sans clé) ou non déclenchée.
  matches: RuleEntityMatch[];
}

interface ResolvedRule { triggered: boolean; entityId?: string; keys?: Set<string> }

function observedRows(vocab: ArgusVocab, kpiId: string): { value: number; record?: Record<string, string> }[] {
  const mappings = vocab.mappings.filter(m => m.kpiId === kpiId);
  const mapping = mappings.find(m => !m.condition) ?? mappings[0];
  const field = mapping ? vocab.fields.find(f => f.id === mapping.fieldId) : undefined;
  if (!field) return [];
  const app = vocab.apps.find(a => a.id === field.appId);
  if (app && app.enabled === false) return [];
  const column = field.name.includes(".") ? field.name.slice(field.name.lastIndexOf(".") + 1).replace(/\s*\(.*\)$/, "") : field.name;
  const table = field.liveTable ?? (field.name.includes(".") ? field.name.slice(0, field.name.lastIndexOf(".")) : undefined);
  const snapshot = (vocab.siTables ?? []).find(t => t.appId === field.appId && (t.table === table || t.table === field.liveTable) && t.columns.includes(column));
  return snapshot
    ? snapshot.rows.flatMap(row => { const value = toNumber(row[column]); return value === undefined ? [] : [{ value, record: row }]; })
    : field.sampleValues.flatMap(v => { const value = toNumber(v); return value === undefined ? [] : [{ value }]; });
}

// Dépassement normalisé (0 au seuil d'alerte, 1 au seuil critique) : départage
// deux entités de même niveau.
function overshoot(kpi: KpiDef, value: number): number {
  const span = kpi.seuilCritique - kpi.seuilAlerte;
  if (span === 0) return 0;
  return Math.max(0, Math.min(5, (value - kpi.seuilAlerte) / span));
}

const factGravity = (kpi: KpiDef, f: RuleEntityFact) => STATUS_RANK[f.status] * 10 + overshoot(kpi, f.value);

interface ConditionOutcome {
  // Par clé d'entité : le fait le plus défavorable. Absent = condition globale.
  byKey?: Map<string, { fact: RuleEntityFact; label: string }>;
  global?: { ok: boolean; fact?: RuleEntityFact };
}

function evaluateKpiCondition(vocab: ArgusVocab, c: CausalCondition, index: number, scope: RuleScope, lookup: RowLookup): ConditionOutcome {
  const kpi = vocab.kpis.find(k => k.id === c.kpiId);
  if (!kpi || !c.minStatus) return { global: { ok: false } };
  const rows = observedRows(vocab, kpi.id);
  const statusOf = (v: number) => kpiStatus({ ...kpi, currentValue: v });
  const path = scope.paths[index];
  const keyed = scope.kind === "entite" && path && scope.entityId && rows.some(r => r.record);
  if (!keyed) {
    if (!rows.length) return { global: { ok: false } };
    const higherIsWorse = kpi.direction === "au_dessus_alerte";
    const worst = rows.reduce((a, b) => (higherIsWorse ? b.value > a.value : b.value < a.value) ? b : a);
    const status = statusOf(worst.value);
    const ok = STATUS_RANK[status] >= STATUS_RANK[c.minStatus];
    return { global: { ok, fact: ok ? { kpiId: kpi.id, value: worst.value, status: status as RuleSeverity, record: worst.record } : undefined } };
  }
  const byKey = new Map<string, { fact: RuleEntityFact; label: string }>();
  for (const r of rows) {
    if (!r.record) continue;
    const status = statusOf(r.value);
    if (STATUS_RANK[status] < STATUS_RANK[c.minStatus]) continue;
    const key = projectKey(r.record, scope.entityId!, path!, lookup);
    if (!key) continue;
    const fact: RuleEntityFact = { kpiId: kpi.id, value: r.value, status: status as RuleSeverity, record: r.record };
    const prev = byKey.get(key);
    if (!prev || factGravity(kpi, fact) > factGravity(kpi, prev.fact)) {
      byKey.set(key, { fact, label: prev?.label ?? entityLabel(scope.entityId!, key, r.record, path!.length === 0, lookup) });
    }
  }
  return { byKey };
}

function combineRule(
  vocab: ArgusVocab,
  rule: CausalRule,
  scope: RuleScope,
  kpiOutcomes: (ConditionOutcome | undefined)[],
  resolved: Map<string, ResolvedRule>,
): { triggered: boolean; matches: RuleEntityMatch[] } {
  const none = { triggered: false, matches: [] };
  // Une règle sans condition est un modèle de décision qualitatif disponible
  // dans le catalogue, pas une alerte active. Elle ne devient calculable
  // qu'après raccordement explicite à au moins une valeur ou une autre règle.
  if (rule.alertEnabled === false || rule.conditions.length === 0 || scope.kind === "incoherente") return none;
  let keys: Set<string> | undefined;
  const narrow = (set: Iterable<string>) => { const s = new Set(set); keys = keys ? new Set([...keys].filter(k => s.has(k))) : s; };
  const globalFacts: RuleEntityFact[] = [];
  for (const [i, c] of rule.conditions.entries()) {
    if (c.ruleId) {
      const r = resolved.get(c.ruleId);
      if (!r?.triggered) return none;
      // Même objet : la règle référencée doit être déclenchée pour la même entité.
      if (scope.kind === "entite" && r.entityId === scope.entityId && r.keys?.size) narrow(r.keys);
      continue;
    }
    const o = kpiOutcomes[i];
    if (!o) return none;
    if (o.global) { if (!o.global.ok) return none; if (o.global.fact) globalFacts.push(o.global.fact); continue; }
    narrow(o.byKey!.keys());
  }
  if (!keys) return { triggered: true, matches: [] };
  if (keys.size === 0) return none;
  const kpiById = new Map(vocab.kpis.map(k => [k.id, k]));
  const matches = [...keys].map(key => {
    let label = key;
    const facts: RuleEntityFact[] = [];
    for (const o of kpiOutcomes) {
      const hit = o?.byKey?.get(key);
      if (hit) { facts.push(hit.fact); if (label === key) label = hit.label; }
    }
    facts.push(...globalFacts);
    const gravity = facts.reduce((s, f) => s + factGravity(kpiById.get(f.kpiId)!, f), 0);
    return { entityId: scope.entityId!, key, label, gravity, facts };
  }).sort((a, b) => b.gravity - a.gravity || a.key.localeCompare(b.key));
  return { triggered: true, matches };
}

export function evaluateCausalRule(vocab: ArgusVocab, rule: CausalRule): boolean {
  if (rule.alertEnabled === false) return false;
  const inVocab = vocab.causalRules.some(r => r.id === rule.id);
  const all = evaluateCausalRules(inVocab ? vocab : { ...vocab, causalRules: [...vocab.causalRules, rule] });
  return all.find(r => r.rule.id === rule.id)?.triggered ?? false;
}

// Propagation en profondeur systématique : chaque passe réévalue toutes les
// règles à partir de l'état connu de la passe précédente, jusqu'à ce que plus
// aucun statut ne change (point fixe) ou qu'un plafond de passes soit atteint
// — le plafond garantit la terminaison même si l'admin a créé un cycle de
// dépendances entre règles (A dépend de B qui dépend de A), qui reste sinon
// impossible à empêcher côté saisie.
const MAX_CHAIN_DEPTH = 12;

export function evaluateCausalRules(vocab: ArgusVocab): CausalRuleEvaluation[] {
  const lookup = rowLookup(vocab);
  // Les conditions KPI ne dépendent pas du chaînage : lues une seule fois.
  const prepared = vocab.causalRules.map(rule => {
    const scope = ruleScope(vocab, rule.conditions);
    const outcomes = rule.conditions.map((c, i) => c.kpiId ? evaluateKpiCondition(vocab, c, i, scope, lookup) : undefined);
    return { rule, scope, outcomes };
  });
  let resolved = new Map<string, ResolvedRule>(vocab.causalRules.map(r => [r.id, { triggered: false }]));
  let results = prepared.map(p => ({ ...p, triggered: false, matches: [] as RuleEntityMatch[] }));
  for (let pass = 0; pass < MAX_CHAIN_DEPTH; pass++) {
    let changed = false;
    const next = new Map<string, ResolvedRule>();
    results = prepared.map(p => {
      const out = combineRule(vocab, p.rule, p.scope, p.outcomes, resolved);
      const keys = new Set(out.matches.map(m => m.key));
      const before = resolved.get(p.rule.id);
      if (out.triggered !== before?.triggered || keys.size !== (before?.keys?.size ?? 0) || [...keys].some(k => !before?.keys?.has(k))) changed = true;
      next.set(p.rule.id, { triggered: out.triggered, entityId: p.scope.entityId, keys });
      return { ...p, ...out };
    });
    resolved = next;
    if (!changed) break;
  }
  return results.map(r => ({ rule: r.rule, triggered: r.triggered, scope: r.scope, matches: r.matches }));
}

// ── Graphe causal ────────────────────────────────────────────────────────────
// Représentation en 3 colonnes (KPI → Règles → Conclusion) de ce qui a
// RÉELLEMENT été évalué — pas une maquette : chaque arête vient d'une vraie
// CausalCondition, chaque statut "déclenchée" vient du même evaluateCausalRules
// que celui utilisé par le Copilote. Une règle chaînée (condition ruleId) est
// reliée à la règle dont elle dépend, matérialisant la profondeur systématique.
export type CausalGraphNodeKind = "kpi" | "rule" | "conclusion";

export interface CausalGraphNode {
  id: string;
  kind: CausalGraphNodeKind;
  label: string;
  triggered?: boolean;   // pour les règles
  status?: "ok" | "alerte" | "critique"; // pour les KPI
}

export interface CausalGraphEdge {
  from: string;
  to: string;
}

export function buildCausalGraph(vocab: ArgusVocab): { nodes: CausalGraphNode[]; edges: CausalGraphEdge[] } {
  const evaluated = evaluateCausalRules(vocab);
  const nodes: CausalGraphNode[] = [];
  const edges: CausalGraphEdge[] = [];
  const seenKpi = new Set<string>();

  for (const { rule, triggered } of evaluated) {
    nodes.push({ id: rule.id, kind: "rule", label: rule.label, triggered });
    const conclusionId = `${rule.id}::conclusion`;
    nodes.push({ id: conclusionId, kind: "conclusion", label: rule.conclusion, triggered });
    edges.push({ from: rule.id, to: conclusionId });

    for (const c of rule.conditions) {
      if (c.ruleId) {
        edges.push({ from: c.ruleId, to: rule.id });
      } else if (c.kpiId) {
        const kpi = vocab.kpis.find(k => k.id === c.kpiId);
        if (!kpi) continue;
        if (!seenKpi.has(kpi.id)) {
          seenKpi.add(kpi.id);
          nodes.push({ id: kpi.id, kind: "kpi", label: kpi.label, status: kpiStatus({ ...kpi, currentValue: deriveCurrentValue(vocab, kpi.id) ?? kpi.currentValue }) });
        }
        edges.push({ from: kpi.id, to: rule.id });
      }
    }
  }
  return { nodes, edges };
}

// Lecture de préparation du vocabulaire — inspirée du "Decision Readiness"
// d'une ancienne vue Aura, mais recalculée ici depuis les vraies données
// locales (mapping, propriétaire, échantillon) plutôt qu'empruntée telle
// quelle : rien à voir avec un score Supabase qui n'existe pas dans ce
// module. 4 dimensions, une moyenne — jamais un vrai indicateur métier,
// juste de quoi repérer un vocabulaire mal préparé avant qu'il alimente
// Copilote Décideur.
export interface ReadinessScore {
  overall: number;
  coverage: number;        // % d'indicateurs mappés
  freshness: number;        // % d'indicateurs avec une valeur dérivable
  mappingConfidence: number; // confiance moyenne des mappings (0 si aucun)
  governance: number;       // % d'indicateurs avec un propriétaire assigné
}

export function computeReadiness(vocab: ArgusVocab): ReadinessScore {
  const n = vocab.kpis.length;
  if (n === 0) return { overall: 0, coverage: 0, freshness: 0, mappingConfidence: 0, governance: 0 };

  const mappedCount = vocab.kpis.filter(k => vocab.mappings.some(m => m.kpiId === k.id)).length;
  const coverage = Math.round((mappedCount / n) * 100);

  const freshCount = vocab.kpis.filter(k => deriveCurrentValue(vocab, k.id) !== undefined).length;
  const freshness = Math.round((freshCount / n) * 100);

  const confidences = vocab.mappings.map(m => m.confidence ?? (m.method === "manuel" ? 1 : 0.5));
  const mappingConfidence = confidences.length
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100)
    : 0;

  const ownedCount = vocab.kpis.filter(k => k.owner?.trim()).length;
  const governance = Math.round((ownedCount / n) * 100);

  const overall = Math.round(coverage * 0.35 + freshness * 0.25 + mappingConfidence * 0.2 + governance * 0.2);
  return { overall, coverage, freshness, mappingConfidence, governance };
}

// ── Démos sectorielles ──────────────────────────────────────────────────────
// Trois vocabulaires complets, cohérents de bout en bout (KPI → application
// → champ → mapping → règle causale), pour montrer Studio déjà rempli sans
// attendre un vrai raccordement SI. Purement déclaratif comme le reste de ce
// module — aucune fausse promesse de connexion réelle (secretConfigured
// reste true seulement pour l'affichage, jamais un vrai secret stocké).
export type DemoPreset = "luxe" | "industrie" | "energie" | "grdf" | "offre-energie" | "genai" | "retail-si" | "retail-energie";

export const DEMO_PRESETS: { id: DemoPreset; label: string; description: string }[] = [
  { id: "luxe", label: "Luxe & retail premium", description: "Maison de luxe — boutiques flagship, ERP retail et CRM clientèle" },
  { id: "industrie", label: "Industrie manufacturière", description: "Ligne de production — MES et GMAO" },
  { id: "energie", label: "Énergie & réseaux", description: "Réseau de distribution électrique — SCADA et supervision" },
  { id: "grdf", label: "GRDF — réseau gazier", description: "Fin de vie fonte grise et montée en charge du biométhane" },
  { id: "offre-energie", label: "Nouvelle offre d'énergie", description: "Structure de prix, engagement et promesse de service" },
  { id: "genai", label: "Assistant GenAI métier", description: "Make or buy — pilotage de l'adoption et de la dérive de coût" },
  { id: "retail-si", label: "SI Retail — gestion commerciale", description: "Bascule d'une solution de gestion commerciale et de stocks" },
  { id: "retail-energie", label: "SI Retail énergie B2C", description: "Relation client et facturation d'un fournisseur d'énergie B2C" },
];

export function buildDemoVocab(preset: DemoPreset): ArgusVocab {
  if (preset === "luxe") {
    return {
      domaine: "Maison de luxe — retail premium",
      entities: [
        { id: "e-boutique", name: "Boutique flagship", description: "Point de vente phare, Place Vendôme", attributes: [{ id: "a1", name: "Segment", type: "text" }] },
        { id: "e-merch", name: "Direction merchandising", description: "Pilotage de l'assortiment et des réassorts", attributes: [] },
      ],
      kpis: [
        { id: "k-rupture", label: "Taux de rupture de stock", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 8, seuilCritique: 15, currentValue: 11, entityId: "e-boutique", perimetre: "Merchandising" },
        { id: "k-panier", label: "Panier moyen", unit: "€", direction: "en_dessous_alerte", seuilAlerte: 1200, seuilCritique: 900, currentValue: 1050, entityId: "e-boutique", perimetre: "Ventes" },
        { id: "k-reassort", label: "Délai de réassort", unit: "jours", direction: "au_dessus_alerte", seuilAlerte: 10, seuilCritique: 21, currentValue: 18, entityId: "e-merch", perimetre: "Supply Chain" },
      ],
      apps: [
        { id: "app-erp", label: "SAP Retail — ERP", type: "ERP", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-crm", label: "Salesforce — CRM Clientèle", type: "CRM", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-rupture", appId: "app-erp", name: "STOCK.taux_rupture_pct", sampleValues: ["9.2", "11.4", "10.8"] },
        { id: "f-panier", appId: "app-crm", name: "VENTE.panier_moyen_eur", sampleValues: ["1080", "1050", "1120"] },
        { id: "f-reassort", appId: "app-erp", name: "APPRO.delai_reassort_j", sampleValues: ["16", "18", "19"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-rupture", appId: "app-erp", fieldId: "f-rupture", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-panier", appId: "app-crm", fieldId: "f-panier", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-reassort", appId: "app-erp", fieldId: "f-reassort", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Rupture + réassort lent", domaine: "Merchandising",
          conditions: [{ kpiId: "k-rupture", minStatus: "alerte" }, { kpiId: "k-reassort", minStatus: "alerte" }],
          conclusion: "La boutique flagship cumule rupture de stock et réassort lent — risque de perte de vente sur les pièces les plus demandées.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Vente", l2: "Point de vente", l3: "Gestion des stocks", l4: "Suivi des ruptures", appIds: ["app-erp"] },
        { id: "c2", l1: "Vente", l2: "Relation client", l3: "Connaissance client", l4: "Historique d'achat", appIds: ["app-crm"] },
        { id: "c3", l1: "Supply Chain", l2: "Approvisionnement", l3: "Réassort", l4: "Planification du réassort", appIds: ["app-erp"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e-boutique", toEntityId: "e-merch", label: "remonte ses besoins à", cardinality: "N-N" },
      ],
    };
  }
  if (preset === "industrie") {
    return {
      domaine: "Manufacture — production industrielle",
      entities: [
        { id: "e-ligne", name: "Ligne de production A", description: "Ligne principale, 3x8", attributes: [] },
        { id: "e-qualite", name: "Direction qualité", description: "Contrôle et conformité produit", attributes: [] },
      ],
      kpis: [
        { id: "k-rebut", label: "Taux de rebut", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 3, seuilCritique: 6, currentValue: 4.5, entityId: "e-ligne", perimetre: "Qualité" },
        { id: "k-oee", label: "OEE (Taux de rendement synthétique)", unit: "%", direction: "en_dessous_alerte", seuilAlerte: 75, seuilCritique: 60, currentValue: 68, entityId: "e-ligne", perimetre: "Production" },
        { id: "k-maint", label: "Délai de maintenance corrective", unit: "h", direction: "au_dessus_alerte", seuilAlerte: 4, seuilCritique: 8, currentValue: 6.5, entityId: "e-qualite", perimetre: "Maintenance" },
      ],
      apps: [
        { id: "app-mes", label: "MES — Manufacturing Execution System", type: "MES", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-gmao", label: "GMAO — Maintenance assistée", type: "GMAO", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-rebut", appId: "app-mes", name: "QUALITE.taux_rebut_pct", sampleValues: ["4.1", "4.5", "4.8"] },
        { id: "f-oee", appId: "app-mes", name: "PROD.oee_pct", sampleValues: ["70", "68", "66"] },
        { id: "f-maint", appId: "app-gmao", name: "INTERVENTION.delai_h", sampleValues: ["5.5", "6.5", "7"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-rebut", appId: "app-mes", fieldId: "f-rebut", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-oee", appId: "app-mes", fieldId: "f-oee", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-maint", appId: "app-gmao", fieldId: "f-maint", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Rebut élevé + OEE dégradé", domaine: "Production",
          conditions: [{ kpiId: "k-rebut", minStatus: "alerte" }, { kpiId: "k-oee", minStatus: "alerte" }],
          conclusion: "La ligne A cumule un rebut élevé et un rendement dégradé — signal probable d'une dérive machine à traiter avant l'arrêt de ligne.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Production", l2: "Fabrication", l3: "Suivi qualité", l4: "Mesure du taux de rebut", appIds: ["app-mes"] },
        { id: "c2", l1: "Production", l2: "Fabrication", l3: "Performance", l4: "Calcul OEE", appIds: ["app-mes"] },
        { id: "c3", l1: "Maintenance", l2: "Maintenance corrective", l3: "Intervention", l4: "Ordonnancement des interventions", appIds: ["app-gmao"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e-ligne", toEntityId: "e-qualite", label: "remonte ses non-conformités à", cardinality: "1-N" },
      ],
    };
  }
  if (preset === "energie") {
  return {
    domaine: "Réseau de distribution électrique",
    entities: [
      { id: "e1", name: "Directeur technique réseau", description: "Porteur du dossier", attributes: [] },
      { id: "e2", name: "Autorité de régulation", description: "Audits de conformité", attributes: [] },
    ],
    kpis: [
      { id: "k-dispo", label: "Taux de disponibilité réseau", unit: "%", direction: "en_dessous_alerte", seuilAlerte: 99, seuilCritique: 97, currentValue: 98, entityId: "e1", perimetre: "Exploitation" },
      { id: "k-detect", label: "Délai de détection de panne", unit: "min", direction: "au_dessus_alerte", seuilAlerte: 15, seuilCritique: 30, currentValue: 22, entityId: "e1", perimetre: "Supervision" },
      { id: "k-maintenue", label: "Coût de maintenance imprévue", unit: "K€", direction: "au_dessus_alerte", seuilAlerte: 50, seuilCritique: 120, currentValue: 78, entityId: "e2", perimetre: "Finance" },
    ],
    apps: [
      { id: "app-scada", label: "SCADA Nouvelle Génération", type: "Supervision", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      { id: "app-gmao", label: "GMAO Réseau", type: "GMAO", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
    ],
    fields: [
      { id: "f-dispo", appId: "app-scada", name: "SUPERVISION.disponibilite_pct", sampleValues: ["98.2", "98.0", "97.6"] },
      { id: "f-detect", appId: "app-scada", name: "SUPERVISION.delai_detection_min", sampleValues: ["19", "22", "26"] },
      { id: "f-cout", appId: "app-gmao", name: "MAINTENANCE.cout_impreu_keur", sampleValues: ["70", "78", "85"] },
    ],
    mappings: [
      { id: "m1", kpiId: "k-dispo", appId: "app-scada", fieldId: "f-dispo", method: "manuel", confidence: 1 },
      { id: "m2", kpiId: "k-detect", appId: "app-scada", fieldId: "f-detect", method: "manuel", confidence: 1 },
      { id: "m3", kpiId: "k-maintenue", appId: "app-gmao", fieldId: "f-cout", method: "manuel", confidence: 1 },
    ],
    causalRules: [
      {
        id: "r1", label: "Saturation + délai", domaine: "Exploitation",
        conditions: [{ kpiId: "k-dispo", minStatus: "alerte" }, { kpiId: "k-detect", minStatus: "critique" }],
        conclusion: "La disponibilité du réseau se dégrade ET les délais de détection dépassent le seuil critique — risque de rupture de continuité de service.",
        severity: "critique", origin: "manuel", validation: "validee",
      },
    ],
    capabilities: [
      { id: "c1", l1: "Exploitation", l2: "Supervision réseau", l3: "Surveillance temps réel", l4: "Détection d'anomalie", appIds: ["app-scada"] },
      { id: "c2", l1: "Maintenance", l2: "Maintenance corrective", l3: "Intervention", l4: "Planification des interventions", appIds: ["app-gmao"] },
    ],
    relationships: [
      { id: "rel1", fromEntityId: "e1", toEntityId: "e2", label: "rend compte à", cardinality: "1-N" },
    ],
  };
  }
  if (preset === "grdf") {
    return {
      domaine: "Réseau de distribution gaz — GRDF",
      entities: [
        { id: "e1", name: "Directeur technique réseau", description: "Porteur de la trajectoire de remplacement fonte grise", attributes: [] },
        { id: "e2", name: "Autorité de régulation (CRE)", description: "Contrôle la trajectoire réglementaire", attributes: [] },
        { id: "e3", name: "Méthaniseurs raccordés", description: "Producteurs de biométhane injecté sur le réseau", attributes: [] },
      ],
      kpis: [
        { id: "k-fonte", label: "Linéaire fonte grise restant à remplacer", unit: "km", direction: "au_dessus_alerte", seuilAlerte: 400, seuilCritique: 600, currentValue: 520, entityId: "e1", perimetre: "Renouvellement réseau" },
        { id: "k-biometh", label: "Points d'injection biométhane en attente", unit: "sites", direction: "au_dessus_alerte", seuilAlerte: 15, seuilCritique: 30, currentValue: 24, entityId: "e3", perimetre: "Raccordement" },
        { id: "k-incident", label: "Incidents réseau liés à la fonte grise", unit: "/mois", direction: "au_dessus_alerte", seuilAlerte: 2, seuilCritique: 5, currentValue: 4, entityId: "e1", perimetre: "Sécurité" },
      ],
      apps: [
        { id: "app-jumeau", label: "Jumeau numérique réseau", type: "Supervision", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-gmao", label: "GMAO Réseau", type: "GMAO", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-biomethane", label: "Plateforme IoT Biométhane", type: "IoT", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-fonte", appId: "app-jumeau", name: "RESEAU.lineaire_fonte_grise_km", sampleValues: ["540", "520", "505"] },
        { id: "f-biometh", appId: "app-biomethane", name: "RACCORDEMENT.points_en_attente", sampleValues: ["22", "24", "27"] },
        { id: "f-incident", appId: "app-gmao", name: "SECURITE.incidents_fonte_grise_mois", sampleValues: ["3", "4", "5"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-fonte", appId: "app-jumeau", fieldId: "f-fonte", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-biometh", appId: "app-biomethane", fieldId: "f-biometh", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-incident", appId: "app-gmao", fieldId: "f-incident", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Retard de remplacement + incidents en hausse", domaine: "Sécurité réseau",
          conditions: [{ kpiId: "k-fonte", minStatus: "critique" }, { kpiId: "k-incident", minStatus: "alerte" }],
          conclusion: "Le linéaire fonte grise restant dépasse le seuil critique ET les incidents remontent — risque de sanction réglementaire et d'incident grave si la trajectoire n'est pas réajustée.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
        {
          id: "r2", label: "Saturation biométhane", domaine: "Raccordement",
          conditions: [{ kpiId: "k-biometh", minStatus: "critique" }, { kpiId: "k-fonte", minStatus: "alerte" }],
          conclusion: "Trop de points de raccordement biométhane en attente pendant que le réseau reste fragilisé par la fonte grise — arbitrage nécessaire entre sécuriser et raccorder.",
          severity: "alerte", origin: "manuel", validation: "a_valider",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Réseau", l2: "Patrimoine", l3: "Renouvellement", l4: "Priorisation fonte grise", appIds: ["app-jumeau"] },
        { id: "c2", l1: "Réseau", l2: "Décarbonation", l3: "Injection biométhane", l4: "Suivi des raccordements", appIds: ["app-biomethane"] },
        { id: "c3", l1: "Maintenance", l2: "Maintenance corrective", l3: "Intervention", l4: "Ordonnancement des travaux", appIds: ["app-gmao"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e1", toEntityId: "e2", label: "rend compte à", cardinality: "1-N" },
        { id: "rel2", fromEntityId: "e3", toEntityId: "e1", label: "sollicite le raccordement auprès de", cardinality: "1-N" },
      ],
    };
  }
  if (preset === "offre-energie") {
    return {
      domaine: "Fournisseur d'énergie — offre grand public",
      entities: [
        { id: "e1", name: "Direction marketing offres", description: "Construit et met au marché les offres résidentielles", attributes: [] },
        { id: "e2", name: "Gestion de portefeuille d'énergie", description: "Couvre la position induite par les offres vendues", attributes: [] },
        { id: "e3", name: "Service clientèle", description: "Absorbe les demandes liées à la facturation", attributes: [] },
      ],
      kpis: [
        { id: "k-delai-offre", label: "Délai de mise au marché d'une offre", unit: "jours", direction: "au_dessus_alerte", seuilAlerte: 45, seuilCritique: 90, currentValue: 78, entityId: "e1", perimetre: "Marketing offres" },
        { id: "k-marge", label: "Marge unitaire de l'offre en vente", unit: "€/an/client", direction: "en_dessous_alerte", seuilAlerte: 60, seuilCritique: 30, currentValue: 42, entityId: "e2", perimetre: "Portefeuille" },
        { id: "k-appels", label: "Appels liés à l'incompréhension tarifaire", unit: "/1000 factures", direction: "au_dessus_alerte", seuilAlerte: 20, seuilCritique: 40, currentValue: 33, entityId: "e3", perimetre: "Service clientèle" },
      ],
      apps: [
        { id: "app-tarif", label: "Référentiel tarifaire", type: "Référentiel", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-fact", label: "Moteur de facturation", type: "Facturation", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-crm", label: "CRM Clientèle", type: "CRM", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-delai", appId: "app-tarif", name: "OFFRE.delai_mise_au_marche_j", sampleValues: ["72", "78", "84"] },
        { id: "f-marge", appId: "app-fact", name: "OFFRE.marge_unitaire_eur_an", sampleValues: ["45", "42", "39"] },
        { id: "f-appels", appId: "app-crm", name: "CONTACT.appels_tarif_pour_mille", sampleValues: ["29", "33", "36"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-delai-offre", appId: "app-tarif", fieldId: "f-delai", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-marge", appId: "app-fact", fieldId: "f-marge", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-appels", appId: "app-crm", fieldId: "f-appels", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Délai d'offre long + marge sous pression", domaine: "Marketing offres",
          conditions: [{ kpiId: "k-delai-offre", minStatus: "alerte" }, { kpiId: "k-marge", minStatus: "alerte" }],
          conclusion: "L'offre en vente perd de la marge alors qu'aucune offre de remplacement ne peut être mise au marché rapidement — le délai de paramétrage tarifaire devient le point bloquant.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
        {
          id: "r2", label: "Structure tarifaire mal comprise", domaine: "Service clientèle",
          conditions: [{ kpiId: "k-appels", minStatus: "alerte" }],
          conclusion: "La structure de prix retenue génère un volume d'appels anormal à la facturation — la lisibilité de l'offre est à réexaminer avant extension.",
          severity: "alerte", origin: "manuel", validation: "a_valider",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Commercial", l2: "Offre", l3: "Conception d'offre", l4: "Paramétrage tarifaire", appIds: ["app-tarif"] },
        { id: "c2", l1: "Clients", l2: "Facturation", l3: "Valorisation", l4: "Facturation par règles", appIds: ["app-fact"] },
        { id: "c3", l1: "Clients", l2: "Service", l3: "Réclamation", l4: "Explication de facture", appIds: ["app-crm"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e1", toEntityId: "e2", label: "transmet la position vendue à", cardinality: "1-N" },
        { id: "rel2", fromEntityId: "e1", toEntityId: "e3", label: "génère la charge de service de", cardinality: "1-N" },
      ],
    };
  }
  if (preset === "genai") {
    return {
      domaine: "Direction des systèmes d'information — assistant GenAI métier",
      entities: [
        { id: "e1", name: "Métier pilote", description: "Premier périmètre doté de l'assistant", attributes: [] },
        { id: "e2", name: "Direction de la conformité", description: "Contrôle l'usage des données et la traçabilité", attributes: [] },
        { id: "e3", name: "Exploitation de la plateforme", description: "Maintient l'index et l'assistant en service", attributes: [] },
      ],
      kpis: [
        { id: "k-cite", label: "Réponses sans source citée", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 5, seuilCritique: 15, currentValue: 12, entityId: "e2", perimetre: "Conformité" },
        { id: "k-usage", label: "Usage hebdomadaire par utilisateur habilité", unit: "requêtes", direction: "en_dessous_alerte", seuilAlerte: 5, seuilCritique: 2, currentValue: 3, entityId: "e1", perimetre: "Adoption" },
        { id: "k-cout", label: "Coût récurrent par utilisateur actif", unit: "€/mois", direction: "au_dessus_alerte", seuilAlerte: 25, seuilCritique: 60, currentValue: 41, entityId: "e3", perimetre: "Économie" },
      ],
      apps: [
        { id: "app-assist", label: "Assistant GenAI métier", type: "Assistant", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-index", label: "Index documentaire d'entreprise", type: "Recherche", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-audit", label: "Journal d'audit des usages", type: "Traçabilité", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-cite", appId: "app-audit", name: "REPONSE.sans_source_pct", sampleValues: ["9", "12", "14"] },
        { id: "f-usage", appId: "app-assist", name: "USAGE.requetes_hebdo_par_utilisateur", sampleValues: ["4", "3", "3"] },
        { id: "f-cout", appId: "app-assist", name: "COUT.eur_par_utilisateur_actif_mois", sampleValues: ["36", "41", "47"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-cite", appId: "app-audit", fieldId: "f-cite", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-usage", appId: "app-assist", fieldId: "f-usage", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-cout", appId: "app-assist", fieldId: "f-cout", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Réponses non sourcées", domaine: "Conformité",
          conditions: [{ kpiId: "k-cite", minStatus: "alerte" }],
          conclusion: "Une part des réponses n'est rattachée à aucun document identifié — l'ancrage documentaire doit être rendu strict avant toute extension de périmètre.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
        {
          id: "r2", label: "Coût qui monte sans usage qui suit", domaine: "Économie",
          conditions: [{ kpiId: "k-cout", minStatus: "alerte" }, { kpiId: "k-usage", minStatus: "alerte" }],
          conclusion: "Le coût par utilisateur actif augmente alors que l'usage reste faible — le modèle de facturation retenu et le périmètre de démarrage sont à réexaminer ensemble.",
          severity: "alerte", origin: "manuel", validation: "a_valider",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Numérique", l2: "Assistance", l3: "Recherche assistée", l4: "Citation des sources", appIds: ["app-assist", "app-index"] },
        { id: "c2", l1: "Numérique", l2: "Gouvernance", l3: "Traçabilité", l4: "Journal d'audit des usages", appIds: ["app-audit"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e1", toEntityId: "e2", label: "rend compte de ses usages à", cardinality: "1-N" },
        { id: "rel2", fromEntityId: "e3", toEntityId: "e1", label: "met la plateforme à disposition de", cardinality: "1-N" },
      ],
    };
  }
  if (preset === "retail-si") {
    return {
      domaine: "Enseigne de distribution — socle commercial et stocks",
      entities: [
        { id: "e1", name: "Réseau de magasins", description: "Exploitation quotidienne, encaissement et rayon", attributes: [] },
        { id: "e2", name: "Direction de l'approvisionnement", description: "Pilote le réassort et les commandes fournisseurs", attributes: [] },
        { id: "e3", name: "Direction commerciale", description: "Assortiment, prix et promotions", attributes: [] },
      ],
      kpis: [
        { id: "k-ecart", label: "Écart entre stock système et stock réel", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 3, seuilCritique: 7, currentValue: 6, entityId: "e1", perimetre: "Stocks" },
        { id: "k-rupture", label: "Taux de rupture en rayon", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 4, seuilCritique: 8, currentValue: 7, entityId: "e2", perimetre: "Disponibilité" },
        { id: "k-indispo", label: "Indisponibilité de l'encaissement en heures d'ouverture", unit: "min/mois", direction: "au_dessus_alerte", seuilAlerte: 15, seuilCritique: 45, currentValue: 28, entityId: "e1", perimetre: "Exploitation" },
      ],
      apps: [
        { id: "app-caisse", label: "Encaissement magasin", type: "Caisse", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-stock", label: "Gestion des stocks", type: "Stocks", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-art", label: "Référentiel article et prix", type: "Référentiel", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-ecart", appId: "app-stock", name: "INVENTAIRE.ecart_stock_pct", sampleValues: ["5", "6", "7"] },
        { id: "f-rupture", appId: "app-stock", name: "RAYON.taux_rupture_pct", sampleValues: ["6", "7", "8"] },
        { id: "f-indispo", appId: "app-caisse", name: "EXPLOITATION.indispo_min_mois", sampleValues: ["21", "28", "34"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-ecart", appId: "app-stock", fieldId: "f-ecart", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-rupture", appId: "app-stock", fieldId: "f-rupture", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-indispo", appId: "app-caisse", fieldId: "f-indispo", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Stock faux + rupture en rayon", domaine: "Disponibilité",
          conditions: [{ kpiId: "k-ecart", minStatus: "alerte" }, { kpiId: "k-rupture", minStatus: "alerte" }],
          conclusion: "Le réassort est calculé sur un stock faux : la rupture en rayon ne se réglera pas par la commande, mais par la fiabilisation du stock temps réel.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
        {
          id: "r2", label: "Encaissement indisponible", domaine: "Exploitation",
          conditions: [{ kpiId: "k-indispo", minStatus: "alerte" }],
          conclusion: "L'encaissement dépend du lien réseau en heures d'ouverture — l'autonomie locale de la caisse est une exigence, pas une option.",
          severity: "alerte", origin: "manuel", validation: "a_valider",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Vente", l2: "Point de vente", l3: "Encaissement", l4: "Mode dégradé autonome", appIds: ["app-caisse"] },
        { id: "c2", l1: "Supply Chain", l2: "Stocks", l3: "Stock magasin", l4: "Stock temps réel", appIds: ["app-stock"] },
        { id: "c3", l1: "Commercial", l2: "Offre", l3: "Assortiment", l4: "Assortiment par format", appIds: ["app-art"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e3", toEntityId: "e1", label: "définit l'assortiment de", cardinality: "1-N" },
        { id: "rel2", fromEntityId: "e2", toEntityId: "e1", label: "approvisionne", cardinality: "1-N" },
      ],
    };
  }
  if (preset === "retail-energie") {
    return {
      domaine: "Fournisseur d'énergie B2C — chaîne clientèle et facturation",
      entities: [
        { id: "e1", name: "Direction facturation", description: "Tient le cycle de facturation du portefeuille", attributes: [] },
        { id: "e2", name: "Service clientèle", description: "Explique la facture et traite les réclamations", attributes: [] },
        { id: "e3", name: "Gestionnaire de réseau de distribution", description: "Fournit les mesures de comptage", attributes: [] },
      ],
      kpis: [
        { id: "k-err", label: "Factures à corriger", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 1.5, seuilCritique: 4, currentValue: 3.2, entityId: "e1", perimetre: "Facturation" },
        { id: "k-cycle", label: "Retard sur la fenêtre de facturation", unit: "jours", direction: "au_dessus_alerte", seuilAlerte: 2, seuilCritique: 5, currentValue: 4, entityId: "e1", perimetre: "Facturation" },
        { id: "k-rejets", label: "Flux de comptage rejetés", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 2, seuilCritique: 5, currentValue: 4.5, entityId: "e3", perimetre: "Données de comptage" },
      ],
      apps: [
        { id: "app-hub", label: "Hub des flux de comptage", type: "Intégration", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-fact", label: "Moteur de facturation énergie", type: "Facturation", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
        { id: "app-crm", label: "Relation client et service", type: "CRM", connectionHint: "API REST — endpoint interne, OAuth2", secretConfigured: true },
      ],
      fields: [
        { id: "f-err", appId: "app-fact", name: "FACTURE.a_corriger_pct", sampleValues: ["2.8", "3.2", "3.6"] },
        { id: "f-cycle", appId: "app-fact", name: "CYCLE.retard_jours", sampleValues: ["3", "4", "5"] },
        { id: "f-rejets", appId: "app-hub", name: "FLUX.rejetes_pct", sampleValues: ["3.9", "4.5", "5.1"] },
      ],
      mappings: [
        { id: "m1", kpiId: "k-err", appId: "app-fact", fieldId: "f-err", method: "manuel", confidence: 1 },
        { id: "m2", kpiId: "k-cycle", appId: "app-fact", fieldId: "f-cycle", method: "manuel", confidence: 1 },
        { id: "m3", kpiId: "k-rejets", appId: "app-hub", fieldId: "f-rejets", method: "manuel", confidence: 1 },
      ],
      causalRules: [
        {
          id: "r1", label: "Rejets de flux + factures à corriger", domaine: "Facturation",
          conditions: [{ kpiId: "k-rejets", minStatus: "alerte" }, { kpiId: "k-err", minStatus: "alerte" }],
          conclusion: "Les erreurs de facturation suivent les rejets de flux de comptage : c'est la chaîne d'acquisition et sa capacité de rejeu qu'il faut traiter, pas le moteur de facturation.",
          severity: "critique", origin: "manuel", validation: "validee",
        },
        {
          id: "r2", label: "Cycle de facturation en retard", domaine: "Trésorerie",
          conditions: [{ kpiId: "k-cycle", minStatus: "alerte" }],
          conclusion: "Le cycle sort de sa fenêtre : l'encaissement se décale et la trésorerie porte l'écart. La bascule par cohortes devient préférable à une bascule totale.",
          severity: "alerte", origin: "manuel", validation: "a_valider",
        },
      ],
      capabilities: [
        { id: "c1", l1: "Clients", l2: "Facturation", l3: "Valorisation", l4: "Facturation sur courbe de charge", appIds: ["app-fact"] },
        { id: "c2", l1: "Données", l2: "Comptage", l3: "Acquisition", l4: "Rejeu d'un flux erroné", appIds: ["app-hub"] },
        { id: "c3", l1: "Clients", l2: "Service", l3: "Réclamation", l4: "Explication de facture", appIds: ["app-crm", "app-fact"] },
      ],
      relationships: [
        { id: "rel1", fromEntityId: "e3", toEntityId: "e1", label: "fournit les mesures à", cardinality: "1-N" },
        { id: "rel2", fromEntityId: "e1", toEntityId: "e2", label: "transmet les factures émises à", cardinality: "1-N" },
      ],
    };
  }
  throw new Error(`Preset de démo inconnu : ${preset}`);
}

// Textes des 5 règles ancrées : la conclusion est une phrase causale (ce que
// le signal établit), distincte de la question de décision posée ensuite.
const S1_CONCLUSION = "La capacité du fournisseur ne couvre plus les commandes engagées : risque de rupture d'approvisionnement.";
const S1_CAUSES = ["Score de risque de capacité lu (niveau, pas une probabilité) au-delà du seuil", "Commandes en cours sur ce fournisseur"];
const S1_OPTIONS = ["Accélérer les commandes (expedite)", "Double sourcing", "Stock tampon", "Substitution", "Allocation", "Reconception", "Soutien fournisseur"];
const S2_CONCLUSION = "Le stock disponible ne couvre plus la demande jusqu'au prochain réapprovisionnement : risque de rupture sur le site.";
const S2_CAUSES = ["Couverture lue par site (APS, MRP) sous le seuil", "Réapprovisionnement pas encore arrivé"];
const S2_OPTIONS = ["Réapprovisionnement", "Transfert inter-site", "Allocation client", "Substitution", "Accélérer une livraison", "Ajustement du stock de sécurité"];
const S4_CONCLUSION = "Une expédition entrante accuse un retard critique : les besoins qu'elle devait couvrir sont menacés.";
const S4_CAUSES = ["Retard d'expédition au-delà du seuil critique", "ETA en dérive par rapport au plan"];
const S6_CONCLUSION = "La prévision promue s'écarte de la baseline au-delà de l'effet promotionnel planifié : achats, stock et capacité reposent sur une demande incertaine.";
const S6_CAUSES = ["Écart de prévision non expliqué par la promotion au-delà du seuil", "Biais ou rupture de tendance faussant achats/stock/capacité"];
const S9_CONDITIONS: CausalCondition[] = [{ kpiId: "k-s10", minStatus: "alerte" }];
const S9_CONCLUSION = "Un fournisseur est exposé à un risque géopolitique élevé : le flux qu'il alimente peut être interrompu.";

// Valeurs d'origine des champs corrigés : un vocabulaire enregistré qui les
// porte encore telles quelles (jamais modifiées par l'utilisateur) reçoit la
// nouvelle version ; une valeur personnalisée est conservée.
const LEGACY_RULE_FIELDS: Record<string, Partial<CausalRule>> = {
  S1: { conclusion: "Sécuriser, remplacer, accélérer ou accepter le risque ?", causes: ["Probabilité de retard ou défaut fournisseur", "Couverture insuffisante sur composant critique"], options: ["Expedite", "Dual sourcing", "Stock tampon", "Substitution", "Allocation", "Redesign", "Soutien fournisseur"] },
  S2: { label: "Stock projeté sous seuil", conclusion: "Commander, transférer, prioriser, substituer ou modifier le service ?", causes: ["Stock projeté sous le seuil de sécurité", "Réapprovisionnement pas encore arrivé"], options: ["Réapprovisionnement", "Transfert inter-site", "Allocation client", "Substitution", "Expedite", "Ajustement safety stock"] },
  S4: { conclusion: "Attendre, rerouter, changer de mode, sourcer localement ou replanifier ?", causes: ["ETA en dérive", "Date limite compatible production dépassée"] },
  S6: { conclusion: "Quelle prévision retenir et quelles décisions aval replanifier ?", causes: ["Biais ou erreur de prévision au-delà du seuil", "Rupture de tendance faussant achats/stock/capacité"] },
  S9: { conditions: [{ kpiId: "k-s9", minStatus: "alerte" }], conclusion: "Que sécuriser, diversifier, relocaliser ou prépositionner ?" },
};
const LEGACY_KPI_S6 = { label: "Prévision de demande promue", unit: "unités", seuilAlerte: 1000, seuilCritique: 1500 };
const LEGACY_ENTITY_IDS = new Set(["e-fournisseur"]);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function migrateStandardKpi(current: KpiDef, standard: KpiDef): KpiDef {
  let next = current;
  if (current.id === "k-s6" && current.label === LEGACY_KPI_S6.label && current.unit === LEGACY_KPI_S6.unit
    && current.seuilAlerte === LEGACY_KPI_S6.seuilAlerte && current.seuilCritique === LEGACY_KPI_S6.seuilCritique) {
    next = { ...current, label: standard.label, unit: standard.unit, seuilAlerte: standard.seuilAlerte, seuilCritique: standard.seuilCritique, attributs: standard.attributs, currentValue: undefined };
  }
  if (next.entityId && LEGACY_ENTITY_IDS.has(next.entityId)) next = { ...next, entityId: standard.entityId };
  return next;
}

function migrateStandardRule(current: CausalRule, standard: CausalRule): CausalRule {
  const legacy = LEGACY_RULE_FIELDS[current.id];
  if (!legacy) return current;
  const next: CausalRule = { ...current };
  for (const key of Object.keys(legacy) as (keyof CausalRule)[]) {
    if (same(current[key], legacy[key])) (next as unknown as Record<string, unknown>)[key] = standard[key];
  }
  return next;
}

export function maisonLucieVocab(): ArgusVocab {
  const base = buildDemoVocab("luxe");
  const portal = MAISON_LUCIE_PORTAL;
  const apps: AppCredential[] = [
    {
      id: "ml-sap", label: "Lucie S/4 Core · SAP S/4HANA-inspired", type: "ERP",
      connectionHint: "REST / OData-like · fournisseurs, produits et commandes",
      endpoint: `${portal}/api/data/sap-s4`, environment: "Maison Lucie · Synthetic",
      authMode: "Basic Auth", secretRef: "demo://maison-lucie/sap-s4",
      demoCredentials: [{ label: "username", value: "aura_demo" }, { label: "password", value: "LUCIE-DEMO-ONLY" }, { label: "tenant", value: "lucie-fr-100" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-wms", label: "Lucie Active Warehouse · Manhattan Active WM-inspired", type: "WMS",
      connectionHint: "REST + événements · stock, réservations et stock de sécurité",
      endpoint: `${portal}/api/data/manhattan-wms`, environment: "Maison Lucie · Synthetic",
      authMode: "API Key · x-api-key", secretRef: "demo://maison-lucie/manhattan-wms",
      demoCredentials: [{ label: "x-api-key", value: "lucie_wms_demo_key" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-tms", label: "Lucie Luminate Transport · Blue Yonder-inspired", type: "TMS",
      connectionHint: "REST + webhook · expéditions, ETA et perturbations",
      endpoint: `${portal}/api/data/blueyonder-tms`, environment: "Maison Lucie · Synthetic",
      authMode: "OAuth 2.0 · Client Credentials", secretRef: "demo://maison-lucie/blueyonder-tms",
      demoCredentials: [{ label: "client_id", value: "aura-lucie-demo" }, { label: "client_secret", value: "DEMO-NOT-A-SECRET" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-risk", label: "Lucie SpendGuard · Coupa Supplier Risk-inspired", type: "Supplier Risk",
      connectionHint: "GraphQL-like · risques financier, pays, qualité et capacité",
      endpoint: `${portal}/api/data/coupa-risk`, environment: "Maison Lucie · Synthetic",
      authMode: "Bearer Token", secretRef: "demo://maison-lucie/coupa-risk",
      demoCredentials: [{ label: "token", value: "lucie_demo_bearer_token" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      // Le catalogue réel de cette application se décrit comme "SQL API-like
      // + CSV export" (voir applications[].protocol dans demo-data.js) : le
      // canal API JSON est lu ici (/api/data/snowflake-demand) ; le canal
      // CSV correspondant (data/demand-forecast.csv) est désormais exposé
      // séparément par le portail public via /api/files — voir l'application
      // "ml-files" ci-dessous, qui l'ingère réellement.
      id: "ml-demand", label: "Lucie Data Cloud · Snowflake-inspired", type: "Data Cloud",
      connectionHint: "SQL API-like · prévisions, marge et ventes (export CSV détaillé disponible via Lucie Batch Hub)",
      endpoint: `${portal}/api/data/snowflake-demand`, environment: "Maison Lucie · Synthetic",
      authMode: "Key Pair", secretRef: "demo://maison-lucie/snowflake-demand",
      demoCredentials: [{ label: "bearer_token", value: "DEMO-KEY-NOT-USABLE" }, { label: "account", value: "lucie-demo.eu-west" }, { label: "warehouse", value: "AURA_DEMO_WH" }, { label: "role", value: "AURA_READER" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-events", label: "Lucie Anypoint Hub · MuleSoft-inspired", type: "Event Hub",
      connectionHint: "CloudEvents HTTP · événements et observabilité d'intégration",
      endpoint: `${portal}/api/data/mulesoft-events`, environment: "Maison Lucie · Synthetic",
      authMode: "Client ID enforcement", secretRef: "demo://maison-lucie/integration-hub",
      demoCredentials: [{ label: "client_id", value: "aura-demo-client" }, { label: "client_secret", value: "DEMO-ONLY" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-rest-orders", label: "Lucie Fusion Order Cloud · Oracle-inspired", type: "Order Management",
      connectionHint: "REST API · commandes et allocation",
      endpoint: `${portal}/api/data/rest-order-management`, environment: "Maison Lucie · Synthetic",
      authMode: "Bearer token", secretRef: "demo://maison-lucie/rest-order-management",
      demoCredentials: [{ label: "bearer_token", value: "lucie_rest_demo_token" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-kafka", label: "Lucie Event Stream · Kafka-compatible", type: "Event Streaming",
      connectionHint: "Kafka-compatible HTTP bridge · publication et consommation",
      endpoint: `${portal}/api/kafka`, environment: "Maison Lucie · Synthetic",
      authMode: "Client ID enforcement", secretRef: "demo://maison-lucie/kafka-stream",
      demoCredentials: [{ label: "client_id", value: "aura-demo-client" }, { label: "client_secret", value: "DEMO-ONLY" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-soap", label: "Lucie Legacy ERP · SOAP 1.1", type: "ERP legacy",
      connectionHint: "SOAP 1.1 + WSDL · commandes d'achat",
      endpoint: `${portal}/api/soap`, environment: "Maison Lucie · Synthetic",
      authMode: "Basic Auth", secretRef: "demo://maison-lucie/legacy-soap",
      demoCredentials: [{ label: "username", value: "aura_demo" }, { label: "password", value: "LUCIE-DEMO-ONLY" }, { label: "tenant", value: "lucie-fr-100" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    {
      id: "ml-webhook", label: "Lucie Integration Webhooks · Boomi/MuleSoft-inspired", type: "Event Gateway",
      connectionHint: "Webhook HTTPS · réception d'événements métier",
      endpoint: `${portal}/api/webhooks`, environment: "Maison Lucie · Synthetic",
      authMode: "Client ID enforcement", secretRef: "demo://maison-lucie/webhook-gateway",
      demoCredentials: [{ label: "client_id", value: "aura-demo-client" }, { label: "client_secret", value: "DEMO-ONLY" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
    // Le portail expose désormais réellement les 2 exports CSV annoncés par
    // son propre catalogue (contracts.files dans /api/catalog) — servis par
    // GET /api/files/<name>, authentifiés par X-API-Key (voir
    // api/files/[name].js du dépôt). Ce n'est pas une des 6 "applications"
    // du catalogue à proprement parler (le contrat les liste à part), mais
    // c'est une source de données réelle et distincte : déclarée ici comme
    // une 7e application pour que Studio l'ingère au même titre.
    {
      id: "ml-files", label: "Lucie Batch Hub · exports CSV", type: "Batch Hub / CSV",
      connectionHint: "CSV via /api/files · prévisions détaillées et scorecard fournisseurs",
      endpoint: `${portal}/api/files`, environment: "Maison Lucie · Synthetic",
      authMode: "API Key · x-api-key", secretRef: "demo://maison-lucie/files",
      demoCredentials: [{ label: "x-api-key", value: "lucie_files_demo_key" }],
      secretConfigured: true, sourceStatus: "demo", enabled: true,
    },
  ];
  // IMPORTANT — aucune valeur n'est recopiée en dur ici : sampleValues reste
  // vide tant que Studio ne s'est pas réellement connecté au portail
  // Maison Lucie (GET /api/catalog puis /api/data/<app>, voir
  // importMaisonLucieLive plus bas). Le nom du champ (issu du schéma réel
  // du dépôt github.com/mambayelo-lab/maison-lucie-si) est déclaré à
  // l'avance pour que le mapping KPI→champ existe dès l'ouverture de
  // Studio ; la donnée elle-même n'arrive que par l'import live.
  const fields: AppField[] = [
    { id: "ml-f-stock", appId: "ml-wms", name: "InventoryPosition.available", sampleValues: [] },
    { id: "ml-f-cover", appId: "ml-wms", name: "InventoryPosition.daysOfCover", sampleValues: [] },
    { id: "ml-f-delay", appId: "ml-tms", name: "Shipment.delayHours", sampleValues: [] },
    { id: "ml-f-capacity-risk", appId: "ml-risk", name: "SupplierRiskAssessment.capacityRisk", sampleValues: [] },
    { id: "ml-f-overall-risk", appId: "ml-risk", name: "SupplierRiskAssessment.overallRisk", sampleValues: [] },
    { id: "ml-f-forecast", appId: "ml-demand", name: "DemandForecast.promoted", sampleValues: [] },
    { id: "ml-f-forecast-gap", appId: "ml-demand", name: "DemandForecast.forecastGapPct", sampleValues: [] },
    { id: "ml-f-geo-risk", appId: "ml-risk", name: "SupplierRiskAssessment.geopoliticalRisk", sampleValues: [] },
    { id: "ml-f-margin", appId: "ml-demand", name: "DemandForecast.grossMarginPct", sampleValues: [] },
    { id: "ml-f-po", appId: "ml-sap", name: "PurchaseOrder.status", sampleValues: [] },
    { id: "ml-f-event", appId: "ml-events", name: "CloudEvent.type", sampleValues: [] },
    // Champs réels du référentiel Maison Lucie pour poser l'entité
    // "Fournisseur" — voir entityMappings ci-dessous. supplierId et
    // requestedDate existent réellement sur PurchaseOrder ; aucun champ
    // "criticité fournisseur" ni "date de livraison réelle" n'existe côté
    // source, donc ces deux attributs restent volontairement sans
    // branchement (cf. entityMappings).
    { id: "ml-f-supplier-id", appId: "ml-sap", name: "PurchaseOrder.supplierId", sampleValues: [] },
    { id: "ml-f-requested-date", appId: "ml-sap", name: "PurchaseOrder.requestedDate", sampleValues: [] },
    // Champs dédiés aux 5 signaux du catalogue Supply Chain réellement
    // ancrés Maison Lucie — un champ par signal, valeur unique (jamais une
    // moyenne ni une valeur recalculée) filtrée sur le bon enregistrement
    // par importMaisonLucieLive, pour que le Cockpit dérive un statut KPI
    // fidèle sans dépendre de l'ordre d'un champ partagé par ailleurs.
    { id: "ml-f-s1-capacity-risk", appId: "ml-risk", name: "SupplierRiskAssessment.capacityRisk (SUP-001)", sampleValues: [] },
    { id: "ml-f-s2-cover", appId: "ml-wms", name: "InventoryPosition.daysOfCover (BAG-ORION@WH-LIL)", sampleValues: [] },
    { id: "ml-f-s4-delay", appId: "ml-tms", name: "Shipment.delayHours (SHP-883)", sampleValues: [] },
    { id: "ml-f-s6-gap", appId: "ml-demand", name: "DemandForecast.forecastGapPct (BAG-LUNA 2026-W40)", sampleValues: [] },
    { id: "ml-f-s9-overall-risk", appId: "ml-risk", name: "SupplierRiskAssessment.overallRisk (SUP-010)", sampleValues: [] },
    { id: "ml-f-s10-geo-risk", appId: "ml-risk", name: "SupplierRiskAssessment.geopoliticalRisk (SUP-003)", sampleValues: [] },
    // Champs du Batch Hub (ml-files) — colonnes réelles des 2 CSV exposés
    // par /api/files (data/demand-forecast.csv et data/supplier-scorecard.csv
    // dans le dépôt), ingérées par importMaisonLucieLive via
    // fetchMaisonLucieFile. Complémentaires aux champs API JSON déjà
    // déclarés (DemandForecast.promoted vient de l'API, forecast_qty du CSV
    // — deux vues réelles, pas une duplication).
    { id: "ml-f-forecast-qty", appId: "ml-files", name: "DemandForecastBatch.forecast_qty", sampleValues: [] },
    { id: "ml-f-forecast-confidence", appId: "ml-files", name: "DemandForecastBatch.confidence_pct", sampleValues: [] },
    { id: "ml-f-otif", appId: "ml-files", name: "SupplierPerformance.otif_pct", sampleValues: [] },
    { id: "ml-f-defect-rate", appId: "ml-files", name: "SupplierPerformance.defect_rate_pct", sampleValues: [] },
    { id: "ml-f-lead-time", appId: "ml-files", name: "SupplierPerformance.lead_time_days", sampleValues: [] },
    { id: "ml-f-confirmed-capacity", appId: "ml-files", name: "SupplierPerformance.confirmed_capacity_pct", sampleValues: [] },
  ];
  const entities = [
    ...(base.entities ?? []),
    {
      id: "e-fournisseur", name: "Fournisseur",
      description: "Fournisseur amont — objet métier de la résilience supply chain (référentiel Maison Lucie).",
      attributes: [
        { id: "a-fournisseur-supplier-id", name: "supplierId", type: "text" as const },
        { id: "a-fournisseur-criticality", name: "criticality", type: "text" as const },
        { id: "a-fournisseur-planned-delivery", name: "plannedDeliveryDate", type: "date" as const },
        { id: "a-fournisseur-actual-delivery", name: "actualDeliveryDate", type: "date" as const },
        { id: "a-fournisseur-delivery-delay", name: "deliveryDelay", type: "number" as const },
      ],
    },
  ];
  // Les 15 signaux du catalogue Supply Chain (auparavant ALERT_CATALOGUE,
  // fichier statique séparé) deviennent des KpiDef + CausalRule éditables
  // dans Studio, lus en direct par le Cockpit — plus de synchronisation
  // manuelle entre deux objets. 5 sont ancrés Maison Lucie (KPI mappé à un
  // champ réel ci-dessus, 1 seule condition, current value dérivée du champ
  // — voir deriveCurrentValue) ; les 10 autres restent illustratifs (aucun
  // fait Maison Lucie ne les couvre) et n'ont donc aucune condition — une
  // règle à 0 condition n'est JAMAIS déclenchée (voir
  // evaluateCausalConditionSet) : elle reste un modèle de décision du
  // catalogue, qui ne devient une alerte qu'une fois raccordée à un KPI.
  //
  // Chaque KPI porte le sens dans lequel franchir le seuil est mauvais :
  // au_dessus_alerte ⇒ seuilAlerte < seuilCritique ; en_dessous_alerte ⇒
  // seuilAlerte > seuilCritique (figé par supply-coherence.test.ts).
  const alertKpis: KpiDef[] = [
    { id: "k-s1", label: "Risque de capacité fournisseur", unit: "score/100", direction: "au_dessus_alerte", seuilAlerte: 60, seuilCritique: 85, perimetre: "Supply Chain", entityId: "sc-fournisseur" },
    { id: "k-s2", label: "Couverture de stock", unit: "jours", direction: "en_dessous_alerte", seuilAlerte: 7, seuilCritique: 3, perimetre: "Supply Chain", entityId: "sc-stock" },
    { id: "k-s4", label: "Retard transport", unit: "h", direction: "au_dessus_alerte", seuilAlerte: 24, seuilCritique: 48, perimetre: "Supply Chain", entityId: "sc-expedition" },
    // Écart relatif (valeur absolue) entre la prévision promue et la
    // baseline corrigée de l'effet promotionnel planifié : une promotion
    // prévue n'est pas une dérive. Remplace l'ancien « Prévision de demande
    // promue » en unités, dont le seuil absolu (1 000 u.) n'avait pas de
    // sens d'un SKU à l'autre (ex. 7 611 u. de ZIP-ARGENT sans promotion).
    { id: "k-s6", label: "Écart de prévision hors promotion", unit: "%", direction: "au_dessus_alerte", seuilAlerte: 20, seuilCritique: 40, perimetre: "Supply Chain", entityId: "sc-prevision", attributs: ["Écart de prévision"] },
    { id: "k-s9", label: "Risque global fournisseur", unit: "score/100", direction: "au_dessus_alerte", seuilAlerte: 50, seuilCritique: 80, perimetre: "Supply Chain", entityId: "sc-fournisseur" },
    { id: "k-s10", label: "Risque géopolitique fournisseur", unit: "score/100", direction: "au_dessus_alerte", seuilAlerte: 50, seuilCritique: 75, perimetre: "Supply Chain", entityId: "sc-fournisseur" },
  ];
  const alertMappings: MappingDef[] = [
    { id: "ml-am-s1", kpiId: "k-s1", appId: "ml-risk", fieldId: "ml-f-s1-capacity-risk", method: "manuel", confidence: 1, attribut: "capacityRisk" },
    { id: "ml-am-s2", kpiId: "k-s2", appId: "ml-wms", fieldId: "ml-f-s2-cover", method: "manuel", confidence: 1, attribut: "daysOfCover" },
    { id: "ml-am-s4", kpiId: "k-s4", appId: "ml-tms", fieldId: "ml-f-s4-delay", method: "manuel", confidence: 1, attribut: "delayHours" },
    { id: "ml-am-s6", kpiId: "k-s6", appId: "ml-demand", fieldId: "ml-f-s6-gap", method: "manuel", confidence: 1, attribut: "forecastGapPct" },
    { id: "ml-am-s9", kpiId: "k-s9", appId: "ml-risk", fieldId: "ml-f-s9-overall-risk", method: "manuel", confidence: 1, attribut: "overallRisk" },
    { id: "ml-am-s10", kpiId: "k-s10", appId: "ml-risk", fieldId: "ml-f-s10-geo-risk", method: "manuel", confidence: 1, attribut: "geopoliticalRisk" },
  ];
  const alertRules: CausalRule[] = [
    { id: "S1", label: "Risque de rupture fournisseur", conditions: [{ kpiId: "k-s1", minStatus: "alerte" }], conclusion: S1_CONCLUSION, severity: "alerte" as RuleSeverity, displaySeverity: "majeure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: S1_CAUSES, options: S1_OPTIONS, decisionQuestion: "Sécuriser, remplacer, accélérer ou accepter le risque ?",
      expositionEur: 1_840_000, delaiLabel: "24 h", siteLabel: "Fournisseur SUP-001 — Tessitura Milano",
      grounded: { sourceRecord: "coupa-risk — SupplierRiskAssessment SUP-001 ; sap-s4 — PurchaseOrder PO-1042 (≈ ALT-001)", realFields: { supplierId: "SUP-001", supplier: "Tessitura Milano", capacityRisk: 88, overallRisk: 71 } } },
    { id: "S2", label: "Couverture de stock sous seuil", conditions: [{ kpiId: "k-s2", minStatus: "alerte" }], conclusion: S2_CONCLUSION, severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: S2_CAUSES, options: S2_OPTIONS, decisionQuestion: "Commander, transférer, prioriser, substituer ou modifier le service ?",
      expositionEur: 856, delaiLabel: "6,4 jours", siteLabel: "BAG-ORION @ WH-LIL",
      grounded: { sourceRecord: "manhattan-wms — InventoryPosition BAG-ORION@WH-LIL", realFields: { sku: "BAG-ORION", siteId: "WH-LIL", available: 230, safetyStock: 250, daysOfCover: 6.4, unitCost: 42.8 } } },
    { id: "S3", label: "Surstock ou obsolescence", conditions: [], conclusion: "Réduire, redéployer, promouvoir, retourner, transformer ou déprécier ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Couverture excessive, faible rotation", "Fin de vie ou changement de forecast", "Risque de dépréciation"], options: ["Transfert", "Promotion", "Bundle", "Retour fournisseur", "Rework", "Arrêt commandes", "Liquidation"], decisionQuestion: "Réduire, redéployer, promouvoir, retourner, transformer ou déprécier ?",
      expositionEur: 720_000, delaiLabel: "6 semaines", siteLabel: "Référence REF-3390" },
    { id: "S4", label: "Retard transport critique", conditions: [{ kpiId: "k-s4", minStatus: "critique" }], conclusion: S4_CONCLUSION, severity: "critique" as RuleSeverity, displaySeverity: "critique", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: S4_CAUSES, options: ["Air / rail / route", "Reroutage", "Split shipment", "Transfert de stock", "Fournisseur alternatif", "Replanification"], decisionQuestion: "Attendre, rerouter, changer de mode, sourcer localement ou replanifier ?",
      expositionEur: 920_000, delaiLabel: "8 h", siteLabel: "Expédition SHP-883 — AsiaBridge (Shenzhen → Paris)",
      grounded: { sourceRecord: "blueyonder-tms — Shipment SHP-883 (≈ ALT-002)", realFields: { shipmentId: "SHP-883", carrier: "AsiaBridge", origin: "Shenzhen", destination: "Paris", delayHours: 72, status: "CRITICAL", purchaseOrderId: "PO-1043" } } },
    { id: "S5", label: "Dégradation OTIF/qualité fournisseur", conditions: [], conclusion: "Corriger, réduire allocation, auditer, remplacer ou développer le fournisseur ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Retards, défauts ou non-conformités hors tolérance", "Menace sur le service ou les coûts"], options: ["Plan correctif", "Inspection renforcée", "Dual source", "Réallocation", "Sortie", "Accompagnement"], decisionQuestion: "Corriger, réduire allocation, auditer, remplacer ou développer le fournisseur ?",
      expositionEur: 950_000, delaiLabel: "3 semaines", siteLabel: "Fournisseur SUP-041" },
    { id: "S6", label: "Prévision de demande en dérive", conditions: [{ kpiId: "k-s6", minStatus: "alerte" }], conclusion: S6_CONCLUSION, severity: "alerte" as RuleSeverity, displaySeverity: "majeure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: S6_CAUSES, options: ["Modèle alternatif", "Override documenté", "Scénario haut/bas", "Report achats", "Capacité flexible"], decisionQuestion: "Quelle prévision retenir et quelles décisions aval replanifier ?",
      delaiLabel: "Semaine 2026-W40 (déjà engagée)", siteLabel: "BAG-LUNA — prévision semaine 2026-W40",
      grounded: { sourceRecord: "snowflake-demand — DemandForecast BAG-LUNA 2026-W40", realFields: { sku: "BAG-LUNA", week: "2026-W40", baseline: 310, promoted: 520, promotionId: "PROMO-2026-VIC", forecastGapPct: 34.2, forecastConfidence: 0.61 } } },
    { id: "S7", label: "Capacité insuffisante", conditions: [], conclusion: "Ajouter, déplacer, sous-traiter, prioriser ou lisser la demande ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Charge prévue dépassant la capacité contrainte", "Usine, ligne, entrepôt ou partenaire concerné"], options: ["Heures sup", "Équipe supplémentaire", "Sous-traitance", "Transfert", "Priorisation produits/clients"], decisionQuestion: "Ajouter, déplacer, sous-traiter, prioriser ou lisser la demande ?",
      expositionEur: 1_050_000, delaiLabel: "2 semaines", siteLabel: "Usine de Valenciennes" },
    { id: "S8", label: "Marge menacée par coûts supply", conditions: [], conclusion: "Répercuter, resourcer, redesign, renégocier ou accepter temporairement ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Transport, matière, droits, change ou non-qualité en hausse", "Marge sous le plancher"], options: ["Prix", "Spécification", "Fournisseur", "Incoterm", "Réseau", "Lot", "Substitution", "Hedge"], decisionQuestion: "Répercuter, resourcer, redesign, renégocier ou accepter temporairement ?",
      expositionEur: 680_000, delaiLabel: "4 semaines", siteLabel: "Gamme Produit Z" },
    { id: "S9", label: "Risque géopolitique/pays", conditions: S9_CONDITIONS, conclusion: S9_CONCLUSION, severity: "alerte" as RuleSeverity, displaySeverity: "majeure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Sanction, conflit ou réglementation", "Port fermé ou concentration géographique", "Flux critique menacé"], options: ["Stock stratégique", "Dual source", "Nearshore", "Reroute", "Redesign", "Contrats optionnels"], decisionQuestion: "Que sécuriser, diversifier, relocaliser ou prépositionner ?",
      expositionEur: 920_000, delaiLabel: "8 h", siteLabel: "Corridor Shenzhen (SUP-003) → Paris",
      grounded: { sourceRecord: "coupa-risk — SupplierRiskAssessment SUP-003 (geopoliticalRisk) ; blueyonder-tms — SHP-883", realFields: { supplierId: "SUP-003", supplier: "Shenzhen Atelier Components", geopoliticalRisk: 68, countryRisk: 54, overallRisk: 57, corridor: "Shenzhen → Paris" } } },
    { id: "S10", label: "Défaillance d'un nœud logistique", conditions: [], conclusion: "Comment rerouter et allouer les capacités restantes ?", severity: "critique" as RuleSeverity, displaySeverity: "critique", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Entrepôt, port, transporteur ou système indisponible", "Dépendances et buffers insuffisants"], options: ["Hub alternatif", "Direct ship", "Cross-dock", "3PL", "Priorisation", "Réduction assortiment"], decisionQuestion: "Comment rerouter et allouer les capacités restantes ?",
      expositionEur: 3_400_000, delaiLabel: "12 h", siteLabel: "Entrepôt de Rotterdam" },
    { id: "S11", label: "Allocation sous pénurie", conditions: [], conclusion: "À qui allouer quelle quantité selon quelles règles explicables ?", severity: "alerte" as RuleSeverity, displaySeverity: "majeure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Offre disponible inférieure à la demande ferme", "Arbitrage clients/produits/sites nécessaire"], options: ["Priorité SLA", "Marge", "Criticité", "Équité", "Substitution", "Réservation", "Report"], decisionQuestion: "À qui allouer quelle quantité selon quelles règles explicables ?",
      expositionEur: 1_100_000, delaiLabel: "2 jours", siteLabel: "Ligne Composant X" },
    { id: "S12", label: "Changement produit/nomenclature à risque", conditions: [], conclusion: "Quand basculer et comment consommer/sécuriser ancien et nouveau composants ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Dépendances ou stocks morts créés par la modification", "Qualification incomplète", "Rupture de transition"], options: ["Phase-in/out", "Double run", "Last buy", "Rework", "Décaler lancement", "Qualification accélérée"], decisionQuestion: "Quand basculer et comment consommer/sécuriser ancien et nouveau composants ?",
      expositionEur: 540_000, delaiLabel: "5 semaines", siteLabel: "Nomenclature BOM-118" },
    { id: "S13", label: "Donnée supply incohérente", conditions: [], conclusion: "La décision est-elle fiable et quelle source/correction utiliser ?", severity: "alerte" as RuleSeverity, displaySeverity: "majeure", origin: "manuel", validation: "validee", alertEnabled: true,
      causes: ["Stocks, lead times, commandes ou identifiants divergents", "Écart entre ERP, WMS, TMS et fournisseur"], options: ["Golden source", "Rapprochement", "Correction", "Hypothèse prudente", "Blocage", "Validation humaine"], decisionQuestion: "La décision est-elle fiable et quelle source/correction utiliser ?",
      expositionEur: 380_000, delaiLabel: "1 jour", siteLabel: "Interface ERP ↔ WMS" },
    { id: "S14", label: "Configuration réseau sous-optimale", conditions: [], conclusion: "Ouvrir/fermer/reconfigurer entrepôts, usines, stocks et flux ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: false,
      causes: ["Dérive coût, service, carbone ou résilience du réseau", "Croissance ou acquisition changeant les flux"], options: ["Centraliser", "Régionaliser", "Nouveaux hubs", "Multi-sourcing", "Report modal", "Capacités"], decisionQuestion: "Ouvrir/fermer/reconfigurer entrepôts, usines, stocks et flux ?",
      expositionEur: 5_200_000, delaiLabel: "2 trimestres", siteLabel: "Réseau — Europe de l'Ouest" },
    { id: "S15", label: "Risque de transformation SI Supply", conditions: [], conclusion: "Quelle architecture et séquence minimisent le risque métier ?", severity: "alerte" as RuleSeverity, displaySeverity: "mineure", origin: "manuel", validation: "validee", alertEnabled: false,
      causes: ["Capacité critique, flux ou transition legacy non couverts", "Cible ERP/WMS/OMS/APS en cause"], options: ["Phasage", "Coexistence", "Interface temporaire", "Adaptation produit", "Report de lot"], decisionQuestion: "Quelle architecture et séquence minimisent le risque métier ?",
      expositionEur: 1_900_000, delaiLabel: "1 jalon", siteLabel: "Programme refonte WMS" },
  ];
  return {
    ...base,
    domaine: "Maison Lucie · Supply Chain Resilience",
    apps,
    fields,
    entities,
    kpis: alertKpis,
    causalRules: alertRules,
    mappings: [
      ...alertMappings,
    ],
    // Branchements RÉELS et déjà confirmés (isMaster: true) posés sur les 3
    // attributs de "Fournisseur" pour lesquels le référentiel Maison Lucie a
    // un champ source honnête : supplierId et plannedDeliveryDate viennent de
    // PurchaseOrder (Lucie ERP), deliveryDelay du Shipment.delayHours déjà
    // câblé côté TMS. `criticality` et `actualDeliveryDate` n'ont PAS de champ
    // source réel dans le référentiel (pas de champ "criticité fournisseur",
    // pas de date de livraison réellement constatée distincte de l'ETA
    // planifiée) : ils restent volontairement sans entityMappings, pour ne
    // pas fabriquer une donnée métier qui n'existe pas côté source.
    entityMappings: [
      { id: "ml-em1", entityId: "e-fournisseur", attributeId: "a-fournisseur-supplier-id", appId: "ml-sap", fieldId: "ml-f-supplier-id", isMaster: true, method: "manuel", rationale: "PurchaseOrder.supplierId est l'identifiant fournisseur réel (SUP-00x) du référentiel Maison Lucie." },
      { id: "ml-em2", entityId: "e-fournisseur", attributeId: "a-fournisseur-planned-delivery", appId: "ml-sap", fieldId: "ml-f-requested-date", isMaster: true, method: "manuel", rationale: "PurchaseOrder.requestedDate est la date de livraison planifiée réelle de la commande d'achat." },
      { id: "ml-em3", entityId: "e-fournisseur", attributeId: "a-fournisseur-delivery-delay", appId: "ml-tms", fieldId: "ml-f-delay", isMaster: true, method: "manuel", rationale: "Shipment.delayHours est le délai réel observé, déjà utilisé comme KPI « délai de livraison »." },
    ],
  };
}

// ── Import LIVE du SI Maison Lucie (github.com/mambayelo-lab/maison-lucie-si) ──
// C'est ICI, et seulement ici, que Studio se connecte réellement au portail
// (https://maison-lucie-si.vercel.app) pour remplir les champs déclarés par
// maisonLucieVocab() ci-dessus — jamais une valeur recopiée en dur dans le
// code. Le portail expose un contrat public (CORS ouvert) : GET /api/catalog
// (liste des applications, avec protocole/rôle/mode d'auth réels) puis GET
// /api/data/<id> (jeu de données réel de cette application). Un échec réseau
// (sandbox sans sortie internet, portail indisponible) renvoie { ok:false }
// sans jamais fabriquer de valeur de repli.
const LOCAL_TO_CATALOG_APP_ID: Record<string, string> = {
  "ml-sap": "sap-s4", "ml-wms": "manhattan-wms", "ml-tms": "blueyonder-tms",
  "ml-risk": "coupa-risk", "ml-demand": "snowflake-demand", "ml-events": "mulesoft-events",
  "ml-rest-orders": "rest-order-management", "ml-kafka": "kafka-stream", "ml-soap": "legacy-soap", "ml-webhook": "webhook-gateway",
};
// Champ "en masse" — reprend toutes les valeurs vues pour cette clé, dans
// l'ordre des enregistrements renvoyés par le portail (jamais réordonné).
const BULK_FIELD_SOURCE: Record<string, { appId: string; key: string }> = {
  "ml-f-stock": { appId: "ml-wms", key: "available" },
  "ml-f-cover": { appId: "ml-wms", key: "daysOfCover" },
  "ml-f-delay": { appId: "ml-tms", key: "delayHours" },
  "ml-f-capacity-risk": { appId: "ml-risk", key: "capacityRisk" },
  "ml-f-overall-risk": { appId: "ml-risk", key: "overallRisk" },
  "ml-f-forecast": { appId: "ml-demand", key: "promoted" },
  "ml-f-forecast-gap": { appId: "ml-demand", key: "forecastGapPct" },
  "ml-f-geo-risk": { appId: "ml-risk", key: "geopoliticalRisk" },
  "ml-f-margin": { appId: "ml-demand", key: "grossMarginPct" },
  "ml-f-po": { appId: "ml-sap", key: "status" },
  "ml-f-event": { appId: "ml-events", key: "type" },
  "ml-f-supplier-id": { appId: "ml-sap", key: "supplierId" },
  "ml-f-requested-date": { appId: "ml-sap", key: "requestedDate" },
};
// Champ "ancré" — une seule valeur, filtrée sur l'enregistrement précis que
// le signal Supply Chain cite (ex. S1 = le risque de CE fournisseur, pas une
// moyenne) : jamais recalculée, jamais réordonnée pour "tomber en premier".
const ANCHOR_FIELD_SOURCE: Record<string, { appId: string; filterKey: string; filterValue: string; key: string }> = {
  "ml-f-s1-capacity-risk": { appId: "ml-risk", filterKey: "supplierId", filterValue: "SUP-001", key: "capacityRisk" },
  "ml-f-s2-cover": { appId: "ml-wms", filterKey: "sku", filterValue: "BAG-ORION", key: "daysOfCover" },
  "ml-f-s4-delay": { appId: "ml-tms", filterKey: "shipmentId", filterValue: "SHP-883", key: "delayHours" },
  "ml-f-s6-gap": { appId: "ml-demand", filterKey: "sku", filterValue: "BAG-LUNA", key: "forecastGapPct" },
  "ml-f-s9-overall-risk": { appId: "ml-risk", filterKey: "supplierId", filterValue: "SUP-010", key: "overallRisk" },
  "ml-f-s10-geo-risk": { appId: "ml-risk", filterKey: "supplierId", filterValue: "SUP-003", key: "geopoliticalRisk" },
};

// Champs alimentés par le Batch Hub (ml-files, /api/files/<file>) — même
// principe que BULK_FIELD_SOURCE mais la clé source est un fichier CSV, pas
// une application du catalogue /api/data.
const CSV_FIELD_SOURCE: Record<string, { file: "demand-forecast.csv" | "supplier-scorecard.csv"; column: string }> = {
  "ml-f-forecast-qty": { file: "demand-forecast.csv", column: "forecast_qty" },
  "ml-f-forecast-confidence": { file: "demand-forecast.csv", column: "confidence_pct" },
  "ml-f-otif": { file: "supplier-scorecard.csv", column: "otif_pct" },
  "ml-f-defect-rate": { file: "supplier-scorecard.csv", column: "defect_rate_pct" },
  "ml-f-lead-time": { file: "supplier-scorecard.csv", column: "lead_time_days" },
  "ml-f-confirmed-capacity": { file: "supplier-scorecard.csv", column: "confirmed_capacity_pct" },
};

export async function importMaisonLucieLive(vocab: ArgusVocab): Promise<{ ok: true; vocab: ArgusVocab } | { ok: false; error: string }> {
  if (!vocab.apps.some(a => a.id === "ml-sap")) {
    return { ok: false, error: "Ce vocabulaire n'est pas le référentiel Maison Lucie (aucune application ml-* déclarée) — rien à importer." };
  }
  const catalog = await fetchMaisonLucieCatalog();
  if (!catalog.ok) return { ok: false, error: catalog.error };

  // Authentification RÉELLE par application — chaque endpoint /api/data/<app>
  // exige désormais des identifiants (401 sinon, voir lib/http-api.js du
  // dépôt) : on utilise les demoCredentials déclarés sur CETTE application
  // dans le vocabulaire (donc modifiables depuis Studio → "Configurer les
  // identifiants"), jamais une constante à part.
  const entries = await Promise.all(
    Object.entries(LOCAL_TO_CATALOG_APP_ID).map(async ([localId, catalogId]) => {
      const app = vocab.apps.find(a => a.id === localId);
      return [localId, await fetchMaisonLucieAppData(catalogId, app?.demoCredentials)] as const;
    })
  );
  const dataByLocalId = new Map<string, { entity: string; records: Record<string, unknown>[] }>();
  const appErrors: string[] = [];
  for (const [localId, r] of entries) { if (r.ok) dataByLocalId.set(localId, r.data); else appErrors.push(`${localId} : ${r.error}`); }
  // Tables secondaires exposées par chaque application (référentiels
  // fournisseurs, articles, sites, perturbations…) : lues elles aussi, pour
  // que leurs colonnes deviennent des métadonnées mappables.
  const extraTables: { localId: string; entity: string; records: Record<string, unknown>[] }[] = [];
  await Promise.all(entries.map(async ([localId, r]) => {
    if (!r.ok) return;
    const others = (r.data.availableTables ?? []).filter(table => table !== r.data.entity);
    const app = vocab.apps.find(a => a.id === localId);
    await Promise.all(others.map(async table => {
      const extra = await fetchMaisonLucieAppData(LOCAL_TO_CATALOG_APP_ID[localId], app?.demoCredentials, table);
      if (extra.ok) extraTables.push({ localId, entity: extra.data.entity || table, records: extra.data.records });
      else appErrors.push(`${localId} (${table}) : ${extra.error}`);
    }));
  }));
  // Pas de retour anticipé ici même si dataByLocalId est vide : le Batch Hub
  // (CSV) et /api/events, plus bas, sont des sources INDÉPENDANTES des 6
  // applications /api/data — un échec sur ces 6 ne doit pas empêcher
  // d'essayer les autres (bug corrigé : le retour anticipé précédent
  // bloquait entièrement l'ingestion CSV dès qu'une seule app /api/data
  // échouait). Le vrai "rien n'a répondu" est vérifié plus bas, une fois
  // toutes les sources tentées.

  const catalogByLocalId = new Map<string, { protocol: string; role: string }>();
  for (const [localId, catalogId] of Object.entries(LOCAL_TO_CATALOG_APP_ID)) {
    const found = catalog.data.applications.find(a => a.id === catalogId);
    if (found) catalogByLocalId.set(localId, found);
  }

  // Fichiers CSV du Batch Hub — indépendants des 6 applications /api/data
  // (ml-files n'est pas dans LOCAL_TO_CATALOG_APP_ID), authentifiés par les
  // demoCredentials déclarés sur "ml-files" dans Studio.
  const filesApp = vocab.apps.find(a => a.id === "ml-files");
  const csvByFile = new Map<string, Record<string, string>[]>();
  if (filesApp) {
    const [forecastCsv, scorecardCsv] = await Promise.all([
      fetchMaisonLucieFile("demand-forecast.csv", filesApp.demoCredentials),
      fetchMaisonLucieFile("supplier-scorecard.csv", filesApp.demoCredentials),
    ]);
    if (forecastCsv.ok) csvByFile.set("demand-forecast.csv", forecastCsv.data); else appErrors.push(`ml-files (demand-forecast.csv) : ${forecastCsv.error}`);
    if (scorecardCsv.ok) csvByFile.set("supplier-scorecard.csv", scorecardCsv.data); else appErrors.push(`ml-files (supplier-scorecard.csv) : ${scorecardCsv.error}`);
  }

  if (dataByLocalId.size === 0 && csvByFile.size === 0) {
    return { ok: false, error: `Aucune source Maison Lucie n'a répondu avec les identifiants configurés (catalogue joignable) — ${appErrors[0] ?? "détail indisponible"}` };
  }

  const apps = vocab.apps.map(a => {
    if (a.id === "ml-files") {
      if (csvByFile.size === 0) return a;
      return { ...a, sourceStatus: "connected" as const, secretConfigured: true, enabled: true, lastSyncAt: new Date().toISOString() };
    }
    const live = catalogByLocalId.get(a.id);
    if (!live || !dataByLocalId.has(a.id)) return a;
    return { ...a, connectionHint: `${live.protocol} · ${live.role}`, sourceStatus: "connected" as const, secretConfigured: true, enabled: true, lastSyncAt: new Date().toISOString() };
  });

  function bulkValues(appLocalId: string, key: string): string[] {
    const d = dataByLocalId.get(appLocalId);
    return (d?.records ?? []).map(r => r[key]).filter(v => v !== undefined).map(String);
  }
  function anchorValue(appLocalId: string, filterKey: string, filterValue: string, key: string): string | undefined {
    const rec = (dataByLocalId.get(appLocalId)?.records ?? []).find(r => String(r[filterKey]) === filterValue);
    return rec && rec[key] !== undefined ? String(rec[key]) : undefined;
  }

  // /api/events (CloudEvents 1.0, cursor-paginé) — endpoint distinct de
  // /api/data/mulesoft-events pour la même donnée sous-jacente, demandé
  // explicitement (retour de test réel, point 4) : consommé ici avec les
  // identifiants X-Client-Id/X-Client-Secret déclarés sur "Lucie Integration
  // Hub" dans Studio. Alimente ml-f-event à la place de /api/data quand il
  // répond ; sinon /api/data/mulesoft-events (déjà dans dataByLocalId) reste
  // le repli, jamais une valeur fabriquée.
  const eventsApp = vocab.apps.find(a => a.id === "ml-events");
  const eventsResult = eventsApp ? await fetchMaisonLucieEvents(eventsApp.demoCredentials) : { ok: false as const, error: "application ml-events absente du vocabulaire" };
  const liveEventTypes = eventsResult.ok ? eventsResult.data.events.map(e => e.type.replace(/^com\.maisonlumen\./, "")) : undefined;

  const fields = vocab.fields.map(f => {
    if (f.id === "ml-f-event" && liveEventTypes?.length) return { ...f, sampleValues: liveEventTypes };
    const csv = CSV_FIELD_SOURCE[f.id];
    if (csv) {
      const rows = csvByFile.get(csv.file);
      if (rows) return { ...f, sampleValues: rows.map(r => r[csv.column]).filter((v): v is string => v !== undefined) };
      return f;
    }
    const bulk = BULK_FIELD_SOURCE[f.id];
    if (bulk && dataByLocalId.has(bulk.appId)) return { ...f, sampleValues: bulkValues(bulk.appId, bulk.key) };
    const anchor = ANCHOR_FIELD_SOURCE[f.id];
    if (anchor && dataByLocalId.has(anchor.appId)) {
      const v = anchorValue(anchor.appId, anchor.filterKey, anchor.filterValue, anchor.key);
      return v !== undefined ? { ...f, sampleValues: [v] } : f;
    }
    return f;
  });

  const demoSnapshots: SiTableSnapshot[] = [];
  for (const [appId, data] of dataByLocalId) {
    const columns = Array.from(new Set(data.records.flatMap(record => Object.keys(record))));
    const rows = data.records.map(record => Object.fromEntries(columns.map(column => {
      const value = record[column];
      return [column, value !== null && typeof value === "object" ? JSON.stringify(value) : value == null ? "" : String(value)];
    })));
    demoSnapshots.push({
      id: `maison-lucie:${appId}:${data.entity}`,
      appId,
      table: data.entity,
      columns,
      rows,
      fetchedAt: new Date().toISOString(),
    });
  }
  for (const extra of extraTables) {
    const columns = Array.from(new Set(extra.records.flatMap(record => Object.keys(record))));
    demoSnapshots.push({
      id: `maison-lucie:${extra.localId}:${extra.entity}`,
      appId: extra.localId,
      table: extra.entity,
      columns,
      rows: extra.records.map(record => Object.fromEntries(columns.map(column => {
        const value = record[column];
        return [column, value !== null && typeof value === "object" ? JSON.stringify(value) : value == null ? "" : String(value)];
      }))),
      fetchedAt: new Date().toISOString(),
    });
  }
  for (const [file, rows] of csvByFile) {
    const columns = Array.from(new Set(rows.flatMap(record => Object.keys(record))));
    demoSnapshots.push({
      id: `maison-lucie:ml-files:${file}`,
      appId: "ml-files",
      table: file,
      columns,
      rows,
      fetchedAt: new Date().toISOString(),
    });
  }
  const demoAppIds = new Set(vocab.apps.filter(app => app.id.startsWith("ml-")).map(app => app.id));
  const siTables = [
    ...(vocab.siTables ?? []).filter(snapshot => !demoAppIds.has(snapshot.appId)),
    ...demoSnapshots,
  ];

  // Colonnes découvertes qui n'ont pas encore de champ déclaré : elles
  // deviennent des métadonnées (nom « Table.colonne », valeurs lues).
  const known = new Set(fields.map(f => `${f.appId}|${f.name.replace(/\s*\(.*\)$/, "").toLowerCase()}`));
  const discovered: AppField[] = demoSnapshots.flatMap(snapshot => snapshot.columns.flatMap(column => {
    const name = `${snapshot.table}.${column}`;
    const key = `${snapshot.appId}|${name.toLowerCase()}`;
    if (known.has(key)) return [];
    known.add(key);
    return [{ id: `ml-auto:${snapshot.appId}:${name}`, appId: snapshot.appId, name, liveTable: snapshot.table, sampleValues: snapshot.rows.map(row => row[column]).filter(Boolean).slice(0, 6) }];
  }));

  return { ok: true, vocab: { ...vocab, apps, fields: [...fields, ...discovered], siTables } };
}


