// memoire.ts — mémoire persistante d'Aura, générique pour tous les produits
// (Architect aujourd'hui, Supply et Décider demain). Elle garde les projets,
// les versions (historique avec retour arrière), les décisions et leurs
// raisons, et les préférences. Stockage : Supabase quand la configuration et
// une session sont présentes (table aura_memoire), sinon localStorage.
// Un résumé textuel est fourni aux agents LLM pour garder la continuité.

export type MemoryProduct = "architect" | "supply" | "decider";
export type MemoryKind = "projet" | "version" | "decision" | "preference";

export interface MemoryEntry<T = unknown> {
  id: string;
  product: MemoryProduct;
  kind: MemoryKind;
  projectId?: string;
  key?: string; // préférence : clé ; décision : sujet
  label: string; // texte lisible (panneau Mémoire, résumé)
  payload?: T; // version : le modèle ; décision : détails
  createdAt: string;
}

export interface MemoryBackend {
  name: "supabase" | "local" | "memoire-vive";
  list(product: MemoryProduct): Promise<MemoryEntry[]>;
  put(e: MemoryEntry): Promise<void>;
  remove(product: MemoryProduct, id: string): Promise<void>;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Stockages ────────────────────────────────────────────────────────────
export function memoryStorageBackend(storage: Storage | undefined): MemoryBackend {
  const mem = new Map<string, string>();
  const get = (k: string) => {
    try {
      return storage ? storage.getItem(k) : (mem.get(k) ?? null);
    } catch {
      return mem.get(k) ?? null;
    }
  };
  const set = (k: string, v: string) => {
    try {
      if (storage) storage.setItem(k, v);
      else mem.set(k, v);
    } catch {
      mem.set(k, v);
    }
  };
  const key = (p: MemoryProduct) => `aura.memoire.${p}`;
  const read = (p: MemoryProduct): MemoryEntry[] => {
    try {
      return JSON.parse(get(key(p)) ?? "[]") as MemoryEntry[];
    } catch {
      return [];
    }
  };
  return {
    name: storage ? "local" : "memoire-vive",
    async list(p) {
      return read(p);
    },
    async put(e) {
      const all = read(e.product).filter((x) => x.id !== e.id);
      all.push(e);
      // Plafond : on garde les 40 dernières versions par projet.
      const versions = all.filter((x) => x.kind === "version");
      const drop = new Set<string>();
      const byProj = new Map<string, MemoryEntry[]>();
      for (const v of versions)
        byProj.set(v.projectId ?? "", [...(byProj.get(v.projectId ?? "") ?? []), v]);
      for (const vs of byProj.values())
        vs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(0, Math.max(0, vs.length - 40))
          .forEach((v) => drop.add(v.id));
      set(key(e.product), JSON.stringify(all.filter((x) => !drop.has(x.id))));
    },
    async remove(p, id) {
      set(key(p), JSON.stringify(read(p).filter((x) => x.id !== id)));
    },
  };
}

/** Stockage Supabase (table aura_memoire, protégée par RLS : chaque utilisateur ne voit que ses lignes). */
export function supabaseBackend(client: SupabaseLike, userId: string): MemoryBackend {
  const t = () => client.from("aura_memoire");
  return {
    name: "supabase",
    async list(product) {
      const { data, error } = await t()
        .select("*")
        .eq("product", product)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        product: r.product as MemoryProduct,
        kind: r.kind as MemoryKind,
        projectId: (r.project_id as string) ?? undefined,
        key: (r.key as string) ?? undefined,
        label: r.label as string,
        payload: r.payload,
        createdAt: r.created_at as string,
      }));
    },
    async put(e) {
      const { error } = await t().upsert({
        id: e.id,
        user_id: userId,
        product: e.product,
        kind: e.kind,
        project_id: e.projectId ?? null,
        key: e.key ?? null,
        label: e.label,
        payload: e.payload ?? null,
        created_at: e.createdAt,
      });
      if (error) throw new Error(error.message);
    },
    async remove(_p, id) {
      const { error } = await t().delete().eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}
// Type minimal du client Supabase (évite de coupler le module au schéma généré).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from: (t: string) => any };

/** Choisit Supabase si configuré et connecté, sinon le stockage local. */
export async function resolveBackend(): Promise<MemoryBackend> {
  const local = memoryStorageBackend(
    typeof window !== "undefined" ? window.localStorage : undefined,
  );
  try {
    const env = import.meta.env ?? {};
    if (
      !env.VITE_SUPABASE_URL ||
      !(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)
    )
      return local;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return local;
    const sb = supabaseBackend(supabase as unknown as SupabaseLike, uid);
    await sb.list("architect"); // vérifie que la table existe (migration appliquée)
    return sb;
  } catch {
    return local;
  }
}

