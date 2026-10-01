// decider-initiatives.ts — Initiatives du plan d'action de Décider, déduites
// du scénario retenu.
//
// AUCUN APPEL LLM ICI. Chaque initiative est DÉDUITE du modèle déjà validé par
// l'utilisateur : le levier, l'option retenue dans le scénario signé, les
// impacts ordinaux saisis ou confirmés, les besoins tracés par les MOE. Rien
// n'est inventé, rien n'est estimé, aucun chiffre n'est produit. Si une
// information manque (impact « ? », besoin non tracé), elle est REMONTÉE comme
// telle plutôt que comblée.

import type {
  AtelierSession, AtelierScenario, AtelierCriterion, AtelierLevierDef,
  QualitativeImpact, LeverType,
} from "./atelier-store";

/* ── 1. Index du modèle : chaque critère avec sa lignée ────────────────────── */

export interface CriterionRef {
  id: string;
  label: string;
  level: "MOE" | "MOP" | "TPM";
  /** Le MOE (objectif de mission) dont ce critère descend — lui-même si c'est un MOE. */
  moeId: string;
  moeLabel: string;
  moeNature?: "efficacite" | "cout" | "risque";
  moeBesoinTrace?: string;
  importance: AtelierCriterion["importance"];
  /** true si aucun enfant : c'est sur ces critères que les impacts sont portés. */
  leaf: boolean;
}

/** Aplatit l'arbre MOE → MOP → TPM en gardant la lignée de chaque nœud. */
export function indexCriteria(criteria: AtelierCriterion[]): Map<string, CriterionRef> {
  const map = new Map<string, CriterionRef>();

  function walk(c: AtelierCriterion, depth: number, moe: AtelierCriterion) {
    const level: CriterionRef["level"] = c.level ?? (depth === 0 ? "MOE" : depth === 1 ? "MOP" : "TPM");
    map.set(c.id, {
      id: c.id,
      label: c.label,
      level,
      moeId: moe.id,
      moeLabel: moe.label,
      moeNature: moe.nature,
      moeBesoinTrace: moe.besoinTrace,
      importance: c.importance,
      leaf: !c.children?.length,
    });
    for (const child of c.children ?? []) walk(child, depth + 1, moe);
  }

  for (const moe of criteria) walk(moe, 0, moe);
  return map;
}

/* ── 2. Une initiative de transformation dérivée d'un levier activé ────────── */

/** Une ligne de traçabilité : un critère du modèle et l'effet ordinal constaté. */
export interface TraceLine {
  criterionId: string;
  label: string;
  level: "MOE" | "MOP" | "TPM";
  moeLabel: string;
  impact: QualitativeImpact;
  /** true tant que ce jugement vient d'Aura et n'a pas été confirmé par un humain. */
  aConfirmer: boolean;
}

/**
 * La nature d'une initiative — déduite du TYPE du levier, jamais devinée.
 * C'est ce qui permet à Architecturer de savoir dans quelle famille de travail
 * ranger l'initiative sans rien réinterpréter.
 */
export type InitiativeNature =
  | "structurelle"      // technique / decision : le SI ou l'architecture bougent
  | "organisationnelle" // ressource : rôles, compétences, gouvernance
  | "operationnelle"    // temps / budget : cadence, séquencement, enveloppe
  | "maitrise_risque";  // risque : barrières, réversibilité, conformité

const NATURE_BY_LEVER: Record<LeverType, InitiativeNature> = {
  technique: "structurelle",
  decision: "structurelle",
  ressource: "organisationnelle",
  temps: "operationnelle",
  budget: "operationnelle",
  risque: "maitrise_risque",
  autre: "structurelle",
};

export const INITIATIVE_NATURE_LABEL: Record<InitiativeNature, string> = {
  structurelle: "Structurelle — architecture & systèmes",
  organisationnelle: "Organisationnelle — rôles & compétences",
  operationnelle: "Opérationnelle — cadence & séquencement",
  maitrise_risque: "Maîtrise du risque — barrières & réversibilité",
};

export interface DerivedInitiative {
  id: string;
  /** Titre proposé, toujours modifiable par l'utilisateur avant transfert. */
  titre: string;
  nature: InitiativeNature;
  levierId: string;
  levierLabel: string;
  levierType: LeverType;
  optionId: string;
  optionLabel: string;
  /** Justification qualitative saisie/proposée pour cette option — reprise telle quelle. */
  justification?: string;
  /** Option latérale (« on n'y avait pas pensé ») retenue dans le scénario signé. */
  exploratoire?: boolean;
  /** Ce que cette option apporte (δ⁺), critère par critère. */
  apports: TraceLine[];
  /** Ce qu'elle coûte ou dégrade (δ⁻), critère par critère. */
  couts: TraceLine[];
  /** Ce qui reste inconnu (« ? ») — remonté, jamais comblé. */
  inconnues: TraceLine[];
  /** Besoins tracés par les MOE concernés — la raison amont de l'initiative. */
  besoinsTraces: string[];
  /** Les critères à observer pour savoir si l'initiative tient ses effets. */
  indicateurs: string[];
  /** Les MOE que cette initiative met en jeu, ordonnés du plus important au moins. */
  objectifsEnJeu: { label: string; importance: AtelierCriterion["importance"]; nature?: string }[];
  /** Nombre de jugements encore non confirmés par un humain — signal de fiabilité. */
  aConfirmerCount: number;
}

