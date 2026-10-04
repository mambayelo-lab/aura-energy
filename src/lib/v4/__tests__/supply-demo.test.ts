import { describe, expect, it } from "vitest";
import { blankVocab, withSupplyChainRulebook } from "../argus-vocab-store";
import {
  MAISON_LUCIE_DEMO_DOMAIN, SUPPLY_DEMO_STEPS, installMaisonLucieSources, isStaleSupplyDemo, isSupplyDemo, resetSupplyDemo, runSupplyDemo, SUPPLY_DEMO_VERSION,
} from "../supply-demo";

describe("démo Supply Maison Lucie", () => {
  it("installe les sources sans créer de mapping", () => {
    const v = installMaisonLucieSources(withSupplyChainRulebook(blankVocab()));
    expect(v.domaine).toBe(MAISON_LUCIE_DEMO_DOMAIN);
    expect(v.apps.some(a => a.id === "ml-sap")).toBe(true);
    expect(v.mappings).toHaveLength(0);
    expect(isSupplyDemo(v)).toBe(true);
  });

  it("s'arrête proprement, sans rien inventer, quand le SI est injoignable", async () => {
    const seen: string[] = [];
    const r = await runSupplyDemo(blankVocab(), (id, state) => seen.push(`${id}:${state}`), async () => ({ ok: false, error: "fetch failed" }));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.step).toBe("import"); expect(r.error).toMatch(/injoignable/); }
    expect(seen).toContain("import:error");
    expect(seen.some(s => s.startsWith("mapping:"))).toBe(false);
  });

  it("enchaîne modèle, mappings au-dessus du seuil et évaluation des règles", async () => {
    const seen: string[] = [];
    const r = await runSupplyDemo(blankVocab(), (id, state) => seen.push(`${id}:${state}`), async v => ({ ok: true, vocab: v }), async () => ({ ok: false, error: "hors ligne (test)" }));
    expect(r.ok).toBe(true);
    for (const s of SUPPLY_DEMO_STEPS) expect(seen).toContain(`${s.id}:done`);
    if (r.ok) expect((r.vocab.entities ?? []).length).toBeGreaterThanOrEqual(6);
    if (r.ok) { expect(r.vocab.demoVersion).toBe(SUPPLY_DEMO_VERSION); expect(isStaleSupplyDemo(r.vocab)).toBe(false); }
  });

  it("une démo enregistrée par une version antérieure est à relire (sinon calculs faux, ex. stress-test à 0 €)", () => {
    const old = installMaisonLucieSources(withSupplyChainRulebook(blankVocab()));
    expect(isStaleSupplyDemo(old)).toBe(true);
    expect(isStaleSupplyDemo({ ...old, demoVersion: "ancienne" })).toBe(true);
    expect(isStaleSupplyDemo({ ...old, demoVersion: SUPPLY_DEMO_VERSION })).toBe(false);
    expect(isStaleSupplyDemo(blankVocab())).toBe(false);
  });

  it("la réinitialisation retire tout ce que la démo a installé", () => {
    const v = resetSupplyDemo(installMaisonLucieSources(withSupplyChainRulebook(blankVocab())));
    expect(v.apps.some(a => a.id.startsWith("ml-"))).toBe(false);
    expect(v.fields.length).toBe(0);
    expect(isSupplyDemo(v)).toBe(false);
  });
});
