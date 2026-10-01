// Cas « perturbation d'un détroit maritime » (Bab el-Mandeb, mer Rouge, Ormuz).
// Scénario illustratif : aucune prise de position politique, aucun chiffre inventé.
// Les faits du PESTEL sont cités avec leur source et leur date de publication ;
// les effets des options sont des jugements de cadrage ordinaux, « à confirmer ».
// Il existe sous trois formes : un cas illustré dans Décider (sans données), une
// évaluation prédéfinie dans Décider intégré à Supply (sans alerte), et la réponse
// à une alerte de retard Maison Lucie sur un fournisseur asiatique (profil « détroit »).
import type { AtelierCriterion, AtelierScenario, AtelierSession, ImportanceBadge } from "./atelier-store";
import type { PestelKey } from "./decision-dialogue";
import type { SectorCase } from "./pack-energie";

export const DETROIT_AVERTISSEMENT = "Scénario illustratif, construit à partir de faits publiés et datés. Il ne prend aucune position politique et ne prédit pas l'évolution de la situation.";
/** Date de la recherche documentaire. */
export const DETROIT_RECHERCHE = "29 septembre 2026";

export interface FaitSource { dim: PestelKey; texte: string; source: string; url: string; date: string }
/** PESTEL sourcé et daté (faits cités tels que publiés). */
export const DETROIT_PESTEL: FaitSource[] = [
  { dim: "P", texte: "Après l'annonce d'un blocus maritime visant les expéditions saoudiennes, le trafic dans le détroit de Bab el-Mandeb a baissé de 24 %, surtout pour les pétroliers ; le trafic du canal de Suez est resté globalement stable.", source: "Lloyd's List Intelligence, Red Sea Brief", url: "https://www.lloydslistintelligence.com/resources/blog/red-sea-brief-6-august-2026", date: "6 août 2026" },
  { dim: "P", texte: "290 navires ont franchi le point de passage nord de la mer Rouge en une semaine : 36 % sous le niveau normal, mais 30 % de plus qu'en 2025 ; le niveau de menace reste élevé.", source: "Lloyd's List Intelligence, Red Sea Brief", url: "https://www.lloydslistintelligence.com/resources/blog/red-sea-brief-3-september-2026", date: "3 septembre 2026" },
  { dim: "E", texte: "Indice Drewry : 4 465 $ par conteneur de 40 pieds ; Shanghai → Rotterdam 4 092 $ (−5 %), Shanghai → Gênes 4 368 $ (−10 %) sur la semaine.", source: "Drewry World Container Index, repris par DCN", url: "https://www.thedcn.com.au/news/world-container-index-3-september-2026", date: "3 septembre 2026" },
  { dim: "E", texte: "Dans le Golfe, plusieurs assureurs (Gard, Skuld, NorthStandard, London P&I Club, American Club) ont annulé la couverture risque de guerre à compter du 5 mars ; le détroit d'Ormuz voit passer environ un cinquième de la demande mondiale de pétrole.", source: "gCaptain", url: "https://gcaptain.com/marine-insurers-cancel-war-risk-iran-hormuz/", date: "2 mars 2026" },
  { dim: "En", texte: "Le contournement par le cap de Bonne-Espérance ajoute environ 5 800 milles nautiques entre l'Extrême-Orient et la Méditerranée ; les émissions de ces trajets ont augmenté de 63 % au premier trimestre 2024 par rapport au quatrième trimestre 2023.", source: "FreightWaves, d'après Xeneta", url: "https://www.freightwaves.com/news/xeneta-finds-supply-chain-diversions-fuel-spike-in-carbon-emissions", date: "26 avril 2024" },
  { dim: "L", texte: "Système européen d'échange de quotas (ETS) : en 2026, les armateurs restituent des quotas pour 70 % des émissions déclarées en 2025, 100 % à partir de 2027 ; les voyages qui commencent ou finissent hors de l'EEE comptent pour 50 %.", source: "Agence européenne pour la sécurité maritime (EMSA)", url: "https://www.emsa.europa.eu/reducing-emissions/extension-ets.html", date: "consulté le 29 septembre 2026" },
];
export const pestelAnswers = () => {
  const out: Partial<Record<PestelKey, string>> = {};
  for (const f of DETROIT_PESTEL) out[f.dim] = [out[f.dim], `${f.texte} (${f.source}, ${f.date})`].filter(Boolean).join(" ");
  return out;
};

