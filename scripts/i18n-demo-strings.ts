// Liste les textes des démos conservées (pour le dictionnaire anglais).
import { writeFileSync } from "node:fs";
import { DEMO_FACTORIES } from "../src/lib/v4/atelier-cases";
import { newSession } from "../src/lib/v4/atelier-store";
import { SECTOR_PACKS } from "../src/lib/v4/packs-sectoriels";
import { enrichDecisionDemoCase } from "../src/lib/v4/demo-enrichment";
import { translatePhrase } from "../src/lib/i18n-dom";
const out = new Set<string>();
const walk = (v: unknown) => {
  if (typeof v === "string") { if (/[a-zà-ÿ]{3}/i.test(v) && !/^[a-z0-9_-]+$/.test(v) && !/^#[0-9a-f]+$/i.test(v)) out.add(v.trim()); return; }
  if (Array.isArray(v)) { v.forEach(walk); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (["id", "color", "valeur", "type", "level", "kind", "key", "caseType", "step", "importance", "attitude", "sector"].includes(k)) continue; if (k === "impacts" || k === "impactOrigins" || k === "scores") continue; walk(x); }
};
walk(DEMO_FACTORIES.telereleve(newSession({ contextRaw: "" })));
for (const p of SECTOR_PACKS) { out.add(p.label); for (const c of p.cases) walk(enrichDecisionDemoCase(c)); }
const todo = [...out].filter(s => translatePhrase(s) === null);
writeFileSync(process.argv[2], todo.join("\n"));
console.log(out.size, todo.length);
