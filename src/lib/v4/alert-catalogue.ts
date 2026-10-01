// Catalogue Alerte → Décision, lot "Control Tower" — Supply Chain.
//
// Contenu réel du catalogue fourni (les 15 alertes Supply Chain du
// catalogue complet, AURA_Catalogue_Alertes_Energy_Supply_Decisions.pdf
// pages 8-13) — les libellés, signaux, questions de décision, options et
// récurrences ci-dessous ne sont PAS des données métier fabriquées : c'est
// le texte du catalogue tel que défini. Ce qui N'EST PAS réel : il n'y a
// aujourd'hui aucune ontologie ni connecteur live derrière — ces alertes ne
// se déclenchent pas depuis un flux de données réel, elles servent de
// point d'entrée statique vers le moteur Décider existant (voir
// ControlTowerShell.tsx / newSession()).
//
// Périmètre volontairement restreint à Supply Chain (le lot "Control
// Tower" couvrait aussi Énergie ; ce périmètre a été retiré).
export type AlertSector = "supply-chain";

// Sévérité dérivée du libellé de récurrence de chaque alerte (pas une donnée
// fabriquée) : "temps réel/immédiat" et "5-60 min événementiel" lisent comme
// plus urgents ("critique") que "15 min à quotidien"/"quotidien, événementiel"
// ("majeure"), eux-mêmes plus urgents que "quotidien à hebdomadaire" ("mineure").
export type AlertSeverity = "critique" | "majeure" | "mineure";

export type CatalogueAlert = {
  id: string;
  label: string;
  sector: AlertSector;
  signal: string;
  decisionQuestion: string;
  options: string[];
  recurrence: string;
  severity: AlertSeverity;
  // Les 4 champs ci-dessous sont des valeurs D'EXEMPLE pour l'affichage
  // (le catalogue ne fournit ni site, ni montant, ni délai numérique — voir
  // note du même type déjà portée par les tuiles KPI "valeur d'exemple").
  // `causes` reformule le `signal` ci-dessus en puces courtes, sans ajouter
  // de fait qui n'y figure pas déjà.
  siteLabelExemple: string;
  expositionExempleEur: number;
  /**
   * Montant calculé sur les données branchées : ce qu'il mesure et sa source.
   * Absent quand une donnée manque : l'interface affiche alors « à renseigner »
   * au lieu d'un montant d'exemple (`expositionExempleEur` vaut 0).
   */
  exposition?: { eur: number; what: string; source: string };
  /** Scénario réglé à la main sur la démo (badge « scénario illustratif », infobulle : ce qui a été calibré). */
  illustratif?: string;
  delaiAvantImpactExemple: string;
  causes: string[];
  // Reformulation SI/ALORS du `signal` ci-dessus — chaîne "Alert-to-Decision"
  // (Observer → Expliquer via une règle causale → Qualifier → Décider) du
  // catalogue produit. `condition` reprend le `signal` sans ajouter de fait
  // qui n'y figure pas déjà ; `consequence` est l'ouverture de CETTE alerte.
  causalRule: { condition: string; consequence: string };
  // Variables métier concrètes dont dépend la condition SI ci-dessus —
  // reformulation en noms courts du `signal`/`causalRule.condition` existant
  // et des objets minimaux de la famille ontologique qui alimente cette
  // alerte (voir ontology-catalogue.ts) : aucun fait nouveau, juste la
  // lecture "variables" du même contenu, pour la colonne Variables de la
  // vue Règles & alertes.
  variables: string[];
  // Ancrage honnête Maison Lucie (github.com/mambayelo-lab/maison-lucie-si,
  // lib/demo-data.js) — ABSENT par défaut (illustratif, cf. `causes` ci-
  // dessus). Présent UNIQUEMENT quand un enregistrement réel de ce dataset
  // correspond plausiblement au signal de cette alerte ; dans ce cas, les 3
  // champs "exemple" ci-dessus SONT ce même enregistrement réel (plus de
  // valeur inventée pour cette alerte), `sourceRecord` cite précisément
  // l'enregistrement, et `realFields` porte les valeurs réelles utilisées
  // pour construire des leviers/critères structurés (voir
  // buildGroundedSeed ci-dessous), pas seulement une phrase.
  grounded?: {
    sourceRecord: string; // ex. "manhattan-wms — InventoryPosition BAG-ORION@WH-LIL"
    realFields: Record<string, string | number>;
  };
};

