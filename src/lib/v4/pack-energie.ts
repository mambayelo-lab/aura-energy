// pack-energie.ts — pack sectoriel Énergie & Utilities : décisions pré-câblées.
//
// Même grammaire que le pack Retail : un modèle de décision déjà structuré avec
// le vocabulaire du secteur (raccordement, flexibilité, effacement, actif
// vieillissant, continuité de fourniture), que l'utilisateur corrige au lieu de
// l'écrire.
//
// Aucune valeur ici n'est une mesure réelle. Les niveaux sont des jugements de
// cadrage, ordinaux, tous éditables. Le moteur reste non compensatoire : une
// exigence de sûreté ou de continuité dégradée au niveau rédhibitoire ne se
// rachète pas par un gain ailleurs.

import type {
  AtelierCriterion, AtelierScenario, ImportanceBadge,
} from "./atelier-store";
import type { RetailCase } from "./pack-retail";

/** Un cas de pack sectoriel — même forme que les cas Retail. */
export type SectorCase = RetailCase;

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

// ── Cas 1 — Contrainte sur un départ de réseau ──────────────────────────────
const RESEAU: SectorCase = {
  key: "energie-reseau",
  bouton: "Contrainte de réseau",
  title: "Départ de réseau contraint — renforcer, flexibiliser ou piloter la demande",
  contextRaw:
    "Un départ de distribution arrive en limite de capacité : nouveaux raccordements de production décentralisée et électrification des usages se cumulent. Trois trajectoires : renforcer l'ouvrage, contractualiser de la flexibilité locale (raccordement sous contrainte), ou piloter la demande par effacement et modulation. La décision engage la qualité de fourniture, le délai de raccordement des demandeurs et l'acceptabilité locale des travaux.",
  caseType: "strategique",
  objectif: "Absorber la nouvelle demande sans dégrader la qualité de fourniture ni bloquer les raccordements",
  horizon: "Programme pluriannuel d'investissement en cours",
  decideurs: "Direction technique réseau · Direction des investissements · Direction régionale",
  impactes: "Clients raccordés du départ, producteurs en attente, collectivités, exploitants d'astreinte",
  exigencesNonNeg: "Sûreté d'exploitation · continuité de fourniture des clients sensibles · conformité au cadre de régulation",
  risques: [
    "Retard des travaux prolongeant la contrainte au-delà de l'hiver",
    "Flexibilité contractualisée non appelée ou non tenue le jour de la pointe",
    "Contestation locale des travaux de renforcement",
  ],
  criteria: [
    K("e-qual", "Qualité de fourniture", "Essentiel", "MOE", "Ce que le client perçoit du réseau", [
      K("e-qual-cont", "Continuité", "Essentiel", "MOP", "Tenue de l'alimentation en régime normal et en pointe", [
        K("e-qual-coup", "Exposition aux coupures", "Essentiel", "TPM", "Risque d'interruption sur le départ en situation de pointe"),
        K("e-qual-tension", "Tenue de la tension", "Essentiel", "TPM", "Respect de la plage de tension aux points de livraison"),
      ]),
      K("e-qual-acc", "Accueil des demandes", "Important", "MOP", "Capacité à raccorder les demandeurs en attente", [
        K("e-qual-delai", "Délai de raccordement", "Important", "TPM", "Temps entre la demande et la mise en service"),
        K("e-qual-prod", "Accueil de production décentralisée", "Important", "TPM", "Puissance de production raccordable sur le départ"),
      ]),
    ]),
    K("e-exploit", "Exploitabilité", "Essentiel", "MOE", "Ce que la solution coûte à exploiter au quotidien", [
      K("e-exploit-cond", "Conduite du réseau", "Essentiel", "MOP", "Complexité de pilotage en régime courant et en incident", [
        K("e-exploit-manoeuvre", "Charge de conduite", "Important", "TPM", "Nombre de manœuvres et d'arbitrages à la main de l'exploitant"),
        K("e-exploit-obs", "Observabilité du départ", "Essentiel", "TPM", "Capacité à connaître l'état réel du départ en temps utile"),
      ]),
      K("e-exploit-maint", "Maintenabilité", "Important", "MOP", "Effort de maintenance induit", [
        K("e-exploit-comp", "Compétences requises", "Important", "TPM", "Disponibilité des compétences pour tenir la solution"),
      ]),
    ]),
    K("e-eco", "Tenue économique", "Important", "MOE", "Ce que la solution engage financièrement", [
      K("e-eco-capex", "Engagement d'investissement", "Important", "MOP", "Montant et irréversibilité de l'engagement", [
        K("e-eco-immo", "Irréversibilité de l'ouvrage", "Important", "TPM", "Capacité à revenir en arrière si la demande ne se confirme pas"),
        K("e-eco-opex", "Charge d'exploitation récurrente", "Important", "TPM", "Coût annuel de tenue de la solution"),
      ]),
    ]),
    K("e-terr", "Acceptabilité territoriale", "Important", "MOE", "Effet sur les parties prenantes du territoire", [
      K("e-terr-acc", "Acceptation des travaux", "Important", "MOP", "Adhésion des riverains et des collectivités", [
        K("e-terr-emprise", "Emprise et nuisance de chantier", "Important", "TPM", "Ampleur des travaux visibles sur le territoire"),
        K("e-terr-equite", "Équité de traitement des demandeurs", "Important", "TPM", "Perception d'un traitement égal des demandes de raccordement"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "EL1", label: "Solution de capacité", type: "decision", options: [
      { id: "eo-renf", label: "Renforcement de l'ouvrage", impacts: { "e-qual-coup": "++", "e-qual-tension": "++", "e-qual-prod": "++", "e-exploit-manoeuvre": "+", "e-eco-immo": "--", "e-terr-emprise": "--" }, justification: "Lève la contrainte durablement, au prix d'un engagement lourd et de travaux visibles." },
      { id: "eo-flex", label: "Flexibilité locale contractualisée", impacts: { "e-qual-prod": "+", "e-qual-delai": "++", "e-eco-immo": "++", "e-terr-emprise": "++", "e-qual-coup": "-", "e-exploit-obs": "-", "e-exploit-manoeuvre": "-" }, justification: "Raccorde vite sans ouvrage neuf, mais la tenue dépend de l'appel effectif de la flexibilité." },
      { id: "eo-demande", label: "Pilotage de la demande", impacts: { "e-eco-immo": "++", "e-eco-opex": "+", "e-terr-emprise": "++", "e-qual-coup": "-", "e-qual-tension": "-", "e-exploit-manoeuvre": "--" }, justification: "Évite l'investissement mais reporte la contrainte sur la conduite." },
    ] },
    { id: "EL2", label: "Observabilité déployée", type: "technique", options: [
      { id: "eo-capteurs", label: "Instrumentation du départ", impacts: { "e-exploit-obs": "++", "e-qual-tension": "+", "e-eco-opex": "-", "e-exploit-comp": "-" }, justification: "Rend la contrainte visible avant qu'elle ne devienne une coupure." },
      { id: "eo-estim", label: "Estimation par modèle", impacts: { "e-exploit-obs": "+", "e-eco-opex": "+", "e-qual-tension": "U" }, justification: "Moins coûteux, mais l'état réel du départ reste incertain." },
    ] },
    { id: "EL3", label: "Traitement de la file de raccordement", type: "decision", options: [
      { id: "eo-file", label: "File d'attente sur capacité disponible", impacts: { "e-qual-coup": "+", "e-terr-equite": "+", "e-qual-delai": "--", "e-qual-prod": "-" } },
      { id: "eo-contr", label: "Raccordement sous contrainte assumée", impacts: { "e-qual-delai": "++", "e-qual-prod": "++", "e-terr-equite": "-", "e-qual-coup": "-" } },
    ] },
  ],
  scenarios: [
    S("e-s1", "Renforcement + instrumentation", "#6366f1",
      "Ouvrage renforcé et départ instrumenté : la contrainte est levée physiquement.",
      [["EL1", "Solution de capacité", "eo-renf"], ["EL2", "Observabilité déployée", "eo-capteurs"], ["EL3", "Traitement de la file de raccordement", "eo-contr"]],
      "Aucune exigence de fourniture n'est dégradée ; l'irréversibilité de l'engagement devient le point à instruire."),
    S("e-s2", "Flexibilité locale + raccordement sous contrainte", "#10b981",
      "Raccordements acceptés immédiatement, tenue assurée par flexibilité contractualisée.",
      [["EL1", "Solution de capacité", "eo-flex"], ["EL2", "Observabilité déployée", "eo-capteurs"], ["EL3", "Traitement de la file de raccordement", "eo-contr"]],
      "Le délai de raccordement progresse fortement, mais la continuité repose sur un appel de flexibilité non garanti."),
    S("e-s3", "Pilotage de la demande sans ouvrage", "#f59e0b",
      "Aucun investissement d'ouvrage : la contrainte est absorbée par effacement et modulation.",
      [["EL1", "Solution de capacité", "eo-demande"], ["EL2", "Observabilité déployée", "eo-estim"], ["EL3", "Traitement de la file de raccordement", "eo-file"]],
      "L'engagement financier est évité, mais l'exposition aux coupures et la charge de conduite se dégradent ensemble."),
  ],
};

/** Le pack Énergie & Utilities. */
export const PACK_ENERGIE: SectorCase[] = [RESEAU];
