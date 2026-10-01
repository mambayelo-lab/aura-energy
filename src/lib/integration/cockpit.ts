// Alertes d'intégration → alertes du cockpit (même format que les règles du Studio).
// Le cockpit lit l'instantané d'Aura (cache et état stocké), jamais une source.
import type { CatalogueAlert } from "../v4/alert-catalogue";
import type { IntegrationAlert } from "./pipeline";

const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString("fr-FR") : v);

export function toCockpitAlerts(alerts: IntegrationAlert[]): CatalogueAlert[] {
  return alerts.map(a => {
    const values = Object.entries(a.evidence.values).map(([k, v]) => `${k.replace(/_/g, " ")} : ${fmt(v)}`);
    return {
      id: a.id,
      label: a.label,
      sector: "supply-chain",
      signal: `${a.evidence.statement} (source ${a.evidence.source}, au ${a.evidence.asOf})`,
      decisionQuestion: a.decisionQuestion,
      options: a.options,
      recurrence: "à chaque synchronisation",
      severity: a.severity,
      siteLabelExemple: a.subjectLabel,
      expositionExempleEur: 0,
      delaiAvantImpactExemple: "",
      causes: values,
      causalRule: { condition: a.evidence.statement, consequence: a.decisionQuestion },
      variables: Object.keys(a.evidence.values),
      grounded: { sourceRecord: `${a.evidence.source} — ${a.subjectLabel}`, realFields: a.evidence.values },
    };
  });
}

/** Instantané léger publié pour le cockpit (aucune donnée ligne à ligne hors preuve). */
export interface CockpitSnapshot { asOf: string; alerts: IntegrationAlert[]; series: Record<string, { t: string; v: number }[]>; publishedAt: string }
const KEY = "aura.integration.cockpit.v1";
export function saveCockpitSnapshot(s: CockpitSnapshot) { try { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new Event(KEY)); } catch { /* stockage indisponible */ } }
export function loadCockpitSnapshot(): CockpitSnapshot | null { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) as CockpitSnapshot : null; } catch { return null; } }
export function onCockpitSnapshot(fn: () => void) { if (typeof window === "undefined") return () => {}; window.addEventListener(KEY, fn); return () => window.removeEventListener(KEY, fn); }
