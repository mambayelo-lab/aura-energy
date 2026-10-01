// Rôle courant côté interface : masque ou désactive ce que le rôle n'autorise pas.
// Le serveur refuse de toute façon ; ceci n'est que le reflet dans l'écran.
import { useEffect, useState } from "react";
import { can, type Action } from "./access";
import { getMyAccess, logAudit, type Access } from "./security.functions";

let cached: Promise<Access> | null = null;
const DEMO: Access = { role: "demo", demo: true, orgId: null, orgName: null, email: null };

export function loadAccess(): Promise<Access> {
  cached ??= getMyAccess().catch(() => DEMO);
  return cached;
}
export function resetAccessCache() { cached = null; }

export function useAccess() {
  const [access, setAccess] = useState<Access>(DEMO);
  useEffect(() => { let dead = false; loadAccess().then(a => { if (!dead) setAccess(a); }); return () => { dead = true; }; }, []);
  return { ...access, can: (a: Action) => can(access.role, a) };
}

/** Trace une action dans le journal d'audit (sans bloquer l'écran). */
export function audit(action: string, target = "", details: Record<string, string | number | boolean | null> = {}) {
  if (typeof window === "undefined" || import.meta.env?.MODE === "test") return;
  try { logAudit({ data: { action, target, details } }).catch(() => { /* journal indisponible */ }); } catch { /* journal indisponible */ }
}
