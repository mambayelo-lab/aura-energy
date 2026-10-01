// Benchmark avant / après (lancé seulement avec BENCH=1) :
//   BENCH=1 npx vitest run src/lib/v4/__tests__/lo-bench.test.ts
import { describe, it } from "vitest";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession, type AtelierSession, type QualitativeImpact } from "../atelier-store";
import { backwardSmallestChange, backwardSmallestChangeNaive } from "../decision-express";
import { exploreSpace, minimalLeverMove } from "../lo-search";
import { makeEvaluator, currentCombo } from "../solution-space";
import { code } from "../lo-compact";

const run = process.env.BENCH ? describe : describe.skip;
const time = <T,>(f: () => T): [T, number] => { const t = performance.now(); const r = f(); return [r, performance.now() - t]; };

function synthetic(levers: number, options: number, leaves: number): AtelierSession {
  const IMP: QualitativeImpact[] = ["++", "+", "+L", "0", "-L", "-", "--", "U"];
  let x = 12345;
  const r = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const criteria = [0, 1].map(g => ({ id: `m${g}`, label: `MOE ${g}`, poids: 50, description: "", importance: "Important" as const,
    children: Array.from({ length: leaves / 2 }, (_, i) => ({ id: `t${g}_${i}`, label: `TPM ${g}.${i}`, poids: 50, description: "", importance: (["Faible", "Secondaire", "Important", "Essentiel"] as const)[i % 4] })) }));
  const leafIds = criteria.flatMap(c => c.children.map(ch => ch.id));
  const leviersDef = Array.from({ length: levers }, (_, l) => ({ id: `l${l}`, label: `Levier ${l}`, type: "decision" as const,
    options: Array.from({ length: options }, (_, o) => ({ id: `l${l}o${o}`, label: `Option ${l}.${o}`,
      impacts: Object.fromEntries(leafIds.filter(() => r() < 0.5).map(id => [id, IMP[Math.floor(r() * IMP.length)]])) })) }));
  const scenarios = [0, 1, 2].map(s => ({ id: `s${s}`, label: `S${s}`, color: "#000", description: "", scores: {}, valeur: 0, faisabilite: 0,
    leviers: leviersDef.map(l => ({ id: l.id, label: l.label, type: l.type, valeur: l.options[(s + l.options.length) % l.options.length].id })) }));
  return { ...newSession({ contextRaw: "" }), criteria, leviersDef, scenarios, attitude: "Pessimiste" } as AtelierSession;
}

run("benchmark", () => {
  it("backward (notes, importances) : naïf vs programmation dynamique", () => {
    for (const k of Object.keys(DEMO_FACTORIES)) {
      const s = DEMO_FACTORIES[k](newSession({ contextRaw: "" }));
      if (s.scenarios.length < 2) continue;
      const [a, ta] = time(() => backwardSmallestChangeNaive(s));
      const [b, tb] = time(() => backwardSmallestChange(s));
      console.log(`BENCH backward ${k}: naïf ${ta.toFixed(0)} ms (k=${a?.minSize}, complet=${a?.complete}) | DP ${tb.toFixed(0)} ms (k=${b?.minSize}, ${b?.count} solutions minimales, complet=${b?.complete})`);
    }
  }, 3_600_000);

  it("espace des combinaisons : force brute vs programmation dynamique", () => {
    const cases: [string, AtelierSession][] = [
      ...Object.keys(DEMO_FACTORIES).map(k => [k, DEMO_FACTORIES[k](newSession({ contextRaw: "" }))] as [string, AtelierSession]),
      ["synthétique 10^6 (6 leviers × 10 options, 12 TPM)", synthetic(6, 10, 12)],
      ["synthétique 10^8 (8 leviers × 10 options, 12 TPM)", synthetic(8, 10, 12)],
    ];
    for (const [name, s] of cases) {
      const total = s.leviersDef.reduce((a, l) => a * l.options.length, 1);
      let tb = NaN;
      if (total <= 1_000_000) {
        const ev = makeEvaluator(s);
        const idx = s.leviersDef.map(() => 0);
        [, tb] = time(() => {
          const counts = new Map<number, number>();
          for (;;) {
            const r = ev(Object.fromEntries(s.leviersDef.map((l, i) => [l.id, l.options[idx[i]].id])));
            const c = code(r.gPlus, r.dMinus); counts.set(c, (counts.get(c) ?? 0) + 1);
            let p = 0; while (p < idx.length && ++idx[p] === s.leviersDef[p].options.length) { idx[p] = 0; p++; }
            if (p === idx.length) break;
          }
          return counts;
        });
      }
      const [sp, td] = time(() => exploreSpace(s));
      const from = currentCombo(s);
      const [mv, tm] = time(() => from && sp.best !== null ? minimalLeverMove(s, from, sp.best) : null);
      const mvTxt = mv && !("refused" in mv) ? `k=${mv.k}, ${mv.count} solutions` : mv ? "refusé" : "—";
      console.log(`BENCH espace ${name}: ${total.toLocaleString("fr-FR")} combinaisons | force brute ${isNaN(tb) ? "non lancée (> 10^6)" : tb.toFixed(0) + " ms"} | DP ${td.toFixed(0)} ms, ${sp.states} états${sp.refused ? " REFUS" : ""} | plus petit changement ${tm.toFixed(0)} ms (${mvTxt})`);
    }
  }, 3_600_000);
});