// ── API de haut niveau ───────────────────────────────────────────────────
export class AuraMemory {
  constructor(
    public product: MemoryProduct,
    public backend: MemoryBackend,
  ) {}
  private cache: MemoryEntry[] | null = null;
  private listeners = new Set<() => void>();
  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }

  async all(): Promise<MemoryEntry[]> {
    if (!this.cache) this.cache = await this.backend.list(this.product);
    return this.cache;
  }
  private async add<T>(
    e: Omit<MemoryEntry<T>, "id" | "product" | "createdAt">,
  ): Promise<MemoryEntry<T>> {
    const entry: MemoryEntry<T> = {
      ...e,
      id: newId(),
      product: this.product,
      createdAt: new Date().toISOString(),
    };
    await this.backend.put(entry);
    this.cache = [...(await this.all()).filter((x) => x.id !== entry.id), entry];
    this.emit();
    return entry;
  }
  async forget(id: string) {
    await this.backend.remove(this.product, id);
    this.cache = (await this.all()).filter((x) => x.id !== id);
    this.emit();
  }

  async createProject(name: string) {
    return this.add({ kind: "projet", label: name });
  }
  async projects() {
    return (await this.all()).filter((e) => e.kind === "projet");
  }

  async saveVersion<T>(projectId: string, label: string, payload: T) {
    return this.add<T>({ kind: "version", projectId, label, payload });
  }
  async versions<T>(projectId: string): Promise<MemoryEntry<T>[]> {
    return (await this.all())
      .filter((e) => e.kind === "version" && e.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)) as MemoryEntry<T>[];
  }
  /** Retour arrière : la version choisie redevient la plus récente (l'historique est conservé). */
  async rollback<T>(projectId: string, versionId: string): Promise<MemoryEntry<T> | undefined> {
    const v = (await this.versions<T>(projectId)).find((x) => x.id === versionId);
    if (!v) return undefined;
    return this.saveVersion<T>(projectId, `Retour à : ${v.label}`, v.payload as T);
  }

  async decide(
    subject: string,
    choice: "accepte" | "refuse",
    reason: string,
    projectId?: string,
    extra?: Record<string, unknown>,
  ) {
    return this.add({
      kind: "decision",
      key: subject,
      projectId,
      label: `${choice === "accepte" ? "Accepté" : "Refusé"} : ${subject}${reason ? ` (raison : ${reason})` : ""}`,
      payload: { choice, reason, ...extra },
    });
  }
  async decisions() {
    return (await this.all()).filter((e) => e.kind === "decision");
  }

  async setPreference(key: string, value: string) {
    for (const old of (await this.all()).filter((e) => e.kind === "preference" && e.key === key))
      await this.backend.remove(this.product, old.id);
    this.cache = (await this.all()).filter((e) => !(e.kind === "preference" && e.key === key));
    return this.add({ kind: "preference", key, label: `${key} : ${value}`, payload: value });
  }
  async preference(key: string): Promise<string | undefined> {
    return (await this.all()).find((e) => e.kind === "preference" && e.key === key)?.payload as
      | string
      | undefined;
  }

  /** Résumé en langage naturel pour le contexte de l'agent LLM. */
  async summary(maxItems = 12): Promise<string> {
    return summarizeMemory(await this.all(), maxItems);
  }
}

export function summarizeMemory(entries: MemoryEntry[], maxItems = 12): string {
  const prefs = entries.filter((e) => e.kind === "preference");
  const decs = entries.filter((e) => e.kind === "decision").slice(-maxItems);
  const projs = entries.filter((e) => e.kind === "projet").slice(-3);
  const lines: string[] = [];
  if (prefs.length) lines.push(`Préférences : ${prefs.map((p) => p.label).join(" ; ")}.`);
  const refused = decs.filter((d) => (d.payload as { choice?: string })?.choice === "refuse");
  const accepted = decs.filter((d) => (d.payload as { choice?: string })?.choice === "accepte");
  if (accepted.length)
    lines.push(
      `Tu as déjà retenu : ${accepted.map((d) => d.label.replace(/^Accepté : /, "")).join(" ; ")}.`,
    );
  if (refused.length)
    lines.push(
      `Tu as refusé : ${refused.map((d) => d.label.replace(/^Refusé : /, "")).join(" ; ")}. Ne le repropose pas sans raison nouvelle.`,
    );
  if (projs.length) lines.push(`Projets récents : ${projs.map((p) => p.label).join(", ")}.`);
  return lines.join("\n");
}

const instances = new Map<MemoryProduct, Promise<AuraMemory>>();
/** Mémoire partagée d'un produit (une instance par onglet). */
export function getMemory(product: MemoryProduct): Promise<AuraMemory> {
  let p = instances.get(product);
  if (!p) {
    p = resolveBackend().then((b) => new AuraMemory(product, b));
    instances.set(product, p);
  }
  return p;
}
