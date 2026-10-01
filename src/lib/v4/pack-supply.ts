// pack-supply.ts — pack sectoriel Supply chain : décisions pré-câblées.
//
// Même grammaire que les packs Retail et Énergie. Vocabulaire du secteur :
// mono-source, double-source, relocalisation, schéma directeur logistique,
// stock de sécurité, capacité réactive, taux de service.
//
// Aucune valeur n'est une mesure réelle : jugements de cadrage, ordinaux,
// éditables. Une exigence de service dégradée au niveau rédhibitoire ne se
// rachète pas par un gain de coût.

import type {
  AtelierCriterion, AtelierScenario, ImportanceBadge,
} from "./atelier-store";
import type { SectorCase } from "./pack-energie";
import { DETROITS } from "./cas-detroits";
import { PANDEMIE } from "./cas-pandemie";

const K = (
  id: string, label: string, importance: ImportanceBadge,
  level: "MOE" | "MOP" | "TPM", description: string, children?: AtelierCriterion[],
): AtelierCriterion => ({
  id, label, poids: importance === "Essentiel" ? 90 : importance === "Important" ? 75 : 55,
  description, importance, level, ...(children ? { children } : {}),
});

const S = (
  id: string, label: string, color: string, description: string,
  leviers: Array<[string, string, string]>, insight: string,
): AtelierScenario => ({
  id, label, color, description,
  leviers: leviers.map(([lid, llabel, oid]) => ({ id: lid, label: llabel, valeur: oid, type: "decision" as const })),
  scores: {}, valeur: 50, faisabilite: 60, auraInsight: insight,
});

