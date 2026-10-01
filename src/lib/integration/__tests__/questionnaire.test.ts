import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "./fixtures/maison-lucie-sample.json";
import { buildTemplate, importQuestionnaire, maisonLucieExample, pickFilledSheet, Q_COLUMNS, Q_ONTOLOGY, questionnaireSheets, rowsFromSheet, type QRow } from "../questionnaire";
import { readCsv, readXlsx, writeDocx, writeXlsx } from "../office";
import { profileColumns, proposeMappings, ATTRIBUTE_SPECS } from "../discovery";
import { createConnector } from "../connectors";
import { duckdbDriver } from "../connectors/drivers.server";
import { emptyState, runPipeline } from "../pipeline";
import { TieredCache } from "../cache";
import { resetGovernors } from "../budget";

describe("questionnaire « Cartographie des sources Supply »", () => {
  it("modèle Excel : notice, questionnaire pré-rempli depuis l'ontologie, exemple Maison Lucie ; relu à l'identique", async () => {
    const bytes = await writeXlsx(questionnaireSheets());
    const sheets = await readXlsx(bytes);
    expect(sheets.map(s => s.name)).toEqual(["Questionnaire", "Exemple Maison Lucie"]);
    expect(sheets[0].rows[0][0]).toMatch(/Cartographie des sources Supply/);
    const blank = rowsFromSheet(sheets[0].rows);
    expect(blank).toHaveLength(Q_ONTOLOGY.length);
    expect(blank.every(r => !r.sources)).toBe(true);
    const example = rowsFromSheet(sheets[1].rows);
    expect(example.map(({ line, ...r }) => r)).toEqual(maisonLucieExample().map(({ line, ...r }) => r));
    expect(pickFilledSheet(sheets)?.name).toBe("Exemple Maison Lucie");
    const docx = await writeDocx("Cartographie", ["Notice"], [{ title: "Questionnaire", rows: [[...Q_COLUMNS]] }]);
    expect(docx.byteLength).toBeGreaterThan(1000);
  });

  it("import : sources, objets, maître par attribut ; contrôle des lignes incomplètes et du maître manquant", () => {
    const setup = importQuestionnaire(maisonLucieExample());
    expect(setup.issues.filter(i => i.level === "erreur")).toEqual([]);
    expect(setup.sources.map(s => s.label).sort()).toEqual(["APS", "Data lake", "Manhattan Active WM", "OMS", "PIM", "QMS", "SAP S/4HANA", "SRM", "TMS"]);
    expect(setup.sources.find(s => s.label === "SAP S/4HANA")?.kind).toBe("odata");
    expect(setup.sources.find(s => s.label === "Manhattan Active WM")?.kind).toBe("manhattan");
    expect(setup.objects.find(o => o.group === "shipments")?.sourceId).toBe("q-tms");
    expect(setup.objects.find(o => o.group === "stock")).toMatchObject({ entity: "inventory" });
    expect(setup.acv.attributes.find(a => a.attribute === "Pays")).toMatchObject({ master: "q-sap-s-4hana", tolerance: { kind: "exact" } });
    expect(setup.acv.attributes.find(a => a.attribute === "Pays")?.consumers.sort()).toEqual(["q-pim", "q-srm"]);
    expect(JSON.stringify(setup.sources)).not.toMatch(/lucie_aura_gateway_demo_token/);
    const broken: QRow[] = [
      { ...maisonLucieExample()[0], maitre: "" },
      { ...maisonLucieExample()[1], acces: "" },
    ];
    const bad = importQuestionnaire(broken);
    expect(bad.issues.map(i => i.message).join("\n")).toMatch(/maître manquant/);
    expect(bad.issues.map(i => i.message).join("\n")).toMatch(/ligne incomplète \(table ou point d'accès\)/);
    expect(readCsv("a;b\n1;\"x;y\"\n")).toEqual([["a", "b"], ["1", "x;y"]]);
  });
});

describe("parcours complet sur un échantillon Maison Lucie (fichiers Parquet, DuckDB)", () => {
  it("questionnaire → import → métadonnées et échantillon → correspondances → synchronisation → erreurs volontaires trouvées", async () => {
    resetGovernors();
    const dir = mkdtempSync(join(tmpdir(), "aura-int-"));
    const T = (fixture as { tables: Record<string, Record<string, unknown>[]> }).tables;
    for (const [name, rows] of Object.entries(T)) writeFileSync(join(dir, `${name}.json`), rows.map(r => JSON.stringify(r)).join("\n"));
    // Conversion en Parquet (dépôt de fichiers) par DuckDB.
    const d = await duckdbDriver({});
    for (const name of Object.keys(T)) await d.query(`COPY (SELECT * FROM read_json_auto('${join(dir, `${name}.json`)}')) TO '${join(dir, `${name}.parquet`)}' (FORMAT parquet)`);
    await d.close();
    const FILES: Record<string, string> = { A_Supplier: "sap_suppliers", A_PurchaseOrderItem: "sap_suppliers", products: "pim_products", inventory: "wms_stock", shipments: "tms_shipments", facilities: "wms_facilities", "order-lines": "oms_order_lines", sales: "lake_sales", forecasts: "aps_forecasts", suppliers: "srm_suppliers", nonconformities: "qms_nonconformities" };
    const rowsQ = maisonLucieExample().filter(r => FILES[r.acces.match(/resource=([\w-]+)/)?.[1] ?? r.acces.split("/").pop()!]).map(r => ({ ...r, mode: "fichier", champ: "", acces: join(dir, `${FILES[r.acces.match(/resource=([\w-]+)/)?.[1] ?? r.acces.split("/").pop()!]}.parquet`) }));
    const setup = importQuestionnaire(rowsQ);
    expect(setup.issues.filter(i => i.level === "erreur")).toEqual([]);

    // Découverte : schéma (information_schema) + échantillon, puis correspondances sans indice.
    const proposals = [];
    for (const o of setup.objects) {
      const s = setup.sources.find(x => x.id === o.sourceId)!;
      const c = createConnector(s, { sqlDriver: () => duckdbDriver });
      const schema = await c.discoverSchema();
      expect(schema.find(e => e.name === o.entity)?.columns.length).toBeGreaterThan(2);
      proposals.push(...proposeMappings(ATTRIBUTE_SPECS.filter(a => a.id.startsWith(`${o.group}.`)), profileColumns(await c.sample(o.entity, 50)), { sourceId: s.id, entity: o.entity }));
      await c.close();
    }
    setup.proposals = proposals.map(p => (p.status === "à valider" ? { ...p, status: "validée" as const } : p));
    const { template, missing } = buildTemplate(setup);
    expect(missing).toEqual([]);

    const connectors = Object.fromEntries(template.sources.map(s => [s.id, createConnector(s, { sqlDriver: () => duckdbDriver })]));
    const state = await runPipeline({ template, connectors, state: emptyState(template.id, "2026-09-28"), mode: "full", asOf: "2026-09-28", cache: new TieredCache(), acv: setup.acv });
    const rep = (sys: RegExp | string) => state.reports.find(r => (typeof sys === "string" ? r.system === sys : sys.test(r.system)))!;
    expect(state.runs.filter(r => r.error)).toEqual([]);
    expect(rep(template.masters.supplier).duplicates).toHaveLength(3);                 // doublons SAP
    expect(rep(/fournisseur$/).orphans.length).toBe(2);                        // produits au fournisseur inconnu (FR99…) dans l'échantillon
    expect(rep(template.masters.product).conflicts.length).toBe(1);                     // EAN en double
    expect(rep(/wms_stock\.FacilityId$/).orphans.map(o => o.sourceKey)).toContain("WHXXX");
    expect(rep(/wms_stock\.ItemId$/).orphans.some(o => o.sourceKey.startsWith("0399"))).toBe(true);
    expect(rep(/OriginName$/).pendingReview).toBeGreaterThan(0);              // raisons sociales variantes → file de validation
    expect(state.divergences.some(d => d.attribute === "Pays" && d.kind === "fond")).toBe(true);
    expect(state.alerts.map(a => a.kind)).toEqual(expect.arrayContaining(["rupture", "retard"]));
    // Aucun client individuel stocké.
    expect(JSON.stringify(state)).not.toMatch(/"C\d{8}"/);
    // Incrémental : rien de modifié → rien de relu.
    const again = await runPipeline({ template, connectors: Object.fromEntries(template.sources.map(s => [s.id, createConnector(s, { sqlDriver: () => duckdbDriver })])), state, mode: "incremental", asOf: "2026-09-28", cache: new TieredCache(), acv: setup.acv });
    const inc = again.runs.filter(r => r.mode === "incremental" && r.step === "référentiel" && r.entity !== "wms_facilities");
    expect(inc.every(r => r.rowsRead === 0)).toBe(true);
  }, 60_000);
});
