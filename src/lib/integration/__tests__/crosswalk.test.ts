import { describe, expect, it } from "vitest";
import { normDuns, normEan, normName, normPo, normSiren, normSiret, normSite, normVat, nameScore, vatFromSiren } from "../normalize";
import { buildMaster, linkProductsToSuppliers, masterReport, matchSource, reviewId } from "../crosswalk";
import { detectDivergences, withinTolerance, type Acv } from "../ownership";
import { TieredCache, MemoryLevel, QueryCache, TTL_MS, qualityOf } from "../cache";
import { dueNow } from "../scheduler";

describe("normalisation des clés", () => {
  it("SIRET, SIREN, TVA, DUNS", () => {
    expect(normSiret("123 456 789 00012")).toBe("12345678900012");
    expect(normSiren("12345678900012")).toBe("123456789");
    const vat = vatFromSiren("123456789")!;
    expect(normVat(vat.toLowerCase().replace(/(..)(..)/, "$1 $2 "))).toBe(vat);
    expect(normVat("FR00123456789")).toBeNull(); // clé fausse
    expect(normSiren(vat)).toBe("123456789");
    expect(normDuns("15-000-0013")).toBe("150000013");
  });
  it("EAN/GTIN, site, commande, raison sociale", () => {
    expect(normEan("03760000000017")).toBe("3760000000017");
    expect(normEan("3760000000012")).toBeNull(); // clé de contrôle fausse
    expect(normSite("btq_par_fsh")).toBe(normSite("BTQ-PAR-FSH"));
    expect(normSite("WHPAR")).toBe(normSite("WH-PAR"));
    expect(normPo("PO-4500000001")).toBe("4500000001");
    expect(normName("MAISON CUIR DU NORD SAS")).toBe(normName("Maison Cuir du Nord"));
    expect(nameScore("TESSITURA MILANO Ltd", "Tessitura Milano")).toBe(1);
    expect(nameScore("Tessitura Milano", "Atlas Metalworks")).toBeLessThan(0.6);
  });
});

const sap = [
  { Supplier: "0000100001", SupplierName: "Tessitura Milano", VATRegistration: "IT00000007717", TaxNumber1: null, DUNS: null },
  { Supplier: "0000100002", SupplierName: "Maison Cuir du Nord", VATRegistration: vatFromSiren("100000074"), TaxNumber1: "10000007400003", DUNS: null },
  { Supplier: "0000100003", SupplierName: "Shenzhen Atelier Components", VATRegistration: null, TaxNumber1: null, DUNS: "150000039" },
  // Doublon : même SIRET formaté autrement, autre LIFNR.
  { Supplier: "0000100061", SupplierName: "MAISON CUIR DU NORD SAS", VATRegistration: null, TaxNumber1: "100 000 074 00003", DUNS: null },
];
const masterSpec = { domain: "supplier" as const, system: "sap", keyField: "Supplier", nameField: "SupplierName", idPrefix: "FRN-", keys: [{ type: "siren" as const, field: "TaxNumber1" }, { type: "vat" as const, field: "VATRegistration" }, { type: "duns" as const, field: "DUNS" }] };

