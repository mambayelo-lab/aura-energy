// bora.ts — NOUVEAU. Identité citable du moteur de raisonnement d'Aura.
//
// ── Pourquoi ce fichier existe ────────────────────────────────────────────
// Le principal actif de 1000minds n'est pas leur interface : c'est PAPRIKA,
// une méthode NOMMÉE, publiée et citable. Une thèse qui n'a pas de nom ne
// devient jamais un standard. On donne donc au moteur ordinal bipolaire
// d'Aura un nom, une version, des axiomes énoncés, et un jeu d'exemples
// reproductibles auxquels un lecteur peut se référer.
//
// BORA ne contient AUCUN calcul : le calcul reste dans
// lib/engine/lo/aggregation.ts (agrégation bipolaire) et
// lib/v4/arbitrage-analytics.ts (lectures). Ce module est déclaratif —
// c'est la carte d'identité de la méthode, pas une seconde implémentation.

export const BORA = {
  acronym: "BORA",
  name: "Bipolar Ordinal Reasoning Aggregation",
  version: "1.0",
  /** Une phrase — celle qui doit être citée. */
  claim:
    "BORA agrège des jugements d'experts sans les convertir en nombres : chaque option est décrite par ce qu'elle apporte (δ⁺) et par ce qu'elle coûte ou risque (δ⁻), et les options sont comparées par ordre lexicographique le long d'une hiérarchie de critères — jamais par moyenne pondérée.",
  citation:
    "Lo, M. — BORA : Bipolar Ordinal Reasoning Aggregation, v1.0. Moteur de raisonnement de la méthode AURA (Augmented Unified Reasoning Architecture).",
} as const;

/** Les axiomes : ce que le moteur garantit, et ce qu'il refuse. */
export const BORA_AXIOMS: { id: string; label: string; statement: string }[] = [
  {
    id: "A1",
    label: "Non-compensation",
    statement:
      "Un niveau rédhibitoire sur un critère ne peut être racheté par aucun autre critère. Un critère éliminatoire reste éliminatoire.",
  },
  {
    id: "A2",
    label: "Bipolarité",
    statement:
      "L'apport (δ⁺) et le coût ou risque (δ⁻) sont deux dimensions distinctes et non interchangeables. Elles ne sont jamais soustraites l'une de l'autre.",
  },
  {
    id: "A3",
    label: "Invariance d'échelle",
    statement:
      "Seul l'ordre des niveaux porte l'information. Renommer ou réétaler les niveaux ne change aucun résultat.",
  },
  {
    id: "A4",
    label: "Priorité lexicographique",
    statement:
      "L'importance des critères est un ORDRE, pas un poids. La comparaison suit cet ordre, du plus important au moins important.",
  },
  {
    id: "A5",
    label: "Reproductibilité",
    statement:
      "Un même modèle produit exactement la même conclusion, indéfiniment. Aucune part d'aléatoire, aucun réglage caché.",
  },
  {
    id: "A6",
    label: "Traçabilité des hypothèses",
    statement:
      "Toute hypothèse explorée par l'agent est journalisée : critère touché, sens du déplacement, conséquence. Une exploration sans trace détruit l'opposabilité.",
  },
];

/** Jeux d'exemples reproductibles — la preuve publique de la méthode. */
export const BORA_EXAMPLES: { id: string; label: string; what: string; where: string }[] = [
  {
    id: "retail-assortiment",
    label: "Retail — arbitrage d'assortiment",
    what: "Marque propre contre marque nationale sur une catégorie, six critères, quatre parties prenantes qui ne s'accordent pas.",
    where: "/cockpit/cas-references",
  },
  {
    id: "utilities-patrimoine",
    label: "Utilities — renouvellement de patrimoine",
    what: "Priorisation d'actifs industriels sur quinze ans, sans donnée probante disponible au moment du choix.",
    where: "/cockpit/cas-references",
  },
  {
    id: "si-eti",
    label: "Direction SI — choix de socle",
    what: "Sélection d'une solution structurante : dominance, robustesse ordinale et plan de rattrapage fournisseur.",
    where: "/cockpit/atelier",
  },
];

