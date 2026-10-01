// Accès juste-à-temps aux identifiants.
// La configuration ne contient que des références {{env:NOM}} (Vercel → Settings →
// Environment Variables). Elles ne sont résolues qu'à l'ouverture d'une session de
// synchronisation ou de drill-down, gardées en mémoire le temps de la session, puis
// effacées. Aucune connexion permanente n'est ouverte ; les jetons courts (OAuth)
// sont redemandés à chaque session.

export class MissingSecretError extends Error {}

export function resolveRefs<T>(value: T, env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}): T {
  const missing: string[] = [];
  const sub = (x: string) => x.replace(/\{\{env:([A-Z0-9_]+)\}\}/g, (_, n: string) => { const v = env[n]; if (v === undefined) missing.push(n); return v ?? ""; });
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return sub(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(value) as T;
  if (missing.length) throw new MissingSecretError(`Variable(s) d'environnement absente(s) côté serveur : ${[...new Set(missing)].join(", ")}. Ajoutez-la(les) dans Vercel (Settings → Environment Variables).`);
  return out;
}

/** Un champ contient-il un secret littéral (au lieu d'une référence {{env:…}}) ? */
export function literalSecretFields(params: Record<string, unknown>): string[] {
  const secretish = /(password|secret|token|apikey|api_key|privatekey|authorization|key)$/i;
  const out: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string") { if (secretish.test(path.split(".").at(-1) ?? "") && v && !/^\{\{env:[A-Z0-9_]+\}\}$/.test(v.replace(/^(Bearer|Basic) /, ""))) out.push(path); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(params, "");
  return out;
}

export interface CredentialSession<P> { params: P; openedAt: number; close(): void; readonly closed: boolean }

/** Ouvre une session : les secrets sont résolus maintenant et effacés à la fermeture. */
export function openCredentialSession<P extends Record<string, unknown>>(params: P, env?: Record<string, string | undefined>): CredentialSession<P> {
  let resolved: P | null = resolveRefs(params, env);
  return {
    get params() { if (!resolved) throw new Error("Session d'identifiants fermée : rouvrir une fenêtre de synchronisation."); return resolved; },
    openedAt: Date.now(),
    close() { resolved = null; },
    get closed() { return resolved === null; },
  };
}
