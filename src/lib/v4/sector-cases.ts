// sector-cases.ts — bibliothèque de cas de référence Aura.
//
// Doctrine : on se spécialise là où la décision est à la fois COMPLEXE,
// RÉCURRENTE et MASSIVE. Quatre terrains retenus, deux prioritaires
// (Retail et Utilities) : deux références suffisent à constituer un
// vocabulaire de critères réutilisable — c'est le vrai actif défendable.
//
// Chaque cas porte : l'As-Is (ce qui existe aujourd'hui, et ce qui coince),
// la cible, la trajectoire, les critères (MOE → MOP), les leviers et leurs
// options, les parties prenantes. Aucun chiffre inventé : les états sont
// qualitatifs, conformes au moteur ordinal.

export type CaseSectorId = "retail" | "utilities" | "sante" | "dsi-eti";
export type Priority = "prioritaire" | "secondaire";
export type Importance = "Essentiel" | "Important" | "Secondaire" | "Faible";
/** État qualitatif d'un élément d'As-Is. */
export type AsIsHealth = "solide" | "tendu" | "critique" | "absent";

export interface CaseSector {
  id: CaseSectorId;
  label: string;
  priority: Priority;
  /** Pourquoi ce terrain : ce qui rend la décision récurrente et massive. */
  these: string;
  acheteur: string;
  frequence: string;
  /** Le vocabulaire de critères réutilisable d'un client à l'autre — le moat. */
  vocabulaire: { label: string; description: string; importance: Importance }[];
}

export interface AsIsItem {
  label: string;
  etat: AsIsHealth;
  /** Le fait observé, pas une opinion. */
  constat: string;
}

export interface CaseCriterion {
  label: string;
  importance: Importance;
  nature: "efficacite" | "cout" | "risque";
  mops: string[];
}

export interface CaseLever {
  label: string;
  options: string[];
}

export interface ReferenceCase {
  id: string;
  sector: CaseSectorId;
  title: string;
  question: string;
  recurrence: string;
  /** Ce qui rend la décision difficile — la raison d'être d'un modèle ordinal. */
  difficulte: string;
  asIs: AsIsItem[];
  cible: string[];
  trajectoire: { vague: string; horizon: string; contenu: string }[];
  criteres: CaseCriterion[];
  leviers: CaseLever[];
  partiesPrenantes: string[];
  /** Ce qu'on met sur la fiche de décision une fois arbitré. */
  livrable: string;
}

/* ── Les quatre terrains ─────────────────────────────────────────────────── */

