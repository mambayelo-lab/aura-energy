// Shared stores — localStorage + custom events
// Used by: cockpit.tsx (sidebar) + cockpit.workspace.tsx (workspace)

// ── Analyse (dossier d'analyse décisionnelle) ────────────────────────────────
// Une Analyse est le produit du travail de modélisation/simulation.
// Elle n'est pas une "décision prise" mais un dossier structuré, nommé et daté.

export interface AnalyseEntry {
  id: string;
  title: string;
  score: number;
  critCount: number;
  levCount: number;
  date: string; // ISO string
}

const ANALYSE_KEY   = "aura_analyses";
const ANALYSE_EVENT = "aura_analyses_changed";

export function getAnalyses(): AnalyseEntry[] {
  try { return JSON.parse(localStorage.getItem(ANALYSE_KEY) ?? "[]"); }
  catch { return []; }
}

export function saveAnalyse(entry: AnalyseEntry): void {
  const list = getAnalyses().filter(e => e.id !== entry.id);
  localStorage.setItem(ANALYSE_KEY, JSON.stringify([entry, ...list].slice(0, 30)));
  window.dispatchEvent(new CustomEvent(ANALYSE_EVENT));
}

export function deleteAnalyse(id: string): void {
  const list = getAnalyses().filter(e => e.id !== id);
  localStorage.setItem(ANALYSE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(ANALYSE_EVENT));
}

export function onAnalysesChange(cb: () => void): () => void {
  window.addEventListener(ANALYSE_EVENT, cb);
  return () => window.removeEventListener(ANALYSE_EVENT, cb);
}

// ── Compat: ancien historique de décisions (keeped pour rétrocompat) ─────────
/** @deprecated Utilisez AnalyseEntry / saveAnalyse à la place */
export interface DecisionEntry { id: string; label: string; score: number; date: string; }
const KEY = "aura_decision_history";
const EVENT = "aura_decision_history_changed";
export function getHistory(): DecisionEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
}
export function saveDecision(entry: DecisionEntry): void {
  const history = getHistory().filter(e => e.id !== entry.id);
  localStorage.setItem(KEY, JSON.stringify([entry, ...history].slice(0, 20)));
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function onHistoryChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
export function groupedHistory(): { label: string; items: DecisionEntry[] }[] {
  return [];
}
