// Cache à deux niveaux.
// Niveau 1 : résultats de requêtes agrégées, clé = empreinte(source + requête) + watermark,
//            TTL selon la classe d'objet (référentiel 24 h, stock 1 h, expéditions 15 min).
// Niveau 2 : drill-down lu en direct à la source (limite de lignes), puis mis en cache.
// Le cockpit ne lit que ce cache : il n'appelle jamais une source directement.
import type { ObjectClass, QuerySpec, Row } from "./types";

export const TTL_MS: Record<ObjectClass, number> = {
  master: 24 * 3600_000,
  stock: 3600_000,
  shipment: 15 * 60_000,
  order: 15 * 60_000,
  sales: 24 * 3600_000,
  default: 3600_000,
};

/** Empreinte stable (FNV-1a 64 bits, hexadécimal) d'un objet JSON aux clés triées. */
export function stableHash(value: unknown): string {
  const json = JSON.stringify(value, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < json.length; i++) { h ^= BigInt(json.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, "0");
}

export interface CacheEntry<T = Row[]> { value: T; storedAt: number; expiresAt: number; watermark: string | null; bytes: number }
export interface CacheStats { hits: number; misses: number; entries: number; bytes: number; evictions: number }

export class QueryCache {
  private map = new Map<string, CacheEntry<unknown>>();
  private st = { hits: 0, misses: 0, evictions: 0 };
  private bytes = 0;
  constructor(private maxBytes = 64 * 1024 * 1024, private now = () => Date.now()) {}

  key(sourceId: string, spec: QuerySpec | Record<string, unknown>, watermark: string | null, level: 1 | 2 = 1) {
    return `L${level}:${sourceId}:${stableHash(spec)}:${watermark ?? "-"}`;
  }

  get<T = Row[]>(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e || e.expiresAt <= this.now()) {
      if (e) this.delete(key);
      this.st.misses++;
      return undefined;
    }
    this.map.delete(key); this.map.set(key, e); // LRU
    this.st.hits++;
    return e.value as T;
  }

  set<T>(key: string, value: T, objectClass: ObjectClass = "default", watermark: string | null = null) {
    const bytes = JSON.stringify(value)?.length ?? 0;
    this.delete(key);
    const t = this.now();
    this.map.set(key, { value, storedAt: t, expiresAt: t + TTL_MS[objectClass], watermark, bytes });
    this.bytes += bytes;
    while (this.bytes > this.maxBytes && this.map.size > 1) {
      const oldest = this.map.keys().next().value as string;
      this.delete(oldest);
      this.st.evictions++;
    }
  }

  /** Lecture ou calcul (fusion des demandes identiques assurée par le gouverneur de la source). */
  async getOrLoad<T>(key: string, objectClass: ObjectClass, load: () => Promise<T>, watermark: string | null = null): Promise<{ value: T; fromCache: boolean }> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return { value: hit, fromCache: true };
    const value = await load();
    this.set(key, value, objectClass, watermark);
    return { value, fromCache: false };
  }

  /** Invalide les entrées d'une source (ex. après un nouveau watermark). */
  invalidate(sourceId: string) { for (const k of [...this.map.keys()]) if (k.split(":")[1] === sourceId) this.delete(k); }

  private delete(key: string) { const e = this.map.get(key); if (e) { this.bytes -= e.bytes; this.map.delete(key); } }
  stats(): CacheStats { return { ...this.st, entries: this.map.size, bytes: this.bytes }; }
}

export const sharedCache = new QueryCache();

// ── Cache à trois niveaux, choisi selon la fréquence des requêtes ───────────
// L1 : mémoire du processus, 60 s, pour les clés très demandées.
// L2 : partagé côté serveur, 1 h (table Supabase aura_int_cache ; repli mémoire).
// L3 : fichier Parquet/JSON sur stockage objet, 24 h (gros résultats, référentiels).
// Le TTL effectif est le plus court entre celui du niveau et celui de la classe d'objet.

export interface CacheLevel {
  readonly name: "L1" | "L2" | "L3";
  readonly ttlMs: number;
  get(key: string): Promise<CacheEntry<unknown> | undefined>;
  set(key: string, entry: CacheEntry<unknown>): Promise<void>;
  invalidate(prefix: string): Promise<void>;
}

export class MemoryLevel implements CacheLevel {
  private raw = new Map<string, CacheEntry<unknown>>();
  private bytes = 0;
  constructor(readonly name: "L1" | "L2" | "L3", readonly ttlMs: number, private maxBytes = 256 * 1024 * 1024, private now = () => Date.now()) {}
  async get(key: string) { const e = this.raw.get(key); if (!e || e.expiresAt <= this.now()) { this.drop(key); return undefined; } return e; }
  async set(key: string, entry: CacheEntry<unknown>) {
    this.drop(key); this.raw.set(key, entry); this.bytes += entry.bytes;
    while (this.bytes > this.maxBytes && this.raw.size > 1) this.drop(this.raw.keys().next().value as string);
  }
  async invalidate(prefix: string) { for (const k of [...this.raw.keys()]) if (k.startsWith(prefix)) this.drop(k); }
  private drop(key: string) { const e = this.raw.get(key); if (e) { this.bytes -= e.bytes; this.raw.delete(key); } }
}

