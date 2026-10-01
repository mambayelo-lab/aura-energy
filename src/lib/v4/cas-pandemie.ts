// Cas « pandémie » : même modèle que cas-detroits.ts. Scénario illustratif,
// aucun chiffre inventé : les faits du PESTEL sont cités avec leur source et
// leur date ; les effets des options sont des jugements de cadrage ordinaux,
// « à confirmer ». Trois formes : un cas illustré dans Décider (sans données),
// une évaluation prédéfinie dans Décider intégré à Supply (sans alerte), et la
// réponse à une alerte Maison Lucie (pic de demande, amplification des
// commandes, ruptures, absentéisme), construite à partir des valeurs lues.
import type { AtelierCriterion, AtelierScenario, AtelierSession, ImportanceBadge } from "./atelier-store";
import type { PestelKey } from "./decision-dialogue";
import type { SectorCase } from "./pack-energie";
import type { FaitSource } from "./cas-detroits";
import type { SignauxSanitaires } from "./resilience-tts";

export const PANDEMIE_AVERTISSEMENT = "Scénario illustratif, construit à partir de travaux publiés et datés (OMS, OCDE, MIT, McKinsey Global Institute). Il ne prédit aucune crise sanitaire.";
export const PANDEMIE_RECHERCHE = "30 septembre 2026";

