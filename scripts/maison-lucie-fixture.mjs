// Régénère la photographie des données du SI Maison Lucie utilisée par
// src/lib/v4/__tests__/supply-coherence.test.ts (aucune donnée inventée :
// lecture directe de lib/demo-data.js du dépôt mambayelo-lab/maison-lucie-si).
// Usage : node scripts/maison-lucie-fixture.mjs ../mambayelo-lab/maison-lucie-si
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2] ?? "../mambayelo-lab/maison-lucie-si");
const { applications, datasets } = await import(pathToFileURL(`${repo}/lib/demo-data.js`).href);
const APPS = ["sap-s4", "manhattan-wms", "blueyonder-tms", "coupa-risk", "snowflake-demand", "rest-order-management"];
const out = {
  applications: applications.filter(a => APPS.includes(a.id)).map(({ id, name, role, protocol }) => ({ id, name, role, protocol })),
  datasets: Object.fromEntries(APPS.map(id => [id, { entity: datasets[id].entity, records: datasets[id].records, tables: datasets[id].tables ?? {} }])),
};
const target = new URL("../src/lib/v4/__tests__/fixtures/maison-lucie-si.json", import.meta.url);
writeFileSync(target, JSON.stringify(out) + "\n");
console.log(`Photographie écrite : ${target.pathname}`);
