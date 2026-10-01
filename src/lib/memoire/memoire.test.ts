import { describe, it, expect } from "vitest";
import { AuraMemory, memoryStorageBackend, summarizeMemory, supabaseBackend } from "./memoire";

const mem = () => new AuraMemory("architect", memoryStorageBackend(window.localStorage));

describe("mémoire d'Aura", () => {
  it("persiste projets, versions, décisions et préférences dans le navigateur", async () => {
    localStorage.clear();
    const m = mem();
    const p = await m.createProject("Migration ERP");
    await m.saveVersion(p.id, "v1", { n: 1 });
    await m.saveVersion(p.id, "v2", { n: 2 });
    await m.decide("PRA", "refuse", "budget", p.id);
    await m.setPreference("fournisseur", "AWS");
    await m.setPreference("fournisseur", "Azure");
    const again = mem(); // nouvelle instance : relit le stockage
    expect(await again.projects()).toHaveLength(1);
    expect((await again.versions(p.id)).map((v) => v.label)).toEqual(["v1", "v2"]);
    expect(await again.preference("fournisseur")).toBe("Azure");
    expect((await again.all()).filter((e) => e.kind === "preference")).toHaveLength(1);
  });

  it("retour arrière sans perte d'historique", async () => {
    localStorage.clear();
    const m = mem();
    const p = await m.createProject("P");
    const v1 = await m.saveVersion(p.id, "v1", { n: 1 });
    await m.saveVersion(p.id, "v2", { n: 2 });
    const back = await m.rollback<{ n: number }>(p.id, v1.id);
    expect(back?.payload).toEqual({ n: 1 });
    const vs = await m.versions<{ n: number }>(p.id);
    expect(vs).toHaveLength(3);
    expect(vs[vs.length - 1].payload).toEqual({ n: 1 });
  });

  it("oublie un élément et résume pour l'agent", async () => {
    localStorage.clear();
    const m = mem();
    await m.setPreference("fournisseur", "AWS");
    const d = await m.decide("Saga en chorégraphie", "refuse", "trop de services");
    await m.decide("Multi-AZ", "accepte", "");
    let s = await m.summary();
    expect(s).toContain("fournisseur : AWS");
    expect(s).toContain("Tu as refusé : Saga en chorégraphie (raison : trop de services)");
    expect(s).toContain("Tu as déjà retenu : Multi-AZ");
    await m.forget(d.id);
    s = await m.summary();
    expect(s).not.toContain("chorégraphie");
    expect(summarizeMemory([])).toBe("");
  });

  it("sépare les produits (générique pour Supply et Décider)", async () => {
    localStorage.clear();
    const b = memoryStorageBackend(window.localStorage);
    await new AuraMemory("supply", b).setPreference("site", "Lyon");
    expect(await new AuraMemory("architect", b).all()).toHaveLength(0);
    expect(await new AuraMemory("supply", b).preference("site")).toBe("Lyon");
  });

  it("fonctionne sans stockage (mémoire vive)", async () => {
    const m = new AuraMemory("decider", memoryStorageBackend(undefined));
    await m.setPreference("x", "y");
    expect(await m.preference("x")).toBe("y");
    expect(m.backend.name).toBe("memoire-vive");
  });

  it("adaptateur Supabase : filtre par utilisateur et produit", async () => {
    const calls: string[] = [];
    const rows: Record<string, unknown>[] = [];
    const q = {
      select() {
        calls.push("select");
        return q;
      },
      eq(k: string, v: string) {
        calls.push(`eq:${k}=${v}`);
        return q;
      },
      order() {
        return Promise.resolve({ data: rows, error: null });
      },
      upsert(r: Record<string, unknown>) {
        rows.push(r);
        return Promise.resolve({ error: null });
      },
      delete() {
        calls.push("delete");
        return q;
      },
      then: undefined,
    };
    const b = supabaseBackend({ from: () => q }, "u1");
    const m = new AuraMemory("architect", b);
    await m.setPreference("fournisseur", "GCP");
    expect(rows[0]).toMatchObject({ user_id: "u1", product: "architect", kind: "preference" });
    expect(calls).toEqual(expect.arrayContaining(["eq:product=architect", "eq:user_id=u1"]));
  });
});
