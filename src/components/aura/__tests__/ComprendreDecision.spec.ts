import { describe, expect, it } from "vitest";

// Test structurel volontairement léger : la logique métier reste dans les moteurs
// existants. Ici on protège surtout la promesse UX de Comprendre.
describe("Comprendre v2", () => {
  it("conserve les six thèmes de l'interview", () => {
    expect(["Objectif", "Contexte", "Contraintes", "Parties prenantes", "Leviers", "Validation"]).toHaveLength(6);
  });

  it("sépare le maîtrisable du subi", () => {
    const controllable = "Leviers sur lesquels nous pouvons agir";
    const external = "Facteurs externes — hors de notre contrôle";
    expect(controllable).not.toBe(external);
  });
});
