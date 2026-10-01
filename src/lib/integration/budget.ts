// Budget d'appels par source : Aura ne doit jamais surcharger le SI client.
// Chaque appel sortant (HTTP, SQL, fichier distant) passe par le gouverneur de
// sa source : file d'attente côté serveur, plafond de requêtes par minute et de
// requêtes simultanées (1 par défaut), lignes par appel, fenêtre d'heures creuses
// pour les extractions lourdes, fusion des demandes identiques en cours, repli
// progressif sur 429/503 (Retry-After respecté) et disjoncteur.

export interface BudgetConfig {
  maxRequestsPerMinute: number;
  maxConcurrent: number;
  maxRowsPerCall: number;
  /** Plafond journalier d'appels (visibilité « Santé des sources »). */
  maxCallsPerDay: number;
  /** Lignes qu'un parcours complet peut lire en journée ; au-delà, il devient « lourd » (heures creuses). */
  maxDaytimeScanRows: number;
  /** Heures creuses (heure locale du serveur, UTC sur Vercel) : extractions lourdes autorisées. */
  offPeak: { startHour: number; endHour: number };
  breakerThreshold: number;
  breakerCooldownMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  /** Fenêtre du plafond de débit (60 000 ms en production ; réduite dans les tests). */
  windowMs: number;
  /** Ralentissement mesuré par Aura : ×slowFactor sur la latence de référence → débit réduit ; ×stopFactor → arrêt. */
  slowFactor: number;
  stopFactor: number;
  baselineSamples: number;
  /** Latence de référence plancher (ms) : en dessous, les variations sont du bruit réseau. */
  latencyFloorMs: number;
  /** Timeout d'un appel (ms) : dépassé, l'appel compte comme une erreur. */
  callTimeoutMs: number;
  /** Assouplissement explicite par l'administrateur ; sans lui, les plafonds ne peuvent qu'être plus stricts. */
  explicitRelax?: boolean;
}

export const DEFAULT_BUDGET: BudgetConfig = {
  maxRequestsPerMinute: 30,
  maxConcurrent: 1,
  maxRowsPerCall: 5000,
  maxCallsPerDay: 5000,
  maxDaytimeScanRows: 20_000,
  offPeak: { startHour: 22, endHour: 6 },
  breakerThreshold: 5,
  breakerCooldownMs: 5 * 60_000,
  maxRetries: 4,
  baseBackoffMs: 1000,
  windowMs: 60_000,
  slowFactor: 2,
  stopFactor: 4,
  baselineSamples: 5,
  latencyFloorMs: 200,
  callTimeoutMs: 60_000,
};

/**
 * Plafonds effectifs. Sans `explicitRelax`, chaque réglage demandé ne peut être
 * que plus prudent que le défaut Aura (plafonds fixes, indépendants de la source).
 */
export function effectiveBudget(requested: Partial<BudgetConfig> = {}): BudgetConfig {
  const d = DEFAULT_BUDGET;
  const r = { ...d, ...requested, offPeak: { ...d.offPeak, ...(requested.offPeak ?? {}) } };
  if (requested.explicitRelax) return r;
  return {
    ...r,
    maxRequestsPerMinute: Math.min(r.maxRequestsPerMinute, d.maxRequestsPerMinute),
    maxConcurrent: Math.min(r.maxConcurrent, d.maxConcurrent),
    maxRowsPerCall: Math.min(r.maxRowsPerCall, d.maxRowsPerCall),
    maxCallsPerDay: Math.min(r.maxCallsPerDay, d.maxCallsPerDay),
    maxDaytimeScanRows: Math.min(r.maxDaytimeScanRows, d.maxDaytimeScanRows),
    offPeak: requested.offPeak && offPeakHours(requested.offPeak) <= offPeakHours(d.offPeak) ? r.offPeak : d.offPeak,
    slowFactor: Math.min(r.slowFactor, d.slowFactor),
    stopFactor: Math.min(r.stopFactor, d.stopFactor),
    callTimeoutMs: Math.min(r.callTimeoutMs, d.callTimeoutMs),
    latencyFloorMs: Math.min(r.latencyFloorMs, d.latencyFloorMs),
    breakerThreshold: Math.min(r.breakerThreshold, d.breakerThreshold),
    breakerCooldownMs: Math.max(r.breakerCooldownMs, d.breakerCooldownMs),
    maxRetries: Math.min(r.maxRetries, d.maxRetries),
    baseBackoffMs: Math.max(r.baseBackoffMs, d.baseBackoffMs),
  };
}
const offPeakHours = (w: { startHour: number; endHour: number }) => (((w.endHour - w.startHour) % 24) + 24) % 24 || (w.endHour !== w.startHour ? 24 : 0);

