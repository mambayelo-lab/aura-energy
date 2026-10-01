import { describe, expect, it } from "vitest";
import { entityCoverage, rankCandidates, scoreCandidate } from "../mapping-engine";
import { findMinimalRepairs, filterGloballyVerified, globalVetoBreaches, type ObjectiveRef, type VerifiableCombo } from "../goalseek-verify";
import type { ArgusVocab, BusinessEntity } from "../argus-vocab-store";
import type { AtelierLevierDef } from "../atelier-store";

const lever = (id: string, labels = ["Actuel", "Prudent", "Ambitieux"]): AtelierLevierDef => ({
  id,
  label: id,
  type: "autre",
  options: labels.map((label, index) => ({ id: `${id}-${index}`, label, impacts: {} })),
});

describe("BORA — cohérence Forward / Backward sur jeux de décision", () => {
  it("fournisseur critique : trouve le changement conjoint minimal et le revalide en Forward", () => {
    const defs = [lever("sourcing"), lever("stock"), lever("contrat")];
    const evaluate = (combo: Record<string, string>) => {
      const regional = combo.sourcing === "sourcing-1";
      const reserve = combo.contrat === "contrat-1";
      const excessStock = combo.stock === "stock-2";
      return {
        perCrit: {
          continuite: { gPlus: (regional && reserve ? 2 : regional || reserve ? 1 : 0) as 0 | 1 | 2 | 3, dMinus: 0 as const },
          tresorerie: { gPlus: 0 as const, dMinus: (excessStock ? 2 : 0) as 0 | 1 | 2 | 3 },
        },
        global: { gPlus: (regional && reserve ? 2 : 0) as 0 | 1 | 2 | 3, dMinus: (excessStock ? 2 : 0) as 0 | 1 | 2 | 3 },
      };
    };
    const objectives: ObjectiveRef[] = [{ id: "tresorerie", label: "Trésorerie", importance: "Essentiel" }];
    const repairs = findMinimalRepairs({
      baseCombo: { sourcing: "sourcing-0", stock: "stock-0", contrat: "contrat-0" },
      candidateLeverIds: ["sourcing", "stock", "contrat"], leviersDef: defs, evaluate,
      activeTargets: [{ critId: "continuite", min: 2 }], tolerateRisk: 0, allObjectives: objectives, maxChange: 3,
    });
    expect(repairs.length).toBeGreaterThan(0);
    expect(repairs.every(r => r.changes.length === 2)).toBe(true);
    for (const repair of repairs) {
      const forward = evaluate(repair.combo);
      expect(forward.perCrit.continuite.gPlus).toBeGreaterThanOrEqual(2);
      expect(globalVetoBreaches(forward.perCrit, objectives)).toEqual([]);
    }
  });

  it("manufacturing : une cible impossible retourne proprement zéro solution, tandis qu'un palier réaliste reste atteignable", () => {
    const defs = [lever("maintenance"), lever("cadence")];
    let evaluations = 0;
    const evaluate = (combo: Record<string, string>) => {
      evaluations += 1;
      const improvements = Number(combo.maintenance !== "maintenance-0") + Number(combo.cadence !== "cadence-0");
      const gain = Math.min(2, improvements) as 0 | 1 | 2 | 3;
      return { perCrit: { rendement: { gPlus: gain, dMinus: 0 as const } }, global: { gPlus: gain, dMinus: 0 as const } };
    };
    const impossible = findMinimalRepairs({
      baseCombo: { maintenance: "maintenance-0", cadence: "cadence-0" }, candidateLeverIds: ["maintenance", "cadence"],
      leviersDef: defs, evaluate, activeTargets: [{ critId: "rendement", min: 3 }], tolerateRisk: 0, allObjectives: [], maxChange: 2,
    });
    expect(impossible).toEqual([]);
    expect(evaluations).toBe(9); // espace complet 3 × 3, base comprise — recherche exhaustive

    const realistic = findMinimalRepairs({
      baseCombo: { maintenance: "maintenance-0", cadence: "cadence-0" }, candidateLeverIds: ["maintenance", "cadence"],
      leviersDef: defs, evaluate, activeTargets: [{ critId: "rendement", min: 2 }], tolerateRisk: 0, allObjectives: [], maxChange: 2,
    });
    expect(realistic.length).toBeGreaterThan(0);
    expect(realistic.every(r => r.changes.length === 2)).toBe(true);
  });

  it("offre : aucune proposition Backward n'est certifiée si le Forward révèle un veto essentiel", () => {
    const objectives: ObjectiveRef[] = [{ id: "conformite", label: "Conformité", importance: "Essentiel" }];
    const combos: VerifiableCombo[] = [
      { key: "rapide", combo: {}, perCrit: { valeur: { gPlus: 3, dMinus: 0 }, conformite: { gPlus: 0, dMinus: 1 } }, global: { gPlus: 3, dMinus: 1 } },
      { key: "sobre", combo: {}, perCrit: { valeur: { gPlus: 2, dMinus: 0 }, conformite: { gPlus: 1, dMinus: 0 } }, global: { gPlus: 2, dMinus: 0 } },
    ];
    expect(filterGloballyVerified(combos, objectives).map(x => x.key)).toEqual(["sobre"]);
  });
});

describe("AURA Connect — mapping explicable et limité aux champs observés", () => {
  const entity: BusinessEntity = { id: "partner", name: "Business Partner", attributes: [{ id: "email", name: "Adresse email", type: "text" }] };
  const vocab: ArgusVocab = {
    entities: [entity], relationships: [], entityMappings: [], kpis: [], mappings: [], causalRules: [],
    apps: [{ id: "crm", label: "CRM", type: "CRM", connectionHint: "API", secretConfigured: false, enabled: true }],
    fields: [
      { id: "mail", appId: "crm", name: "BusinessPartner.email_address", sampleValues: ["ada@example.com", "lin@example.com"] },
      { id: "qty", appId: "crm", name: "WarehouseItem.quantity", sampleValues: ["10", "12"] },
    ],
  };

  it("classe le champ email réellement observé devant un champ quantité", () => {
    const ranked = rankCandidates(vocab, entity, entity.attributes[0]);
    expect(ranked[0].field.id).toBe("mail");
    expect(scoreCandidate(entity, entity.attributes[0], "BusinessPartner.email_address", ["ada@example.com"]).score)
      .toBeGreaterThan(scoreCandidate(entity, entity.attributes[0], "WarehouseItem.quantity", ["10"]).score);
  });

  it("mesure la couverture seulement après validation du branchement", () => {
    expect(entityCoverage(vocab, entity).pct).toBe(0);
    const mapped: ArgusVocab = { ...vocab, entityMappings: [{ id: "m1", entityId: "partner", attributeId: "email", appId: "crm", fieldId: "mail", isMaster: true, method: "semantique", confidence: .95 }] };
    expect(entityCoverage(mapped, entity).pct).toBe(100);
  });
});
