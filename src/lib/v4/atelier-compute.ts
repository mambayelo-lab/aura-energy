// atelier-compute.ts — extrait de cockpit.atelier.tsx (allègement, aucun
// changement de comportement) : helpers purs d'énumération de combinaisons,
// de parcours de l'arbre MOE/MOP/TPM et de lecture backward. Tout le calcul
// ordinal reste délégué au moteur protégé (lib/engine/lo).
import type {
  AtelierSession, AtelierCriterion, AtelierScenario, AtelierOptionDef, QualitativeImpact,
} from "./atelier-store";
import { aggregateCriterion, aggregateNode, thesisWeights, type ElementaryImpact } from "../engine/lo/aggregation";
import { ordNeg } from "../engine/lo/ordinal";
import type { OrdinalLevel, Attitude, RawCell } from "../engine/lo/types";

export const PAIR_TO_TEXT: Record<string, string> = {
  "H,N": "Très prometteuse", "H,L": "Très prometteuse", "H,M": "Prometteuse, à sécuriser", "H,H": "Très ambitieuse / exposée",
  "M,N": "Prometteuse", "M,L": "Prometteuse", "M,M": "Compromis", "M,H": "Risque élevé",
  "L,N": "Potentiel limité", "L,L": "Prudente", "L,M": "Fragile", "L,H": "À éviter",
  "N,N": "Stable / peu d'effet", "N,L": "Faible enjeu", "N,M": "Défavorable", "N,H": "À éviter",
};

// PS/NS qualitative scale → bipolar pair (Lo MCD-E thesis, Ch.IV)
// PS: ++ → δ⁺=H  + → δ⁺=M  0 → δ⁺=N
// NS: -- → δ⁻=H  - → δ⁻=M  0 → δ⁻=N
export const QUAL_IMPACT_MAP: Record<QualitativeImpact, ElementaryImpact> = {
  "++": { leverIndex: 0, gPlus: "H", dMinus: "N" },
  "+":  { leverIndex: 0, gPlus: "M", dMinus: "N" },
  "+L": { leverIndex: 0, gPlus: "L", dMinus: "N" },
  "0":  { leverIndex: 0, gPlus: "N", dMinus: "N" },
  "-L": { leverIndex: 0, gPlus: "N", dMinus: "L" },
  "-":  { leverIndex: 0, gPlus: "N", dMinus: "M" },
  "--": { leverIndex: 0, gPlus: "N", dMinus: "H" },
  "U":  { leverIndex: 0, gPlus: "U" as RawCell, dMinus: "U" as RawCell },
};

export function qualImpactToElementary(impact: QualitativeImpact, leverIndex = 0): ElementaryImpact {
  if (impact === "U") return { leverIndex, gPlus: "U" as RawCell, dMinus: "U" as RawCell };
  return { ...QUAL_IMPACT_MAP[impact], leverIndex };
}

// Labels affichés dans le sélecteur
export const QUAL_IMPACT_LABELS: Record<QualitativeImpact, { label: string; color: string; bg: string; title: string }> = {
  "++": { label: "++", color: "#047857", bg: "#d1fae5", title: "Forte amélioration" },
  "+":  { label: "+",  color: "#059669", bg: "#ecfdf5", title: "Amélioration" },
  "+L": { label: "+L", color: "#10b981", bg: "#f0fdf4", title: "Amélioration faible" },
  "-L": { label: "−L", color: "#f87171", bg: "#fff5f5", title: "Dégradation faible" },
  "0":  { label: "0",  color: "#9ca3af", bg: "#f3f4f6", title: "Effet évalué comme neutre" },
  "-":  { label: "−",  color: "#ef4444", bg: "#fef2f2", title: "Dégradation" },
  "--": { label: "−−", color: "#991b1b", bg: "#fee2e2", title: "Forte dégradation" },
  "U":  { label: "?",  color: "#8b5cf6", bg: "#f5f3ff", title: "Inconnu — information insuffisante" },
};

