// pack-retail.ts — pack sectoriel Retail : décisions pré-câblées.
//
// ── Pourquoi un pack ────────────────────────────────────────────────────────
// Un prospect Retail perd la séance à saisir son modèle : options, critères,
// échelles, leviers. Le pack fait l'inverse : il ouvre une décision déjà
// structurée avec le vocabulaire du secteur (rotation, disponibilité, démarque,
// dernier kilomètre), que l'utilisateur corrige au lieu d'écrire. Le cadrage
// passe de la séance à la dizaine de minutes.
//
// ── Ce que le pack n'est pas ────────────────────────────────────────────────
// Ce n'est pas une base de chiffres clients. Aucune valeur ici n'est présentée
// comme une mesure réelle : les niveaux sont des jugements de cadrage, ordinaux,
// tous éditables. Le moteur reste strictement non compensatoire.

import type {
  AtelierCriterion, AtelierLevierDef, AtelierScenario, ImportanceBadge,
} from "./atelier-store";

/** Fabrique un critère de l'arbre MOE / MOP / TPM. */
const K = (
  id: string, label: string, importance: ImportanceBadge,
  level: "MOE" | "MOP" | "TPM", description: string, children?: AtelierCriterion[],
): AtelierCriterion => ({
  id, label, poids: importance === "Essentiel" ? 90 : importance === "Important" ? 75 : 55,
  description, importance, level, ...(children ? { children } : {}),
});

/** Fabrique un scénario : une combinaison d'options sur les leviers. */
const S = (
  id: string, label: string, color: string, description: string,
  leviers: Array<[string, string, string]>, insight: string,
): AtelierScenario => ({
  id, label, color, description,
  leviers: leviers.map(([lid, llabel, oid]) => ({ id: lid, label: llabel, valeur: oid, type: "decision" as const })),
  scores: {}, valeur: 50, faisabilite: 60, auraInsight: insight,
});

export interface RetailCase {
  key: string;
  /** Libellé du bouton dans le pack. */
  bouton: string;
  title: string;
  contextRaw: string;
  caseType: string;
  objectif: string;
  horizon: string;
  decideurs: string;
  impactes: string;
  exigencesNonNeg: string;
  risques: string[];
  criteria: AtelierCriterion[];
  leviersDef: AtelierLevierDef[];
  scenarios: AtelierScenario[];
}

