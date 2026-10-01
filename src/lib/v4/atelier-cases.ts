import { applyDemoJudgements, completeDemoImpacts } from "./decision-templates";
import { optionHints } from "./decision-dialogue";
// atelier-cases.ts — extrait de cockpit.atelier.tsx (allègement, aucun changement
// de comportement) : tables de cas de décision, suggestions par type de cas,
// vocabulaire par finalité et démos intégrées. Données pures, aucun calcul du
// moteur ordinal ici.
import type {
  AtelierSession, AtelierCriterion, AtelierScenario, AtelierLevierDef, ImportanceBadge,
} from "./atelier-store";
import { getArchitecturePattern, type ArchitecturePattern } from "./architecture-patterns";

export const CASE_TYPES = [
  {
    id: "nouveau_produit",
    icon: "🚀",
    label: "Nouveau produit",
    sub: "Innovation · Go-to-market · MVP",
    hint: "Développement de nouveaux produits, lancement marché, roadmap produit",
    accent: "#7c3aed",
    bg: "#ede9fe",
    border: "#c4b5fd",
  },
  {
    id: "conception_complexe",
    icon: "📐",
    label: "Conception complexe",
    sub: "Mécatronique · Chimie · Systèmes",
    hint: "Conception préliminaire de produits complexes multidisciplinaires (mécatronique, chimiques, aéronautique…)",
    accent: "#0369a1",
    bg: "#e0f2fe",
    border: "#7dd3fc",
  },
  {
    id: "strategique",
    icon: "🎯",
    label: "Objectif stratégique",
    sub: "OKR · Cap · Priorités",
    hint: "Décisions stratégiques d'entreprise : orientations, allocations, transformations",
    accent: "#6366f1",
    bg: "#eef2ff",
    border: "#a5b4fc",
  },
  {
    id: "operationnel",
    icon: "⚙",
    label: "Décision opérationnelle",
    sub: "Process · Sourcing · Make-or-Buy",
    hint: "Arbitrages opérationnels : fournisseurs, organisation, processus, investissements",
    accent: "#059669",
    bg: "#d1fae5",
    border: "#6ee7b7",
  },
  {
    id: "risque",
    icon: "🛡",
    label: "Gestion des risques",
    sub: "Conformité · Crise · Résilience",
    hint: "Décisions sous contrainte de risque : réglementaire, opérationnel, cyber, réputation",
    accent: "#dc2626",
    bg: "#fee2e2",
    border: "#fca5a5",
  },
  {
    id: "investissement",
    icon: "💰",
    label: "Investissement & M&A",
    sub: "Acquisition · Capex · Portfolio",
    hint: "Arbitrages de portefeuille, acquisitions, désinvestissements, priorisation Capex",
    accent: "#d97706",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  {
    id: "architecture",
    icon: "🏛",
    label: "Architecture de Systèmes d'Information",
    sub: "Entreprise · Applicative · Data · Infra",
    hint: "Choix d'architecture d'entreprise, applicative, data ou infrastructure",
    accent: "#0f766e",
    bg: "#ccfbf1",
    border: "#5eead4",
  },
] as const;

export type CaseTypeId = typeof CASE_TYPES[number]["id"];

/**
 * Rapproche une réponse dictée (« c'est un investissement à arbitrer ») d'un
 * type de décision. Purement lexical : aucune inférence chiffrée, aucun choix
 * fait à la place de l'utilisateur — s'il n'y a pas de correspondance nette,
 * on ne décide rien et la question reste posée dans la page.
 */
export function matchCaseType(text: string): CaseTypeId | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  const hit = CASE_TYPES.find(c =>
    t.includes(c.label.toLowerCase()) ||
    c.label.toLowerCase().split(/\s+/).every(w => w.length > 4 && t.includes(w)) ||
    c.sub.toLowerCase().split(" · ").some(w => w.length > 4 && t.includes(w.toLowerCase())));
  return hit ? (hit.id as CaseTypeId) : null;
}

