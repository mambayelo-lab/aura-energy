/**
 * Tests — moteur d'agrégation bipolaire (thèse Lo / Sow 2017).
 *
 * Tests golden tirés directement des exemples de la note pédagogique et
 * de la thèse Lo. Tout échec ici indique un moteur mathématiquement faux.
 */

import { describe, it, expect } from "vitest";
import {
  aggregateCriterion,
  aggregateNode,
  fromContinuousImpact,
  fromContinuousWeight,
  type ElementaryImpact,
} from "../../engine/lo/aggregation";
import { resolveU, resolveUBipolar, ordNeg, ordMin, ordMax, ordMedian } from "../../engine/lo/ordinal";
import { ORD, SYM } from "../../engine/lo/types";

// ── Helpers de test ─────────────────────────────────────────────────────────

const G = (sym: string) => ORD[sym as keyof typeof ORD];
const S = (lvl: number) => SYM[lvl as keyof typeof SYM];

/** Impact d'un seul levier, impact positif */
const pos = (g: string, d: string = "N"): ElementaryImpact => ({
  leverIndex: 0,
  gPlus: g as any,
  dMinus: d as any,
});

// ── Étage 0 : resolveU ──────────────────────────────────────────────────────

describe("resolveU — résolution des cellules inconnues", () => {
  it("at=1 Prudent : U → gain=N, risque=H", () => {
    const result = resolveU("U", 1);
    expect(result.gPlus).toBe(G("N"));
    expect(result.dMinus).toBe(G("H"));
  });

  it("at=2 Optimiste : U → gain=N, risque=N", () => {
    const result = resolveU("U", 2);
    expect(result.gPlus).toBe(G("N"));
    expect(result.dMinus).toBe(G("N"));
  });

  it("cellule renseignée H retournée sans modification (gPlus)", () => {
    const result = resolveU("H", 1);
    expect(result.gPlus).toBe(G("H"));
    expect(result.dMinus).toBe(G("N"));
  });

  it("resolveUBipolar — at=1 : gU→N, dU→H", () => {
    const result = resolveUBipolar("U", "U", 1);
    expect(result.gPlus).toBe(G("N"));
    expect(result.dMinus).toBe(G("H"));
  });

  it("resolveUBipolar — at=2 : gU→N, dU→N", () => {
    const result = resolveUBipolar("U", "U", 2);
    expect(result.gPlus).toBe(G("N"));
    expect(result.dMinus).toBe(G("N"));
  });
});

// ── Opérateurs ordinaux ──────────────────────────────────────────────────────

describe("opérateurs ordinaux de base", () => {
  it("ordNeg : ¬N=H, ¬L=M, ¬M=L, ¬H=N", () => {
    expect(S(ordNeg(G("N")))).toBe("H");
    expect(S(ordNeg(G("L")))).toBe("M");
    expect(S(ordNeg(G("M")))).toBe("L");
    expect(S(ordNeg(G("H")))).toBe("N");
  });

  it("ordMin et ordMax", () => {
    expect(S(ordMin(G("M"), G("H")))).toBe("M");
    expect(S(ordMax(G("L"), G("M")))).toBe("M");
  });

  it("ordMedian — [L,M,H] → M", () => {
    expect(S(ordMedian([G("L"), G("M"), G("H")]))).toBe("M");
  });

  it("ordMedian — [L,H] → L (médiane basse)", () => {
    expect(S(ordMedian([G("L"), G("H")]))).toBe("L");
  });

  it("ordMedian — [M,L,L,M] → L (médiane basse sur 4 éléments)", () => {
    expect(S(ordMedian([G("M"), G("L"), G("L"), G("M")]))).toBe("L");
  });
});

// ── Étage 1 : aggregateCriterion ────────────────────────────────────────────

describe("aggregateCriterion — Étage 1 (paramètre at)", () => {
  /**
   * Test golden thèse Lo : 4 leviers avec impacts (M,L,L,M).
   * Prudent  : min(M,L,L,M) = L → gPlus=L (aucun risque → dMinus=N)
   * Optimiste: max(M,L,L,M) = M → gPlus=M
   * Central  : médiane([M,L,L,M]) = L → gPlus=L
   *
   * (Tous impacts positifs → composante gain active, risque=N)
   */
  const fourImpacts: ElementaryImpact[] = [
    pos("M"),
    pos("L"),
    pos("L"),
    pos("M"),
  ];

  it("[golden] Prudent at=1 : min(M,L,L,M) = L, dMinus=N", () => {
    const result = aggregateCriterion(fourImpacts, 1);
    expect(S(result.prudent.gPlus)).toBe("L");
    expect(S(result.prudent.dMinus)).toBe("N");
  });

  it("[golden] Optimiste at=2 : max(M,L,L,M) = M, dMinus=N", () => {
    const result = aggregateCriterion(fourImpacts, 2);
    expect(S(result.optimiste.gPlus)).toBe("M");
    expect(S(result.optimiste.dMinus)).toBe("N");
  });

  it("invariant bipolaire respecté sur les deux attitudes du modèle", () => {
    const result = aggregateCriterion(fourImpacts, 1);
    // Exactement une composante = N dans chaque profil
    expect(result.prudent.gPlus === 0 || result.prudent.dMinus === 0).toBe(true);
    expect(result.optimiste.gPlus === 0 || result.optimiste.dMinus === 0).toBe(true);
  });

  it("impact négatif dominant → seul dMinus actif", () => {
    const negImpacts: ElementaryImpact[] = [
      pos("N", "M"),
      pos("N", "H"),
    ];
    const result = aggregateCriterion(negImpacts, 1);
    expect(result.prudent.gPlus).toBe(G("N"));
    expect(S(result.prudent.dMinus)).toBe("H");
  });

  it("liste vide → neutre (N, N)", () => {
    const result = aggregateCriterion([], 1);
    expect(result.prudent.gPlus).toBe(0);
    expect(result.prudent.dMinus).toBe(0);
  });

  it("cellule U avec at=1 : prudent traite U comme gain=N, risque=H", () => {
    const uImpacts: ElementaryImpact[] = [
      { leverIndex: 0, gPlus: "U", dMinus: "U" },
      pos("M"),
    ];
    const result = aggregateCriterion(uImpacts, 1);
    // Prudent : min(N, M)=N pour gain, max(H, N)=H pour risque → dMinus actif
    expect(result.prudent.gPlus).toBe(G("N"));
    expect(S(result.prudent.dMinus)).toBe("H");
  });
});

