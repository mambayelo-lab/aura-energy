import { describe, it, expect } from "vitest";
import { productForHost, isAllowedPath } from "../product-host";

describe("étanchéité par adresse", () => {
  it("reconnaît chaque déploiement", () => {
    expect(productForHost("aura-decision-zen.vercel.app")).toBe("supply");
    expect(productForHost("aura-decider.vercel.app")).toBe("decide");
    expect(productForHost("aura-architect-seven.vercel.app")).toBe("supply");
    expect(productForHost("127.0.0.1")).toBeNull();
  });
  it("Supply ne sert ni Décider ni Architect", () => {
    expect(isAllowedPath("supply", "/cockpit/resilience")).toBe(true);
    expect(isAllowedPath("supply", "/cockpit/studio")).toBe(true);
    expect(isAllowedPath("supply", "/cockpit/transformation")).toBe(false);
    expect(isAllowedPath("supply", "/cockpit/dossiers-architecture")).toBe(false);
    expect(isAllowedPath("supply", "/cockpit/atelier")).toBe(false);
    expect(isAllowedPath("supply", "/cockpit/home")).toBe(false);
  });
  it("Décider reste chez lui", () => {
    expect(isAllowedPath("decide", "/cockpit/atelier")).toBe(true);
    expect(isAllowedPath("decide", "/cockpit/demos-architecture")).toBe(false);
    expect(isAllowedPath("decide", "/cockpit/resilience")).toBe(false);
  });
});
