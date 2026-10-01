import { describe, expect, it } from "vitest";
import { BudgetError, effectiveBudget, HttpStatusError, SourceGovernor, DEFAULT_BUDGET, shapeOf } from "../budget";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("budget par source", () => {
  it("n'est jamais dépassé, même avec 200 utilisateurs simultanés", async () => {
    const g = new SourceGovernor("sim", { explicitRelax: true, maxRequestsPerMinute: 5, windowMs: 300, maxConcurrent: 1, offPeak: { startHour: 0, endHour: 24 } });
    const starts: number[] = [];
    let active = 0, peak = 0;
    const calls = Array.from({ length: 200 }, (_, i) => g.call(`q${i % 40}`, "light", async () => {
      starts.push(Date.now()); active++; peak = Math.max(peak, active);
      await sleep(5); active--; return i;
    }));
    await Promise.all(calls);
    // 40 demandes distinctes : les doublons ont été fusionnés.
    expect(starts.length).toBeLessThanOrEqual(40);
    expect(g.stats().coalesced).toBeGreaterThan(0);
    expect(peak).toBe(1);
    // Aucune fenêtre glissante de 300 ms ne contient plus de 5 démarrages.
    for (const t of starts) expect(starts.filter(x => x >= t && x < t + 300).length).toBeLessThanOrEqual(5);
    expect(g.stats().peakPerWindow).toBeLessThanOrEqual(5);
  }, 20_000);

  it("les plafonds Aura ne s'assouplissent que sur demande explicite", () => {
    const b = effectiveBudget({ maxRequestsPerMinute: 10_000, maxConcurrent: 8, maxRowsPerCall: 1e6, offPeak: { startHour: 0, endHour: 24 } });
    expect(b.maxRequestsPerMinute).toBe(DEFAULT_BUDGET.maxRequestsPerMinute);
    expect(b.maxConcurrent).toBe(1);
    expect(b.maxRowsPerCall).toBe(DEFAULT_BUDGET.maxRowsPerCall);
    expect(b.offPeak).toEqual(DEFAULT_BUDGET.offPeak);
    expect(effectiveBudget({ maxRequestsPerMinute: 5 }).maxRequestsPerMinute).toBe(5);
    expect(effectiveBudget({ explicitRelax: true, maxConcurrent: 4 }).maxConcurrent).toBe(4);
  });

  it("refuse les extractions lourdes hors heures creuses, autorise les deltas légers", async () => {
    const noon = new Date("2026-09-29T12:00:00"); // heure locale
    const g = new SourceGovernor("jour", {}, { now: () => noon.getTime(), sleep: async () => {} });
    await expect(g.call("gros", "heavy", async () => 1)).rejects.toMatchObject({ code: "OFF_PEAK_ONLY" });
    await expect(g.call("delta", "light", async () => 2)).resolves.toBe(2);
    const night = new Date("2026-09-29T23:30:00");
    const n = new SourceGovernor("nuit", {}, { now: () => night.getTime(), sleep: async () => {} });
    await expect(n.call("gros", "heavy", async () => 3)).resolves.toBe(3);
  });

  it("respecte Retry-After sur 429 et ouvre le disjoncteur après plusieurs erreurs", async () => {
    let t = 0;
    const slept: number[] = [];
    const g = new SourceGovernor("err", { breakerThreshold: 3, maxRetries: 4, baseBackoffMs: 1000 }, { now: () => t, sleep: async ms => { slept.push(ms); t += ms; } });
    let n = 0;
    await expect(g.call("a", "light", async () => { n++; if (n < 3) throw new HttpStatusError(429, "trop", 7000); return "ok"; })).resolves.toBe("ok");
    expect(slept[0]).toBe(7000);
    await expect(g.call("b", "light", async () => { throw new HttpStatusError(503, "indispo"); })).rejects.toBeTruthy();
    expect(g.breakerState()).toBe("open");
    await expect(g.call("c", "light", async () => "x")).rejects.toBeInstanceOf(BudgetError);
  });

  it("simulateur muet : la source ralentit sans erreur, Aura réduit son débit puis s'arrête", async () => {
    let t = 0;
    const clock = { now: () => t, sleep: async (ms: number) => { t += ms; } };
    const g = new SourceGovernor("muet", { explicitRelax: true, maxRequestsPerMinute: 60, windowMs: 60_000, latencyFloorMs: 0, baselineSamples: 5, slowFactor: 2, stopFactor: 4, breakerCooldownMs: 600_000 }, clock);
    // Latence qui croît avec la charge : 100 ms, puis de plus en plus lente, jamais d'erreur.
    let latency = 100;
    const starts: number[] = [];
    const modes: string[] = [];
    let stopped: BudgetError | null = null;
    for (let i = 0; i < 60 && !stopped; i++) {
      try {
        await g.call(`req${i}`, "light", async () => { starts.push(t); t += latency; if (i >= 5) latency *= 1.35; return i; });
        modes.push(g.mode());
      } catch (e) { stopped = e as BudgetError; }
    }
    expect(modes).toContain("ralenti");
    expect(stopped?.code).toBe("SOURCE_SLOW");
    expect(g.mode()).toBe("arrêt");
    // En régime ralenti, les appels sont espacés d'au moins la latence observée (débit réduit).
    const firstSlow = modes.indexOf("ralenti");
    const gaps = starts.slice(firstSlow + 1).map((s, k) => s - starts[firstSlow + k]);
    const normalGaps = starts.slice(1, 5).map((s, k) => s - starts[k]);
    expect(Math.min(...gaps)).toBeGreaterThan(Math.max(...normalGaps));
  });

  it("la référence de latence est propre à chaque forme de requête", () => {
    expect(shapeOf("GET /x?$top=5000&$skip=10000 ")).toBe(shapeOf("GET /x?$top=5000&$skip=20000 "));
    expect(shapeOf("sql SELECT a FROM t WHERE k = 'A'")).toBe(shapeOf("sql SELECT a FROM t WHERE k = 'B'"));
    expect(shapeOf("sql SELECT a FROM t")).not.toBe(shapeOf("sql SELECT a, count(*) FROM t GROUP BY a"));
  });
});
