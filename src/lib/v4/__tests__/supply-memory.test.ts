// Phase mémoire Supply : décisions enregistrées depuis une alerte, rappel par
// le copilote, journal « décision → résultat », versions du modèle, garde-fou
// contre les chiffres inventés et export comité.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { AuraMemory, memoryStorageBackend } from "../../memoire/memoire";
import { blankVocab, evaluateCausalRules, type ArgusVocab } from "../argus-vocab-store";
import { planCopilotAnswer, verifyGrounding } from "../copilot-answer";
import { runSupplyDemo } from "../supply-demo";
import { committeeBrief, committeePdf, committeePptx, pdfSafe } from "../supply-export";
import {
  applyModelSnapshot, decisionContext, decisionJournal, describeModelChange, journalSummary, memoryHint, modelSnapshot,
  ModelUndoStack, observedImpact, recordSupplyDecision, supplyDecisions,
} from "../supply-memory";
import { updateKpi } from "../studio-editing";
import { stubMaisonLucie } from "./lucie-stub";

let v: ArgusVocab;
beforeAll(async () => {
  stubMaisonLucie();
  const r = await runSupplyDemo(blankVocab());
  vi.unstubAllGlobals();
  if (!r.ok) throw new Error(r.error);
  v = r.vocab;
});
const s1 = () => evaluateCausalRules(v).find(e => e.rule.id === "S1")!;

// Le fournisseur SUP-001 voit son risque de capacité baisser de 88 à 70 après la décision.
function afterMitigation(base: ArgusVocab): ArgusVocab {
  return { ...base, siTables: (base.siTables ?? []).map(t => t.table !== "SupplierRiskAssessment" ? t : { ...t, rows: t.rows.map(r => r.supplierId === "SUP-001" ? { ...r, capacityRisk: "70" } : r) }) };
}

describe("décisions prises depuis une alerte", () => {
  it("contexte : entité la plus grave et valeur lue au moment de la décision", () => {
    expect(decisionContext(v, s1())).toMatchObject({ alertId: "S1", entity: "SUP-001 · Tessitura Milano", entityKey: "SUP-001", kpiId: "k-s1", valueAtDecision: 88, unit: "score/100" });
  });

  it("enregistrée dans la mémoire générique (product = supply) avec raison et résultat attendu, rappelée par le copilote", async () => {
    const memory = new AuraMemory("supply", memoryStorageBackend(undefined));
    await recordSupplyDecision(memory, { ...decisionContext(v, s1()), option: "Double source", reason: "Tessitura sature", expected: "Risque de capacité sous 60" });
    const all = await memory.all();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ product: "supply", kind: "decision" });
    expect(await memory.summary()).toContain("Risque de rupture fournisseur · SUP-001 · Tessitura Milano → Double source");
    const decisions = supplyDecisions(all);
    expect(decisions[0]).toMatchObject({ option: "Double source", reason: "Tessitura sature", expected: "Risque de capacité sous 60", valueAtDecision: 88 });
    expect(memoryHint(decisions, { entity: "SUP-001 · Tessitura Milano" })).toMatch(/^La dernière fois sur SUP-001 · Tessitura Milano \(\d{2}\/\d{2}\/\d{4}\), vous avez choisi « Double source » — raison : Tessitura sature/);
    const plan = planCopilotAnswer(v, "Pourquoi l'alerte Risque de rupture fournisseur est-elle déclenchée ?", { decisions });
    expect(plan.text).toContain("La dernière fois sur SUP-001 · Tessitura Milano");
    expect(plan.facts).toContain("Décisions déjà prises (mémoire Supply)");
  });
});

describe("journal décision → résultat", () => {
  it("valeur à la décision puis valeur lue aujourd'hui pour la même entité", async () => {
    const memory = new AuraMemory("supply", memoryStorageBackend(undefined));
    await recordSupplyDecision(memory, { ...decisionContext(v, s1()), option: "Double source", reason: "", expected: "" });
    const decisions = supplyDecisions(await memory.all());
    expect(decisionJournal(v, decisions)[0]).toMatchObject({ before: 88, now: 88, delta: 0, outcome: "stable" });
    const rows = decisionJournal(afterMitigation(v), decisions);
    expect(rows[0]).toMatchObject({ before: 88, now: 70, delta: -18, outcome: "amélioration", statusBefore: "critique", statusNow: "alerte" });
    expect(journalSummary(rows)).toMatchObject({ total: 1, improved: 1, worse: 0 });
    // L'impact observé sert ensuite à la carte de choix de la même option.
    expect(observedImpact(rows, "Risque de rupture fournisseur", "Double source")?.delta).toBe(-18);
    expect(observedImpact(rows, "Risque de rupture fournisseur", "Autre")).toBeUndefined();
  });

  it("sens de l'indicateur respecté : une couverture qui remonte est une amélioration", async () => {
    const memory = new AuraMemory("supply", memoryStorageBackend(undefined));
    const s2 = evaluateCausalRules(v).find(e => e.rule.id === "S2")!;
    await recordSupplyDecision(memory, { ...decisionContext(v, s2), option: "Transfert inter-site", reason: "", expected: "" });
    const after = { ...v, siTables: (v.siTables ?? []).map(t => t.table !== "InventoryPosition" ? t : { ...t, rows: t.rows.map(r => r.sku === "BOX-PREMIUM" && r.siteId === "WH-PAR" ? { ...r, daysOfCover: "9" } : r) }) };
    expect(decisionJournal(after, supplyDecisions(await memory.all()))[0]).toMatchObject({ entity: "BOX-PREMIUM · WH-PAR", before: 1.8, now: 9, outcome: "amélioration", statusNow: "ok" });
  });
});

