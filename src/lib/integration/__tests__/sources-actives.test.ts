import { describe, expect, it } from "vitest";
import { buildTemplate, effectiveAcv, importQuestionnaire, maisonLucieExample } from "../questionnaire";
import type { FieldProposal } from "../discovery";

const withProposals = () => {
  const s = importQuestionnaire(maisonLucieExample());
  s.proposals = s.objects.map(o => ({ attributeId: `${o.group}.key`, label: "clé", sourceId: o.sourceId, entity: o.entity, column: "id", score: 0.9, parts: null, alternatives: [], status: "validée" }) as FieldProposal);
  return s;
};

describe("activer ou désactiver une source", () => {
  it("une source inactive n'est plus sollicitée et ses correspondances sont suspendues, pas supprimées", () => {
    const s = withProposals();
    s.sources = s.sources.map(x => (x.label === "TMS" ? { ...x, status: "inactive" as const, enabled: false } : x));
    const { template } = buildTemplate(s);
    expect(template.sources.map(x => x.label)).not.toContain("TMS");
    expect(template.bindings.shipments.source).toBe("");
    expect(s.proposals!.some(p => p.sourceId === "q-tms")).toBe(true);
  });
  it("maître désactivé : repli sur la source suivante, sinon attribut non couvert", () => {
    const s = withProposals();
    s.sources = s.sources.map(x => (x.label === "SAP S/4HANA" ? { ...x, status: "obsolete" as const, enabled: false } : x));
    const { acv, fallbacks } = effectiveAcv(s);
    expect(acv.attributes.find(a => a.attribute === "Pays")?.master).toBe(s.acv.attributes.find(a => a.attribute === "Pays")!.consumers[0]); // première consommatrice active
    expect(fallbacks.find(f => f.attribute === "supplier.SIRET")).toMatchObject({ from: "q-sap-s-4hana", to: null });
    expect(acv.attributes.find(a => a.attribute === "SIRET")?.master).toBeUndefined();
  });
});