describe("crosswalk en trois étapes", () => {
  const m = buildMaster(masterSpec, sap);
  it("détecte les doublons du maître par clé forte", () => {
    expect(m.duplicates).toHaveLength(1);
    expect(m.duplicates[0].sourceKeys).toEqual(["0000100002", "0000100061"]);
    expect(masterReport(m).duplicates).toHaveLength(1);
  });
  it("exacte, normalisée, ressemblance en file de validation (jamais appliquée seule)", () => {
    const rows = [
      { name: "Tessitura Milano" },               // exacte (nom identique)
      { name: "TESSITURA MILANO Ltd" },           // ressemblance → file
      { name: "Fournisseur inconnu" },            // orphelin
    ];
    const r = matchSource(m, { domain: "supplier", system: "wms", keyField: "name", nameField: "name", keys: [], fuzzy: true }, rows);
    expect(r.entries.map(e => [e.sourceKey, e.method])).toEqual([["Tessitura Milano", "exact"]]);
    expect(r.review).toHaveLength(1);
    expect(r.review[0].candidateIdOr).toBe("FRN-0000100001");
    expect(r.report.pendingReview).toBe(1);
    expect(r.report.pct).toBeCloseTo(33.3, 1);
    // Validée par l'utilisateur : appliquée au passage suivant.
    const decisions = new Map([[reviewId("supplier", "wms", "TESSITURA MILANO Ltd", "FRN-0000100001"), "validated" as const]]);
    const r2 = matchSource(m, { domain: "supplier", system: "wms", keyField: "name", nameField: "name", keys: [], fuzzy: true }, rows, decisions);
    expect(r2.entries.find(e => e.sourceKey === "TESSITURA MILANO Ltd")?.method).toBe("validated");
  });
  it("lien produit → fournisseur par identifiant fiscal libre, orphelin signalé", () => {
    const products = buildMaster({ domain: "product", system: "pim", keyField: "id", idPrefix: "ART-", keys: [{ type: "ean", field: "ean" }] }, [
      { id: "P1", ean: "3760000000013", tax: "it 00000007717" },
      { id: "P2", ean: "3760000000020", tax: "fr " + vatFromSiren("100000074")!.slice(2, 4) + " 100000074" },
      { id: "P3", ean: "3760000000037", tax: "15-000-0039" },
      { id: "P4", ean: "3760000000044", tax: "FR99000000004" },
    ]);
    const link = linkProductsToSuppliers(products, m, "tax");
    expect(link.entries.map(e => e.idOr)).toEqual(["FRN-0000100001", "FRN-0000100002", "FRN-0000100003"]);
    expect(link.report.orphans.map(o => o.sourceKey)).toEqual(["ART-P4"]);
  });
  it("clé ambiguë (EAN en double) : conflit, pas de rattachement arbitraire", () => {
    const products = buildMaster({ domain: "product", system: "pim", keyField: "id", idPrefix: "ART-", keys: [{ type: "ean", field: "ean" }] }, [{ id: "A", ean: "3760000000017" }, { id: "B", ean: "3760000000017" }]);
    const r = matchSource(products, { domain: "product", system: "wms", keyField: "item", keys: [{ type: "ean", field: "item" }], fuzzy: false }, [{ item: "03760000000017" }]);
    expect(r.entries).toHaveLength(0);
    expect(r.report.conflicts).toHaveLength(1);
  });
});

describe("cohérence golden record", () => {
  const acv: Acv = { domainMasters: { supplier: "sap", product: "pim", site: "wms" }, attributes: [
    { domain: "supplier", attribute: "Pays", consumers: ["pim"], validated: true, tolerance: { kind: "exact" } },
    { domain: "supplier", attribute: "Nom fournisseur", consumers: ["wms"], validated: true, tolerance: { kind: "forme" } },
  ] };
  it("la valeur du maître fait foi ; écart signalé au-delà de la tolérance", () => {
    const d = detectDivergences(acv, [
      { idOr: "F1", domain: "supplier", attribute: "Pays", system: "pim", value: "HK" },
      { idOr: "F1", domain: "supplier", attribute: "Pays", system: "sap", value: "CN" },
      { idOr: "F1", domain: "supplier", attribute: "Nom fournisseur", system: "sap", value: "Tessitura Milano" },
      { idOr: "F1", domain: "supplier", attribute: "Nom fournisseur", system: "wms", value: "TESSITURA MILANO Ltd" },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ attribute: "Pays", master: { system: "sap", value: "CN" }, kind: "fond" });
  });
  it("tolérances numériques et dates", () => {
    expect(withinTolerance({ kind: "pct", value: 5 }, "Stock", 100, 104)).toBe(true);
    expect(withinTolerance({ kind: "pct", value: 5 }, "Stock", 100, 110)).toBe(false);
    expect(withinTolerance({ kind: "days", value: 2 }, "Date", "2026-09-01", "2026-09-03")).toBe(true);
    expect(withinTolerance({ kind: "days", value: 2 }, "Date", "2026-09-01", "2026-09-05")).toBe(false);
  });
});

