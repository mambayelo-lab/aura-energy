import { beforeAll, describe, expect, it } from "vitest";
import { stubMaisonLucie } from "./lucie-stub";
import { runSupplyDemo } from "../supply-demo";
import { blankVocab, type ArgusVocab } from "../argus-vocab-store";
import { computeResilience, maturite, NON_FOURNI, resilienceAlerts, scenarioArret, signauxSanitaires } from "../resilience-tts";
import { deriveTables, exposureFor } from "../supply-derived";
import { supplyProfileFor } from "../supply-profiles";

// SI minimal : des tables lues et leurs correspondances vers l'ontologie, comme le Studio les produit.
type Rows = Record<string, string>[];
export function vocabFrom(tables: { app: string; table: string; rows: Rows; map: Record<string, string> }[]): ArgusVocab {
  const v = blankVocab();
  const at = "2026-09-28T04:00:00Z";
  return {
    ...v,
    apps: tables.map(t => ({ id: t.app, label: t.app, type: "APS", connectionHint: "REST", secretConfigured: true, sourceStatus: "connected" as const })),
    fields: tables.flatMap(t => Object.keys(t.rows[0]).map(c => ({ id: `${t.app}:${t.table}:${c}`, appId: t.app, name: `${t.table}.${c}`, liveTable: t.table, sampleValues: [] }))),
    siTables: tables.map(t => ({ id: `${t.app}:${t.table}`, appId: t.app, table: t.table, columns: Object.keys(t.rows[0]), rows: t.rows, fetchedAt: at })),
    entityMappings: tables.flatMap(t => Object.entries(t.map).map(([attr, col]) => ({ id: `${attr}:${t.table}`, entityId: attr.slice(0, attr.lastIndexOf(".")), attributeId: attr, appId: t.app, fieldId: `${t.app}:${t.table}:${col}`, isMaster: true, method: "manuel" as const }))),
  };
}
const POS = { "sc-position.sku": "Material", "sc-position.site": "FacilityId", "sc-position.couverture": "CoverageDays", "sc-position.tts": "TimeToSurviveDays", "sc-position.ttr": "TimeToRecoverDays", "sc-position.caRisque": "RevenueAtRiskEur", "sc-position.rupture": "ProjectedStockoutDate", "sc-position.reception": "NextReceiptDate" };
const p = (Material: string, FacilityId: string, cov: string, tts: string, ttr: string, ca: string, so = "", nr = "") => ({ Material, FacilityId, CoverageDays: cov, TimeToSurviveDays: tts, TimeToRecoverDays: ttr, RevenueAtRiskEur: ca, ProjectedStockoutDate: so, NextReceiptDate: nr });
const v = vocabFrom([
  { app: "aps", table: "supply-positions", map: POS, rows: [
    p("A", "WHPAR", "40", "60", "25", "0"), p("A", "WHLIL", "8", "12", "25", "18000", "2026-10-06", "2026-10-17"),
    p("B", "WHPAR", "200", "210", "70", "0"), p("C", "WHPAR", "", "", "", ""),
  ] },
  { app: "sap", table: "A_PurchasingSource", map: { "sc-source.sku": "Material", "sc-source.fournisseur": "Supplier", "sc-source.fixe": "SupplierIsFixed" }, rows: [{ Material: "A", Supplier: "F1", SupplierIsFixed: "true" }, { Material: "A", Supplier: "F2", SupplierIsFixed: "false" }, { Material: "B", Supplier: "F1", SupplierIsFixed: "true" }] },
  { app: "srm", table: "suppliers", map: { "sc-fournisseur.id": "Supplier", "sc-fournisseur.nom": "Name", "sc-fournisseur.pays": "Country" }, rows: [{ Supplier: "F1", Name: "Shenzhen Atelier", Country: "CN" }, { Supplier: "F2", Name: "Tessitura Milano", Country: "IT" }] },
]);

