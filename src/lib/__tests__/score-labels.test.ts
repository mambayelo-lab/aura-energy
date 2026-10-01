import { describe, it, expect } from "vitest";
import { impactLabel, feasibilityLabel, priorityLabel, confidenceLabel, priorityColor, confidenceColor } from "../score-labels";

describe("score-labels", () => {
  it("impactLabel: null → —", () => expect(impactLabel(null)).toBe("—"));
  it("impactLabel: 0 → faible", () => expect(impactLabel(0)).toBe("Impact faible"));
  it("impactLabel: 39 → faible", () => expect(impactLabel(39)).toBe("Impact faible"));
  it("impactLabel: 40 → modéré", () => expect(impactLabel(40)).toBe("Impact modéré"));
  it("impactLabel: 74 → modéré", () => expect(impactLabel(74)).toBe("Impact modéré"));
  it("impactLabel: 75 → élevé", () => expect(impactLabel(75)).toBe("Impact élevé"));
  it("impactLabel: 100 → élevé", () => expect(impactLabel(100)).toBe("Impact élevé"));

  it("feasibilityLabel: null → —", () => expect(feasibilityLabel(null)).toBe("—"));
  it("feasibilityLabel: 0 → faible", () => expect(feasibilityLabel(0)).toBe("Faisabilité faible"));
  it("feasibilityLabel: 50 → moyenne", () => expect(feasibilityLabel(50)).toBe("Faisabilité moyenne"));
  it("feasibilityLabel: 80 → forte", () => expect(feasibilityLabel(80)).toBe("Faisabilité forte"));

  it("priorityLabel: null → —", () => expect(priorityLabel(null)).toBe("—"));
  it("priorityLabel: 10 → faible", () => expect(priorityLabel(10)).toBe("Priorité faible"));
  it("priorityLabel: 55 → moyenne", () => expect(priorityLabel(55)).toBe("Priorité moyenne"));
  it("priorityLabel: 90 → élevée", () => expect(priorityLabel(90)).toBe("Priorité élevée"));

  it("confidenceLabel: null → —", () => expect(confidenceLabel(null)).toBe("—"));
  it("confidenceLabel: 20 → faible", () => expect(confidenceLabel(20)).toBe("Confiance faible"));
  it("confidenceLabel: 60 → moyenne", () => expect(confidenceLabel(60)).toBe("Confiance moyenne"));
  it("confidenceLabel: 80 → forte", () => expect(confidenceLabel(80)).toBe("Confiance forte"));

  it("priorityColor: null → muted", () => expect(priorityColor(null)).toBe("text-muted-foreground"));
  it("priorityColor: 20 → blue", () => expect(priorityColor(20)).toBe("text-blue-600"));
  it("priorityColor: 60 → amber", () => expect(priorityColor(60)).toBe("text-amber-600"));
  it("priorityColor: 80 → red", () => expect(priorityColor(80)).toBe("text-red-600"));

  it("confidenceColor: null → muted", () => expect(confidenceColor(null)).toBe("text-muted-foreground"));
  it("confidenceColor: 10 → muted", () => expect(confidenceColor(10)).toBe("text-muted-foreground"));
  it("confidenceColor: 50 → amber", () => expect(confidenceColor(50)).toBe("text-amber-600"));
  it("confidenceColor: 85 → emerald", () => expect(confidenceColor(85)).toBe("text-emerald-600"));
});