describe("cache et planification", () => {
  it("TTL par classe d'objet et clé liée au watermark", () => {
    let t = 0;
    const c = new QueryCache(1e6, () => t);
    const k1 = c.key("wms", { entity: "inventory" }, "2026-09-28T00:00:00Z"), k2 = c.key("wms", { entity: "inventory" }, "2026-09-28T01:00:00Z");
    expect(k1).not.toBe(k2);
    c.set(k1, [1], "shipment");
    t = TTL_MS.shipment - 1; expect(c.get(k1)).toEqual([1]);
    t = TTL_MS.shipment + 1; expect(c.get(k1)).toBeUndefined();
  });
  it("trois niveaux : promotion en L1 des clés très demandées, score de qualité", async () => {
    let t = 1_000_000;
    const now = () => t;
    const c = new TieredCache(new MemoryLevel("L1", 60_000, 1e6, now), new MemoryLevel("L2", 3_600_000, 1e6, now), null, { hotHits: 3, hotWindowMs: 600_000, l3MinBytes: 1e9, now });
    let loads = 0;
    const load = async () => { loads++; return [42]; };
    const a = await c.getOrLoad("L1:s:x:-", "stock", load);
    expect(a.level).toBe("source");
    const b = await c.getOrLoad("L1:s:x:-", "stock", load);
    expect(b.level).toBe("L2");
    await c.getOrLoad("L1:s:x:-", "stock", load); // 3e demande : clé chaude → copiée en L1
    const d = await c.getOrLoad("L1:s:x:-", "stock", load);
    expect(d.level).toBe("L1");
    expect(loads).toBe(1);
    t += 30 * 60_000;
    const e = await c.getOrLoad("L1:s:x:-", "stock", load);
    expect(e.quality.freshness).toBeLessThan(0.6);
    expect(qualityOf({ ageMs: 0, ttlMs: 1000, source: "s", level: "source", divergent: true }).score).toBe(85);
  });
  it("deltas légers toutes les 3 h en journée, complet la nuit", () => {
    const day = new Date("2026-09-29T10:00:00Z");
    expect(dueNow(day, { at: null, mode: null, lastFullAt: null })?.mode).toBe("full");
    expect(dueNow(day, { at: "2026-09-29T08:00:00Z", mode: "incremental", lastFullAt: "2026-09-29T02:00:00Z" })).toBeNull();
    expect(dueNow(day, { at: "2026-09-29T06:59:00Z", mode: "incremental", lastFullAt: "2026-09-29T02:00:00Z" })?.mode).toBe("incremental");
    expect(dueNow(new Date("2026-09-30T02:30:00Z"), { at: "2026-09-29T19:00:00Z", mode: "incremental", lastFullAt: "2026-09-29T02:00:00Z" })?.mode).toBe("full");
  });
});

import { classifyIntent, routeQuestion } from "../copilot-router";
describe("routage du copilote", () => {
  it("structurel, factuel, causal, temporel — sans appel à la source", () => {
    expect(classifyIntent("Quelle source est maître du pays fournisseur ?")).toBe("structurel");
    expect(classifyIntent("Combien de positions sont en rupture ?")).toBe("factuel");
    expect(classifyIntent("Pourquoi Tessitura est-elle en retard ?")).toBe("causal");
    expect(classifyIntent("Comment évolue le taux de retard depuis un mois ?")).toBe("temporel");
    const r = routeQuestion("Pourquoi cette alerte ?", { rules: "SI retard > 30 % ALORS risque", facts: "72 ruptures" });
    expect(r).toMatchObject({ intent: "causal", reads: "règles", sourceCalls: 0 });
    expect(r.context).not.toMatch(/72 ruptures/);
  });
});