// ─── PESTEL dimensions ────────────────────────────────────────────────────────
export const PESTEL_DIMS = [
  {
    id: "P", icon: "🏛", label: "Réglementaire",
    hint: "Lois, normes, certifications, politiques publiques",
    question: "Y a-t-il des évolutions réglementaires ou certifications spécifiques à anticiper pour cette décision ?",
    placeholder: "Ex : Nouvelle norme CE 2026, directive CSRD, appel d'offres public…",
  },
  {
    id: "E", icon: "📊", label: "Macro-économique",
    hint: "Taux, inflation, coûts matières, changes",
    question: "Des facteurs macro-économiques (coûts, financement, marché) sont-ils structurants pour cette décision ?",
    placeholder: "Ex : Hausse des matières premières +15%, taux d'emprunt élevé, pression sur les marges…",
  },
  {
    id: "S", icon: "🤝", label: "Humain & culture",
    hint: "Compétences rares, culture interne, acceptabilité sociale",
    question: "Quelles réalités humaines ou culturelles pourraient faciliter ou freiner la mise en œuvre ?",
    placeholder: "Ex : Pénurie de profils spécialisés, faible maturité digitale des équipes, accord syndical requis…",
  },
  {
    id: "T", icon: "⚡", label: "Technologies émergentes",
    hint: "IA, automatisation, nouveaux procédés, ruptures tech",
    question: "Existe-t-il des technologies émergentes qui changent la donne pour ce choix ?",
    placeholder: "Ex : IA générative réduit les coûts de 30%, nouveau procédé concurrent en développement…",
  },
  {
    id: "En", icon: "🌿", label: "Environnement & RSE",
    hint: "Empreinte carbone, supply chain durable, obligations ESG",
    question: "Des enjeux environnementaux ou obligations RSE s'appliquent-ils à cette décision ?",
    placeholder: "Ex : Scope 3 à réduire, pression clients sur bilan carbone, éco-conception requise…",
  },
  {
    id: "L", icon: "⚖", label: "Juridique & contractuel",
    hint: "Contrats, propriété intellectuelle, responsabilités, litiges",
    question: "Y a-t-il des enjeux juridiques ou contractuels spécifiques à prendre en compte ?",
    placeholder: "Ex : Clause d'exclusivité fournisseur, brevet à protéger, responsabilité produit engagée…",
  },
] as const;

/**
 * Recouvrement lexical entre une dimension externe et ce que l'utilisateur a
 * déjà écrit (facteurs non maîtrisables, risques). Sert à ne pas reposer une
 * question déjà répondue dans Comprendre.
 */
export const PESTEL_OVERLAP_PATTERNS: Record<string, RegExp> = {
  P: /régl|certif|norme|ce |iso|régulateur|autorité/,
  E: /prix|coût|matière|inflation|taux|financement|marge/,
  S: /rh|compétence|humain|social|syndicat|culture|adhésion/,
  T: /tech|numérique|\bia\b|digital|obsolescence|plateforme/,
  En: /rse|carbone|env|esg|décarbon|climat/,
  L: /jurid|contrat|brevet|conformité|litige|responsabilité/,
};



// ─── Risk suggestions per case type ──────────────────────────────────────────
// Reformule la question "Objectif & horizon" selon le pattern choisi —
// jusqu'ici seules les suggestions de chips variaient par caseType, jamais
// la question elle-même. Le générique reste le repli si aucun pattern
// n'est choisi.
export const OBJECTIF_HINT_BY_CASETYPE: Record<string, string> = {
  nouveau_produit: "Quel résultat commercial mesurable ce produit doit-il atteindre, et pour quelle échéance de lancement ?",
  conception_complexe: "Quelle performance technique cible viser, et sur quel horizon de qualification ?",
  strategique: "Quel cap stratégique fixer, et sur quel horizon la trajectoire doit-elle porter ses fruits ?",
  operationnel: "Quel gain opérationnel viser (délai, coût, qualité), et d'ici quand ?",
  risque: "Quel niveau de risque résiduel acceptable viser, et sous quel délai le ramener à ce niveau ?",
  investissement: "Quel retour ou seuil de rentabilité viser, et sur quel horizon d'investissement ?",
  architecture: "Quelle cible d'architecture atteindre, et sur quel horizon de migration ?",
};

