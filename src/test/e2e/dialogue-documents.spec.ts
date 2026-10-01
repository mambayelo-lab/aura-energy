import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";

// « Décider vite » : documents joints (trombone ou glisser-déposer), extraits cités mot pour mot, 10 Mo au plus.
const NOTE = "Contexte général du groupe.\nLe fournisseur SUP-003 livre 62 % des composants critiques du site de Lyon.\nUn second fournisseur qualifié pour ces composants critiques demande six mois d'audit.\nLa cantine rouvre lundi.";
const file = (name = "note-achats.txt", body = NOTE) => ({ name, mimeType: "text/plain", buffer: Buffer.from(body) });
const SOURCES = [NOTE, "# Contexte\nAucune donnée utile ici."].join(" ").replace(/\s+/g, " ");
const literal = async (page: Page) => {
  const quotes = await page.getByTestId("dd-citations").locator("q").allInnerTexts();
  expect(quotes.length).toBeGreaterThan(0);
  for (const q of quotes) expect(SOURCES).toContain(q.trim());
};

test("dialogue autonome : plusieurs fichiers et archive .zip, état par fichier, extraits cités", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/cockpit/home", { waitUntil: "load" });
  await expect(async () => {
    await page.getByTestId("strategic-example").filter({ hasText: "Double sourcing" }).click();
    await expect(page.getByLabel("Décrire la décision")).toHaveValue(/Double sourcing/, { timeout: 5000 });
  }).toPass({ timeout: 60_000 });
  const zip = new JSZip(); zip.file("note-achats.txt", NOTE); zip.file("ancien.doc", "binaire");
  const archive = { name: "dossier.zip", mimeType: "application/zip", buffer: Buffer.from(await zip.generateAsync({ type: "uint8array" })) };
  await page.getByTestId("dd-file").setInputFiles([archive, file("contexte.md", "# Contexte\nAucune donnée utile ici.")]);
  const status = page.getByTestId("doc-status");
  await expect(status.locator("li")).toHaveCount(3, { timeout: 30_000 });
  await expect(status.locator("li[data-status='lu']", { hasText: "dossier.zip › note-achats.txt" })).toBeVisible();
  await expect(status.locator("li[data-status='non lisible']", { hasText: "ancien.doc" })).toContainText(".docx");
  await page.getByLabel("Décrire la décision").press("Enter");
  await expect(page.getByTestId("dd-citations")).toBeVisible({ timeout: 120_000 });
  await literal(page);
  await expect(page.getByTestId("dd-citations")).not.toContainText("cantine");
});

test("depuis une alerte Supply : glisser-déposer dans le fil", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("dialog", d => d.accept());
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "load" });
  await expect(page.locator(".ct-alert-card").first().or(page.getByTestId("supply-demo-load"))).toBeVisible({ timeout: 30_000 });
  if (!(await page.locator(".ct-alert-card").count())) await page.getByTestId("supply-demo-load").click();
  await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => localStorage.setItem("aura-decider-mode", "dialogue"));
  await page.locator(".ct-alert-card").first().getByRole("button", { name: /Décider/ }).click();
  const dd = page.getByTestId("decision-dialogue");
  await expect(dd).toBeVisible({ timeout: 60_000 });
  const dt = await page.evaluateHandle((body) => { const d = new DataTransfer(); d.items.add(new File([body], "note-achats.txt", { type: "text/plain" })); return d; }, NOTE);
  await dd.dispatchEvent("dragover", { dataTransfer: dt });
  await dd.dispatchEvent("drop", { dataTransfer: dt });
  await expect(dd).toContainText("Document joint : note-achats.txt", { timeout: 30_000 });
  await expect(dd).toContainText(/J'ai repris \d+ extrait|aucun extrait qui touche/);
  if (await page.getByTestId("dd-citations").count()) await literal(page);
});
