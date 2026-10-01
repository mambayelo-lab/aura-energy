// Recommandation fiable : options suggérées hors classement, seuil de complétude, impacts mesurés.
import { describe, expect, it } from "vitest";
import { getLeafCriteria } from "../atelier-compute";
import { newSession, type AtelierSession } from "../atelier-store";
import { applyDeduction, deduceFromDescription } from "../decision-dialogue";
import { COMPLETENESS_MIN, impactCompleteness, impactsToComplete, rankOptions, seedFromAlert, suggestedOptionIds, validateOption } from "../decision-express";

const build = (t: string): AtelierSession => { const s = newSession({ contextRaw: "" }); return { ...s, ...applyDeduction(s, deduceFromDescription(t), t) }; };

describe("options suggérées par Aura", () => {
  it("hors classement tant qu'elles ne sont pas validées", () => {
    const seed = seedFromAlert({ id: "S1", kpiLabel: "Risque fournisseur", options: ["Double sourcing", "Stock tampon", "Relocaliser"] });
    let s: AtelierSession = { ...newSession({ contextRaw: "" }), ...seed };
    const relo = s.leviersDef[0].options[2];
    s = { ...s, leviersDef: s.leviersDef.map((l, i) => i ? l : { ...l, options: l.options.map(o => o.id === relo.id ? { ...o, exploratoire: true } : o) }) };
    expect(suggestedOptionIds(s).has(relo.id)).toBe(true);
    expect(rankOptions(s).map(r => r.label)).not.toContain("Relocaliser");
    s = { ...s, ...validateOption(s, relo.id) };
    expect(rankOptions(s).map(r => r.label)).toContain("Relocaliser");
  });
});

describe("seuil de complétude", () => {
  it(`sans indice sur les options (SAP ou Salesforce) : pas de gagnant, cases à compléter listées`, () => {
    const s = build("SAP ou Salesforce pour notre nouveau CRM ? La simplicité est essentielle.");
    const c = impactCompleteness(s);
    expect(c.reliable).toBe(false);
    expect(c.ratio).toBeLessThan(COMPLETENESS_MIN);
    expect(impactsToComplete(c)).toBeGreaterThan(0);
    expect(c.missing[0].option).toMatch(/SAP|Salesforce/);
  });
  it("avec des effets renseignés (double source ou stock) : recommandation affichable", () => {
    const c = impactCompleteness(build("Double source ou stock de sécurité pour SUP-003 ? Nous voulons éviter une rupture."));
    expect(c.reliable).toBe(true);
  });
  it("compléter les cases manquantes fait passer le seuil", async () => {
    const { setImpact } = await import("../decision-express");
    let s = build("SAP ou Salesforce pour notre nouveau CRM ?");
    for (const m of impactCompleteness(s).missing.slice(0, impactsToComplete(impactCompleteness(s)))) s = { ...s, ...setImpact(s, m.optionId, m.criterionId, "+") };
    expect(impactCompleteness(s).reliable).toBe(true);
  });
});

describe("impacts depuis les données Supply", () => {
  it("une décision passée mesurée donne l'impact sur l'indicateur de l'alerte, avec sa source", () => {
    const seed = seedFromAlert({ id: "S1", kpiLabel: "Risque de capacité fournisseur", options: ["Double sourcing", "Stock tampon"],
      observed: o => o === "Double sourcing" ? { outcome: "amélioration", before: 88, now: 52, unit: "score/100", date: "2026-09-01T00:00:00Z", entity: "SUP-001", resolved: true } : undefined });
    const leaf = getLeafCriteria(seed.criteria)[0];
    const [ds, st] = seed.leviersDef[0].options;
    expect(ds.impacts[leaf.id]).toBe("++");
    expect(ds.impactOrigins?.[leaf.id]).toBe("donnees");
    expect(ds.impactReasons?.[leaf.id]).toMatch(/88.*52.*journal des décisions/);
    expect(st.impactOrigins?.[leaf.id]).toBe("aura-heuristique");
  });
});