// Chaque liste croise plusieurs angles sans jamais les nommer : l'angle
// systémique (effet de second ordre, ce que la décision déplace ailleurs
// dans le système) et l'angle usage/adoption (l'expérience de la personne
// qui devra vivre avec le résultat), en plus du risque métier direct.
export const RISK_SUGGESTIONS: Record<string, string[]> = {
  nouveau_produit: ["Délai de mise sur marché", "Manque de ressources R&D", "Adoption marché incertaine", "Concurrence", "Effet de cannibalisation sur l'offre existante", "Friction d'usage dès le premier contact"],
  conception_complexe: ["Complexité technique", "Qualification fournisseurs", "Normes & certifications", "Coût de prototypage", "Dépendance à un seul expert critique", "Écart entre performance de labo et usage réel"],
  strategique: ["Résistance au changement", "Manque d'alignement direction", "Budget insuffisant", "Délai d'exécution", "Effet report sur une autre priorité déjà engagée", "Adhésion des équipes de terrain jamais testée"],
  operationnel: ["Dépendance fournisseur", "Risque qualité", "Disponibilité RH", "Coût de transition", "Goulot d'étranglement déplacé plus loin dans le flux", "Courbe d'apprentissage sous-estimée côté utilisateurs"],
  risque: ["Non-conformité réglementaire", "Pénalités contractuelles", "Atteinte à la réputation", "Défaillance système", "Risque en cascade sur un système dépendant", "Procédure de contournement par les utilisateurs si trop contraignante"],
  investissement: ["ROI incertain", "Surévaluation de la cible", "Intégration difficile", "Financement", "Dépendance créée envers un partenaire unique", "Expérience client dégradée pendant la transition"],
};

// ─── DDP/DIP suggestions per case type ───────────────────────────────────────
export const DDP_SUGGESTIONS: Record<string, { ddp: string[]; dip: string[] }> = {
  nouveau_produit: {
    ddp: ["Périmètre fonctionnel du MVP", "Budget de développement", "Choix technologique", "Modèle de distribution", "Profil cible client"],
    dip: ["Taille du marché adressable", "Maturité technologique sectorielle", "Réglementations produit applicables"],
  },
  conception_complexe: {
    ddp: ["Architecture technique retenue", "Niveau de sous-traitance", "Choix des matériaux clés", "Budget prototypage & tests", "Stratégie de certification"],
    dip: ["Normes de certification obligatoires", "Disponibilité des composants", "Coûts matières premières marché"],
  },
  strategique: {
    ddp: ["Périmètre de la transformation", "Priorités d'investissement", "Vitesse de déploiement", "Gouvernance & sponsors", "Partenariats stratégiques"],
    dip: ["Contexte macro-économique", "Réglementation sectorielle en vigueur", "Dynamique concurrentielle"],
  },
  operationnel: {
    ddp: ["Choix fournisseur ou partenaire", "Niveau d'internalisation vs externalisation", "Budget opérationnel alloué", "Délai de mise en œuvre", "Ressources humaines affectées"],
    dip: ["Prix des matières premières", "Délais fournisseurs contraints", "Normes qualité sectorielles"],
  },
  risque: {
    ddp: ["Niveau de couverture assurantielle", "Investissement en conformité", "Architecture de sécurité retenue", "Plan de continuité d'activité", "Fréquence d'audit"],
    dip: ["Exigences réglementaires imposées", "Menaces externes (marché, cyber)", "Décisions de tiers ou régulateurs"],
  },
  investissement: {
    ddp: ["Montant et structure de financement", "Périmètre d'acquisition ou d'investissement", "Conditions de la transaction", "Stratégie d'intégration", "Horizon de sortie"],
    dip: ["Taux d'intérêt de marché", "Valorisation sectorielle", "Cadre réglementaire M&A applicable"],
  },
};

// ─── Stakeholder suggestions per case type ───────────────────────────────────
export const STAKEHOLDER_SUGGESTIONS: Record<string, { decideurs: string[]; impactes: string[]; resistances: string[] }> = {
  strategique: {
    decideurs: ["DG / CEO", "Comité de direction", "Conseil d'administration", "DAF", "Sponsors exécutifs"],
    impactes: ["Équipes internes", "Actionnaires", "Clients stratégiques", "Partenaires clés", "Régulateurs"],
    resistances: ["Middle management", "Syndicats", "Partenaires historiques", "Équipes concernées par le changement"],
  },
  operationnel: {
    decideurs: ["Directeur opérationnel", "Responsable achat / supply", "Manager de terrain", "Chef de projet"],
    impactes: ["Équipes opérationnelles", "Fournisseurs", "Clients finaux", "Service qualité"],
    resistances: ["Fournisseurs actuels", "Équipes habituées aux process existants", "Responsables terrain"],
  },
  investissement: {
    decideurs: ["Comité d'investissement", "DAF / CFO", "DG", "Board / Actionnaires"],
    impactes: ["Actionnaires", "Équipes de la cible", "Financeurs", "Clients de la cible"],
    resistances: ["Équipes de la cible (M&A)", "Actionnaires minoritaires", "Syndicats"],
  },
  risque: {
    decideurs: ["DG / CEO", "Responsable risques / CISO", "Comité d'audit", "DAF"],
    impactes: ["Équipes IT et sécurité", "Clients", "Régulateurs", "Partenaires exposés"],
    resistances: ["Équipes métier (contraintes perçues)", "Direction IT", "Prestataires impactés"],
  },
  appel_offre: {
    decideurs: ["Commission d'appel d'offre", "Acheteur public", "DG", "Comité technique"],
    impactes: ["Soumissionnaires", "Utilisateurs finaux", "Équipes techniques de l'acheteur"],
    resistances: ["Fournisseurs sortants", "Parties prenantes internes défavorables"],
  },
  nouveau_produit: {
    decideurs: ["CPO / VP Produit", "DG", "Comité produit", "Co-fondateurs"],
    impactes: ["Clients cibles", "Équipes produit & tech", "Sales & marketing", "Support client"],
    resistances: ["Équipes techniques (dette technique)", "Canaux de distribution existants", "Produits concurrents internes"],
  },
};

