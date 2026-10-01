import { describe, expect, it } from "vitest";
import { kindRealistic, kindsFor, nativeKind, toolOf } from "../tool-protocols";
import { importQuestionnaire, maisonLucieChannelsExample, maisonLucieExample } from "../questionnaire";
import { illustrativeNote } from "../../v4/supply-derived";

describe("protocoles réalistes par type d'outil", () => {
  it("reconnaît l'outil et propose son protocole natif", () => {
    expect(toolOf("SAP S/4HANA")?.id).toBe("erp");
    expect(nativeKind(toolOf("SAP S/4HANA"))).toBe("odata");
    expect(toolOf("SAP SuccessFactors")?.id).toBe("rh");
    expect(toolOf("SAP Ariba")?.id).toBe("srm");
    expect(toolOf("Manhattan Active WM")?.id).toBe("wms");
    expect(nativeKind(toolOf("Data lake"))).toBe("sqlhttp");
    expect(toolOf("Shopify")?.id).toBe("oms");
    expect(toolOf("Mon appli maison")).toBeUndefined();
    expect(kindsFor(undefined)).toBeNull();
  });
  it("refuse les protocoles irréalistes, garde ESB et MCP comme passerelles", () => {
    const pim = toolOf("PIM");
    expect(kindRealistic("rest", pim)).toBe(true);
    expect(kindRealistic("sftp", pim)).toBe(true);
    expect(kindRealistic("graphql", pim)).toBe(false);
    expect(kindRealistic("mcp", pim)).toBe(true);
    expect(kindRealistic("esb", pim)).toBe(true);
    expect(kindRealistic("idoc", toolOf("TMS"))).toBe(false);
    expect(kindRealistic("rfc", toolOf("SAP S/4HANA"))).toBe(true);
  });
  it("les exemples Maison Lucie n'utilisent que des protocoles réalistes", () => {
    for (const rows of [maisonLucieExample(), maisonLucieChannelsExample()]) {
      const setup = importQuestionnaire(rows);
      expect(setup.issues.filter(i => /protocole qu'un/.test(i.message))).toEqual([]);
    }
  });
  it("signale un protocole irréaliste et propose le natif si le mode manque", () => {
    const rows = maisonLucieExample().slice(0, 30);
    const pimRow = rows.findIndex(r => r.sources === "PIM");
    const bad = rows.map((r, i) => (i === pimRow ? { ...r, mode: "GraphQL" } : r));
    expect(importQuestionnaire(bad).issues.some(i => /n'est pas un protocole qu'un PIM/.test(i.message))).toBe(true);
    const empty = rows.map((r, i) => (i === pimRow ? { ...r, mode: "" } : r));
    const s = importQuestionnaire(empty);
    expect(s.issues.some(i => /protocole natif proposé pour un PIM : REST/.test(i.message))).toBe(true);
    expect(s.issues.filter(i => i.level === "erreur" && /mode d'accès/.test(i.message))).toEqual([]);
  });
});

describe("scénarios illustratifs", () => {
  it("badge seulement sur les cas réglés à la main, et seulement sur la démo Maison Lucie", () => {
    const demo = { apps: [{ id: "mls-sap", label: "SAP · SI standard Maison Lucie", environment: "Maison Lucie · données synthétiques" }] } as never;
    const client = { apps: [{ id: "sap", label: "SAP", environment: "Production" }] } as never;
    for (const id of ["RES-UNIQUE", "RES-PORT", "RES-MRP"]) expect(illustrativeNote(demo, id)).toMatch(/Scénario illustratif/);
    expect(illustrativeNote(demo, "RES-GEO")).toBeUndefined();
    expect(illustrativeNote(client, "RES-UNIQUE")).toBeUndefined();
  });
});
