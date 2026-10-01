// pack-energies-renouvelables.ts — pack sectoriel Énergies renouvelables :
// décisions centrées sur la production et la flexibilité (pas le réseau de
// distribution, déjà couvert par pack-energie.ts).
//
// Même grammaire que les autres packs : un modèle de décision déjà structuré
// avec le vocabulaire du secteur (intermittence, flexibilité, stockage, PPA,
// effacement), que l'utilisateur corrige au lieu de l'écrire.
//
// Aucune valeur ici n'est une mesure réelle ni une donnée de marché datée. Les
// niveaux sont des jugements de cadrage, ordinaux, tous éditables. Le moteur
// reste non compensatoire.

import type {
  AtelierCriterion, AtelierScenario, ImportanceBadge,
} from "./atelier-store";
import type { SectorCase } from "./pack-energie";

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

// ── Cas 1 — Dimensionner la flexibilité face à l'intermittence ─────────────
const FLEX: SectorCase = {
  key: "renouv-flexibilite",
  bouton: "Flexibilité face à l'intermittence",
  title: "Intermittence de la production — stockage, effacement ou surcapacité",
  contextRaw:
    "Un parc de production renouvelable (solaire et/ou éolien) doit tenir un engagement de fourniture malgré une production intermittente. Trois trajectoires : investir dans du stockage batterie pour lisser la production, contractualiser de l'effacement/flexibilité de la demande côté client, ou surdimensionner la capacité de production pour absorber les creux. La décision engage la tenue de l'engagement de fourniture, l'irréversibilité de l'investissement et la dépendance à des tiers.",
  caseType: "investissement",
  objectif: "Tenir l'engagement de fourniture malgré l'intermittence sans capital immobilisé disproportionné",
  horizon: "Décision avant la prochaine campagne de contractualisation",
  decideurs: "Direction production · Direction financière · Direction commerciale",
  impactes: "Clients sous engagement de fourniture, opérateurs de flexibilité, équipes d'exploitation, financeurs",
  exigencesNonNeg: "Respect des engagements de fourniture contractuels · sécurité électrique des installations",
  risques: [
    "Défaillance ou vieillissement prématuré du parc de batteries",
    "Effacement contractualisé non tenu au moment critique",
    "Sous-estimation durable de la marge de production nécessaire",
  ],
  criteria: [
    K("f-fourn", "Tenue de l'engagement", "Essentiel", "MOE", "Ce que le client final perçoit de la fiabilité", [
      K("f-fourn-cont", "Continuité de fourniture", "Essentiel", "MOP", "Capacité à tenir l'engagement en période de faible production", [
        K("f-fourn-creux", "Résilience aux creux de production", "Essentiel", "TPM", "Capacité à couvrir un creux prolongé (plusieurs jours nuageux/sans vent)"),
        K("f-fourn-pointe", "Tenue en pointe de demande", "Essentiel", "TPM", "Capacité à répondre à un pic de demande coïncidant avec un creux"),
      ]),
    ]),
    K("f-dep", "Dépendance à des tiers", "Important", "MOE", "Ce que la solution fait dépendre d'acteurs externes", [
      K("f-dep-effac", "Fiabilité de la flexibilité externe", "Important", "MOP", "Certitude que l'effacement contractualisé sera effectivement mobilisable", [
        K("f-dep-appel", "Taux d'appel réellement honoré", "Important", "TPM", "Historique et garanties de mobilisation effective"),
      ]),
    ]),
    K("f-eco", "Tenue économique", "Important", "MOE", "Ce que la solution engage financièrement", [
      K("f-eco-capex", "Engagement d'investissement", "Important", "MOP", "Montant et irréversibilité de l'engagement", [
        K("f-eco-immo", "Irréversibilité de l'actif", "Important", "TPM", "Capacité à revenir en arrière si le besoin est surestimé"),
        K("f-eco-cycle", "Coût de cycle de vie", "Important", "TPM", "Coût de maintenance/remplacement sur la durée (ex. dégradation batterie)"),
        K("f-eco-retour", "Délai de retour sur investissement", "Important", "TPM", "Temps nécessaire pour que l'actif rembourse son coût d'investissement"),
      ]),
    ]),
    K("f-exploit", "Exploitabilité", "Important", "MOE", "Ce que la solution coûte à piloter au quotidien", [
      K("f-exploit-pilot", "Complexité de pilotage", "Important", "MOP", "Effort de prévision et d'arbitrage au quotidien", [
        K("f-exploit-prevision", "Qualité de la prévision de production", "Important", "TPM", "Fiabilité des outils de prévision solaire/éolien utilisés"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "FL1", label: "Solution de flexibilité", type: "decision", options: [
      { id: "fo-batt", label: "Stockage batterie dimensionné", impacts: { "f-fourn-creux": "++", "f-fourn-pointe": "++", "f-dep-appel": "0", "f-eco-immo": "--", "f-eco-cycle": "--", "f-exploit-pilot": "-" }, justification: "Maîtrise interne totale de la flexibilité, au prix d'un investissement lourd et d'un actif qui se dégrade." },
      { id: "fo-effac", label: "Effacement/flexibilité contractualisée", impacts: { "f-fourn-pointe": "+", "f-eco-immo": "++", "f-eco-cycle": "+", "f-dep-appel": "-", "f-fourn-creux": "-" }, justification: "Peu capitalistique, mais la tenue de l'engagement dépend d'un tiers non garanti." },
      { id: "fo-surcap", label: "Surcapacité de production", impacts: { "f-fourn-creux": "+", "f-dep-appel": "0", "f-eco-immo": "-", "f-eco-cycle": "0", "f-exploit-pilot": "+", "f-fourn-pointe": "-" }, justification: "Évite la dépendance externe, mais gaspille du capital en période de forte production." },
    ] },
    { id: "FL2", label: "Outil de prévision", type: "technique", options: [
      { id: "fo-ia", label: "Prévision par modèle météo/IA dédié", impacts: { "f-exploit-prevision": "++", "f-exploit-pilot": "+", "f-eco-cycle": "-" }, justification: "Réduit l'incertitude de pilotage au prix d'un coût d'outillage récurrent." },
      { id: "fo-simple", label: "Prévision par moyennes historiques", impacts: { "f-exploit-prevision": "-", "f-eco-cycle": "+", "f-exploit-pilot": "-" } },
    ] },
    { id: "FL3", label: "Cadre contractuel de l'engagement", type: "decision", options: [
      { id: "fo-souple", label: "Engagement avec clause de flexibilité", impacts: { "f-fourn-creux": "+", "f-dep-appel": "+", "f-fourn-pointe": "0" } },
      { id: "fo-ferme", label: "Engagement ferme sans clause", impacts: { "f-fourn-creux": "-", "f-fourn-pointe": "-", "f-dep-appel": "0" } },
    ] },
  ],
  scenarios: [
    S("f-s1", "Stockage batterie dimensionné", "#6366f1",
      "Investissement dans le stockage, prévision par IA, engagement ferme assumé.",
      [["FL1", "Solution de flexibilité", "fo-batt"], ["FL2", "Outil de prévision", "fo-ia"], ["FL3", "Cadre contractuel de l'engagement", "fo-ferme"]],
      "La tenue de l'engagement est la mieux couverte ; l'irréversibilité de l'investissement devient le point à instruire."),
    S("f-s2", "Flexibilité contractualisée", "#10b981",
      "Effacement mobilisé à la demande, prévision par IA, clause de flexibilité contractuelle.",
      [["FL1", "Solution de flexibilité", "fo-effac"], ["FL2", "Outil de prévision", "fo-ia"], ["FL3", "Cadre contractuel de l'engagement", "fo-souple"]],
      "Capital préservé, mais la tenue de l'engagement dépend d'un taux d'appel externe non garanti."),
    S("f-s3", "Surcapacité sans dépendance externe", "#f59e0b",
      "Production surdimensionnée, prévision simplifiée, clause de flexibilité contractuelle.",
      [["FL1", "Solution de flexibilité", "fo-surcap"], ["FL2", "Outil de prévision", "fo-simple"], ["FL3", "Cadre contractuel de l'engagement", "fo-souple"]],
      "Aucune dépendance à un tiers, mais le capital immobilisé en période de forte production reste peu productif."),
  ],
};

/** Le pack Énergies renouvelables — production et flexibilité. */
export const PACK_ENERGIES_RENOUVELABLES: SectorCase[] = [FLEX];

/**
 * Enjeux structurels (PESTEL) typiques du secteur, proposés comme point de
 * départ éditable — jamais une donnée de marché datée ni un fait vérifié,
 * seulement une formulation qualitative des tensions connues du secteur.
 */
export const RENOUVELABLES_PESTEL_SEED: Record<string, string> = {
  P: "Mécanismes de soutien (tarifs, appels d'offres) et seuils réglementaires en évolution — à vérifier sur le cadre applicable au projet.",
  E: "Coût du capital et prix de marché de l'électricité volatils, financement d'actifs à durée de vie longue.",
  S: "Acceptabilité locale des nouvelles implantations (parcs éoliens/solaires) et rareté des compétences en gestion de flexibilité.",
  T: "Baisse continue du coût du stockage batterie, outils de prévision de production par IA de plus en plus fiables.",
  En: "Intermittence de la production, empreinte de fabrication et de fin de vie des équipements (panneaux, batteries).",
  L: "Cadre contractuel des engagements de flexibilité/effacement et responsabilité en cas de non-tenue.",
};
