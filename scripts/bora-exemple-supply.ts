/**
 * Exemple déroulé du guide « Bora : raisonnement forward et backward,
 * support mathématique » (docs/guides/bora-forward-backward.tex) :
 * Maison Lucie (données de démonstration), perturbation du détroit de
 * Bab el-Mandeb (mer Rouge) et fournisseur unique.
 *
 * Ce script n'implémente AUCUN calcul : il appelle le moteur réel
 * (src/lib/engine/lo/aggregation.ts pour le forward, src/lib/v4/exhaustive-search.ts
 * pour la recherche des réparations minimales) et imprime les valeurs
 * reportées dans le PDF. Exécution : npx tsx scripts/bora-exemple-supply.ts
 */
import { aggregateCriterion, aggregateNode, compareASC, type ElementaryImpact } from "../src/lib/engine/lo/aggregation";
import type { Attitude, OrdinalImpact, OrdinalLevel, RawCell } from "../src/lib/engine/lo/types";
import { searchMinimalRepairs } from "../src/lib/v4/exhaustive-search";

const S = ["N", "L", "M", "H"] as const;
const fmt = (p: OrdinalImpact) => `(${p.gPlus === 0 ? "NUL" : S[p.gPlus]}, ${p.dMinus === 0 ? "NUL" : S[p.dMinus]})`;

// oDDP (TPM)
const TPM = ["t1", "t2", "t3", "t4"] as const; // délai, service, exposition, coût
type Tpm = typeof TPM[number];
// Avis : "+M" amélioration, "-H" détérioration, "?" inconnu ; absent = sans effet.
type Avis = Partial<Record<Tpm, string>>;
const LEVIERS: { id: string; valeurs: Record<string, Avis> }[] = [
  { id: "x1", valeurs: { // route
    S: { t1: "+M", t3: "-H", t4: "+L" },            // Suez / mer Rouge
    C: { t1: "-M", t2: "?", t3: "+M", t4: "-L" },   // cap de Bonne-Espérance
    A: { t1: "+H", t2: "+M", t3: "+L", t4: "-H" },  // mer-air sur références critiques
  } },
  { id: "x2", valeurs: { // sourcing
    U: { t3: "-M" },                                // fournisseur unique en Asie
    D: { t2: "+L", t3: "+H", t4: "-M" },            // double sourcing européen
  } },
  { id: "x3", valeurs: { // stock
    A: { t2: "-L" },                                // stock actuel
    R: { t2: "+H", t4: "-M" },                      // stock de sécurité renforcé
  } },
];
// Hiérarchie TPM → MOP → MOE et poids ω (tels quels)
const MOP = {
  P1: { fils: ["t1", "t2"] as Tpm[], w: [2, 3] as OrdinalLevel[] },   // fiabilité du flux : délai M, service H
  P2: { fils: ["t3", "t4"] as Tpm[], w: [3, 1] as OrdinalLevel[] },   // risque et coût : exposition H, coût L
};
const MOE_W: OrdinalLevel[] = [3, 2]; // P1 H (Essentiel), P2 M

const cellOf = (a: string | undefined, j: number): ElementaryImpact => {
  if (!a) return { leverIndex: j, gPlus: "N", dMinus: "N" };
  if (a === "?") return { leverIndex: j, gPlus: "U", dMinus: "U" };
  return a[0] === "-" ? { leverIndex: j, gPlus: "N", dMinus: a[1] as RawCell } : { leverIndex: j, gPlus: a[1] as RawCell, dMinus: "N" };
};

type Cfg = Record<string, string>;
function forward(x: Cfg, at: Attitude) {
  const tpm = {} as Record<Tpm, OrdinalImpact>;
  for (const i of TPM) {
    const cells = LEVIERS.map((l, j) => cellOf(l.valeurs[x[l.id]][i], j));
    const r = aggregateCriterion(cells, at);
    tpm[i] = at === 1 ? r.prudent : r.optimiste;
  }
  const P1 = aggregateNode(MOP.P1.fils.map(i => tpm[i]), MOP.P1.w);
  const P2 = aggregateNode(MOP.P2.fils.map(i => tpm[i]), MOP.P2.w);
  const E = aggregateNode([P1, P2], MOE_W);
  return { tpm, P1, P2, E };
}
// Cible : δ⁺(E) ≥ L, δ⁻(E) ≤ L ; point bloquant : objectif Essentiel P1 avec δ⁻ > NUL.
const valid = (x: Cfg, at: Attitude) => { const f = forward(x, at); return f.E.gPlus >= 1 && f.E.dMinus <= 1 && f.P1.dMinus === 0; };