export const CASE_SECTORS: CaseSector[] = [
  {
    id: "retail",
    label: "Retail & distribution",
    priority: "prioritaire",
    these: "Arbitrages d'assortiment, ouverture/fermeture de points de vente, priorisation omnicanal : très fréquents, politiquement chargés, et jamais tranchés par la seule donnée.",
    acheteur: "Directeur commercial · Directeur réseau · DG d'enseigne",
    frequence: "Cycle mensuel (assortiment) à trimestriel (réseau)",
    vocabulaire: [
      { label: "Contribution à la marge", description: "Effet sur la marge commerciale du périmètre, hors effets de report.", importance: "Essentiel" },
      { label: "Image d'enseigne", description: "Ce que la décision dit au client de ce qu'est l'enseigne.", importance: "Important" },
      { label: "Tension sociale", description: "Acceptabilité par les équipes magasin et les partenaires sociaux.", importance: "Essentiel" },
      { label: "Exécutabilité en magasin", description: "Capacité réelle du réseau à appliquer la décision sans dérive.", importance: "Important" },
      { label: "Effet cannibalisation", description: "Report de chiffre entre canaux ou entre points de vente.", importance: "Important" },
      { label: "Réversibilité", description: "Coût d'un retour arrière si le pari est perdu.", importance: "Secondaire" },
    ],
  },
  {
    id: "utilities",
    label: "Utilities & énergie",
    priority: "prioritaire",
    these: "Renouvellement de patrimoine sous contrainte réglementaire : la décision revient chaque année, porte sur des actifs longs, et le coût de l'erreur est asymétrique.",
    acheteur: "Directeur technique · Directeur patrimoine · Directeur de la conformité",
    frequence: "Programmation annuelle, révision semestrielle",
    vocabulaire: [
      { label: "Sécurité des personnes et des biens", description: "Exposition résiduelle après décision. Jamais compensable par un gain économique.", importance: "Essentiel" },
      { label: "Conformité réglementaire", description: "Tenue de l'obligation dans la fenêtre imposée par le régulateur.", importance: "Essentiel" },
      { label: "Continuité de fourniture", description: "Effet sur la disponibilité du service pour l'usager final.", importance: "Essentiel" },
      { label: "Soutenabilité du plan de charge", description: "Capacité des équipes et des prestataires à absorber le programme.", importance: "Important" },
      { label: "Empreinte carbone du programme", description: "Effet direct et induit sur la trajectoire d'émissions.", importance: "Important" },
      { label: "Acceptabilité territoriale", description: "Position des collectivités et des riverains sur les travaux.", importance: "Secondaire" },
    ],
  },
  {
    id: "sante",
    label: "Santé, hôpital & secteur public",
    priority: "secondaire",
    these: "Priorisation d'investissements sous contrainte non monétisable : on ne peut pas mettre un prix sur une prise en charge évitée. Terrain naturel de l'ordinal.",
    acheteur: "Directeur général de CHU · Directeur des investissements · ARS",
    frequence: "Campagne budgétaire annuelle + arbitrages en cours d'année",
    vocabulaire: [
      { label: "Qualité et sécurité des soins", description: "Effet sur la prise en charge du patient.", importance: "Essentiel" },
      { label: "Accès aux soins", description: "Effet sur les délais et la couverture territoriale.", importance: "Essentiel" },
      { label: "Attractivité des métiers", description: "Effet sur le recrutement et la fidélisation des soignants.", importance: "Important" },
      { label: "Soutenabilité budgétaire", description: "Compatibilité avec la trajectoire financière contrainte.", importance: "Important" },
      { label: "Conformité et certification", description: "Tenue des exigences HAS / tutelle.", importance: "Essentiel" },
      { label: "Faisabilité opérationnelle", description: "Capacité à conduire le projet sans dégrader l'exploitation.", importance: "Important" },
    ],
  },
  {
    id: "dsi-eti",
    label: "Direction SI d'ETI",
    priority: "secondaire",
    these: "Rationalisation applicative et choix d'éditeurs : décision annuelle, budget déjà voté, forte charge politique interne entre directions métier.",
    acheteur: "DSI · Directeur de la transformation · Directeur financier",
    frequence: "Schéma directeur annuel, comités d'investissement trimestriels",
    vocabulaire: [
      { label: "Couverture du besoin métier", description: "Ce que la solution couvre réellement des exigences exprimées.", importance: "Essentiel" },
      { label: "Dette technique induite", description: "Ce que la décision ajoute ou retire au passif technique.", importance: "Important" },
      { label: "Dépendance éditeur", description: "Degré d'enfermement contractuel et technique.", importance: "Important" },
      { label: "Coût total de possession", description: "Charge récurrente, exprimée en ordinal, pas en euros faux.", importance: "Essentiel" },
      { label: "Capacité d'adoption", description: "Charge de conduite du changement sur les métiers.", importance: "Important" },
      { label: "Souveraineté et conformité données", description: "Localisation, RGPD, exigences sectorielles.", importance: "Important" },
    ],
  },
];

/* ── Les cas ─────────────────────────────────────────────────────────────── */

