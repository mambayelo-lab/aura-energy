// Cohérence du catalogue Supply Chain : indicateurs et seuils, règles
// causales, familles du cockpit, modèle objet (ontologie) et alertes de la
// démo Maison Lucie recalculées à la main depuis les données brutes du SI.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blankVocab, deriveObservation, evaluateCausalRules, kpiStatus, maisonLucieVocab, withSupplyChainRulebook,
  type ArgusVocab, type CausalRule,
} from "../argus-vocab-store";
import { runSupplyDemo } from "../supply-demo";
import { supplyFamilyOf } from "../supply-families";
import { SUPPLY_CHAIN_ENTITIES, SUPPLY_CHAIN_RELATIONSHIPS, withSupplyChainModel } from "../supply-model";
import fixture from "./fixtures/maison-lucie-si.json";
import { stubMaisonLucie } from "./lucie-stub";

type Row = Record<string, unknown>;
const records = (app: string) => (fixture.datasets as Record<string, { records: Row[] }>)[app].records;
const table = (app: string, name: string) => (fixture.datasets as Record<string, { tables: Record<string, Row[]> }>)[app].tables[name];

const standard = maisonLucieVocab();
const rulebook = withSupplyChainRulebook(blankVocab());
const kpiById = new Map(rulebook.kpis.map(k => [k.id, k]));
const liveRules = rulebook.causalRules.filter(r => r.conditions.length > 0);

describe("indicateurs et seuils", () => {
  it("les seuils sont ordonnés selon le sens de l'alerte", () => {
    for (const k of rulebook.kpis) {
      if (k.direction === "au_dessus_alerte") expect(k.seuilAlerte, k.id).toBeLessThan(k.seuilCritique);
      else expect(k.seuilAlerte, k.id).toBeGreaterThan(k.seuilCritique);
    }
  });

  it("kpiStatus respecte le sens (au-dessus / en dessous)", () => {
    const cover = kpiById.get("k-s2")!;
    expect(kpiStatus({ ...cover, currentValue: 10 })).toBe("ok");
    expect(kpiStatus({ ...cover, currentValue: 6 })).toBe("alerte");
    expect(kpiStatus({ ...cover, currentValue: 2 })).toBe("critique");
    const delay = kpiById.get("k-s4")!;
    expect(kpiStatus({ ...delay, currentValue: 10 })).toBe("ok");
    expect(kpiStatus({ ...delay, currentValue: 30 })).toBe("alerte");
    expect(kpiStatus({ ...delay, currentValue: 72 })).toBe("critique");
  });

  it("unités cohérentes avec la grandeur mesurée", () => {
    const unitOf = (id: string) => kpiById.get(id)!.unit;
    expect(unitOf("k-s1")).toBe("score/100");
    expect(unitOf("k-s2")).toBe("jours");
    expect(unitOf("k-s4")).toBe("h");
    expect(unitOf("k-s6")).toBe("%");
    expect(unitOf("k-s10")).toBe("score/100");
    for (const k of rulebook.kpis.filter(x => x.unit === "score/100" || x.unit === "%")) {
      expect(k.seuilCritique, k.id).toBeLessThanOrEqual(100);
    }
  });

  it("les indicateurs rattachés à un objet pointent vers un objet du modèle", () => {
    const ids = new Set(SUPPLY_CHAIN_ENTITIES.map(e => e.id));
    for (const k of rulebook.kpis.filter(x => x.entityId)) expect(ids.has(k.entityId!), `${k.id} → ${k.entityId}`).toBe(true);
  });
});