/** PESTEL sourcé et daté (faits cités tels que publiés). */
export const PANDEMIE_PESTEL: FaitSource[] = [
  { dim: "P", texte: "L'OCDE recommande des stress-tests conjoints public-privé des chaînes essentielles : stocks stratégiques, vitesse de montée en cadence, diversification des importations, restrictions à l'export.", source: "OCDE, Keys to resilient supply chains", url: "https://search.oecd.org/trade/resilient-supply-chains/", date: "consulté le 30 septembre 2026" },
  { dim: "P", texte: "L'Union européenne (HERA) tient une liste des médicaments critiques, matières premières comprises, et a lancé en 2024 la Critical Medicines Alliance.", source: "Commission européenne, HERA", url: "https://health.ec.europa.eu/health-emergency-preparedness-and-response-hera/preparedness/addressing-market-challenges_en", date: "consulté le 30 septembre 2026" },
  { dim: "E", texte: "Les perturbations d'un mois ou plus surviennent en moyenne tous les 3,7 ans et coûtent l'équivalent de 45 % d'une année d'EBITDA sur une décennie.", source: "McKinsey Global Institute, Risk, resilience, and rebalancing in global value chains", url: "https://www.preventionweb.net/publication/risk-resilience-and-rebalancing-global-value-chains", date: "août 2020" },
  { dim: "E", texte: "Pendant le COVID-19, la demande a varié de façon inédite puis les commandes ont été doublées et les stocks gonflés à la reprise : l'effet coup de fouet (bullwhip) a contribué aux pénuries, notamment de semi-conducteurs.", source: "The Aerospace Corporation, SCRM", url: "https://scrm.aerospace.org/scrm-document/the-implications-of-covid-19-bullwhip-and-ripple-effects-in-global-supply-chains/", date: "consulté le 30 septembre 2026" },
  { dim: "S", texte: "Le cadre SPAR de l'OMS (Règlement sanitaire international) compte 35 indicateurs sur 15 capacités, dont C.7.3, logistique d'urgence et gestion de la chaîne d'approvisionnement.", source: "PMC, étude sur le SPAR de l'OMS", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12111758/", date: "2025" },
  { dim: "T", texte: "Le COVID-19 a creusé l'écart entre les entreprises leaders et les retardataires de la prévision par apprentissage automatique ; le remède : des données courantes et le jugement humain.", source: "MIT CTL, Digital Supply Chain Transformation Lab (Sáenz et Caballero)", url: "https://digitalsc.mit.edu/covid-19-separates-leaders-from-laggards-in-ml-driven-demand-forecasting/", date: "2020" },
  { dim: "T", texte: "C'est la hausse de la volatilité, plus que celle du volume, qui a dégradé la précision des prévisions par IA pendant la pandémie.", source: "Jackson et Ivanov, Transportation Research Part E", url: "https://trid.trb.org/View/2292843", date: "2023" },
  { dim: "L", texte: "Des entreprises utilisent le modèle du MIT (délai de survie et délai de reprise) pour repérer les nœuds de la chaîne qui exposent le plus leur activité.", source: "MIT News", url: "https://news.mit.edu/2022/companies-use-mit-research-identify-respond-supply-chain-risks-0615", date: "15 juin 2022" },
];
export const pandemiePestelAnswers = () => {
  const out: Partial<Record<PestelKey, string>> = {};
  for (const f of PANDEMIE_PESTEL) out[f.dim] = [out[f.dim], `${f.texte} (${f.source}, ${f.date})`].filter(Boolean).join(" ");
  return out;
};

const K = (id: string, label: string, importance: ImportanceBadge, level: "MOE" | "MOP" | "TPM", description: string, children?: AtelierCriterion[]): AtelierCriterion =>
  ({ id, label, poids: importance === "Essentiel" ? 90 : importance === "Important" ? 75 : 55, description, importance, level, ...(children ? { children } : {}) });
const S = (id: string, label: string, color: string, description: string, leviers: [string, string, string][], insight: string): AtelierScenario =>
  ({ id, label, color, description, leviers: leviers.map(([lid, llabel, oid]) => ({ id: lid, label: llabel, valeur: oid, type: "decision" as const })), scores: {}, valeur: 50, faisabilite: 60, auraInsight: insight });

export const PANDEMIE: SectorCase = {
  key: "supply-pandemie",
  bouton: "Pandémie",
  title: "Crise sanitaire (pandémie) : comment tenir le service quand la demande s'emballe et que les sources ferment ?",
  contextRaw: `${PANDEMIE_AVERTISSEMENT} Une entreprise européenne s'approvisionne en partie en Asie. Une zone de production est confinée, la demande de certaines références bondit, les commandes s'amplifient le long de la chaîne et une partie des équipes d'entrepôt est absente. Faut-il doubler les sources, constituer des stocks stratégiques, plafonner les commandes, contractualiser de la flexibilité ou former des équipes polyvalentes ?`,
  caseType: "operationnel",
  objectif: "Tenir le service sur les références critiques pendant la crise, sans surstock à la reprise",
  horizon: "Les six prochains mois",
  decideurs: "Direction supply chain · Achats · Direction des opérations · Direction financière",
  impactes: "Clients, équipes d'entrepôt et de transport, fournisseurs, planificateurs",
  exigencesNonNeg: "Sécurité des équipes · aucune rupture sur les références critiques",
  risques: ["Rupture des références dont le délai de reprise dépasse le délai de survie", "Effet coup de fouet : surcommandes puis surstock à la reprise", "Absentéisme qui bloque les expéditions", "Restrictions à l'export sur des composants"],
  criteria: [
    K("p-serv", "Continuité de service", "Essentiel", "MOE", "Ce que le client constate pendant la crise", [
      K("p-serv-flux", "Disponibilité", "Essentiel", "MOP", "Capacité à servir malgré la crise", [
        K("p-tts", "Délai de survie des références critiques (TTS)", "Essentiel", "TPM", "Jours de service avec le stock disponible et en transit"),
        K("p-service", "Taux de service client", "Essentiel", "TPM", "Part des commandes servies à temps et complètes"),
        K("p-ttr", "Délai de reprise (TTR)", "Important", "TPM", "Jours pour retrouver une source ou une capacité"),
      ]),
      K("p-serv-ops", "Capacité opérationnelle", "Important", "MOP", "Équipes et flux tenus", [
        K("p-absent", "Postes critiques tenus", "Important", "TPM", "Part des postes d'entrepôt et de transport couverts malgré l'absentéisme"),
        K("p-bullwhip", "Amplification des commandes", "Important", "TPM", "Commandes passées rapportées à la demande réelle (effet coup de fouet)"),
      ]),
    ]),
    K("p-eco", "Coût et capital", "Important", "MOE", "Ce que la protection coûte", [
      K("p-eco-cout", "Coût complet", "Important", "MOP", "Stock, achats et contrats", [
        K("p-stock", "Valeur du stock stratégique", "Important", "TPM", "Capital immobilisé dans les stocks de précaution"),
        K("p-cout", "Surcoût d'achat et de transport", "Important", "TPM", "Écart de coût des sources et modes de secours"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "PL1", label: "Sourcing", type: "decision", options: [
      { id: "po-src-act", label: "Sources actuelles", impacts: { "p-ttr": "-L" } },
      { id: "po-src-double", label: "Double sourcing dans une autre région", impacts: { "p-ttr": "++", "p-tts": "+", "p-service": "+", "p-cout": "-L" }, justification: "Réduit le délai de reprise si une zone ferme ; qualification à instruire." },
      { id: "po-src-proche", label: "Bascule partielle vers une source proche", impacts: { "p-ttr": "+", "p-service": "+", "p-cout": "-L" }, justification: "Raccourcit la chaîne ; capacité à confirmer.", exploratoire: true },
    ] },
    { id: "PL2", label: "Stock stratégique", type: "budget", options: [
      { id: "po-stock-act", label: "Stock actuel", impacts: { "p-stock": "+", "p-tts": "-L" } },
      { id: "po-stock-ttr", label: "Stock tampon sur les références où TTR > TTS", impacts: { "p-tts": "++", "p-service": "+", "p-stock": "-" }, justification: "Couvre l'écart entre survie et reprise, là seulement où il existe." },
    ] },
    { id: "PL3", label: "Pilotage de la demande", type: "decision", options: [
      { id: "po-dem-libre", label: "Commandes au fil de l'eau", impacts: { "p-bullwhip": "-" } },
      { id: "po-dem-plafond", label: "Plafonnement et allocation des commandes", impacts: { "p-bullwhip": "++", "p-service": "+L", "p-stock": "+" }, justification: "Limite l'effet coup de fouet et le surstock à la reprise." },
    ] },
    { id: "PL4", label: "Contrats", type: "decision", options: [
      { id: "po-ctr-act", label: "Contrats actuels", impacts: {} },
      { id: "po-ctr-flex", label: "Contrats de flexibilité (volumes et capacité réservée)", impacts: { "p-ttr": "+", "p-cout": "-L", "p-service": "++" }, justification: "Mieux vaut plier que rompre : de la capacité réservée contre un engagement." },
    ] },
    { id: "PL5", label: "Équipes", type: "technique", options: [
      { id: "po-eq-act", label: "Organisation actuelle", impacts: { "p-absent": "-L" } },
      { id: "po-eq-poly", label: "Polyvalence et plan de continuité des équipes", impacts: { "p-absent": "++", "p-cout": "-L" }, justification: "Garde les postes critiques tenus malgré l'absentéisme." },
    ] },
  ],
  scenarios: [
    S("p-s1", "Absorber avec l'existant", "#f59e0b", "Sources et stocks actuels, commandes au fil de l'eau.",
      [["PL1", "Sourcing", "po-src-act"], ["PL2", "Stock stratégique", "po-stock-act"], ["PL3", "Pilotage de la demande", "po-dem-libre"], ["PL4", "Contrats", "po-ctr-act"], ["PL5", "Équipes", "po-eq-act"]],
      "Aucun coût tant que la crise ne dure pas ; les références où TTR > TTS rompent en premier."),
    S("p-s2", "Tamponner et plafonner", "#10b981", "Stock tampon ciblé, plafonnement des commandes, polyvalence.",
      [["PL1", "Sourcing", "po-src-act"], ["PL2", "Stock stratégique", "po-stock-ttr"], ["PL3", "Pilotage de la demande", "po-dem-plafond"], ["PL4", "Contrats", "po-ctr-act"], ["PL5", "Équipes", "po-eq-poly"]],
      "Le service tient à court terme ; le capital immobilisé augmente."),
    S("p-s3", "Reconfigurer les sources", "#6366f1", "Double sourcing, contrats de flexibilité, plafonnement.",
      [["PL1", "Sourcing", "po-src-double"], ["PL2", "Stock stratégique", "po-stock-act"], ["PL3", "Pilotage de la demande", "po-dem-plafond"], ["PL4", "Contrats", "po-ctr-flex"], ["PL5", "Équipes", "po-eq-poly"]],
      "Le délai de reprise baisse durablement ; qualification et coût d'achat à instruire."),
  ],
};

/** Évaluation prédéfinie pour Décider intégré à Supply (sans alerte). */
export function pandemiePreset(base: AtelierSession, prepare: (c: SectorCase) => SectorCase, elicit: (c: SectorCase) => Partial<NonNullable<AtelierSession["elicitation"]>>): AtelierSession {
  const k = prepare(PANDEMIE);
  const answers = pandemiePestelAnswers();
  const sources = PANDEMIE_PESTEL.map(f => `${f.source}, ${f.date} : ${f.url}`);
  return {
    ...base,
    title: PANDEMIE.title, contextRaw: `${PANDEMIE.contextRaw}\n\nSources (recherche du ${PANDEMIE_RECHERCHE}) :\n${[...new Set(sources)].join("\n")}`,
    sector: "Supply chain", caseType: PANDEMIE.caseType, step: "comprendre",
    criteria: k.criteria, leviersDef: k.leviersDef, scenarios: k.scenarios,
    elicitation: { ...(base.elicitation ?? {}), ...elicit(k), pestelSelected: Object.keys(answers), pestelAnswers: answers } as AtelierSession["elicitation"],
  };
}

/** Faits de l'alerte Maison Lucie, lus dans les données (jamais estimés). */
export function faitsSanitaires(s: SignauxSanitaires): string[] {
  return [
    s.picDemande ? `Pic de demande : +${s.picDemande.pct} % sur ${s.picDemande.sku} (valeur lue dans l'outil de planification).` : "Pic de demande : donnée non fournie par le SI.",
    s.amplification ? `Effet coup de fouet : ratio ${s.amplification.ratio.toLocaleString("fr-FR")} sur ${s.amplification.sku} (valeur lue dans l'outil de planification).` : "Effet coup de fouet : donnée non fournie par le SI.",
    s.positions ? `Ruptures : ${s.ruptures} position(s) sur ${s.positions} sous le stock de sécurité.` : "Ruptures : non lues.",
    s.absenteisme !== undefined ? `Absentéisme : ${s.absenteisme} % (source connectée).` : "Absentéisme : donnée non fournie par le SI.",
  ];
}

/** Contexte d'une décision « crise sanitaire » ouverte depuis une alerte ou un stress-test. */
export const pandemieDecisionContext = (faits: string[]) =>
  [`Lecture « crise sanitaire » des données (${PANDEMIE_AVERTISSEMENT})`, ...faits].join("\n");
