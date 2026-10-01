// vitrine-copy.ts — tout le texte du site vitrine, en français et en anglais.
//
// ── Pourquoi un fichier séparé ──────────────────────────────────────────────
// La vitrine vend une méthode : son texte EST le produit. Le sortir du JSX
// permet (1) de le relire comme on relit une note, sans le bruit du code,
// (2) de tenir deux langues sans dupliquer la mise en page, (3) de le faire
// évoluer sans risquer de casser le rendu.
//
// ── Registre d'écriture (contrainte tenue ligne par ligne) ──────────────────
// Une phrase = une idée vérifiable. Verbe actif, aucun mot de remplissage,
// aucune formule d'accroche générique. Trois interdits tenus dans ce fichier :
//   1. « espace » pour désigner Décider / Copilote / Architecturer — on dit
//      « application » : le visiteur achète des applications, pas des espaces.
//   2. « terrain » pour désigner un marché — on dit « secteur ».
//   3. le vocabulaire de laboratoire (δ⁺, δ⁻, lexicographique) dans les
//      sections destinées au décideur ; il reste dans le code du moteur.
// Aucun chiffre client, aucun logo, aucune récompense invérifiable.

export type Lang = "fr" | "en";

export interface Pair { t: string; d: string }
export interface Offer { n: string; who: string; what: string; to: string }
export interface Zoom { titre: string; questions: string[]; coince: string; apport: string }

export interface VitrineCopy {
  nav: { decouvrir: string; methode: string; produits: string; difference: string; enjeux: string; fondement: string; moteur: string; terrains: string; tarifs: string; auteur: string; open: string };
  hero: {
    eyebrow: string; h1a: string; h1b: string; lead: string;
    ctaA: string; ctaB: string; pillars: Pair[]; bannerAlt: string; bannerCaption: string;
  };
  methode: { eyebrow: string; h2: string; lead: string; letters: [string, string, string][]; parcoursLabel: string; parcours: Pair[] };
  produits: { eyebrow: string; h2: string; lead: string; items: Offer[]; explore: string };
  these: { eyebrow: string; h2: string; p1: string; p2: string; props: Pair[]; imgAlt: string; imgCaption: string };
  moteur: { eyebrow: string; axiomes: string; exemples: string; citation: string; claim: string };
  // Vocabulaire métier capté dans le Studio du copilote. Ce n'est pas un
  // référentiel d'entreprise : ce sont les objets métier réellement employés.
  onto: { eyebrow: string; h2: string; lead: string; items: Pair[]; conceptsLabel: string; conceptsNote: string; concepts: string[]; autoLabel: string; auto: Pair[] };
  enjeux: { eyebrow: string; h2: string; lead: string; connusLabel: string; connus: Pair[]; emergentsLabel: string; emergents: Pair[] };
  versus: {
    eyebrow: string; h2: string; lead: string;
    colA: string; colB: string; rows: { k: string; a: string; b: string }[];
    kicker: string; kickerBody: string;
  };
  archi: { eyebrow: string; h2: string; lead: string; items: Pair[]; imgAlt: string; imgCaption: string;
    cesamLabel: string; cesamH: string; cesamLead: string; cesam: Pair[]; cesamQuote: string; refsLabel: string };
  terrains: {
    eyebrow: string; h2: string; lead: string; zooms: Zoom[];
    qLabel: string; cLabel: string; aLabel: string;
    imgAlt: string; priority: string; secondary: string; casLink: string;
  };
  teaser: { eyebrow: string; h2: string; lead: string; label: string };
  auteur: { eyebrow: string; h2: string; name: string; role: string; p1: string; p2: string;
    awardEyebrow: string; awardTitle: string; awardBody: string; awardLink: string;
    theseLabel: string; theseTitle: string; theseMeta: string; theseLink: string;
    travauxLabel: string; travauxLead: string; encadrants: string };
  pricing: {
    eyebrow: string; h2: string; lead: string; trial: string; note: string; cta: string;
    plans: { n: string; price: string; year: string; who: string; items: string[] }[];
  };
  prestations: {
    eyebrow: string; h2: string; lead: string; chain: string; note: string; cta: string; dureeLabel: string; prixLabel: string;
    items: { n: string; sub: string; duree: string; prix: string; steps: string; items: string[] }[];
  };

  // Catégorie de marché : « decision intelligence ». Citations reprises mot
  // pour mot de sources publiées et attribuées ; aucune reformulation.
  di: {
    eyebrow: string; h2: string; lead: string;
    defLabel: string; def: string; defSource: string;
    quotes: { q: string; src: string; url: string }[];
    schemaLabel: string; schemaCaption: string;
    steps: { t: string; d: string }[];
    standLabel: string; stand: Pair[];
  };
  cloture: { h2: string; lead: string; cta: string };
  footer: { cas: string; plateforme: string };
}