export interface FactQuality {
  /** 0..1 : 1 = tout juste lu, 0 = à l'échéance du TTL. */
  freshness: number;
  source: string;
  level: "source" | "L1" | "L2" | "L3";
  ageMs: number;
  divergent: boolean;
  /** Score synthétique 0..100 (fraîcheur 60 %, source directe ou maître 25 %, absence de divergence 15 %). */
  score: number;
}
export function qualityOf(p: { ageMs: number; ttlMs: number; source: string; level: FactQuality["level"]; fromMaster?: boolean; divergent?: boolean }): FactQuality {
  const freshness = Math.max(0, Math.min(1, 1 - p.ageMs / Math.max(1, p.ttlMs)));
  const score = Math.round(100 * (0.6 * freshness + 0.25 * (p.fromMaster === false ? 0.5 : 1) + 0.15 * (p.divergent ? 0 : 1)));
  return { freshness: Math.round(freshness * 100) / 100, source: p.source, level: p.level, ageMs: p.ageMs, divergent: !!p.divergent, score };
}

export interface CachedFact<T> { value: T; fromCache: boolean; level: FactQuality["level"]; quality: FactQuality }

export class TieredCache {
  private hits = new Map<string, number[]>();
  private st = { L1: 0, L2: 0, L3: 0, source: 0 };
  constructor(
    readonly l1: CacheLevel = new MemoryLevel("L1", 60_000),
    readonly l2: CacheLevel = new MemoryLevel("L2", 3600_000),
    readonly l3: CacheLevel | null = null,
    private opts: { hotHits: number; hotWindowMs: number; l3MinBytes: number; now: () => number } = { hotHits: 3, hotWindowMs: 10 * 60_000, l3MinBytes: 1024 * 1024, now: () => Date.now() },
  ) {}

  key(sourceId: string, spec: unknown, watermark: string | null, level: 1 | 2 = 1) { return `L${level}:${sourceId}:${stableHash(spec)}:${watermark ?? "-"}`; }

  /** Fréquence : la clé est « chaude » si elle a été demandée N fois dans la fenêtre. */
  private touch(key: string): boolean {
    const t = this.opts.now(), w = (this.hits.get(key) ?? []).filter(x => t - x < this.opts.hotWindowMs);
    w.push(t); this.hits.set(key, w);
    if (this.hits.size > 20_000) this.hits.delete(this.hits.keys().next().value as string);
    return w.length >= this.opts.hotHits;
  }

  async getOrLoad<T>(key: string, objectClass: ObjectClass, load: () => Promise<T>, watermark: string | null = null, source = key.split(":")[1] ?? "?"): Promise<CachedFact<T>> {
    const hot = this.touch(key), t = this.opts.now();
    for (const lvl of [this.l1, this.l2, this.l3]) {
      if (!lvl) continue;
      const e = await lvl.get(key);
      if (e && e.expiresAt > t) {
        this.st[lvl.name]++;
        if (hot && lvl !== this.l1) await this.l1.set(key, { ...e, expiresAt: Math.min(e.expiresAt, t + this.l1.ttlMs) });
        const ttl = Math.min(lvl.ttlMs, TTL_MS[objectClass]);
        return { value: e.value as T, fromCache: true, level: lvl.name, quality: qualityOf({ ageMs: t - e.storedAt, ttlMs: ttl, source, level: lvl.name }) };
      }
    }
    const value = await load();
    this.st.source++;
    const bytes = JSON.stringify(value)?.length ?? 0;
    const entry = (ttl: number): CacheEntry<unknown> => ({ value, storedAt: t, expiresAt: t + Math.min(ttl, TTL_MS[objectClass]), watermark, bytes });
    await this.l2.set(key, entry(this.l2.ttlMs));
    if (hot) await this.l1.set(key, entry(this.l1.ttlMs));
    if (this.l3 && (bytes >= this.opts.l3MinBytes || objectClass === "master" || objectClass === "sales")) await this.l3.set(key, entry(this.l3.ttlMs));
    return { value, fromCache: false, level: "source", quality: qualityOf({ ageMs: 0, ttlMs: TTL_MS[objectClass], source, level: "source" }) };
  }

  async invalidate(sourceId: string) { for (const l of [this.l1, this.l2, this.l3]) for (const p of ["L1", "L2"]) await l?.invalidate(`${p}:${sourceId}:`); }
  stats() { return { ...this.st }; }
}

export const sharedTieredCache = new TieredCache();

/** L3 sur fichiers (dossier local, volume monté ou synchronisé vers S3/Supabase Storage). JSON compressé ; Parquet via DuckDB côté serveur. */
export class FileLevel implements CacheLevel {
  readonly name = "L3" as const;
  constructor(private dir: string, readonly ttlMs = 24 * 3600_000) {}
  private path(key: string) { return `${this.dir}/${stableHash(key)}.json.gz`; }
  async get(key: string) {
    try {
      const fs = await import("node:fs/promises"), zlib = await import("node:zlib");
      const e = JSON.parse(zlib.gunzipSync(await fs.readFile(this.path(key))).toString()) as CacheEntry<unknown> & { key: string };
      return e.key === key ? e : undefined;
    } catch { return undefined; }
  }
  async set(key: string, entry: CacheEntry<unknown>) {
    const fs = await import("node:fs/promises"), zlib = await import("node:zlib");
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.path(key), zlib.gzipSync(JSON.stringify({ ...entry, key })));
  }
  async invalidate() { /* expiration par TTL */ }
}

/** Accès direct juste-à-temps : seulement si la fraîcheur est critique ET que le budget le permet. */
export function allowDirectAccess(freshnessCritical: boolean, gov: { breakerState(): string; mode(): string; stats(): { callsToday: number; budget: { maxCallsPerDay: number } } }): boolean {
  if (!freshnessCritical) return false;
  const s = gov.stats();
  return gov.breakerState() === "closed" && gov.mode() === "normal" && s.callsToday < s.budget.maxCallsPerDay * 0.8;
}