describe("règles causales", () => {
  it("aucune condition orpheline (KPI ou règle inexistants) ni condition mixte", () => {
    const ruleIds = new Set(rulebook.causalRules.map(r => r.id));
    for (const r of rulebook.causalRules) for (const c of r.conditions) {
      expect(!!c.kpiId !== !!c.ruleId, `${r.id} : kpiId XOR ruleId`).toBe(true);
      if (c.kpiId) { expect(kpiById.has(c.kpiId), `${r.id} → ${c.kpiId}`).toBe(true); expect(c.minStatus).toBeDefined(); }
      if (c.ruleId) expect(ruleIds.has(c.ruleId), `${r.id} → ${c.ruleId}`).toBe(true);
    }
  });

  it("le graphe de chaînage est sans cycle", () => {
    const deps = new Map(rulebook.causalRules.map(r => [r.id, r.conditions.flatMap(c => c.ruleId ? [c.ruleId] : [])]));
    const state = new Map<string, "en cours" | "fini">();
    const visit = (id: string): void => {
      if (state.get(id) === "fini") return;
      expect(state.get(id), `cycle via ${id}`).not.toBe("en cours");
      state.set(id, "en cours");
      for (const d of deps.get(id) ?? []) visit(d);
      state.set(id, "fini");
    };
    for (const id of deps.keys()) visit(id);
  });

  it("chaque règle ancrée porte sur l'indicateur de sa famille métier", () => {
    const expected: Record<string, { kpi: string; family: string }> = {
      S1: { kpi: "k-s1", family: "fournisseur" },
      S2: { kpi: "k-s2", family: "stock" },
      S4: { kpi: "k-s4", family: "transport" },
      S6: { kpi: "k-s6", family: "demande" },
      S9: { kpi: "k-s10", family: "fournisseur" },
    };
    expect(liveRules.map(r => r.id).sort()).toEqual(Object.keys(expected).sort());
    for (const r of liveRules) {
      const kpiId = r.conditions.find(c => c.kpiId)!.kpiId!;
      expect(kpiId, r.id).toBe(expected[r.id].kpi);
      expect(supplyFamilyOf(r.label, kpiById.get(kpiId)!.label), r.id).toBe(expected[r.id].family);
      // La famille déduite de l'alerte seule doit être la même que celle du KPI seul.
      expect(supplyFamilyOf("", kpiById.get(kpiId)!.label), `${r.id} (KPI)`).toBe(expected[r.id].family);
    }
  });

  it("gravité par défaut compatible avec le niveau exigé par la condition", () => {
    for (const r of liveRules) {
      const min = r.conditions.find(c => c.kpiId)!.minStatus;
      if (min === "critique") { expect(r.severity, r.id).toBe("critique"); expect(r.displaySeverity ?? "critique", r.id).toBe("critique"); }
      if (r.displaySeverity === "critique") expect(min, r.id).toBe("critique");
    }
  });

  it("conclusion causale, question de décision distincte, causes et options renseignées", () => {
    for (const r of liveRules) {
      expect(r.conclusion.trim().endsWith("?"), `${r.id} : la conclusion n'est pas une question`).toBe(false);
      expect(r.decisionQuestion?.trim().endsWith("?"), r.id).toBe(true);
      expect(r.conclusion).not.toBe(r.decisionQuestion);
      expect((r.causes ?? []).length, r.id).toBeGreaterThan(0);
      expect((r.options ?? []).length, r.id).toBeGreaterThan(0);
    }
  });

  it("le vocabulaire des causes et conclusions correspond à l'indicateur (pas de cause hors sujet)", () => {
    const text = (r: CausalRule) => `${r.label} ${r.conclusion} ${(r.causes ?? []).join(" ")}`.toLowerCase();
    const rule = (id: string) => liveRules.find(r => r.id === id)!;
    expect(text(rule("S1"))).toMatch(/capacité/);
    expect(text(rule("S1"))).not.toMatch(/couverture/);
    expect(text(rule("S2"))).toMatch(/couverture|stock/);
    expect(text(rule("S2"))).not.toMatch(/transport|fournisseur/);
    expect(text(rule("S4"))).toMatch(/retard|expédition/);
    expect(text(rule("S4"))).not.toMatch(/stock de sécurité|prévision/);
    expect(text(rule("S6"))).toMatch(/prévision/);
    expect(text(rule("S9"))).toMatch(/géopolitique/);
  });

  it("une règle sans condition n'est jamais déclenchée", () => {
    const triggered = evaluateCausalRules(rulebook).filter(r => r.triggered);
    expect(triggered).toHaveLength(0);
  });
});