const FR: VitrineCopy = {
  nav: { decouvrir: "Découvrir", methode: "Méthode", produits: "Applications", difference: "Parti pris", enjeux: "Enjeux", fondement: "Fondement", moteur: "Moteur", terrains: "Secteurs", tarifs: "Tarifs", auteur: "À propos", open: "Ouvrir la plateforme" },
  hero: {
    eyebrow: "Méthode d'aide à la décision, outillée",
    h1a: "Décider avec méthode.", h1b: "Exécuter avec un plan qui tient.",
    // S'adresse au dirigeant comme à l'ingénieur : la connaissance mise en
    // avant est celle de l'utilisateur et de ses équipes, pas celle d'experts
    // extérieurs. Et l'aide à la décision ne s'arrête pas au verdict : elle
    // est assortie d'un plan de mise en œuvre et de son suivi.
    lead: "AURA part de ce que vous savez — vous et vos équipes, de la direction générale à l'ingénierie. Avec vos données quand elles existent, sans les inventer quand elles manquent. Elle structure l'arbitrage, le tranche sur des règles que vous pouvez défendre, puis le prolonge en plan de mise en œuvre suivi dans le temps.",

    ctaA: "Analyser une décision", ctaB: "Voir le copilote décisionnel",
    pillars: [
      { t: "Un critère éliminatoire le reste", d: "Aucune moyenne pondérée : un bon score ne rachète jamais un défaut rédhibitoire." },
      { t: "Le même verdict deux fois", d: "Le raisonnement est reproductible. Six mois plus tard, la conclusion se rejoue à l'identique." },
      { t: "Le point de bascule est connu", d: "Vous voyez quel critère a tranché et ce qu'il faudrait changer pour inverser le classement." },
      { t: "De la décision au résultat", d: "Chaque arbitrage débouche sur un plan de mise en œuvre — cible, séquence, responsables — dont l'exécution est suivie. Vous savez, après coup, si la décision était la bonne." },
    ],
    bannerAlt: "Plusieurs directions face à un même classement d'options, chacune reliée à sa propre lecture",
    bannerCaption: "Commerce, finance, supply, RSE : quatre directions, quatre classements, une seule décision à signer. Aura montre où elles divergent, puis tranche sur des règles connues de tous.",
  },
  methode: {
    eyebrow: "La méthode", h2: "Augmented · Unified · Reasoning · Architecture",
    lead: "Quatre principes, dans cet ordre : l'IA instruit, un modèle unique relie tout, le raisonnement tranche, l'architecture exécute.",
    letters: [
      ["A", "Augmented", "L'IA générative mène l'entretien, reformule et rédige. Elle prépare la décision ; elle ne la prend pas."],
      ["U", "Unified", "Contexte métier, options, critères et architecture cible tiennent dans un seul modèle."],
      ["R", "Reasoning", "Un raisonnement qualitatif explicite remplace la note agrégée que personne ne sait justifier."],
      ["A", "Architecture", "Le choix se traduit en cible, en flux et en séquence de construction."],
    ],
    parcoursLabel: "Une séance, quatre temps",
    parcours: [
      { t: "Comprendre", d: "L'IA vous interroge, à la voix si vous préférez, et remplit le dossier à mesure." },
      { t: "Structurer", d: "Options et critères sont posés ; chaque direction les classe depuis son propre poste." },
      { t: "Raisonner", d: "Le moteur compare, nomme ce qui bloque un objectif et vérifie chaque piste avant de la retenir." },
      { t: "Décider", d: "Une page signable : l'option retenue, le critère décisif, les réserves, les participants, la date." },
    ],
  },
  produits: {
    eyebrow: "Les applications", h2: "Trois applications, un seul moteur",
    lead: "Une décision à trancher, un pilotage à instrumenter, une transformation à construire. Vous entrez par le besoin du moment.",
    explore: "Explorer →",
    items: [
      { n: "Décider", who: "COMEX, directions métier", what: "Vous modélisez une décision en cours, même sans donnée disponible : options, critères, échelles qualitatives, classements par direction. Sortie : la fiche signable et le point de bascule.", to: "/cockpit/atelier" },
      { n: "Copilote décisionnel", who: "Direction générale, CFO, COO", what: "Le copilote lit vos systèmes, suit la santé par domaine, signale ce qui dérive et prépare le dossier de la décision à prendre. En français ou en anglais, à la voix.", to: "/cockpit/copilote-decideur" },
      { n: "Architecturer", who: "DSI, architectes, direction de programme", what: "La décision devient un plan : cartographie cible, flux référencés, diagrammes de séquence, backlog par vagues et estimation amont.", to: "/cockpit/transformation" },
      { n: "Concevoir une offre", who: "Innovation, marketing, direction produit", what: "Le même moteur explore un espace d'offres : variantes, contraintes, arbitrages coût / valeur / faisabilité, jusqu'à la configuration défendable.", to: "/cockpit/atelier" },
    ],
  },
  these: {
    eyebrow: "Fondement scientifique", h2: "Pourquoi une note chiffrée trompe, et pas un classement",
    p1: "Convertir un avis d'expert en note, puis moyenner ces notes, fabrique une précision qui n'existait pas. Pire : la moyenne autorise un bon score à effacer un défaut rédhibitoire.",
    p2: "Aura part de l'inverse. Un avis d'expert est un classement, pas une quantité. Chaque option est décrite par deux choses qu'on ne mélange jamais : ce qu'elle apporte, et ce qu'elle coûte ou fait risquer. La comparaison se fait critère par critère, en commençant par le plus important.",
    props: [
      { t: "Pas de compensation cachée", d: "Un critère éliminatoire reste éliminatoire, quel que soit le reste du dossier." },
      { t: "Peu importe le nom des niveaux", d: "Renommer une échelle ne change pas le résultat : seul l'ordre compte." },
      { t: "Robustesse mesurée", d: "Vous savez de combien il faut déplacer l'importance d'un critère pour changer de vainqueur." },
      { t: "Opposable", d: "La conclusion se rejoue à l'identique, six mois plus tard, devant un auditeur." },
    ],
    imgAlt: "Vocabulaire métier capté alimentant un modèle de raisonnement",
    imgCaption: "Le vocabulaire métier de l'entreprise, capté puis figé pour la durée de l'arbitrage.",
  },
  moteur: {
    eyebrow: "Le moteur", axiomes: "Ce que le moteur garantit", exemples: "Exemples reproductibles", citation: "Citation",
    // Formulation destinée au décideur : aucune notation mathématique.
    claim: "BORA compare des options sans transformer les avis en notes. Chaque option est décrite par ce qu'elle apporte et par ce qu'elle coûte ou fait risquer — deux choses jamais soustraites l'une de l'autre. Les options sont ensuite départagées critère par critère, en commençant par le plus important. Jamais par moyenne pondérée.",
  },
  onto: {
    eyebrow: "Copilote décisionnel · Studio", h2: "Le vocabulaire métier de l'entreprise, capté puis tenu à jour",
    // Le vocabulaire capté ne se limite pas aux grandeurs suivies : il porte
    // les objets métier et l'ensemble de leurs données — attributs, états,
    // référentiels, relations. Ne pas réduire ce texte à des « indicateurs ».
    lead: "Dans le Studio, le copilote écoute les entretiens, lit vos documents et parcourt les systèmes branchés. Il en tire les objets métier réellement employés chez vous et leurs données — attributs, états, référentiels, relations, et les grandeurs que vous suivez. Pas un référentiel d'entreprise, pas un méta-modèle à remplir. Ce vocabulaire cadre ensuite tous les arbitrages : ce qui n'y figure pas ne peut pas apparaître dans une conclusion.",
    conceptsLabel: "Ce que le copilote capte",
    conceptsNote: "Exemples d'objets métier et de leurs données : les vôtres portent vos propres noms.",
    concepts: ["Décision", "Option", "Critère", "Échelle", "Impact", "Capacité", "Flux", "Acteur"],
    autoLabel: "Capté, ajustable, vivant",
    auto: [
      { t: "Capté, pas modélisé", d: "Le copilote propose les termes que vos équipes emploient déjà, avec leur définition et leurs niveaux." },
      { t: "Ajustable à tout moment", d: "Renommer, fusionner, retirer, ajouter un niveau. Le vocabulaire appartient au métier." },
      { t: "Vivant", d: "Chaque décision actée le précise. Le trimestre suivant repart de ce qui a déjà été validé." },
      { t: "Un vocabulaire, trois usages", d: "Le même vocabulaire alimente l'arbitrage, l'architecture cible et la surveillance du copilote." },
    ],
    items: [
      { t: "Volontairement restreint", d: "Assez pour cadrer un raisonnement, assez peu pour être tenu à jour sans équipe de modélisation." },
      { t: "L'IA instruit, elle ne conclut pas", d: "Elle interroge, reformule, propose des critères candidats, rédige. Un humain valide chaque ajout." },
      // Aura ne décide jamais à la place de l'utilisateur : le moteur calcule et
      // classe, la signature reste humaine. Formulation à ne pas affaiblir.
      { t: "Un calcul reproductible, une décision qui reste la vôtre", d: "Le classement est calculé par un moteur déterministe, hors de l'IA générative : deux exécutions donnent le même résultat. Aura instruit et ordonne ; vous tranchez et vous signez." },
      { t: "Rien d'inventé", d: "Aucun chiffre fabriqué, aucune source fantôme : la conclusion ne sort pas du vocabulaire validé." },
    ],
  },

  enjeux: {
    eyebrow: "Les décisions du moment", h2: "Les arbitrages sur lesquels les comités butent",
    lead: "Complexes, récurrents, mal outillés. Certains sont nommés ouvertement ; d'autres bloquent les comités sans jamais être formulés.",
    connusLabel: "Nommés ouvertement",
    connus: [
      { t: "Où l'IA paie réellement", d: "Quels processus outiller d'abord, lesquels laisser, et ce qui reste un jugement humain." },
      { t: "Décarbonation et mix énergétique", d: "Électrification, renouvellement de patrimoine, conversion de flottes : des engagements irréversibles sans chiffres fiables avant des années." },
      { t: "Legacy ou reconstruction", d: "Garder, encapsuler ou remplacer — avec des contraintes réglementaires, de compétences et de continuité qu'aucun ROI ne tranche." },
      { t: "Réduire les coûts sans perdre de capacité", d: "Où couper sans casser les capacités qui portent la croissance de l'année suivante." },
    ],
    emergentsLabel: "Rarement formulés, déjà bloquants",
    emergents: [
      { t: "Quelles décisions déléguer à un agent", d: "Tracer la frontière entre ce qu'un agent IA peut préparer, proposer, ou ne jamais trancher." },
      { t: "Souveraineté et dépendance", d: "Choisir hébergement, modèles et fournisseurs quand le critère est l'exposition, pas le prix." },
      { t: "Arbitrer entre directions en désaccord", d: "Commerce, finance, supply et RSE n'ordonnent pas les mêmes critères. Le désaccord est la décision." },
      { t: "Décider avant que la donnée existe", d: "Nouvelle offre, nouveau marché, nouvelle réglementation : le jugement est la seule matière disponible." },
    ],
  },
  // ── Aura face aux IA généralistes ─────────────────────────────────────────
  // Le lecteur a déjà tenté de faire trancher une décision par ChatGPT. On ne
  // raille pas ces modèles — Aura s'en sert pour instruire. On nomme ce qu'ils
  // ne peuvent pas garantir : la même conclusion deux fois, l'absence de
  // compensation, la traçabilité du point de bascule.
  versus: {
    eyebrow: "Parti pris",
    h2: "Une IA générative généraliste rédige un avis. Aura prépare une décision défendable — que vous signez.",
    lead: "Posez deux fois le même arbitrage à une IA générative généraliste — ChatGPT, Claude, Gemini : deux réponses, également convaincantes. Acceptable pour une note ; pas pour un investissement que vous signez. Aura garde ces modèles là où ils excellent — écouter, reformuler, rédiger — et leur retire le classement.",
    colA: "IA générative généraliste",
    colB: "Aura",
    rows: [
      // « Qui tranche » proscrit : dans Aura, c'est toujours l'utilisateur.
      { k: "D'où vient la conclusion", a: "Du modèle de langage lui-même. Elle change avec la formulation de la question.", b: "D'un moteur qualitatif déterministe, hors de l'IA générative. Deux exécutions, même classement ; la signature reste humaine." },
      { k: "Critères", a: "Tout se compense : un argument fort noie un défaut rédhibitoire.", b: "Un critère éliminatoire reste éliminatoire." },
      { k: "Traçabilité", a: "Un raisonnement plausible, non rejouable.", b: "Le critère décisif, la concession assumée, le point de bascule." },
      { k: "Désaccords", a: "Une synthèse moyenne qui ne représente aucune direction.", b: "Chaque direction classe depuis son poste ; l'écart est cartographié, puis arbitré." },
      { k: "Données manquantes", a: "Comble les trous avec des chiffres vraisemblables.", b: "Ne comble rien : hors du vocabulaire validé, rien n'entre dans la conclusion." },
      { k: "Après la décision", a: "Le fil s'arrête là.", b: "Cible, flux, séquence, backlog et estimation amont." },
    ],
    kicker: "En une phrase",
    kickerBody: "Aura ne remplace pas votre IA générative : elle lui donne une colonne vertébrale. L'IA générative fait parler la décision, le moteur la rend défendable — et c'est vous qui la tranchez.",
  },
  archi: {
    eyebrow: "Architecturer", h2: "De la décision au plan de construction",
    lead: "Une transformation échoue rarement sur une brique : elle échoue sur les interactions. Aura modélise les dépendances et les effets de bord avant les composants — et s'appuie sur des cadres reconnus plutôt que sur une méthode maison.",
    items: [
      { t: "Référence : CESAM", d: "Trois lectures d'un même système — opérationnelle, fonctionnelle, technique — chacune qualifiée par la précédente. C'est leur cohérence, pas la finition des livrables, qui fait la valeur de l'exercice." },
      { t: "Référence : TOGAF", d: "Séparation métier / données / applicatif / technique et logique de trajectoire : existant, cible, séquence. Aura en garde la rigueur, pas la lourdeur documentaire." },
      { t: "Référence : C4", d: "Une même réalité lue à plusieurs niveaux de zoom. Aura s'arrête volontairement au niveau conteneur." },
      { t: "Le lien avec la décision", d: "Chaque option arbitrée se projette en cible, en flux et en vagues de construction. Décision et exécution partagent le même modèle." },
      { t: "Vibe Architecting", d: "Vous décrivez l'intention en langage naturel ; l'IA générative produit la cartographie cible, les flux référencés, le diagramme de séquence, le backlog par vagues et l'estimation amont. Rien n'entre dans le dossier sans validation humaine." },
    ],
    imgAlt: "Cartographie applicative cible et flux entre systèmes",
    imgCaption: "Cible et flux : sur le diagramme de séquence, la barre d'activation marque la fonctionnalité de niveau 4 — nommée à côté d'elle — et les flèches portent les flux référencés.",
    cesamLabel: "Cadres méthodologiques · CESAM & TOGAF",
    cesamH: "Besoins, exigences, vues : la discipline avant la cartographie",
    cesamLead: "CESAM (CESAMES Systems Architecting Method, D. Krob) apporte la discipline du besoin et des trois vues croisées ; TOGAF (The Open Group) la structure des domaines et la trajectoire. Le cadrage entre par les besoins des parties prenantes, jamais par l'inventaire applicatif.",
    cesam: [
      { t: "Aucun besoin sans porteur nommé", d: "Un besoin sans porteur ne survit pas à la première revue. Aura exige la partie prenante avant l'exigence." },
      { t: "Aucune exigence orpheline", d: "Chaque exigence est tracée vers le besoin qu'elle traduit, et reste vérifiable." },
      { t: "Trois vues, croisées volontairement", d: "La vue technique ne se dessine qu'une fois la fonctionnelle stabilisée, elle-même qualifiée par l'opérationnelle." },
      { t: "Domaines et trajectoire", d: "Métier, données, applicatif, technique — puis existant, cible, séquence." },
    ],
    cesamQuote: "Une exigence sans besoin d'origine ne se justifie pas.",
    refsLabel: "Références",

  },
  terrains: {
    eyebrow: "Secteurs", h2: "Deux secteurs où la même décision revient chaque année",
    lead: "Complexe, récurrent, massif : les trois conditions d'un usage régulier. Aura se concentre d'abord sur le Retail et sur l'Énergie & Utilities.",
    qLabel: "Les questions qui reviennent", cLabel: "Ce qui coince", aLabel: "Ce qu'Aura produit",
    imgAlt: "Assortiment de distribution et infrastructures énergétiques reliés par une trajectoire de décision",
    priority: "Prioritaire", secondary: "Secondaire",
    casLink: "Voir les cas, avec l'existant, la cible et la trajectoire →",
    zooms: [
      {
        titre: "Retail & distribution",
        questions: [
          "Quelles références garder, arrêter, tester — catégorie par catégorie, chaque saison ?",
          "Marque propre ou marque nationale, sur quel linéaire et à quel risque de rupture ?",
          "Quels magasins rénover en premier, avec un budget qui ne couvre pas le parc ?",
          "Quel schéma logistique tient si un entrepôt sature ou si un fournisseur décroche ?",
        ],
        coince: "Le commerce, la supply, la finance et la RSE n'ont pas les mêmes priorités, et l'historique de ventes ne dit rien des références qui n'existent pas encore.",
        apport: "Un vocabulaire de critères stable d'une saison à l'autre, la carte des désaccords entre directions, et la fiche signable qui documente ce qui a été concédé.",
      },
      {
        titre: "Énergie & Utilities",
        questions: [
          "Quels actifs de production renouveler, prolonger ou arrêter, sur quinze ans ?",
          "Quel mix et quelles filières engager, alors que le cadre réglementaire bougera ?",
          "Quelles infrastructures de recharge et quels moyens de transport, pour quel usage réel ?",
          "Quels raccordements et quelle flexibilité réseau prioriser face à une file d'attente ?",
        ],
        coince: "La donnée probante n'existera qu'après l'engagement capitalistique. Le modèle chiffré fabrique une précision fausse et masque les critères rédhibitoires : sûreté, acceptabilité, disponibilité des compétences.",
        apport: "Un arbitrage tenu sur des niveaux qualitatifs, la robustesse mesurée, et la trajectoire d'architecture qui découle de la décision.",
      },
    ],
  },
  teaser: {
    eyebrow: "Découvrir", h2: "Aura en moins d'une minute",
    lead: "Deux cas concrets — décarbonation d'un réseau gazier, investissement de résilience supply chain — filmés dans la plateforme : leviers composés, arbitrage tranché, fiche signable, puis architecture, backlog et dialogue avec le copilote.",
    label: "Vidéo de découverte Aura",
  },

  auteur: {
    eyebrow: "À propos", h2: "La méthode a un auteur",
    name: "Dr Mambaye Lo", role: "Architecture d'entreprise · Aide à la décision · IA appliquée",
    p1: "AURA vient d'un travail de recherche sur l'agrégation de jugements qualitatifs et de plusieurs années de cadrage de transformations complexes. Le constat est le même des deux côtés : les décisions structurantes se prennent sans données fiables, puis se justifient après coup par des chiffres fabriqués. La méthode répond à ce point précis.",
    p2: "La plateforme met cette méthode à disposition : un consultant l'utilise en séance, une direction l'internalise. Les deux modes sont assumés.",
    awardEyebrow: "Distinction",
    awardTitle: "Prix de la meilleure thèse en Ingénierie Système en France, 2013-2014",
    awardBody: "Décerné par l'AFIS — chapitre français de l'INCOSE — remis le 12 décembre 2014.",
    awardLink: "Attestation (PDF)",
    theseLabel: "La thèse",
    theseTitle: "Contribution à l'évaluation d'architectures en Ingénierie Système : application à la conception de systèmes mécatroniques",
    theseMeta: "IMT Mines Alès · LGI2P · soutenue le 19 novembre 2013",
    theseLink: "Lire le manuscrit",
    travauxLabel: "Travaux fondateurs",
    travauxLead: "Le raisonnement ordinal d'Aura prolonge ces publications.",
    encadrants: "Thèse encadrée par Pierre Couturier, avec Abdelhak Imoussaten et Vincent Chapurlat (IMT Mines Alès).",
  },
  pricing: {
    eyebrow: "Tarifs", h2: "Vous payez par utilisateur, vous commencez par une application",
    lead: "Tarification au niveau du marché des outils de décision. On entre par l'application qui porte la douleur du moment, on étend ensuite.",
    trial: "Essai gratuit, sans carte bancaire. À son terme, l'accès se ferme — vos modèles et votre vocabulaire de critères restent conservés.",
    note: "Prix hors taxes, par utilisateur nommé. Mensuel sans engagement, ou annuel avec deux mois offerts. Aucun coût à l'usage caché : la consommation d'IA est visible dans la plateforme.",
    cta: "Commencer l'essai",
    plans: [
      { n: "Décider", price: "39 € / utilisateur / mois", year: "ou 390 € / an — 2 mois offerts", who: "Direction générale, direction de la transformation",
        items: ["Comprendre → Impacter → Composer → Arbitrer → Suivi", "Moteur BORA : dominance, robustesse, carte des désaccords", "Fiche de décision d'une page, signable", "À partir de 3 utilisateurs"] },
      { n: "Architecturer", price: "79 € / utilisateur / mois", year: "ou 790 € / an — 2 mois offerts", who: "DSI, architecture d'entreprise, PMO de transformation",
        items: ["Cadrage, capacités, cible & flux, backlog, suivi", "Agent d'architecture : points de passage, couplages, chemin critique", "Dossier d'architecture et backlog exportables", "Décider inclus pour les mêmes utilisateurs"] },
      { n: "Plateforme", price: "Sur devis", year: "à partir de 9 900 € / an", who: "Groupe, COMEX, cabinet de conseil",
        items: ["Décider + Architecturer + Copilote décisionnel", "Connecteurs aux systèmes sources et vocabulaire d'entreprise", "Modèles sectoriels Retail et Énergie & Utilities", "Utilisateurs illimités, accompagnement sur la méthode"] },
    ],
  },
  di: {
    eyebrow: "Catégorie de marché",
    h2: "Decision intelligence : la catégorie, et notre place dedans",
    lead: "Les analystes ont nommé ce marché. Il ne s'agit plus de stocker ni d'analyser la donnée, mais d'expliciter comment une décision est prise, puis de mesurer ce qu'elle a produit. Aura se situe exactement là, avec un choix de méthode assumé : le raisonnement est qualitatif et non compensatoire.",
    defLabel: "Définition de référence",
    def: "Decision intelligence platforms (DIPs) are software to create decision-centric solutions that support, augment and automate decision making of humans or machines, powered by the composition of data, analytics, knowledge and AI.",
    defSource: "Gartner, Decision Intelligence Platforms — Gartner Peer Insights (définition de marché)",
    quotes: [
      { q: "By 2027, 25% of ungoverned decisions using large language models (LLMs) will cause financial or reputational loss due to human biases, insufficient critical thinking, and AI sycophancy.",
        src: "Gartner, Magic Quadrant for Decision Intelligence Platforms, 2026 — hypothèse de planification stratégique",
        url: "https://www.gartner.com/reviews/market/decision-intelligence-platforms" },
      { q: "By 2028, 25% of CDAO vision statements will become “decision-centric,” surpassing “data driven” slogans, with human decision-making behaviors explicitly addressed.",
        src: "Gartner, Magic Quadrant for Decision Intelligence Platforms, 2026 — hypothèse de planification stratégique",
        url: "https://www.gartner.com/reviews/market/decision-intelligence-platforms" },
      { q: "Decision intelligence is a practical discipline used to improve decision making by explicitly understanding and engineering how decisions are made, and how outcomes are evaluated, managed and improved by feedback.",
        src: "Gartner IT Glossary, « Decision Intelligence »",
        url: "https://www.gartner.com/en/information-technology/glossary/decision-intelligence" },
    ],
    schemaLabel: "Le cycle décisionnel outillé",
    schemaCaption: "La discipline exige la boucle entière. Aura la tient de bout en bout : la décision est modélisée, tranchée sur une règle explicite, traduite en plan, puis confrontée au constaté dans le registre de suivi.",
    steps: [
      { t: "Cadrer", d: "La question, les options, les critères et les seuils éliminatoires sont écrits avant tout calcul." },
      { t: "Instruire", d: "Faits disponibles, avis des directions, appréciations qualitatives quand la donnée manque." },
      { t: "Trancher", d: "Une règle publiée, reproductible, qui désigne le critère décisif et le point de bascule." },
      { t: "Exécuter", d: "Cible, séquence, responsables : la décision devient un plan opposable." },
      { t: "Constater", d: "Prévu contre constaté, preuves rattachées, réserves levées ou non." },
      { t: "Réviser", d: "Le constat rouvre le cadrage : la règle et le vocabulaire de critères s'améliorent." },
    ],
    standLabel: "Ce que nous faisons autrement",
    stand: [
      { t: "Pas de score composite", d: "La plupart des plateformes agrègent en une note. Nous classons : un critère éliminatoire reste éliminatoire." },
      { t: "L'IA instruit, elle ne tranche pas", d: "L'IA générative mène l'entretien et rédige ; la décision reste au comité, ce qui répond directement au risque de décision non gouvernée." },
      { t: "Décider sans données complètes", d: "La discipline suppose souvent des données prêtes. Nous démarrons sur des appréciations ordinales, et nous les remplaçons par des faits dès qu'ils existent." },
      { t: "La boucle est dans le produit", d: "Le suivi des combinaisons signées, avec preuves et avis des parties prenantes, ferme la boucle exigée par la définition." },
    ],
  },
  cloture: {
    h2: "Un arbitrage réel, sur vos critères.",
    lead: "Une séance suffit à modéliser une décision en cours et à produire la fiche signable. Le vocabulaire de critères vous reste.",
    cta: "Ouvrir la plateforme",
  },

  prestations: {
    eyebrow: "Prestations", h2: "La plateforme, opérée par un consultant Aura",
    lead: "Pour les décisions que vous ne pouvez pas vous permettre de rater. Trois formats chaînables : une décision débouche sur un design, le design sur une transformation.",
    chain: "Décider → Concevoir → Transformer", dureeLabel: "Durée", prixLabel: "Prix",
    items: [
      { n: "AURA Decision Sprint", sub: "Arbitrer une décision à forts enjeux", duree: "1–2 semaines", prix: "8–14 k€ HT",
        steps: "Cadrage → Entretiens → Modélisation → Impacts → Scénarios → Arbitrage → Restitution",
        items: ["Decision Brief exécutif", "Modèle décisionnel documenté", "Scénarios comparés, forces et faiblesses", "Risques critiques et hypothèses", "Informations manquantes pour trancher", "Conditions qui basculeraient la recommandation"] },
      { n: "AURA Engineering Decision Sprint", sub: "Choisir le concept avant de figer le produit ou le système", duree: "2–4 semaines", prix: "14–26 k€ HT",
        steps: "Besoins → Exigences → Alternatives → Impacts → Arbitrage → Concept retenu",
        items: ["Architecture ou concept recommandé", "Exigences critiques", "Risques résiduels et mitigation", "Hypothèses à valider", "Plan de validation et de transition"] },
      { n: "AURA Transformation Architecture", sub: "D'une transformation floue à une cible argumentée et une trajectoire", duree: "6–8 semaines", prix: "35–70 k€ HT · multi-domaines 60–110 k€",
        steps: "Observer → Délimiter → Comprendre → Exiger → Concevoir → Arbitrer → Transformer",
        items: ["Diagnostic factuel du SI et des flux", "2 à 4 architectures cibles crédibles", "Arbitrage comparatif avec Aura", "Décisions structurantes tracées", "Roadmap et OKR", "Estimation de coût amont"] },
    ],
    note: "Consultants décisionnels senior, accès à la plateforme pendant la mission, livrables documentés. Un tiers sous le prix d'un cabinet généraliste à durée égale : l'outil fait le travail que d'autres facturent en jours-homme. Modèle forward-deployed : ce qui est appris sur une mission devient un actif réutilisable dans la plateforme, pas un rapport qui reste sur l'étagère.",
    cta: "Présenter votre cas",
  },
  footer: { cas: "Cas de référence", plateforme: "Plateforme" },

};

