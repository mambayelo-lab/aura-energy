import { test, expect } from "@playwright/test";
import { DRAWIO } from "../fixtures/diagrams";

// Studio · Cartographier : un schéma du SI pré-remplit la cartographie, puis le questionnaire à valider.
test("Studio : partir d'un schéma draw.io du SI", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("aura.integration.v1"));
  await page.reload({ waitUntil: "load" });
  await expect(async () => {
    await page.getByTestId("ij-schema-file").setInputFiles([{ name: "si-client.drawio", mimeType: "application/xml", buffer: Buffer.from(DRAWIO) }, { name: "legende.xyz", mimeType: "application/octet-stream", buffer: Buffer.from("?") }]);
    await expect(page.getByTestId("ij-landscape")).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 60_000 });
  const l = page.getByTestId("ij-landscape");
  await expect(l).toContainText("3 applications · 2 flux");
  await expect(l).toContainText("SAP S/4HANA → Manhattan WMS (commandes d'achat)");
  await expect(l).toContainText("à confirmer");
  await expect(page.getByTestId("doc-status").locator("li[data-status='non lisible']")).toContainText("Format .xyz non lisible");
  await l.getByRole("button", { name: /Utiliser comme questionnaire/ }).click();
  await expect(page.getByLabel("Contrôle d'import")).toContainText(/\d+ lignes renseignées/);
  await expect(page.getByLabel("Contrôle d'import")).toContainText("ligne incomplète");
});