export const ALERT_CATALOGUE: CatalogueAlert[] = [
  {
    id: "S1",
    label: "Risque de rupture fournisseur",
    sector: "supply-chain",
    signal: "Score de risque fournisseur lu (niveau) au-delà du seuil, couverture lue inférieure au délai restant de la commande, article critique.",
    decisionQuestion: "Sécuriser, remplacer, accélérer ou accepter le risque ?",
    options: ["Expedite", "Dual sourcing", "Stock tampon", "Substitution", "Allocation", "Redesign", "Soutien fournisseur"],
    recurrence: "Quotidien, événementiel",
    severity: "majeure",
    // Ancré Maison Lucie : SUP-001 Tessitura Milano (coupa-risk —
    // SupplierRiskAssessment) capacityRisk 88/overallRisk 71 (tendance +19),
    // sur la commande PO-1042 (sap-s4, RELEASED, 2400 unités BOX-PREMIUM) —
    // c'est le même fournisseur/commande que ALT-001 du catalogue Maison
    // Lucie (resilienceAlerts()), exposureEur/decisionWindowHours repris à
    // l'identique.
    siteLabelExemple: "Fournisseur SUP-001 — Tessitura Milano",
    expositionExempleEur: 1_840_000,
    delaiAvantImpactExemple: "24 h",
    causes: ["Score de risque fournisseur lu au-delà du seuil (niveau, pas une probabilité)", "Couverture lue insuffisante sur composant critique"],
    causalRule: { condition: "score de risque lu ≥ seuil ET couverture lue < délai restant de la commande ET article critique.", consequence: "Ouverture de l'alerte S1 — Risque de rupture fournisseur." },
    variables: ["Score de risque fournisseur (lu)", "Couverture de stock (lue)", "Criticité du composant"],
    grounded: {
      sourceRecord: "coupa-risk — SupplierRiskAssessment SUP-001 ; sap-s4 — PurchaseOrder PO-1042 (≈ ALT-001)",
      realFields: { supplierId: "SUP-001", supplier: "Tessitura Milano", overallRisk: 71, trend: "+19", capacityRisk: 88, purchaseOrderId: "PO-1042", quantity: 2400, sku: "BOX-PREMIUM" },
    },
  },
  {
    id: "S2",
    label: "Couverture de stock sous seuil",
    sector: "supply-chain",
    signal: "Stock disponible ou projeté sous le stock de sécurité avant le prochain réapprovisionnement.",
    decisionQuestion: "Commander, transférer, prioriser, substituer ou modifier le service ?",
    options: ["Réapprovisionnement", "Transfert inter-site", "Allocation client", "Substitution", "Expedite", "Ajustement safety stock"],
    recurrence: "Quotidien à hebdomadaire",
    severity: "mineure",
    // Ancré Maison Lucie : BAG-ORION@WH-LIL (manhattan-wms — InventoryPosition)
    // available 230 < safetyStock 250 → 6,4 jours de couverture (daysOfCover).
    // Exposition = déficit (250-230=20 unités) × unitCost BAG-ORION (42,8 €,
    // sap-s4 PO-1044) = 856 € — calcul à partir de champs réels, pas une
    // valeur inventée (nécessairement modeste : le déficit constaté est
    // faible sur ce SKU dans le jeu de données réel).
    siteLabelExemple: "BAG-ORION @ WH-LIL",
    expositionExempleEur: 856,
    delaiAvantImpactExemple: "6,4 jours",
    causes: ["Stock projeté sous le seuil de sécurité", "Réapprovisionnement pas encore arrivé"],
    causalRule: { condition: "stock disponible ou projeté sous le stock de sécurité avant le prochain réapprovisionnement.", consequence: "Ouverture de l'alerte S2 — Stock projeté sous seuil." },
    variables: ["Stock disponible", "Stock projeté", "Stock de sécurité", "Délai avant réapprovisionnement"],
    grounded: {
      sourceRecord: "manhattan-wms — InventoryPosition BAG-ORION@WH-LIL",
      realFields: { sku: "BAG-ORION", siteId: "WH-LIL", available: 230, safetyStock: 250, daysOfCover: 6.4, unitCost: 42.8 },
    },
  },
  {
    id: "S3",
    label: "Surstock ou obsolescence",
    sector: "supply-chain",
    signal: "Couverture excessive, faible rotation, fin de vie ou changement de forecast créant un risque de dépréciation.",
    decisionQuestion: "Réduire, redéployer, promouvoir, retourner, transformer ou déprécier ?",
    options: ["Transfert", "Promotion", "Bundle", "Retour fournisseur", "Rework", "Arrêt commandes", "Liquidation"],
    recurrence: "Hebdomadaire à mensuelle",
    severity: "mineure",
    siteLabelExemple: "Référence REF-3390",
    expositionExempleEur: 720_000,
    delaiAvantImpactExemple: "6 semaines",
    causes: ["Couverture excessive, faible rotation", "Fin de vie ou changement de forecast", "Risque de dépréciation"],
    causalRule: { condition: "couverture excessive, faible rotation, fin de vie ou changement de forecast créant un risque de dépréciation.", consequence: "Ouverture de l'alerte S3 — Surstock ou obsolescence." },
    variables: ["Couverture de stock", "Taux de rotation", "Statut fin de vie", "Écart de forecast"],
  },
  {
    id: "S4",
    label: "Retard transport critique",
    sector: "supply-chain",
    signal: "ETA dérivant au-delà de la dernière date compatible avec la production ou le service.",
    decisionQuestion: "Attendre, rerouter, changer de mode, sourcer localement ou replanifier ?",
    options: ["Air / rail / route", "Reroutage", "Split shipment", "Transfert de stock", "Fournisseur alternatif", "Replanification"],
    recurrence: "Temps réel — heures à jours",
    severity: "critique",
    // Ancré Maison Lucie : SHP-883 (blueyonder-tms — Shipment), transporteur
    // AsiaBridge, Shenzhen → Paris, delayHours 72, statut CRITICAL, liée à
    // PO-1043 (SUP-003, 8000 unités CLASP-AURORA) — même expédition que
    // ALT-002 du catalogue Maison Lucie (exposureEur/decisionWindowHours
    // repris à l'identique).
    siteLabelExemple: "Expédition SHP-883 — AsiaBridge (Shenzhen → Paris)",
    expositionExempleEur: 920_000,
    delaiAvantImpactExemple: "8 h",
    causes: ["ETA en dérive", "Date limite compatible production dépassée"],
    causalRule: { condition: "ETA dérivant au-delà de la dernière date compatible avec la production ou le service.", consequence: "Ouverture de l'alerte S4 — Retard transport critique." },
    variables: ["ETA transport", "Date limite compatible production", "Dérive de délai"],
    grounded: {
      sourceRecord: "blueyonder-tms — Shipment SHP-883 (≈ ALT-002)",
      realFields: { shipmentId: "SHP-883", carrier: "AsiaBridge", origin: "Shenzhen", destination: "Paris", delayHours: 72, status: "CRITICAL", purchaseOrderId: "PO-1043" },
    },
  },
  {
    id: "S5",
    label: "Dégradation OTIF/qualité fournisseur",
    sector: "supply-chain",
    signal: "Retards, défauts ou non-conformités dépassant la tolérance et menaçant service ou coûts.",
    decisionQuestion: "Corriger, réduire allocation, auditer, remplacer ou développer le fournisseur ?",
    options: ["Plan correctif", "Inspection renforcée", "Dual source", "Réallocation", "Sortie", "Accompagnement"],
    recurrence: "Hebdomadaire à mensuelle",
    severity: "mineure",
    siteLabelExemple: "Fournisseur SUP-041",
    expositionExempleEur: 950_000,
    delaiAvantImpactExemple: "3 semaines",
    causes: ["Retards, défauts ou non-conformités hors tolérance", "Menace sur le service ou les coûts"],
    causalRule: { condition: "retards, défauts ou non-conformités dépassant la tolérance et menaçant service ou coûts.", consequence: "Ouverture de l'alerte S5 — Dégradation OTIF/qualité fournisseur." },
    variables: ["Taux OTIF fournisseur", "Taux de défaut/non-conformité", "Tolérance contractuelle", "Impact service/coûts"],
  },
  {
    id: "S6",
    label: "Prévision de demande en dérive",
    sector: "supply-chain",
    signal: "Biais, erreur ou rupture de tendance dépassant un seuil et faussant achats, stock ou capacité.",
    decisionQuestion: "Quelle prévision retenir et quelles décisions aval replanifier ?",
    options: ["Modèle alternatif", "Override documenté", "Scénario haut/bas", "Report achats", "Capacité flexible"],
    recurrence: "Quotidien à mensuel",
    severity: "majeure",
    // Ancré Maison Lucie : DemandForecast BAG-LUNA semaine 2026-W40
    // (snowflake-demand) — promoted 520 vs baseline 310 avec la promotion
    // PROMO-2026-VIC (+25 %) : attendu 387,5, soit un écart de 34,2 % non
    // expliqué par la promotion (forecastGapPct, confiance 61 %). Exposition
    // = excédent non expliqué (132,5 u.) × coût standard BAG-LUNA (36,7 €,
    // sap-s4 Material) ≈ 4 863 € — calcul à partir de champs réels.
    siteLabelExemple: "BAG-LUNA — prévision semaine 2026-W40",
    expositionExempleEur: 4_863,
    delaiAvantImpactExemple: "Semaine 2026-W40 (déjà engagée)",
    causes: ["Écart de prévision non expliqué par la promotion au-delà du seuil", "Biais ou rupture de tendance faussant achats/stock/capacité"],
    causalRule: { condition: "biais, erreur ou rupture de tendance dépassant un seuil et faussant achats, stock ou capacité.", consequence: "Ouverture de l'alerte S6 — Prévision de demande en dérive." },
    variables: ["Biais de prévision", "Erreur de prévision", "Rupture de tendance", "Seuil de dérive"],
    grounded: {
      sourceRecord: "snowflake-demand — DemandForecast BAG-LUNA 2026-W40",
      realFields: { sku: "BAG-LUNA", week: "2026-W40", baseline: 310, promoted: 520, promotionId: "PROMO-2026-VIC", forecastGapPct: 34.2, forecastConfidence: 0.61 },
    },
  },
  {
    id: "S7",
    label: "Capacité insuffisante",
    sector: "supply-chain",
    signal: "Charge prévue dépassant la capacité contrainte d'une usine, ligne, entrepôt ou partenaire.",
    decisionQuestion: "Ajouter, déplacer, sous-traiter, prioriser ou lisser la demande ?",
    options: ["Heures sup", "Équipe supplémentaire", "Sous-traitance", "Transfert", "Priorisation produits/clients"],
    recurrence: "Hebdomadaire (S&OP) à mensuelle",
    severity: "mineure",
    siteLabelExemple: "Usine de Valenciennes",
    expositionExempleEur: 1_050_000,
    delaiAvantImpactExemple: "2 semaines",
    causes: ["Charge prévue dépassant la capacité contrainte", "Usine, ligne, entrepôt ou partenaire concerné"],
    causalRule: { condition: "charge prévue dépassant la capacité contrainte d'une usine, ligne, entrepôt ou partenaire.", consequence: "Ouverture de l'alerte S7 — Capacité insuffisante." },
    variables: ["Charge prévue", "Capacité contrainte du site/ligne/partenaire"],
  },
  {
    id: "S8",
    label: "Marge menacée par coûts supply",
    sector: "supply-chain",
    signal: "Transport, matière, droits, change ou non-qualité érodant la marge sous le plancher.",
    decisionQuestion: "Répercuter, resourcer, redesign, renégocier ou accepter temporairement ?",
    options: ["Prix", "Spécification", "Fournisseur", "Incoterm", "Réseau", "Lot", "Substitution", "Hedge"],
    recurrence: "Hebdomadaire à mensuel",
    severity: "mineure",
    siteLabelExemple: "Gamme Produit Z",
    expositionExempleEur: 680_000,
    delaiAvantImpactExemple: "4 semaines",
    causes: ["Transport, matière, droits, change ou non-qualité en hausse", "Marge sous le plancher"],
    causalRule: { condition: "transport, matière, droits, change ou non-qualité érodant la marge sous le plancher.", consequence: "Ouverture de l'alerte S8 — Marge menacée par coûts supply." },
    variables: ["Coût transport", "Coût matière", "Droits de douane", "Taux de change", "Taux de non-qualité", "Marge plancher"],
  },
  {
    id: "S9",
    label: "Risque géopolitique/pays",
    sector: "supply-chain",
    signal: "Sanction, conflit, réglementation, port fermé ou concentration géographique menaçant un flux critique.",
    decisionQuestion: "Que sécuriser, diversifier, relocaliser ou prépositionner ?",
    options: ["Stock stratégique", "Dual source", "Nearshore", "Reroute", "Redesign", "Contrats optionnels"],
    recurrence: "Quotidien, scénario mensuel",
    severity: "majeure",
    // Ancré Maison Lucie — PARTIELLEMENT : geopoliticalRisk 68 (countryRisk
    // 54) de SUP-003 Shenzhen Atelier Components (coupa-risk) est un signal
    // géopolitique réel (le plus élevé des 15 fournisseurs), sur
    // le même corridor Shenzhen → Paris que SHP-883/PO-1043 (S4 ci-dessus).
    // Ce que le dataset NE modélise PAS (honnêteté) : aucune sanction, port
    // fermé ou événement géopolitique nommé — geopoliticalRisk est un score
    // composite, pas un fait géopolitique détaillé. Exposition/délai repris
    // de SHP-883 (même flux réel), pas une addition inventée.
    siteLabelExemple: "Corridor Shenzhen (SUP-003) → Paris",
    expositionExempleEur: 920_000,
    delaiAvantImpactExemple: "8 h",
    causes: ["Sanction, conflit ou réglementation", "Port fermé ou concentration géographique", "Flux critique menacé"],
    causalRule: { condition: "sanction, conflit, réglementation, port fermé ou concentration géographique menaçant un flux critique.", consequence: "Ouverture de l'alerte S9 — Risque géopolitique/pays." },
    variables: ["Statut sanction/conflit/réglementation", "Statut port/route", "Concentration géographique", "Criticité du flux"],
    grounded: {
      sourceRecord: "coupa-risk — SupplierRiskAssessment SUP-003 (geopoliticalRisk) ; blueyonder-tms — SHP-883",
      realFields: { supplierId: "SUP-003", supplier: "Shenzhen Atelier Components", geopoliticalRisk: 68, countryRisk: 54, overallRisk: 57, corridor: "Shenzhen → Paris" },
    },
  },
  {
    id: "S10",
    label: "Défaillance d'un nœud logistique",
    sector: "supply-chain",
    signal: "Entrepôt, port, transporteur ou système devenant indisponible, avec dépendances et buffers insuffisants.",
    decisionQuestion: "Comment rerouter et allouer les capacités restantes ?",
    options: ["Hub alternatif", "Direct ship", "Cross-dock", "3PL", "Priorisation", "Réduction assortiment"],
    recurrence: "Temps réel — heures à semaines",
    severity: "critique",
    siteLabelExemple: "Entrepôt de Rotterdam",
    expositionExempleEur: 3_400_000,
    delaiAvantImpactExemple: "12 h",
    causes: ["Entrepôt, port, transporteur ou système indisponible", "Dépendances et buffers insuffisants"],
    causalRule: { condition: "entrepôt, port, transporteur ou système devenant indisponible, avec dépendances et buffers insuffisants.", consequence: "Ouverture de l'alerte S10 — Défaillance d'un nœud logistique." },
    variables: ["Disponibilité entrepôt/port/transporteur/système", "Dépendances réseau", "Niveau de buffer"],
  },
  {
    id: "S11",
    label: "Allocation sous pénurie",
    sector: "supply-chain",
    signal: "Offre disponible inférieure à la demande ferme, arbitrages clients/produits/sites nécessaires.",
    decisionQuestion: "À qui allouer quelle quantité selon quelles règles explicables ?",
    options: ["Priorité SLA", "Marge", "Criticité", "Équité", "Substitution", "Réservation", "Report"],
    recurrence: "Quotidien, événementiel",
    severity: "majeure",
    siteLabelExemple: "Ligne Composant X",
    expositionExempleEur: 1_100_000,
    delaiAvantImpactExemple: "2 jours",
    causes: ["Offre disponible inférieure à la demande ferme", "Arbitrage clients/produits/sites nécessaire"],
    causalRule: { condition: "offre disponible inférieure à la demande ferme, arbitrages clients/produits/sites nécessaires.", consequence: "Ouverture de l'alerte S11 — Allocation sous pénurie." },
    variables: ["Offre disponible", "Demande ferme", "Règle d'arbitrage client/produit/site"],
  },
  {
    id: "S12",
    label: "Changement produit/nomenclature à risque",
    sector: "supply-chain",
    signal: "Modification produit créant des dépendances, des stocks morts, une qualification incomplète ou une rupture de transition.",
    decisionQuestion: "Quand basculer et comment consommer/sécuriser ancien et nouveau composants ?",
    options: ["Phase-in/out", "Double run", "Last buy", "Rework", "Décaler lancement", "Qualification accélérée"],
    recurrence: "À chaque changement, hebdomadaire",
    severity: "mineure",
    siteLabelExemple: "Nomenclature BOM-118",
    expositionExempleEur: 540_000,
    delaiAvantImpactExemple: "5 semaines",
    causes: ["Dépendances ou stocks morts créés par la modification", "Qualification incomplète", "Rupture de transition"],
    causalRule: { condition: "modification produit créant des dépendances, des stocks morts, une qualification incomplète ou une rupture de transition.", consequence: "Ouverture de l'alerte S12 — Changement produit/nomenclature à risque." },
    variables: ["Statut changement produit/nomenclature", "Stock ancien composant", "Statut qualification", "Date de transition"],
  },
  {
    id: "S13",
    label: "Donnée supply incohérente",
    sector: "supply-chain",
    signal: "Stocks, lead times, commandes ou identifiants divergeant entre ERP, WMS, TMS et fournisseur.",
    decisionQuestion: "La décision est-elle fiable et quelle source/correction utiliser ?",
    options: ["Golden source", "Rapprochement", "Correction", "Hypothèse prudente", "Blocage", "Validation humaine"],
    recurrence: "Continue à quotidien",
    severity: "majeure",
    siteLabelExemple: "Interface ERP ↔ WMS",
    expositionExempleEur: 380_000,
    delaiAvantImpactExemple: "1 jour",
    causes: ["Stocks, lead times, commandes ou identifiants divergents", "Écart entre ERP, WMS, TMS et fournisseur"],
    causalRule: { condition: "stocks, lead times, commandes ou identifiants divergeant entre ERP, WMS, TMS et fournisseur.", consequence: "Ouverture de l'alerte S13 — Donnée supply incohérente." },
    variables: ["Écart stock ERP/WMS/TMS", "Écart lead time", "Écart identifiants/commandes entre systèmes"],
  },
  {
    id: "S14",
    label: "Configuration réseau sous-optimale",
    sector: "supply-chain",
    signal: "Coût, service, carbone ou résilience du réseau dérivant ; croissance ou acquisition changeant les flux.",
    decisionQuestion: "Ouvrir/fermer/reconfigurer entrepôts, usines, stocks et flux ?",
    options: ["Centraliser", "Régionaliser", "Nouveaux hubs", "Multi-sourcing", "Report modal", "Capacités"],
    recurrence: "Trimestrielle à annuelle",
    severity: "mineure",
    siteLabelExemple: "Réseau — Europe de l'Ouest",
    expositionExempleEur: 5_200_000,
    delaiAvantImpactExemple: "2 trimestres",
    causes: ["Dérive coût, service, carbone ou résilience du réseau", "Croissance ou acquisition changeant les flux"],
    causalRule: { condition: "coût, service, carbone ou résilience du réseau dérivant ; croissance ou acquisition changeant les flux.", consequence: "Ouverture de l'alerte S14 — Configuration réseau sous-optimale." },
    variables: ["Coût réseau", "Niveau de service réseau", "Empreinte carbone", "Résilience réseau", "Variation de flux (croissance/acquisition)"],
  },
  {
    id: "S15",
    label: "Risque de transformation SI Supply",
    sector: "supply-chain",
    signal: "ERP, WMS, OMS ou APS cible ne couvrant pas une capacité critique, un flux ou une transition legacy.",
    decisionQuestion: "Quelle architecture et séquence minimisent le risque métier ?",
    options: ["Phasage", "Coexistence", "Interface temporaire", "Adaptation produit", "Report de lot"],
    recurrence: "À chaque jalon programme",
    severity: "mineure",
    siteLabelExemple: "Programme refonte WMS",
    expositionExempleEur: 1_900_000,
    delaiAvantImpactExemple: "1 jalon",
    causes: ["Capacité critique, flux ou transition legacy non couverts", "Cible ERP/WMS/OMS/APS en cause"],
    causalRule: { condition: "ERP, WMS, OMS ou APS cible ne couvrant pas une capacité critique, un flux ou une transition legacy.", consequence: "Ouverture de l'alerte S15 — Risque de transformation SI Supply." },
    variables: ["Couverture fonctionnelle ERP/WMS/OMS/APS cible", "Criticité de la capacité/flux concerné", "Statut transition legacy"],
  },
];