// ── Cas 3 — Politique de stock face à la volatilité ─────────────────────────
const STOCK: SectorCase = {
  key: "supply-stock",
  bouton: "Stock et volatilité",
  title: "Demande volatile — couvrir par le stock, par la capacité ou par la promesse",
  contextRaw:
    "La demande devient irrégulière et la prévision décroche. Trois façons d'absorber : renforcer le stock de sécurité, se doter d'une capacité de production réactive, ou ajuster la promesse commerciale (délai différencié selon les segments). La décision engage le taux de service, le capital immobilisé et la crédibilité commerciale.",
  caseType: "operationnel",
  objectif: "Absorber la volatilité sans dégrader le service des clients prioritaires",
  horizon: "Prochain cycle de planification",
  decideurs: "Direction supply chain · Direction commerciale · Direction financière",
  impactes: "Clients par segment, planificateurs, usines, trésorerie",
  exigencesNonNeg: "Taux de service tenu sur les clients prioritaires · aucun engagement commercial non tenable annoncé",
  risques: [
    "Stock constitué sur les mauvaises références",
    "Capacité réactive non mobilisable au moment du pic",
    "Segmentation de promesse mal comprise par les clients",
  ],
  criteria: [
    K("v-serv", "Service", "Essentiel", "MOE", "Ce que le client constate", [
      K("v-serv-taux", "Taux de service", "Essentiel", "MOP", "Part de la demande servie conformément", [
        K("v-serv-prio", "Service des clients prioritaires", "Essentiel", "TPM", "Tenue de l'engagement sur les comptes sous contrat"),
        K("v-serv-autres", "Service des autres segments", "Important", "TPM", "Niveau de service offert au reste du portefeuille"),
      ]),
      K("v-serv-cred", "Crédibilité de la promesse", "Essentiel", "MOP", "Cohérence entre ce qui est annoncé et ce qui est tenu", [
        K("v-serv-tenue", "Promesse tenue", "Essentiel", "TPM", "Écart entre délai annoncé et délai réalisé"),
      ]),
    ]),
    K("v-agi", "Réactivité", "Essentiel", "MOE", "Ce que l'on peut faire quand la demande bouge", [
      K("v-agi-cap", "Capacité de réaction", "Essentiel", "MOP", "Aptitude à ajuster le volume dans le cycle", [
        K("v-agi-delai", "Délai de réaction", "Essentiel", "TPM", "Temps nécessaire pour ajuster le volume produit"),
        K("v-agi-flex", "Amplitude d'ajustement", "Important", "TPM", "Ampleur de la variation absorbable"),
      ]),
    ]),
    K("v-eco", "Tenue financière", "Important", "MOE", "Ce que la couverture coûte", [
      K("v-eco-bfr", "Capital immobilisé", "Important", "MOP", "Stock et capacité financés", [
        K("v-eco-stock", "Stock financé", "Important", "TPM", "Niveau de stock porté au bilan"),
        K("v-eco-obso", "Risque d'obsolescence", "Important", "TPM", "Exposition à la dépréciation du stock constitué"),
        K("v-eco-cap", "Coût de la capacité réservée", "Important", "TPM", "Charge de la capacité tenue disponible"),
      ]),
    ]),
    K("v-pilot", "Pilotabilité", "Important", "MOE", "Ce que la solution demande au pilotage", [
      K("v-pilot-info", "Qualité de l'information", "Important", "MOP", "Fiabilité des éléments servant à décider", [
        K("v-pilot-prev", "Fiabilité de la prévision", "Important", "TPM", "Niveau de confiance accordé à la prévision de demande"),
        K("v-pilot-charge", "Charge de planification", "Important", "TPM", "Effort de pilotage demandé aux planificateurs"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "VL1", label: "Mode de couverture", type: "decision", options: [
      { id: "vo-stock", label: "Stock de sécurité renforcé", impacts: { "v-serv-prio": "++", "v-serv-autres": "++", "v-agi-delai": "+", "v-eco-stock": "--", "v-eco-obso": "--", "v-pilot-charge": "+" }, justification: "Couvre tous les segments, mais immobilise et expose à l'obsolescence." },
      { id: "vo-capa", label: "Capacité réactive", impacts: { "v-agi-delai": "++", "v-agi-flex": "++", "v-eco-stock": "++", "v-eco-cap": "--", "v-serv-autres": "-" }, justification: "Réagit sans stock, au prix d'une capacité tenue disponible." },
      { id: "vo-promesse", label: "Promesse différenciée par segment", impacts: { "v-serv-prio": "++", "v-eco-stock": "++", "v-eco-cap": "++", "v-serv-autres": "--", "v-serv-tenue": "+" }, justification: "Protège les prioritaires sans immobiliser, mais dégrade ouvertement les autres segments." },
    ] },
    { id: "VL2", label: "Base de décision", type: "technique", options: [
      { id: "vo-signal", label: "Pilotage sur signaux de demande réels", impacts: { "v-pilot-prev": "++", "v-agi-delai": "+", "v-pilot-charge": "-" }, justification: "Remplace la prévision par le constat, quand le signal existe." },
      { id: "vo-prevu", label: "Pilotage sur prévision statistique", impacts: { "v-pilot-charge": "++", "v-pilot-prev": "--", "v-serv-prio": "-" } },
    ] },
    { id: "VL3", label: "Périmètre de couverture", type: "budget", options: [
      { id: "vo-cible", label: "Couverture ciblée sur les références critiques", impacts: { "v-eco-stock": "++", "v-eco-obso": "++", "v-serv-prio": "+", "v-serv-autres": "-" } },
      { id: "vo-large", label: "Couverture large du catalogue", impacts: { "v-serv-autres": "++", "v-eco-stock": "--", "v-eco-obso": "--" } },
    ] },
  ],
  scenarios: [
    S("v-s1", "Stock large", "#f59e0b",
      "Couverture large du catalogue par le stock, pilotée sur prévision.",
      [["VL1", "Mode de couverture", "vo-stock"], ["VL2", "Base de décision", "vo-prevu"], ["VL3", "Périmètre de couverture", "vo-large"]],
      "Le service progresse sur tous les segments, mais le capital immobilisé et l'obsolescence se dégradent ensemble."),
    S("v-s2", "Capacité réactive pilotée par le signal", "#10b981",
      "Capacité d'ajustement mobilisable, décisions prises sur signaux de demande réels.",
      [["VL1", "Mode de couverture", "vo-capa"], ["VL2", "Base de décision", "vo-signal"], ["VL3", "Périmètre de couverture", "vo-cible"]],
      "Aucune exigence de service prioritaire n'est dégradée ; le coût de la capacité réservée devient le point à instruire."),
    S("v-s3", "Promesse différenciée", "#6366f1",
      "Délai différencié selon le segment, couverture concentrée sur les références critiques.",
      [["VL1", "Mode de couverture", "vo-promesse"], ["VL2", "Base de décision", "vo-signal"], ["VL3", "Périmètre de couverture", "vo-cible"]],
      "Les clients prioritaires sont protégés sans immobilisation, mais le service des autres segments tombe au niveau rédhibitoire."),
  ],
};

/** Le pack Supply chain. */
export const PACK_SUPPLY: SectorCase[] = [STOCK, DETROITS, PANDEMIE];