describe("versions du modèle", () => {
  it("annuler / rétablir et libellé lisible des modifications", () => {
    const before = modelSnapshot(v);
    const edited = updateKpi(v, "k-s2", { seuilAlerte: 5 });
    const after = modelSnapshot(edited);
    expect(describeModelChange(before, after)).toBe("Seuils de Couverture de stock : 7/3 → 5/3");
    const stack = new ModelUndoStack(before);
    expect(stack.push(before)).toBe(false);
    expect(stack.push(after)).toBe(true);
    const undone = applyModelSnapshot(edited, stack.undo()!);
    expect(undone.kpis.find(k => k.id === "k-s2")!.seuilAlerte).toBe(7);
    expect(undone.siTables).toBe(edited.siTables); // les données lues ne sont pas touchées
    expect(applyModelSnapshot(undone, stack.redo()!).kpis.find(k => k.id === "k-s2")!.seuilAlerte).toBe(5);
  });

  it("retour à une version via la mémoire générique", async () => {
    const memory = new AuraMemory("supply", memoryStorageBackend(undefined));
    const v1 = await memory.saveVersion("supply-modele", "Version initiale", modelSnapshot(v));
    await memory.saveVersion("supply-modele", "Seuils", modelSnapshot(updateKpi(v, "k-s1", { seuilAlerte: 90 })));
    const back = await memory.rollback<ReturnType<typeof modelSnapshot>>("supply-modele", v1.id);
    expect(back!.label).toBe("Retour à : Version initiale");
    expect(back!.payload!.kpis.find(k => k.id === "k-s1")!.seuilAlerte).toBe(60);
    expect(await memory.versions("supply-modele")).toHaveLength(3);
  });
});

describe("garde-fou du copilote", () => {
  it("n'accepte que les chiffres lus et les règles existantes", () => {
    const facts = planCopilotAnswer(v, "Pourquoi la capacité fournisseur alerte ?").facts;
    expect(verifyGrounding("SUP-001 est à **88 score/100**, au-delà du seuil de 60 (règle « Risque de rupture fournisseur »). 2 options.", [facts], v).ok).toBe(true);
    const bad = verifyGrounding("SUP-001 est à 91 et l'exposition atteint 1,2 M€ ; voir la règle « Crise mondiale ».", [facts], v);
    expect(bad.ok).toBe(false);
    expect(bad.unverified).toEqual([91, 1.2]);
    expect(bad.unknownRules).toEqual(["Crise mondiale"]);
    // Identifiants, semaines et dates ne sont pas des chiffres cités.
    expect(verifyGrounding("BAG-LUNA en 2026-W40, lu le 28/09/2026.", [facts], v).ok).toBe(true);
  });
});

describe("export comité", () => {
  it("une page, alerte et décision, sans valeur inventée", async () => {
    const memory = new AuraMemory("supply", memoryStorageBackend(undefined));
    await recordSupplyDecision(memory, { ...decisionContext(v, s1()), option: "Double source", reason: "Tessitura sature", expected: "Risque sous 60" });
    const row = decisionJournal(afterMitigation(v), supplyDecisions(await memory.all()))[0];
    const brief = committeeBrief(v, s1(), row, new Date("2026-09-28T10:00:00Z"));
    expect(brief).toMatchObject({ title: "Risque de rupture fournisseur", severity: "Critique", entity: "SUP-001 · Tessitura Milano", decision: { option: "Double source", before: "88 score/100", now: "70 score/100", outcome: "amélioration" } });
    expect(brief.indicators).toEqual([{ label: "Risque de capacité fournisseur", value: "88 score/100", threshold: "≥ 60 score/100", status: "critique" }]);
    const pdf = await PDFDocument.load(await committeePdf(brief));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdfSafe("88 ≥ 60 → décision")).toBe("88 >= 60 -> décision");
    const pptx = await committeePptx(brief);
    expect(pptx.size).toBeGreaterThan(10_000);
  });
});
