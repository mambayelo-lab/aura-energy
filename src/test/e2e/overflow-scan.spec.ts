import { test, expect } from "@playwright/test";

// Scan automatisé : aucun élément visible ne dépasse de la fenêtre ni de son cadre.
const PAGES = ["/cockpit/resilience", "/cockpit/resilience?section=decision", "/cockpit/resilience?section=resilience", "/cockpit/atelier", "/cockpit/home", "/cockpit/studio"];
for (const width of [1280, 390]) {
  for (const url of PAGES) {
    test(`pas de débordement ${url} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        const vw = document.documentElement.clientWidth;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.position === "fixed") continue;
          let clipped = false;
          for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX) && p !== document.body && p !== document.documentElement) { clipped = true; break; } }
          if (!clipped && r.right > vw + 1) out.push(`${el.tagName}.${el.className}`.slice(0, 80));
        }
        return { body: document.documentElement.scrollWidth - vw, out: out.slice(0, 8) };
      });
      expect(bad.body, JSON.stringify(bad.out)).toBeLessThanOrEqual(1);
      expect(bad.out, JSON.stringify(bad.out)).toHaveLength(0);
    });
  }
}
