import { describe, expect, it } from "vitest";
import { blankVocab, evaluateCausalRules, withSupplyChainRulebook, type ArgusVocab } from "../argus-vocab-store";
import {
  addKpiMapping, duplicateRule, removeKpi, removeKpiMapping, removeRule, setRuleEnabled, updateKpi, updateKpiMapping, upsertRule, blankRule, ruleKind,
} from "../studio-editing";
import { classifyIntent, planCopilotAnswer, stripChartBlocks } from "../copilot-answer";

// Parcours manuel : une source GraphQL Maison Lucie lue telle quelle
// (valeurs réelles du SI de démonstration), un indicateur créé à la main,
// un mapping manuel, puis règles éditées et copilote.
const ROWS = [
  { supplierId: "SUP-001", supplier: "Tessitura Milano", capacityRisk: "88", overallRisk: "71", trend: "+19", geopoliticalRisk: "12", country: "IT" },
  { supplierId: "SUP-002", supplier: "Maison Cuir du Nord", capacityRisk: "24", overallRisk: "18", trend: "-2", geopoliticalRisk: "8", country: "FR" },
  { supplierId: "SUP-003", supplier: "Shenzhen Atelier Components", capacityRisk: "72", overallRisk: "57", trend: "+6", geopoliticalRisk: "68", country: "CN" },
  { supplierId: "SUP-004", supplier: "Nordic Packaging AB", capacityRisk: "34", overallRisk: "22", trend: "0", geopoliticalRisk: "5", country: "SE" },
];

function connected(): ArgusVocab {
  const v = withSupplyChainRulebook(blankVocab());
  const columns = Object.keys(ROWS[0]);
  return withSupplyChainRulebook({
    ...v,
    apps: [{ id: "app-gql", label: "Maison Lucie · GraphQL", type: "SI de démonstration", connectionHint: "GraphQL", sourceStatus: "connected", enabled: true, secretConfigured: true }],
    fields: columns.map(c => ({ id: `f-${c}`, appId: "app-gql", name: `supplierRiskAssessments.${c}`, liveTable: "supplierRiskAssessments", sampleValues: ROWS.map(r => r[c as keyof typeof ROWS[0]]) })),
    siTables: [{ id: "t1", appId: "app-gql", table: "supplierRiskAssessments", columns, rows: ROWS, fetchedAt: "2026-09-28T08:00:00Z" }],
  } as ArgusVocab);
}

function withCapacityKpi(): ArgusVocab {
  let v = connected();
  v = { ...v, kpis: [...v.kpis, { id: "k-cap", label: "Capacité fournisseur", unit: "score/100", direction: "au_dessus_alerte", seuilAlerte: 60, seuilCritique: 85 }] };
  v = addKpiMapping(v, "k-cap", "f-capacityRisk");
  return v;
}

describe("Studio : mappings manuels", () => {
  it("ajoute, modifie puis supprime un mapping indicateur ← colonne", () => {
    let v = withCapacityKpi();
    const m = v.mappings.find(x => x.kpiId === "k-cap")!;
    expect(m).toMatchObject({ fieldId: "f-capacityRisk", appId: "app-gql", method: "manuel" });
    v = updateKpiMapping(v, m.id, { fieldId: "f-overallRisk" });
    expect(v.mappings.find(x => x.id === m.id)!.fieldId).toBe("f-overallRisk");
    v = removeKpiMapping(v, m.id);
    expect(v.mappings.some(x => x.kpiId === "k-cap")).toBe(false);
  });

  it("un indicateur standard supprimé n'est pas réinjecté par le catalogue", () => {
    const v = withSupplyChainRulebook(removeKpi(connected(), "k-s1"));
    expect(v.kpis.some(k => k.id === "k-s1")).toBe(false);
    expect(v.causalRules.find(r => r.id === "S1")!.conditions).toHaveLength(0);
  });

  it("les seuils et le libellé d'un indicateur se modifient", () => {
    const v = updateKpi(withCapacityKpi(), "k-cap", { seuilAlerte: 80, label: "Capacité fournisseur (score)" });
    expect(v.kpis.find(k => k.id === "k-cap")).toMatchObject({ seuilAlerte: 80, label: "Capacité fournisseur (score)" });
  });
});

