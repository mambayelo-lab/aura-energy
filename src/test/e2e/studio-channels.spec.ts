import { test, expect } from "@playwright/test";

// Studio · Connecter : les types d'échange du SDK (OData v4, SAP IDoc et RFC, Salesforce,
// EDIFACT, X12, AS2, Kafka, AMQP, MQ, CloudEvents, CDC, SFTP, SQL, gRPC-web, ESB, MCP)
// ont leur carte explicative ; branchés sur Maison Lucie, ils lisent métadonnées et échantillon.
// Branchement réel : SI Maison Lucie joignable (npm run serve:vercel côté Maison Lucie, 127.0.0.1:4300).
const LUCIE = process.env.LUCIE_BASE ?? "http://127.0.0.1:4300";
const TOKEN = "lucie_aura_gateway_demo_token";

async function openCatalogue(page: import("@playwright/test").Page) {
  await page.goto("/cockpit/studio?tab=sources", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("connector-mcp")).toBeVisible({ timeout: 60_000 });
}
async function connect(page: import("@playwright/test").Page, card: string, url: string) {
  const form = page.getByTestId("credentials-form");
  await expect(async () => { await page.getByTestId(`connector-${card}`).getByRole("button", { name: "Connecter" }).click(); await expect(form).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 30_000 });
  await form.getByLabel("URL").fill(url);
  await form.getByLabel("Méthode d'authentification").selectOption("bearer");
  await form.getByText("Saisir pour cette session").click();
  await form.getByLabel("Secret").fill(TOKEN);
  await form.getByRole("button", { name: "Connecter et lire les données" }).click();
}

test("Connecter : une carte explicative par type d'échange", async ({ page }) => {
  test.setTimeout(120_000);
  await openCatalogue(page);
  for (const [id, text] of [["sap-odata4", "$metadata"], ["sap-idoc", "ORDERS05"], ["sap-rfc", "RFC_READ_TABLE"], ["salesforce", "Bulk API 2.0"], ["edifact", "DESADV"], ["x12", "856"], ["as2", "MIC"],
    ["kafka", "offset"], ["rabbitmq", "management"], ["ibm-mq", "non destructive"], ["webhooks", "CloudEvents 1.0"], ["cdc", "Debezium"], ["sftp", "Parquet"], ["jdbc", "GROUP BY"], ["grpc", "protobuf"], ["esb", "demi-flux"], ["mcp", "outils et ressources"]]) {
    const card = page.getByTestId(`connector-${id}`);
    await expect(card, id).toContainText(text);
    await expect(card.getByText("À fournir :")).toBeVisible();
  }
});

test("Connecter : Maison Lucie par OData v4 (ERP), gRPC-web (OMS) et MCP", async ({ page, request }) => {
  test.setTimeout(180_000);
  const up = await request.get(`${LUCIE}/channels`).then(r => r.ok()).catch(() => false);
  test.skip(!up, "SI Maison Lucie non joignable");
  await openCatalogue(page);
  await connect(page, "sap-odata4", `${LUCIE}/odata/v4/sap/A_Supplier`);
  await expect(page.getByText("0000100001", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await openCatalogue(page);
  await connect(page, "grpc", `${LUCIE}/grpc/lucie.v1.RowService/ListRows#oms/order-lines`);
  await expect(page.getByText("OL-000000001", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await openCatalogue(page);
  await connect(page, "mcp", `${LUCIE}/mcp`);
  const tools = page.locator(".tools");
  await expect(tools).toContainText("sap/A_Supplier", { timeout: 60_000 });
  await expect(tools).toContainText("pim/products");
  await tools.getByRole("button", { name: /srm\/suppliers/ }).click();
  await expect(page.getByText("SRM-00001", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
});

test("Connecter : le type d'outil limite les protocoles et propose le natif", async ({ page }) => {
  test.setTimeout(120_000);
  await openCatalogue(page);
  const form = page.getByTestId("credentials-form");
  await expect(async () => { await page.getByTestId("connector-autre").getByRole("button", { name: "Connecter" }).click(); await expect(form).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 30_000 });
  await form.getByLabel("Type d'outil").selectOption("pim");
  await expect(form.getByLabel("Accès")).toHaveValue("rest");
  await expect(form.getByLabel("Accès").locator("option")).toHaveText(["REST / OData v2 (natif)", "SFTP", "ESB · iPaaS", "MCP"]);
  await expect(page.getByTestId("tool-protocols")).toContainText("Akeneo");
  await form.getByLabel("Type d'outil").selectOption("lac");
  await expect(form.getByLabel("Accès")).toHaveValue("sqlhttp");
});
