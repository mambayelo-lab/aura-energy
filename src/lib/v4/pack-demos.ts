// pack-demos.ts — cas de démonstration enregistrés, prêts à l'arbitrage.
//
// Cinq cas volontairement denses : beaucoup d'objectifs (MOE → MOP → TPM) et
// beaucoup de leviers d'action, pour montrer le comportement du moteur ordinal
// quand le modèle est réellement chargé — là où un tableur devient illisible.
//
// Aucune valeur n'est une mesure réelle. Les niveaux sont des jugements de
// cadrage, ordinaux, tous éditables, et le moteur reste non compensatoire :
// une exigence essentielle dégradée au niveau rédhibitoire ne se rachète pas
// par un gain ailleurs.

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

// ══ Cas 3 — Make or Buy sur une solution SI de GenAI ══════════════════════════
const GENAI: SectorCase = {
  key: "demo-genai-make-or-buy",
  bouton: "Make or Buy — solution SI de GenAI",
  title: "Assistant GenAI métier — construire, acheter ou assembler",
  contextRaw:
    "Une direction des systèmes d'information doit doter ses métiers d'un assistant GenAI (recherche documentaire, rédaction assistée, synthèse de dossiers). Trois voies : construire une solution interne sur des modèles hébergés, acheter une solution éditeur, ou assembler des briques sur une plateforme managée. La décision engage la maîtrise des données, le coût récurrent, la vitesse de mise à disposition et la dépendance à un fournisseur.",
  caseType: "operationnel",
  objectif: "Mettre un assistant fiable à disposition des métiers sans céder la maîtrise des données ni s'enfermer chez un fournisseur",
  horizon: "12 à 18 mois",
  decideurs: "DSI · Direction juridique et conformité · Direction financière · Sponsors métiers",
  impactes: "Métiers utilisateurs, équipes d'exploitation, délégué à la protection des données, achats, éditeurs candidats",
  exigencesNonNeg: "Aucune donnée confidentielle sortie du périmètre autorisé · traçabilité des réponses · réversibilité contractuelle",
  risques: [
    "Fuite ou usage non maîtrisé de données confidentielles",
    "Enfermement chez un fournisseur sans réversibilité réelle",
    "Coût récurrent croissant avec l'usage",
    "Adoption faible faute d'intégration aux outils métiers",
    "Réponses non traçables opposées à un client ou à un auditeur",
  ],
  criteria: [
    K("a-souv", "Maîtrise des données et conformité", "Essentiel", "MOE", "Ce qui ne se rattrape pas après un incident", [
      K("a-souv-loc", "Localisation et cloisonnement", "Essentiel", "MOP", "Où vont les données, et qui peut les lire", [
        K("a-souv-heberg", "Périmètre d'hébergement", "Essentiel", "TPM", "Conformité du lieu de traitement au périmètre autorisé"),
        K("a-souv-entrain", "Non-réutilisation pour entraînement", "Essentiel", "TPM", "Garantie contractuelle et technique de non-réutilisation"),
      ]),
      K("a-souv-trace", "Traçabilité des réponses", "Essentiel", "MOP", "Ce qu'on peut démontrer après coup", [
        K("a-souv-source", "Citation des sources", "Essentiel", "TPM", "Rattachement de chaque réponse à des documents identifiés"),
        K("a-souv-audit", "Journal d'audit des usages", "Important", "TPM", "Capacité à reconstituer qui a demandé quoi"),
      ]),
    ]),
    K("a-val", "Valeur d'usage pour les métiers", "Essentiel", "MOE", "Ce que les utilisateurs en font réellement", [
      K("a-val-qual", "Qualité des réponses", "Essentiel", "MOP", "Ce qui décide de la confiance", [
        K("a-val-pertin", "Pertinence sur le corpus métier", "Essentiel", "TPM", "Justesse sur les documents et le vocabulaire de la maison"),
        K("a-val-halluc", "Maîtrise des réponses inventées", "Essentiel", "TPM", "Fréquence des affirmations non étayées"),
      ]),
      K("a-val-integ", "Intégration au poste de travail", "Important", "MOP", "Ce qui décide de l'adoption", [
        K("a-val-outils", "Intégration aux outils existants", "Important", "TPM", "Présence de l'assistant dans les outils déjà utilisés"),
        K("a-val-adopt", "Effort d'appropriation", "Important", "TPM", "Charge d'accompagnement au démarrage"),
      ]),
    ]),
    K("a-eco", "Économie de la solution", "Important", "MOE", "Ce que ça coûte à l'échelle, pas au pilote", [
      K("a-eco-cout", "Structure de coût", "Important", "MOP", "Comment la facture évolue avec l'usage", [
        K("a-eco-init", "Coût initial", "Important", "TPM", "Investissement de mise en place"),
        K("a-eco-recur", "Coût récurrent à l'usage", "Essentiel", "TPM", "Sensibilité de la facture à la montée en charge"),
      ]),
      K("a-eco-comp", "Compétences mobilisées", "Important", "MOP", "Ce qu'il faut avoir en interne", [
        K("a-eco-rares", "Dépendance à des profils rares", "Important", "TPM", "Exposition au marché des compétences spécialisées"),
        K("a-eco-run", "Charge d'exploitation", "Important", "TPM", "Effort de maintien en service et de mise à jour"),
      ]),
    ]),
    K("a-dep", "Dépendance et réversibilité", "Essentiel", "MOE", "Ce qui décide de la liberté à trois ans", [
      K("a-dep-four", "Dépendance fournisseur", "Essentiel", "MOP", "Ce qu'un changement de fournisseur coûterait", [
        K("a-dep-verrou", "Verrouillage technique", "Essentiel", "TPM", "Effort de sortie sur les données et les intégrations"),
        K("a-dep-modele", "Substituabilité du modèle", "Important", "TPM", "Capacité à changer de modèle sans refaire la solution"),
      ]),
    ]),
    K("a-del", "Délai de mise à disposition", "Important", "MOE", "Ce que le calendrier permet", [
      K("a-del-mvp", "Premier usage en production", "Important", "MOP", "Le temps jusqu'au premier vrai usage", [
        K("a-del-pilote", "Délai jusqu'au pilote", "Important", "TPM", "Temps avant mise en main d'un premier métier"),
        K("a-del-gen", "Délai de généralisation", "Important", "TPM", "Temps avant mise à disposition de tous les métiers"),
      ]),
    ]),
  ],
  leviersDef: [
    { id: "AL1", label: "Voie de réalisation", type: "decision", options: [
      { id: "ao-make", label: "Construire en interne", impacts: { "a-souv-heberg": "++", "a-souv-entrain": "++", "a-dep-verrou": "++", "a-dep-modele": "++", "a-eco-init": "--", "a-eco-rares": "--", "a-eco-run": "--", "a-del-pilote": "--", "a-del-gen": "--", "a-val-outils": "-" }, justification: "Maîtrise maximale, mais délai et compétences internes deviennent le point de rupture." },
      { id: "ao-buy", label: "Acheter une solution éditeur", impacts: { "a-del-pilote": "++", "a-del-gen": "++", "a-val-outils": "++", "a-eco-init": "+", "a-eco-run": "+", "a-souv-entrain": "-", "a-dep-verrou": "--", "a-dep-modele": "--", "a-eco-recur": "--" }, justification: "Le plus rapide et le plus intégré, au prix d'une dépendance forte." },
      { id: "ao-assemble", label: "Assembler sur plateforme managée", impacts: { "a-del-pilote": "+", "a-del-gen": "+", "a-souv-heberg": "+", "a-dep-modele": "+", "a-dep-verrou": "0", "a-eco-recur": "-", "a-eco-rares": "-", "a-val-outils": "+" }, justification: "Compromis : dépendance sur la plateforme, liberté conservée sur le modèle." },
    ] },
    { id: "AL2", label: "Hébergement des traitements", type: "technique", options: [
      { id: "ao-heb-prive", label: "Hébergement dans le périmètre interne", impacts: { "a-souv-heberg": "++", "a-souv-entrain": "++", "a-eco-init": "--", "a-eco-run": "--", "a-del-pilote": "-" } },
      { id: "ao-heb-souverain", label: "Cloud sous clause de localisation", impacts: { "a-souv-heberg": "+", "a-souv-entrain": "+", "a-eco-init": "+", "a-eco-recur": "-" } },
      { id: "ao-heb-public", label: "Service public standard", impacts: { "a-souv-heberg": "--", "a-souv-entrain": "-", "a-eco-init": "++", "a-del-pilote": "++", "a-eco-recur": "-" } },
    ] },
    { id: "AL3", label: "Ancrage documentaire", type: "technique", options: [
      { id: "ao-rag-strict", label: "Réponses strictement ancrées avec citation obligatoire", impacts: { "a-souv-source": "++", "a-val-halluc": "++", "a-val-pertin": "+", "a-del-pilote": "-", "a-eco-init": "-" } },
      { id: "ao-rag-souple", label: "Ancrage documentaire avec réponses libres autorisées", impacts: { "a-val-pertin": "+", "a-val-halluc": "--", "a-souv-source": "-", "a-del-pilote": "+" } },
      { id: "ao-rag-non", label: "Aucun ancrage documentaire", impacts: { "a-val-halluc": "--", "a-souv-source": "--", "a-del-pilote": "++", "a-eco-init": "++" } },
    ] },
    { id: "AL4", label: "Périmètre de démarrage", type: "decision", options: [
      { id: "ao-per-1metier", label: "Un métier pilote, corpus délimité", impacts: { "a-val-pertin": "++", "a-val-adopt": "++", "a-del-pilote": "++", "a-del-gen": "-", "a-eco-init": "+" } },
      { id: "ao-per-transverse", label: "Déploiement transverse dès le départ", impacts: { "a-del-gen": "++", "a-val-pertin": "--", "a-val-adopt": "--", "a-eco-recur": "-", "a-souv-audit": "-" } },
    ] },
    { id: "AL5", label: "Contrat et réversibilité", type: "risque", options: [
      { id: "ao-con-rev", label: "Clause de réversibilité et export des données négociée", impacts: { "a-dep-verrou": "++", "a-souv-entrain": "+", "a-eco-recur": "-", "a-del-pilote": "-" } },
      { id: "ao-con-std", label: "Conditions standard du fournisseur", impacts: { "a-del-pilote": "++", "a-dep-verrou": "--", "a-souv-entrain": "--" } },
    ] },
    { id: "AL6", label: "Modèle de coût", type: "budget", options: [
      { id: "ao-cout-usage", label: "Facturation à l'usage", impacts: { "a-eco-init": "++", "a-eco-recur": "--" } },
      { id: "ao-cout-forfait", label: "Forfait par utilisateur", impacts: { "a-eco-recur": "+", "a-eco-init": "0" } },
      { id: "ao-cout-capacite", label: "Capacité réservée", impacts: { "a-eco-recur": "++", "a-eco-init": "--", "a-eco-run": "-" } },
    ] },
  ],
  scenarios: [
    S("a-s1", "Achat rapide en conditions standard", "#dc2626",
      "Solution éditeur, service public standard, conditions contractuelles standard.",
      [["AL1", "Voie de réalisation", "ao-buy"], ["AL2", "Hébergement des traitements", "ao-heb-public"], ["AL3", "Ancrage documentaire", "ao-rag-souple"], ["AL4", "Périmètre de démarrage", "ao-per-transverse"], ["AL5", "Contrat et réversibilité", "ao-con-std"], ["AL6", "Modèle de coût", "ao-cout-usage"]],
      "Le délai est excellent, mais périmètre d'hébergement, non-réutilisation et verrouillage tombent au niveau rédhibitoire — trois exigences essentielles, aucune compensable."),
    S("a-s2", "Assemblage maîtrisé, pilote ciblé", "#10b981",
      "Assemblage sur plateforme managée, localisation contractuelle, citation obligatoire, un métier pilote, réversibilité négociée.",
      [["AL1", "Voie de réalisation", "ao-assemble"], ["AL2", "Hébergement des traitements", "ao-heb-souverain"], ["AL3", "Ancrage documentaire", "ao-rag-strict"], ["AL4", "Périmètre de démarrage", "ao-per-1metier"], ["AL5", "Contrat et réversibilité", "ao-con-rev"], ["AL6", "Modèle de coût", "ao-cout-forfait"]],
      "Aucune exigence essentielle dégradée au niveau rédhibitoire ; le coût récurrent reste le point à instruire avant généralisation."),
    S("a-s3", "Construction interne intégrale", "#6366f1",
      "Construction interne, hébergement dans le périmètre, citation obligatoire, capacité réservée.",
      [["AL1", "Voie de réalisation", "ao-make"], ["AL2", "Hébergement des traitements", "ao-heb-prive"], ["AL3", "Ancrage documentaire", "ao-rag-strict"], ["AL4", "Périmètre de démarrage", "ao-per-1metier"], ["AL5", "Contrat et réversibilité", "ao-con-rev"], ["AL6", "Modèle de coût", "ao-cout-capacite"]],
      "La maîtrise est maximale, mais le délai et la dépendance à des profils rares se dégradent ensemble — c'est ce couple qui décide, pas le coût."),
    S("a-s4", "Éditeur sous contrainte négociée", "#f59e0b",
      "Solution éditeur, localisation contractuelle, réversibilité négociée, pilote ciblé.",
      [["AL1", "Voie de réalisation", "ao-buy"], ["AL2", "Hébergement des traitements", "ao-heb-souverain"], ["AL3", "Ancrage documentaire", "ao-rag-strict"], ["AL4", "Périmètre de démarrage", "ao-per-1metier"], ["AL5", "Contrat et réversibilité", "ao-con-rev"], ["AL6", "Modèle de coût", "ao-cout-forfait"]],
      "Le verrouillage technique reste dégradé mais plus rédhibitoire : c'est le scénario qui rapproche le plus délai et conformité."),
  ],
};

/** Les cinq cas démo, dans l'ordre de présentation. */
export const PACK_DEMOS: SectorCase[] = [GENAI];