describe("migration douce d'un vocabulaire enregistré avant l'audit", () => {
  const legacy = (): ArgusVocab => ({
    ...blankVocab(),
    kpis: [
      { id: "k-s1", label: "Risque de capacité fournisseur", unit: "score/100", direction: "au_dessus_alerte", seuilAlerte: 60, seuilCritique: 85, entityId: "e-fournisseur" },
      { id: "k-s6", label: "Prévision de demande promue", unit: "unités", direction: "au_dessus_alerte", seuilAlerte: 1000, seuilCritique: 1500 },
    ],
    causalRules: [{ id: "S9", label: "Risque géopolitique/pays", conditions: [{ kpiId: "k-s9", minStatus: "alerte" }], conclusion: "Que sécuriser, diversifier, relocaliser ou prépositionner ?", severity: "alerte", origin: "manuel" }],
    apps: [{ id: "ml-demand", label: "Lucie Data Cloud", type: "Data Cloud", connectionHint: "", secretConfigured: true }],
    fields: [{ id: "f1", appId: "ml-demand", name: "DemandForecast.promoted", sampleValues: ["7611"] }],
    mappings: [{ id: "m1", kpiId: "k-s6", appId: "ml-demand", fieldId: "f1", method: "semantique" }],
    entities: [{ id: "sc-prevision", name: "Prévision de demande", description: "Demande attendue par article et période.", attributes: [{ id: "sc-prevision.promo", name: "Promotion", type: "boolean" }] }],
    relationships: [{ id: "sc-r4", fromEntityId: "sc-expedition", toEntityId: "sc-stock", label: "réapprovisionne", cardinality: "N-N" }],
    entityMappings: [{ id: "em1", entityId: "sc-prevision", attributeId: "sc-prevision.promo", appId: "ml-demand", fieldId: "f1", isMaster: true, method: "semantique" }],
  });

  it("met à jour les définitions d'origine et retire les branchements devenus faux", () => {
    const v = withSupplyChainModel(withSupplyChainRulebook(legacy()));
    const s6 = v.kpis.find(k => k.id === "k-s6")!;
    expect(s6.unit).toBe("%");
    expect(s6.seuilAlerte).toBeLessThan(s6.seuilCritique);
    expect(v.kpis.find(k => k.id === "k-s1")!.entityId).toBe("sc-fournisseur");
    expect(v.mappings.some(m => m.kpiId === "k-s6")).toBe(false);
    expect(v.causalRules.find(r => r.id === "S9")!.conditions).toEqual([{ kpiId: "k-s10", minStatus: "alerte" }]);
    const promo = v.entities!.find(e => e.id === "sc-prevision")!.attributes.find(a => a.id === "sc-prevision.promo")!;
    expect(promo.type).toBe("text");
    expect(v.entities!.find(e => e.id === "sc-prevision")!.attributes.some(a => a.id === "sc-prevision.sku")).toBe(true);
    expect(v.relationships!.find(r => r.id === "sc-r4")).toMatchObject({ fromEntityId: "sc-commande", toEntityId: "sc-expedition", cardinality: "1-N" });
    expect(v.entityMappings).toHaveLength(0);
  });

  it("conserve les réglages personnalisés", () => {
    const custom = legacy();
    custom.kpis[1] = { ...custom.kpis[1], seuilAlerte: 2000, seuilCritique: 3000 };
    custom.causalRules[0] = { ...custom.causalRules[0], conclusion: "Ma conclusion." };
    const v = withSupplyChainRulebook(custom);
    expect(v.kpis.find(k => k.id === "k-s6")!.unit).toBe("unités");
    expect(v.mappings.some(m => m.kpiId === "k-s6")).toBe(true);
    expect(v.causalRules.find(r => r.id === "S9")!.conclusion).toBe("Ma conclusion.");
  });
});