// ── Étage 2 : aggregateNode ──────────────────────────────────────────────────

describe("aggregateNode — Étage 2 (paramètre ωi, Eq.9)", () => {
  /**
   * Test golden thèse Lo : p⁰=(M,L,L,M), ω=(H,H,M,L)
   *
   * G = min_i max(¬ωi, Gi)
   *   = min( max(¬H,M), max(¬H,L), max(¬M,L), max(¬L,M) )
   *   = min( max(N,M),  max(N,L),  max(L,L),  max(M,M)  )
   *   = min( M,         L,         L,          M         )
   *   = L
   *
   * D = max_i min(ωi, Di) avec Di=N partout (gains purs)
   *   = max( min(H,N), min(H,N), min(M,N), min(L,N) )
   *   = max( N, N, N, N ) = N
   *
   * Résultat attendu : gPlus=M (note pédagogique §golden : S_ν(p⁰) = M)
   *
   * NB: le "M" dans la note pédagogique est le résultat de l'agrégation max-min S_ν.
   * Ici aggregateNode donne (L, N). L'agrégation max-min ensuite sur ce vecteur donne M.
   * Le test golden agrégation max-min est dans mesure-floue.test.ts — ici on teste l'étage 2.
   */
  const children = [
    { gPlus: G("M"), dMinus: G("N") },
    { gPlus: G("L"), dMinus: G("N") },
    { gPlus: G("L"), dMinus: G("N") },
    { gPlus: G("M"), dMinus: G("N") },
  ];
  const weights = [G("H"), G("H"), G("M"), G("L")] as any;

  it("[golden] G = min(max(N,M), max(N,L), max(L,L), max(M,M)) = min(M,L,L,M) = L", () => {
    const result = aggregateNode(children, weights);
    expect(S(result.gPlus)).toBe("L");
  });

  it("[golden] D = max(min(H,N),...) = N (gains purs)", () => {
    const result = aggregateNode(children, weights);
    expect(S(result.dMinus)).toBe("N");
  });

  it("poids utilisés tels quels (thèse Lô éq. (9), Tableau V-7) — aucune normalisation vers H", () => {
    // ω = (M,M,M,L) : G = min(max(L,M), max(L,L), max(L,L), max(M,M)) = L
    const result = aggregateNode(children, [G("M"), G("M"), G("M"), G("L")] as any);
    expect(S(result.gPlus)).toBe("L");
    // aucun poids exprimé (tous N) → équation (7) sans poids : min des gains
    expect(S(aggregateNode(children, [0, 0, 0, 0] as any).gPlus)).toBe("L");
  });

  it("lève une erreur si le nombre d'enfants ≠ nombre de poids", () => {
    expect(() =>
      aggregateNode(children, [G("H"), G("M")] as any),
    ).toThrow(/enfants/);
  });

  it("enfant unique de poids H : G = Gi, D = Di", () => {
    const result = aggregateNode(
      [{ gPlus: G("M"), dMinus: G("N") }],
      [G("H")] as any,
    );
    expect(S(result.gPlus)).toBe("M");
    expect(S(result.dMinus)).toBe("N");
  });
});

// ── Conversion depuis le format continu actuel ───────────────────────────────

describe("fromContinuousImpact — conversion [-1,1] → ordinal", () => {
  it("0.8 → gPlus=H, dMinus=N", () => {
    const r = fromContinuousImpact(0.8);
    expect(r.gPlus).toBe("H");
    expect(r.dMinus).toBe("N");
  });

  it("0.5 → gPlus=M, dMinus=N", () => {
    const r = fromContinuousImpact(0.5);
    expect(r.gPlus).toBe("M");
    expect(r.dMinus).toBe("N");
  });

  it("-0.6 → gPlus=N, dMinus=M", () => {
    const r = fromContinuousImpact(-0.6);
    expect(r.gPlus).toBe("N");
    expect(r.dMinus).toBe("M");
  });

  it("0.01 → neutre (N, N)", () => {
    const r = fromContinuousImpact(0.01);
    expect(r.gPlus).toBe("N");
    expect(r.dMinus).toBe("N");
  });
});

describe("fromContinuousWeight — conversion [0,1] → OrdinalLevel", () => {
  it("0.9 → H (3)", () => expect(fromContinuousWeight(0.9)).toBe(3));
  it("0.5 → M (2)", () => expect(fromContinuousWeight(0.5)).toBe(2));
  it("0.25 → L (1)", () => expect(fromContinuousWeight(0.25)).toBe(1));
  it("0.1 → N (0)", () => expect(fromContinuousWeight(0.1)).toBe(0));
});
