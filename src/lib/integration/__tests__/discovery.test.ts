import { describe, expect, it } from "vitest";
import fixture from "./fixtures/maison-lucie-sample.json";
import { ATTRIBUTE_SPECS, profileColumns, proposeMappings, AUTO_THRESHOLD } from "../discovery";
import { vatFromSiren } from "../normalize";

const T = (fixture as { tables: Record<string, Record<string, unknown>[]> }).tables;
const group = (g: string) => ATTRIBUTE_SPECS.filter(a => a.id.startsWith(`${g}.`));

// Correspondances attendues sur les 5 sources Maison Lucie (aucun indice fourni).
const EXPECTED: [string, string, Record<string, string>][] = [
  ["suppliers", "sap_suppliers", { key: "Supplier", name: "SupplierName", country: "Country", siret: "TaxNumber1", vat: "VATRegistration", duns: "DUNS", updated: "LastChangeDateTime" }],
  ["products", "pim_products", { key: "productId", ean: "ean", ref: "internalRef", supplierTaxId: "supplierTaxId", supplierCountry: "supplierCountry", updated: "updatedAt" }],
  ["stock", "wms_stock", { item: "ItemId", site: "FacilityId", onHand: "OnHand", allocated: "Allocated", safety: "SafetyStock", updated: "UpdatedTimestamp" }],
  ["shipments", "tms_shipments", { key: "ShipmentId", po: "PurchaseOrderRef", supplierName: "OriginName", expected: "ExpectedDate", actual: "ActualDate" }],
  ["orders", "oms_order_lines", { key: "OrderLineId", product: "ProductRef", qty: "Quantity", status: "Status", site: "FulfillmentSite", date: "OrderDate" }],
  ["sales", "lake_sales", { date: "SaleDate", ean: "Ean", store: "StoreCode", qty: "Quantity", amount: "NetAmount" }],
];

describe("mapping au niveau des champs : introspection et score", () => {
  for (const [g, table, expected] of EXPECTED) {
    it(`Maison Lucie · ${table}`, () => {
      const props = proposeMappings(group(g), profileColumns(T[table].slice(0, 50)), { sourceId: "s", entity: table });
      for (const [attr, col] of Object.entries(expected)) {
        const p = props.find(x => x.attributeId === `${g}.${attr}`)!;
        expect(p.column, `${g}.${attr}`).toBe(col);
        expect(p.score).toBeGreaterThan(0.6);
      }
    });
  }

  it("l'indice du questionnaire renforce la confiance, sans être obligatoire", () => {
    const prof = profileColumns(T.sap_suppliers.slice(0, 50));
    const without = proposeMappings(group("suppliers"), prof, { sourceId: "s", entity: "e" }).find(p => p.attributeId === "suppliers.legacy")!;
    const withHint = proposeMappings(group("suppliers"), prof, { sourceId: "s", entity: "e", hints: { "suppliers.legacy": "LegacySupplierId" } }).find(p => p.attributeId === "suppliers.legacy")!;
    expect(withHint.score).toBeGreaterThan(without.score);
  });

  it("source inconnue générée aléatoirement : noms opaques, colonnes mélangées", () => {
    // Graine fixe : colonnes d'un WMS fictif aux noms abrégés, dans un ordre aléatoire.
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const ean = (i: number) => { const b = `400${String(i).padStart(9, "0")}`; let s = 0; for (let k = 0; k < 12; k++) s += Number(b[k]) * (k % 2 ? 3 : 1); return b + ((10 - (s % 10)) % 10); };
    const gen: Record<string, (i: number) => unknown> = {
      qte_physique: () => Math.floor(rnd() * 500),
      code_depot: i => ["DEP-NORD", "DEP-SUD", "DEP-EST", "DEP-OUEST"][i % 4],
      gtin_article: i => `0${ean(1000 + i)}`,
      qte_reservee: () => Math.floor(rnd() * 40),
      seuil_securite: () => 20 + Math.floor(rnd() * 30),
      date_maj: i => `2026-09-${String(1 + (i % 28)).padStart(2, "0")} 10:00:00`,
      libelle_zone: i => `Zone ${i % 7} allée ${i % 3}`,
    };
    const cols = Object.keys(gen).sort(() => rnd() - 0.5);
    const rows = Array.from({ length: 80 }, (_, i) => Object.fromEntries(cols.map(c => [c, gen[c](i)])));
    const props = proposeMappings(group("stock"), profileColumns(rows), { sourceId: "x", entity: "stock" });
    const by = Object.fromEntries(props.map(p => [p.attributeId.split(".")[1], p]));
    expect(by.item.column).toBe("gtin_article");
    expect(by.site.column).toBe("code_depot");
    expect(by.onHand.column).toBe("qte_physique");
    expect(by.allocated.column).toBe("qte_reservee");
    expect(by.safety.column).toBe("seuil_securite");
    expect(by.updated.column).toBe("date_maj");
    // Rien n'est validé d'office sous le seuil.
    for (const p of props) if (p.score < AUTO_THRESHOLD) expect(p.status).not.toBe("validée");
  });

  it("fournisseurs d'une source inconnue : clés fiscales reconnues par leur profil", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ col_a: `V${10000 + i}`, col_b: `Société ${i} SARL`, col_c: vatFromSiren(String(100000000 + i * 37)), col_d: i % 2 ? "FR" : "BE" }));
    const props = proposeMappings(group("suppliers"), profileColumns(rows), { sourceId: "x", entity: "e" });
    const by = Object.fromEntries(props.map(p => [p.attributeId.split(".")[1], p.column]));
    expect(by.vat).toBe("col_c");
    expect(by.country).toBe("col_d");
    expect(by.name).toBe("col_b");
    expect(by.key).toBe("col_a");
  });
});
