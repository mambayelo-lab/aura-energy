// cockpit.admin-plateforme.tsx — NOUVEAU (lot pilotage de plateforme).
//
// Espace administrateur d'Aura. Une seule lecture serveur agrégée
// (getAdminKpis) : le navigateur ne reçoit que des compteurs, jamais les
// lignes d'usage des autres utilisateurs.
//
// Quatre questions, dans cet ordre :
//   1. Qui utilise Aura, et à quelle fréquence ?
//   2. Que font-ils, et où ?
//   3. Les décisions prises se sont-elles avérées bonnes ?
//   4. Que disent les utilisateurs, et où en est la facturation ?
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getAdminKpis, updateFeedback, type AdminKpis } from "@/lib/platform.functions";
import { useTelemetrie } from "@/components/aura/PlatformKit";

export const Route = createFileRoute("/cockpit/admin-plateforme")({
  component: AdminPlateforme,
  head: () => ({
    meta: [
      { title: "Administration de la plateforme — Aura" },
      { name: "description", content: "Adoption, usage, revues de décision, retours utilisateurs et abonnements de la plateforme Aura." },
      { property: "og:title", content: "Administration de la plateforme — Aura" },
      { property: "og:description", content: "Pilotage de l'adoption et de la qualité des décisions sur Aura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCENT = "#6C5CE7";
const card: React.CSSProperties = {
  border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface)", padding: "16px 18px",
};
const eyebrow: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--v4-text3)",
};
const btnGhost: React.CSSProperties = {
  padding: "5px 9px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
  border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)",
};

const ESPACES: Record<string, string> = {
  decider: "Décider", architecturer: "Architecturer", copilote: "Copilote décisionnel",
  admin: "Administration", vitrine: "Vitrine", autre: "Autre",
};
const VERDICT_LABEL: Record<string, string> = {
  bonne: "Bonne décision", nuancee: "Bonne avec réserves", mauvaise: "Mauvaise décision", trop_tot: "Trop tôt",
};

function Kpi({ label, valeur, note }: { label: string; valeur: string | number; note?: string }) {
  return (
    <div style={card}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, letterSpacing: "-.02em" }}>{valeur}</div>
      {note && <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

/** Courbe d'usage en barres, sans dépendance : 30 derniers jours. */
function Sparkbars({ data }: { data: { jour: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 72, marginTop: 12 }}>
      {data.map((d) => (
        <div key={d.jour} title={`${d.jour} — ${d.n}`} style={{
          flex: 1, minWidth: 3, height: `${Math.max(4, (d.n / max) * 100)}%`,
          background: ACCENT, opacity: 0.75, borderRadius: 6,
        }} />
      ))}
      {data.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucun usage enregistré.</div>}
    </div>
  );
}

function AdminPlateforme() {
  useTelemetrie("admin");
  const load = useServerFn(getAdminKpis);
  const patch = useServerFn(updateFeedback);
  const [k, setK] = useState<AdminKpis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    load().then(setK).catch(() => setErr("Connectez-vous avec un compte administrateur."));
  }, [load]);
  useEffect(refresh, [refresh]);

  if (err) {
    return (
      <div style={{ padding: "26px 30px", maxWidth: 700 }}>
        <div style={{ ...card, borderColor: "#e5b4ae", fontSize: 13, color: "#c0392b" }}>
          {err} <Link to="/auth" style={{ color: ACCENT, fontWeight: 700 }}>Connexion</Link>
        </div>
      </div>
    );
  }
  if (!k) return <div style={{ padding: "26px 30px", fontSize: 13, color: "var(--v4-text3)" }}>Chargement…</div>;

  if (!k.isAdmin) {
    return (
      <div style={{ padding: "26px 30px", maxWidth: 700 }}>
        <div style={{ ...card, fontSize: 13 }}>Cet espace est réservé aux administrateurs de la plateforme.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "26px 30px", maxWidth: 1180 }}>
      <div style={eyebrow}>Administration</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 4px" }}>Pilotage de la plateforme</h1>
      <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "0 0 8px" }}>
        Adoption, usage, qualité des décisions, retours, facturation.
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <Link to="/cockpit/comptes" style={{ ...btnGhost, textDecoration: "none" }}>Comptes et accès</Link>
        <Link to="/cockpit/abonnement" style={{ ...btnGhost, textDecoration: "none" }}>Abonnement</Link>
        <button style={btnGhost} onClick={refresh}>Actualiser</button>
      </div>

      {/* 1. Adoption */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Comptes" valeur={k.utilisateurs.total} note={`+${k.utilisateurs.nouveaux30j} sur 30 jours`} />
        <Kpi label="Actifs 7 jours" valeur={k.utilisateurs.actifs7j} note={`${k.utilisateurs.actifs30j} sur 30 jours`} />
        <Kpi label="Connexions 30 j" valeur={k.usage.connexions30j} />
        <Kpi label="Actions 30 j" valeur={k.usage.evenements30j} />
        <Kpi label="Appels IA 30 j" valeur={k.ia.requetes30j} note={`${k.ia.tokens30j.toLocaleString("fr-FR")} jetons`} />
      </div>

      {/* 2. Usage */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
        <section style={card}>
          <div style={eyebrow}>Usage quotidien — 30 jours</div>
          <Sparkbars data={k.usage.parJour} />
        </section>
        <section style={card}>
          <div style={eyebrow}>Par espace</div>
          <div style={{ marginTop: 10 }}>
            {k.usage.parEspace.map((s) => (
              <div key={s.space} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: "1px solid var(--v4-border)" }}>
                <span>{ESPACES[s.space] ?? s.space}</span><strong>{s.n}</strong>
              </div>
            ))}
            {k.usage.parEspace.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>—</div>}
          </div>
        </section>
      </div>

      {/* 3. Qualité des décisions */}
      <section style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={eyebrow}>Revues de décision</div>
          <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>
            {k.decisions.revuesEnAttente} en attente · {k.decisions.revuesEchues} échues · {k.decisions.total} décisions ouvertes
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {k.decisions.verdicts.map((v) => (
            <div key={v.verdict} style={{ ...btnGhost, cursor: "default" }}>
              {VERDICT_LABEL[v.verdict] ?? v.verdict} · <strong>{v.n}</strong>
            </div>
          ))}
          {k.decisions.verdicts.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucun verdict pour l'instant.</div>}
        </div>
        <div style={{ marginTop: 14 }}>
          {k.revuesRecentes.slice(0, 12).map((r: any) => (
            <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, padding: "7px 0", borderTop: "1px solid var(--v4-border)" }}>
              <span style={{ flex: 1 }}>{r.title}</span>
              <span style={{ color: "var(--v4-text3)" }}>{ESPACES[r.space] ?? r.space}</span>
              <span style={{ color: r.verdict === "mauvaise" ? "#c0392b" : r.verdict ? ACCENT : "var(--v4-text3)", fontWeight: 700 }}>
                {r.verdict ? (VERDICT_LABEL[r.verdict] ?? r.verdict) : `échéance ${String(r.due_at).slice(0, 10)}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Retours et facturation */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={eyebrow}>Retours utilisateurs</div>
            <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>
              {k.retours.nouveaux} nouveaux · note moyenne {k.retours.noteMoyenne ?? "—"}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {k.retours.derniers.map((f: any) => (
              <div key={f.id} style={{ padding: "9px 0", borderTop: "1px solid var(--v4-border)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: "var(--v4-text3)" }}>
                  <span>{String(f.created_at).slice(0, 10)}</span>
                  <span>{ESPACES[f.space] ?? f.space ?? "—"}</span>
                  {f.rating && <span>note {f.rating}/5</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ color: f.status === "new" ? ACCENT : "var(--v4-text3)", fontWeight: 700 }}>{f.status}</span>
                  {f.status === "new" && (
                    <>
                      <button style={btnGhost} onClick={() => patch({ data: { id: f.id, status: "planned" } }).then(refresh)}>À traiter</button>
                      <button style={btnGhost} onClick={() => patch({ data: { id: f.id, status: "done" } }).then(refresh)}>Traité</button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{f.message}</div>
              </div>
            ))}
            {k.retours.derniers.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucun retour pour l'instant.</div>}
          </div>
        </section>

        <section style={card}>
          <div style={eyebrow}>Abonnements</div>
          <div style={{ marginTop: 10 }}>
            {k.abonnements.map((s) => (
              <div key={`${s.plan}-${s.status}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: "1px solid var(--v4-border)" }}>
                <span>{s.plan} · {s.status}</span><strong>{s.n}</strong>
              </div>
            ))}
            {k.abonnements.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>—</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