const IMPORTANCE_RANK: Record<string, number> = { Essentiel: 3, Important: 2, Secondaire: 1, Faible: 0 };

/**
 * Dérive les initiatives de transformation du scénario retenu.
 * Un levier dont l'option retenue n'a AUCUN effet renseigné ne produit pas
 * d'initiative : on ne fabrique pas du travail sans justification dans le modèle.
 */
export function deriveInitiatives(session: AtelierSession, scenario: AtelierScenario): DerivedInitiative[] {
  const idx = indexCriteria(session.criteria ?? []);
  const out: DerivedInitiative[] = [];

  for (const sl of scenario.leviers ?? []) {
    const def: AtelierLevierDef | undefined =
      (session.leviersDef ?? []).find(d => d.id === sl.id) ??
      (session.leviersDef ?? []).find(d => d.label === sl.label);
    if (!def) continue;
    const opt = def.options.find(o => o.id === sl.valeur) ?? def.options.find(o => o.label === sl.valeur);
    if (!opt) continue;

    const apports: TraceLine[] = [];
    const couts: TraceLine[] = [];
    const inconnues: TraceLine[] = [];

    for (const [critId, impact] of Object.entries(opt.impacts ?? {})) {
      const ref = idx.get(critId);
      if (!ref) continue; // impact orphelin (critère supprimé depuis) — ignoré, jamais réattribué
      const line: TraceLine = {
        criterionId: critId,
        label: ref.label,
        level: ref.level,
        moeLabel: ref.moeLabel,
        impact,
        aConfirmer: Boolean(opt.impactOrigins?.[critId]),
      };
      if (impact === "++" || impact === "+") apports.push(line);
      else if (impact === "-" || impact === "--") couts.push(line);
      else if (impact === "U") inconnues.push(line);
    }

    if (!apports.length && !couts.length && !inconnues.length) continue;

    const strength = (i: QualitativeImpact) => (i === "++" || i === "--" ? 2 : 1);
    apports.sort((a, b) => strength(b.impact) - strength(a.impact));
    couts.sort((a, b) => strength(b.impact) - strength(a.impact));

    // Les MOE mis en jeu, dédupliqués et ordonnés par importance décroissante.
    const moeSeen = new Map<string, { label: string; importance: AtelierCriterion["importance"]; nature?: string }>();
    const besoins = new Set<string>();
    for (const l of [...apports, ...couts, ...inconnues]) {
      const ref = idx.get(l.criterionId);
      if (!ref) continue;
      const moe = idx.get(ref.moeId);
      if (moe && !moeSeen.has(moe.id)) {
        moeSeen.set(moe.id, { label: moe.label, importance: moe.importance, nature: moe.moeNature });
      }
      if (ref.moeBesoinTrace) besoins.add(ref.moeBesoinTrace);
    }
    const objectifsEnJeu = [...moeSeen.values()].sort(
      (a, b) => (IMPORTANCE_RANK[b.importance] ?? 0) - (IMPORTANCE_RANK[a.importance] ?? 0),
    );

    // Indicateurs : les critères les plus fins réellement touchés (TPM en
    // priorité — ce sont eux qui bougent quand l'initiative avance).
    const indicateurs = [...new Set(
      [...apports, ...couts]
        .filter(l => l.level === "TPM")
        .map(l => l.label),
    )];
    const indicateursFallback = indicateurs.length
      ? indicateurs
      : [...new Set([...apports, ...couts].map(l => l.label))];

    out.push({
      id: `init-${def.id}`,
      titre: `${def.label} — ${opt.label}`,
      nature: NATURE_BY_LEVER[def.type] ?? "structurelle",
      levierId: def.id,
      levierLabel: def.label,
      levierType: def.type,
      optionId: opt.id,
      optionLabel: opt.label,
      justification: opt.justification,
      exploratoire: opt.exploratoire,
      apports,
      couts,
      inconnues,
      besoinsTraces: [...besoins],
      indicateurs: indicateursFallback.slice(0, 6),
      objectifsEnJeu,
      aConfirmerCount: [...apports, ...couts, ...inconnues].filter(l => l.aConfirmer).length,
    });
  }

  // Ordre de présentation : d'abord ce qui met en jeu un objectif Essentiel,
  // puis ce qui apporte le plus. Aucun score, un tri ordinal.
  return out.sort((a, b) => {
    const ea = IMPORTANCE_RANK[a.objectifsEnJeu[0]?.importance ?? "Faible"] ?? 0;
    const eb = IMPORTANCE_RANK[b.objectifsEnJeu[0]?.importance ?? "Faible"] ?? 0;
    if (eb !== ea) return eb - ea;
    return b.apports.length - a.apports.length;
  });
}
