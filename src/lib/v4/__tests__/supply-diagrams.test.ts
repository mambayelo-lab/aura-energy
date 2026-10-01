// Schémas Supply : graphe de l'ontologie, graphe causal et chaîne d'une
// alerte, calculés sur la démo Maison Lucie (photographie du SI).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { blankVocab, evaluateCausalRules, type ArgusVocab } from "../argus-vocab-store";
import { runSupplyDemo } from "../supply-demo";
import { alertChain, causalFlow, entityDetail, entityTrend, nextCardinality, ontologyGraph, setRelationshipCardinality } from "../supply-diagrams";
import { stubMaisonLucie } from "./lucie-stub";

let v: ArgusVocab;
beforeAll(async () => {
  stubMaisonLucie();
  const r = await runSupplyDemo(blankVocab());
  vi.unstubAllGlobals();
  if (!r.ok) throw new Error(r.error);
  v = r.vocab;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("graphe de l'ontologie", () => {
  it("9 objets, 12 relations avec cardinalité, indicateurs accrochés à leur objet", () => {
    const g = ontologyGraph(v);
    expect(g.nodes.map(n => n.name).sort()).toEqual(["Article", "Commande client", "Commande d'achat", "Expédition", "Fournisseur", "Perturbation", "Prévision de demande", "Site", "Stock"]);
    expect(g.edges).toHaveLength(12);
    expect(g.edges.find(e => e.id === "sc-r1")).toMatchObject({ cardinality: "1-N", fromEnd: { text: "1" }, toEnd: { text: "N" } });
    expect(g.edges.find(e => e.id === "sc-r9")).toMatchObject({ fromEnd: { text: "N" }, toEnd: { text: "N" } });
    const kpisOf = (id: string) => g.nodes.find(n => n.id === id)!.kpis.map(k => k.id).sort();
    expect(kpisOf("sc-fournisseur").filter(k => /^k-s\d/.test(k))).toEqual(["k-s1", "k-s10", "k-s9"]);
    expect(kpisOf("sc-stock")).toEqual(["k-res-bfr", "k-res-rupture", "k-s2"]);
    expect(kpisOf("sc-expedition")).toEqual(["k-s4"]);
    expect(g.nodes.find(n => n.id === "sc-fournisseur")!.kpis.find(k => k.id === "k-s1")).toMatchObject({ value: 88, status: "critique" });
    // Aucun objet ne se superpose à un autre.
    for (const a of g.nodes) for (const b of g.nodes) if (a !== b) {
      const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart, `${a.id} / ${b.id}`).toBe(true);
    }
  });

  it("un clic sur un objet donne ses attributs, leurs mappings et ses indicateurs", () => {
    const d = entityDetail(v, "sc-fournisseur")!;
    expect(d.attributes.find(a => a.id === "sc-fournisseur.id")?.field).toMatch(/supplierId$/);
    expect(d.kpis.map(k => k.field)).toContain("SupplierRiskAssessment.capacityRisk");
    expect(d.relations.map(r => r.other)).toContain("Commande d'achat");
  });

  it("la cardinalité se change depuis le schéma (1-1 → 1-N → N-N → 1-1)", () => {
    expect(["1-1", "1-N", "N-N"].map(c => nextCardinality(c as "1-1"))).toEqual(["1-N", "N-N", "1-1"]);
    const next = setRelationshipCardinality(v, "sc-r1", "N-N");
    expect(next.relationships!.find(r => r.id === "sc-r1")!.cardinality).toBe("N-N");
  });
});

describe("graphe causal", () => {
  it("indicateurs → conditions → règles → conclusion, seuils affichés, règles actives en surbrillance", () => {
    const f = causalFlow(v);
    expect(f.rules.map(r => r.id).filter(id => /^S\d+$/.test(id))).toEqual(["S1", "S2", "S3", "S4", "S6", "S9"]);
    expect(f.rules.filter(r => /^S\d+$/.test(r.id) && r.id !== "S3").every(r => r.triggered)).toBe(true);
    expect(f.rules.find(r => r.id === "S1")).toMatchObject({ scope: "Fournisseur", entities: expect.arrayContaining(["SUP-001 · Tessitura Milano"]) });
    expect(f.conditions.find(c => c.ruleId === "S4")!.text).toBe("critique ≥ 48 h");
    expect(f.kpis.find(k => k.id === "k-s2")).toMatchObject({ sens: "≤", seuilAlerte: 7, seuilCritique: 3, value: 1.8 });
    // Les indicateurs ne se chevauchent pas.
    const ys = f.kpis.map(k => k.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(46);
  });
});

describe("chaîne de causalité d'une alerte", () => {
  it("entité, indicateur et seuil, règle, décision", () => {
    const e = evaluateCausalRules(v).find(x => x.rule.id === "S1")!;
    const c = alertChain(v, e);
    expect(c).toMatchObject({ entity: "SUP-001 · Tessitura Milano", scope: "Fournisseur", others: 4, rule: { id: "S1", conditions: 1 } });
    expect(c.indicators[0]).toMatchObject({ value: 88, seuil: 60, sens: "≥", status: "critique" });
    expect(c.decision).toMatch(/\?$/);
  });

  it("tendance : série hebdomadaire de la même prévision, ou évaluation précédente publiée", () => {
    const s6 = evaluateCausalRules(v).find(x => x.rule.id === "S6")!;
    const t6 = entityTrend(v, "k-s6", s6.matches[0].facts[0].record)!;
    expect(t6.source).toBe("série");
    expect(t6.points).toContainEqual({ label: "2026-W40", value: 34.2 });
    expect(t6.points.map(p => p.label)).toEqual([...t6.points.map(p => p.label)].sort());
    expect(t6.points.length).toBeGreaterThan(2);
    const s1 = evaluateCausalRules(v).find(x => x.rule.id === "S1")!;
    const t1 = entityTrend(v, "k-s1", s1.matches[0].facts[0].record)!;
    expect(t1).toEqual({ source: "tendance publiée", points: [{ label: "précédente", value: 69 }, { label: "actuelle", value: 88 }] });
  });
});