// ─── Generation hints per case type ──────────────────────────────────────────
export const CASE_TYPE_GENERATION_HINTS: Record<string, string> = {
  nouveau_produit: "Pour ce cas de nouveau produit : prioriser des critères de market-fit, time-to-market, adoption, différenciation. Leviers : budget R&D, ressources produit, partenariats, canaux de distribution.",
  conception_complexe: "Pour ce cas de conception complexe multidisciplinaire : inclure des critères de faisabilité technique, certification/qualification, robustesse, coût de développement, intégration système. Leviers : sous-traitance vs interne, niveau de spécification, prototypage, normes à appliquer.",
  strategique: "Pour ce cas d'objectif stratégique : prioriser des critères d'impact sur la croissance, rentabilité, part de marché, transformation. Leviers : allocation budgétaire, priorisation initiatives, gouvernance, talent.",
  operationnel: "Pour ce cas de décision opérationnelle : inclure des critères de coût, qualité, délai, fiabilité fournisseur, dépendance. Leviers : sourcing, process, outillage, organisation.",
  risque: "Pour ce cas de gestion des risques : prioriser des critères de probabilité, impact, conformité, résilience. Leviers : contrôles, assurance, transfert, atténuation.",
  investissement: "Pour ce cas d'investissement/M&A : inclure des critères de ROI, synergies, risque d'intégration, valorisation, fit stratégique. Leviers : structure du deal, due diligence, plan d'intégration, financement.",
};

/** Sérialise un pattern d'architecture (bibliothèque de critères germe + contexte expert + réponses
 * au questionnaire) en texte injecté dans le prompt de génération — ne modifie ni le moteur ni le
 * format de sortie attendu de generateFullModel, juste le contexte fourni en entrée. */
