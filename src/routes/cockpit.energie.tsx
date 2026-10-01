import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EMBEDDED_SNAPSHOT, HELIADE_PROTOCOLS, readHeliade, type HeliadeRead } from "../lib/energy/heliade";
import { ENERGY_RULES, alertDataMatrix, alertDecisionContext, evaluateEnergyRules, type EnergyAlert } from "../lib/energy/rules";
import { STRATEGIC_EXAMPLES } from "../lib/v4/strategic-examples";

export const Route = createFileRoute("/cockpit/energie")({
  head: () => ({ meta: [{ title: "Aura Énergie" }, { name: "description", content: "Cockpit renouvelables & flexibilité : alertes causales lues dans le SI, décisions ouvertes dans Décider." }] }),
  component: EnergyCockpit,
});

const COLORS: Record<string, string> = { critique: "#c0392b", majeure: "#d68910", mineure: "#5d6d7e" };

function EnergyCockpit() {
  const navigate = useNavigate();
  const [read, setRead] = useState<HeliadeRead>({ snapshot: EMBEDDED_SNAPSHOT, mode: "embarqué" });
  useEffect(() => { readHeliade().then(setRead).catch(() => {}); }, []);
  const alerts = useMemo(() => evaluateEnergyRules(read.snapshot), [read]);
  const s = read.snapshot;

  function decide(text: string, title: string) {
    try {
      const current = JSON.parse(localStorage.getItem("aura.pendingContext.v1") || "[]");
      localStorage.setItem("aura.pendingContext.v1", JSON.stringify([...current, { text }].slice(-12)));
    } catch { /* stockage indisponible : Décider s'ouvre vide */ }
    navigate({ to: "/cockpit/atelier", search: { sessionId: undefined, alertId: undefined, demo: undefined, finalite: "decision", title } });
  }

  const card: React.CSSProperties = { background: "var(--card, #fff)", border: "1px solid #e3e6ea", borderRadius: 12, padding: 16 };
  return (
    <div className="aura-home" style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto", overflowX: "hidden" }}>
      <header style={{ marginBottom: 16 }}>
        <span className="aura-hero-eyebrow">AURA ÉNERGIE · RENOUVELABLES & FLEXIBILITÉ</span>
        <h1 className="aura-hero-title" style={{ margin: "4px 0" }}>Cockpit énergie</h1>
        <p data-testid="energy-source" style={{ margin: 0, color: "#5b6b78" }}>
          Source : SI fictif <strong>Héliade Énergies</strong> ({read.mode === "live" ? `lecture live ${read.url}` : "instantané embarqué"}) · {s.snapshotAt} · {s.referentiel.assets.length} actifs FR/ES/BE/DE.
          Aura lit les valeurs du SI, applique des règles causales et ouvre des décisions ; aucune consigne n'est émise.
        </p>
      </header>

      <section aria-labelledby="alertes" style={{ display: "grid", gap: 12 }}>
        <h2 id="alertes" style={{ margin: "8px 0" }}>Alertes causales ({alerts.length})</h2>
        {alerts.map((a: EnergyAlert) => {
          const r = ENERGY_RULES.find(x => x.id === a.ruleId)!;
          return (
            <article key={a.ruleId + a.objet} data-testid="energy-alert" style={{ ...card, borderLeft: `4px solid ${COLORS[a.gravite]}` }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <strong>{a.ruleId} · {a.label}</strong>
                <span style={{ color: COLORS[a.gravite], fontWeight: 600 }}>{a.gravite}</span>
              </div>
              <p style={{ margin: "6px 0", fontSize: 14 }}><b>SI</b> {r.si} <b>ALORS</b> {r.alors}.</p>
              <p style={{ margin: "6px 0", fontSize: 13, color: "#5b6b78", overflowWrap: "anywhere" }}>
                Valeurs lues ({a.source}) : {Object.entries(a.valeursLues).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k} = ${v}`).join(" · ")}
              </p>
              <p style={{ margin: "6px 0" }}><b>{a.decisionQuestion}</b></p>
              {r.options && <p data-testid="energy-options" style={{ margin: "4px 0", fontSize: 13 }}>Options à comparer : {r.options.join(" · ")}{r.reference ? <> — <i>{r.reference}</i></> : null}</p>}
              <button type="button" className="aura-btn-primary" data-testid="energy-decide" onClick={() => decide(alertDecisionContext(a), `${a.ruleId} · ${a.label}`)}>Ouvrir dans Décider →</button>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="strat" style={{ marginTop: 24 }}>
        <h2 id="strat">Décisions stratégiques</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {STRATEGIC_EXAMPLES.map(e => (
            <button key={e.titre} type="button" data-testid="energy-strategic" style={{ ...card, textAlign: "left", cursor: "pointer" }} title={e.question} onClick={() => decide(e.question, e.titre)}>
              <small>{e.secteur}</small><br /><strong>{e.titre}</strong>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="matrice" style={{ marginTop: 24 }}>
        <h2 id="matrice">Connecteurs Héliade × règles</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: "left" }}>Outil</th><th style={{ textAlign: "left" }}>Protocole</th><th style={{ textAlign: "left" }}>Règles alimentées</th></tr></thead>
            <tbody>{alertDataMatrix().map(m => <tr key={m.outil}><td>{m.outil}</td><td>{HELIADE_PROTOCOLS[m.outil] ?? "REST"}</td><td>{m.regles.join(", ")}</td></tr>)}</tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#5b6b78" }}>SI et données fictifs. Données publiques ENTSO-E (prix, production, indisponibilités) lues par le SI Héliade lorsqu'un jeton est configuré.</p>
      </section>
    </div>
  );
}
