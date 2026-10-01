import { describe, expect, it } from "vitest";
import { EMBEDDED_SNAPSHOT } from "../heliade";
import { ENERGY_RULES, alertDataMatrix, alertDecisionContext, evaluateEnergyRules } from "../rules";
import { ENERGY_OBJECTS } from "../ontology";
import { STRATEGIC_EXAMPLES } from "../../v4/strategic-examples";

describe("règles causales Énergie sur le SI fictif Héliade", () => {
  const alerts = evaluateEnergyRules(EMBEDDED_SNAPSHOT);
  it("les 23 règles se déclenchent chacune exactement une fois sur le scénario", () => {
    expect(alerts.map(a => a.ruleId).sort((a, b) => +a.slice(1) - +b.slice(1))).toEqual(Array.from({ length: 23 }, (_, i) => `E${i + 1}`));
  });
  it("E9–E23 : profils Décider (3–5 leviers, 2–4 options, 5–8 indicateurs, source)", () => {
    for (const r of ENERGY_RULES.slice(8)) {
      expect(r.leviers.length).toBeGreaterThanOrEqual(3); expect(r.leviers.length).toBeLessThanOrEqual(5);
      expect(r.options!.length).toBeGreaterThanOrEqual(2); expect(r.options!.length).toBeLessThanOrEqual(4);
      expect(r.indicateurs!.length).toBeGreaterThanOrEqual(5); expect(r.indicateurs!.length).toBeLessThanOrEqual(8);
      expect(r.reference).toBeTruthy();
    }
  });
  it("E13 cite les débits LUS ; E22 cite l'échéance NIS2 lue", () => {
    expect(alerts.find(a => a.ruleId === "E13")!.valeursLues).toMatchObject({ debitRestitueLuM3s: 0.9, debitReserveLuM3s: 1.4 });
    expect(alerts.find(a => a.ruleId === "E22")!.valeursLues.echeanceAlertePrecoce).toBe("2026-10-02T09:10:00Z");
  });
  it("E1 cite la consigne non acquittée et l'écart LU (pas recalculé)", () => {
    const e1 = alerts.find(a => a.ruleId === "E1")!;
    expect(e1.objet).toBe("SP-2026-1001");
    expect(e1.valeursLues.ecartLuMW).toBe(38);
  });
  it("aucune alerte sur un snapshot sain", () => {
    const sain = structuredClone(EMBEDDED_SNAPSHOT);
    sain.orchestrateur.setpoints = []; sain.planification.schedules = []; sain.remit.umm = [];
    sain["temps-reel"].telemetry = []; sain["scada-pays"].links = []; sain.referentiel.crosswalk = [];
    for (const k of ["tso", "bms", "hydro", "thermique", "equilibre", "performance", "conformite-reseau", "cyber-ot"]) delete (sain as Record<string, unknown>)[k];
    expect(evaluateEnergyRules(sain)).toEqual([]);
  });
  it("critiques en tête, contexte Décider sans consigne émise", () => {
    expect(alerts[0].gravite).toBe("critique");
    for (const a of alerts) expect(alertDecisionContext(a)).toMatch(/fictif/);
  });
  it("matrice, ontologie, décisions stratégiques", () => {
    expect(alertDataMatrix().some(m => m.outil === "remit")).toBe(true);
    expect(ENERGY_RULES.every(r => r.leviers.length >= 3)).toBe(true);
    expect(ENERGY_OBJECTS.length).toBeGreaterThanOrEqual(21);
    expect(STRATEGIC_EXAMPLES.map(e => e.titre)).toContain("Investissement BESS");
  });
  it("aucun nom de moteur interne dans les données", () => {
    const blob = JSON.stringify({ EMBEDDED_SNAPSHOT, ENERGY_RULES });
    expect(blob).not.toMatch(/bora|sugeno|choquet|engie|roadi|rtdo|wonderware|\\bice\\b/i);
  });
});