const all: Cfg[] = [];
for (const a of Object.keys(LEVIERS[0].valeurs)) for (const b of Object.keys(LEVIERS[1].valeurs)) for (const c of Object.keys(LEVIERS[2].valeurs)) all.push({ x1: a, x2: b, x3: c });
const name = (x: Cfg) => `(${x.x1},${x.x2},${x.x3})`;

for (const at of [1, 2] as Attitude[]) {
  console.log(`\n=== at = ${at} ===`);
  const base = { x1: "S", x2: "U", x3: "A" };
  const f0 = forward(base, at);
  console.log("x0 TPM", TPM.map(i => `${i}=${fmt(f0.tpm[i])}`).join(" "), "P1", fmt(f0.P1), "P2", fmt(f0.P2), "E", fmt(f0.E), "valide", valid(base, at));
  for (const x of all) { const f = forward(x, at); console.log(name(x), TPM.map(i => fmt(f.tpm[i])).join(" "), "| P1", fmt(f.P1), "P2", fmt(f.P2), "E", fmt(f.E), valid(x, at) ? "VALIDE" : ""); }
  const r = searchMinimalRepairs({ levers: LEVIERS.map(l => ({ id: l.id, optionIds: Object.keys(l.valeurs) })), base, isValid: x => valid(x, at) });
  console.log("backward: k*", r.minSize, "complete", r.complete, "evaluated", r.evaluated, "|X|", r.spaceSize, "repairs", r.repairs.map(z => name(z.config)).join(" "));
  const sols = all.filter(x => valid(x, at));
  console.log("S* (toutes solutions)", sols.map(name).join(" "));
  const best = [...all].sort((a, b) => compareASC(forward(b, at).E, forward(a, at).E))[0];
  console.log("meilleure ASC (ordre p.83, sans filtre)", name(best), fmt(forward(best, at).E));
}

// Détail du backward : candidates par niveau de coût depuis x0, avec la raison d'échec.
for (const at of [1, 2] as Attitude[]) {
  const base: Cfg = { x1: "S", x2: "U", x3: "A" };
  console.log(`\n--- backward détaillé, at = ${at} ---`);
  for (const x of all) {
    const c = (["x1", "x2", "x3"] as const).filter(k => x[k] !== base[k]).length;
    const f = forward(x, at);
    const why = [f.E.gPlus < 1 ? "gain E < L" : "", f.E.dMinus > 1 ? "détérioration E > L" : "", f.P1.dMinus > 0 ? "point bloquant P1" : ""].filter(Boolean).join(", ");
    console.log(`c=${c} ${name(x)} E=${fmt(f.E)} P1=${fmt(f.P1)} ${why || "SOLUTION"}`);
  }
}

// Sans poids : éq. (5) sur les 4 TPM et éq. (7) sur la hiérarchie (poids tous NUL ⇒ (7), cf. thesisWeights).
for (const at of [1, 2] as Attitude[]) {
  console.log(`\n--- sans poids, at = ${at} : (5) | (7) P1 P2 E ---`);
  for (const x of all) {
    const f = forward(x, at);
    const g5 = aggregateNode(TPM.map(i => f.tpm[i]), [0, 0, 0, 0]);
    const p1 = aggregateNode(MOP.P1.fils.map(i => f.tpm[i]), [0, 0]);
    const p2 = aggregateNode(MOP.P2.fils.map(i => f.tpm[i]), [0, 0]);
    const e7 = aggregateNode([p1, p2], [0, 0]);
    console.log(`${name(x)} (5)=${fmt(g5)} | (7) P1=${fmt(p1)} P2=${fmt(p2)} E=${fmt(e7)}`);
  }
}