export function findCatalogueAlert(id: string): CatalogueAlert | undefined {
  return ALERT_CATALOGUE.find(a => a.id === id);
}

// ---------------------------------------------------------------------------
// Situations décisionnelles — Données ancrées sur le SI de démonstration réel
// Maison Lucie (github.com/mambayelo-lab/maison-lucie-si), pas des données
// Aura fabriquées — voir ce repo pour la source. Contrairement aux
// `siteLabelExemple`/`expositionExempleEur`/etc. ci-dessus, qui sont des
// valeurs d'exemple pures inventées pour l'affichage, chaque champ d'une
// `Situation` ci-dessous se retrace vers un enregistrement réel du dataset
// Maison Lucie (lib/demo-data.js) ou de sa passerelle (services/aura-
// gateway.mjs) : identifiants de fournisseur/commande/expédition/SKU,
// scores de risque, délais, expositions €, tel que lus dans ce repo à la
// date de rédaction. Une `Situation` est un objet PLUS RICHE qu'une
// `CatalogueAlert` : elle corrèle PLUSIEURS signaux/alertes bruts (simples
// franchissements de seuil, comme le fait aura-gateway.mjs aujourd'hui —
// STOCK_BELOW_SAFETY / CRITICAL_SHIPMENT_DELAY / SUPPLIER_RISK_SPIKE) en UNE
// situation économique unique, avec causes, options, contraintes et
// décideur — c'est l'objet central visé par l'audit produit, qui remplace
// le cadrage plat "un KPI franchit un seuil" pour au moins ce cas pilote.
export type Situation = {
  id: string;
  titre: string;
  signauxObserves: string[];
  perimetreAffecte: { produits: string[]; sites: string[]; fournisseurs: string[]; clients?: string[] };
  causesProbables: string[];
  valeurExposeeEur: number;
  urgenceHeures: number;
  niveauConfiance: "élevé" | "moyen" | "faible";
  optionsPossibles: { action: string; delaiEstime?: string; contrainte?: string }[];
  contraintesExecution: string[];
  decideurResponsable: string;
  sourceSystemes: string[];
  alertesCorrelees: string[];
  // Score de risque fournisseur réel (coupa-risk — SupplierRiskAssessment)
  // sous-jacent à cette situation — utilisé pour dériver une importance TPM
  // structurée (poids) dans le levier/critère pré-rempli de la session
  // Décider ouverte depuis cette situation (voir buildGroundedSeedFromSituation
  // dans ControlTowerShell.tsx), plutôt qu'un poids générique par défaut.
  realRiskScore: { supplierId: string; supplier: string; overallRisk: number; capacityRisk: number };
};

