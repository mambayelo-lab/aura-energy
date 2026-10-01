// Champs de saisie dans les dialogues : format et unité vérifiés.
import { describe, expect, it } from "vitest";
import { parseDate, parseNumber } from "../../../components/aura/InlineValueForm";
import { checkThresholds, thresholdRequest, withThresholds } from "../copilot-answer";
import type { ArgusVocab, KpiDef } from "../argus-vocab-store";

describe("saisie d'une valeur", () => {
  it("nombre à la française, unité vérifiée", () => {
    expect(parseNumber("1 234,5", "K€")).toEqual({ ok: true, value: 1234.5 });
    expect(parseNumber("12 %", "%")).toEqual({ ok: true, value: 12 });
    expect(parseNumber("3 jours", "jours")).toEqual({ ok: true, value: 3 });
    expect(parseNumber("3 jour", "jours")).toEqual({ ok: true, value: 3 });
    expect(parseNumber("12 kg", "%").ok).toBe(false);
    expect(parseNumber("douze", "%").ok).toBe(false);
  });
  it("date JJ/MM/AAAA ou AAAA-MM-JJ, date impossible refusée", () => {
    expect(parseDate("31/12/2026")).toEqual({ ok: true, value: "2026-12-31" });
    expect(parseDate("2026-01-05")).toEqual({ ok: true, value: "2026-01-05" });
    expect(parseDate("31/02/2026").ok).toBe(false);
    expect(parseDate("demain").ok).toBe(false);
  });
});

describe("seuils demandés au copilote Supply", () => {
  const kpi: KpiDef = { id: "k1", label: "Couverture de stock", unit: "jours", direction: "en_dessous_alerte", seuilAlerte: 7, seuilCritique: 3 };
  const vocab = { kpis: [kpi], mappings: [], causalRules: [], apps: [], fields: [] } as unknown as ArgusVocab;
  it("une question sur le seuil appelle le formulaire ; ordre des seuils vérifié", () => {
    expect(thresholdRequest(vocab, "Quel seuil pour la couverture de stock ?")?.id).toBe("k1");
    expect(thresholdRequest(vocab, "Pourquoi la couverture baisse ?")).toBeUndefined();
    expect(checkThresholds(kpi, 7, 3)).toBeNull();
    expect(checkThresholds(kpi, 3, 7)).toMatch(/en dessous/);
    expect(withThresholds(vocab, "k1", 10, 4).kpis[0]).toMatchObject({ seuilAlerte: 10, seuilCritique: 4 });
  });
});
