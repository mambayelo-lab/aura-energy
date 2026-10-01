import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveDecision,
  loadJournal,
  deleteDecision,
  updateDecisionStatus,
  formatJournalDate,
} from "../decision-journal";
import type { DecisionRecord } from "../decision-journal";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

const STORAGE_KEY = "aura_v4_journal_v1";

describe("decision-journal", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("returns empty array when no journal exists", () => {
    expect(loadJournal()).toEqual([]);
  });

  it("saves a decision and loads it back", () => {
    const input = {
      playbookIds: ["supply_chain_risk"],
      playbookLabels: ["Risque Supply"],
      alertId: "a1",
      alertLabel: "Rupture stock NOVA",
      question: "Quel impact sur la marge?",
      response: "Impact estimé 180K€",
      status: "analyse" as const,
    };
    saveDecision(input);
    const journal = loadJournal();
    expect(journal).toHaveLength(1);
    expect(journal[0].question).toBe(input.question);
    expect(journal[0].response).toBe(input.response);
    expect(journal[0].playbookIds).toEqual(input.playbookIds);
    expect(journal[0].status).toBe("analyse");
    expect(journal[0].id).toBeTruthy();
    expect(journal[0].savedAt).toBeTruthy();
  });

  it("most recent entry appears first", () => {
    saveDecision({ playbookIds: [], playbookLabels: [], question: "Q1", response: "R1", status: "analyse" });
    saveDecision({ playbookIds: [], playbookLabels: [], question: "Q2", response: "R2", status: "analyse" });
    const journal = loadJournal();
    expect(journal[0].question).toBe("Q2");
    expect(journal[1].question).toBe("Q1");
  });

  it("deletes a decision by id", () => {
    saveDecision({ playbookIds: [], playbookLabels: [], question: "ToDelete", response: "R", status: "analyse" });
    const journal = loadJournal();
    expect(journal).toHaveLength(1);
    deleteDecision(journal[0].id);
    expect(loadJournal()).toHaveLength(0);
  });

  it("does not throw when deleting non-existent id", () => {
    expect(() => deleteDecision("non-existent-id")).not.toThrow();
  });

  it("updates decision status", () => {
    saveDecision({ playbookIds: [], playbookLabels: [], question: "Q", response: "R", status: "analyse" });
    const id = loadJournal()[0].id;
    updateDecisionStatus(id, "validated");
    expect(loadJournal()[0].status).toBe("validated");
  });

  it("caps journal at 150 entries", () => {
    for (let i = 0; i < 155; i++) {
      saveDecision({ playbookIds: [], playbookLabels: [], question: `Q${i}`, response: "R", status: "analyse" });
    }
    expect(loadJournal().length).toBeLessThanOrEqual(150);
  });

  it("formatJournalDate returns a non-empty string for ISO date", () => {
    const result = formatJournalDate("2025-01-15T10:30:00.000Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formatJournalDate handles invalid date gracefully", () => {
    expect(() => formatJournalDate("not-a-date")).not.toThrow();
  });
});
