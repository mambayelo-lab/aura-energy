// Démos : matrices complétées (> 80 %), gagnant, classement et plus petit changement.
import { describe, expect, it } from "vitest";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession, type AtelierSession } from "../atelier-store";
import { SECTOR_PACKS, findSectorCase } from "../packs-sectoriels";
import { enrichDecisionDemoCase } from "../demo-enrichment";
import { impactCompleteness, rankOptions } from "../decision-express";

const demos: [string, AtelierSession][] = Object.keys(DEMO_FACTORIES).map(k => [k, DEMO_FACTORIES[k](newSession({ contextRaw: "" }))]);
for (const p of SECTOR_PACKS) for (const c of (p as { cases?: { key: string }[] }).cases ?? []) {
  const f = findSectorCase(c.key); if (!f) continue;
  const k = enrichDecisionDemoCase(f.c);
  demos.push([c.key, { ...newSession({ contextRaw: "", criteria: k.criteria, scenarios: k.scenarios }), leviersDef: k.leviersDef }]);
}

// Démos conservées : toutes affichent un gagnant (aucune égalité).
const TIES = new Set<string>();

describe("démos complètes", () => {
  it("huit démos représentatives", () => expect(demos.map(d => d[0]).sort()).toEqual(["demo-genai-make-or-buy", "energie-reseau", "renouv-flexibilite", "retail-omnicanal", "supply-detroits", "supply-pandemie", "supply-stock", "telereleve"]));
  for (const [k, s] of demos) it(`${k} : ≥ 80 % d'impacts renseignés, un gagnant, un classement`, () => {
    const c = impactCompleteness(s);
    expect(c.ratio).toBeGreaterThanOrEqual(0.8);
    const r = rankOptions(s);
    expect(r.length).toBeGreaterThanOrEqual(2);
    // Égalités réelles des données d'origine (même profil de risque bloquant) : affichées « à égalité ».
    if (!TIES.has(k)) expect(r[1].rank).toBe(2);
  });
});
