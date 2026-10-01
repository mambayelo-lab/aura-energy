// Studio Connecter : identifiants explicites, secrets lus côté serveur.
import { describe, expect, it } from "vitest";
import { buildEndpoint, CONNECTORS, hasLiteralSecret, vercelVar } from "../../../components/aura/studio/ConnectSources";
import { resolveSecrets } from "../si-connector";

describe("identifiants des sources", () => {
  it("chaque connecteur dit ce que Supply en tire et ce qu'il faut fournir ; Snowflake honnêtement « bientôt »", () => {
    for (const c of CONNECTORS) { expect(c.donnees.length).toBeGreaterThan(10); expect(c.fournir.length).toBeGreaterThan(10); }
    expect(CONNECTORS.find(c => c.id === "snowflake")!.status).toBe("bientot");
  });
  it("variable Vercel : seule la référence part du navigateur, le serveur la résout", () => {
    expect(vercelVar("SAP S/4HANA", "PASSWORD")).toBe("AURA_SRC_SAP_S_4HANA_PASSWORD");
    const ep = buildEndpoint({ access: "rest", auth: "userpass", url: "https://sap.example/odata", label: "SAP S/4HANA", vault: true, user: "svc", secret: "", clientId: "", tokenUrl: "" })!;
    expect(JSON.stringify(ep)).toContain("{{env:AURA_SRC_SAP_S_4HANA_PASSWORD}}");
    expect(hasLiteralSecret(ep)).toBe(false);
    const resolved = resolveSecrets(ep, { AURA_SRC_SAP_S_4HANA_PASSWORD: "s3cret" }) as { headers: Record<string, string> };
    expect(resolved.headers.Authorization).toBe(`Basic ${Buffer.from("svc:s3cret").toString("base64")}`);
    expect(() => resolveSecrets(ep, {})).toThrow(/AURA_SRC_SAP_S_4HANA_PASSWORD/);
  });
  it("secret saisi pour la session : repéré comme en clair (jamais enregistré)", () => {
    const ep = buildEndpoint({ access: "rest", auth: "apikey", url: "https://api.example", label: "X", vault: false, user: "", secret: "abc", clientId: "", tokenUrl: "" });
    expect(hasLiteralSecret(ep!)).toBe(true);
  });
});