describe("Studio : alertes et règles éditables", () => {
  it("crée une alerte à une condition qui se déclenche sur les vraies valeurs", () => {
    const rule = { ...blankRule(), label: "Fournisseur saturé", conditions: [{ kpiId: "k-cap", minStatus: "critique" as const }], options: ["Dual sourcing", " "], causes: ["Capacité > 85"] };
    const v = upsertRule(withCapacityKpi(), rule);
    const saved = v.causalRules.find(r => r.id === rule.id)!;
    expect(ruleKind(saved)).toBe("alerte");
    expect(saved.options).toEqual(["Dual sourcing"]);
    expect(evaluateCausalRules(v).find(r => r.rule.id === rule.id)!.triggered).toBe(true);
  });

  it("modifie, duplique, désactive et supprime une règle causale", () => {
    let v = addKpiMapping(withCapacityKpi(), "k-s10", "f-geopoliticalRisk");
    const rule = { ...blankRule(), label: "Capacité et géopolitique", conclusion: "Double exposition", conditions: [{ kpiId: "k-cap", minStatus: "alerte" as const }, { kpiId: "k-s10", minStatus: "alerte" as const }] };
    v = upsertRule(v, rule);
    expect(ruleKind(v.causalRules.find(r => r.id === rule.id)!)).toBe("règle causale");
    // Même fournisseur pour les deux conditions : SUP-003 (72 et 68), pas SUP-001 (88 mais 12).
    const hit = evaluateCausalRules(v).find(r => r.rule.id === rule.id)!;
    expect(hit.scope.entityName).toBe("Fournisseur");
    expect(hit.matches.map(m => m.label)).toEqual(["SUP-003 · Shenzhen Atelier Components"]);
    v = upsertRule(v, { ...rule, label: "Capacité ET géopolitique", severity: "critique" });
    expect(v.causalRules.find(r => r.id === rule.id)).toMatchObject({ label: "Capacité ET géopolitique", severity: "critique" });
    v = duplicateRule(v, rule.id);
    const copy = v.causalRules.find(r => r.label === "Capacité ET géopolitique (copie)")!;
    expect(copy.id).not.toBe(rule.id);
    v = setRuleEnabled(v, copy.id, false);
    expect(evaluateCausalRules(v).find(r => r.rule.id === copy.id)!.triggered).toBe(false);
    v = removeRule(v, copy.id);
    expect(v.causalRules.some(r => r.id === copy.id)).toBe(false);
  });

  it("une règle standard supprimée reste supprimée et ses citations sont retirées", () => {
    let v = connected();
    const chained = { ...blankRule(), label: "Chaînée", conditions: [{ ruleId: "S1" }, { kpiId: "k-s1", minStatus: "alerte" as const }] };
    v = upsertRule(v, chained);
    v = withSupplyChainRulebook(removeRule(v, "S1"));
    expect(v.causalRules.some(r => r.id === "S1")).toBe(false);
    expect(v.causalRules.find(r => r.id === chained.id)!.conditions).toEqual([{ kpiId: "k-s1", minStatus: "alerte" }]);
  });
});

describe("Copilote : réponses fondées et choix du graphique", () => {
  it("classe les intentions", () => {
    expect(classifyIntent("Quels fournisseurs sont en risque de capacité ?")).toBe("comparaison");
    expect(classifyIntent("Quelle est la tendance du risque de capacité ?")).toBe("tendance");
    expect(classifyIntent("Pourquoi l'alerte Tessitura est-elle déclenchée ?")).toBe("explication");
    expect(classifyIntent("Que recommandes-tu de faire ?")).toBe("recommandation");
    expect(classifyIntent("Quelle est la situation ?")).toBe("synthese");
  });

  it("comparaison de fournisseurs : graphique en barres Aura avec les valeurs lues", () => {
    const p = planCopilotAnswer(withCapacityKpi(), "Compare les fournisseurs sur la capacité");
    expect(p.chart).toBeDefined();
    expect(p.chart).toMatchObject({ type: "bar", theme: "aura" });
    expect(p.chart!.data[0]).toMatchObject({ name: "Tessitura Milano", _breach: 1 });
    expect(p.text).toContain("SUP-001");
    expect(p.text).toContain("88");
  });

  it("comparaison : sévérité et enregistrement le plus exposé mis en avant ; répartition par état", () => {
    const p = planCopilotAnswer(withCapacityKpi(), "Compare les fournisseurs sur la capacité");
    expect(p.chart!.data[0]).toMatchObject({ name: "Tessitura Milano", _status: "critique", _focus: 1 });
    expect(p.chart!.data.filter(d => d._focus)).toHaveLength(1);
    const r = planCopilotAnswer(withCapacityKpi(), "Quelle est la répartition des fournisseurs sur la capacité ?");
    expect(r.chart).toMatchObject({ type: "pie", theme: "aura" });
    // 88 critique, 72 alerte, 24 et 34 dans les seuils.
    expect(r.chart!.data).toEqual([
      { name: "Dans les seuils", Enregistrements: 2, _status: "ok" },
      { name: "Alerte", Enregistrements: 1, _status: "alerte" },
      { name: "Critique", Enregistrements: 1, _status: "critique" },
    ]);
  });

  it("tendance : évaluation précédente reconstituée depuis la colonne trend", () => {
    const p = planCopilotAnswer(withCapacityKpi(), "Quelle est la tendance de la capacité fournisseur ?");
    expect(p.chart!.keys).toEqual(["Évaluation précédente", "Dernière évaluation"]);
    expect(p.chart!.data.find(d => d.name === "Tessitura Milano")).toMatchObject({ "Évaluation précédente": 69, "Dernière évaluation": 88 });
  });

  it("explication et recommandation : texte seul appuyé sur les règles", () => {
    const v = upsertRule(withCapacityKpi(), { ...blankRule(), label: "Fournisseur saturé", conclusion: "Commande en danger", severity: "critique", options: ["Dual sourcing", "Stock tampon"], decisionQuestion: "Sécuriser ou accepter ?", conditions: [{ kpiId: "k-cap", minStatus: "critique" }] });
    const why = planCopilotAnswer(v, "Pourquoi la capacité fournisseur alerte ?");
    expect(why.chart).toBeUndefined();
    expect(why.text).toContain("Fournisseur saturé");
    expect(why.text).toContain("88");
    const reco = planCopilotAnswer(v, "Que recommandes-tu pour la capacité ?");
    expect(reco.chart).toBeUndefined();
    expect(reco.text).toContain("Dual sourcing");
  });

  it("sans données, le copilote ne fabrique rien", () => {
    const p = planCopilotAnswer(withSupplyChainRulebook(blankVocab()), "Quels fournisseurs sont à risque ?");
    expect(p.chart).toBeUndefined();
    expect(p.text).toMatch(/connectez|actualisez/i);
  });

  it("retire les graphiques proposés par le LLM", () => {
    expect(stripChartBlocks("Texte\n```chart\n{}\n```")).toBe("Texte");
  });
});
