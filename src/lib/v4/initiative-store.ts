// initiative-store.ts — localStorage persistence for validated decisions

// Forme reprise localement — l'ancien référentiel de playbooks EA
// (decideur-data.ts) qui la définissait a été retiré ; ce store ne fait que
// la persister, jamais l'interpréter.
interface InitiativeLevier {
  label: string;
  valeur: string;
  impact: string;
  level: number;
  scores: { cout: number; delai: number; qualite: number; risque: number; valeur: number; faisabilite: number };
  valeurDelta: number;
  faisabiliteDelta: number;
}
export interface InitiativeRecord {
  id: string;
  alertId: string;
  alertLabel: string;
  alertDomain: string;
  scenarioId: string;
  scenarioLabel: string;
  scenarioDescription: string;
  impact_eur: string;
  levels: Record<string, number>;
  leviers: InitiativeLevier[];
  validatedAt: string;
  status: "en_cours" | "terminee" | "suspendue";
  planChecked: boolean[];
}

const KEY = "aura-v4-initiatives";
const listeners = new Set<() => void>();

export function loadInitiatives(): InitiativeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as InitiativeRecord[];
  } catch {
    return [];
  }
}

function persist(records: InitiativeRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
  listeners.forEach(fn => fn());
}

export function saveInitiative(r: InitiativeRecord): void {
  const list = loadInitiatives().filter(x => x.id !== r.id);
  persist([r, ...list]);
}

export function updateInitiative(id: string, patch: Partial<InitiativeRecord>): void {
  persist(loadInitiatives().map(r => r.id === id ? { ...r, ...patch } : r));
}

export function deleteInitiative(id: string): void {
  persist(loadInitiatives().filter(r => r.id !== id));
}

export function onInitiativesChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