export type CallKind = "light" | "heavy";

export class HttpStatusError extends Error {
  constructor(public status: number, message: string, public retryAfterMs?: number) { super(message); }
}
export class BudgetError extends Error { constructor(message: string, public code: "OFF_PEAK_ONLY" | "CIRCUIT_OPEN" | "DAILY_CAP" | "SOURCE_SLOW") { super(message); } }

/** Retry-After : secondes ou date HTTP. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const s = Number(value);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.max(0, t - now) : undefined;
}

export interface GovernorStats {
  sourceId: string;
  day: string;
  callsToday: number;
  rowsToday: number;
  errorsToday: number;
  coalesced: number;
  retries: number;
  breaker: "closed" | "open" | "half-open";
  lastCallAt: string | null;
  /** Observé : maximum d'appels simultanés et d'appels démarrés dans une même fenêtre. */
  peakConcurrent: number;
  peakPerWindow: number;
  /** Latence de référence mesurée par Aura, latence récente (moyenne mobile), régime courant. */
  baselineMs: number | null;
  recentMs: number | null;
  mode: "normal" | "ralenti" | "arrêt";
  budget: BudgetConfig;
}

type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };
const realClock: Clock = { now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)) };

export class SourceGovernor {
  readonly budget: BudgetConfig;
  private starts: number[] = [];
  private active = 0;
  private waiters: (() => void)[] = [];
  private inflight = new Map<string, Promise<unknown>>();
  private failures = 0;
  private openedAt = 0;
  private s: Omit<GovernorStats, "breaker" | "budget" | "sourceId" | "baselineMs" | "recentMs" | "mode">;
  /** Latence de référence par forme de requête (une requête agrégée lourde n'est pas comparée à une page légère). */
  private lat = new Map<string, { samples: number[]; baseline: number | null; ewma: number | null; streak: number }>();
  private cur = { samples: [] as number[], baseline: null as number | null, ewma: null as number | null, streak: 0 };
  private get baseline() { return this.cur.baseline; }
  private get ewma() { return this.cur.ewma; }
  private lastStart = 0;

  constructor(readonly sourceId: string, budget: Partial<BudgetConfig> = {}, private clock: Clock = realClock) {
    this.budget = effectiveBudget(budget);
    this.s = { day: this.today(), callsToday: 0, rowsToday: 0, errorsToday: 0, coalesced: 0, retries: 0, lastCallAt: null, peakConcurrent: 0, peakPerWindow: 0 };
  }

  private today() { return new Date(this.clock.now()).toISOString().slice(0, 10); }
  private rollDay() { const d = this.today(); if (d !== this.s.day) this.s = { ...this.s, day: d, callsToday: 0, rowsToday: 0, errorsToday: 0, coalesced: 0, retries: 0 }; }

  isOffPeak(at = new Date(this.clock.now())): boolean {
    const h = at.getHours(), { startHour: a, endHour: b } = this.budget.offPeak;
    return a <= b ? h >= a && h < b : h >= a || h < b;
  }

  /** Régime piloté par la seule latence observée par Aura (aucun signal de la source). */
  mode(): GovernorStats["mode"] {
    if (this.breakerState() === "open") return "arrêt";
    if (this.baseline && this.ewma && this.ewma >= this.budget.slowFactor * this.ref()) return "ralenti";
    return "normal";
  }