/* ── Journal de l'agent (axiome A6) ──────────────────────────────────────── */
//
// L'agent « et si ? » teste des alternatives. S'il explore sans laisser de
// trace, la décision n'est plus opposable : personne ne peut savoir ce qui a
// été essayé. Le journal reconstruit, de façon déterministe et à partir des
// seuls rapports déjà calculés, la liste exhaustive des hypothèses testées.
// Il n'ajoute aucun calcul : il rend visible ce qui a été fait.

export type JournalKind = "lecture" | "resistance" | "rattrapage" | "composition" | "robustesse";

export interface JournalEntry {
  kind: JournalKind;
  /** L'hypothèse, énoncée en français. */
  hypothese: string;
  /** Ce que le modèle a répondu. */
  consequence: string;
}

export interface AgentJournal {
  entries: JournalEntry[];
  /** Nombre total d'hypothèses évaluées, toutes familles confondues. */
  tested: number;
  headline: string;
}

/** Construit le journal à partir des rapports de l'agent et de la robustesse. */
export function buildAgentJournal(input: {
  readings?: { total: number; exhaustive: boolean; scores: { sc: { label: string }; wins: number }[] } | null;
  stress?: { winnerLabel: string; points: { critLabel: string; holds: boolean; newWinnerLabel?: string }[] } | null;
  repair?: { plans: { scLabel: string; crits: string[]; possible: boolean }[] } | null;
  composite?: { lines: { critLabel: string; bestScLabel: string }[] } | null;
  flips?: { critLabel: string; steps: number; newWinnerLabel: string }[];
}): AgentJournal {
  const entries: JournalEntry[] = [];
  let tested = 0;

  if (input.readings) {
    tested += input.readings.total;
    entries.push({
      kind: "lecture",
      hypothese: `Rejouer la décision sous ${input.readings.total} hiérarchies d'importance${input.readings.exhaustive ? " (exhaustif)" : " (rotations déterministes)"}.`,
      consequence: input.readings.scores
        .slice(0, 3)
        .map(s => `${s.sc.label} : ${s.wins} lectures gagnées`)
        .join(" · "),
    });
  }

  for (const p of input.stress?.points ?? []) {
    tested += 1;
    entries.push({
      kind: "resistance",
      hypothese: `Retirer un cran à ${input.stress!.winnerLabel} sur « ${p.critLabel} ».`,
      consequence: p.holds ? "Reste première." : `Bascule vers ${p.newWinnerLabel}.`,
    });
  }

  for (const f of input.flips ?? []) {
    tested += 1;
    entries.push({
      kind: "robustesse",
      hypothese: `Déplacer l'importance de « ${f.critLabel} » de ${f.steps} cran${f.steps > 1 ? "s" : ""}.`,
      consequence: `${f.newWinnerLabel} passe devant.`,
    });
  }

  for (const p of input.repair?.plans ?? []) {
    tested += 1;
    entries.push({
      kind: "rattrapage",
      hypothese: `Faire gagner un cran à ${p.scLabel} sur le plus petit ensemble de critères possible.`,
      consequence: p.possible
        ? `Repasse devant avec ${p.crits.map(c => `« ${c} »`).join(" et ")}.`
        : "Ne repasse pas devant, même sur deux critères.",
    });
  }

  if (input.composite?.lines?.length) {
    tested += 1;
    entries.push({
      kind: "composition",
      hypothese: "Composer une option idéale en relevant le meilleur niveau atteint sur chaque critère.",
      consequence: input.composite.lines.map(l => `${l.critLabel} → ${l.bestScLabel}`).join(" · "),
    });
  }

  return {
    entries,
    tested,
    headline: `${tested} hypothèses évaluées, ${entries.length} enregistrées au journal. Toute conclusion de l'agent est rejouable à l'identique (BORA ${BORA.version}, axiome A6).`,
  };
}