export const SITUATIONS: Situation[] = [
  {
    id: "SIT-001",
    titre: "Rupture critique menacée sur CLASP-AURORA (WH-PAR) suite à un retard fournisseur cascadant sur le transport",
    // Chaque signal ci-dessous correspond à un enregistrement réel du
    // dataset Maison Lucie : SHP-883/PO-1043 (blueyonder-tms, sap-s4),
    // SUP-003 (coupa-risk), CLASP-AURORA@WH-PAR (manhattan-wms) et l'event
    // evt-9001 (mulesoft-events). C'est le regroupement de ALT-002 (retard
    // d'expédition, déjà cross-référencé sur 3 systèmes dans les données
    // source) avec le risque fournisseur SUP-003 sous-jacent à la même
    // commande PO-1043.
    signauxObserves: [
      "Retard d'expédition critique — SHP-883 (72h de retard, transporteur AsiaBridge, Shenzhen → Paris, statut CRITICAL) — alerte ALT-002 du catalogue Maison Lucie",
      "Commande fournisseur à risque — PO-1043 (SUP-003 Shenzhen Atelier Components, 8000 unités CLASP-AURORA, statut AT_RISK, échéance 2026-10-01)",
      "Risque fournisseur en hausse — SUP-003 Shenzhen Atelier Components : overallRisk 57 (tendance +8), capacityRisk 72, countryRisk 54",
      "Événement d'intégration — evt-9001 shipment.delay.detected sur SHP-883, sévérité critical (Lucie Anypoint Hub, 2026-09-25T08:14:00Z)",
      "Couverture stock CLASP-AURORA@WH-PAR encore positive à ce jour (available 4100, safetyStock 3500, 7,9 jours de couverture) mais dépendante de l'arrivée de PO-1043/SHP-883",
    ],
    perimetreAffecte: {
      produits: ["CLASP-AURORA"],
      sites: ["WH-PAR"],
      fournisseurs: ["SUP-003 — Shenzhen Atelier Components"],
    },
    causesProbables: [
      "Retard transporteur AsiaBridge sur le trajet Shenzhen → Paris (72h, contre un ETA initial au 2026-10-02T16:00:00Z)",
      "Risque de capacité fournisseur élevé chez SUP-003 (capacityRisk 72) — possible cause ou aggravant du retard de la commande PO-1043",
      "Risque pays/géographique du corridor Shenzhen (countryRisk 54) pouvant expliquer une partie de la volatilité transport",
    ],
    // Exposition = exposureEur de l'alerte réelle ALT-002 (Maison Lucie,
    // resilienceAlerts()) — la commande PO-1043/expédition SHP-883 est le
    // seul lien direct chiffré dans le dataset source ; on ne l'additionne
    // pas à ALT-001 (fournisseur différent, SUP-001) pour ne pas fabriquer
    // un total non présent dans la source.
    valeurExposeeEur: 920_000,
    // urgenceHeures = decisionWindowHours de ALT-002 dans le dataset réel.
    urgenceHeures: 8,
    // Confiance "moyen" : les signaux transport (SHP-883) et fournisseur
    // (SUP-003) sont bien cross-référencés via la même commande PO-1043
    // dans le dataset réel, mais le lien de causalité entre le risque
    // fournisseur SUP-003 et le retard transport lui-même n'est pas
    // explicité comme un fait dans les données Maison Lucie (c'est une
    // corrélation raisonnable, pas une causalité prouvée par la source).
    niveauConfiance: "moyen",
    optionsPossibles: [
      { action: "Expedite du solde de PO-1043 par voie aérienne", delaiEstime: "2-3 jours", contrainte: "Surcoût transport, capacité aérienne disponible sur le corridor" },
      { action: "Reroutage via un second transporteur sur le même trajet", delaiEstime: "3-5 jours", contrainte: "Dépend d'une capacité alternative chez un transporteur tiers" },
      { action: "Sécuriser une double source pour CLASP-AURORA face au capacityRisk élevé de SUP-003", delaiEstime: "plusieurs semaines", contrainte: "Qualification d'un fournisseur alternatif non instantanée" },
      { action: "Accepter le délai et réallouer le stock CLASP-AURORA@WH-PAR existant (4100 disponibles) aux commandes prioritaires en attendant l'arrivée", delaiEstime: "immédiat", contrainte: "Réduit la couverture de 7,9 jours pendant la fenêtre de retard" },
    ],
    contraintesExecution: [
      "PO-1043 déjà au statut AT_RISK dans l'ERP (Lucie S/4 Core / SAP S/4HANA) — toute option doit être validée avec l'acheteur en charge de SUP-003",
      "Le stock disponible CLASP-AURORA@WH-PAR (4100 unités) reste au-dessus du safety stock (3500) : la fenêtre de décision de 8h porte sur l'expédition, pas encore sur une rupture immédiate",
    ],
    decideurResponsable: "Responsable Supply Chain Maison Lucie",
    sourceSystemes: [
      "Lucie Luminate Transport (≈ Blue Yonder Transportation Management)",
      "Lucie S/4 Core (≈ SAP S/4HANA)",
      "Lucie Active Warehouse (≈ Manhattan Active WM)",
      "Lucie SpendGuard (≈ Coupa Supplier Risk)",
      "Lucie Anypoint Hub (≈ MuleSoft / Kafka patterns)",
    ],
    alertesCorrelees: ["ALT-002"],
    realRiskScore: { supplierId: "SUP-003", supplier: "Shenzhen Atelier Components", overallRisk: 57, capacityRisk: 72 },
  },
  {
    id: "SIT-002",
    titre: "Rupture client critique menacée sur BOX-PREMIUM (WH-PAR) — retard fournisseur, stock déjà sous seuil et demande en hausse",
    // Second cross-référencement réel trouvé dans le dataset Maison Lucie :
    // SUP-001/PO-1042 (sap-s4, coupa-risk) → SHP-882 (blueyonder-tms) →
    // inventaire BOX-PREMIUM@WH-PAR (manhattan-wms) → prévision de demande
    // en hausse (snowflake-demand) → événement evt-9002/evt-9003
    // (mulesoft-events). C'est exactement le cas travaillé par l'audit
    // produit : "Retards fournisseur + baisse du stock disponible + hausse
    // de la demande + expédition déjà retardée = risque de rupture client
    // critique." — ici en corrélant ALT-001 (risque fournisseur SUP-001) et
    // ALT-003 (stock BOX-PREMIUM sous seuil), tous deux réels sur la même
    // chaîne SUP-001 → PO-1042 → BOX-PREMIUM@WH-PAR.
    signauxObserves: [
      "Risque fournisseur en forte hausse — SUP-001 Tessitura Milano : overallRisk 71 (tendance +19), capacityRisk 88 — alerte ALT-001 du catalogue Maison Lucie",
      "Commande fournisseur — PO-1042 (SUP-001, 2400 unités BOX-PREMIUM, statut RELEASED, échéance 2026-10-02)",
      "Expédition déjà retardée — SHP-882 (36h de retard, transporteur EuroFreight, Milan → Paris, statut DELAYED, liée à PO-1042)",
      "Stock disponible sous le seuil de sécurité — BOX-PREMIUM@WH-PAR : available 290 < safetyStock 600 (1,8 jour de couverture) — alerte ALT-003 du catalogue Maison Lucie",
      "Demande en hausse — prévision BOX-PREMIUM semaine 2026-W40 : promoted 1280 vs baseline 930 (confiance de prévision 73 %)",
      "Événements d'intégration — evt-9002 supplier.risk.changed sur SUP-001 (sévérité major) et evt-9003 inventory.safety-stock.breached sur BOX-PREMIUM@WH-PAR (sévérité major), Lucie Anypoint Hub, 2026-09-25",
    ],
    perimetreAffecte: {
      produits: ["BOX-PREMIUM"],
      sites: ["WH-PAR"],
      fournisseurs: ["SUP-001 — Tessitura Milano"],
    },
    causesProbables: [
      "Capacité fournisseur dégradée chez SUP-001 (capacityRisk 88, en hausse de +19) menaçant la fiabilité de PO-1042",
      "Retard transporteur EuroFreight sur SHP-882 (36h), retardant l'arrivée du réapprovisionnement BOX-PREMIUM à WH-PAR",
      "Hausse de la demande promotionnelle (promoted 1280 vs baseline 930) réduisant d'autant plus vite la couverture déjà sous seuil de sécurité",
    ],
    // Exposition = exposureEur de l'alerte réelle ALT-003 (stock sous
    // seuil, l'impact client le plus direct de cette chaîne) — on ne
    // l'additionne pas à l'exposition ALT-001 (1 840 000 €, qui couvre le
    // risque fournisseur SUP-001 dans son ensemble, au-delà de cette seule
    // commande) pour ne pas fabriquer un total non présent dans la source.
    valeurExposeeEur: 410_000,
    // urgenceHeures = decisionWindowHours le plus court des deux alertes
    // réelles corrélées (ALT-003 : 12h < ALT-001 : 24h) — la situation
    // hérite de l'échéance la plus contraignante.
    urgenceHeures: 12,
    // Confiance "moyen" : les quatre signaux (risque fournisseur, retard
    // transport, stock sous seuil, demande en hausse) sont bien reliés par
    // la même chaîne SUP-001 → PO-1042 → BOX-PREMIUM@WH-PAR dans le dataset
    // réel, mais la source ne fournit pas de preuve causale directe reliant
    // le risque de capacité fournisseur au retard SHP-882 lui-même.
    niveauConfiance: "moyen",
    optionsPossibles: [
      { action: "Transfert inter-site ou allocation prioritaire du stock BOX-PREMIUM restant vers les commandes clients critiques", delaiEstime: "immédiat", contrainte: "Réduit encore la couverture déjà à 1,8 jour" },
      { action: "Expedite du solde de PO-1042 ou de SHP-882", delaiEstime: "2-3 jours", contrainte: "Surcoût transport, dépend de la disponibilité EuroFreight" },
      { action: "Sécuriser une double source pour BOX-PREMIUM face au capacityRisk élevé de SUP-001", delaiEstime: "plusieurs semaines", contrainte: "Qualification fournisseur alternatif non instantanée" },
      { action: "Ajuster à la baisse la promotion pilotant la hausse de demande (promoted 1280) pour limiter la pression sur un stock déjà sous seuil", delaiEstime: "jours", contrainte: "Impact commercial de la promotion à évaluer" },
    ],
    contraintesExecution: [
      "PO-1042 au statut RELEASED (pas encore AT_RISK) dans l'ERP — le risque est aujourd'hui porté par le score fournisseur SUP-001, pas par un retard de commande constaté",
      "La rupture n'est pas encore effective (available 290 > 0) mais la couverture de 1,8 jour laisse une marge de décision très courte",
    ],
    decideurResponsable: "Responsable Supply Chain Maison Lucie",
    sourceSystemes: [
      "Lucie S/4 Core (≈ SAP S/4HANA)",
      "Lucie SpendGuard (≈ Coupa Supplier Risk)",
      "Lucie Luminate Transport (≈ Blue Yonder Transportation Management)",
      "Lucie Active Warehouse (≈ Manhattan Active WM)",
      "Lucie Data Cloud (≈ Snowflake)",
      "Lucie Anypoint Hub (≈ MuleSoft / Kafka patterns)",
    ],
    alertesCorrelees: ["ALT-001", "ALT-003"],
    realRiskScore: { supplierId: "SUP-001", supplier: "Tessitura Milano", overallRisk: 71, capacityRisk: 88 },
  },
];