  private observeLatency(ms: number, shape: string) {
    let l = this.lat.get(shape);
    if (!l) { l = { samples: [], baseline: null, ewma: null, streak: 0 }; this.lat.set(shape, l); if (this.lat.size > 500) this.lat.delete(this.lat.keys().next().value as string); }
    if (l.baseline === null) {
      l.samples.push(ms);
      if (l.samples.length >= this.budget.baselineSamples) {
        const sorted = [...l.samples].sort((a, b) => a - b);
        l.baseline = Math.max(1, sorted[Math.floor(sorted.length / 2)]);
        l.ewma = l.baseline;
        this.cur = l;
      }
      return;
    }
    this.cur = l;
    const prev = l.ewma ?? ms;
    l.ewma = 0.5 * prev + 0.5 * ms;
    // La référence ne suit que les améliorations durables (jamais la dégradation).
    if (l.ewma < l.baseline) l.baseline = 0.9 * l.baseline + 0.1 * l.ewma;
    const ratio = l.ewma / this.ref();
    l.streak = ratio >= this.budget.slowFactor && l.ewma > prev ? l.streak + 1 : 0;
    const risingStreak = l.streak;
    // Arrêt : latence ≥ stopFactor × référence, ou hausse continue malgré le ralentissement.
    if (ratio >= this.budget.stopFactor || risingStreak >= 3) {
      this.failures = this.budget.breakerThreshold;
      this.openedAt = this.clock.now();
      this.stopReason = `latence ${Math.round(l.ewma)} ms, ${ratio.toFixed(1)} × la référence (${Math.round(l.baseline)} ms)`;
    }
  }
  private stopReason = "";
  private ref() { return Math.max(this.baseline ?? 1, this.budget.latencyFloorMs, 1); }

  breakerState(): GovernorStats["breaker"] {
    if (this.failures < this.budget.breakerThreshold) return "closed";
    return this.clock.now() - this.openedAt >= this.budget.breakerCooldownMs ? "half-open" : "open";
  }

  /** Lignes maximum par appel (pagination imposée aux connecteurs). */
  rowsPerCall(requested?: number) { return Math.max(1, Math.min(requested ?? this.budget.maxRowsPerCall, this.budget.maxRowsPerCall)); }

