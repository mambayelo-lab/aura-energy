import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { can, normalizeRole, ROLES, type Action } from "../access";
import { auditCsv } from "../security.functions";

const ALL: Action[] = ["cockpit.read", "decision.write", "comment.write", "thresholds.edit", "rules.edit", "export", "studio.read", "sources.edit", "credentials.edit", "mappings.edit", "ontology.edit", "users.manage", "audit.read"];

describe("rôles", () => {
  it("lecteur : consulte seulement", () => {
    expect(ALL.filter(a => can("lecteur", a))).toEqual(["cockpit.read", "studio.read"]);
  });
  it("analyste : décide, commente, modifie seuils et règles, sans toucher aux sources ni aux utilisateurs", () => {
    for (const a of ["decision.write", "comment.write", "thresholds.edit", "rules.edit", "export"] as Action[]) expect(can("analyste", a)).toBe(true);
    for (const a of ["sources.edit", "credentials.edit", "mappings.edit", "users.manage", "audit.read"] as Action[]) expect(can("analyste", a)).toBe(false);
  });
  it("administrateur : tout ; sans rôle : rien ; démo : tout (étiqueté)", () => {
    expect(ALL.every(a => can("administrateur", a))).toBe(true);
    expect(ALL.some(a => can(null, a))).toBe(false);
    expect(ALL.every(a => can("demo", a))).toBe(true);
  });
  it("rôles historiques ramenés aux trois rôles", () => {
    expect(normalizeRole("owner")).toBe("administrateur");
    expect(normalizeRole("admin")).toBe("administrateur");
    expect(normalizeRole("member")).toBe("analyste");
    expect(normalizeRole("lecteur")).toBe("lecteur");
    expect(normalizeRole("inconnu")).toBeNull();
    expect(ROLES.map(r => r.id)).toEqual(["lecteur", "analyste", "administrateur"]);
  });
});

describe("audit", () => {
  it("export CSV : colonnes et échappement", () => {
    const csv = auditCsv([{ id: "1", at: "2026-09-29T10:00:00Z", user: "a@b.fr", action: "sources.modification", target: 'SAP "prod"', details: { n: 2 }, org: "Lucie" }]);
    expect(csv.split("\n")[0]).toBe("horodatage;utilisateur;action;cible;details");
    expect(csv).toContain('"SAP ""prod"""');
  });
  it("migration : journal en ajout seul, policies par rôle", () => {
    const sql = readFileSync("supabase/migrations/20260929120000_roles_audit.sql", "utf8");
    expect(sql).toMatch(/before update or delete on public\.aura_audit_log/);
    expect(sql).toMatch(/revoke update, delete, truncate on public\.aura_audit_log/);
    expect(sql).toMatch(/aura_audit_read_admin[\s\S]*'administrateur'/);
    expect(sql).not.toMatch(/create policy[^;]*on public\.aura_audit_log for (update|delete)/);
    expect(sql).toMatch(/aura_int_state_write[\s\S]*'administrateur'/);
  });
});