/** Trajet Asie → Europe (origine asiatique, destination européenne) : le flux maritime passe par la mer Rouge ou contourne par le cap. */
export const estRouteAsieEurope = (txt: string) =>
  /(shenzhen|shanghai|ningbo|guangzhou|canton|hong kong|qingdao|xiamen|busan|singapour|singapore|ho chi minh|mumbai|chennai|asie|asia|chine|china|vietnam|inde|india)[^\n]*?(→|->|vers|to)\s*[^\n]*?(paris|europe|rotterdam|le havre|hambourg|hamburg|anvers|antwerp|g[eè]nes|genoa|milan|marseille|lyon|barcelone|valence)/i.test(txt);

/** Sources d'inspiration : ce qui a pu être lu, et ce qui ne l'a pas été. */
export const SOURCES_INSPIRATION: { url: string; titre: string; statut: "lue" | "inaccessible"; note: string }[] = [
  { url: "https://executive.mit.edu/course/supply-chain-strategy-and-management/a056g00000URaN6AAL.html", titre: "MIT Sloan Executive Education · Supply Chain Strategy and Management", statut: "lue", note: "Programme sur l'intégration de la chaîne, l'approvisionnement, le make or buy et les partenariats, avec une séance sur l'IA générative et la numérisation de la supply chain." },
  { url: "https://scm.mit.edu/people/maria-jesus-saenze/", titre: "MIT CTL · María Jesús Sáenz", statut: "lue", note: "Directrice du Digital Supply Chain Transformation Lab ; travaux sur la collaboration, les capacités numériques et l'IA dans la supply chain." },
  { url: "https://www.mdpi.com/2220-9964/15/8/361", titre: "MDPI · ISPRS International Journal of Geo-Information, 15(8), 361", statut: "inaccessible", note: "Page refusée (HTTP 403) : contenu non lu, rien n'en est repris." },
  { url: "https://www.sciencedirect.com/special-issue/105HVDR4G6X", titre: "ScienceDirect · numéro spécial 105HVDR4G6X", statut: "inaccessible", note: "Page refusée (HTTP 403) : contenu non lu, rien n'en est repris." },
  { url: "https://link.springer.com/chapter/10.1007/978-981-95-6402-6_7", titre: "Springer · chapitre 10.1007/978-981-95-6402-6_7", statut: "inaccessible", note: "Redirection vers une authentification : contenu non lu, rien n'en est repris." },
  { url: "https://www.infosysbpm.com/blogs/retail-cpg-logistics/multi-modal-transportation-for-seamless-integration-and-efficiency.html", titre: "Infosys BPM · Understanding multimodal transportation", statut: "inaccessible", note: "Page refusée (HTTP 403) ; seul son titre a été vu (il traite du transport multimodal). Rien d'autre n'en est repris." },
  { url: "https://www.ensta.fr/formations/mastere-specialise-intelligence-artificielle-multimodale-et-autonome", titre: "ENSTA · Mastère spécialisé Intelligence artificielle multimodale et autonome", statut: "lue", note: "Formation de 18 mois avec Télécom Paris (robotique, interaction homme-machine, traitement du langage) ; sans lien direct avec le transport, citée pour la multimodalité des données." },
  { url: "https://www.tandfonline.com/doi/full/10.1080/00207543.2023.2276811", titre: "International Journal of Production Research · 10.1080/00207543.2023.2276811", statut: "inaccessible", note: "Page refusée (HTTP 403) : contenu non lu, rien n'en est repris." },
];

const K = (id: string, label: string, importance: ImportanceBadge, level: "MOE" | "MOP" | "TPM", description: string, children?: AtelierCriterion[]): AtelierCriterion =>
  ({ id, label, poids: importance === "Essentiel" ? 90 : importance === "Important" ? 75 : 55, description, importance, level, ...(children ? { children } : {}) });
const S = (id: string, label: string, color: string, description: string, leviers: [string, string, string][], insight: string): AtelierScenario =>
  ({ id, label, color, description, leviers: leviers.map(([lid, llabel, oid]) => ({ id: lid, label: llabel, valeur: oid, type: "decision" as const })), scores: {}, valeur: 50, faisabilite: 60, auraInsight: insight });

