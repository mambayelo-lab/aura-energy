// @vitest-environment node
// Bout en bout : le SI standard Maison Lucie, lu par le questionnaire et le mapping
// avec score, déclenche les alertes de résilience, chacune avec son montant
// calculé et sa source, sa chaîne causale et sa décision préremplie.
// Lancé si LUCIE_BASE est défini (Maison Lucie : npm run serve:vercel).
import { beforeAll, describe, expect, it } from "vitest";
import { blankVocab, evaluateCausalRules, type ArgusVocab } from "../argus-vocab-store";
import { loadStandardSi } from "../supply-standard";
import { exposureFor, RESILIENCE_RULES, CHAIN_RULES, DERIVED_APP } from "../supply-derived";
import { computeResilience, signauxSanitaires, resilienceAlerts } from "../resilience-tts";
import { supplyProfileFor } from "../supply-profiles";
import { rankPlansB } from "../plans-b";

const B = process.env.LUCIE_BASE?.replace(/\/$/, "");
let v: ArgusVocab;
let stats: { calls: number; rows: number; tables: number; mappings: number };

describe.skipIf(!B)("SI standard Maison Lucie → alertes de résilience sur valeurs lues", () => {
  beforeAll(async () => {
    const r = await loadStandardSi(blankVocab(), { base: B, params: { asOf: "2026-09-28" } });
    if (!r.ok) throw new Error(`${r.step} : ${r.error}`);
    v = r.vocab; stats = r;
  }, 120_000);

  it("lecture sous budget : pages de 1 000 lignes, colonnes déclarées seulement, correspondances avec score", () => {
    expect(stats.tables).toBeGreaterThan(25);
    expect(stats.calls).toBeLessThan(80);
    expect(stats.mappings).toBeGreaterThan(90);
    const m = (v.entityMappings ?? []).find(x => x.attributeId === "sc-source.delai")!;
    expect(m.confidence).toBeGreaterThanOrEqual(0.6);
    expect(v.fields.find(f => f.id === m.fieldId)?.name).toBe("A_PurgInfoRecdOrgPlantData.MaterialPlannedDeliveryDurn");
  });

  it("résilience : TTS, TTR et CA à risque lus par site dans l'APS, jamais calculés", () => {
    const res = computeResilience(v);
    expect(res.vide).toBe(false);
    expect(res.sources.join(" ")).toMatch(/supply-positions/);
    const withTts = res.articles.filter(a => a.tts !== undefined);
    expect(withTts.length).toBeGreaterThan(50);
    for (const a of withTts) expect(a.critique).toBe(a.positions.some(p => p.tts !== undefined && (p.ttr ?? a.ttr) !== undefined && (p.ttr ?? a.ttr)! > p.tts));
    expect(res.articles.some(a => a.critique)).toBe(true);
    const s = signauxSanitaires(v, res);
    expect(s.picDemande!.pct).toBeGreaterThan(100);
    expect(s.amplification!.ratio).toBeGreaterThan(1.5);
    expect(s.absenteisme).toBeGreaterThan(10);
    expect(resilienceAlerts(v).some(a => a.id === "RES-PANDEMIE")).toBe(true);
  });

  it("chaque règle se déclenche sur des valeurs lues ; montant seulement s'il est lu (CA à risque)", () => {
    const ev = evaluateCausalRules(v);
    for (const r of RESILIENCE_RULES) {
      const e = ev.find(x => x.rule.id === r.id)!;
      expect(e.triggered, r.id).toBe(true);
      expect(supplyProfileFor(r.id, r.label), `${r.id} profil`).toBeTruthy();
    }
    const u = exposureFor(v, "RES-UNIQUE", ev.find(x => x.rule.id === "RES-UNIQUE"));
    if (u) { expect(u.what).toMatch(/CA à risque lu/); expect(u.source).toMatch(/APS/); }
    for (const id of ["RES-GEO", "RES-PORT", "RES-RAPPEL", "S3", "S4"]) expect(exposureFor(v, id), id).toBeUndefined();
    for (const c of CHAIN_RULES) expect(v.causalRules.find(r => r.id === c.id)?.conditions.map(x => x.ruleId)).toEqual([c.from, c.to]);
    expect(v.causalRules.find(r => r.id === "S14")?.alertEnabled).toBe(false);
    // Aucune colonne de montant dérivé dans les tables de règles.
    for (const t of (v.siTables ?? []).filter(t => t.appId === DERIVED_APP)) expect(t.columns.join(" "), t.table).not.toMatch(/marge|portage|valeur|Exposee|Perdu|cout/i);
  });

  it("stress-test : plans B classés par Décider (attitude pessimiste) avec le plus petit changement", () => {
    const r = rankPlansB({ id: "RES-UNIQUE", label: RESILIENCE_RULES[0].label, options: RESILIENCE_RULES[0].options });
    expect(r.attitude).toBe("Pessimiste");
    expect(r.ranking.length).toBeGreaterThanOrEqual(3);
    expect(r.ranking[0].rank).toBe(1);
    expect(r.combinations).toBeGreaterThan(1);
  });
});
