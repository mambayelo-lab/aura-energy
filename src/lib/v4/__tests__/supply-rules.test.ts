// Règles de résilience, montants et lecture par l'ontologie (sans réseau).
import { describe, expect, it } from "vitest";
import { blankVocab, evaluateCausalRules, type ArgusVocab } from "../argus-vocab-store";
import { withSupplyChainModel } from "../supply-model";
import { normKey, readObject, skuResolver } from "../supply-data";
import { exposureFor, RESILIENCE_RULES, CHAIN_RULES, withDerivedIndicators, DERIVED_APP } from "../supply-derived";
import { supplyProfileFor } from "../supply-profiles";
import { rankPlansB } from "../plans-b";
import { miniReport, miniReportPdf, solidity } from "../mini-report";
import { newSession } from "../atelier-store";
import { seedFromAlert } from "../decision-express";

/** Vocabulaire minimal : deux tables branchées comme le ferait le Studio (aucun nom de colonne supposé par le calcul). */
function vocab(): ArgusVocab {
  let v = withSupplyChainModel(blankVocab());
  const table = (appId: string, name: string, rows: Record<string, string>[]) => ({ id: `${appId}:${name}`, appId, table: name, columns: Object.keys(rows[0]), rows, fetchedAt: "2026-09-28T00:00:00Z" });
  const pim = table("pim", "produits", [{ ref: "A1", gtin: "3760000000017", nom: "Article 1", pv: "100", cout: "40" }, { ref: "A2", gtin: "3760000000024", nom: "Article 2", pv: "50", cout: "30" }]);
  // Positions planifiées fournies par l'APS : Aura lit TTS, TTR, CA à risque, rupture et réception, il ne les calcule pas.
  const aps = table("aps", "positions", [{ item: "03760000000017", depot: "WH1", tts: "10", ttr: "100", ca: "54000", rup: "2026-10-08", rec: "2026-10-20" }, { item: "03760000000024", depot: "WH1", tts: "28", ttr: "15", ca: "0", rup: "", rec: "2026-10-05" }]);
  const atp = table("aps", "atp", [{ ligne: "OL-1", art: "A1", promis: "2026-10-01", dispo: "2026-10-09" }, { ligne: "OL-2", art: "A2", promis: "2026-10-01", dispo: "2026-10-01" }, { ligne: "OL-3", art: "A2", promis: "2026-10-02", dispo: "" }]);
  const ekes = table("sap", "ekes", [{ po: "4500000001", art: "A1", fo: "S1", besoin: "2026-10-10", conf: "2026-10-15" }, { po: "4500000002", art: "A2", fo: "S1", besoin: "2026-10-10", conf: "2026-10-10" }]);
  const mrp = table("aps", "delais", [{ art: "A1", plan: "40", reel: "52" }, { art: "A2", plan: "10", reel: "11" }]);
  const src = table("sap", "sources", [{ m: "A1", f: "S1", fixe: "true", d: "40" }, { m: "A2", f: "S1", fixe: "true", d: "10" }, { m: "A2", f: "S2", fixe: "false", d: "15" }]);
  const apps = ["pim", "aps", "sap"].map(id => ({ id, label: id.toUpperCase(), type: id, connectionHint: "", secretConfigured: true }));
  const snaps = [pim, aps, src, atp, ekes, mrp];
  const fields = snaps.flatMap(s => s.columns.map(c => ({ id: `${s.appId}:${s.table}:${c}`, appId: s.appId, name: `${s.table}.${c}`, liveTable: s.table, sampleValues: [] })));
  const map = (attr: string, appId: string, t: string, c: string, isMaster = true) => ({ id: `m:${attr}:${c}`, entityId: attr.slice(0, attr.lastIndexOf(".")), attributeId: attr, appId, fieldId: `${appId}:${t}:${c}`, isMaster, confidence: 0.9, method: "manuel" as const });
  v = { ...v, apps, siTables: snaps, fields, entityMappings: [
    map("sc-article.sku", "pim", "produits", "ref"), map("sc-article.ean", "pim", "produits", "gtin"), map("sc-article.designation", "pim", "produits", "nom"), map("sc-article.prix", "pim", "produits", "pv"), map("sc-article.cout", "pim", "produits", "cout"),
    map("sc-position.sku", "aps", "positions", "item"), map("sc-position.site", "aps", "positions", "depot"), map("sc-position.tts", "aps", "positions", "tts"), map("sc-position.ttr", "aps", "positions", "ttr"), map("sc-position.caRisque", "aps", "positions", "ca"), map("sc-position.rupture", "aps", "positions", "rup"), map("sc-position.reception", "aps", "positions", "rec"),
    map("sc-promesse.ligne", "aps", "atp", "ligne"), map("sc-promesse.sku", "aps", "atp", "art"), map("sc-promesse.promise", "aps", "atp", "promis"), map("sc-promesse.dispo", "aps", "atp", "dispo"),
    map("sc-confirmation.commande", "sap", "ekes", "po"), map("sc-confirmation.sku", "sap", "ekes", "art"), map("sc-confirmation.fournisseur", "sap", "ekes", "fo"), map("sc-confirmation.besoin", "sap", "ekes", "besoin"), map("sc-confirmation.confirmee", "sap", "ekes", "conf"),
    map("sc-parametre.sku", "aps", "delais", "art"), map("sc-parametre.planifie", "aps", "delais", "plan"), map("sc-parametre.reel", "aps", "delais", "reel"),
    map("sc-source.sku", "sap", "sources", "m"), map("sc-source.fournisseur", "sap", "sources", "f"), map("sc-source.fixe", "sap", "sources", "fixe"), map("sc-source.delai", "sap", "sources", "d"),
  ] };
  return v;
}