describe("résilience : valeurs lues, jamais calculées", () => {
  it("sans position planifiée fournie par le SI : rien n'est calculé ni inventé", () => {
    expect(computeResilience(blankVocab()).vide).toBe(true);
    expect(resilienceAlerts(blankVocab())).toEqual([]);
  });
  it("TTS et TTR lus par site ; l'article retient le site au TTS lu le plus court", () => {
    const res = computeResilience(v);
    const a = res.articles.find(x => x.sku === "A")!;
    expect(a.tts).toBe(12); expect(a.siteCritique).toBe("WHLIL"); expect(a.ttr).toBe(25); expect(a.ttrStatut).toBe("lu");
    expect(a.caRisque).toBe(18000); expect(a.critique).toBe(true); expect(a.gravite).toBe("critique");
    expect(res.articles.find(x => x.sku === "B")!.critique).toBe(false);
    const c = res.articles.find(x => x.sku === "C")!;
    expect(c.tts).toBeUndefined(); expect(c.ttrDetail).toContain(NON_FOURNI);
    expect(Object.keys(a)).not.toEqual(expect.arrayContaining(["margeExposee", "proba", "indice", "caExpose"]));
  });
  it("tri ordinal : gravité puis TTS lu ; carte par nombre de nœuds critiques", () => {
    const res = computeResilience(v);
    expect(res.articles[0].sku).toBe("A");
    expect(res.sites[0].id).toBe("WHLIL"); expect(res.sites[0].critiques).toBe(1);
  });
  it("alerte de nœud critique : CA à risque lu avec sa source, pas de montant calculé", () => {
    const al = resilienceAlerts(v).filter(a => a.id.startsWith("RES-TTS-"));
    expect(al).toHaveLength(1);
    expect(al[0].exposition?.eur).toBe(18000);
    expect(al[0].exposition?.what).toMatch(/lu/);
    expect(supplyProfileFor(al[0].id, al[0].label)?.id).toBe("resilience");
  });
  it("scénario d'arrêt : SI TTS lu < durée ALORS exposé ; aucun montant", () => {
    const res = computeResilience(v);
    const f = scenarioArret(res, { kind: "fournisseur", cible: "F1", dureeJours: 30 }, v);
    expect(f.lignes.map(l => [l.article.sku, l.statut])).toEqual([["A", "exposé"], ["B", "tient"]]);
    expect(f.regle).toMatch(/SI le délai de survie lu/);
    expect(JSON.stringify(f)).not.toMatch(/caPerdu|margePerdue/);
    expect(scenarioArret(res, { kind: "fournisseur", cible: "F1", dureeJours: 5 }, v).exposes).toHaveLength(0);
  });
  it("tables de règles : rupture projetée avant réception, montant lu pour l'entité déclenchante", () => {
    const { tables } = deriveTables(v);
    const r = tables.find(t => t.name === "RuptureProjetee")!;
    expect(r.rows).toEqual([expect.objectContaining({ sku: "A", siteId: "WHLIL", avantReception: 1, caRisqueEur: 18000 })]);
    expect(tables.some(t => t.name === "StockSecurite")).toBe(false);
    expect(JSON.stringify(tables)).not.toMatch(/margeExposeeEur|coutPortageEur|valeurOuverteEur|stockExcedentaireEur/);
    expect(exposureFor(v, "RES-GEO")).toBeUndefined();
  });
});

describe("signaux lus dans l'outil de planification et le QMS", () => {
  const w = vocabFrom([
    { app: "aps", table: "demand-signals", map: { "sc-signal.sku": "Material", "sc-signal.bullwhip": "BullwhipRatio", "sc-signal.pic": "DemandPeakPct" }, rows: [{ Material: "A", BullwhipRatio: "3.2", DemandPeakPct: "140" }, { Material: "B", BullwhipRatio: "1.1", DemandPeakPct: "20" }] },
    { app: "qms", table: "supplier-quality", map: { "sc-qualite.fournisseur": "Supplier", "sc-qualite.tauxRefus": "RejectedLotsPct" }, rows: [{ Supplier: "F1", RejectedLotsPct: "22.5" }] },
  ]);
  it("pic, ratio et part de lots refusés repris tels quels", () => {
    const s = signauxSanitaires(w, computeResilience(w));
    expect(s.picDemande).toEqual({ sku: "A", pct: 140 }); expect(s.amplification).toEqual({ sku: "A", ratio: 3.2 });
    const { tables } = deriveTables(w);
    expect(tables.find(t => t.name === "CoupDeFouet")!.rows).toEqual([{ sku: "A", ratio: 3.2 }, { sku: "B", ratio: 1.1 }]);
    expect(tables.find(t => t.name === "QualiteLots")!.rows[0]).toMatchObject({ supplierId: "F1", tauxRefusPct: 22.5 });
  });
});