export const DETROITS: SectorCase = {
  key: "supply-detroits",
  bouton: "Perturbation d'un détroit",
  title: "Perturbation d'un détroit maritime (mer Rouge, Bab el-Mandeb, Ormuz) : comment protéger le flux Asie → Europe ?",
  contextRaw: `${DETROIT_AVERTISSEMENT} Une entreprise européenne importe des composants d'Asie par voie maritime. Le passage par la mer Rouge et le canal de Suez est perturbé, et les primes d'assurance risque de guerre s'envolent dans le Golfe. Faut-il contourner par le cap de Bonne-Espérance, combiner mer-air ou mer-rail, renforcer le stock, diversifier les fournisseurs ou sécuriser le fret par contrat ?`,
  caseType: "operationnel",
  objectif: "Tenir le service client en Europe malgré la perturbation, sans dérive de coût ni d'émissions",
  horizon: "Les deux prochains trimestres",
  decideurs: "Direction supply chain · Achats · Direction financière",
  impactes: "Clients européens, planificateurs, transitaires, fournisseurs asiatiques",
  exigencesNonNeg: "Aucune rupture chez les clients prioritaires · aucun transit sans couverture d'assurance",
  risques: ["Allongement durable des délais de transit", "Hausse du fret et des primes d'assurance", "Hausse des émissions et du coût carbone (ETS)", "Stock immobilisé sur des références qui ne tournent pas"],
  criteria: [
    K("d-serv", "Continuité de service", "Essentiel", "MOE", "Ce que le client européen constate", [
      K("d-serv-flux", "Délai et fiabilité du flux", "Essentiel", "MOP", "Temps et régularité de l'acheminement", [
        K("d-delai", "Délai de transit Asie-Europe", "Essentiel", "TPM", "Jours entre le départ d'Asie et l'arrivée en Europe"),
        K("d-service", "Taux de service client", "Essentiel", "TPM", "Part des commandes servies à temps et complètes"),
      ]),
      K("d-serv-risque", "Exposition au risque", "Important", "MOP", "Dépendance au passage d'un détroit perturbé", [
        K("d-expo", "Exposition au passage d'un détroit", "Important", "TPM", "Part du flux qui dépend de la mer Rouge ou d'Ormuz"),
      ]),
    ]),
    K("d-eco", "Coût complet et empreinte", "Important", "MOE", "Ce que la protection coûte, en argent et en carbone", [
      K("d-eco-cout", "Coût et capital", "Important", "MOP", "Fret, assurance, stock et émissions", [
        K("d-fret", "Coût de fret par conteneur", "Essentiel", "TPM", "Taux payé par conteneur de 40 pieds"),
        K("d-stock", "Immobilisation de stock", "Important", "TPM", "Valeur du stock en transit et de sécurité"),
        K("d-assur", "Coût d'assurance et de couverture", "Important", "TPM", "Primes risque de guerre et clauses contractuelles"),
        K("d-co2", "Émissions de CO2 du transport", "Important", "TPM", "Émissions par conteneur acheminé, soumises en partie à l'ETS"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "DL1", label: "Route maritime", type: "decision", options: [
      { id: "do-suez", label: "Maintenir la route Suez / mer Rouge", impacts: { "d-delai": "+", "d-expo": "--", "d-fret": "+", "d-co2": "+", "d-assur": "-" }, justification: "Route la plus courte, mais exposée au détroit et aux primes de risque." },
      { id: "do-cap", label: "Reroutage par le cap de Bonne-Espérance", impacts: { "d-delai": "--", "d-expo": "++", "d-fret": "-", "d-co2": "--", "d-stock": "-", "d-service": "-L" }, justification: "Évite le détroit, au prix d'environ 5 800 milles de plus (FreightWaves, 2024)." },
    ] },
    { id: "DL2", label: "Mode de transport", type: "technique", options: [
      { id: "do-mer", label: "Maritime seul", impacts: { "d-fret": "+", "d-co2": "+" }, justification: "Le moins cher et le moins émetteur par conteneur, le plus lent." },
      { id: "do-merair", label: "Mer-air sur les références critiques", impacts: { "d-delai": "++", "d-service": "+", "d-fret": "--", "d-co2": "--" }, justification: "Accélère ce qui manque, avec un surcoût et des émissions nettement plus élevés." },
      { id: "do-merrail", label: "Mer-rail par un corridor terrestre", impacts: { "d-delai": "+", "d-expo": "+", "d-fret": "-L", "d-co2": "-L" }, justification: "Réduit le délai et la dépendance au détroit, avec une capacité limitée.", exploratoire: true },
    ] },
    { id: "DL3", label: "Couverture de stock", type: "budget", options: [
      { id: "do-stock-act", label: "Stock actuel", impacts: { "d-stock": "+", "d-service": "-L" } },
      { id: "do-stock-plus", label: "Stock de sécurité renforcé sur les références critiques", impacts: { "d-service": "++", "d-stock": "--" }, justification: "Absorbe l'allongement du délai, en immobilisant du capital." },
    ] },
    { id: "DL4", label: "Sourcing", type: "decision", options: [
      { id: "do-src-act", label: "Fournisseur asiatique actuel", impacts: { "d-expo": "-L" } },
      { id: "do-src-eu", label: "Double sourcing ou nearshoring partiel en Europe", impacts: { "d-expo": "++", "d-delai": "++", "d-co2": "+", "d-fret": "+", "d-service": "+" }, justification: "Réduit durablement l'exposition ; qualification longue et coût d'achat à instruire." },
    ] },
    { id: "DL5", label: "Fret et couverture", type: "decision", options: [
      { id: "do-spot", label: "Fret au taux spot", impacts: { "d-fret": "-" } },
      { id: "do-contrat", label: "Contrats de fret à taux et capacité garantis", impacts: { "d-fret": "+", "d-service": "+L" }, justification: "Stabilise le coût et réserve de la capacité." },
      { id: "do-assur", label: "Assurance risque de guerre et clauses de force majeure", impacts: { "d-assur": "-", "d-expo": "+L" }, justification: "Couvre le risque de transit, avec des primes en forte hausse (gCaptain, mars 2026)." },
    ] },
  ],
  scenarios: [
    S("d-s1", "Attendre sur la route actuelle", "#f59e0b", "Route Suez maintenue, fret au spot, rien ne change.",
      [["DL1", "Route maritime", "do-suez"], ["DL2", "Mode de transport", "do-mer"], ["DL3", "Couverture de stock", "do-stock-act"], ["DL4", "Sourcing", "do-src-act"], ["DL5", "Fret et couverture", "do-spot"]],
      "Le coût reste bas tant que la route tient ; l'exposition au détroit reste entière."),
    S("d-s2", "Contourner et sécuriser", "#10b981", "Cap de Bonne-Espérance, stock renforcé, fret sous contrat.",
      [["DL1", "Route maritime", "do-cap"], ["DL2", "Mode de transport", "do-mer"], ["DL3", "Couverture de stock", "do-stock-plus"], ["DL4", "Sourcing", "do-src-act"], ["DL5", "Fret et couverture", "do-contrat"]],
      "Le service est protégé ; le délai, le stock et les émissions se dégradent."),
    S("d-s3", "Diversifier les modes et les sources", "#6366f1", "Mer-rail, double sourcing européen, assurance.",
      [["DL1", "Route maritime", "do-cap"], ["DL2", "Mode de transport", "do-merrail"], ["DL3", "Couverture de stock", "do-stock-act"], ["DL4", "Sourcing", "do-src-eu"], ["DL5", "Fret et couverture", "do-assur"]],
      "L'exposition baisse durablement ; la capacité ferroviaire et la qualification des fournisseurs sont à instruire."),
  ],
};

/** Évaluation prédéfinie pour Décider intégré à Supply (sans alerte) : Comprendre pré-rempli, PESTEL sourcé. */
export function detroitPreset(base: AtelierSession, prepare: (c: SectorCase) => SectorCase, elicit: (c: SectorCase) => Partial<NonNullable<AtelierSession["elicitation"]>>): AtelierSession {
  const k = prepare(DETROITS);
  const answers = pestelAnswers();
  const sources = DETROIT_PESTEL.map(f => `${f.source}, ${f.date} : ${f.url}`);
  return {
    ...base,
    title: DETROITS.title, contextRaw: `${DETROITS.contextRaw}\n\nSources (recherche du ${DETROIT_RECHERCHE}) :\n${[...new Set(sources)].join("\n")}`,
    sector: "Supply chain", caseType: DETROITS.caseType, step: "comprendre",
    criteria: k.criteria, leviersDef: k.leviersDef, scenarios: k.scenarios,
    elicitation: { ...(base.elicitation ?? {}), ...elicit(k), pestelSelected: Object.keys(answers), pestelAnswers: answers } as AtelierSession["elicitation"],
  };
}
