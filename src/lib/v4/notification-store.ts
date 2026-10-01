// notification-store.ts — in-memory + localStorage notification history

// Forme minimale d'une alerte, reprise localement — l'ancien référentiel de
// playbooks EA (decideur-data.ts) qui la définissait a été retiré, jamais
// consommé ailleurs que par ce type.
interface BriefAlert {
  id: string;
  label: string;
  domain: string;
  severity: "critical" | "warning" | "info";
  description: string;
  source: string;
  priority: "haute" | "moyenne" | "basse";
  trend: number[];
}

export interface AuraNotification {
  id: string;
  type: "new_signal" | "brief_update" | "decision_validated" | "plan_step";
  title: string;
  body: string;
  read: boolean;
  timestamp: string; // ISO
  alertId?: string;
  data?: unknown;
}

const KEY = "aura-v4-notifications";
const listeners = new Set<() => void>();

export function loadNotifications(): AuraNotification[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as AuraNotification[];
  } catch {
    return [];
  }
}

function persist(records: AuraNotification[]) {
  // Keep last 50 notifications
  localStorage.setItem(KEY, JSON.stringify(records.slice(0, 50)));
  listeners.forEach(fn => fn());
}

export function addNotification(n: Omit<AuraNotification, "id" | "read" | "timestamp">): AuraNotification {
  const record: AuraNotification = {
    ...n,
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    read: false,
    timestamp: new Date().toISOString(),
  };
  persist([record, ...loadNotifications()]);
  return record;
}

export function markRead(id: string) {
  persist(loadNotifications().map(n => n.id === id ? { ...n, read: true } : n));
}

export function markAllRead() {
  persist(loadNotifications().map(n => ({ ...n, read: true })));
}

export function unreadCount(): number {
  return loadNotifications().filter(n => !n.read).length;
}

export function onNotificationsChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function notificationFromAlert(alert: BriefAlert): Omit<AuraNotification, "id" | "read" | "timestamp"> {
  return {
    type: "new_signal",
    title: alert.label,
    body: alert.description,
    alertId: alert.id,
    data: alert,
  };
}
