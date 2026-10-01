import { describe, expect, it } from "vitest";
import { EMBEDDED_SNAPSHOT } from "../heliade";
import { ENERGY_RULES, alertDataMatrix, alertDecisionContext, evaluateEnergyRules } from "../rules";
import { ENERGY_OBJECTS } from "../ontology";
import { STRATEGIC_EXAMPLES } from "../../v4/strategic-examples";

describe("règles causales Énergie sur le SI fictif Héliade", () => {
  const alerts = evaluateEnergyRules(EMBEDDED_SNAPSHOT);
  it("les 8 règles se déclenchent chacune exactement une fois sur le scénario", () => {
    expect(alerts.map(a => a.ruleId).sort()).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"]);
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
    expect(evaluateEnergyRules(sain)).toEqual([]);
  });
  it("critiques en tête, contexte Décider sans consigne émise", () => {
    expect(alerts[0].gravite).toBe("critique");
    for (const a of alerts) expect(alertDecisionContext(a)).toMatch(/fictif/);
  });
  it("matrice, ontologie, décisions stratégiques", () => {
    expect(alertDataMatrix().some(m => m.outil === "remit")).toBe(true);
    expect(ENERGY_RULES.every(r => r.leviers.length >= 3)).toBe(true);
    expect(ENERGY_OBJECTS.length).toBeGreaterThanOrEqual(13);
    expect(STRATEGIC_EXAMPLES.map(e => e.titre)).toContain("Investissement BESS");
  });
  it("aucun nom de moteur interne dans les données", () => {
    const blob = JSON.stringify({ EMBEDDED_SNAPSHOT, ENERGY_RULES });
    expect(blob).not.toMatch(/bora|sugeno|choquet/i);
  });
});
