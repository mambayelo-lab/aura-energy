/**
 * Aura V4 — Patterns d'aide à la décision pour l'Architecture
 * 4 sous-domaines (Entreprise / Applicative / Data / Infra), chacun avec :
 *  - un questionnaire d'élicitation pratique et adapté (pas de jargon TOGAF brut)
 *  - une bibliothèque de critères MOE→MOP pré-conçus (point de départ, pas figé)
 *  - un contexte expert injecté au LLM (benchmarks, normes, repères)
 * Ce fichier ne modifie ni n'importe rien du moteur d'agrégation ordinale.
 */

export interface ArchQuestion {
  id: string;
  text: string;
  placeholder?: string;
  /** Si renseigné : choix à puces au lieu d'un champ libre */
  choices?: string[];
}

/** Critère germe — mappé vers AtelierCriterion (MOE si pas de children, MOP+TPM si children) */
export interface ArchSeedCriterion {
  label: string;
  description: string;
  importance: "Essentiel" | "Important" | "Secondaire";
  children?: ArchSeedCriterion[];
}

export interface ArchitecturePattern {
  id: "entreprise" | "applicative" | "data" | "infra" | "cyber";
  label: string;
  icon: string;
  tagline: string;
  description: string;
  questionnaire: ArchQuestion[];
  seedCriteria: ArchSeedCriterion[];
  expertContext: string;
}