  /**
   * Exécute un appel sous budget. `key` identifie la demande : deux demandes
   * identiques simultanées partagent le même appel (aucun doublon envoyé).
   */
  call<T>(key: string, kind: CallKind, fn: () => Promise<T>, rowsOf: (t: T) => number = () => 0, shape = shapeOf(key)): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) { this.s.coalesced++; return existing as Promise<T>; }
    const p = this.run(kind, fn, rowsOf, shape).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async run<T>(kind: CallKind, fn: () => Promise<T>, rowsOf: (t: T) => number, shape: string): Promise<T> {
    this.rollDay();
    if (kind === "heavy" && !this.isOffPeak()) throw new BudgetError(`Extraction lourde refusée hors heures creuses (${this.budget.offPeak.startHour} h–${this.budget.offPeak.endHour} h) : seuls les deltas légers sont autorisés en journée.`, "OFF_PEAK_ONLY");
    for (let attempt = 0; ; attempt++) {
      const state = this.breakerState();
      if (state === "open") throw new BudgetError(`Aura suspend ses appels à ${this.sourceId} (${this.stopReason || `${this.failures} erreurs`}) : nouvel essai dans ${Math.ceil((this.budget.breakerCooldownMs - (this.clock.now() - this.openedAt)) / 1000)} s.`, this.stopReason ? "SOURCE_SLOW" : "CIRCUIT_OPEN");
      if (state === "half-open" && this.stopReason) { this.cur.ewma = this.cur.baseline; this.cur.streak = 0; }
      if (this.s.callsToday >= this.budget.maxCallsPerDay) throw new BudgetError(`Plafond journalier atteint pour ${this.sourceId} (${this.budget.maxCallsPerDay} appels).`, "DAILY_CAP");
      await this.acquire();
      const started = this.clock.now();
      try {
        const out = await withTimeout(fn(), this.budget.callTimeoutMs);
        this.observeLatency(this.clock.now() - started, shape);
        if (this.mode() !== "arrêt") { this.failures = 0; this.stopReason = ""; }
        this.s.rowsToday += rowsOf(out);
        return out;
      } catch (e) {
        this.s.errorsToday++;
        this.observeLatency(this.clock.now() - started, shape);
        const status = e instanceof HttpStatusError ? e.status : 0;
        const retryable = status === 429 || status === 503 || status === 502 || status === 504;
        if (retryable || status === 0 || status >= 500) { this.failures++; if (this.failures >= this.budget.breakerThreshold) this.openedAt = this.clock.now(); }
        if (!retryable || attempt >= this.budget.maxRetries || this.breakerState() === "open") throw e;
        this.s.retries++;
        const backoff = Math.max((e as HttpStatusError).retryAfterMs ?? 0, this.budget.baseBackoffMs * 2 ** attempt);
        await this.clock.sleep(backoff);
      } finally {
        this.release();
      }
    }
  }

  private async acquire() {
    // 1) Place simultanée (file FIFO).
    while (this.active >= this.budget.maxConcurrent) await new Promise<void>(r => this.waiters.push(r));
    this.active++;
    // 2) Débit : au plus N démarrages dans toute fenêtre glissante ; en régime
    //    « ralenti », débit divisé par 4 et espacement d'au moins la latence observée.
    for (;;) {
      const now = this.clock.now();
      this.starts = this.starts.filter(t => now - t < this.budget.windowMs);
      const slowed = this.mode() === "ralenti";
      const cap = slowed ? Math.max(1, Math.floor(this.budget.maxRequestsPerMinute / 4)) : this.budget.maxRequestsPerMinute;
      const gap = slowed ? Math.max(this.budget.windowMs / cap, this.ewma ?? 0) : 0;
      if (this.starts.length < cap && now - this.lastStart >= gap) break;
      const waitRate = this.starts.length >= cap ? this.budget.windowMs - (now - this.starts[0]) + 1 : 0;
      await this.clock.sleep(Math.max(waitRate, gap - (now - this.lastStart), 1));
    }
    const now = this.clock.now();
    this.starts.push(now);
    this.lastStart = now;
    this.s.callsToday++;
    this.s.lastCallAt = new Date(now).toISOString();
    this.s.peakConcurrent = Math.max(this.s.peakConcurrent, this.active);
    this.s.peakPerWindow = Math.max(this.s.peakPerWindow, this.starts.length);
  }

  private release() {
    this.active--;
    this.waiters.shift()?.();
  }

  stats(): GovernorStats {
    this.rollDay();
    return { sourceId: this.sourceId, ...this.s, breaker: this.breakerState(), baselineMs: this.baseline && Math.round(this.baseline), recentMs: this.ewma && Math.round(this.ewma), mode: this.mode(), budget: this.budget };
  }
}

// Un gouverneur par source et par processus serveur : tous les utilisateurs
// connectés partagent la même file. (Plusieurs instances serverless ont chacune
// leur file : voir docs/INTEGRATION-DONNEES.md, « Limites ».)
const registry = new Map<string, SourceGovernor>();
export function governorFor(sourceId: string, budget?: Partial<BudgetConfig>): SourceGovernor {
  let g = registry.get(sourceId);
  if (!g || (budget && JSON.stringify(effectiveBudget(budget)) !== JSON.stringify(g.budget))) {
    const prev = g;
    g = new SourceGovernor(sourceId, budget ?? prev?.budget);
    registry.set(sourceId, g);
  }
  return g;
}
export function allGovernorStats(): GovernorStats[] { return [...registry.values()].map(g => g.stats()); }
export function resetGovernors() { registry.clear(); }

/** Forme d'une requête : littéraux, nombres et paramètres de pagination retirés. */
export function shapeOf(key: string): string {
  return key.replace(/'(?:[^']|'')*'/g, "?").replace(/([?&](?:\$skip|\$top|page|cursor|offset|from|updatedAfter|!deltatoken)=)[^&\s]*/g, "$1#").replace(/\d+/g, "#").slice(0, 300);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new HttpStatusError(0, `Délai dépassé (${ms} ms)`)), ms); })]).finally(() => clearTimeout(t));
}
