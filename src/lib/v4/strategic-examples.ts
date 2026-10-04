// Décisions stratégiques Énergie (renouvelables & flexibilité) : chacune lance le dialogue « Décider vite » pré-rempli.
// Exemples génériques sur le producteur fictif Héliade Énergies.
export const STRATEGIC_EXAMPLES: { secteur: string; titre: string; question: string }[] = [
  { secteur: "Flexibilité", titre: "Investissement BESS", question: "Stockage par batteries de 50 MW / 100 MWh ou flexibilité contractualisée auprès d'un agrégateur ? Nous voulons sécuriser nos engagements de services système sans immobiliser trop de capital." },
  { secteur: "Renouvelables", titre: "Hybridation", question: "Hybrider un parc solaire existant avec une batterie ou repowerer le parc éolien voisin ? Le raccordement est limité et l'écrêtement augmente aux heures de prix bas." },
  { secteur: "Marchés", titre: "Marchés de services système", question: "aFRR, mFRR ou arbitrage infrajournalier pour placer notre flexibilité en priorité ? Nous voulons de la valeur sans risque de pénalité de non-disponibilité." },
  { secteur: "Conduite", titre: "Mutualisation des centres de conduite", question: "Mutualiser les centres de conduite pays en un centre central avec astreintes locales, ou garder un centre par pays ? La continuité de conduite en cas de perte de lien est non négociable." },
  { secteur: "Organisation", titre: "Modèle central / pays", question: "Centraliser l'orchestration des consignes ou laisser la main aux pays avec des règles communes ? Les contraintes locales et réglementaires diffèrent selon les pays." },
  { secteur: "Conformité", titre: "Publication REMIT", question: "Automatiser la publication des messages UMM dès la saisie d'indisponibilité ou garder une validation humaine au centre ? Nous voulons zéro retard sans publier d'information erronée." },
  { secteur: "SI", titre: "Référentiel d'actifs unique", question: "Imposer un référentiel d'actifs maître à tous les outils (SCADA, GMAO, planification) ou maintenir des tables de correspondance ? Les écarts d'identifiants créent des ordres de travail orphelins." },
  { secteur: "Télécom", titre: "Redondance des liens centre–pays", question: "Doubler les liens centre–pays par un second opérateur ou renforcer le mode dégradé local ? Une perte de lien prive le centre de la contrôlabilité des actifs." },
];

/** Objectifs stratégiques Énergie proposés dans Comprendre. */
export const STRATEGIC_GOALS = [
  "Respect des engagements de services système (aFRR/mFRR)", "Contrôlabilité et sûreté de conduite des actifs",
  "Valeur de marché de la flexibilité (DA/ID, arbitrage)", "Conformité réglementaire (REMIT, codes réseau)", "Résilience SI et télécom des centres de conduite",
];
