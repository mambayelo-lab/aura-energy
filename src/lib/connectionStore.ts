// Shared connection state — localStorage + custom events
// Used by: cockpit.tsx (sidebar) + cockpit.sources.tsx + cockpit.workspace.tsx (bandeau)

export type ConnectionMode = "standalone" | "connected";

export interface ConnectorEntry {
  id: string;
  name: string;
  cat: string;
  icon: string;
  status: "connected" | "available" | "coming";
}

export interface ConnectionState {
  mode: ConnectionMode;
  connectors: ConnectorEntry[];
}

const KEY   = "aura_connection_state";
const EVENT = "aura_connection_changed";

const DEFAULT: ConnectionState = {
  mode: "standalone",
  connectors: [],
};

export function getConnectionState(): ConnectionState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function getConnectedCount(): number {
  return getConnectionState().connectors.filter(c => c.status === "connected").length;
}

export function setConnectionMode(mode: ConnectionMode): void {
  const state = getConnectionState();
  localStorage.setItem(KEY, JSON.stringify({ ...state, mode }));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function connectSource(connector: ConnectorEntry): void {
  const state = getConnectionState();
  const existing = state.connectors.filter(c => c.id !== connector.id);
  const updated: ConnectionState = {
    mode: "connected",
    connectors: [...existing, { ...connector, status: "connected" }],
  };
  localStorage.setItem(KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function disconnectSource(id: string): void {
  const state = getConnectionState();
  const connectors = state.connectors.filter(c => c.id !== id);
  const mode: ConnectionMode = connectors.length === 0 ? "standalone" : "connected";
  localStorage.setItem(KEY, JSON.stringify({ mode, connectors }));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onConnectionChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