export const ARCHITECTURE_PATTERNS: ArchitecturePattern[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "entreprise",
    label: "Architecture d'entreprise",
    icon: "🏛",
    tagline: "Capacités métier, organisation, cible stratégique du SI",
    description: "Arbitrer une cible d'architecture d'entreprise : quelles capacités métier prioriser, comment structurer l'organisation SI, quel modèle opérationnel cible.",
    questionnaire: [
      { id: "perimetre", text: "Quel périmètre métier est concerné ? (une direction, plusieurs BU, toute l'entreprise ?)" },
      { id: "capacites", text: "Quelles capacités métier sont directement impactées par cette décision ?", placeholder: "Ex. Gestion de la relation client, Pilotage de la supply chain..." },
      { id: "modele_op", text: "Le modèle opérationnel cible est-il plutôt centralisé, fédéré, ou décentralisé ?", choices: ["Centralisé", "Fédéré", "Décentralisé", "Pas encore arbitré"] },
      { id: "dependances", text: "Quelles dépendances organisationnelles ou politiques pèsent sur cette décision ?", placeholder: "Ex. fusion en cours, réorganisation, gouvernance partagée..." },
      { id: "horizon_transfo", text: "Sur quel horizon cette cible doit-elle rester valable avant d'être revue ?" },
    ],
    seedCriteria: [
      {
        label: "Alignement stratégique",
        description: "Cohérence de la cible avec la stratégie d'entreprise et les priorités métier.",
        importance: "Essentiel",
        children: [
          { label: "Couverture des capacités prioritaires", description: "% des capacités stratégiques effectivement adressées par la cible.", importance: "Essentiel" },
          { label: "Réversibilité stratégique", description: "Capacité à ajuster la cible si la stratégie change.", importance: "Important" },
        ],
      },
      {
        label: "Gouvernance & organisation",
        description: "Clarté des responsabilités et de la prise de décision sur le SI cible.",
        importance: "Important",
        children: [
          { label: "Clarté des responsabilités (RACI)", description: "Qui décide, qui exécute, qui est informé sur chaque capacité.", importance: "Important" },
          { label: "Effort de conduite du changement", description: "Ampleur de la réorganisation humaine et des processus requise.", importance: "Important" },
        ],
      },
      {
        label: "Maîtrise du risque de transformation",
        description: "Risque d'échec ou de dérive du programme de transformation lié à cette cible.",
        importance: "Essentiel",
        children: [
          { label: "Dépendance à des acteurs clés", description: "Concentration du risque sur peu de personnes ou d'équipes.", importance: "Important" },
          { label: "Historique de réussite de transformations comparables", description: "Track record de l'organisation sur ce type de changement.", importance: "Secondaire" },
        ],
      },
      {
        label: "Valeur économique",
        description: "Retour attendu de la cible d'architecture (coût évité, agilité gagnée, revenus permis).",
        importance: "Important",
        children: [
          { label: "Coût total de possession (TCO) à 3-5 ans", description: "Coût cumulé run + build de la cible.", importance: "Important" },
          { label: "Time-to-market des futures capacités", description: "Vitesse à laquelle de nouvelles capacités pourront être ajoutées.", importance: "Secondaire" },
        ],
      },
    ],
    expertContext: "Cadre de référence : TOGAF ADM (phases B/C/D pour l'architecture métier/applicative/données), Business Capability Model. Distinguer clairement architecture actuelle (as-is) et cible (to-be) sans sur-spécifier le chemin de transition (qui relève d'un Transformation Architecture Sprint séparé). Éviter le jargon : parler de « capacités métier », « responsabilités », « cible » plutôt que d'acronymes TOGAF bruts dans les libellés visibles par l'utilisateur.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "applicative",
    label: "Architecture applicative",
    icon: "🧩",
    tagline: "Découpage, couplage, patterns d'intégration entre applications",
    description: "Arbitrer un choix d'architecture applicative : monolithe vs microservices, refonte vs enveloppement, patterns d'intégration, dette technique à traiter en priorité.",
    questionnaire: [
      { id: "perimetre_appli", text: "Quelle(s) application(s) ou quel système est concerné ?" },
      { id: "type_decision", text: "Quel type d'arbitrage est en jeu ?", choices: ["Découpage/refonte (monolithe ↔ microservices)", "Build vs Buy vs Enveloppement (legacy)", "Choix d'un pattern d'intégration", "Dette technique à traiter en priorité", "Autre"] },
      { id: "contraintes_couplage", text: "Quelles applications ou équipes sont fortement couplées à ce système aujourd'hui ?" },
      { id: "criticite", text: "Quelle est la criticité métier de ce système (impact d'un arrêt ou d'une régression) ?" },
      { id: "contraintes_equipe", text: "Quelle est la taille et la maturité de l'équipe qui devra opérer la cible ?" },
    ],
    seedCriteria: [
      {
        label: "Maintenabilité & évolutivité",
        description: "Facilité à faire évoluer le système sans régression ni effort disproportionné.",
        importance: "Essentiel",
        children: [
          { label: "Couplage inter-modules", description: "Degré de dépendance croisée entre composants (fort couplage = changement risqué).", importance: "Essentiel" },
          { label: "Dette technique existante", description: "Volume de code/design à refactoriser avant d'avancer sereinement.", importance: "Important" },
          { label: "Testabilité", description: "Capacité à valider un changement par des tests automatisés fiables.", importance: "Important" },
        ],
      },
      {
        label: "Performance & scalabilité",
        description: "Capacité du système à absorber la charge actuelle et future.",
        importance: "Important",
        children: [
          { label: "Scalabilité horizontale", description: "Possibilité de monter en charge en ajoutant des instances plutôt qu'en agrandissant une seule.", importance: "Important" },
          { label: "Latence bout-en-bout", description: "Temps de réponse perçu par l'utilisateur ou le système consommateur.", importance: "Secondaire" },
        ],
      },
      {
        label: "Complexité opérationnelle",
        description: "Effort requis pour déployer, surveiller et exploiter la cible au quotidien.",
        importance: "Essentiel",
        children: [
          { label: "Effort de déploiement & CI/CD", description: "Complexité de la chaîne de livraison pour la cible envisagée.", importance: "Important" },
          { label: "Observabilité", description: "Capacité à diagnostiquer un incident rapidement (logs, traces, métriques).", importance: "Important" },
        ],
      },
      {
        label: "Maîtrise de la migration",
        description: "Risque et coût du chemin entre l'existant et la cible.",
        importance: "Important",
        children: [
          { label: "Réversibilité du choix", description: "Possibilité de revenir en arrière si la cible s'avère mauvaise.", importance: "Important" },
          { label: "Effort de migration des données/flux", description: "Ampleur du travail de bascule technique.", importance: "Secondaire" },
        ],
      },
    ],
    expertContext: "Cadre de référence : patterns d'architecture applicative (monolithe modulaire, microservices, event-driven), stratégies de migration Strangler Fig, 12-Factor App. Le critère de couplage doit être évalué de façon réaliste (pas idéologique « microservices = toujours mieux ») : un monolithe bien modularisé peut surperformer des microservices mal découpés pour une petite équipe. Toujours faire ressortir le coût de la complexité opérationnelle ajoutée par un découpage fin.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "data",
    label: "Architecture data",
    icon: "🗄",
    tagline: "Modèle de données, gouvernance, plateforme analytique cible",
    description: "Arbitrer une cible d'architecture data : data warehouse vs data lake vs lakehouse, centralisation vs mesh, gouvernance et qualité des données, plateforme analytique.",
    questionnaire: [
      { id: "perimetre_data", text: "Quels domaines de données sont concernés ? (ex. clients, ventes, IoT, finance...)" },
      { id: "type_decision_data", text: "Quel type d'arbitrage est en jeu ?", choices: ["Plateforme analytique cible (warehouse/lake/lakehouse)", "Modèle de gouvernance (centralisé vs data mesh)", "Qualité & fiabilité des données", "Souveraineté / localisation des données", "Autre"] },
      { id: "volumetrie", text: "Quel est l'ordre de grandeur des volumes et de la fréquence de mise à jour ?" },
      { id: "sensibilite", text: "Ces données sont-elles soumises à des contraintes réglementaires (RGPD, sectorielles, souveraineté) ?" },
      { id: "consommateurs", text: "Qui consomme ces données aujourd'hui, et avec quel niveau d'exigence de fraîcheur ?" },
    ],
    seedCriteria: [
      {
        label: "Qualité & fiabilité des données",
        description: "Confiance que les utilisateurs métier peuvent accorder aux données produites.",
        importance: "Essentiel",
        children: [
          { label: "Contrôle des anomalies à la source", description: "Détection et traitement des données incohérentes avant utilisation.", importance: "Essentiel" },
          { label: "Traçabilité de la lignée (lineage)", description: "Capacité à remonter l'origine et les transformations d'une donnée.", importance: "Important" },
        ],
      },
      {
        label: "Gouvernance & conformité",
        description: "Maîtrise des accès, de la propriété et de la conformité réglementaire des données.",
        importance: "Essentiel",
        children: [
          { label: "Conformité réglementaire (RGPD, sectorielle)", description: "Respect des obligations légales sur les données concernées.", importance: "Essentiel" },
          { label: "Clarté de la propriété des données (data ownership)", description: "Chaque domaine de données a un responsable identifié.", importance: "Important" },
        ],
      },
      {
        label: "Performance analytique",
        description: "Capacité de la plateforme à répondre aux besoins d'analyse dans des délais acceptables.",
        importance: "Important",
        children: [
          { label: "Fraîcheur des données (latence batch/streaming)", description: "Délai entre l'événement source et sa disponibilité analytique.", importance: "Important" },
          { label: "Coût de requêtage à l'échelle", description: "Coût marginal d'une analyse supplémentaire sur de gros volumes.", importance: "Secondaire" },
        ],
      },
      {
        label: "Autonomie des équipes métier",
        description: "Capacité des équipes métier à exploiter les données sans dépendre en permanence de l'IT.",
        importance: "Important",
        children: [
          { label: "Self-service analytique", description: "Outils et accès permettant aux métiers d'explorer sans ticket IT.", importance: "Secondaire" },
          { label: "Effort de montée en compétence requis", description: "Formation nécessaire pour que les équipes exploitent la cible.", importance: "Secondaire" },
        ],
      },
    ],
    expertContext: "Cadre de référence : Data Mesh (Zhamak Dehghani), architectures Lakehouse (Delta/Iceberg), DAMA-DMBOK pour la gouvernance. Ne pas présumer qu'une architecture décentralisée (mesh) est supérieure : elle a un coût de gouvernance et de duplication d'effort qui doit être mis en balance avec le gain d'autonomie. Toujours faire remonter explicitement les contraintes réglementaires comme critère Essentiel quand des données personnelles ou sensibles sont en jeu.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "infra",
    label: "Architecture infrastructure",
    icon: "🖧",
    tagline: "Cloud, hébergement, réseau, résilience technique",
    description: "Arbitrer une cible d'infrastructure : cloud public vs privé vs hybride, stratégie multi-cloud, résilience/PRA, choix de plateforme de conteneurisation.",
    questionnaire: [
      { id: "perimetre_infra", text: "Quel périmètre d'infrastructure est concerné ? (une application, un datacenter, toute l'organisation...)" },
      { id: "type_decision_infra", text: "Quel type d'arbitrage est en jeu ?", choices: ["Cloud public vs privé vs hybride", "Stratégie multi-cloud / réversibilité", "Résilience & plan de reprise (PRA/PCA)", "Conteneurisation & orchestration", "Autre"] },
      { id: "contraintes_reglementaires", text: "Y a-t-il des contraintes de souveraineté, sectorielles ou de résidence des données ?" },
      { id: "sla_cible", text: "Quel niveau de disponibilité (SLA) est requis pour ce périmètre ?" },
      { id: "budget_exploitation", text: "Le modèle économique cible est-il plutôt Capex (investissement) ou Opex (consommation) ?" },
    ],
    seedCriteria: [
      {
        label: "Résilience & continuité",
        description: "Capacité du système à rester disponible face à un incident.",
        importance: "Essentiel",
        children: [
          { label: "Niveau de disponibilité atteignable (SLA)", description: "% de disponibilité réaliste avec la cible envisagée.", importance: "Essentiel" },
          { label: "Délai de reprise après incident (RTO/RPO)", description: "Temps et perte de données maximum tolérés en cas de sinistre.", importance: "Important" },
        ],
      },
      {
        label: "Souveraineté & conformité",
        description: "Maîtrise de la localisation et du contrôle des données et traitements.",
        importance: "Essentiel",
        children: [
          { label: "Résidence des données", description: "Localisation géographique effective des données et de leur traitement.", importance: "Essentiel" },
          { label: "Dépendance à un fournisseur unique (lock-in)", description: "Difficulté à changer de fournisseur cloud/infra si nécessaire.", importance: "Important" },
        ],
      },
      {
        label: "Coût total d'exploitation",
        description: "Coût réel de la cible sur la durée, au-delà du prix d'entrée.",
        importance: "Important",
        children: [
          { label: "Coût à l'usage vs investissement initial", description: "Répartition Capex/Opex et prévisibilité budgétaire.", importance: "Important" },
          { label: "Coût de sortie / migration future", description: "Effort et coût pour migrer vers une autre cible plus tard.", importance: "Secondaire" },
        ],
      },
      {
        label: "Agilité opérationnelle",
        description: "Vitesse à laquelle les équipes peuvent provisionner et faire évoluer l'infrastructure.",
        importance: "Important",
        children: [
          { label: "Délai de provisionnement", description: "Temps pour obtenir une nouvelle ressource (serveur, réseau, stockage).", importance: "Secondaire" },
          { label: "Maturité de l'automatisation (IaC)", description: "Part de l'infrastructure gérée par du code plutôt qu'en manuel.", importance: "Secondaire" },
        ],
      },
    ],
    expertContext: "Cadre de référence : Well-Architected Frameworks (AWS/Azure/GCP), stratégies FinOps, principes de résilience (chaos engineering, redondance multi-zone). Toujours faire apparaître le risque de lock-in fournisseur comme critère distinct du coût — ce sont deux dimensions différentes. Pour les contextes réglementés (santé, finance, secteur public), la souveraineté/résidence des données doit être remontée en Essentiel par défaut, pas seulement si l'utilisateur la mentionne spontanément.",
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "cyber",
    label: "Cyber & sécurité",
    icon: "🛡",
    tagline: "Surface d'exposition, identités, détection, conformité",
    description: "Arbitrer une cible de sécurité : périmètre de défense (zero trust vs périmétrique), gestion des identités et des accès, niveau de détection/réponse, mise en conformité (ISO 27001, SecNumCloud, NIS2 selon le contexte).",
    questionnaire: [
      { id: "perimetre_cyber", text: "Quel périmètre est concerné ? (une application, un domaine de données, toute l'organisation...)" },
      { id: "type_decision_cyber", text: "Quel type d'arbitrage est en jeu ?", choices: ["Modèle d'accès (périmétrique vs zero trust)", "Gestion des identités (IAM/PAM)", "Détection & réponse (SOC, SIEM, EDR)", "Mise en conformité réglementaire ou contractuelle", "Autre"] },
      { id: "criticite_cyber", text: "Quelle est la criticité du périmètre (impact d'une compromission : opérationnel, financier, réputationnel) ?" },
      { id: "exposition", text: "Le périmètre est-il exposé à l'extérieur (Internet, partenaires, sous-traitants) ou strictement interne ?" },
      { id: "contraintes_conformite", text: "Des référentiels de conformité s'imposent-ils déjà (ISO 27001, SecNumCloud, NIS2, sectoriel) ?" },
    ],
    seedCriteria: [
      {
        label: "Réduction de la surface d'exposition",
        description: "Ce que la cible retire comme angles d'attaque exploitables.",
        importance: "Essentiel",
        children: [
          { label: "Segmentation effective", description: "Capacité à contenir une compromission à un périmètre restreint plutôt qu'à tout le SI.", importance: "Essentiel" },
          { label: "Exposition des accès externes", description: "Nombre et criticité des points d'accès exposés à l'extérieur.", importance: "Important" },
        ],
      },
      {
        label: "Détection et réponse",
        description: "Capacité à détecter un incident et à y répondre avant qu'il ne se propage.",
        importance: "Essentiel",
        children: [
          { label: "Délai de détection", description: "Temps réaliste avant qu'une activité anormale soit remarquée.", importance: "Essentiel" },
          { label: "Capacité de confinement", description: "Rapidité à isoler un composant compromis sans arrêter tout le système.", importance: "Important" },
        ],
      },
      {
        label: "Conformité démontrable",
        description: "Capacité à prouver le respect des obligations applicables lors d'un contrôle ou d'un incident.",
        importance: "Essentiel",
        children: [
          { label: "Couverture des référentiels applicables", description: "Part des exigences du référentiel visé effectivement couvertes par la cible.", importance: "Essentiel" },
          { label: "Traçabilité des accès", description: "Capacité à reconstituer qui a accédé à quoi et quand.", importance: "Important" },
        ],
      },
      {
        label: "Coût et frictions opérationnelles",
        description: "Ce que la cible de sécurité coûte à l'exploitation et à l'expérience des utilisateurs légitimes.",
        importance: "Important",
        children: [
          { label: "Charge d'administration des accès", description: "Effort récurrent pour gérer identités, droits et habilitations.", importance: "Important" },
          { label: "Friction pour l'utilisateur légitime", description: "Étapes supplémentaires imposées à un usage normal (authentification, validations).", importance: "Secondaire" },
        ],
      },
    ],
    expertContext: "Cadre de référence : NIST Cybersecurity Framework, ISO 27001, principes zero trust (jamais une confiance implicite fondée sur la seule localisation réseau), NIS2 pour les entités concernées. Ne jamais présenter la sécurité comme un absolu binaire (sécurisé/non sécurisé) : toujours faire ressortir le compromis entre réduction du risque et friction opérationnelle/coût, et distinguer clairement prévention (réduire la probabilité), détection (réduire le délai de découverte) et réponse (réduire l'impact) — trois leviers différents, jamais confondus.",
  },
];

export function getArchitecturePattern(id: string | undefined): ArchitecturePattern | undefined {
  return ARCHITECTURE_PATTERNS.find(p => p.id === id);
}
