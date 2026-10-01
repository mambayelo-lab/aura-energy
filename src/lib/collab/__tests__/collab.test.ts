import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EMPTY, assignmentOf, commentsOf, parseMentions, resolveMentions, withAssignment, withComment } from "../collab";

describe("collaboration", () => {
  it("lit les mentions @ et les rapproche des membres", () => {
    expect(parseMentions("Vu avec @claire et @paul.martin@acme.fr, merci @claire.")).toEqual(["claire", "paul.martin@acme.fr"]);
    expect(parseMentions("adresse a@b.fr sans mention")).toEqual([]);
    expect(resolveMentions(["claire", "x"], ["Claire@acme.fr", "paul@acme.fr"])).toEqual(["claire@acme.fr", "x"]);
  });
  it("commentaire sur une alerte et sur une décision, activité avec mentions", () => {
    let s = withComment(EMPTY, { targetType: "alerte", targetId: "RES-UNIQUE", user: "a@acme.fr", body: "À regarder @paul", members: ["paul@acme.fr"] });
    s = withComment(s, { targetType: "decision", targetId: "D1", user: "a@acme.fr", body: "OK" });
    expect(commentsOf(s, "alerte", "RES-UNIQUE")[0].mentions).toEqual(["paul@acme.fr"]);
    expect(commentsOf(s, "decision", "D1")).toHaveLength(1);
    expect(s.activity.map(a => a.kind)).toEqual(["commentaire", "commentaire", "mention"]);
    expect(withComment(s, { targetType: "alerte", targetId: "X", user: "a", body: "   " })).toBe(s);
  });
  it("assignation et statut (à traiter, en cours, traité)", () => {
    let s = withAssignment(EMPTY, { alertId: "RES-PORT", assignee: "paul@acme.fr", user: "a" });
    expect(assignmentOf(s, "RES-PORT")).toMatchObject({ assignee: "paul@acme.fr", status: "a_traiter" });
    s = withAssignment(s, { alertId: "RES-PORT", status: "en_cours", user: "paul@acme.fr" });
    s = withAssignment(s, { alertId: "RES-PORT", status: "traite", user: "paul@acme.fr" });
    expect(assignmentOf(s, "RES-PORT")).toMatchObject({ assignee: "paul@acme.fr", status: "traite" });
    expect(s.activity.map(a => a.summary)).toEqual(["statut : Traité", "statut : En cours", "a assigné l'alerte à paul@acme.fr"]);
    expect(withAssignment(s, { alertId: "RES-PORT", status: "traite", user: "x" })).toBe(s);
  });
  it("migration : RLS activée et rôles existants sur les trois tables", () => {
    const sql = readFileSync(`${process.cwd()}/supabase/migrations/20260930090000_aura_collaboration.sql`, "utf8");
    for (const t of ["aura_comments", "aura_assignments", "aura_activity"]) expect(sql).toContain(`alter table public.${t} enable row level security`);
    expect(sql).toContain("aura_has_role(org_id, 'analyste')");
    expect(sql).toContain("aura_has_role(org_id, 'lecteur')");
    expect(sql).toMatch(/revoke update, delete, truncate on public\.aura_activity/);
  });
});