describe("démo Maison Lucie historique (sans APS)", () => {
  let d: ArgusVocab;
  beforeAll(async () => { stubMaisonLucie(); const r = await runSupplyDemo(blankVocab()); if (!r.ok) throw new Error(r.error); d = r.vocab; });
  it("couverture lue dans le WMS (daysOfCover), TTS et TTR non fournis : rien n'est calculé", () => {
    const res = computeResilience(d);
    expect(res.articles.some(a => a.positions.some(p => p.couverture !== undefined))).toBe(true);
    expect(res.articles.every(a => a.tts === undefined && a.ttr === undefined && !a.critique)).toBe(true);
  });
  it("pic de demande et coup de fouet non fournis par le SI historique : rien n'est calculé", () => {
    const s = signauxSanitaires(d, computeResilience(d));
    expect(s.picDemande).toBeUndefined(); expect(s.amplification).toBeUndefined(); expect(s.absenteisme).toBeUndefined();
  });
  it("maturité lue sur l'état réel", () => {
    const m = maturite(d, computeResilience(d), 0, 3);
    expect(m.map(x => x.id)).toEqual(["sensing", "seizing", "reconfiguring"]);
    expect(maturite(blankVocab(), computeResilience(blankVocab()), 0, 0).every(x => x.niveau === 0)).toBe(true);
  });
});

describe("durabilité et autonomie stratégique : règles sur valeurs lues", () => {
  const w = vocabFrom([
    { app: "sap", table: "A_ProductSupplyPlanning", map: { "sc-article.sku": "Product", "sc-article.abc": "ABCIndicator" }, rows: [{ Product: "A", ABCIndicator: "A" }, { Product: "B", ABCIndicator: "A" }, { Product: "C", ABCIndicator: "C" }] },
    { app: "sap", table: "A_PurchasingSource", map: { "sc-source.sku": "Material", "sc-source.fournisseur": "Supplier" }, rows: [{ Material: "A", Supplier: "F1" }, { Material: "B", Supplier: "F1" }, { Material: "B", Supplier: "F2" }, { Material: "C", Supplier: "F1" }] },
    { app: "srm", table: "country-exposure", map: { "sc-concentration.famille": "Family", "sc-concentration.pays": "Country", "sc-concentration.part": "SpendSharePct", "sc-concentration.sources": "ActiveSourcesInCountry" }, rows: [{ Family: "Composants", Country: "CN", SpendSharePct: "50.7", ActiveSourcesInCountry: "7" }, { Family: "Composants", Country: "FR", SpendSharePct: "17.5", ActiveSourcesInCountry: "18" }] },
    { app: "srm", table: "eudr-statements", map: { "sc-eudr.sku": "Material", "sc-eudr.matiere": "EudrCommodity", "sc-eudr.dds": "DdsReferenceNumber", "sc-eudr.geoloc": "GeolocationProvided" }, rows: [{ Material: "A", EudrCommodity: "bovins (cuir)", DdsReferenceNumber: "26FR1", GeolocationProvided: "true" }, { Material: "B", EudrCommodity: "bois (papier, carton)", DdsReferenceNumber: "", GeolocationProvided: "false" }] },
    { app: "tms", table: "customs-cbam", map: { "sc-cbam.code": "CnCode", "sc-cbam.masse": "NetMassTonnes", "sc-cbam.cumul": "CumulativeCbamNetMassTonnes" }, rows: [{ CnCode: "7318", NetMassTonnes: "18.4", CumulativeCbamNetMassTonnes: "18.4" }, { CnCode: "7616", NetMassTonnes: "26.5", CumulativeCbamNetMassTonnes: "44.9" }] },
  ]);
  it("article A mono-source, part pays, DDS absente et cumul CBAM repris tels quels", () => {
    const t = (n: string) => deriveTables(w).tables.find(x => x.name === n)!.rows;
    expect(t("MonoSourceA").map(r => [r.sku, r.monoSource])).toEqual([["A", 1], ["B", 0]]);
    expect(t("ConcentrationPays")[0]).toMatchObject({ famille: "Composants", pays: "CN", partPct: 50.7, sourcesActives: 7 });
    expect(t("Eudr").map(r => [r.sku, r.sansDds])).toEqual([["A", 0], ["B", 1]]);
    expect(t("Cbam").map(r => r.cumulT)).toEqual([18.4, 44.9]);
  });
});