// ── Cas 3 — Promesse omnicanale ─────────────────────────────────────────────
const OMNICANAL: RetailCase = {
  key: "retail-omnicanal",
  bouton: "Promesse omnicanale",
  title: "Promesse de délai par canal — service, coût, disponibilité",
  contextRaw:
    "Quelle promesse de délai tenir par canal, et à quel coût de dernier kilomètre ? Livrer plus vite exige de rapprocher le stock du client, donc d'expédier depuis les magasins — au prix de la disponibilité en rayon. Trois trajectoires : livraison depuis l'entrepôt, expédition depuis les magasins, ou modèle mixte piloté par la disponibilité.",
  caseType: "strategique",
  objectif: "Tenir une promesse crédible par canal sans vider les rayons",
  horizon: "Prochain exercice",
  decideurs: "Direction e-commerce · Direction du réseau · Direction supply chain",
  impactes: "Magasins, transporteurs, clients en ligne, service client",
  exigencesNonNeg: "Disponibilité du fond de rayon en magasin · promesse annoncée tenue",
  risques: [
    "Promesse annoncée non tenue en pointe",
    "Prélèvement magasin qui crée la rupture en rayon",
    "Coût du dernier kilomètre non répercutable",
  ],
  criteria: [
    K("o-serv", "Service au client", "Essentiel", "MOE", "Ce que le client constate", [
      K("o-serv-delai", "Tenue du délai", "Essentiel", "MOP", "Respect de la promesse annoncée", [
        K("o-serv-promesse", "Promesse tenue en pointe", "Essentiel", "TPM", "Aptitude à tenir le délai annoncé en période chargée"),
        K("o-serv-choix", "Choix de créneaux", "Important", "TPM", "Étendue des créneaux et modes de retrait proposés"),
        K("o-serv-remise", "Délai de mise à disposition", "Important", "TPM", "Temps entre la commande et la remise au client (retrait ou livraison)"),
      ]),
    ]),
    K("o-dispo", "Disponibilité en magasin", "Essentiel", "MOE", "Ce que le client en magasin trouve encore", [
      K("o-dispo-rayon", "Tenue du linéaire", "Essentiel", "MOP", "Effet du prélèvement web sur le rayon", [
        K("o-dispo-rupture", "Ruptures induites par le web", "Essentiel", "TPM", "Ruptures créées par le prélèvement pour les commandes en ligne"),
        K("o-dispo-charge", "Charge de préparation en magasin", "Important", "TPM", "Temps de préparation absorbé par les équipes de vente"),
      ]),
    ]),
    K("o-cout", "Coût de service", "Essentiel", "MOE", "Ce que la promesse coûte à servir", [
      K("o-cout-km", "Dernier kilomètre", "Essentiel", "MOP", "Coût d'acheminement final", [
        K("o-cout-livr", "Coût par commande livrée", "Essentiel", "TPM", "Coût d'acheminement d'une commande jusqu'au client"),
        K("o-cout-retour", "Coût des retours", "Important", "TPM", "Charge de traitement des retours induite par le canal"),
      ]),
    ]),
    K("o-si", "Faisabilité SI", "Important", "MOE", "Ce que le système doit savoir faire", [
      K("o-si-stock", "Fiabilité du stock unifié", "Essentiel", "MOP", "Justesse du stock exposé à la vente en ligne", [
        K("o-si-justesse", "Justesse du stock magasin", "Essentiel", "TPM", "Écart entre stock affiché et stock réel en magasin"),
        K("o-si-orch", "Orchestration des commandes", "Important", "TPM", "Capacité à router une commande vers le bon point d'expédition"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "OL1", label: "Point d'expédition", type: "decision", options: [
      { id: "oo-entrepot", label: "Entrepôt uniquement", impacts: { "o-dispo-rupture": "++", "o-dispo-charge": "++", "o-cout-livr": "+", "o-cout-retour": "+", "o-serv-promesse": "-", "o-si-justesse": "++" } },
      { id: "oo-magasin", label: "Expédition depuis les magasins", impacts: { "o-serv-promesse": "++", "o-cout-livr": "+", "o-cout-retour": "++", "o-dispo-rupture": "--", "o-dispo-charge": "--", "o-si-justesse": "--" } },
      { id: "oo-mixte", label: "Mixte piloté par la disponibilité", impacts: { "o-serv-promesse": "+", "o-dispo-rupture": "+", "o-cout-livr": "-", "o-si-orch": "-", "o-si-justesse": "-" } },
    ] },
    { id: "OL2", label: "Promesse annoncée", type: "decision", options: [
      { id: "oo-rapide", label: "Délai court affiché", impacts: { "o-serv-choix": "++", "o-cout-livr": "--", "o-cout-retour": "-", "o-serv-promesse": "-" } },
      { id: "oo-fiable", label: "Délai plus long mais garanti", impacts: { "o-serv-promesse": "++", "o-cout-livr": "+", "o-cout-retour": "+", "o-serv-choix": "-" } },
    ] },
    { id: "OL3", label: "Fiabilisation du stock", type: "technique", options: [
      { id: "oo-inv", label: "Inventaire tournant renforcé", impacts: { "o-si-justesse": "++", "o-dispo-charge": "-", "o-cout-livr": "0" } },
      { id: "oo-marge", label: "Marge de sécurité sur le stock exposé", impacts: { "o-si-justesse": "+", "o-serv-choix": "-", "o-dispo-rupture": "+" } },
    ] },
  ],
  scenarios: [
    S("o-s1", "Entrepôt + délai garanti", "#6366f1",
      "Toute la commande part de l'entrepôt, la promesse est plus longue mais tenue.",
      [["OL1", "Point d'expédition", "oo-entrepot"], ["OL2", "Promesse annoncée", "oo-fiable"], ["OL3", "Fiabilisation du stock", "oo-inv"]],
      "Le rayon est protégé et la promesse tenue ; le choix de créneaux reste le point faible."),
    S("o-s2", "Magasins + délai court", "#ef4444",
      "Expédition depuis les magasins pour raccourcir le délai affiché.",
      [["OL1", "Point d'expédition", "oo-magasin"], ["OL2", "Promesse annoncée", "oo-rapide"], ["OL3", "Fiabilisation du stock", "oo-marge"]],
      "Le délai affiché progresse mais la disponibilité en rayon — exigence non négociable — est dégradée au niveau rédhibitoire."),
    S("o-s3", "Mixte piloté par la disponibilité", "#10b981",
      "Routage de la commande vers l'entrepôt ou le magasin selon la disponibilité constatée.",
      [["OL1", "Point d'expédition", "oo-mixte"], ["OL2", "Promesse annoncée", "oo-fiable"], ["OL3", "Fiabilisation du stock", "oo-inv"]],
      "Aucun critère essentiel n'est dégradé ; le coût par commande devient le critère à instruire."),
  ],
};

/** Le pack Retail, dans l'ordre où il se vend. */
export const PACK_RETAIL: RetailCase[] = [OMNICANAL];

export function getRetailCase(key: string): RetailCase | undefined {
  return PACK_RETAIL.find(c => c.key === key);
}
