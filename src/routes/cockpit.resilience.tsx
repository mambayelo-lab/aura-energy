import { createFileRoute } from "@tanstack/react-router";
import { ControlTowerShell } from "@/components/aura/ControlTowerShell";

// Route additive : /cockpit/resilience — n'affecte aucune route existante.
// Point d'entrée du scaffold "Supply Chain Resilience Agent" (Cockpit + Décision).
export const Route = createFileRoute("/cockpit/resilience")({
  validateSearch: (s: Record<string, unknown>): { section?: string; sessionId?: string } => ({
    section: typeof s.section === "string" ? s.section : undefined,
    sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Aura Supply Chain" },
      { name: "description", content: "Anticipe les risques fournisseurs et logistiques : délai de survie et délai de reprise par nœud, stress-tests, décisions depuis une alerte ou librement." },
    ],
  }),
  component: ConnectedControlTower,
});

function ConnectedControlTower() {
  return <div style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 0 }}>
    <div style={{ flex: 1, minHeight: 0 }}><ControlTowerShell /></div>
  </div>;
}
