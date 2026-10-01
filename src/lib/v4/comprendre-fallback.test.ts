import { describe, expect, it } from "vitest";
import { buildFallbackModel, countModel, ensureRichModel } from "./comprendre-fallback";

describe("Comprendre : modèle de secours et plancher de richesse", () => {
  it("produit un modèle générique riche, arborescent et avec lampes, sans chiffre inventé", () => {
    const m = buildFallbackModel({ context: "Faut-il lancer une nouvelle offre de services ?", elicitation: { objectif: "Croître sur le segment PME", leviersDDP: "tarification, canal de vente" } });
    const c = countModel(m);
    expect(c.objectives).toBeGreaterThanOrEqual(4);
    expect(c.indicators).toBeGreaterThanOrEqual(8);
    expect(c.indicators).toBeLessThanOrEqual(15);
    expect(c.leviers).toBeGreaterThanOrEqual(6);
    expect(m.leviers.every(l => l.options.length >= 3)).toBe(true);
    expect(c.lamps).toBeGreaterThanOrEqual(1);
    expect(m.criteria.every(o => o.children.length >= 1 && o.children.every(k => k.children.length >= 1))).toBe(true);
    expect(m.leviers[0].label).toBe("Tarification");
    expect(JSON.stringify(m)).not.toMatch(/\d+\s?(%|€|k€|M€|jours|semaines)/);
  });

  it("spécialise le modèle en supply chain pour le mode Décision de Supply", () => {
    const m = buildFallbackModel({ context: "Alerte : retard fournisseur", supplyChain: true });
    const labels = JSON.stringify(m);
    expect(labels).toMatch(/OTIF/);
    expect(labels).toMatch(/sourcing/i);
    expect(countModel(m).lamps).toBeGreaterThanOrEqual(2);
  });

  it("complète une réponse LLM trop pauvre sans rien retirer", () => {
    const poor = { criteria: [{ id: "o1", label: "Valeur", description: "", importance: "Essentiel" as const, children: [] }], leviers: [{ id: "l1", label: "Budget", type: "budget" as const, options: [{ id: "a", label: "Bas" }] }] };
    const rich = ensureRichModel(poor, { context: "x" });
    const c = countModel(rich);
    expect(rich.criteria[0].label).toBe("Valeur");
    expect(c.objectives).toBeGreaterThanOrEqual(3);
    expect(c.leviers).toBeGreaterThanOrEqual(5);
    expect(rich.leviers.every(l => l.options.length >= 3)).toBe(true);
    expect(c.lamps).toBeGreaterThanOrEqual(1);
  });
});
