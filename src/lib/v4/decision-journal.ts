// decision-journal.ts — Client-side decision journal (localStorage)

export interface JournalDocument {
  name: string;
  summary: string;
}

export interface DecisionRecord {
  id: string;
  savedAt: string;           // ISO date
  playbookIds: string[];
  playbookLabels: string[];
  alertId?: string;
  alertLabel?: string;
  question: string;
  response: string;
  documents?: JournalDocument[];
  notes?: string;
  status: "analyse" | "decision" | "validated";
}

const STORAGE_KEY = "aura_v4_journal_v1";

export function loadJournal(): DecisionRecord[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DecisionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveDecision(record: Omit<DecisionRecord, "id" | "savedAt">): DecisionRecord {
  const full: DecisionRecord = {
    ...record,
    id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
  };
  const journal = loadJournal();
  journal.unshift(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(journal.slice(0, 150)));
  return full;
}

export function deleteDecision(id: string): void {
  const journal = loadJournal().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
}

export function updateDecisionStatus(id: string, status: DecisionRecord["status"], notes?: string): void {
  const journal = loadJournal().map(r =>
    r.id === id ? { ...r, status, ...(notes !== undefined ? { notes } : {}) } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
}

export function formatJournalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Change listeners ──────────────────────────────────────────────────────────
const _listeners = new Set<() => void>();
function _notify() { _listeners.forEach(fn => fn()); }

export function onJournalChange(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

// Monkey-patch save/delete to emit events
const _origSave = saveDecision;
// Override save to also notify
export function saveDecisionAndNotify(record: Omit<DecisionRecord, "id" | "savedAt">): DecisionRecord {
  const r = saveDecision(record);
  _notify();
  window.dispatchEvent(new CustomEvent("aura_journal_change"));
  return r;
}

export function deleteDecisionAndNotify(id: string): void {
  deleteDecision(id);
  _notify();
  window.dispatchEvent(new CustomEvent("aura_journal_change"));
}

// ── Similarity detection ──────────────────────────────────────────────────────
function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-zàâäéèêëîïôùûüç0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter(t => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export interface SimilarDecision {
  record: DecisionRecord;
  score: number; // 0-1 similarity
}

export function findSimilarDecisions(
  question: string,
  journal?: DecisionRecord[],
  topN = 3,
  threshold = 0.08,
): SimilarDecision[] {
  const entries = journal ?? loadJournal();
  if (entries.length === 0) return [];
  const qTokens = tokenize(question);
  return entries
    .map(r => ({ record: r, score: jaccardSimilarity(qTokens, tokenize(r.question)) }))
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ── Share snapshots ───────────────────────────────────────────────────────────
const SHARE_KEY_PREFIX = "aura_share_";

export interface ShareSnapshot {
  token: string;
  createdAt: string;
  title: string;
  playbookLabel?: string;
  playbookIcon?: string;
  playbookColor?: string;
  question: string;
  response: string;
  sharedWith: string[]; // profile names
  status: DecisionRecord["status"];
}

export function createShareSnapshot(data: Omit<ShareSnapshot, "token" | "createdAt">): string {
  const token = `sh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const snap: ShareSnapshot = { ...data, token, createdAt: new Date().toISOString() };
  try {
    localStorage.setItem(SHARE_KEY_PREFIX + token, JSON.stringify(snap));
  } catch { /* quota */ }
  return token;
}

export function loadShareSnapshot(token: string): ShareSnapshot | null {
  try {
    const raw = localStorage.getItem(SHARE_KEY_PREFIX + token);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
