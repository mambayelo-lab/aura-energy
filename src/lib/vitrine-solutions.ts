// vitrine-solutions.ts — classification unique des cas d'application.
//
// ── Pourquoi ce fichier ─────────────────────────────────────────────────────
// La vitrine disait ses domaines d'application à quatre endroits : zooms
// sectoriels, enjeux du moment, galerie d'illustrations, fiches secteurs. Le
// visiteur lisait quatre fois la même chose sans jamais savoir QUEL produit
// traite SON problème. Une seule entrée le remplace : le secteur, puis le cas,
// puis le produit qui le tranche et le livrable qu'il en sort.
//
// Règle tenue : un cas = une question que le comité se pose déjà, un produit
// responsable, un livrable nommé. Aucun chiffre, aucune référence client.

export type ProduitId = "decider" | "copilote" | "architecturer";

export interface SolutionCase {
  /** La question telle qu'elle se pose en comité. */
  q: { fr: string; en: string };
  /** Produit qui la traite. Un seul : celui par lequel on entre. */
  p: ProduitId;
  /** Ce que le client a en main à la sortie. */
  l: { fr: string; en: string };
  /** Enchaînement naturel vers un autre produit, quand il existe. */
  suite?: ProduitId;
}

export interface SolutionSector {
  id: string;
  label: { fr: string; en: string };
  priority: boolean;
  /** Ce qui coince aujourd'hui dans ce secteur, en une phrase. */
  coince: { fr: string; en: string };
  cases: SolutionCase[];
}

export const PRODUITS: Record<ProduitId, { label: { fr: string; en: string }; to: string; tag: { fr: string; en: string } }> = {
  decider: {
    label: { fr: "Décider", en: "Decide" },
    to: "/cockpit/atelier",
    tag: { fr: "Sans attendre les données", en: "Without waiting for data" },
  },
  copilote: {
    label: { fr: "Copilote décisionnel", en: "Decision copilot" },
    to: "/cockpit/copilote-decideur",
    tag: { fr: "Avec vos systèmes branchés", en: "With your systems connected" },
  },
  architecturer: {
    label: { fr: "Architecturer", en: "Architect" },
    to: "https://aura-architect-seven.vercel.app",
    tag: { fr: "De la décision au plan", en: "From decision to plan" },
  },
};

