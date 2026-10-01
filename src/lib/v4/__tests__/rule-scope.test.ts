// Cohérence des règles causales à plusieurs indicateurs : toutes les
// conditions doivent être vraies pour la même entité métier (même
// fournisseur, même SKU/site…), déduite de l'ontologie Supply Chain.
import { describe, expect, it } from "vitest";
import { blankVocab, evaluateCausalRules, withSupplyChainRulebook, type ArgusVocab, type CausalRule, type KpiDef } from "../argus-vocab-store";
import { ruleScope } from "../rule-scope";
import { withSupplyChainModel } from "../supply-model";

type Rows = Record<string, string>[];
const SUPPLIERS: Rows = [
  { supplierId: "SUP-001", supplier: "Tessitura Milano", capacityRisk: "88", geopoliticalRisk: "12" },
  { supplierId: "SUP-003", supplier: "Shenzhen Atelier Components", capacityRisk: "72", geopoliticalRisk: "68" },
  { supplierId: "SUP-006", supplier: "Atlas Metalworks", capacityRisk: "81", geopoliticalRisk: "58" },
  { supplierId: "SUP-008", supplier: "Anatolia Deri Tekstil", capacityRisk: "58", geopoliticalRisk: "55" },
];
const MATERIALS: Rows = [
  { sku: "BAG-ORION", description: "Sac Orion", primarySupplierId: "SUP-001" },
  { sku: "BOX-PREMIUM", description: "Coffret", primarySupplierId: "SUP-002" },
  { sku: "BAG-LUNA", description: "Sac Luna", primarySupplierId: "SUP-003" },
];
const STOCK: Rows = [
  { sku: "BAG-ORION", siteId: "WH-LIL", daysOfCover: "6.4" },
  { sku: "BOX-PREMIUM", siteId: "WH-PAR", daysOfCover: "1.8" },
  { sku: "BAG-LUNA", siteId: "WH-MIL", daysOfCover: "12" },
];
const SITES: Rows = [{ siteId: "WH-LIL", name: "Entrepôt de Lille", capacityUnits: "5000" }];

function vocab(extraKpis: KpiDef[] = [], rules: CausalRule[] = []): ArgusVocab {
  const base = withSupplyChainModel(withSupplyChainRulebook(blankVocab()));
  const table = (id: string, name: string, rows: Rows) => ({ id, appId: "app", table: name, columns: Object.keys(rows[0]), rows, fetchedAt: "2026-09-28T08:00:00Z" });
  const field = (table: string, column: string, rows: Rows) => ({ id: `f-${table}-${column}`, appId: "app", name: `${table}.${column}`, liveTable: table, sampleValues: rows.map(r => r[column]) });
  return {
    ...base,
    kpis: [...base.kpis, ...extraKpis],
    apps: [{ id: "app", label: "SI", type: "ERP", connectionHint: "", secretConfigured: true, enabled: true }],
    fields: [
      field("SupplierRiskAssessment", "capacityRisk", SUPPLIERS), field("SupplierRiskAssessment", "geopoliticalRisk", SUPPLIERS),
      field("InventoryPosition", "daysOfCover", STOCK), field("Site", "capacityUnits", SITES),
    ],
    mappings: [
      { id: "m1", kpiId: "k-s1", appId: "app", fieldId: "f-SupplierRiskAssessment-capacityRisk", method: "manuel" },
      { id: "m2", kpiId: "k-s10", appId: "app", fieldId: "f-SupplierRiskAssessment-geopoliticalRisk", method: "manuel" },
      { id: "m3", kpiId: "k-s2", appId: "app", fieldId: "f-InventoryPosition-daysOfCover", method: "manuel" },
      { id: "m4", kpiId: "k-site", appId: "app", fieldId: "f-Site-capacityUnits", method: "manuel" },
    ],
    siTables: [table("t1", "SupplierRiskAssessment", SUPPLIERS), table("t2", "Material", MATERIALS), table("t3", "InventoryPosition", STOCK), table("t4", "Site", SITES)],
    causalRules: [...base.causalRules, ...rules],
  };
}
const rule = (id: string, conditions: CausalRule["conditions"]): CausalRule => ({ id, label: id, conditions, conclusion: "", severity: "alerte", origin: "manuel" });
const evalOf = (v: ArgusVocab, id: string) => evaluateCausalRules(v).find(r => r.rule.id === id)!;
const siteKpi: KpiDef = { id: "k-site", label: "Capacité du site", unit: "u.", direction: "au_dessus_alerte", seuilAlerte: 1000, seuilCritique: 4000, entityId: "sc-site" };