export const REFERENCE_CASES: ReferenceCase[] = [
  {
    id: "retail-assortiment",
    sector: "retail",
    title: "Rationalisation d'assortiment sur une catégorie",
    question: "Quelles références retirer, garder ou renforcer sur la catégorie, sans casser l'image de choix ?",
    recurrence: "À chaque revue de catégorie — plusieurs dizaines de fois par an dans une enseigne.",
    difficulte: "Les données de vente ne disent rien du report client ni de l'effet d'image ; les acheteurs et le marketing n'ont pas le même critère de tête.",
    asIs: [
      { label: "Revue de catégorie", etat: "tendu", constat: "Décision prise sur un tableur de rotation, sans trace du raisonnement." },
      { label: "Données de report client", etat: "absent", constat: "Aucune mesure du transfert d'achat après retrait d'une référence." },
      { label: "Alignement achats / marketing", etat: "critique", constat: "Deux classements concurrents présentés au même comité." },
      { label: "Exécution magasin", etat: "tendu", constat: "Planogrammes appliqués partiellement, écart non mesuré." },
    ],
    cible: [
      "Un modèle de critères partagé achats / marketing / réseau, réutilisé à chaque revue.",
      "Chaque retrait de référence documenté : critère décisif, concession assumée, réserve.",
      "Une fiche de décision signée par catégorie, opposable en revue de performance.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Modéliser une catégorie pilote, fixer le vocabulaire de critères." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Étendre à l'ensemble des catégories d'un univers, industrialiser la fiche de décision." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Brancher les signaux de vente dans Studio pour déclencher les revues." },
    ],
    criteres: [
      { label: "Contribution à la marge", importance: "Essentiel", nature: "efficacite", mops: ["Marge unitaire", "Volume porté"] },
      { label: "Image d'enseigne", importance: "Important", nature: "efficacite", mops: ["Largeur perçue de l'offre", "Références signature"] },
      { label: "Effet cannibalisation", importance: "Important", nature: "risque", mops: ["Report intra-catégorie", "Report vers le e-commerce"] },
      { label: "Exécutabilité en magasin", importance: "Important", nature: "cout", mops: ["Charge de réimplantation", "Formation équipe"] },
    ],
    leviers: [
      { label: "Profondeur d'assortiment", options: ["Réduire fortement", "Réduire la queue de gamme", "Statu quo", "Élargir sur le premium"] },
      { label: "Traitement des marques propres", options: ["Renforcer", "Maintenir", "Réduire"] },
      { label: "Rythme de bascule", options: ["Big bang national", "Vague pilote puis extension", "Par région"] },
    ],
    partiesPrenantes: ["Direction achats", "Direction marketing", "Direction réseau", "Directeurs de magasin"],
    livrable: "Fiche de décision catégorie — 1 page, signable en comité commercial.",
  },
  {
    id: "retail-reseau",
    sector: "retail",
    title: "Ouverture, transfert ou fermeture de points de vente",
    question: "Sur le parc actuel, où ouvrir, où transférer, où fermer, et dans quel ordre ?",
    recurrence: "Comité réseau trimestriel, décisions cumulées sur plusieurs années.",
    difficulte: "Décision irréversible, socialement lourde, avec des effets de réseau que la rentabilité par magasin ne capte pas.",
    asIs: [
      { label: "Suivi de performance magasin", etat: "solide", constat: "Chiffre et marge disponibles par point de vente." },
      { label: "Lecture des effets de réseau", etat: "absent", constat: "Aucun modèle du report entre magasins voisins." },
      { label: "Instruction sociale", etat: "critique", constat: "Traitée après la décision économique, jamais comme un critère." },
      { label: "Traçabilité des arbitrages passés", etat: "tendu", constat: "Décisions historiques non documentées, rejouées à l'identique." },
    ],
    cible: [
      "Un même modèle appliqué à tout le parc : comparabilité des dossiers d'un comité à l'autre.",
      "La tension sociale traitée comme critère de premier rang, pas comme conséquence.",
      "Un séquencement par vagues, révisable, avec les conditions de réouverture du débat.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Modéliser les 10 dossiers les plus contestés du parc." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Généraliser au parc, ouvrir la carte des désaccords au comité social." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Suivi des décisions prises : ce qui s'est vérifié, ce qui ne s'est pas vérifié." },
    ],
    criteres: [
      { label: "Contribution à la marge", importance: "Essentiel", nature: "efficacite", mops: ["Marge du point de vente", "Effet sur la zone"] },
      { label: "Tension sociale", importance: "Essentiel", nature: "risque", mops: ["Emplois concernés", "Position des représentants"] },
      { label: "Image d'enseigne", importance: "Important", nature: "efficacite", mops: ["Présence territoriale", "Couverture concurrentielle"] },
      { label: "Réversibilité", importance: "Secondaire", nature: "risque", mops: ["Engagement de bail", "Coût de remise en état"] },
    ],
    leviers: [
      { label: "Devenir du site", options: ["Fermer", "Transférer", "Redimensionner", "Maintenir en l'état"] },
      { label: "Format retenu", options: ["Grand format", "Format de proximité", "Point de retrait"] },
      { label: "Calendrier", options: ["Immédiat", "Fin de bail", "Après ouverture du site relais"] },
    ],
    partiesPrenantes: ["Direction générale", "Direction réseau", "DRH", "Direction immobilière", "Représentants du personnel"],
    livrable: "Dossier de site — 1 page par point de vente, avec la carte des désaccords annexée.",
  },
  {
    id: "retail-omnicanal",
    sector: "retail",
    title: "Priorisation des chantiers omnicanaux",
    question: "Entre click & collect, livraison rapide, fidélité unifiée et refonte du site, que finance-t-on cette année ?",
    recurrence: "Arbitrage budgétaire annuel, révisé deux fois par an.",
    difficulte: "Tous les chantiers ont un ROI théorique positif ; la contrainte réelle est la capacité IT et magasin, pas l'argent.",
    asIs: [
      { label: "Portefeuille de chantiers", etat: "tendu", constat: "Plus de projets validés que de capacité de livraison." },
      { label: "Business cases", etat: "critique", constat: "ROI construits sur des hypothèses non challengées, non comparables." },
      { label: "Capacité IT", etat: "critique", constat: "Saturée, non modélisée comme critère de décision." },
      { label: "Mesure des chantiers livrés", etat: "absent", constat: "Aucun retour sur les promesses des années précédentes." },
    ],
    cible: [
      "Une priorisation par critères ordinaux, où la capacité de livraison est un critère et non une excuse.",
      "Un suivi des promesses : ce qui a été annoncé, ce qui a été constaté.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Modéliser le portefeuille de l'année en cours." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Instaurer la revue trimestrielle sur le même modèle." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Boucler avec le suivi des résultats constatés." },
    ],
    criteres: [
      { label: "Contribution à la marge", importance: "Essentiel", nature: "efficacite", mops: ["Panier moyen", "Taux de conversion"] },
      { label: "Exécutabilité en magasin", importance: "Essentiel", nature: "cout", mops: ["Charge équipe", "Complexité process"] },
      { label: "Capacité de livraison IT", importance: "Essentiel", nature: "cout", mops: ["Charge équipe SI", "Dépendances techniques"] },
      { label: "Image d'enseigne", importance: "Important", nature: "efficacite", mops: ["Promesse client tenue"] },
    ],
    leviers: [
      { label: "Chantier prioritaire", options: ["Click & collect", "Livraison rapide", "Fidélité unifiée", "Refonte du site"] },
      { label: "Mode de réalisation", options: ["Interne", "Éditeur du marché", "Mixte"] },
      { label: "Périmètre de lancement", options: ["Pilote régional", "National", "Sur les 20 % de magasins porteurs"] },
    ],
    partiesPrenantes: ["Direction e-commerce", "Direction réseau", "DSI", "Direction financière"],
    livrable: "Plan omnicanal — vagues 1/2/3 et conditions de réouverture.",
  },
  {
    id: "utilities-patrimoine",
    sector: "utilities",
    title: "Programmation du renouvellement de patrimoine réseau",
    question: "Quels tronçons renouveler cette année, sous obligation réglementaire et capacité de travaux contrainte ?",
    recurrence: "Programmation annuelle obligatoire, révision semestrielle.",
    difficulte: "La sécurité ne se compense pas par de l'économie : un modèle compensatoire donne des réponses inacceptables. L'ordinal est ici une nécessité méthodologique, pas une préférence.",
    asIs: [
      { label: "Connaissance du patrimoine", etat: "tendu", constat: "Inventaire disponible mais qualité d'état hétérogène selon les régions." },
      { label: "Critères de priorisation", etat: "critique", constat: "Un score composite unique qui masque les arbitrages sécurité / coût." },
      { label: "Capacité travaux", etat: "critique", constat: "Plan de charge saturé, non intégré au calcul de priorité." },
      { label: "Traçabilité réglementaire", etat: "tendu", constat: "Justification produite après coup pour le régulateur." },
    ],
    cible: [
      "Une priorisation où sécurité et conformité sont non compensables par construction.",
      "Le plan de charge des prestataires intégré comme critère, pas comme contrainte subie.",
      "Une justification opposable au régulateur, produite par le modèle lui-même.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Modéliser une région pilote, figer le vocabulaire de critères." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Déployer sur l'ensemble des régions, brancher l'inventaire patrimoine." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Suivi des incidents constatés sur les tronçons non retenus." },
    ],
    criteres: [
      { label: "Sécurité des personnes et des biens", importance: "Essentiel", nature: "risque", mops: ["Exposition résiduelle", "Densité de population exposée"] },
      { label: "Conformité réglementaire", importance: "Essentiel", nature: "risque", mops: ["Échéance imposée", "Risque de sanction"] },
      { label: "Continuité de fourniture", importance: "Essentiel", nature: "efficacite", mops: ["Clients concernés", "Durée d'interruption"] },
      { label: "Soutenabilité du plan de charge", importance: "Important", nature: "cout", mops: ["Capacité prestataires", "Concurrence entre chantiers"] },
      { label: "Empreinte carbone du programme", importance: "Important", nature: "efficacite", mops: ["Émissions travaux", "Fuites évitées"] },
    ],
    leviers: [
      { label: "Stratégie de renouvellement", options: ["Renouvellement complet", "Réhabilitation", "Surveillance renforcée", "Report d'un an"] },
      { label: "Ordre de passage", options: ["Par niveau de risque", "Par grappe géographique", "Par échéance réglementaire"] },
      { label: "Mode de réalisation", options: ["Régie", "Marché-cadre", "Mixte"] },
    ],
    partiesPrenantes: ["Direction technique", "Direction régionale", "Conformité", "Achats travaux", "Collectivités"],
    livrable: "Programme annuel — 1 page par grappe, justification réglementaire intégrée.",
  },
  {
    id: "utilities-transition",
    sector: "utilities",
    title: "Trajectoire de transition d'un actif énergétique",
    question: "Sur quel horizon et par quelle voie faire évoluer l'actif : verdissement, conversion, ou sortie progressive ?",
    recurrence: "Réexaminé à chaque évolution réglementaire ou tarifaire — au moins une fois par an.",
    difficulte: "Horizon long, cadre réglementaire mouvant, et des critères (acceptabilité, souveraineté) qui n'ont pas d'unité commune.",
    asIs: [
      { label: "Scénarios de trajectoire", etat: "tendu", constat: "Trois scénarios documentés, comparés sur le seul coût actualisé." },
      { label: "Hypothèses réglementaires", etat: "critique", constat: "Figées, alors qu'elles sont le premier facteur de bascule." },
      { label: "Acceptabilité territoriale", etat: "absent", constat: "Non instruite au moment du choix." },
    ],
    cible: [
      "Des scénarios comparés sur l'ensemble des critères, y compris non monétisables.",
      "Une robustesse ordinale explicite : à partir de quel déplacement d'importance le choix bascule.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Reprendre les trois scénarios existants dans le modèle ordinal." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Instruire l'acceptabilité territoriale et la carte des désaccords." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Revue annuelle déclenchée par les signaux réglementaires." },
    ],
    criteres: [
      { label: "Conformité réglementaire", importance: "Essentiel", nature: "risque", mops: ["Trajectoire imposée", "Marge de manœuvre"] },
      { label: "Continuité de fourniture", importance: "Essentiel", nature: "efficacite", mops: ["Disponibilité", "Sécurité d'approvisionnement"] },
      { label: "Empreinte carbone du programme", importance: "Important", nature: "efficacite", mops: ["Émissions directes", "Émissions induites"] },
      { label: "Acceptabilité territoriale", importance: "Important", nature: "risque", mops: ["Position des collectivités", "Position des riverains"] },
    ],
    leviers: [
      { label: "Voie de transition", options: ["Verdissement progressif", "Conversion complète", "Sortie progressive", "Maintien avec compensation"] },
      { label: "Horizon", options: ["3 ans", "7 ans", "12 ans"] },
      { label: "Portage", options: ["Interne", "Coentreprise", "Cession partielle"] },
    ],
    partiesPrenantes: ["Direction générale", "Direction technique", "Affaires publiques", "Direction financière", "Collectivités"],
    livrable: "Note de trajectoire — option retenue, robustesse, conditions de réexamen.",
  },
  {
    id: "sante-investissements",
    sector: "sante",
    title: "Priorisation des investissements d'un établissement de santé",
    question: "Entre bloc opératoire, imagerie, systèmes d'information et bâtiment, que finance-t-on cette campagne ?",
    recurrence: "Campagne budgétaire annuelle, arbitrages complémentaires en cours d'année.",
    difficulte: "Les bénéfices ne sont pas monétisables — une prise en charge évitée n'a pas de prix — et le budget est contraint par la tutelle.",
    asIs: [
      { label: "Recueil des demandes", etat: "tendu", constat: "Demandes des pôles collectées, sans grille commune." },
      { label: "Critères d'arbitrage", etat: "critique", constat: "Implicites, portés par le rapport de force entre chefs de pôle." },
      { label: "Traçabilité vis-à-vis de la tutelle", etat: "tendu", constat: "Justification reconstituée a posteriori." },
      { label: "Suivi des investissements passés", etat: "absent", constat: "Aucun retour sur les effets constatés." },
    ],
    cible: [
      "Une grille de critères commune à tous les pôles, connue avant le dépôt des demandes.",
      "Les désaccords entre pôles cartographiés et présentés au directoire, pas étouffés.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Fixer la grille et l'appliquer à la campagne en cours." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Étendre aux arbitrages infra-annuels, ouvrir la carte des désaccords." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Boucler avec le suivi des effets constatés par investissement." },
    ],
    criteres: [
      { label: "Qualité et sécurité des soins", importance: "Essentiel", nature: "efficacite", mops: ["Événements indésirables évités", "Conformité des plateaux"] },
      { label: "Accès aux soins", importance: "Essentiel", nature: "efficacite", mops: ["Délai de prise en charge", "Couverture territoriale"] },
      { label: "Attractivité des métiers", importance: "Important", nature: "efficacite", mops: ["Conditions de travail", "Attractivité du plateau technique"] },
      { label: "Soutenabilité budgétaire", importance: "Important", nature: "cout", mops: ["Charge récurrente", "Reste à financer"] },
      { label: "Faisabilité opérationnelle", importance: "Important", nature: "risque", mops: ["Impact sur l'exploitation", "Disponibilité des équipes"] },
    ],
    leviers: [
      { label: "Domaine financé", options: ["Bloc opératoire", "Imagerie", "Systèmes d'information", "Bâtiment"] },
      { label: "Niveau d'ambition", options: ["Mise à niveau", "Modernisation", "Transformation"] },
      { label: "Étalement", options: ["Une campagne", "Deux campagnes", "Trois campagnes"] },
    ],
    partiesPrenantes: ["Directoire", "Chefs de pôle", "Direction des soins", "Direction financière", "ARS"],
    livrable: "Dossier de campagne — 1 page par investissement, opposable en directoire.",
  },
  {
    id: "dsi-rationalisation",
    sector: "dsi-eti",
    title: "Rationalisation du parc applicatif",
    question: "Quelles applications conserver, fusionner, remplacer ou décommissionner sur le schéma directeur ?",
    recurrence: "Schéma directeur annuel, revues trimestrielles.",
    difficulte: "Chaque application a un sponsor métier ; la décision est autant politique que technique, et la dette induite n'apparaît pas dans le business case.",
    asIs: [
      { label: "Cartographie applicative", etat: "tendu", constat: "Existante mais partielle : flux et contrats d'interface non documentés." },
      { label: "Dette technique", etat: "critique", constat: "Connue des équipes, absente des dossiers d'arbitrage." },
      { label: "Sponsors métier", etat: "critique", constat: "Chaque direction défend son outil, sans grille comparable." },
      { label: "Contrats éditeurs", etat: "tendu", constat: "Échéances dispersées, non alignées sur le schéma directeur." },
    ],
    cible: [
      "Une grille unique appliquée à tout le parc, connue des sponsors métier.",
      "La dette technique et la dépendance éditeur traitées comme critères de premier rang.",
      "Le lien maintenu entre exigence métier et application cible — pas d'application orpheline.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Modéliser le domaine le plus contesté, fixer la grille." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Étendre au parc, aligner les échéances contractuelles." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Décommissionnements effectifs et suivi de la dette résiduelle." },
    ],
    criteres: [
      { label: "Couverture du besoin métier", importance: "Essentiel", nature: "efficacite", mops: ["Exigences couvertes", "Écarts fonctionnels"] },
      { label: "Coût total de possession", importance: "Essentiel", nature: "cout", mops: ["Licences", "Exploitation", "Maintenance"] },
      { label: "Dette technique induite", importance: "Important", nature: "risque", mops: ["Obsolescence", "Complexité d'intégration"] },
      { label: "Dépendance éditeur", importance: "Important", nature: "risque", mops: ["Enfermement contractuel", "Réversibilité technique"] },
      { label: "Capacité d'adoption", importance: "Important", nature: "cout", mops: ["Conduite du changement", "Formation"] },
    ],
    leviers: [
      { label: "Devenir de l'application", options: ["Conserver", "Fusionner", "Remplacer", "Décommissionner"] },
      { label: "Type de solution cible", options: ["Éditeur du marché", "SaaS spécialisé", "Développement interne", "Brique du socle existant"] },
      { label: "Séquencement", options: ["Immédiat", "À l'échéance contractuelle", "Après le domaine amont"] },
    ],
    partiesPrenantes: ["DSI", "Sponsors métier", "Architecture", "Achats", "Direction financière"],
    livrable: "Décision applicative — 1 page par application, annexée au schéma directeur.",
  },
  {
    id: "dsi-editeur",
    sector: "dsi-eti",
    title: "Choix d'un éditeur sur un domaine structurant",
    question: "Quel éditeur retenir, en assumant explicitement la concession faite sur les critères non retenus ?",
    recurrence: "Plusieurs fois par an dans une ETI en transformation.",
    difficulte: "Les grilles de notation classiques additionnent des points et laissent l'illusion d'objectivité ; le désaccord réel entre directions n'apparaît jamais.",
    asIs: [
      { label: "Grille de dépouillement", etat: "critique", constat: "Notation pondérée sur 100, entièrement compensatoire." },
      { label: "Expression du besoin", etat: "tendu", constat: "Exigences listées mais non hiérarchisées." },
      { label: "Avis des directions", etat: "critique", constat: "Recueillis séparément, jamais confrontés." },
    ],
    cible: [
      "Une comparaison ordinale où un critère éliminatoire reste éliminatoire.",
      "La matrice de dominance produite en séance : qui domine qui, sur quoi.",
      "Une fiche signable qui documente la concession acceptée.",
    ],
    trajectoire: [
      { vague: "Vague 1", horizon: "0–3 mois", contenu: "Rejouer la consultation en cours dans le modèle." },
      { vague: "Vague 2", horizon: "3–9 mois", contenu: "Standardiser la grille pour toutes les consultations du domaine." },
      { vague: "Vague 3", horizon: "9 mois +", contenu: "Suivi des engagements éditeur constatés." },
    ],
    criteres: [
      { label: "Couverture du besoin métier", importance: "Essentiel", nature: "efficacite", mops: ["Exigences bloquantes", "Exigences souhaitées"] },
      { label: "Souveraineté et conformité données", importance: "Essentiel", nature: "risque", mops: ["Localisation", "RGPD"] },
      { label: "Coût total de possession", importance: "Essentiel", nature: "cout", mops: ["Licences", "Intégration"] },
      { label: "Dépendance éditeur", importance: "Important", nature: "risque", mops: ["Réversibilité", "Feuille de route imposée"] },
    ],
    leviers: [
      { label: "Éditeur", options: ["Leader du marché", "Challenger spécialisé", "Acteur souverain", "Solution existante étendue"] },
      { label: "Mode d'hébergement", options: ["SaaS éditeur", "Cloud souverain", "Sur site"] },
      { label: "Périmètre de démarrage", options: ["Domaine complet", "Pilote sur une entité", "Socle puis extensions"] },
    ],
    partiesPrenantes: ["DSI", "Direction métier", "Achats", "DPO", "Direction financière"],
    livrable: "Fiche de choix éditeur — option retenue, dominance, concession, réserves.",
  },
];

export function casesForSector(id: CaseSectorId): ReferenceCase[] {
  return REFERENCE_CASES.filter(c => c.sector === id);
}

export const AS_IS_STYLE: Record<AsIsHealth, { label: string; color: string; bg: string }> = {
  solide:   { label: "Solide",       color: "#059669", bg: "#ecfdf5" },
  tendu:    { label: "Sous tension", color: "#b45309", bg: "#fffbeb" },
  critique: { label: "Critique",     color: "#dc2626", bg: "#fef2f2" },
  absent:   { label: "Inexistant",   color: "#6b7280", bg: "#f3f4f6" },
};