/** Ramène une réponse parlée à l'échelle ordinale du modèle — aucun chiffre introduit. */
export function matchImpactScale(text: string): QualitativeImpact | null {
  const t = text.toLowerCase();
  if (/(je ne sais pas|aucune idée|inconnu|pas d'info|incertain)/.test(t)) return "U";
  const strong = /(très|fortement|fort|beaucoup|majeur|massif|considérable)/.test(t);
  const neg = /(défavorable|dégrad|négatif|détérior|pénalis|mauvais|baisse|nuit|contre)/.test(t);
  const pos = /(favorable|amélior|positif|bénéfi|bon|renforce|augmente|aide|gain)/.test(t);
  if (neg) return strong ? "--" : "-";
  if (pos) return strong ? "++" : "+";
  if (/(neutre|sans effet|aucun effet|rien|indifférent)/.test(t)) return "0";
  return null;
}

// Maps ImportanceBadge → OrdinalLevel weight for Lo Stage 2
export function importanceToWeight(imp: import("./atelier-store").ImportanceBadge): OrdinalLevel {
  if (imp === "Essentiel")  return 3;
  if (imp === "Important")  return 2;
  if (imp === "Secondaire") return 1;
  return 0;
}

// Énumère TOUTES les combinaisons d'options par levier (odomètre en
// numération mixte). Aucun échantillonnage : si l'espace dépasse `cap`, rien
// n'est énuméré et `truncated` vaut true — l'appelant l'annonce comme un
// refus explicite et propose une réduction (regrouper des options), ou
// utilise le calcul exact par programmation dynamique (lo-search).
export function enumerateCombos(
  leviersDef: import("./atelier-store").AtelierLevierDef[],
  cap: number
): { combos: Record<string, string>[]; total: number; truncated: boolean } {
  const radices = leviersDef.map(lev => lev.options.length);
  const total = radices.reduce((a, b) => a * b, 1);
  if (total > cap) return { combos: [], total, truncated: true };
  const combos: Record<string, string>[] = [];
  for (let idx = 0; idx < total; idx++) {
    let rem = idx;
    const combo: Record<string, string> = {};
    for (let li = 0; li < leviersDef.length; li++) {
      const r = radices[li];
      combo[leviersDef[li].id] = leviersDef[li].options[rem % r].id;
      rem = Math.floor(rem / r);
    }
    combos.push(combo);
  }
  return { combos, total, truncated: false };
}

/** Message de refus (espace trop grand pour une énumération exhaustive) : jamais d'échantillon. */
export function refusalText(total: number, leviersDef: import("./atelier-store").AtelierLevierDef[], cap: number): string {
  const big = [...leviersDef].sort((a, b) => b.options.length - a.options.length).slice(0, 3).map(l => `« ${l.label} » (${l.options.length} options)`);
  return `${total.toLocaleString("fr-FR")} combinaisons : au-delà de ${cap.toLocaleString("fr-FR")}, Aura n'énumère pas et n'échantillonne jamais. Réduction proposée : regrouper des options proches dans ${big.join(", ")}, ou scinder la décision.`;
}

// ── Distribution exacte des issues possibles (δ⁺,δ⁻) sur TOUT l'espace ──────
// « Toutes les solutions possibles » n'a pas besoin d'un point SVG par
// combinaison : le moteur ordinal ne produit jamais plus de 4×4 = 16 couples
// (δ⁺,δ⁻) distincts (échelle N/L/M/H sur chaque axe). Il suffit donc de
// compter, pour chacun des ≤16 couples, COMBIEN de combinaisons y aboutissent
// — un histogramme 4×4, toujours léger à AFFICHER, quelle que soit la taille
// réelle de l'espace combinatoire (des dizaines à plusieurs millions).
//
// Le COMPTE, lui, doit toujours être EXACT — jamais une estimation par
// échantillon. Deux leviers pour y arriver sans jamais geler la page :
//
// 1) Déduplication par empreinte d'impact : si deux options d'un même
//    levier ont EXACTEMENT les mêmes impacts sur tous les critères, elles
//    sont interchangeables pour le résultat (δ⁺,δ⁻) — inutile de les
//    énumérer séparément. On les regroupe en une seule « classe » avec sa
//    multiplicité, ce qui réduit souvent très fortement l'espace réel à
//    parcourir (options « cosmétiques » identiques en impact, doublons…).
//    Le compte final par cellule est ensuite le produit exact des
//    multiplicités des classes choisies — toujours exact, jamais approché.
// 2) Calcul par blocs (générateur), repris entre deux « ticks » du
//    navigateur : même si l'espace dédupliqué reste énorme, la page ne
//    gèle jamais — elle affiche une progression ("X / Y calculées") et
//    converge vers le compte exact final, sans jamais plafonner ni
//    échantillonner.
export interface OutcomeCell { gPlus: OrdinalLevel; dMinus: OrdinalLevel; count: number; sample: Record<string, string> }
export interface OutcomeDistProgress { cells: OutcomeCell[]; rawTotal: number; effectiveTotal: number; computed: number; done: boolean }

export function* outcomeDistributionGen(
  leviersDef: import("./atelier-store").AtelierLevierDef[],
  criteria: AtelierCriterion[],
  optionIndex: Record<string, import("./atelier-store").AtelierOptionDef>,
  attCode: Attitude,
  prof: "prudent" | "optimiste",
): Generator<OutcomeDistProgress, OutcomeDistProgress, void> {
  const rawTotal = leviersDef.length ? leviersDef.reduce((a, lev) => a * Math.max(1, lev.options.length), 1) : 0;
  const grid = new Map<string, OutcomeCell>();
  if (rawTotal === 0) { const done = { cells: [], rawTotal: 0, effectiveTotal: 0, computed: 0, done: true }; return done; }

  // Classes d'options équivalentes (même empreinte d'impact) par levier.
  const classesByLever = leviersDef.map(lev => {
    const groups = new Map<string, { repId: string; count: number }>();
    for (const opt of lev.options) {
      const fp = JSON.stringify(Object.entries(opt.impacts ?? {}).sort(([a], [b]) => a.localeCompare(b)));
      const g = groups.get(fp);
      if (g) g.count++;
      else groups.set(fp, { repId: opt.id, count: 1 });
    }
    return [...groups.values()];
  });
  const radices = classesByLever.map(g => g.length);
  const effectiveTotal = radices.reduce((a, b) => a * b, 1);

  const weights = criteria.map(c => importanceToWeight(c.importance));
  const normW: OrdinalLevel[] = thesisWeights(weights); // éq. (9), poids tels quels

  const CHUNK = 500;
  for (let idx = 0; idx < effectiveTotal; idx++) {
    let rem = idx;
    const combo: Record<string, string> = {};
    let multiplicity = 1;
    for (let li = 0; li < leviersDef.length; li++) {
      const r = radices[li];
      const pos = rem % r;
      rem = Math.floor(rem / r);
      const cls = classesByLever[li][pos];
      combo[leviersDef[li].id] = cls.repId;
      multiplicity *= cls.count;
    }
    const pseudoSc: AtelierScenario = { id: "_dist", label: "", color: "", description: "", leviers: Object.entries(combo).map(([lid, vid]) => ({ id: lid, label: lid, valeur: vid, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
    const stage1 = criteria.map(c => aggregateHierarchy(c, pseudoSc, optionIndex, attCode, prof));
    let r2: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
    try { r2 = aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], normW.length ? normW : [3]) as { gPlus: OrdinalLevel; dMinus: OrdinalLevel }; }
    catch { r2 = { gPlus: 0, dMinus: 0 }; }
    const key = `${r2.gPlus},${r2.dMinus}`;
    const existing = grid.get(key);
    if (existing) existing.count += multiplicity;
    else grid.set(key, { gPlus: r2.gPlus, dMinus: r2.dMinus, count: multiplicity, sample: combo });

    if ((idx + 1) % CHUNK === 0) {
      yield { cells: [...grid.values()], rawTotal, effectiveTotal, computed: idx + 1, done: false };
    }
  }
  return { cells: [...grid.values()], rawTotal, effectiveTotal, computed: effectiveTotal, done: true };
}

// ── Retrouver les combinaisons de leviers qui aboutissent à un point (δ⁺,δ⁻)
// donné — un point du graphique peut correspondre à plusieurs combinaisons
// distinctes. On parcourt le même espace dédupliqué que la distribution et on
// garde les `maxResults` premières qui matchent exactement la cible ; le
// compte affiché sur le cercle reste la source de vérité du TOTAL exact,
// cette liste sert seulement à parcourir des exemples concrets et jouables.
export interface ComboMatch { combo: Record<string, string>; multiplicity: number }
export function findCombosForOutcome(
  leviersDef: import("./atelier-store").AtelierLevierDef[],
  criteria: AtelierCriterion[],
  optionIndex: Record<string, import("./atelier-store").AtelierOptionDef>,
  attCode: Attitude,
  prof: "prudent" | "optimiste",
  targetG: OrdinalLevel,
  targetD: OrdinalLevel,
  maxResults: number,
): { matches: ComboMatch[]; scannedAll: boolean } {
  const classesByLever = leviersDef.map(lev => {
    const groups = new Map<string, { repId: string; count: number }>();
    for (const opt of lev.options) {
      const fp = JSON.stringify(Object.entries(opt.impacts ?? {}).sort(([a], [b]) => a.localeCompare(b)));
      const g = groups.get(fp);
      if (g) g.count++;
      else groups.set(fp, { repId: opt.id, count: 1 });
    }
    return [...groups.values()];
  });
  const radices = classesByLever.map(g => g.length);
  const effectiveTotal = radices.length ? radices.reduce((a, b) => a * b, 1) : 0;
  const weights = criteria.map(c => importanceToWeight(c.importance));
  const normW: OrdinalLevel[] = thesisWeights(weights); // éq. (9), poids tels quels
  const matches: ComboMatch[] = [];
  let idx = 0;
  for (; idx < effectiveTotal && matches.length < maxResults; idx++) {
    let rem = idx;
    const combo: Record<string, string> = {};
    let multiplicity = 1;
    for (let li = 0; li < leviersDef.length; li++) {
      const r = radices[li];
      const pos = rem % r;
      rem = Math.floor(rem / r);
      const cls = classesByLever[li][pos];
      combo[leviersDef[li].id] = cls.repId;
      multiplicity *= cls.count;
    }
    const pseudoSc: AtelierScenario = { id: "_find", label: "", color: "", description: "", leviers: Object.entries(combo).map(([lid, vid]) => ({ id: lid, label: lid, valeur: vid, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
    const stage1 = criteria.map(c => aggregateHierarchy(c, pseudoSc, optionIndex, attCode, prof));
    let r2: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
    try { r2 = aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], normW.length ? normW : [3]) as { gPlus: OrdinalLevel; dMinus: OrdinalLevel }; }
    catch { r2 = { gPlus: 0, dMinus: 0 }; }
    if (r2.gPlus === targetG && r2.dMinus === targetD) matches.push({ combo, multiplicity });
  }
  return { matches, scannedAll: idx >= effectiveTotal };
}

// ── Hierarchical criterion helpers (MOE→MOP→TPM tree) ──────────────────────
// Returns all leaf criteria (no children) — impacts are defined at leaf level
export function getLeafCriteria(criteria: AtelierCriterion[]): AtelierCriterion[] {
  const leaves: AtelierCriterion[] = [];
  function collect(nodes: AtelierCriterion[]) {
    for (const n of nodes) {
      if (!n.children?.length) leaves.push(n);
      else collect(n.children);
    }
  }
  collect(criteria);
  return leaves;
}

// Returns all leaf criteria under a single node (recursive)
export function leafsOf(node: AtelierCriterion): AtelierCriterion[] {
  if (!node.children?.length) return [node];
  return node.children.flatMap(leafsOf);
}

// Deep update a criterion anywhere in the tree
export function updateCritDeep(
  criteria: AtelierCriterion[],
  id: string,
  updater: (c: AtelierCriterion) => AtelierCriterion,
): AtelierCriterion[] {
  return criteria.map(c => {
    if (c.id === id) return updater(c);
    if (c.children?.length) return { ...c, children: updateCritDeep(c.children, id, updater) };
    return c;
  });
}

// Deep remove a criterion anywhere in the tree
export function removeCritDeep(criteria: AtelierCriterion[], id: string): AtelierCriterion[] {
  return criteria
    .filter(c => c.id !== id)
    .map(c => c.children?.length ? { ...c, children: removeCritDeep(c.children, id) } : c);
}

// Add a child to a criterion anywhere in the tree
export function addChildDeep(criteria: AtelierCriterion[], parentId: string, child: AtelierCriterion): AtelierCriterion[] {
  return criteria.map(c => {
    if (c.id === parentId) return { ...c, children: [...(c.children ?? []), child] };
    if (c.children?.length) return { ...c, children: addChildDeep(c.children, parentId, child) };
    return c;
  });
}

// Recursive aggregation through the MOE/MOP/TPM tree (Lo MCD-E thesis, Ch.IV §5.2)
// • Leaf nodes (TPM or flat): Stage 1 = aggregateCriterion across lever options
// • Internal nodes (MOE/MOP): Stage 2 = aggregateNode over children with their ωᵢ weights
export function aggregateHierarchy(
  crit: AtelierCriterion,
  sc: AtelierScenario,
  optionIndex: Record<string, AtelierOptionDef>,
  attitudeCode: Attitude,
  profile: "prudent" | "optimiste",
): import("../engine/lo/types").OrdinalImpact {
  if (!crit.children?.length) {
    // Leaf → Stage 1: fuse iDDP impacts per oDDP (the criterion). Le résultat
    // ne dépend que du MULTISET des impacts qualitatifs des leviers qui
    // touchent la feuille (min/max sont symétriques) : mémoïsation exacte.
    const cells: string[] = [];
    for (const lev of sc.leviers) {
      const imp = optionIndex[lev.valeur]?.impacts[crit.id];
      if (imp !== undefined) cells.push(imp);
    }
    cells.sort();
    const key = `${profile}|${cells.join(",")}`;
    const hit = LEAF_CACHE.get(key);
    if (hit) return hit;
    const imps = cells.map((imp, li) => qualImpactToElementary(imp as QualitativeImpact, li));
    const tri = aggregateCriterion(imps.length ? imps : [qualImpactToElementary("0", 0)], attitudeCode);
    const res = tri[profile];
    if (LEAF_CACHE.size > 50_000) LEAF_CACHE.clear();
    LEAF_CACHE.set(key, res);
    return res;
  }
  // Internal node → Stage 2: δᵃᵗ = (min max(1−ωᵢ, δ⁺ᵢ), max min(ωᵢ, δ⁻ᵢ))
  const childResults = crit.children.map(child =>
    aggregateHierarchy(child, sc, optionIndex, attitudeCode, profile)
  );
  // Poids ω_i tels quels (éq. (9), thèse Lô p. 82) ; aucun poids exprimé → éq. (7).
  let normW = NORM_W_CACHE.get(crit.children);
  if (!normW) {
    normW = thesisWeights(crit.children.map(child => importanceToWeight(child.importance)));
    NORM_W_CACHE.set(crit.children, normW);
  }
  try {
    return aggregateNode(childResults, normW);
  } catch {
    return { gPlus: 0, dMinus: 0 };
  }
}

// Caches purement techniques (aucun effet sur les valeurs) : la fusion d'une
// feuille est une fonction du multiset d'impacts et du profil ; les poids
// normalisés d'une fratrie sont une fonction du tableau d'enfants (immuable).
const LEAF_CACHE = new Map<string, import("../engine/lo/types").OrdinalImpact>();
const NORM_W_CACHE = new WeakMap<AtelierCriterion[], OrdinalLevel[]>();

// ── Lecture "backward a posteriori" (thèse Lo, Eq.6) ──────────────────────────
// Pour un nœud parent déjà agrégé au seuil atteint τ = δ⁺_x, un enfant i est :
//   • "libre"(r_i = 0) si ¬ωᵢ ≥ τ — son poids est trop faible pour peser sur τ
//   • "requis" (r_i = 1) si ¬ωᵢ < τ — il doit lui-même atteindre τ pour que x l'atteigne
// Lecture purement locale (poids vs seuil), appliquée récursivement uniquement
// dans les branches "requises" (une branche "libre" n'est plus contrainte par τ).
export type BackwardEntry = { id: string; label: string; weight: OrdinalLevel };

export function explainBackwardChildren(
  nodes: AtelierCriterion[],
  threshold: OrdinalLevel,
): { required: BackwardEntry[]; free: BackwardEntry[] } {
  const weights = nodes.map(c => importanceToWeight(c.importance));
  const normW: OrdinalLevel[] = thesisWeights(weights);
  const required: BackwardEntry[] = [];
  const free: BackwardEntry[] = [];
  nodes.forEach((c, i) => {
    const negW = ordNeg(normW[i]);
    if (negW < threshold) {
      // requis : ce nœud doit lui-même atteindre τ
      if (c.children?.length) {
        const sub = explainBackwardChildren(c.children, threshold);
        required.push(...sub.required);
        free.push(...sub.free);
      } else {
        required.push({ id: c.id, label: c.label, weight: normW[i] });
      }
    } else {
      free.push({ id: c.id, label: c.label, weight: normW[i] });
    }
  });
  return { required, free };
}

// ── Cascade MOE→MOP→TPM : structure complète du nœud (résultat + statut backward) ──
// Construite une seule fois pour tout le sous-arbre, requise pour rendre à la
// fois le résumé exécutif (Niveau 1) et l'arbre complet (Niveau 2) à partir de
// la MÊME donnée — jamais deux calculs distincts pouvant diverger.
export type CascadeNode = {
  crit: AtelierCriterion;
  result: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
  weight: OrdinalLevel; // ωᵢ normalisé au sein de la fratrie
  required: boolean;    // sur le chemin déterminant (lecture backward, Eq.6)
  isLeaf: boolean;
  children: CascadeNode[];
};

export function buildCascadeNodes(
  nodes: AtelierCriterion[],
  sc: AtelierScenario,
  optionIndex: Record<string, AtelierOptionDef>,
  attCode: Attitude,
  prof: "prudent" | "optimiste",
  threshold: OrdinalLevel,
  parentOnPath: boolean,
): CascadeNode[] {
  const results = nodes.map(c => aggregateHierarchy(c, sc, optionIndex, attCode, prof));
  const weights = nodes.map(c => importanceToWeight(c.importance));
  const normW: OrdinalLevel[] = thesisWeights(weights);
  return nodes.map((c, i) => {
    const negW = ordNeg(normW[i]);
    const required = parentOnPath && negW < threshold;
    const isLeaf = !c.children?.length;
    const children = isLeaf ? [] : buildCascadeNodes(c.children!, sc, optionIndex, attCode, prof, threshold, required);
    return { crit: c, result: results[i], weight: normW[i], required, isLeaf, children };
  });
}

export function collectCascadeLeaves(nodes: CascadeNode[], onlyRequired: boolean): CascadeNode[] {
  const out: CascadeNode[] = [];
  for (const n of nodes) {
    if (onlyRequired && !n.required) continue;
    if (n.isLeaf) out.push(n);
    else out.push(...collectCascadeLeaves(n.children, onlyRequired));
  }
  return out;
}
