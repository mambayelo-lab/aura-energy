// packs-sectoriels.ts — registre des packs sectoriels de Décider.
//
// Un pack = un secteur + des décisions déjà structurées avec son vocabulaire.
// Le prospect ne construit pas un modèle depuis une page blanche : il corrige
// un modèle sectoriel. Le cadrage passe de la séance à la dizaine de minutes.
//
// Aucun pack ne contient de mesure réelle : les niveaux sont des jugements de
// cadrage, ordinaux, tous éditables, et le moteur reste non compensatoire.

import { PACK_RETAIL } from "./pack-retail";
import { PACK_ENERGIE, type SectorCase } from "./pack-energie";
import { PACK_SUPPLY } from "./pack-supply";
import { PACK_DEMOS } from "./pack-demos";
import { PACK_ARCHITECTURE_ENTREPRISE, EA_PESTEL_SEED, EA_EXPERT_CONTEXT } from "./pack-architecture-entreprise";
import type { CaseTypeId } from "./atelier-cases";

/** Enjeux structurels (PESTEL) typiques du Supply chain, point de départ éditable. */
const SUPPLY_PESTEL_SEED: Record<string, string> = {
  P: "Tensions douanières, contrôles export/sanctions et exigences de traçabilité réglementaire (ex. devoir de vigilance) à vérifier selon les flux concernés.",
  E: "Volatilité des coûts de fret et des matières premières, pression sur les stocks immobilisés et le besoin en fonds de roulement.",
  S: "Tension sur les compétences logistiques et acceptabilité sociale des réorganisations de sites.",
  T: "Visibilité de la chaîne par capteurs/traçabilité numérique, outils de prévision de la demande de plus en plus fiables.",
  En: "Empreinte carbone du transport et des flux amont, pression réglementaire et client sur le scope 3.",
  L: "Clauses contractuelles fournisseurs (exclusivité, pénalités de retard), responsabilité en cas de rupture chez un sous-traitant.",
};

/** Contexte expert transmis au LLM de génération quand ce pack est actif. */
const SUPPLY_EXPERT_CONTEXT =
  "Décisions supply chain : toujours distinguer le risque de dépendance à une source unique (single-sourcing) du coût d'une " +
  "diversification, et faire ressortir explicitement le compromis résilience / coût d'immobilisation des stocks — jamais présumer " +
  "qu'une diversification ou qu'un stock de sécurité plus élevé est gratuit.";

export type { SectorCase };

export interface SectorPack {
  id: string;
  /** Titre du groupe dans la barre latérale. */
  label: string;
  /** Valeur portée par la session (champ `sector`). */
  sector: string;
  cases: SectorCase[];
  /**
   * Types de décision consolidés pour ce pack — restreint le sélecteur de
   * type à l'étape Comprendre quand ce pack est actif. Absent = pas de
   * restriction (les 7 types restent tous proposables).
   */
  decisionTypes?: CaseTypeId[];
  /**
   * Point de départ éditable pour les 6 dimensions PESTEL (id → texte),
   * reflétant des tensions structurelles connues du secteur — jamais une
   * donnée de marché datée ni un fait vérifié. Rempli seulement si
   * l'utilisateur n'a encore rien écrit sur la dimension concernée.
   */
  pestelSeed?: Record<string, string>;
  /**
   * Contexte expert transmis au LLM de génération du modèle (mêmes appels
   * déjà utilisés à l'étape Comprendre) quand ce pack est actif — vocabulaire
   * et compromis structurants du secteur, jamais une donnée factuelle datée.
   */
  expertContext?: string;
  /**
   * Reformule le sous-titre (`sub`) d'un type de décision pour ce pack —
   * le texte générique de `CASE_TYPES` (ex. "Acquisition · Capex ·
   * Portfolio") reste correct mais n'évoque pas le secteur ; ce champ le
   * remplace uniquement dans l'affichage de l'étape Comprendre, jamais dans
   * les autres packs. Absent = sous-titre générique inchangé.
   */
  caseSubOverrides?: Partial<Record<CaseTypeId, string>>;
}

/** Les packs, dans l'ordre de priorité commerciale. */
export const SECTOR_PACKS: SectorPack[] = [
  { id: "demos", label: "Cas démo enregistrés", sector: "Démonstrations", cases: PACK_DEMOS },
  { id: "retail", label: "Pack Retail", sector: "Retail & distribution", cases: PACK_RETAIL },
  { id: "energie", label: "Pack Énergie & Utilities", sector: "Énergie & Utilities", cases: PACK_ENERGIE },
  { id: "supply", label: "Pack Supply chain", sector: "Supply chain", cases: PACK_SUPPLY,
    decisionTypes: ["strategique", "operationnel", "risque", "investissement"],
    pestelSeed: SUPPLY_PESTEL_SEED,
    expertContext: SUPPLY_EXPERT_CONTEXT,
    caseSubOverrides: { investissement: "Rachat fournisseur · Capex logistique · Intégration verticale" } },
  // Pas de pack "Énergies renouvelables" séparé : ses cas (flexibilité,
  // nouvelle capacité) vivent désormais dans le pack Renewables & Flexible
  // Power ci-dessous — même GBU, pour ne jamais dupliquer un même terrain
  // dans deux packs différents.
  { id: "architecture-entreprise", label: "Pack Architecture d'entreprise", sector: "Architecture d'entreprise", cases: PACK_ARCHITECTURE_ENTREPRISE,
    decisionTypes: ["architecture", "strategique", "investissement"],
    pestelSeed: EA_PESTEL_SEED,
    expertContext: EA_EXPERT_CONTEXT },
];


/** Retrouve un cas et le secteur auquel il appartient. */
export function findSectorCase(key: string): { c: SectorCase; sector: string } | undefined {
  for (const p of SECTOR_PACKS) {
    const c = p.cases.find(x => x.key === key);
    if (c) return { c, sector: p.sector };
  }
  return undefined;
}

/** Retrouve le pack correspondant à une valeur de session.sector, si connue. */
export function findPackBySector(sector: string | undefined): SectorPack | undefined {
  if (!sector) return undefined;
  return SECTOR_PACKS.find(p => p.sector === sector);
}

/**
 * Contexte expert du pack actif, prêt à être ajouté à la fin d'un
 * `companyContext` déjà transmis aux appels LLM existants (génération du
 * modèle, questions discriminantes...) — même mécanisme que le contexte
 * entreprise, jamais un chemin séparé.
 */
export function packExpertContextBlock(sector: string | undefined): string {
  const ctx = findPackBySector(sector)?.expertContext;
  return ctx ? `\n\n--- Contexte sectoriel (${sector}) ---\n${ctx}\n---` : "";
}
