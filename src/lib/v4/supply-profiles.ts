// Profils Supply Chain par type d'alerte : leviers, options (avec ce qu'elles font
// et leurs effets), indicateurs complémentaires et risques propres à la situation.
// Ils spécialisent le gabarit « Approvisionnement » (MOE → MOP → TPM) pour les
// alertes du Studio (S1 à S15) et de la couche d'intégration (INT-*), et pour les
// questions posées dans « Décider vite ».
import type { Fam, Template } from "./decision-templates";

type Opt = { label: string; does: string; impacts: Partial<Record<Fam, "++" | "+" | "+L" | "0" | "-L" | "-" | "--">> };
export interface SupplyProfile {
  id: string; label: string;
  /** Identifiants d'alerte (préfixes) et mots de la question qui déclenchent le profil. */
  alertIds: string[]; match: RegExp;
  levers: { label: string; options: Opt[] }[];
  tpms: { label: string; fam: Fam; why: string }[];
  risques: string[];
}
const o = (label: string, does: string, impacts: Opt["impacts"] = {}): Opt => ({ label, does, impacts });

export const SUPPLY_PROFILES: SupplyProfile[] = [
  { id: "appro", label: "Fournisseur", alertIds: ["S1", "S5", "S11", "INT-RISQUE", "RES-CONFIRM", "RES-MRP"], match: /capacit[e]? fournisseur|double sourcing|dual sourc|fournisseur unique|otif|qualite fournisseur|allocation|penurie|risque fournisseur|supplier risk/,
    levers: [
      { label: "Stratégie de sourcing", options: [o("Fournisseur unique actuel", "Garde le fournisseur en place."), o("Double sourcing sur les références critiques", "Qualifie un second fournisseur pour les pièces à risque.", { risque: "++", cout: "-", rapide: "-L" }), o("Accord-cadre avec engagement de capacité", "Réserve de la capacité contre un engagement de volume.", { risque: "+", cout: "-L" })] },
      { label: "Couverture de stock", options: [o("Couverture actuelle", "Garde le stock de sécurité tel qu'il est."), o("Stock tampon sur les références critiques", "Ajoute du stock seulement sur les pièces à risque.", { risque: "+", qualite: "+", cout: "-" })] },
      { label: "Pilotage fournisseur", options: [o("Revue mensuelle", "Fait le point une fois par mois."), o("Plan de progrès et suivi hebdomadaire", "Fixe des objectifs OTIF et suit les signaux chaque semaine.", { risque: "+L", qualite: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Taux OTIF fournisseur", fam: "qualite", why: "Livraisons complètes et à l'heure du fournisseur : premier signe de dérive." }],
    risques: ["Rupture chez les clients avant que le second fournisseur soit qualifié", "Surcoût d'achat durable", "Dépendance persistante au fournisseur en place"] },
  { id: "stock", label: "Stock", alertIds: ["S2", "S3", "INT-RUPTURE", "RES-RUPTURE", "RES-PROMESSE"], match: /rupture|couverture de stock|stock de securite|surstock|obsolescen|reassort|stockout|safety stock/,
    levers: [
      { label: "Réassort", options: [o("Réassort standard", "Suit le cycle de réapprovisionnement habituel."), o("Commande express au fournisseur", "Accélère une commande pour les références en rupture.", { rapide: "++", cout: "-" }), o("Transfert inter-sites", "Déplace du stock d'un site excédentaire vers le site en manque.", { rapide: "+", cout: "-L" })] },
      { label: "Stock de sécurité", options: [o("Niveau actuel", "Garde les seuils en place."), o("Seuils renforcés sur les références critiques", "Relève le stock de sécurité là où la rupture coûte le plus.", { risque: "+", cout: "-" }), o("Seuils dynamiques selon la saison", "Ajuste les seuils à la demande prévue.", { risque: "+", cout: "+L", faisab: "-L" })] },
      { label: "Allocation aux clients", options: [o("Premier arrivé, premier servi", "Sert les commandes dans l'ordre."), o("Priorité aux clients stratégiques", "Réserve le stock aux clients et canaux prioritaires.", { qualite: "+", croissance: "-L" })] },
    ],
    tpms: [{ label: "Couverture en jours", fam: "risque", why: "Nombre de jours de ventes que le stock disponible permet de servir." }, { label: "Valeur du stock immobilisé", fam: "cout", why: "Trésorerie bloquée dans le stock ; la hausser a un coût." }],
    risques: ["Rupture qui s'étend à d'autres sites", "Surstock et obsolescence après la crise", "Clients secondaires déçus par l'allocation"] },
  // Retard d'un fournisseur asiatique : flux Asie → Europe exposé à un détroit (mer Rouge, Bab el-Mandeb, Ormuz). Voir cas-detroits.ts.
  { id: "detroit", label: "Détroit maritime", alertIds: ["INT-RETARD-ASIE", "RES-GEO"], match: /mer rouge|detroit|suez|bab el ?mandeb|ormuz|hormuz|bonne esperance|asie ?(→|->|-)? ?europe/,
    levers: [
      { label: "Mode de transport", options: [o("Maritime seul", "Garde le transport maritime, le moins cher et le moins émetteur.", { cout: "+", env: "+" }), o("Mer-air sur les références critiques", "Accélère ce qui manque, avec un surcoût et plus d'émissions.", { rapide: "++", cout: "--", env: "--" }), o("Mer-rail par un corridor terrestre", "Réduit le délai et la dépendance au détroit, capacité limitée.", { rapide: "+", risque: "+", cout: "-L" })] },
      { label: "Couverture de stock", options: [o("Stock actuel", "Garde le stock de sécurité tel qu'il est."), o("Stock de sécurité renforcé en Europe", "Absorbe l'allongement du délai en immobilisant du capital.", { qualite: "++", cout: "-" })] },
      { label: "Sourcing", options: [o("Fournisseur asiatique actuel", "Garde le fournisseur en place."), o("Double sourcing ou nearshoring partiel en Europe", "Réduit durablement l'exposition au détroit ; qualification longue.", { risque: "++", rapide: "+", cout: "-L" })] },
      { label: "Fret et couverture", options: [o("Fret au taux spot", "Paie le prix du marché à chaque départ.", { cout: "-" }), o("Contrats de fret à taux et capacité garantis", "Stabilise le coût et réserve de la capacité.", { cout: "+", qualite: "+L" }), o("Assurance risque de guerre et clauses de force majeure", "Couvre le risque de transit, avec des primes en hausse.", { risque: "+", cout: "-" })] },
    ],
    tpms: [{ label: "Délai de transit Asie-Europe", fam: "rapide", why: "Jours entre le départ d'Asie et l'arrivée en Europe : premier effet d'un contournement." }, { label: "Coût de fret par conteneur", fam: "cout", why: "Le fret et les primes d'assurance montent quand un détroit est perturbé." }, { label: "Émissions de CO2 du transport", fam: "env", why: "Le contournement par le cap allonge la route et les émissions, en partie soumises à l'ETS." }],
    risques: ["Allongement durable des délais de transit", "Hausse du fret et des primes d'assurance", "Hausse des émissions et du coût carbone (ETS)", "Stock immobilisé sur des références qui ne tournent pas"] },
  // Crise sanitaire (pandémie) : pic de demande, amplification des commandes, ruptures, absentéisme. Voir cas-pandemie.ts.
  { id: "pandemie", label: "Crise sanitaire", alertIds: ["RES-PANDEMIE", "RES-BULLWHIP"], match: /pandemi|epidemi|crise sanitaire|confinement|absenteisme|bullwhip|coup de fouet/,
    levers: [
      { label: "Sourcing", options: [o("Sources actuelles", "Garde les fournisseurs en place."), o("Double sourcing dans une autre région", "Réduit le délai de reprise si une zone ferme.", { risque: "++", cout: "-", rapide: "-L" }), o("Bascule partielle vers une source proche", "Raccourcit la chaîne, capacité à confirmer.", { risque: "+", rapide: "+", cout: "-L" })] },
      { label: "Stock stratégique", options: [o("Stock actuel", "Garde le stock de sécurité tel qu'il est."), o("Stock tampon là où TTR > TTS", "Couvre l'écart entre délai de survie et délai de reprise.", { risque: "+", qualite: "+", cout: "-" })] },
      { label: "Pilotage de la demande", options: [o("Commandes au fil de l'eau", "Laisse passer les commandes telles qu'elles arrivent."), o("Plafonnement et allocation des commandes", "Limite l'effet coup de fouet et le surstock à la reprise.", { cout: "+", risque: "+", croissance: "-L" })] },
      { label: "Équipes", options: [o("Organisation actuelle", "Garde les équipes en place."), o("Polyvalence et plan de continuité", "Garde les postes critiques tenus malgré l'absentéisme.", { faisab: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Délai de survie des références critiques (TTS)", fam: "risque", why: "Jours de service avec le stock disponible et en transit : c'est ce que la crise consomme." }, { label: "Amplification des commandes", fam: "cout", why: "Commandes rapportées à la demande réelle : au-delà de 1, le surstock guette à la reprise." }, { label: "Postes critiques tenus", fam: "rapide", why: "Part des postes d'entrepôt et de transport couverts malgré l'absentéisme." }],
    risques: ["Rupture des références dont le délai de reprise dépasse le délai de survie", "Surcommandes puis surstock à la reprise", "Absentéisme qui bloque les expéditions", "Restrictions à l'export sur des composants"] },
  // Nœud critique (TTR > TTS) repéré par la vue Résilience. Voir resilience-tts.ts.
  { id: "resilience", label: "Nœud critique", alertIds: ["RES-TTS", "RES-UNIQUE"], match: /time to survive|time to recover|ttr ?> ?tts|delai de survie|delai de reprise|noeud critique/,
    levers: [
      { label: "Conception de l'article", options: [o("Article actuel", "Garde la nomenclature en place."), o("Composant standard proposé par plusieurs fournisseurs", "Supprime la dépendance à une pièce spécifique.", { risque: "+", faisab: "-L", rapide: "-" })] },
      { label: "Contrat avec la source actuelle", options: [o("Contrat actuel", "Garde les clauses en place."), o("Préavis d'arrêt et stock en consignation chez le fournisseur", "Allonge le délai de survie sans immobiliser le stock chez soi.", { risque: "+", cout: "-L" })] },
      { label: "Délai de reprise", options: [o("Délai actuel", "Accepte le délai de reprise estimé."), o("Préqualification et outillage en double", "Raccourcit la requalification d'une nouvelle source.", { rapide: "+", cout: "-L", faisab: "-L" })] },
    ],
    tpms: [{ label: "Écart TTR − TTS", fam: "risque", why: "Jours sans approvisionnement si le nœud tombe : l'objectif est de le ramener à zéro." }, { label: "Marge exposée", fam: "cout", why: "Marge perdue pendant l'écart, pondérée par le risque du fournisseur." }, { label: "Délai de reprise (TTR)", fam: "rapide", why: "Jours pour retrouver l'approvisionnement : déclaré ou estimé, à confirmer." }],
    risques: ["Rupture avant qu'une seconde source soit qualifiée", "Stock tampon immobilisé si le risque ne se réalise pas", "Délai de reprise sous-estimé"] },
  { id: "transport", label: "Transport", alertIds: ["S4", "S10", "INT-RETARD"], match: /retard transport|transport|expedition|logistique|noeud|entrepot bloque|route|fret|decarbon|shipment|delay/,
    levers: [
      { label: "Mode de transport", options: [o("Mode actuel (maritime)", "Garde le mode en place."), o("Bascule en aérien sur les urgences", "Transporte par avion les seules références critiques.", { rapide: "++", cout: "--", env: "--" }), o("Ferroviaire ou multimodal", "Passe par le rail quand l'axe le permet.", { rapide: "-L", cout: "+L", env: "++" })] },
      { label: "Routage", options: [o("Itinéraire actuel", "Garde les hubs en place."), o("Hub alternatif", "Contourne le point bloqué par un autre hub.", { rapide: "+", cout: "-L", risque: "+" }), o("Cross-dock direct client", "Livre sans passer par l'entrepôt central.", { rapide: "+", faisab: "-L" })] },
      { label: "Priorisation des commandes", options: [o("Ordre d'arrivée", "Traite les expéditions dans l'ordre."), o("Priorité aux commandes à forte pénalité", "Sert d'abord les commandes les plus exposées.", { qualite: "+", croissance: "-L" })] },
    ],
    tpms: [{ label: "Coût de transport", fam: "cout", why: "Coût par envoi : l'accélération se paie ici." }, { label: "Émissions du transport", fam: "env", why: "CO₂ émis par le mode choisi ; engagement de décarbonation." }, { label: "Délai de transit", fam: "risque", why: "Jours entre l'enlèvement et l'arrivée : c'est ce que le retard allonge." }],
    risques: ["Retard qui se propage à la production", "Surcoût transport non répercuté", "Hausse des émissions contraire aux engagements"] },
  { id: "prevision", label: "Prévision", alertIds: ["S6"], match: /prevision|demande en derive|s ?& ?op|sop|forecast|planification de la demande/,
    levers: [
      { label: "Méthode de prévision", options: [o("Modèle statistique actuel", "Garde la prévision en place."), o("Prévision collaborative avec le commerce", "Intègre les promotions et signaux des ventes.", { qualite: "+", faisab: "-L" }), o("Correction manuelle encadrée", "Autorise un ajustement documenté sur les écarts connus.", { rapide: "+", risque: "-L" })] },
      { label: "Rythme S&OP", options: [o("Revue mensuelle", "Aligne demande et approvisionnement chaque mois."), o("Revue hebdomadaire en période de promotion", "Resserre la boucle quand la demande bouge.", { rapide: "+", faisab: "-L" })] },
      { label: "Tampon de sécurité", options: [o("Tampon actuel", "Garde le stock de sécurité."), o("Tampon renforcé pendant la promotion", "Ajoute du stock le temps de l'écart.", { risque: "+", cout: "-" })] },
    ],
    tpms: [{ label: "Biais de prévision", fam: "qualite", why: "Écart systématique entre prévu et réel : il fausse toutes les décisions aval." }, { label: "Stock en fin de promotion", fam: "cout", why: "Ce qui reste invendu si la demande est surestimée." }, { label: "Précision de la prévision", fam: "risque", why: "Écart moyen entre prévu et vendu, article par article." }],
    risques: ["Surstock si la promotion déçoit", "Rupture si l'écart est sous-estimé", "Perte de confiance des équipes dans la prévision"] },
  { id: "capacite", label: "Capacité", alertIds: ["S7"], match: /capacite insuffisante|capacite de production|sous[- ]traitan|heures sup|charge|goulot/,
    levers: [
      { label: "Capacité interne", options: [o("Capacité actuelle", "Garde l'organisation en place."), o("Heures supplémentaires", "Ajoute des heures sur les postes goulots.", { rapide: "+", cout: "-" }), o("Équipe supplémentaire", "Ouvre une équipe de plus.", { croissance: "+", cout: "--", faisab: "-" })] },
      { label: "Sous-traitance", options: [o("Aucune", "Produit tout en interne."), o("Sous-traitance partielle", "Confie une partie des volumes à un partenaire.", { rapide: "+", qualite: "-L", cout: "-L" })] },
      { label: "Lissage de la charge", options: [o("Aucun lissage", "Suit la demande telle qu'elle arrive."), o("Lissage et report négocié", "Décale les commandes non urgentes.", { cout: "+", qualite: "-L" })] },
    ],
    tpms: [{ label: "Taux d'utilisation", fam: "croissance", why: "Part de la capacité réellement utilisée ; au-delà de 90 %, les retards montent." }],
    risques: ["Épuisement des équipes", "Qualité dégradée chez le sous-traitant", "Clients mécontents des reports"] },
  { id: "marge", label: "Coûts", alertIds: ["S8"], match: /marge|cout supply|inflation|prix d achat|renegoci/,
    levers: [
      { label: "Prix de vente", options: [o("Prix maintenus", "Absorbe la hausse."), o("Répercussion partielle", "Répercute une partie de la hausse aux clients.", { cout: "+", croissance: "-L" })] },
      { label: "Sourcing", options: [o("Fournisseurs actuels", "Garde le panel."), o("Renégociation", "Rouvre les prix avec les fournisseurs clés.", { cout: "+L", rapide: "-L" }), o("Resourcing vers un autre pays", "Qualifie un fournisseur moins cher.", { cout: "+", risque: "-L", rapide: "-" })] },
      { label: "Conception", options: [o("Conception actuelle", "Garde les nomenclatures."), o("Analyse de la valeur", "Simplifie ou substitue des composants coûteux.", { cout: "+", faisab: "-L" })] },
    ],
    tpms: [{ label: "Marge brute", fam: "cout", why: "Ce qui reste après le coût des produits : c'est l'enjeu de l'alerte." }],
    risques: ["Perte de clients sensibles au prix", "Qualité en baisse avec un nouveau fournisseur", "Délais d'homologation plus longs que prévu"] },
  { id: "geo", label: "Géopolitique", alertIds: ["S9"], match: /geopolit|pays|douane|sanction|nearshor|relocalis|reshor|droits de douane/,
    levers: [
      { label: "Localisation de l'approvisionnement", options: [o("Pays actuel", "Garde l'origine en place."), o("Nearshoring", "Rapproche une part de l'approvisionnement.", { risque: "++", cout: "-", env: "+" }), o("Deux pays d'origine", "Répartit les volumes entre deux pays.", { risque: "+", cout: "-L" })] },
      { label: "Stock stratégique", options: [o("Aucun", "Pas de stock dédié."), o("Stock stratégique sur les composants exposés", "Constitue quelques semaines de couverture.", { risque: "+", cout: "-" })] },
      { label: "Couverture contractuelle", options: [o("Aucune", "Supporte le risque."), o("Clauses et assurance", "Protège par contrat et assurance crédit.", { risque: "+L", cout: "-L" })] },
    ],
    tpms: [{ label: "Exposition pays", fam: "risque", why: "Part des achats venant de pays à risque élevé." }],
    risques: ["Hausse durable des coûts en Europe", "Transition plus longue que la crise", "Nouvelle sanction avant la bascule"] },
  { id: "reseau", label: "Réseau logistique", alertIds: ["S14"], match: /reseau|entrepot|wms|tms|3pl|hub regional|schema directeur logistique/,
    levers: [
      { label: "Entrepôts", options: [o("Réseau actuel", "Garde les sites."), o("Hub régional supplémentaire", "Ouvre un entrepôt au plus près des clients.", { rapide: "+", cout: "-", env: "+L" }), o("Consolidation des sites", "Regroupe les petits entrepôts.", { cout: "+", rapide: "-L" })] },
      { label: "Exploitation", options: [o("En propre", "Opère les entrepôts en interne."), o("Prestataire logistique (3PL)", "Confie l'exploitation à un spécialiste.", { faisab: "+", cout: "-L", flex: "+" })] },
      { label: "Outil de pilotage", options: [o("Outil actuel", "Garde les applications en place."), o("Nouveau WMS/TMS", "Remplace l'outil par une solution du marché.", { qualite: "+", faisab: "-", cout: "-" })] },
    ],
    tpms: [{ label: "Coût logistique total", fam: "cout", why: "Stockage, transport et manutention réunis." }],
    risques: ["Perturbation pendant la bascule", "Dépendance au prestataire", "Projet outil plus long que prévu"] },
  { id: "produit", label: "Changement produit", alertIds: ["S12"], match: /nomenclature|changement produit|phase[- ]in|phase[- ]out|last buy|fin de vie/,
    levers: [
      { label: "Bascule", options: [o("Bascule progressive (phase-in/out)", "Remplace l'ancien produit au fil des stocks."), o("Double production temporaire", "Produit les deux versions le temps de la transition.", { risque: "+", cout: "-" }), o("Dernier achat (last buy)", "Constitue un stock final de l'ancien composant.", { risque: "+", cout: "-" })] },
      { label: "Qualification", options: [o("Qualification standard", "Suit le processus habituel."), o("Qualification accélérée", "Met des moyens pour qualifier plus vite.", { rapide: "+", cout: "-L" })] },
      { label: "Stock de l'ancienne version", options: [o("Écoulement", "Vend l'ancien stock."), o("Retouche (rework)", "Met à jour l'ancien stock.", { cout: "+L", faisab: "-L" })] },
    ],
    tpms: [{ label: "Stock obsolète", fam: "cout", why: "Ancienne version qui ne pourra plus être vendue." }],
    risques: ["Stock obsolète à déprécier", "Non-conformité pendant la transition", "Lancement décalé"] },
  { id: "donnees", label: "Données", alertIds: ["S13", "INT-ECART"], match: /donnee incoherente|donnees? supply|ecart entre sources|golden|maitre|qualite des donnees|divergen/,
    levers: [
      { label: "Source de référence", options: [o("Application maître déclarée", "La valeur du maître fait foi."), o("Source la plus récente", "Retient la valeur la plus fraîche.", { rapide: "+", risque: "-L" })] },
      { label: "Correction", options: [o("Correction dans la source", "Corrige l'erreur là où elle naît.", { qualite: "++", rapide: "-L" }), o("Correction dans Aura en attendant", "Aligne sur le maître côté Aura et signale l'écart.", { rapide: "+", qualite: "+L" })] },
      { label: "Validation", options: [o("Automatique sous la tolérance", "Accepte les écarts de forme."), o("Validation humaine des écarts de fond", "Un référent tranche chaque écart de fond.", { qualite: "+", rapide: "-L" })] },
    ],
    tpms: [{ label: "Taux de données cohérentes", fam: "qualite", why: "Part des objets dont les sources concordent avec le maître." }],
    risques: ["Décision prise sur une donnée fausse", "Correction qui ne tient pas dans la source", "Charge de validation trop lourde"] },
  { id: "si", label: "Système d'information", alertIds: ["S15", "STRAT-SI"], match: /transformation si|erp|migration|architecture si|big bang/,
    levers: [
      { label: "Architecture", options: [o("Existant maintenu", "Garde les applications en place."), o("Architecture modulaire", "Découpe par domaine avec des API.", { flex: "+", faisab: "-L" })] },
      { label: "Séquence", options: [o("Bascule en une fois", "Passe tout le monde le même jour."), o("Déploiement par lots", "Déploie domaine par domaine.", { risque: "+", rapide: "-L" })] },
      { label: "Accompagnement", options: [o("Équipe interne", "Mène le projet en interne."), o("Intégrateur partenaire", "S'appuie sur un partenaire.", { risque: "+", cout: "-" })] },
    ],
    tpms: [{ label: "Continuité des opérations", fam: "risque", why: "Capacité à livrer pendant la transformation." }],
    risques: ["Rupture d'activité à la bascule", "Dérive du projet", "Données mal migrées"] },
  // Qualité et certification fournisseur (QMS, SRM) : lots refusés, certificats échus.
  { id: "qualite", label: "Qualité fournisseur", alertIds: ["RES-QUALITE", "RES-CERTIF"], match: /lots? refuses?|non.?conformit|certificat|certification|qualite fournisseur|controle qualite/,
    levers: [
      { label: "Contrôle", options: [o("Contrôle actuel", "Garde le plan de contrôle en place."), o("Inspection renforcée à réception", "Contrôle tous les lots du fournisseur jusqu'au retour à la normale.", { qualite: "++", cout: "-", rapide: "-L" })] },
      { label: "Fournisseur", options: [o("Suivi habituel", "Revue mensuelle du fournisseur."), o("Plan correctif avec échéances", "Exige un plan d'actions daté et un audit.", { qualite: "+", faisab: "-L" }), o("Réallocation vers une autre source", "Transfère une partie des volumes.", { risque: "+", cout: "-L", rapide: "-L" })] },
      { label: "Certification", options: [o("Échéance suivie", "Laisse le fournisseur renouveler."), o("Relance et audit avant échéance", "Anticipe le renouvellement du certificat.", { risque: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Taux de lots refusés", fam: "qualite", why: "Part des lots refusés à réception : premier signe de dérive qualité." }, { label: "Certificats à jour", fam: "risque", why: "Fournisseurs actifs dont les certificats sont valides." }],
    risques: ["Livraisons bloquées faute de certificat", "Non-conformités chez les clients", "Coût du contrôle renforcé"] },
  // Stock immobilisé (BFR) : couverture excédentaire et coût de portage.
  { id: "bfr", label: "Stock immobilisé", alertIds: ["RES-BFR"], match: /stock immobilise|bfr|couverture excedentaire|cout de portage|working capital/,
    levers: [
      { label: "Commandes", options: [o("Commandes au plan", "Garde le plan d'approvisionnement."), o("Arrêt ou report des commandes", "Laisse le stock s'écouler avant de recommander.", { cout: "++", risque: "-L" })] },
      { label: "Écoulement", options: [o("Écoulement naturel", "Attend la demande."), o("Transfert inter-sites", "Déplace le stock là où il manque.", { cout: "+", rapide: "+" }), o("Promotion ciblée", "Accélère l'écoulement au prix d'une remise.", { cout: "+L", croissance: "+" })] },
      { label: "Paramètres", options: [o("Couverture cible actuelle", "Garde la cible de couverture."), o("Couverture cible par segment", "Ajuste la cible à la rotation de chaque article.", { cout: "+", faisab: "-L" })] },
    ],
    tpms: [{ label: "Stock immobilisé", fam: "cout", why: "Valeur du stock au-delà de la couverture cible (BFR)." }, { label: "Coût de portage annuel", fam: "cout", why: "Coût financier et physique de ce stock chaque année." }],
    risques: ["Rupture si la demande repart", "Obsolescence", "Remises qui dégradent la marge"] },
  // Rappel produit : lot non conforme déjà livré.
  { id: "rappel", label: "Rappel produit", alertIds: ["RES-RAPPEL"], match: /rappel|lot non conforme|lot refuse|tracabilite|recall/,
    levers: [
      { label: "Rappel", options: [o("Analyse avant décision", "Analyse le lot avant d'informer."), o("Rappel ciblé des clients exposés", "Contacte les seuls clients qui ont reçu le lot.", { risque: "++", cout: "-", qualite: "+" }), o("Information sans rappel", "Informe les clients et propose un échange.", { cout: "+L", risque: "-L" })] },
      { label: "Stock restant", options: [o("Stock disponible", "Laisse le stock du lot en vente."), o("Blocage du stock du lot", "Bloque les unités restantes du lot.", { risque: "+", cout: "-L" })] },
      { label: "Fournisseur", options: [o("Réclamation standard", "Réclamation qualité habituelle."), o("Refacturation et plan correctif", "Refacture le coût et exige un plan d'actions.", { cout: "+", faisab: "-L" })] },
    ],
    tpms: [{ label: "Clients exposés", fam: "risque", why: "Clients qui ont reçu le lot non conforme." }, { label: "Coût du rappel", fam: "cout", why: "Valeur livrée et coût de reprise." }],
    risques: ["Risque d'image", "Coût de reprise supérieur à l'estimation", "Lot déjà consommé"] },
  // Devoir de vigilance (CSRD, loi française) : évaluation ESG.
  { id: "vigilance", label: "Vigilance fournisseurs", alertIds: ["RES-ESG"], match: /vigilance|esg|csrd|rse|devoir de vigilance/,
    levers: [
      { label: "Clauses contractuelles", options: [o("Contrat actuel", "Garde les clauses en place."), o("Clause de vigilance et droit d'audit", "Permet d'auditer et d'exiger des corrections.", { risque: "+", faisab: "-L" })] },
      { label: "Traçabilité", options: [o("Fournisseurs de rang 1", "Connaît les fournisseurs directs."), o("Traçabilité jusqu'aux matières (rang 2 et au-delà)", "Repère les risques en amont.", { risque: "+", cout: "-L" })] },
      { label: "Certification exigée", options: [o("Aucune exigence", "Pas de certificat demandé."), o("ISO 14001, ISO 45001 ou SA8000 au renouvellement", "Aligne l'exigence sur les certificats suivis dans le SRM.", { risque: "+", faisab: "-L" })] },
    ],
    tpms: [{ label: "Fournisseurs évalués (ESG)", fam: "risque", why: "Part des fournisseurs actifs avec une évaluation ESG à jour." }],
    risques: ["Point de vigilance lors d'un contrôle", "Dépendance à un fournisseur non évalué"] },
  // Défaillance financière d'un fournisseur : leviers distincts des options de la règle (sourcing, tampon, accord-cadre).
  { id: "finance", label: "Santé financière fournisseur", alertIds: ["RES-FINANCE"], match: /$^/,
    levers: [
      { label: "Conditions de paiement", options: [o("Conditions actuelles", "Garde les délais et acomptes en place."), o("Paiement à réception, sans acompte", "Limite ce qui serait perdu en cas de défaillance.", { risque: "+", faisab: "-L" }), o("Paiement accéléré contre engagement de capacité", "Soutient la trésorerie du fournisseur.", { risque: "+L", cout: "-L" })] },
      { label: "Surveillance", options: [o("Suivi actuel", "Garde le rythme de revue en place."), o("Alerte sur chaque nouvelle évaluation financière", "Réagit dès que le score se dégrade.", { risque: "+", cout: "-L" })] },
      { label: "Plan de continuité", options: [o("Pas de plan formalisé", "Aucune disposition en cas d'arrêt."), o("Clause de reprise des outillages et des données", "Permet de transférer la production si le fournisseur s'arrête.", { risque: "+", faisab: "-L" })] },
    ],
    tpms: [{ label: "Valeur des commandes ouvertes chez le fournisseur", fam: "risque", why: "Ce qui serait bloqué si le fournisseur s'arrête." }, { label: "Taux OTIF fournisseur", fam: "qualite", why: "Les retards précèdent souvent la défaillance." }],
    risques: ["Arrêt brutal des livraisons", "Acomptes perdus", "Transfert de production plus long que prévu"] },
  // Congestion portuaire ou grève : leviers distincts des options de la règle (hub, aérien, priorisation, attente).
  { id: "port", label: "Port congestionné", alertIds: ["RES-PORT"], match: /$^/,
    levers: [
      { label: "Port d'arrivée des prochains départs", options: [o("Port actuel", "Garde le port prévu."), o("Port de repli déjà desservi par le transporteur", "Évite la file d'attente sur les départs suivants.", { rapide: "+", cout: "-L" })] },
      { label: "Stock en aval", options: [o("Stock du site", "Sert depuis le stock local."), o("Prélèvement sur le stock des autres sites", "Couvre les articles à faible couverture.", { qualite: "+", cout: "-L" })] },
      { label: "Information des clients", options: [o("Aucune information", "Attend la livraison."), o("Prévenir les clients des commandes retardées", "Réduit les pénalités et les annulations.", { qualite: "+L" })] },
    ],
    tpms: [{ label: "Délai de transit", fam: "rapide", why: "Jours d'attente ajoutés au transport." }, { label: "Coût de transport", fam: "cout", why: "Surcoût du changement de port ou de mode." }],
    risques: ["Congestion qui se déplace au port de repli", "Surcoût d'aérien", "Pénalités clients"] },
  // Durabilité et autonomie stratégique (règles sur valeurs lues : classe ABC, part pays, DDS EUDR, cumul CBAM).
  { id: "mono-a", label: "Article A mono-source", alertIds: ["RES-MONO-A"], match: /$^/,
    levers: [
      { label: "Contrat fournisseur", options: [o("Contrat actuel", "Garde les conditions en place."), o("Clause de continuité et préavis d'arrêt", "Oblige le fournisseur à prévenir et à aider au transfert.", { risque: "+", faisab: "-L" })] },
      { label: "Conception", options: [o("Référence actuelle", "Garde la pièce telle qu'elle est."), o("Standardiser la pièce pour l'ouvrir à d'autres fournisseurs", "Élargit le panel possible.", { risque: "+L", cout: "-L" })] },
      { label: "Suivi", options: [o("Revue annuelle", "Fait le point une fois par an."), o("Revue trimestrielle des articles A mono-source", "Suit la dépendance au fil de l'eau.", { risque: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Articles A à source unique", fam: "risque", why: "Nombre d'articles de classe A qui n'ont qu'une source active." }, { label: "Délai de qualification d'une source", fam: "rapide", why: "Temps pour qu'une seconde source livre." }],
    risques: ["Arrêt d'un article A avant qualification d'une autre source", "Surcoût d'une seconde source", "Dépendance persistante"] },
  { id: "concentration-pays", label: "Concentration pays", alertIds: ["RES-PAYS"], match: /$^/,
    levers: [
      { label: "Transport et douane", options: [o("Incoterm actuel", "Garde les conditions de livraison."), o("Incoterm et itinéraire de repli préparés", "Permet de changer d'itinéraire vite.", { rapide: "+", cout: "-L" })] },
      { label: "Veille pays", options: [o("Pas de veille dédiée", "Réagit aux évènements."), o("Veille géopolitique et douanière mensuelle", "Anticipe sanctions et droits.", { risque: "+", cout: "-L" })] },
      { label: "Contrats", options: [o("Commandes au fil de l'eau", "Garde la liberté de commande."), o("Accords-cadres avec des fournisseurs d'autres pays", "Réserve une capacité hors du pays dominant.", { risque: "+", cout: "-" })] },
    ],
    tpms: [{ label: "Part du premier pays dans les achats de la famille", fam: "risque", why: "Part lue dans l'analyse des dépenses." }, { label: "Coût complet d'achat", fam: "cout", why: "Surcoût d'une origine alternative." }],
    risques: ["Crise ou sanction dans le pays dominant", "Hausse des droits de douane", "Surcoût de la diversification"] },
  { id: "eudr", label: "Diligence raisonnable EUDR", alertIds: ["RES-EUDR"], match: /$^/,
    levers: [
      { label: "Collecte des preuves", options: [o("Demande ponctuelle", "Demande la DDS au cas par cas."), o("Portail fournisseur avec géolocalisation obligatoire", "Collecte DDS et parcelles avant chaque commande.", { risque: "+", faisab: "-L" })] },
      { label: "Clauses d'achat", options: [o("Conditions actuelles", "Garde les conditions d'achat."), o("Clause EUDR et blocage de commande sans DDS", "Empêche d'acheter une matière non documentée.", { risque: "++", faisab: "-L" })] },
      { label: "Pilotage", options: [o("Suivi par les achats", "Les acheteurs suivent seuls."), o("Revue hebdomadaire jusqu'au 30/12/2026", "Priorise les articles sans DDS avant l'échéance.", { rapide: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Articles visés sans DDS", fam: "risque", why: "Articles qui ne pourront pas être mis sur le marché." }, { label: "Jours avant l'échéance EUDR", fam: "rapide", why: "Temps restant avant le 30/12/2026." }],
    risques: ["Blocage de mise sur le marché", "Sanctions et saisie", "Fournisseur incapable de géolocaliser"] },
  { id: "cbam", label: "Seuil CBAM", alertIds: ["RES-CBAM"], match: /$^/,
    levers: [
      { label: "Données d'émissions", options: [o("Valeurs par défaut", "Utilise les valeurs par défaut de la Commission."), o("Émissions réelles déclarées par les fournisseurs", "Évite des valeurs par défaut pénalisantes.", { cout: "+", faisab: "-L" })] },
      { label: "Organisation", options: [o("Déclarant en douane actuel", "Laisse le transitaire gérer."), o("Référent CBAM interne et outil de suivi", "Suit le cumul et prépare les déclarations.", { risque: "+", cout: "-L" })] },
      { label: "Achats", options: [o("Origine actuelle", "Garde les pays d'origine."), o("Préférer des fournisseurs à faible intensité carbone", "Réduit le coût des certificats.", { env: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Cumul annuel des biens CBAM (t)", fam: "risque", why: "Cumul lu dans l'outil douane, comparé au seuil de 50 t." }, { label: "Coût des certificats CBAM", fam: "cout", why: "Coût si le seuil est dépassé." }],
    risques: ["Sortie du régime de minimis en cours d'année", "Déclaration non préparée", "Coût carbone répercuté sur la marge"] },
  // Décisions stratégiques et d'investissement (hors alertes, strategic-decisions.ts) :
  // choisies par leur identifiant seulement (motif vide), effets « à confirmer ».
  { id: "strat-entrepot", label: "Entrepôt ou hub", alertIds: ["STRAT-ENTREPOT"], match: /$^/,
    levers: [
      { label: "Emplacement", options: [o("Près des clients", "Raccourcit le dernier kilomètre.", { rapide: "+", cout: "-L" }), o("Près des ports ou des fournisseurs", "Réduit le transport amont.", { cout: "+L", rapide: "-L" }), o("Site existant agrandi", "Évite un nouveau bail.", { faisab: "+", flex: "-L" })] },
      { label: "Exploitation", options: [o("En propre", "Opère le site en interne."), o("Prestataire logistique (3PL)", "Confie l'exploitation à un spécialiste.", { faisab: "+", flex: "+", cout: "-L" })] },
      { label: "Calendrier", options: [o("Bascule en une fois", "Change tout à une date.", { rapide: "+", risque: "-" }), o("Bascule progressive par région", "Limite le risque de perturbation.", { risque: "+", rapide: "-L" })] },
    ],
    tpms: [{ label: "Coût logistique total", fam: "cout", why: "Loyer, personnel, transport et manutention réunis." }, { label: "Taux de service client", fam: "qualite", why: "Commandes livrées complètes et à l'heure." }, { label: "Émissions du transport", fam: "env", why: "Kilomètres parcourus selon l'emplacement des sites." }],
    risques: ["Perturbation du service pendant la bascule", "Coût de fermeture (bail, personnel) sous-estimé", "Capacité mal dimensionnée pour la croissance"] },
  { id: "strat-reseau", label: "Réseau logistique", alertIds: ["STRAT-RESEAU"], match: /$^/,
    levers: [
      { label: "Nombre de sites", options: [o("Un entrepôt central", "Mutualise le stock.", { cout: "+", rapide: "-" }), o("Deux ou trois entrepôts régionaux", "Rapproche le stock des clients.", { rapide: "+", cout: "-L" })] },
      { label: "Flux", options: [o("Livraison depuis stock", "Stocke puis expédie."), o("Cross-dock", "Recompose les flux sans stocker.", { cout: "+L", risque: "-L" }), o("Livraison directe fournisseur", "Expédie du fournisseur au client.", { cout: "+", qualite: "-L" })] },
      { label: "Transport", options: [o("Route", "Souple et rapide."), o("Rail ou fluvial sur les grands axes", "Moins cher et moins émetteur, moins souple.", { env: "++", cout: "+L", flex: "-" })] },
    ],
    tpms: [{ label: "Délai de livraison client", fam: "rapide", why: "Jours entre commande et livraison." }, { label: "Stock total du réseau", fam: "cout", why: "Plus de sites, plus de stock de sécurité." }, { label: "Résilience du réseau", fam: "risque", why: "Capacité à servir si un site s'arrête." }],
    risques: ["Hypothèses de coûts de transport à confirmer", "Stock dispersé sur trop de sites", "Dépendance à un seul site central"] },
  { id: "strat-3pl", label: "Faire ou faire faire", alertIds: ["STRAT-3PL"], match: /$^/,
    levers: [
      { label: "Périmètre externalisé", options: [o("Tout le stockage et la préparation", "Le prestataire opère l'ensemble.", { flex: "+", faisab: "+" }), o("E-commerce seulement", "Garde le magasin en propre.", { flex: "+L" }), o("Pics saisonniers seulement", "Absorbe les pointes.", { flex: "+", cout: "+L" })] },
      { label: "Contrat", options: [o("Prix à l'activité", "Paie au colis ou à la palette.", { flex: "+", cout: "-L" }), o("Forfait et engagement de volume", "Stabilise le coût.", { cout: "+L", flex: "-" })] },
      { label: "Pilotage", options: [o("Indicateurs contractuels mensuels", "Suit le service chaque mois."), o("Accès aux données en temps réel", "Voit stock et commandes en direct.", { qualite: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Coût par commande préparée", fam: "cout", why: "Coût complet d'une commande sortie." }, { label: "Qualité de préparation", fam: "qualite", why: "Erreurs et casse à la préparation." }, { label: "Flexibilité en pic", fam: "flex", why: "Volume absorbable en haute saison." }],
    risques: ["Dépendance au prestataire", "Perte de savoir-faire interne", "Coût de sortie du contrat"] },
  { id: "strat-transport", label: "Transporteurs et modes", alertIds: ["STRAT-TRANSPORT"], match: /$^/,
    levers: [
      { label: "Mode", options: [o("Maritime", "Le moins cher et le moins émetteur, lent.", { cout: "+", env: "+", rapide: "-" }), o("Aérien sur les urgences", "Rapide, cher et émetteur.", { rapide: "++", cout: "--", env: "--" }), o("Rail", "Entre les deux.", { env: "+", rapide: "+L" })] },
      { label: "Contrats", options: [o("Taux spot", "Paie le prix du marché.", { cout: "-L", flex: "+" }), o("Contrats annuels à capacité garantie", "Réserve de la capacité.", { risque: "+", cout: "+L" })] },
      { label: "Nombre de transporteurs", options: [o("Un transporteur principal", "Simplifie et négocie mieux.", { cout: "+", risque: "-" }), o("Deux ou trois transporteurs par axe", "Garde une solution de repli.", { risque: "+", cout: "-L" })] },
    ],
    tpms: [{ label: "Coût de transport par unité", fam: "cout", why: "Fret rapporté aux unités transportées." }, { label: "Émissions du transport", fam: "env", why: "Selon le mode choisi." }, { label: "Dépendance à un transporteur", fam: "risque", why: "Part des volumes chez le premier transporteur." }],
    risques: ["Hausse du fret en période de crise", "Capacité refusée au taux spot", "Émissions en hausse avec l'aérien"] },
  { id: "strat-nearshoring", label: "Relocalisation", alertIds: ["STRAT-NEARSHORING"], match: /$^/,
    levers: [
      { label: "Périmètre", options: [o("Références critiques seulement", "Relocalise ce dont la rupture coûte le plus.", { risque: "+", cout: "-L" }), o("Une gamme entière", "Relocalise toute une famille.", { risque: "++", cout: "-" })] },
      { label: "Région", options: [o("Europe du Sud", "Proche des marchés européens ; coûts à confirmer.", { rapide: "+", cout: "-L" }), o("Afrique du Nord", "Proche ; coûts et capacités à confirmer.", { rapide: "+" }), o("Europe de l'Est", "Proche ; coûts et capacités à confirmer.", { rapide: "+" })] },
      { label: "Transition", options: [o("Qualification en parallèle", "Garde la source actuelle pendant la qualification.", { risque: "+", cout: "-L" }), o("Bascule directe", "Plus rapide, plus risqué.", { rapide: "+", risque: "-" })] },
    ],
    tpms: [{ label: "Coût de revient rendu", fam: "cout", why: "Achat, transport, droits et stock réunis." }, { label: "Délai d'approvisionnement", fam: "rapide", why: "Jours entre commande et réception." }, { label: "Émissions du transport amont", fam: "env", why: "Distance parcourue par les marchandises." }],
    risques: ["Qualité à requalifier", "Capacité insuffisante chez les nouveaux fournisseurs", "Hausse durable du coût d'achat"] },
  { id: "strat-stock-secu", label: "Stocks de sécurité", alertIds: ["STRAT-STOCK-SECU"], match: /$^/,
    levers: [
      { label: "Méthode", options: [o("Jours de couverture fixes", "Même règle pour tous.", { faisab: "+" }), o("Selon la variabilité de la demande et du délai", "Dimensionne article par article.", { qualite: "+", faisab: "-L" })] },
      { label: "Segmentation", options: [o("Toutes les références", "Un seul niveau."), o("Par classe ABC", "Plus de stock sur ce qui compte.", { qualite: "+", cout: "+L" }), o("Selon l'écart TTR − TTS", "Couvre les nœuds critiques.", { risque: "+", cout: "-L" })] },
      { label: "Emplacement", options: [o("Entrepôt central", "Mutualise le stock.", { cout: "+" }), o("Au plus près des clients", "Sert plus vite.", { rapide: "+", cout: "-" })] },
    ],
    tpms: [{ label: "Valeur du stock immobilisé", fam: "cout", why: "Trésorerie bloquée dans le stock." }, { label: "Stock obsolète", fam: "cout", why: "Stock qui ne tournera plus." }],
    risques: ["Surstock et obsolescence", "Rupture sur les références mal classées", "Paramètres non mis à jour"] },
  { id: "strat-automatisation", label: "Automatisation d'entrepôt", alertIds: ["STRAT-AUTOMATISATION"], match: /$^/,
    levers: [
      { label: "Degré", options: [o("Convoyeurs et tri", "Automatise les flux simples.", { cout: "-L", faisab: "+" }), o("Stockage automatisé", "Gagne de la place et de la productivité.", { qualite: "+", cout: "-" }), o("Robots mobiles", "Évolutif, se déplace avec les besoins.", { flex: "+", cout: "-" })] },
      { label: "Financement", options: [o("Achat", "Investit en une fois.", { cout: "-" }), o("Location ou robotique à l'usage", "Paie au volume.", { flex: "+", cout: "-L" })] },
      { label: "Déploiement", options: [o("Un site pilote", "Teste avant de généraliser.", { risque: "+", rapide: "-L" }), o("Tous les sites", "Gagne vite à grande échelle.", { rapide: "+", risque: "-" })] },
    ],
    tpms: [{ label: "Retour sur investissement", fam: "cout", why: "Années pour rembourser l'investissement." }, { label: "Capacité en pic", fam: "flex", why: "Volume maximal préparé par jour." }, { label: "Conditions de travail", fam: "qualite", why: "Pénibilité et accidents." }],
    risques: ["Volume insuffisant pour rentabiliser", "Panne qui arrête le site", "Conduite du changement des équipes"] },
  { id: "strat-sop", label: "S&OP", alertIds: ["STRAT-SOP"], match: /$^/,
    levers: [
      { label: "Rythme", options: [o("Mensuel", "Le rythme courant."), o("Hebdomadaire", "Réagit plus vite.", { rapide: "+", faisab: "-L" })] },
      { label: "Horizon", options: [o("3 mois", "Pilote le court terme.", { rapide: "+" }), o("12 mois", "Anticipe capacités et achats.", { risque: "+" }), o("18 à 24 mois", "Prépare les investissements.", { croissance: "+", faisab: "-L" })] },
      { label: "Participants", options: [o("Supply et ventes", "Le cœur du S&OP."), o("Avec finance et fournisseurs clés", "Aligne budget et capacités.", { qualite: "+", faisab: "-L" })] },
    ],
    tpms: [{ label: "Décisions S&OP appliquées", fam: "qualite", why: "Part des arbitrages du S&OP réellement suivis d'effet." }, { label: "Temps passé en réunion", fam: "faisab", why: "Charge du processus pour les équipes." }, { label: "Amplification des commandes", fam: "cout", why: "Commandes rapportées à la demande." }],
    risques: ["Processus lourd abandonné", "Décisions non suivies d'effet", "Données de prévision peu fiables"] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ");

export function supplyProfileFor(alertId?: string, text = ""): SupplyProfile | undefined {
  if (alertId) { const p = SUPPLY_PROFILES.find(x => x.alertIds.some(a => alertId === a || alertId.startsWith(`${a}-`))); if (p) return p; }
  const n = norm(text);
  let best: SupplyProfile | undefined, score = 0;
  for (const p of SUPPLY_PROFILES) { const m = n.match(new RegExp(p.match.source, "g")); if (m && m.length > score) { best = p; score = m.length; } }
  return best;
}

/** Gabarit Approvisionnement spécialisé : leviers et risques du profil, indicateurs ajoutés (8 au plus). */
export function specialize(base: Template, p: SupplyProfile): Template {
  // Indicateurs cohérents avec la situation : la dépendance fournisseur ne vaut que pour les profils fournisseur.
  const keepSupplier = p.id === "appro" || p.id === "geo";
  const moes = base.moes.map((moe, mi) => ({ ...moe, mops: moe.mops.map((mop, pi) => ({ ...mop, tpms: [...mop.tpms.filter(t => keepSupplier || !/fournisseur unique/i.test(t.label)), ...(mi === 0 && pi === 1 ? p.tpms.slice(0, 1) : mi === 1 && pi === 0 ? p.tpms.slice(1, 2) : []), ...(!keepSupplier && mi === 0 && pi === 0 && p.tpms[2] ? [p.tpms[2]] : [])] })) }));
  return { ...base, id: `supply-${p.id}`, label: `Approvisionnement · ${p.label}`, moes, levers: p.levers, risques: p.risques };
}
