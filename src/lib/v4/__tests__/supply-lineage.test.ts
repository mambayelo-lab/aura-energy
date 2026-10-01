// Ontologie vivante (objets dépliés) et lignage du mapping, sur la démo Maison Lucie.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { blankVocab, type ArgusVocab } from "../argus-vocab-store";
import { runSupplyDemo } from "../supply-demo";
import { ontologyGraph } from "../supply-diagrams";
import { acceptProposal, addLink, buildLineage, changeLinkColumn, freshness, removeLink } from "../supply-lineage";
import { stubMaisonLucie } from "./lucie-stub";

let v: ArgusVocab;
beforeAll(async () => {
  stubMaisonLucie();
  const r = await runSupplyDemo(blankVocab());
  vi.unstubAllGlobals();
  if (!r.ok) throw new Error(r.error);
  v = r.vocab;
});

describe("ontologie vivante", () => {
  it("replié par défaut ; un objet déplié montre source, type, valeur et fraîcheur, et pousse la rangée suivante", () => {
    const closed = ontologyGraph(v);
    expect(closed.nodes.every(n => !n.attributes)).toBe(true);
    const open = ontologyGraph(v, new Set(["sc-fournisseur"]));
    const f = open.nodes.find(n => n.id === "sc-fournisseur")!;
    const cap = f.attributes!.find(a => a.id === "sc-fournisseur.capacite")!;
    expect(cap).toMatchObject({ type: "number", source: expect.stringMatching(/^Lucie SpendGuard · SupplierRiskAssessment\.capacityRisk$/), value: "88", fresh: "à l'instant" });
    expect(f.w).toBeGreaterThan(closed.nodes.find(n => n.id === "sc-fournisseur")!.w);
    const article = (g: typeof open) => g.nodes.find(n => n.id === "sc-article")!.y;
    expect(article(open) - article(closed)).toBe(f.h - f.baseH);
    // Aucun chevauchement, même avec tout déplié.
    const all = ontologyGraph(v, new Set(open.nodes.map(n => n.id)));
    for (const a of all.nodes) for (const b of all.nodes) if (a !== b) {
      const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart, `${a.id} / ${b.id}`).toBe(true);
    }
  });

  it("un attribut non mappé n'a pas de source (pastille « à mapper »)", () => {
    const g = ontologyGraph({ ...v, entityMappings: (v.entityMappings ?? []).filter(m => m.attributeId !== "sc-fournisseur.pays") }, new Set(["sc-fournisseur"]));
    const n = g.nodes.find(x => x.id === "sc-fournisseur")!;
    expect(n.attributes!.find(a => a.id === "sc-fournisseur.pays")!.source).toBeUndefined();
    expect(n.mappedCount).toBe(n.attributeCount - 1);
  });

  it("fraîcheur lisible", () => {
    const now = Date.parse("2026-09-28T10:00:00Z");
    expect(freshness("2026-09-28T09:55:00Z", now)).toBe("il y a 5 min");
    expect(freshness("2026-09-28T07:00:00Z", now)).toBe("il y a 3 h");
    expect(freshness(undefined, now)).toBeUndefined();
  });
});

describe("lignage", () => {
  it("système → tables → colonnes ; liens mappés, colonnes non reliées signalées", () => {
    const l = buildLineage(v);
    const risk = l.systems.find(s => s.appId === "ml-risk")!;
    const table = risk.tables.find(t => t.table === "SupplierRiskAssessment")!;
    expect(table.columns.find(c => c.column === "capacityRisk")).toMatchObject({ numeric: true, linked: true });
    expect(l.links.some(x => x.target === "k:k-s1" && x.state === "mappe")).toBe(true);
    expect(l.systems.flatMap(s => s.tables.flatMap(t => t.columns)).some(c => !c.linked)).toBe(true);
    expect(l.systems.flatMap(s => s.tables.flatMap(t => t.columns)).length).toBeGreaterThan(60);
  });

  it("créer, changer de colonne, supprimer ; erreur de type détectée", () => {
    const f = (name: string) => v.fields.find(x => x.name === name)!.id;
    let w = addLink(v, f("Supplier.country"), "a:sc-fournisseur.capacite");
    let link = buildLineage(w).links.find(x => x.fieldId === f("Supplier.country") && x.target === "a:sc-fournisseur.capacite")!;
    expect(link.state).toBe("erreur");
    w = changeLinkColumn(w, link, f("SupplierRiskAssessment.overallRisk"));
    link = buildLineage(w).links.find(x => x.id === link.id)!;
    expect(link).toMatchObject({ state: "mappe", fieldId: f("SupplierRiskAssessment.overallRisk") });
    w = removeLink(w, link);
    expect(buildLineage(w).links.some(x => x.id === link.id)).toBe(false);
    // Indicateur : clic colonne puis indicateur.
    const k = buildLineage(addLink(v, f("Shipment.delayHours"), "k:k-s9")).links.find(x => x.target === "k:k-s9" && x.fieldId === f("Shipment.delayHours"));
    expect(k?.state).toBe("mappe");
  });

  it("propositions en pointillé : valider ou refuser", () => {
    const w = { ...v, entityMappings: (v.entityMappings ?? []).filter(m => m.attributeId !== "sc-fournisseur.capacite") };
    const p = buildLineage(w).links.find(x => x.state === "propose" && x.target === "a:sc-fournisseur.capacite")!;
    expect(p).toBeDefined();
    expect(buildLineage(acceptProposal(w, p)).links.find(x => x.target === p.target)!.state).toBe("mappe");
    expect(buildLineage(w, [p.id]).links.some(x => x.id === p.id)).toBe(false);
  });
});