export function buildArchPatternHint(patternId: ArchitecturePattern["id"] | undefined, answers: Record<string, string> | undefined): string {
  const pattern = getArchitecturePattern(patternId);
  if (!pattern) return "";
  const seedLines: string[] = [];
  for (const moe of pattern.seedCriteria) {
    seedLines.push(`- ${moe.label} (${moe.importance}) : ${moe.description}`);
    for (const mop of moe.children ?? []) {
      seedLines.push(`  · ${mop.label} (${mop.importance}) : ${mop.description}`);
    }
  }
  const answerLines = Object.entries(answers ?? {})
    .map(([qid, val]) => {
      const q = pattern.questionnaire.find(qq => qq.id === qid);
      return q && val ? `- ${q.text} → ${val}` : null;
    })
    .filter(Boolean);
  return `[Pattern d'architecture : ${pattern.label}]
[Contexte expert : ${pattern.expertContext}]
[Critères de départ suggérés — à ajuster/compléter selon le contexte réel, ne pas recopier tels quels si le contexte les contredit :]
${seedLines.join("\n")}
${answerLines.length ? `[Réponses au questionnaire d'élicitation :]\n${answerLines.join("\n")}\n` : ""}

`;
}

// ─── AI inference heuristic ───────────────────────────────────────────────────
export function inferFromText(text: string): { caseType?: string; sector?: string; horizon?: string; decideurs?: string[]; impactes?: string[]; resistances?: string[] } {
  const t = text.toLowerCase();
  let caseType: string | undefined;
  if (/expansion|marché|stratégi|international|positionnement|croissance marché/.test(t)) caseType = "strategique";
  else if (/recruit|embauche|rh|talent|poste|candidat/.test(t)) caseType = "operationnel";
  else if (/investiss|roi|capex|budget|acquisition|finance/.test(t)) caseType = "investissement";
  else if (/risque|conformité|réglementation|audit|sécurité/.test(t)) caseType = "risque";
  else if (/appel d'offre|aop|marché public|soumission/.test(t)) caseType = "appel_offre";
  else if (/produit|lancement|feature|roadmap|mvp/.test(t)) caseType = "nouveau_produit";
  else if (/migration|cloud|architecture|infrastructure|technique/.test(t)) caseType = "investissement";

  let sector: string | undefined;
  if (/saas|logiciel|tech|digital|ia |intelligence artificielle/.test(t)) sector = "Technologie / SaaS";
  else if (/industrie|manufacturing|usine|production/.test(t)) sector = "Industrie / Manufacturing";
  else if (/finance|banque|investiss|fonds/.test(t)) sector = "Finance / Investissement";
  else if (/santé|pharma|médical|hôpital/.test(t)) sector = "Santé / Pharma";
  else if (/transport|logistique|supply chain/.test(t)) sector = "Transport / Logistique";
  else if (/énergie|électricité|utilities/.test(t)) sector = "Énergie / Utilities";
  else if (/retail|distribution|e-commerce|commerce/.test(t)) sector = "Retail / Distribution";

  let horizon: string | undefined;
  if (/< 3 mois|2 mois|1 mois|urgent|immédiat/.test(t)) horizon = "< 3 mois";
  else if (/6 mois|3 mois|trimestr|annuel|1 an/.test(t)) horizon = "3–12 mois";
  else if (/2 ans|3 ans|moyen term|1–3 ans/.test(t)) horizon = "1–3 ans";
  else if (/5 ans|long term|> 3 ans|décennie/.test(t)) horizon = "> 3 ans";

  const sh: { decideurs?: string[]; impactes?: string[]; resistances?: string[] } = caseType ? (STAKEHOLDER_SUGGESTIONS[caseType] ?? {}) : {};
  return { caseType, sector, horizon, decideurs: sh.decideurs, impactes: sh.impactes, resistances: sh.resistances };
}


// ── Vocabulaire par finalité ─────────────────────────────────────────────────
// L'entrée se fait par finalité (décider, construire un produit/une offre,
// définir une stratégie, anticiper des risques) ; les écrans sont partagés
// mais le vocabulaire suit la finalité — jamais de bait-and-switch.
export const QUESTION_BY_CASE: Record<string, { question: string; placeholder: string }> = {
  nouveau_produit: {
    question: "Quel produit ou quelle offre voulez-vous construire ?",
    placeholder: "Ex : Lancer une offre de télérelève citoyenne — quel concept retenir, avec quelles exigences ?",
  },
  conception_complexe: {
    question: "Quel système voulez-vous concevoir ?",
    placeholder: "Ex : Quelle architecture retenir pour la nouvelle plateforme, avant d'avoir les données d'essai ?",
  },
  strategique: {
    question: "Quelle stratégie voulez-vous définir ?",
    placeholder: "Ex : Quel cap pour notre activité B2B à horizon 2030 — croissance organique, partenariat ou acquisition ?",
  },
  risque: {
    question: "Quels risques voulez-vous anticiper ?",
    placeholder: "Ex : Sécuriser notre approvisionnement critique — quelles parades engager, dans quel ordre ?",
  },
  investissement: {
    question: "Quel investissement voulez-vous arbitrer ?",
    placeholder: "Ex : Faut-il acquérir le fournisseur X ou signer un contrat long terme ?",
  },
  _default: {
    question: "Quelle décision souhaitez-vous arbitrer ?",
    placeholder: "Ex : Faut-il acquérir le fournisseur X ou signer un contrat long terme ?",
  },
};

// ── Démos intégrées (?demo=…) ────────────────────────────────────────────────
// Trois exemples complets, prêts à l'arbitrage : un investissement (télérelève),
// une conception hyper-technique (drone martien — le potentiel d'innovation se
// lit dans les inconnues DÉCISIVES), une stratégie (expansion européenne).
export const dMk = (id: string, label: string, importance: ImportanceBadge, level: "MOE" | "MOP" | "TPM", children?: AtelierCriterion[]): AtelierCriterion =>
  ({ id, label, poids: 25, description: "", importance, level, ...(children ? { children } : {}) });
export const dSc = (id: string, label: string, color: string, description: string, choix: Array<[string, string, string]>): AtelierScenario =>
  ({ id, label, color, description, leviers: choix.map(([lid, llabel, oid]) => ({ id: lid, label: llabel, valeur: oid, type: "decision" as const })), scores: {}, valeur: 50, faisabilite: 60 });

const RAW_DEMOS: Record<string, (base: AtelierSession) => AtelierSession> = {
  telereleve: (base) => ({
    ...base,
    title: "Exemple — Modernisation télérelève", step: "decider", attitude: "Optimiste",
    caseType: "investissement", modelValidated: true,
    contextRaw: "Moderniser la télérelève du territoire à horizon 2030 : investir dans une plateforme mutualisée ou moderniser l'infrastructure existante ?",
    elicitation: { step: 6, objectif: "Sécuriser la relève et réduire les pertes réseau", horizon: "2026-2030", decideurs: "Direction générale · Comité d'investissement", impactes: "Exploitation, service clientèle, abonnés", resistances: "", exigencesNonNeg: "Budget plafonné · continuité de service", risques: ["Dépendance opérateur radio", "Obsolescence compteurs 2028"], leviersDDP: "", contraintesDIP: "", pestelSelected: [], pestelAnswers: {} },
    criteria: [
      dMk("m1", "Performance économique", "Important", "MOE", [dMk("p1", "Coûts maîtrisés", "Important", "MOP", [dMk("t1", "Coût d'exploitation", "Essentiel", "TPM"), dMk("t2", "Investissement initial", "Secondaire", "TPM"), dMk("t5", "Pertes réseau évitées", "Important", "TPM")])]),
      dMk("m2", "Robustesse technique", "Essentiel", "MOE", [
        dMk("p2", "Qualité de service", "Important", "MOP", [dMk("t3", "Fiabilité réseau", "Essentiel", "TPM"), dMk("t4", "Maintenabilité", "Important", "TPM")]),
        dMk("p3", "Pérennité", "Important", "MOP", [dMk("t6", "Sécurité des données de relève", "Important", "TPM"), dMk("t7", "Évolutivité vers de nouveaux usages", "Secondaire", "TPM")]),
      ]),
    ],
    leviersDef: [
      { id: "L1", label: "Mode de réalisation", type: "decision", options: [
        { id: "o1", label: "Internaliser", impacts: { t1: "+", t3: "+", t4: "+" } },
        { id: "o2", label: "Sous-traiter", impacts: { t1: "++", t2: "+", t3: "U" } } ] },
      { id: "L2", label: "Technologie", type: "decision", options: [
        { id: "o3", label: "Plateforme cloud", impacts: { t3: "++", t4: "+", t2: "U", t7: "++", t6: "-L" } },
        { id: "o4", label: "On-premise", impacts: { t4: "+", t1: "U", t6: "+", t7: "-" } } ] },
      { id: "L3", label: "Déploiement des compteurs", type: "decision", options: [
        { id: "o5", label: "Remplacement à l'échéance", impacts: { t2: "+", t5: "-L" } },
        { id: "o6", label: "Campagne accélérée", impacts: { t5: "++", t2: "-", t4: "-L" } } ] },
      { id: "L4", label: "Réseau radio", type: "decision", options: [
        { id: "o7", label: "Opérateur actuel", impacts: { t3: "-L", t1: "-L" } },
        { id: "o8", label: "Réseau mutualisé longue portée", impacts: { t3: "+", t7: "+", t6: "U" } } ] },
    ] as AtelierLevierDef[],
    scenarios: [
      dSc("d1", "Internaliser + Cloud", "#6366f1", "Maîtrise interne, plateforme moderne", [["L1", "Mode de réalisation", "o1"], ["L2", "Technologie", "o3"], ["L3", "Déploiement des compteurs", "o6"], ["L4", "Réseau radio", "o8"]]),
      dSc("d2", "Sous-traiter + On-premise", "#f59e0b", "Externalisation, infrastructure conservée", [["L1", "Mode de réalisation", "o2"], ["L2", "Technologie", "o4"], ["L3", "Déploiement des compteurs", "o5"], ["L4", "Réseau radio", "o7"]]),
    ],
  }),

};

// Démos intégrées : matrice d'impacts complétée (justifiée, « à confirmer »).
export const DEMO_FACTORIES: Record<string, (base: AtelierSession) => AtelierSession> = Object.fromEntries(
  Object.entries(RAW_DEMOS).map(([k, f]) => [k, (base: AtelierSession) => { const s = f(base); return { ...s, leviersDef: applyDemoJudgements(k, completeDemoImpacts(s.leviersDef, s.criteria, optionHints), s.criteria) }; }]),
);