const EN: VitrineCopy = {
  nav: { decouvrir: "Discover", methode: "Method", produits: "Applications", difference: "Our stance", enjeux: "Challenges", fondement: "Foundations", moteur: "Engine", terrains: "Sectors", tarifs: "Pricing", auteur: "About", open: "Open the platform" },
  hero: {
    eyebrow: "A decision method, with the tooling that carries it",
    h1a: "Decide with method.", h1b: "Execute on a plan that holds.",
    lead: "AURA starts from what you know — you and your teams, from the executive committee to engineering. With your data where it exists, without inventing it where it does not. It structures the trade-off, settles it on rules you can defend, then extends it into an implementation plan tracked over time.",

    ctaA: "Analyse a decision", ctaB: "See the decision copilot",
    pillars: [
      { t: "A knock-out criterion stays one", d: "No weighted average: a strong score never buys off a deal-breaker." },
      { t: "The same verdict twice", d: "The reasoning is reproducible. Six months later the conclusion replays identically." },
      { t: "The tipping point is known", d: "You see which criterion decided, and what would have to change to flip the ranking." },
      { t: "From decision to outcome", d: "Every trade-off ends in an implementation plan — target, sequence, owners — whose execution is tracked. Afterwards, you know whether the decision was the right one." },
    ],
    bannerAlt: "Several functions facing one ranking of options, each connected to their own reading",
    bannerCaption: "Commercial, finance, supply, sustainability: four functions, four rankings, one decision to sign. Aura shows where they diverge, then settles it on rules everyone can see.",
  },
  methode: {
    eyebrow: "The method", h2: "Augmented · Unified · Reasoning · Architecture",
    lead: "Four principles, in this order: AI gathers, one model links everything, reasoning decides, architecture delivers.",
    letters: [
      ["A", "Augmented", "Generative AI runs the interview, restates and drafts. It prepares the decision; it does not take it."],
      ["U", "Unified", "Business context, options, criteria and target architecture live in a single model."],
      ["R", "Reasoning", "Explicit qualitative reasoning replaces the aggregate score no one can justify."],
      ["A", "Architecture", "The choice becomes a target state, flows and a build sequence."],
    ],
    parcoursLabel: "One session, four steps",
    parcours: [
      { t: "Understand", d: "AI questions you, by voice if you prefer, and fills the file as you speak." },
      { t: "Structure", d: "Options and criteria are set; each function ranks them from its own seat." },
      { t: "Reason", d: "The engine compares, names what blocks a goal, and verifies each path before it is kept." },
      { t: "Decide", d: "One signable page: option retained, decisive criterion, reservations, participants, date." },
    ],
  },
  produits: {
    eyebrow: "The applications", h2: "Three applications, one engine",
    lead: "A decision to settle, a business to steer, a transformation to build. You enter through today's need.",
    explore: "Explore →",
    items: [
      { n: "Decide", who: "Executive committee, business units", what: "Model a live decision, even with no data available: options, criteria, qualitative scales, rankings per function. Output: the signable record and the tipping point.", to: "/cockpit/atelier" },
      { n: "Decision copilot", who: "Executives, CFO, COO", what: "The copilot reads your systems, tracks health by domain, flags what is drifting and prepares the file for the decision ahead. In French or English, by voice.", to: "/cockpit/copilote-decideur" },
      { n: "Architect", who: "CIO, architects, programme leadership", what: "The decision becomes a plan: target map, referenced flows, sequence diagrams, waved backlog and upfront estimate.", to: "/cockpit/transformation" },
      { n: "Design an offer", who: "Innovation, marketing, product leadership", what: "The same engine explores an offer space: variants, constraints, cost / value / feasibility trade-offs, through to a defensible configuration.", to: "/cockpit/atelier" },
    ],
  },
  these: {
    eyebrow: "Scientific foundation", h2: "Why a score misleads, and a ranking does not",
    p1: "Turning expert opinion into numbers and averaging them manufactures precision that never existed. Worse: the average lets a good score erase a fatal flaw.",
    p2: "Aura starts from the opposite premise. An expert opinion is a ranking, not a quantity. Each option is described by two things that are never mixed: what it brings, and what it costs or puts at risk. Options are then compared criterion by criterion, starting with the most important.",
    props: [
      { t: "No hidden compensation", d: "A disqualifying criterion stays disqualifying, whatever the rest of the file says." },
      { t: "Level names do not matter", d: "Renaming a scale does not change the outcome: only the order counts." },
      { t: "Measured robustness", d: "You know how far a criterion's importance must move before the winner changes." },
      { t: "Defensible", d: "The conclusion replays identically, six months later, in front of an auditor." },
    ],
    imgAlt: "Captured business vocabulary feeding a reasoning model",
    imgCaption: "The company's own business vocabulary, captured and then frozen for the duration of the trade-off.",
  },
  moteur: {
    eyebrow: "The engine", axiomes: "What the engine guarantees", exemples: "Reproducible examples", citation: "Citation",
    claim: "BORA compares options without turning opinions into scores. Each option is described by what it brings and by what it costs or puts at risk — two things never subtracted from one another. Options are then separated criterion by criterion, starting with the most important. Never by weighted average.",
  },
  onto: {
    eyebrow: "Decision copilot · Studio", h2: "Your business vocabulary, captured and kept current",
    lead: "In the Studio the copilot listens to interviews, reads your documents and walks through the connected systems. It extracts the business objects actually used in your company and their data — attributes, states, reference lists, relationships, and the quantities you track. Not a corporate repository, not a meta-model to fill in. That vocabulary then bounds every trade-off: what is not in it cannot appear in a conclusion.",
    conceptsLabel: "What the copilot captures",
    conceptsNote: "Examples of business objects and their data: yours carry your own names.",
    concepts: ["Decision", "Option", "Criterion", "Scale", "Impact", "Capability", "Flow", "Actor"],
    autoLabel: "Captured, adjustable, living",
    auto: [
      { t: "Captured, not modelled", d: "The copilot proposes the terms your teams already use, with their definitions and levels." },
      { t: "Adjustable at any time", d: "Rename, merge, remove, add a level. The business owns the vocabulary." },
      { t: "Living", d: "Each decision taken refines it. Next quarter starts from what has already been agreed." },
      { t: "One vocabulary, three uses", d: "The same vocabulary feeds arbitration, the target architecture and the copilot's watch." },
    ],
    items: [
      { t: "Deliberately narrow", d: "Enough to bound a line of reasoning, few enough to keep current without a modelling team." },
      { t: "AI gathers, it does not conclude", d: "It questions, restates, proposes candidate criteria, drafts. A person validates every addition." },
      { t: "A reproducible computation, a decision that stays yours", d: "The ranking is computed by a deterministic engine, outside generative AI: two runs give the same result. Aura informs and ranks; you decide and you sign." },
      { t: "Nothing invented", d: "No manufactured figure, no phantom source: conclusions never leave the validated vocabulary." },
    ],
  },

  enjeux: {
    eyebrow: "Decisions on the table now", h2: "The trade-offs boards are struggling with",
    lead: "Complex, recurring, poorly instrumented. Some are named openly; others block committees without ever being formulated.",
    connusLabel: "Named openly",
    connus: [
      { t: "Where AI actually pays off", d: "Which processes to equip first, which ones to leave alone, and what stays a human judgement call." },
      { t: "Decarbonisation and energy mix", d: "Electrification, asset renewal, fleet conversion: irreversible commitments with no reliable figures for years." },
      { t: "Legacy versus rebuild", d: "Keep, wrap, or replace — with regulatory, skills and continuity constraints that no ROI model settles." },
      { t: "Cost cuts without losing capability", d: "Where to cut without breaking the capabilities that carry next year's growth." },
    ],
    emergentsLabel: "Rarely formulated, already blocking",
    emergents: [
      { t: "Which decisions to delegate to an agent", d: "Drawing the line between what an AI agent may prepare, propose, or never settle." },
      { t: "Sovereignty and dependency", d: "Choosing hosting, models and vendors when the criterion is exposure, not price." },
      { t: "Arbitrating between functions in disagreement", d: "Commerce, finance, supply and ESG rank criteria differently. The disagreement is the decision." },
      { t: "Deciding before the data exists", d: "New offer, new market, new regulation: judgement is the only material available." },
    ],
  },
  versus: {
    eyebrow: "Our stance",
    h2: "A general-purpose generative AI writes an opinion. Aura prepares a defensible decision — which you sign.",
    lead: "Ask a general-purpose generative AI — ChatGPT, Claude, Gemini — the same trade-off twice and you get two answers, both persuasive. Fine for a memo; not for an investment you sign. Aura keeps those models where they excel — listening, rephrasing, drafting — and takes the ranking out of their hands.",
    colA: "General-purpose generative AI",
    colB: "Aura",
    rows: [
      { k: "Where the conclusion comes from", a: "From the language model itself. It shifts with the wording of the prompt.", b: "From a deterministic qualitative engine, outside generative AI. Two runs, one ranking; the signature stays human." },
      { k: "Criteria", a: "Everything compensates: one strong argument drowns a deal-breaker.", b: "A knock-out criterion stays a knock-out." },
      { k: "Traceability", a: "A plausible narrative, not replayable.", b: "The decisive criterion, the concession accepted, the tipping point." },
      { k: "Disagreement", a: "An average synthesis that represents no function in particular.", b: "Each function ranks from its own seat; the gap is mapped, then arbitrated." },
      { k: "Missing data", a: "Fills the gaps with plausible figures.", b: "Fills nothing: outside the validated vocabulary, nothing enters the conclusion." },
      { k: "After the decision", a: "The thread ends there.", b: "Target state, flows, sequence, backlog and upfront estimate." },
    ],
    kicker: "In one sentence",
    kickerBody: "Aura does not replace your generative AI: it gives it a backbone. Generative AI makes the decision speak, the engine makes it defensible — and you are the one who settles it.",
  },
  archi: {
    eyebrow: "Architect", h2: "From the decision to the build plan",
    lead: "A complex transformation rarely fails on one building block: it fails on the interactions. Aura models dependencies and side effects before components — and leans on recognised frameworks rather than an in-house method.",
    items: [
      { t: "Reference: CESAM", d: "Three readings of one system — operational, functional, technical — each qualified by the previous one. Their consistency, not the polish of each deliverable, is what makes the exercise worth anything." },
      { t: "Reference: TOGAF", d: "Business / data / application / technology separation and trajectory logic: as-is, target, sequence. Aura keeps the rigour, not the documentary weight." },
      { t: "Reference: C4", d: "One reality read at several zoom levels. Aura deliberately stops at container level." },
      { t: "The link to the decision", d: "Every option arbitrated projects into a target state, flows and build waves. Decision and execution share one model." },
      { t: "Vibe Architecting", d: "You describe the intent in plain language; generative AI produces the target map, the referenced flows, the sequence diagram, the waved backlog and the upfront estimate. Nothing enters the file without human validation." },
    ],
    imgAlt: "Target application map and flows between systems",
    imgCaption: "Target and flows: on the sequence diagram, each activation bar marks a level-4 functionality — named beside it — and the arrows carry the referenced flows.",

    cesamLabel: "Methodological frameworks · CESAM & TOGAF",
    cesamH: "Needs, requirements, views: the discipline before the mapping",
    cesamLead: "CESAM (CESAMES Systems Architecting Method, D. Krob) provides the discipline of needs and three crossed views; TOGAF (The Open Group) the architecture domains and the trajectory. Framing enters through stakeholder needs, never through the application inventory.",
    cesam: [
      { t: "No need without a named owner", d: "A need with no owner never survives its first review. Aura demands the stakeholder before the requirement." },
      { t: "No orphan requirement", d: "Every requirement is traced to the need it translates, and stays verifiable." },
      { t: "Three views, crossed on purpose", d: "The technical view is only drawn once the functional view is stable, itself qualified by the operational one." },
      { t: "Domains and trajectory", d: "Business, data, application, technology — then as-is, target, sequence." },
    ],
    cesamQuote: "A requirement with no originating need cannot be justified.",
    refsLabel: "References",

  },
  terrains: {
    eyebrow: "Sectors", h2: "Two sectors where the same decision returns every year",
    lead: "Complex, recurring, large-scale: the three conditions for regular use. Aura focuses first on Retail and on Energy & Utilities.",
    qLabel: "The questions that keep coming back", cLabel: "Where it stalls", aLabel: "What Aura produces",
    imgAlt: "Retail assortment and energy infrastructure linked by a decision trajectory",
    priority: "Priority", secondary: "Secondary",
    casLink: "See the cases, with as-is, target and trajectory →",
    zooms: [
      {
        titre: "Retail & distribution",
        questions: [
          "Which lines to keep, drop or trial — category by category, every season?",
          "Own label or national brand, on which shelf space, at what risk of stock-out?",
          "Which stores to refit first, on a budget that does not cover the estate?",
          "Which logistics scheme holds if a warehouse saturates or a supplier drops out?",
        ],
        coince: "Commercial, supply, finance and sustainability do not share the same priorities, and sales history says nothing about lines that do not exist yet.",
        apport: "A criteria vocabulary stable from season to season, the map of disagreement between functions, and the signable record of what was conceded.",
      },
      {
        titre: "Energy & Utilities",
        questions: [
          "Which generation assets to renew, extend or retire, over fifteen years?",
          "Which mix and which technologies to commit to, while the regulatory frame keeps moving?",
          "Which charging infrastructure and which transport modes, for which real usage?",
          "Which grid connections and which flexibility to prioritise against a queue?",
        ],
        coince: "Conclusive data will only exist after the capital commitment. A numeric model manufactures precision and hides the disqualifying criteria: safety, public acceptance, availability of skills.",
        apport: "A trade-off held on qualitative levels, measured robustness, and the architecture trajectory that follows from the decision.",
      },
    ],
  },
  teaser: {
    eyebrow: "Discover", h2: "Aura in under a minute",
    lead: "Two concrete cases — decarbonising a gas network, a supply-chain resilience investment — filmed inside the platform: levers composed, the trade-off settled, the signable record, then architecture, backlog and the copilot dialogue.",
    label: "Aura discovery video",
  },

  auteur: {
    eyebrow: "About", h2: "The method has an author",
    name: "Dr Mambaye Lo", role: "Enterprise architecture · Decision support · Applied AI",
    p1: "AURA grew out of research on the aggregation of qualitative judgements and several years spent framing complex corporate transformations. The finding is the same on both sides: structural decisions are taken without reliable data, then justified after the fact with manufactured figures. The method answers exactly that.",
    p2: "The platform makes that method available: a consultant runs a session with it, a corporate function brings it in-house. Both modes are intended.",
    awardEyebrow: "Distinction",
    awardTitle: "Best PhD work in Systems Engineering in France, 2013-2014",
    awardBody: "Awarded by AFIS — the French chapter of INCOSE — presented on 12 December 2014.",
    awardLink: "Attestation (PDF)",
    theseLabel: "The thesis",
    theseTitle: "Contribution to architecture evaluation in Systems Engineering: application to mechatronic system design",
    theseMeta: "IMT Mines Alès · LGI2P · defended 19 November 2013",
    theseLink: "Read the manuscript",
    travauxLabel: "Founding work",
    travauxLead: "Aura's ordinal reasoning extends these publications.",
    encadrants: "Thesis supervised by Pierre Couturier, with Abdelhak Imoussaten and Vincent Chapurlat (IMT Mines Alès).",
  },
  pricing: {
    eyebrow: "Pricing", h2: "You pay per user, and you start with one application",
    lead: "Priced in line with the decision-tooling market. Start with the application that carries today's pain, extend later.",
    trial: "Free trial, no card required. When it ends access closes — your models and criteria vocabulary are kept.",
    note: "Prices excluding tax, per named user. Monthly with no commitment, or annual with two months free. No hidden usage fee: AI consumption is visible inside the platform.",
    cta: "Start the trial",
    plans: [
      { n: "Decide", price: "\u20ac39 / user / month", year: "or \u20ac390 / year — 2 months free", who: "Executive committee, transformation leadership",
        items: ["Understand \u2192 Impact \u2192 Compose \u2192 Arbitrate \u2192 Follow-up", "BORA engine: dominance, robustness, disagreement map", "One-page signable decision record", "From 3 users"] },
      { n: "Architect", price: "\u20ac79 / user / month", year: "or \u20ac790 / year — 2 months free", who: "CIO, enterprise architecture, transformation PMO",
        items: ["Framing, capabilities, target & flows, backlog, follow-up", "Architecture agent: single points of passage, coupling, critical path", "Exportable architecture dossier and backlog", "Decide included for the same users"] },
      { n: "Platform", price: "On request", year: "from \u20ac9,900 / year", who: "Group, executive committee, consulting firm",
        items: ["Decide + Architect + Decision copilot", "Connectors to source systems and enterprise vocabulary", "Retail and Energy & Utilities sector models", "Unlimited users, method support"] },
    ],
  },
  di: {
    eyebrow: "Market category",
    h2: "Decision intelligence: the category, and where we stand in it",
    lead: "Analysts have named this market. It is no longer about storing or analysing data, but about making explicit how a decision is made, then measuring what it produced. Aura sits exactly there, with a deliberate method choice: the reasoning is qualitative and non-compensatory.",
    defLabel: "Reference definition",
    def: "Decision intelligence platforms (DIPs) are software to create decision-centric solutions that support, augment and automate decision making of humans or machines, powered by the composition of data, analytics, knowledge and AI.",
    defSource: "Gartner, Decision Intelligence Platforms — Gartner Peer Insights (market definition)",
    quotes: [
      { q: "By 2027, 25% of ungoverned decisions using large language models (LLMs) will cause financial or reputational loss due to human biases, insufficient critical thinking, and AI sycophancy.",
        src: "Gartner, Magic Quadrant for Decision Intelligence Platforms, 2026 — strategic planning assumption",
        url: "https://www.gartner.com/reviews/market/decision-intelligence-platforms" },
      { q: "By 2028, 25% of CDAO vision statements will become “decision-centric,” surpassing “data driven” slogans, with human decision-making behaviors explicitly addressed.",
        src: "Gartner, Magic Quadrant for Decision Intelligence Platforms, 2026 — strategic planning assumption",
        url: "https://www.gartner.com/reviews/market/decision-intelligence-platforms" },
      { q: "Decision intelligence is a practical discipline used to improve decision making by explicitly understanding and engineering how decisions are made, and how outcomes are evaluated, managed and improved by feedback.",
        src: "Gartner IT Glossary, “Decision Intelligence”",
        url: "https://www.gartner.com/en/information-technology/glossary/decision-intelligence" },
    ],
    schemaLabel: "The instrumented decision cycle",
    schemaCaption: "The discipline requires the whole loop. Aura holds it end to end: the decision is modelled, settled on an explicit rule, translated into a plan, then confronted with what actually happened in the tracking register.",
    steps: [
      { t: "Frame", d: "The question, options, criteria and knock-out thresholds are written before any computation." },
      { t: "Inform", d: "Available facts, departmental positions, qualitative judgements where data is missing." },
      { t: "Settle", d: "A published, reproducible rule that names the deciding criterion and the tipping point." },
      { t: "Execute", d: "Target, sequence, owners: the decision becomes a plan you can be held to." },
      { t: "Observe", d: "Planned versus actual, evidence attached, reservations lifted or still open." },
      { t: "Revise", d: "The observation reopens the framing: the rule and the criteria vocabulary improve." },
    ],
    standLabel: "What we do differently",
    stand: [
      { t: "No composite score", d: "Most platforms aggregate into one number. We rank: a knock-out criterion stays a knock-out." },
      { t: "AI informs, it does not settle", d: "Generative AI runs the interview and drafts; the decision stays with the committee — a direct answer to the ungoverned-decision risk." },
      { t: "Deciding without complete data", d: "The discipline usually assumes data is ready. We start from ordinal judgements and replace them with facts as soon as they exist." },
      { t: "The loop ships with the product", d: "Tracking of signed combinations, with evidence and stakeholder positions, closes the loop the definition demands." },
    ],
  },
  cloture: {
    h2: "A real trade-off, on your criteria.",
    lead: "One session is enough to model a live decision and produce the signable record. The criteria vocabulary stays with you.",
    cta: "Open the platform",
  },
  prestations: {
    eyebrow: "Engagements", h2: "The platform, operated by an Aura consultant",
    lead: "For the decisions you cannot afford to get wrong. Three chainable formats: a decision leads to a design, the design to a transformation.",
    chain: "Decide → Design → Transform", dureeLabel: "Duration", prixLabel: "Price",
    items: [
      { n: "AURA Decision Sprint", sub: "Settle a high-stakes decision", duree: "1–2 weeks", prix: "€8–14k",
        steps: "Framing → Interviews → Modelling → Impacts → Scenarios → Arbitration → Readout",
        items: ["Executive Decision Brief", "Documented decision model", "Compared scenarios, strengths and weaknesses", "Critical risks and assumptions", "Missing information needed to decide", "Conditions that would flip the recommendation"] },
      { n: "AURA Engineering Decision Sprint", sub: "Choose the concept before freezing the product or system", duree: "2–4 weeks", prix: "€14–26k",
        steps: "Needs → Requirements → Alternatives → Impacts → Arbitration → Selected concept",
        items: ["Recommended architecture or concept", "Critical requirements", "Residual risks and mitigation", "Assumptions to validate", "Validation and transition plan"] },
      { n: "AURA Transformation Architecture", sub: "From a blurred transformation to a reasoned target and a trajectory", duree: "6–8 weeks", prix: "€35–70k · multi-domain €60–110k",
        steps: "Observe → Bound → Understand → Require → Design → Arbitrate → Transform",
        items: ["Factual diagnosis of systems and flows", "2 to 4 credible target architectures", "Comparative arbitration with Aura", "Traced structuring decisions", "Roadmap and OKRs", "Upfront cost estimate"] },
    ],
    note: "Senior decision consultants, platform access during the engagement, documented deliverables. A third below a generalist firm for the same duration: the platform does the work others bill in man-days. A forward-deployed model: what is learned on one engagement becomes a reusable platform asset, not a report left on a shelf.",
    cta: "Present your case",
  },
  footer: { cas: "Reference cases", plateforme: "Platform" },

};

export const VITRINE: Record<Lang, VitrineCopy> = { fr: FR, en: EN };
