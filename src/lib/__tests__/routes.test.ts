import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";

const __DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROUTES_DIR = join(__DIR, "../../routes");
const ROUTE_TREE_PATH = join(__DIR, "../../routeTree.gen.ts");

let ROUTE_TREE = "";
let routeTreeAvailable = false;
try {
  ROUTE_TREE = readFileSync(ROUTE_TREE_PATH, "utf-8");
  routeTreeAvailable = true;
} catch {
  // routeTree.gen.ts not generated yet — skip tree-dependent tests
}

const registeredPaths = routeTreeAvailable
  ? new Set([...ROUTE_TREE.matchAll(/'(\/[^']+)':/g)].map(m => m[1]))
  : new Set<string>();

const routeFiles = readdirSync(ROUTES_DIR).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));

// Deux applications étanches : Aura Décider (/cockpit/home, /cockpit/atelier,
// /cockpit/demos) et Aura Supply Chain (/cockpit/resilience, /cockpit/studio).
// Aura Architect vit dans son propre dépôt (aura-architect).
const LIVE_ROUTES = [
  "/cockpit/home",
  "/cockpit/atelier",
  "/cockpit/studio",
  "/cockpit/resilience",
  "/cockpit/demos",
];

describe("Route integrity", () => {
  it("found route files", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("routeTree.gen.ts exists and has content (or skipped)", () => {
    if (!routeTreeAvailable) return; // generated at dev/build time
    expect(ROUTE_TREE.length).toBeGreaterThan(100);
  });

  LIVE_ROUTES.forEach(route => {
    it(`Route registered: ${route}`, () => {
      if (!routeTreeAvailable) return; // skip when routeTree not generated
      const exists = registeredPaths.has(route) || ROUTE_TREE.includes(`"${route}"`);
      expect(exists).toBe(true);
    });
  });

  it("no route file references a deleted /app/* or legacy /cockpit/* path", () => {
    const deadPatterns = ["/app/admin", "/app/conseil", "/app/decideur", "/cockpit/architect\"", "/cockpit/workspace", "/cockpit/argus\""];
    const offenders: string[] = [];
    routeFiles.forEach(f => {
      const content = readFileSync(join(ROUTES_DIR, f), "utf-8");
      deadPatterns.forEach(p => {
        if (content.includes(p)) offenders.push(`${f} → ${p}`);
      });
    });
    expect(offenders).toEqual([]);
  });
});
