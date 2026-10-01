import { createFileRoute } from "@tanstack/react-router";

// Relevé planifié (Vercel Cron ou pg_cron) : deltas légers en journée, complet la nuit.
// Protégé par CRON_SECRET ; ne lit que la configuration enregistrée côté serveur.
export const Route = createFileRoute("/api/integration/cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Non autorisé", { status: 401 });
        const { loadConfig, loadState } = await import("../../../lib/integration/store.server");
        const { syncSetup } = await import("../../../lib/integration/runtime.server");
        const { dueNow } = await import("../../../lib/integration/scheduler");
        const cfg = await loadConfig("default");
        if (!cfg) return Response.json({ ran: false, reason: "aucune configuration" });
        const state = await loadState("default");
        const runs = state?.runs ?? [];
        const lastFull = runs.find(r => r.mode === "full")?.startedAt ?? null;
        const forced = new URL(request.url).searchParams.get("mode");
        const due = forced === "full" ? { mode: "full" as const, reason: "forcé" } : dueNow(new Date(), { at: runs[0]?.startedAt ?? null, mode: runs[0]?.mode ?? null, lastFullAt: lastFull });
        if (!due) return Response.json({ ran: false, reason: "rien à relever maintenant" });
        const s = await syncSetup("default", cfg.setup, due.mode);
        return Response.json({ ran: true, mode: due.mode, reason: due.reason, alerts: s.alerts.length, runs: s.runs.slice(0, 10).map(r => ({ source: r.sourceId, step: r.step, ms: r.durationMs, rows: r.rowsRead, error: r.error })) });
      },
    },
  },
});
