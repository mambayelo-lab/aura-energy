/**
 * Script de référence — génère tous les résultats Maison Lumen depuis le moteur.
 *
 * Usage : npx tsx scripts/generate-coalition-example.ts
 *
 * Ce script est la source de vérité pour les valeurs du document et des tests.
 * Aucun chiffre ne doit être codé manuellement : tout vient d'ici.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { validateCapacity } from "../src/lib/engine/coalition/validation";
import { computeShapleyExact } from "../src/lib/engine/coalition/shapley";
import { computePairInteractions } from "../src/lib/engine/coalition/interactions";
import { choquet } from "../src/lib/engine/coalition/choquet";
import { computeAllWorthIndices, computeWorthIndex } from "../src/lib/engine/coalition/worth";
import { computeContextualWorthSynergies } from "../src/lib/engine/coalition/synergy";
import { findMinimumCoalitionForTarget, findTopCoalitionsForTarget } from "../src/lib/engine/coalition/target";
import type {
  TwoAdditiveCapacity,
  CriterionImprovementModel,
} from "../src/lib/engine/coalition/types";

// ─── 1. Charger la capacité ───────────────────────────────────────────────────

const dataPath = resolve(process.cwd(), "data/examples/maison-lumen-pricing.json");
const raw = JSON.parse(readFileSync(dataPath, "utf-8"));

const capacity = raw.capacity as TwoAdditiveCapacity;
const criteriaIds: string[] = raw.criteria;
const currentState: Record<string, number> = raw.currentState;
const maxReachableState: Record<string, number> = raw.maxReachableState;
const target: number = raw.target;
const improvementModels: CriterionImprovementModel[] = raw.improvementModels;

console.log("═══════════════════════════════════════════════════════════");
console.log("  AURA — Maison Lumen · Résultats de référence");
console.log("═══════════════════════════════════════════════════════════\n");

// ─── 2. Valider la capacité ───────────────────────────────────────────────────

console.log("── Validation de la capacité ─────────────────────────────");
const validation = validateCapacity(capacity);
if (!validation.valid) {
  console.error("❌ Capacité invalide :");
  for (const v of validation.violations) console.error(`   [${v.rule}] ${v.message}`);
  process.exit(1);
}
console.log("✓ Capacité valide — μ(∅)=0, μ(N)=1, monotonie OK\n");

// ─── 3. Shapley ───────────────────────────────────────────────────────────────

console.log("── Valeurs de Shapley ───────────────────────────────────");
const shapleyResults = computeShapleyExact(capacity);
let shapleySum = 0;
for (const r of shapleyResults) {
  console.log(`   φ(${r.criterionId.padEnd(12)}) = ${r.value.toFixed(6)}`);
  shapleySum += r.value;
}
console.log(`   Σ φᵢ = ${shapleySum.toFixed(10)} (attendu : 1.0000000000)`);
console.log();

// ─── 4. Indices d'interaction ─────────────────────────────────────────────────

console.log("── Indices d'interaction ────────────────────────────────");
const interactions = computePairInteractions(capacity);
for (const r of interactions) {
  const sign = r.value > 0 ? "+" : "";
  console.log(
    `   I(${r.criterionA}, ${r.criterionB}) = ${sign}${r.value.toFixed(6)}  [${r.interpretation}]`
  );
}
console.log();

// ─── 5. Score Choquet courant ─────────────────────────────────────────────────

console.log("── Score Choquet — état courant ─────────────────────────");
const choquetX0 = choquet(capacity, criteriaIds, currentState);
console.log(`   C_μ(x⁰) = ${choquetX0.toFixed(6)}`);
console.log(`   x⁰ = ${JSON.stringify(currentState)}`);
console.log();

// ─── 6. Worth Index — toutes coalitions taille ≤ 2 ───────────────────────────

console.log("── Worth Index — coalitions de taille ≤ 2 ──────────────");
const worthAll = computeAllWorthIndices(capacity, criteriaIds, currentState, 2, "THEORETICAL_MAX", {}, 100);
for (const r of worthAll) {
  console.log(
    `   w(x⁰, {${r.coalition.join(", ")}}) = ${r.integratedWorth.toFixed(6)}` +
    `  (gain final : +${r.finalGain.toFixed(4)})`
  );
}
console.log();

// ─── 7. Synergie contextuelle de Worth ───────────────────────────────────────

console.log("── Synergies contextuelles Δw ───────────────────────────");
const synergies = computeContextualWorthSynergies(capacity, criteriaIds, currentState);
for (const s of synergies) {
  const sign = s.synergyGain > 0 ? "+" : "";
  console.log(
    `   Δw(${s.criterionA}, ${s.criterionB}) = ${sign}${s.synergyGain.toFixed(6)}` +
    `  [joint: ${s.worthJoint.toFixed(4)}, séparé: ${(s.worthA + s.worthB).toFixed(4)}]`
  );
}
console.log();

// ─── 8. Recherche sous cible ──────────────────────────────────────────────────

console.log(`── Recherche sous cible — target = ${target} ─────────────────`);
const minCoalition = findMinimumCoalitionForTarget(
  capacity, criteriaIds, currentState, improvementModels, target, { maxCoalitionSize: 3 }
);
if (minCoalition.achievable) {
  console.log(`   Coalition minimale : {${minCoalition.coalition.join(", ")}}`);
  console.log(`   Score attendu      : ${minCoalition.expectedScore.toFixed(6)}`);
  console.log(`   Faisabilité        : ${minCoalition.feasibility.toFixed(3)}`);
  if (minCoalition.totalCost) console.log(`   Coût total         : ${minCoalition.totalCost.toLocaleString()} €`);
  if (minCoalition.duration) console.log(`   Durée max.         : ${minCoalition.duration} jours`);
} else {
  console.log(`   ✗ Cible non atteignable avec maxCoalitionSize=3`);
}
console.log();

const topCoalitions = findTopCoalitionsForTarget(
  capacity, criteriaIds, currentState, improvementModels, target, { maxCoalitionSize: 3 }
);
console.log(`   Top ${topCoalitions.length} coalitions :`);
for (const c of topCoalitions) {
  console.log(
    `     {${c.coalition.join(", ")}} → score ${c.expectedScore.toFixed(4)}, faisabilité ${c.feasibility.toFixed(3)}`
  );
}
console.log();

// ─── 9. Export JSON de référence ──────────────────────────────────────────────

const outputPath = resolve(process.cwd(), "data/examples/maison-lumen-results.json");

const output = {
  _generated: new Date().toISOString().slice(0, 10),
  _source: "scripts/generate-coalition-example.ts",
  _note: "Résultats générés automatiquement depuis le moteur. Ne pas modifier manuellement.",

  validation: { valid: validation.valid, violations: validation.violations },

  choquetX0,

  shapley: shapleyResults.map(r => ({ criterionId: r.criterionId, value: r.value })),
  shapleySum,

  interactions: interactions.map(r => ({
    criterionA: r.criterionA,
    criterionB: r.criterionB,
    value: r.value,
    interpretation: r.interpretation,
  })),

  worthIndex: worthAll.map(r => ({
    coalition: r.coalition,
    integratedWorth: r.integratedWorth,
    integratedWorth100: r.integratedWorth100,
    finalGain: r.finalGain,
    finalGain100: r.finalGain100,
  })),

  contextualSynergies: synergies.map(s => ({
    criterionA: s.criterionA,
    criterionB: s.criterionB,
    synergyGain: s.synergyGain,
    worthJoint: s.worthJoint,
    worthA: s.worthA,
    worthB: s.worthB,
  })),

  targetSearch: {
    target,
    minimum: minCoalition,
    top: topCoalitions,
  },
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`✓ JSON de référence exporté → ${outputPath}`);
console.log("\n══ Fin — tous les résultats sont reproductibles ══════════");