describe("ontologie Supply Chain", () => {
  const ids = new Set(SUPPLY_CHAIN_ENTITIES.map(e => e.id));
  const rel = (from: string, to: string) => SUPPLY_CHAIN_RELATIONSHIPS.find(r => r.fromEntityId === from && r.toEntityId === to);

  it("identifiants uniques, attributs préfixés par leur objet, un identifiant par objet", () => {
    expect(ids.size).toBe(SUPPLY_CHAIN_ENTITIES.length);
    for (const e of SUPPLY_CHAIN_ENTITIES) {
      const attrIds = e.attributes.map(a => a.id);
      expect(new Set(attrIds).size, e.id).toBe(attrIds.length);
      for (const a of e.attributes) expect(a.id.startsWith(`${e.id}.`), a.id).toBe(true);
      // Identifiant propre, ou clés (SKU + site / SKU + semaine) pour les objets de position.
      const keys = e.attributes.filter(a => /^Identifiant|^SKU$|^Site$|^Semaine$/.test(a.name));
      expect(keys.length, `${e.id} sans clé`).toBeGreaterThan(0);
    }
  });

  it("relations valides : objets existants, identifiants uniques, sans doublon", () => {
    const relIds = SUPPLY_CHAIN_RELATIONSHIPS.map(r => r.id);
    expect(new Set(relIds).size).toBe(relIds.length);
    const pairs = SUPPLY_CHAIN_RELATIONSHIPS.map(r => `${r.fromEntityId}>${r.toEntityId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const r of SUPPLY_CHAIN_RELATIONSHIPS) {
      expect(ids.has(r.fromEntityId), r.id).toBe(true);
      expect(ids.has(r.toEntityId), r.id).toBe(true);
      expect(r.fromEntityId).not.toBe(r.toEntityId);
    }
  });

  it("cardinalités conformes aux clés étrangères du SI Maison Lucie", () => {
    expect(rel("sc-fournisseur", "sc-commande")?.cardinality).toBe("1-N");
    expect(rel("sc-article", "sc-commande")?.cardinality).toBe("1-N");
    expect(rel("sc-article", "sc-stock")?.cardinality).toBe("1-N");
    expect(rel("sc-site", "sc-stock")?.cardinality).toBe("1-N");
    expect(rel("sc-commande", "sc-expedition")?.cardinality).toBe("1-N");
    expect(rel("sc-article", "sc-prevision")?.cardinality).toBe("1-N");
    expect(rel("sc-perturbation", "sc-expedition")?.cardinality).toBe("N-N");
    // Chaque 1-N se lit sur une clé étrangère réelle de la table « vers ».
    const po = records("sap-s4")[0], inv = records("manhattan-wms")[0], shp = records("blueyonder-tms")[0], fc = records("snowflake-demand")[0];
    expect(po).toHaveProperty("supplierId"); expect(po).toHaveProperty("sku"); expect(po).toHaveProperty("destinationSiteId");
    expect(inv).toHaveProperty("sku"); expect(inv).toHaveProperty("siteId");
    expect(shp).toHaveProperty("purchaseOrderId");
    expect(fc).toHaveProperty("sku"); expect(fc).toHaveProperty("week");
    // Une commande = un article ; une expédition = une commande.
    for (const r of records("sap-s4")) expect(typeof r.sku).toBe("string");
    for (const r of records("blueyonder-tms")) expect(records("sap-s4").some(p => p.purchaseOrderId === r.purchaseOrderId), String(r.shipmentId)).toBe(true);
  });

  it("types d'attributs cohérents avec les colonnes sources", () => {
    const attr = (id: string) => SUPPLY_CHAIN_ENTITIES.flatMap(e => e.attributes).find(a => a.id === id)!;
    expect(attr("sc-prevision.promo").type).toBe("text");
    expect(typeof records("snowflake-demand")[0].promoted).toBe("number");
    for (const id of ["sc-stock.couverture", "sc-expedition.retard", "sc-fournisseur.capacite", "sc-prevision.ecart", "sc-prevision.baseline"]) expect(attr(id).type, id).toBe("number");
    for (const id of ["sc-commande.date", "sc-expedition.eta"]) expect(attr(id).type, id).toBe("date");
  });

  it("objets manquants ajoutés (Site, Commande client, Perturbation) et présents dans le SI", () => {
    for (const id of ["sc-site", "sc-commande-client", "sc-perturbation"]) expect(ids.has(id), id).toBe(true);
    expect(table("manhattan-wms", "Site").length).toBeGreaterThan(0);
    expect(table("blueyonder-tms", "Disruption").length).toBeGreaterThan(0);
    expect(records("rest-order-management").length).toBeGreaterThan(0);
  });
});

// ── Démo Maison Lucie : alertes recalculées depuis les données brutes ──────

describe("démo Maison Lucie : les 5 alertes sont justes, entité par entité", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("recalcule chaque valeur observée à la main et retrouve le même statut", async () => {
    stubMaisonLucie();
    const r = await runSupplyDemo(blankVocab());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = r.vocab;
    const triggered = evaluateCausalRules(v).filter(x => x.triggered).map(x => x.rule.id).sort();
    // Les 5 alertes historiques restent, aux côtés des règles de résilience calculées sur les mêmes données.
    expect(triggered.filter(id => /^S\d+$/.test(id))).toEqual(["S1", "S2", "S4", "S6", "S9"]);
    expect(triggered.some(id => id.startsWith("RES-"))).toBe(true);

    // Valeurs de référence calculées directement sur les enregistrements bruts.
    const risk = records("coupa-risk"), inv = records("manhattan-wms"), shp = records("blueyonder-tms"), fc = records("snowflake-demand");
    const promos = table("snowflake-demand", "Promotion") as { promotionId: string; upliftPct: number }[];
    const maxBy = (rows: Row[], f: (r: Row) => number) => rows.reduce((a, b) => f(b) > f(a) ? b : a);
    const minBy = (rows: Row[], f: (r: Row) => number) => rows.reduce((a, b) => f(b) < f(a) ? b : a);
    const cap = maxBy(risk, x => Number(x.capacityRisk));
    // La couverture publiée par le WMS est bien disponible / demande journalière (arrondie au dixième).
    for (const x of inv) expect(Number(x.daysOfCover), `${x.sku}@${x.siteId}`).toBeCloseTo(Number(x.available) / Number(x.dailyDemand), 1);
    const cover = minBy(inv, x => Number(x.daysOfCover));
    const delay = maxBy(shp, x => Number(x.delayHours));
    const gapOf = (x: Row) => Math.abs(Number(x.promoted) / (Number(x.baseline) * (1 + (promos.find(p => p.promotionId === x.promotionId)?.upliftPct ?? 0) / 100)) - 1) * 100;
    const gap = maxBy(fc, gapOf);
    const geo = maxBy(risk, x => Number(x.geopoliticalRisk));

    expect([cap.supplierId, cap.capacityRisk]).toEqual(["SUP-001", 88]);
    expect([cover.sku, cover.siteId, cover.daysOfCover]).toEqual(["BOX-PREMIUM", "WH-PAR", 1.8]);
    expect([delay.shipmentId, delay.delayHours]).toEqual(["SHP-893", 96]);
    expect([gap.sku, gap.week, Math.round(gapOf(gap) * 10) / 10]).toEqual(["BAG-LUNA", "2026-W40", 34.2]);
    expect([geo.supplierId, geo.geopoliticalRisk]).toEqual(["SUP-003", 68]);

    const obs = (kpiId: string) => deriveObservation(v, kpiId)!;
    const status = (kpiId: string) => kpiStatus({ ...v.kpis.find(k => k.id === kpiId)!, currentValue: obs(kpiId).value });
    expect([obs("k-s1").value, obs("k-s1").record?.supplierId, status("k-s1")]).toEqual([88, "SUP-001", "critique"]);
    expect([obs("k-s2").value, obs("k-s2").record?.sku, status("k-s2")]).toEqual([1.8, "BOX-PREMIUM", "critique"]);
    expect([obs("k-s4").value, obs("k-s4").record?.shipmentId, status("k-s4")]).toEqual([96, "SHP-893", "critique"]);
    expect([obs("k-s6").value, obs("k-s6").record?.sku, status("k-s6")]).toEqual([34.2, "BAG-LUNA", "alerte"]);
    expect([obs("k-s10").value, obs("k-s10").record?.supplierId, status("k-s10")]).toEqual([68, "SUP-003", "alerte"]);

    // Nombre d'enregistrements hors seuil, recompté à la main.
    expect(obs("k-s2").breachCount).toBe(inv.filter(x => Number(x.daysOfCover) <= 7).length);
    expect(obs("k-s6").breachCount).toBe(fc.filter(x => gapOf(x) >= 20).length);

    // Chaque règle s'applique par entité : la liste des entités qui la
    // déclenchent, recomptée sur les enregistrements bruts, et la plus grave en tête.
    const evals = new Map(evaluateCausalRules(v).map(x => [x.rule.id, x]));
    const keysOf = (id: string) => evals.get(id)!.matches.map(m => m.key).sort();
    expect(evals.get("S1")!.scope.entityName).toBe("Fournisseur");
    expect(keysOf("S1")).toEqual(risk.filter(x => Number(x.capacityRisk) >= 60).map(x => String(x.supplierId)).sort());
    expect(keysOf("S1")).toEqual(["SUP-001", "SUP-003", "SUP-006", "SUP-010", "SUP-011"]);
    expect(evals.get("S1")!.matches[0].label).toBe("SUP-001 · Tessitura Milano");
    expect(keysOf("S2")).toEqual(inv.filter(x => Number(x.daysOfCover) <= 7).map(x => `${x.sku} · ${x.siteId}`).sort());
    expect(keysOf("S2")).toHaveLength(13);
    expect(evals.get("S2")!.matches[0].key).toBe("BOX-PREMIUM · WH-PAR");
    expect(keysOf("S4")).toEqual(shp.filter(x => Number(x.delayHours) >= 48).map(x => String(x.shipmentId)).sort());
    expect(keysOf("S4")).toEqual(["SHP-883", "SHP-887", "SHP-893", "SHP-894"]);
    expect(evals.get("S4")!.matches[0].label).toBe("SHP-893 · AsiaBridge");
    expect(keysOf("S6")).toEqual(["BAG-LUNA · 2026-W40"]);
    expect(keysOf("S9")).toEqual(risk.filter(x => Number(x.geopoliticalRisk) >= 50).map(x => String(x.supplierId)).sort());
    expect(keysOf("S9")).toEqual(["SUP-003", "SUP-006", "SUP-008"]);
    expect(evals.get("S9")!.matches[0].label).toBe("SUP-003 · Shenzhen Atelier Components");
  });

  it("une règle capacité ET géopolitique ne se déclenche que pour un même fournisseur", async () => {
    stubMaisonLucie();
    const r = await runSupplyDemo(blankVocab());
    if (!r.ok) throw new Error(r.error);
    const both: CausalRule = { id: "X", label: "Double exposition capacité et géopolitique", conditions: [{ kpiId: "k-s1", minStatus: "alerte" }, { kpiId: "k-s10", minStatus: "alerte" }], conclusion: "", severity: "alerte", origin: "manuel" };
    const v = { ...r.vocab, causalRules: [...r.vocab.causalRules, both] };
    const x = evaluateCausalRules(v).find(e => e.rule.id === "X")!;
    // À la main : capacité ≥ 60 ET géopolitique ≥ 50 sur la même ligne SupplierRiskAssessment.
    const risk = records("coupa-risk");
    const expected = risk.filter(s => Number(s.capacityRisk) >= 60 && Number(s.geopoliticalRisk) >= 50).map(s => String(s.supplierId));
    expect(expected).toEqual(["SUP-003", "SUP-006"]);
    expect(x.matches.map(m => m.key)).toEqual(expected);
    // Avant : 88 (SUP-001) et 68 (SUP-003) étaient combinés alors que SUP-001 a un risque géopolitique de 12.
    expect(x.matches.some(m => m.key === "SUP-001")).toBe(false);
    expect(x.matches[0].label).toBe("SUP-003 · Shenzhen Atelier Components");
    expect(x.matches[0].facts.map(f => f.value)).toEqual([72, 68]);
  });

  it("chaque indicateur est branché sur la bonne colonne source et chaque attribut sur la bonne table", async () => {
    stubMaisonLucie();
    const r = await runSupplyDemo(blankVocab());
    if (!r.ok) throw new Error(r.error);
    const v = r.vocab;
    const fieldOfKpi = (id: string) => v.fields.find(f => f.id === v.mappings.find(m => m.kpiId === id)?.fieldId)?.name;
    expect(fieldOfKpi("k-s1")).toBe("SupplierRiskAssessment.capacityRisk");
    expect(fieldOfKpi("k-s2")).toBe("InventoryPosition.daysOfCover");
    expect(fieldOfKpi("k-s4")).toBe("Shipment.delayHours");
    expect(fieldOfKpi("k-s6")).toBe("DemandForecast.forecastGapPct");
    expect(fieldOfKpi("k-s9")).toBe("SupplierRiskAssessment.overallRisk");
    expect(fieldOfKpi("k-s10")).toBe("SupplierRiskAssessment.geopoliticalRisk");

    const fieldOfAttr = (attrId: string) => v.fields.find(f => f.id === (v.entityMappings ?? []).find(m => m.attributeId === attrId)?.fieldId)?.name;
    expect(fieldOfAttr("sc-prevision.promo")).toBe("DemandForecast.promotionId");
    expect(fieldOfAttr("sc-prevision.ecart")).toBe("DemandForecast.forecastGapPct");
    expect(fieldOfAttr("sc-commande.id")).toBe("PurchaseOrder.purchaseOrderId");
    expect(fieldOfAttr("sc-commande.fournisseur")).toBe("PurchaseOrder.supplierId");
    expect(fieldOfAttr("sc-expedition.commande")).toBe("Shipment.purchaseOrderId");
    expect(fieldOfAttr("sc-commande-client.sku")).toBe("CustomerOrder.sku");
    // Un attribut numérique n'est jamais branché sur une colonne textuelle.
    for (const m of v.entityMappings ?? []) {
      const attr = v.entities!.flatMap(e => e.attributes).find(a => a.id === m.attributeId)!;
      const field = v.fields.find(f => f.id === m.fieldId)!;
      if (attr.type === "number") expect(field.sampleValues.every(x => /^-?\d+(?:[.,]\d+)?$/.test(x)), `${attr.id} ← ${field.name}`).toBe(true);
    }
  });
});

it("le référentiel standard reste celui de maisonLucieVocab", () => {
  expect(rulebook.kpis.map(k => k.id)).toEqual(standard.kpis.map(k => k.id));
  expect(rulebook.causalRules.map(r => r.id)).toEqual(standard.causalRules.map(r => r.id));
});