describe("lecture par l'ontologie", () => {
  it("clés normalisées : GTIN-14 → EAN-13, préfixe de commande, casse", () => {
    expect(normKey("03760000000017")).toBe("3760000000017");
    expect(normKey("PO-4500000001")).toBe("4500000001");
    expect(normKey(" ml-0001 ")).toBe("ML-0001");
    const v = vocab();
    expect(skuResolver(v)("03760000000017")).toBe("A1");
    expect(readObject(v, "sc-source", "sku", ["sku", "fournisseur"]).rows).toHaveLength(3);
  });
  it("fournisseur unique : TTR lu > TTS lu ; montant = CA à risque lu, jamais calculé", () => {
    const v = withDerivedIndicators(vocab(), { asOf: "2026-09-28" });
    const e = evaluateCausalRules(v).find(x => x.rule.id === "RES-UNIQUE")!;
    expect(e.triggered).toBe(true); // A1 : TTS lu 10 j, TTR lu 100 j ; A2 a une seconde source
    expect(e.matches.map(m => m.label.split(" · ")[0])).toEqual(["A1"]);
    const x = exposureFor(v, "RES-UNIQUE", e)!;
    expect(x.eur).toBe(54000);
    expect(x.what).toMatch(/CA à risque lu/);
    expect(v.apps.some(a => a.id === DERIVED_APP)).toBe(true);
  });
  it("top 4 : promesse client, confirmation fournisseur, rupture projetée, paramètres MRP (règles causales sur valeurs lues)", () => {
    const v = withDerivedIndicators(vocab(), { asOf: "2026-09-28" });
    const ev = evaluateCausalRules(v);
    const keys = (id: string) => ev.find(x => x.rule.id === id)!.matches.map(m => m.label.split(" · ")[0]).sort();
    expect(keys("RES-PROMESSE")).toEqual(["OL-1", "OL-3"]);
    expect(keys("RES-CONFIRM")).toEqual(["4500000001"]);
    expect(ev.find(x => x.rule.id === "RES-RUPTURE")!.triggered).toBe(true);
    expect(keys("RES-MRP")).toEqual(["A1"]);
  });
  it("montant « donnée non fournie » quand le SI ne le fournit pas ; jamais de montant d'exemple", () => {
    const v = withDerivedIndicators(vocab(), { asOf: "2026-09-28" });
    expect(exposureFor(v, "S4")).toBeUndefined();
    expect(exposureFor(v, "RES-RAPPEL")).toBeUndefined();
    expect(exposureFor(blankVocab(), "RES-UNIQUE")).toBeUndefined();
  });
});

describe("règles, chaînes causales et décision", () => {
  it("17 règles de résilience, chacune avec un profil Décider, des options et des conséquences", () => {
    expect(RESILIENCE_RULES.map(r => r.id)).toEqual(["RES-PROMESSE", "RES-CONFIRM", "RES-RUPTURE", "RES-MRP", "RES-UNIQUE", "RES-GEO", "RES-BULLWHIP", "RES-FINANCE", "RES-QUALITE", "RES-CERTIF", "RES-PORT", "RES-RAPPEL", "RES-ESG", "RES-MONO-A", "RES-PAYS", "RES-EUDR", "RES-CBAM"]);
    for (const r of RESILIENCE_RULES) {
      expect(supplyProfileFor(r.id, r.label), r.id).toBeTruthy();
      expect(r.options.length).toBeGreaterThanOrEqual(3);
      expect(r.consequences.length).toBeGreaterThanOrEqual(2);
      const seed = seedFromAlert({ id: r.id, alertLabel: r.label, options: r.options });
      expect(seed.leviersDef.length, `${r.id} leviers`).toBeGreaterThanOrEqual(3);
    }
    for (const c of CHAIN_RULES) expect([...RESILIENCE_RULES.map(r => r.id), "S1", "S2", "S3", "S4", "S6", "S9"]).toEqual(expect.arrayContaining([c.from, c.to]));
  });
  it("plans B classés par Décider : attitude pessimiste, combinaisons, plus petit changement", () => {
    const p = rankPlansB({ id: "RES-PORT", label: "Congestion", options: RESILIENCE_RULES.find(r => r.id === "RES-PORT")!.options });
    expect(p.attitude).toBe("Pessimiste");
    expect(p.ranking[0].rank).toBe(1);
    expect(p.combinations).toBeGreaterThanOrEqual(p.ranking.length);
    const s = solidity(p.session, p.smallestChange);
    expect(s.attitude).toMatch(/^prudente/);
    expect(s.evaluations).toBeGreaterThan(0);
  });
  it("mini-rapport PDF : question, classement, plus petit changement, décision, indicateurs, auteur", async () => {
    const seed = seedFromAlert({ id: "RES-UNIQUE", alertLabel: "Fournisseur unique", options: RESILIENCE_RULES[0].options });
    const session = { ...newSession({ contextRaw: "Qualifier une seconde source ?", title: "Qualifier une seconde source ?", alertId: "RES-UNIQUE", alertLabel: "Fournisseur unique" }), ...seed, attitude: "Pessimiste" as const };
    const r = miniReport(session, "analyste@exemple.fr");
    expect(r.author).toBe("analyste@exemple.fr");
    expect(r.ranking.length).toBe(session.scenarios.length);
    expect(r.solidity.smallestChange.length).toBeGreaterThan(10);
    const pdf = await miniReportPdf(r);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(2000);
  });
});
