import { describe, expect, it } from "vitest";
import { SECTOR_PACKS } from "./packs-sectoriels";
import { buildDemoElicitation, enrichDecisionDemoCase } from "./demo-enrichment";
import { getLeafCriteria } from "./atelier-compute";

describe("préparation des démos Décider", () => {
  it("ne modifie pas les données sources et reste idempotente", () => {
    for (const source of SECTOR_PACKS.flatMap(p => p.cases)) {
      const before = JSON.stringify(source);
      const once = enrichDecisionDemoCase(source);
      expect(JSON.stringify(source), source.key).toBe(before);
      const twice = enrichDecisionDemoCase(once);
      expect(twice.criteria, source.key).toEqual(once.criteria);
      expect(twice.leviersDef.map(l => l.id), source.key).toEqual(once.leviersDef.map(l => l.id));
    }
  });
  it("scénarios et effets ne référencent que des leviers, options et indicateurs gardés", () => {
    for (const source of SECTOR_PACKS.flatMap(p => p.cases)) {
      const e = enrichDecisionDemoCase(source);
      const leaves = new Set(getLeafCriteria(e.criteria).map(c => c.id));
      const opts = new Map(e.leviersDef.map(l => [l.id, new Set(l.options.map(o => o.id))]));
      for (const l of e.leviersDef) for (const o of l.options) for (const k of Object.keys(o.impacts)) expect(leaves.has(k), `${source.key}/${o.id}/${k}`).toBe(true);
      for (const s of e.scenarios) for (const l of s.leviers) expect(opts.get(l.id)?.has(l.valeur), `${source.key}/${s.id}/${l.id}`).toBe(true);
      // Une option inspirante (lampe) reste visible quand la source en a une.
      if (source.leviersDef.some(l => l.options.some(o => o.exploratoire))) expect(e.leviersDef.some(l => l.options.some(o => o.exploratoire)), source.key).toBe(true);
    }
  });
  it("préremplit Comprendre avec les réponses du cas", () => {
    for (const source of SECTOR_PACKS.flatMap(p => p.cases)) {
      const el = buildDemoElicitation(enrichDecisionDemoCase(source));
      expect(el.objectif).toBe(source.objectif);
      expect(el.leviersDDP).toContain(source.leviersDef[0]?.label ?? "");
      expect(el.contraintesDIP).toContain(source.risques[0] ?? "");
      expect(el.resistances).toContain(source.impactes);
    }
  });
});