export function findSituation(id: string): Situation | undefined {
  return SITUATIONS.find(s => s.id === id);
}

// Synthèse pour la session Décider ouverte depuis une Situation — même rôle
// que `alertContextSynthesis` ci-dessus mais pour l'objet plus riche
// `Situation`, en reformulant ses champs sans ajouter de fait nouveau.
export function situationContextSynthesis(situation: Situation): string {
  const perimetre = [
    situation.perimetreAffecte.produits.length ? `les produits ${situation.perimetreAffecte.produits.join(", ")}` : null,
    situation.perimetreAffecte.sites.length ? `les sites ${situation.perimetreAffecte.sites.join(", ")}` : null,
    situation.perimetreAffecte.fournisseurs.length ? `les fournisseurs ${situation.perimetreAffecte.fournisseurs.join(", ")}` : null,
  ].filter(Boolean).join(", ");
  const valeur = (situation.valeurExposeeEur / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return `${situation.titre} (${situation.id}) : ${situation.signauxObserves.join(", ")}. Cela touche ${perimetre || "un périmètre encore à préciser"}, vraisemblablement à cause de ${situation.causesProbables.join(", ")}. L'enjeu représente environ ${valeur} M€, à trancher sous ${situation.urgenceHeures} heures — ${situation.decideurResponsable} est le décideur responsable. Pistes envisageables : ${situation.optionsPossibles.map(o => o.action).join(", ")}.`;
}

// Synthèse en prose, utilisée comme `contextRaw` de départ pour la session
// Décider ouverte depuis une alerte. Raconte ce qui se passe et pourquoi,
// sans jargon d'implémentation ("règle causale", SI/ALORS) — Comprendre (et
// le LLM qui l'assiste) doit lire un signal métier expliqué, pas une
// mécanique de règle, même si les mêmes faits que la carte d'alerte y sont.
export function alertContextSynthesis(alert: CatalogueAlert): string {
  return `${alert.label} (${alert.id}) : ${alert.signal} Cela survient quand ${alert.causalRule.condition}, ce qui a déclenché cette alerte. Elle s'appuie sur ${alert.variables.join(", ")}. ${alert.decisionQuestion}`;
}