describe("même entité par défaut", () => {
  it("capacité ≥ 60 ET géopolitique ≥ 50 : seulement les fournisseurs qui cumulent les deux", () => {
    const v = vocab([], [rule("R", [{ kpiId: "k-s1", minStatus: "alerte" }, { kpiId: "k-s10", minStatus: "alerte" }])]);
    const r = evalOf(v, "R");
    expect(r.triggered).toBe(true);
    expect(r.scope).toMatchObject({ kind: "entite", entityId: "sc-fournisseur", entityName: "Fournisseur" });
    // SUP-001 (capacité 88, géopolitique 12) ne cumule pas : exclu.
    expect(r.matches.map(m => m.key)).toEqual(["SUP-003", "SUP-006"]);
    expect(r.matches[0].label).toBe("SUP-003 · Shenzhen Atelier Components");
    expect(r.matches[0].facts.map(f => [f.kpiId, f.value])).toEqual([["k-s1", 72], ["k-s10", 68]]);
  });

  it("ne se déclenche pas si aucune entité ne cumule les conditions", () => {
    const v = vocab([], [rule("R", [{ kpiId: "k-s1", minStatus: "critique" }, { kpiId: "k-s10", minStatus: "alerte" }])]);
    // Capacité critique (≥ 85) : SUP-001 seulement, dont le risque géopolitique est bas.
    expect(evalOf(v, "R").triggered).toBe(false);
  });

  it("une alerte à une condition liste toutes les entités, la plus grave en tête", () => {
    const r = evalOf(vocab(), "S1");
    expect(r.matches.map(m => m.key)).toEqual(["SUP-001", "SUP-006", "SUP-003"]);
    expect(r.matches[0].facts[0].status).toBe("critique");
  });
});

describe("objets différents mais reliés", () => {
  it("stock d'un article ET capacité de son fournisseur : suit Stock → Article → Fournisseur", () => {
    const v = vocab([], [rule("R", [{ kpiId: "k-s2", minStatus: "alerte" }, { kpiId: "k-s1", minStatus: "alerte" }])]);
    const r = evalOf(v, "R");
    expect(r.scope.entityId).toBe("sc-fournisseur");
    expect(r.scope.summary).toBe("Fournisseur (Stock → Article → Fournisseur)");
    // BAG-ORION (6,4 j) est fourni par SUP-001 ; BOX-PREMIUM (1,8 j) par SUP-002, sans risque de capacité connu.
    expect(r.matches.map(m => m.label)).toEqual(["SUP-001 · Tessitura Milano"]);
  });
});

describe("aucune relation", () => {
  it("Site et Fournisseur n'ont aucun objet commun : incohérence, jamais déclenchée", () => {
    const conditions = [{ kpiId: "k-site", minStatus: "alerte" as const }, { kpiId: "k-s1", minStatus: "alerte" as const }];
    const v = vocab([siteKpi], [rule("R", conditions)]);
    const scope = ruleScope(v, conditions);
    expect(scope.kind).toBe("incoherente");
    expect(scope.summary).toBe("aucune relation entre Site et Fournisseur dans l'ontologie");
    expect(evalOf(v, "R").triggered).toBe(false);
  });
});

describe("déduction de l'objet d'un indicateur", () => {
  it("un indicateur sans rattachement prend l'objet dont sa table porte la clé", () => {
    const cap: KpiDef = { id: "k-cap", label: "Capacité fournisseur", unit: "score/100", direction: "au_dessus_alerte", seuilAlerte: 60, seuilCritique: 85 };
    const v = vocab([cap]);
    v.mappings.push({ id: "m5", kpiId: "k-cap", appId: "app", fieldId: "f-SupplierRiskAssessment-capacityRisk", method: "manuel" });
    expect(ruleScope(v, [{ kpiId: "k-cap", minStatus: "alerte" }, { kpiId: "k-s10", minStatus: "alerte" }])).toMatchObject({ kind: "entite", entityId: "sc-fournisseur" });
  });

  it("sans clé lisible (valeurs d'exemple seules), la règle reste globale comme avant", () => {
    const v = vocab();
    v.siTables = [];
    const r = ruleScope(v, [{ kpiId: "k-s1", minStatus: "alerte" }]);
    expect(r.kind).toBe("entite");
    const out = evaluateCausalRules({ ...v, causalRules: [rule("R", [{ kpiId: "k-s1", minStatus: "alerte" }, { kpiId: "k-s10", minStatus: "alerte" }])] })[0];
    expect(out.triggered).toBe(true);
    expect(out.matches).toEqual([]);
  });
});

describe("chaînage", () => {
  it("une règle chaînée sur le même objet reste sur la même entité", () => {
    const v = vocab([], [
      rule("A", [{ kpiId: "k-s1", minStatus: "critique" }]),
      rule("B", [{ ruleId: "A" }, { kpiId: "k-s1", minStatus: "alerte" }, { kpiId: "k-s10", minStatus: "alerte" }]),
    ]);
    // A se déclenche pour SUP-001 ; les deux conditions KPI de B pour SUP-003 et SUP-006 : aucune entité commune.
    expect(evalOf(v, "A").triggered).toBe(true);
    expect(evalOf(v, "B").triggered).toBe(false);
  });
});