export const SOLUTIONS: SolutionSector[] = [
  {
    id: "retail",
    label: { fr: "Retail & distribution", en: "Retail & distribution" },
    priority: true,
    coince: {
      fr: "Les arbitrages assortiment, prix, réseau et promesse client sont tranchés séparément, par des directions qui ne partagent ni critères ni échelle.",
      en: "Assortment, price, network and customer promise are decided separately, by teams sharing neither criteria nor scale.",
    },
    cases: [
      { q: { fr: "Quelles références sortir de l'assortiment sans fermer de ventes stratégiques ?", en: "Which references to drop without closing strategic sales?" }, p: "decider", l: { fr: "Fiche signable : option retenue, critère décisif, réserves à lever.", en: "Signable brief: chosen option, deciding criterion, reservations to clear." } },
      { q: { fr: "Fermer, transformer ou ouvrir ce point de vente ?", en: "Close, convert or open this store?" }, p: "decider", l: { fr: "Classement des options et point de bascule par critère.", en: "Ranked options and tipping point per criterion." }, suite: "architecturer" },
      { q: { fr: "Quelle promesse de délai tenir par canal, et à quel coût de dernier kilomètre ?", en: "Which delivery promise per channel, at what last-mile cost?" }, p: "decider", l: { fr: "Combinaison de leviers retenue, suivie dans le registre.", en: "Selected lever combination, tracked in the registry." }, suite: "architecturer" },
      { q: { fr: "Où la démarque se crée-t-elle réellement dans nos flux ?", en: "Where is shrink actually created in our flows?" }, p: "copilote", l: { fr: "Santé par domaine, dérives signalées, dossier de décision préparé.", en: "Health by domain, flagged drifts, decision file prepared." }, suite: "decider" },
      { q: { fr: "Quel mécanisme de fidélité retient sans éroder la marge ?", en: "Which loyalty mechanism retains without eroding margin?" }, p: "decider", l: { fr: "Arbitrage remise / service / abonnement, réserves nommées.", en: "Discount / service / subscription trade-off, named reservations." } },
      { q: { fr: "Comment unifier commerce, stock et prix sur un socle qui tient ?", en: "How to unify commerce, stock and pricing on a solid foundation?" }, p: "architecturer", l: { fr: "Cartographie cible, flux référencés, backlog par vagues.", en: "Target map, referenced flows, wave-based backlog." } },
    ],
  },
  {
    id: "energie",
    label: { fr: "Énergie & Utilities", en: "Energy & Utilities" },
    priority: true,
    coince: {
      fr: "Chaque choix d'investissement doit être défendu devant un régulateur, alors que la donnée d'usage arrive après l'engagement.",
      en: "Every investment must be defended to a regulator, while usage data only arrives after commitment.",
    },
    cases: [
      { q: { fr: "Quel tronçon de réseau renouveler d'abord, sur quel critère assumé ?", en: "Which network segment to renew first, on which stated criterion?" }, p: "decider", l: { fr: "Priorisation opposable, critère décisif explicite.", en: "Defensible prioritisation with an explicit deciding criterion." } },
      { q: { fr: "Renforcer, stocker ou effacer la pointe ?", en: "Reinforce, store or shave the peak?" }, p: "decider", l: { fr: "Comparaison des trois options sous contrainte de sûreté non négociable.", en: "Three options compared under a non-negotiable safety constraint." }, suite: "architecturer" },
      { q: { fr: "Quelle trajectoire de décarbonation tenir palier par palier ?", en: "Which decarbonation pathway, step by step?" }, p: "decider", l: { fr: "Séquence de leviers engagés et suivi prévu / constaté.", en: "Committed lever sequence with planned / observed tracking." }, suite: "copilote" },
      { q: { fr: "Quelle place pour l'hydrogène et les nouvelles molécules dans le mix ?", en: "What role for hydrogen and new molecules in the mix?" }, p: "decider", l: { fr: "Faisabilité industrielle traitée comme critère, pas comme note.", en: "Industrial feasibility handled as a criterion, not a score." } },
      { q: { fr: "Nos relevés confirment-ils la trajectoire signée ?", en: "Do our readings confirm the signed pathway?" }, p: "copilote", l: { fr: "Boucle valeur prévu / constaté, preuves d'ancrage rattachées.", en: "Planned / observed value loop with attached evidence." } },
      { q: { fr: "Comment outiller comptage, réseau et marché sans rejouer un programme complet ?", en: "How to equip metering, network and market without a full programme?" }, p: "architecturer", l: { fr: "Architecture cible par vagues, exigences tracées.", en: "Wave-based target architecture with traced requirements." } },
    ],
  },
  {
    id: "supply",
    label: { fr: "Supply chain", en: "Supply chain" },
    priority: true,
    coince: {
      fr: "Résilience, empreinte et coût sont poursuivis en parallèle ; le compromis n'est jamais écrit, donc jamais tenu.",
      en: "Resilience, footprint and cost are pursued in parallel; the trade-off is never written down, so never held.",
    },
    cases: [
      { q: { fr: "Doubler la source ou tenir le stock face au même choc ?", en: "Dual-source or hold buffer stock against the same shock?" }, p: "decider", l: { fr: "Deux profils de risque comparés sans compensation.", en: "Two risk profiles compared without offsetting." } },
      { q: { fr: "Quel fournisseur retenir quand le moins cher est le plus fragile ?", en: "Which supplier when the cheapest is the most fragile?" }, p: "decider", l: { fr: "Critère éliminatoire tenu, classement défendable.", en: "Deal-breaker upheld, defensible ranking." } },
      { q: { fr: "Où placer le stock de découplage dans le réseau ?", en: "Where to place decoupling stock in the network?" }, p: "decider", l: { fr: "Combinaison de leviers et alternatives dominantes.", en: "Lever combination and dominating alternatives." }, suite: "architecturer" },
      { q: { fr: "Quelles boucles matière ouvrir sans dégrader le service ?", en: "Which material loops to open without degrading service?" }, p: "decider", l: { fr: "Arbitrage empreinte / service / coût, écrit et signé.", en: "Footprint / service / cost trade-off, written and signed." } },
      { q: { fr: "Quelle dérive de service annonce une rupture à venir ?", en: "Which service drift signals a coming disruption?" }, p: "copilote", l: { fr: "Signaux qualifiés et dossier de décision prêt.", en: "Qualified signals and a decision file ready." }, suite: "decider" },
      { q: { fr: "Quelle visibilité bout-en-bout construire, et dans quel ordre ?", en: "Which end-to-end visibility to build, and in what order?" }, p: "architecturer", l: { fr: "Flux qualifiés, diagrammes de séquence, estimation amont.", en: "Qualified flows, sequence diagrams, upfront estimate." } },
    ],
  },
  {
    id: "smart-cities",
    label: { fr: "Villes et territoires", en: "Cities and territories" },
    priority: false,
    coince: {
      fr: "Les décisions engagent des mandats et des riverains ; la justification compte autant que le choix.",
      en: "Decisions commit mandates and residents; the justification matters as much as the choice.",
    },
    cases: [
      { q: { fr: "Quel quartier traiter d'abord, et comment le justifier publiquement ?", en: "Which district first, and how to justify it publicly?" }, p: "decider", l: { fr: "Fiche signable et positions des parties prenantes.", en: "Signable brief and stakeholder positions." } },
      { q: { fr: "Quel scénario de mobilité retenir sous contrainte d'accessibilité ?", en: "Which mobility scenario under accessibility constraints?" }, p: "decider", l: { fr: "Réserves recueillies et levées par des faits.", en: "Reservations collected and cleared by facts." } },
      { q: { fr: "Comment relier les services techniques sans plateforme unique ?", en: "How to connect technical services without a single platform?" }, p: "architecturer", l: { fr: "Cible interopérable et séquence de construction.", en: "Interoperable target and build sequence." } },
    ],
  },
  {
    id: "produits-complexes",
    label: { fr: "Produits complexes", en: "Complex products" },
    priority: false,
    coince: {
      fr: "En conception amont, la donnée n'existe pas encore : seul l'avis d'ingénierie est disponible, et il est ordinal.",
      en: "In early design, data does not exist yet: only engineering judgement is available, and it is ordinal.",
    },
    cases: [
      { q: { fr: "Quelle architecture produit retenir avant tout essai ?", en: "Which product architecture before any test?" }, p: "decider", l: { fr: "Verdict sur avis d'ingénierie, reproductible.", en: "Verdict from engineering judgement, reproducible." } },
      { q: { fr: "Quelle configuration d'offre est défendable coût / valeur / faisabilité ?", en: "Which offer configuration is defensible on cost / value / feasibility?" }, p: "decider", l: { fr: "Espace d'offres exploré, configuration retenue.", en: "Offer space explored, configuration selected." } },
      { q: { fr: "Comment tracer l'exigence jusqu'au sous-système ?", en: "How to trace requirements down to the subsystem?" }, p: "architecturer", l: { fr: "Exigences tracées, vues croisées, backlog.", en: "Traced requirements, cross views, backlog." } },
    ],
  },
];

/** Texte de la section Solutions. Bilingue, hors du JSX comme le reste. */
export const SOL_COPY = {
  fr: {
    eyebrow: "Solutions",
    h2: "Votre décision, et le produit qui la tranche",
    lead: "Une entrée unique : le secteur, la question, le produit qui la traite, le livrable que vous en sortez. Retail, Énergie & Utilities et Supply chain sont nos secteurs prioritaires.",
    coince: "Ce qui coince",
    livrable: "Livrable",
    suite: "Se prolonge dans",
    priority: "Secteur prioritaire",
    secondary: "Traité sur demande",
    casLink: "Voir les cas de référence détaillés →",
  },
  en: {
    eyebrow: "Solutions",
    h2: "Your decision, and the product that settles it",
    lead: "One entry point: sector, question, the product that handles it, the deliverable you walk away with. Retail, Energy & Utilities and Supply chain are our priority sectors.",
    coince: "What blocks today",
    livrable: "Deliverable",
    suite: "Continues in",
    priority: "Priority sector",
    secondary: "On request",
    casLink: "See the detailed reference cases →",
  },
} as const;
