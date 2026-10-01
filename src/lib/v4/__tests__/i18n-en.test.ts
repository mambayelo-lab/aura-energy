// Anglais : le dictionnaire couvre les démos et les textes générés ; les motifs ne bouclent pas.
import { describe, expect, it } from "vitest";
import { translatePhrase, tr } from "../../i18n-dom";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession } from "../atelier-store";
import { SECTOR_PACKS } from "../packs-sectoriels";
import { enrichDecisionDemoCase } from "../demo-enrichment";

function strings(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === "string") { if (/[a-zà-ÿ]{3}/i.test(v) && !/^[a-z0-9_-]+$/.test(v) && !/^#[0-9a-f]+$/i.test(v)) out.add(v.trim()); return out; }
  if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!["id", "color", "valeur", "type", "level", "kind", "key", "caseType", "step", "importance", "attitude", "sector", "impacts", "impactOrigins", "scores"].includes(k)) strings(x, out);
  return out;
}

describe("dictionnaire anglais", () => {
  it("toutes les démos conservées sont entièrement traduites", () => {
    const all = strings(DEMO_FACTORIES.telereleve(newSession({ contextRaw: "" })));
    for (const p of SECTOR_PACKS) for (const c of p.cases) strings(enrichDecisionDemoCase(c), all);
    const missing = [...all].filter(s => translatePhrase(s) === null);
    expect(missing).toEqual([]);
  });
  it("textes générés : phrases, motifs et listes", () => {
    expect(translatePhrase("« Stock tampon » passerait devant « Double sourcing » avec un seul changement (3 façons ; voici la plus proche).")).toBe("“Buffer stock” would move ahead of “Dual sourcing” with a single change (3 ways; here is the closest).");
    expect(translatePhrase("Continuité du service client (4) · Performance économique (2)")).toBe("Customer service continuity (4) · Economic performance (2)");
    expect(translatePhrase("Valeur 1,8 jours ; seuil d'alerte ≤ 7, seuil critique ≤ 3")).toBe("Value 1,8 days ; alert threshold ≤ 7, critical threshold ≤ 3");
    expect(translatePhrase("« Double sourcing » n'agit pas directement sur « Coût d'achat unitaire » (à confirmer).")).toBe("“Dual sourcing” has no direct effect on “Unit purchase cost” (to be confirmed).");
    expect(translatePhrase("SUP-001 · Tessitura Milano")).toBe("SUP-001 · Tessitura Milano");
  });
  it("rapports : tr traduit en anglais, laisse le français sinon", () => {
    expect(tr("Décision retenue", "en")).toBe("Chosen decision");
    expect(tr("Décision retenue", "fr")).toBe("Décision retenue");
    expect(tr("Rapport de décision — Exemple — Modernisation télérelève", "en")).toBe("Decision report — Example — Remote meter reading modernisation");
  });
});

describe("note au comité en anglais", () => {
  it("les lignes de faits du PowerPoint sont traduites", () => {
    expect(tr("Risque de capacité fournisseur · seuil 60", "en")).toBe("Supplier capacity risk · threshold 60");
    expect(tr("LECTURE\n", "en")).toBe("READING\n");
    expect(tr("Aucune décision enregistrée pour cette alerte : à arbitrer en comité.", "en")).toBe("No decision recorded for this alert: to be arbitrated in committee.");
  });
});
