// pack-architecture-entreprise.ts — pack sectoriel Architecture d'entreprise :
// décisions de cible SI (globale vs locale, applicative, data), transverses à
// tout secteur métier. Même grammaire que les autres packs.
//
// S'appuie sur le même vocabulaire que architecture-patterns.ts (Entreprise /
// Applicative / Data / Infra) mais sous forme de cas déjà structurés, pour un
// démarrage en dizaine de minutes plutôt qu'une page blanche.
//
// Aucune valeur ici n'est une mesure réelle. Les niveaux sont des jugements de
// cadrage, ordinaux, tous éditables. Le moteur reste non compensatoire.

import type { SectorCase } from "./pack-energie";

/** Le pack Architecture d'entreprise. */
export const PACK_ARCHITECTURE_ENTREPRISE: SectorCase[] = [];

/**
 * Enjeux structurels (PESTEL) typiques des décisions d'architecture
 * d'entreprise, proposés comme point de départ éditable — jamais une donnée
 * vérifiée, seulement une formulation qualitative des tensions connues.
 */
export const EA_PESTEL_SEED: Record<string, string> = {
  P: "Exigences réglementaires sectorielles et souveraineté des données à vérifier selon les entités et pays concernés.",
  E: "Pression sur les budgets IT et exigence de démonstration de la valeur (TCO, time-to-market) avant tout engagement lourd.",
  S: "Résistance au changement dans les entités habituées à leur autonomie, rareté des compétences d'architecture transverse.",
  T: "Migration cloud et plateformes low-code changeant l'équilibre build/buy, dette technique freinant les cibles ambitieuses.",
  En: "Empreinte des infrastructures et centres de données à intégrer dans les critères de choix quand elle est significative.",
  L: "Contrats fournisseurs existants (lock-in), responsabilités contractuelles en cas de défaillance d'une plateforme partagée.",
};

/** Contexte expert transmis au LLM de génération quand ce pack est actif. */
export const EA_EXPERT_CONTEXT =
  "Décisions d'architecture d'entreprise : cadre TOGAF (vision, architecture métier/applicative/données), Business Capability Model. " +
  "Toujours faire ressortir explicitement le compromis cohérence groupe / autonomie locale, et le coût de gouvernance transverse — " +
  "jamais présumer qu'une cible centralisée ou qu'un data mesh est supérieur par principe.";
