// Photographie du SI Maison Lucie servie à la place du portail (tests).
import { vi } from "vitest";
import fixture from "./fixtures/maison-lucie-si.json";

type Row = Record<string, unknown>;

export function stubMaisonLucie() {
  const data = fixture.datasets as Record<string, { entity: string; records: Row[]; tables: Record<string, Row[]> }>;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.pathname === "/api/catalog") return json({ environment: "test", synthetic: true, generatedAt: "2026-09-26", applications: fixture.applications });
    if (url.pathname === "/api/token") return json({ access_token: "demo" });
    const m = url.pathname.match(/^\/api\/data\/([^/]+)$/);
    if (m && data[m[1]]) {
      const d = data[m[1]];
      const t = url.searchParams.get("table");
      const availableTables = [d.entity, ...Object.keys(d.tables)];
      return t && t !== d.entity ? json({ entity: t, records: d.tables[t] ?? [], availableTables }) : json({ entity: d.entity, records: d.records, availableTables });
    }
    return json({ error: "absent de la photographie de test" }, 404);
  });
}
