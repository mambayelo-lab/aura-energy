// Parcours de décision court, identique pour Décider autonome et pour Décider
// lancé depuis une alerte Supply (seul le pré-remplissage change) :
// Question → Options et critères → Résultat → Suivre. Une action principale
// par écran ; les réglages avancés (cadrage guidé, leviers, attitude, treillis)
// sont repliés et ne sont montés qu'à l'ouverture.
import { useEffect, useState, type ReactNode } from "react";
import { audit } from "@/lib/security/use-access";
import type { AtelierSession, AtelierStep } from "../../../lib/v4/atelier-store";
import { addDays, krProgress, krStatus, needsReview, rankOptions, type DecisionFollowUp, type KeyResult, type KrStatus } from "../../../lib/v4/decision-express";

const INDIGO = "#4743E6", NIGHT = "#151D52";

const CSS = `
.dp{font-family:var(--font-body,"Lexend",system-ui);color:${NIGHT}}
.dp h2{font-family:var(--font-display,"Sora",system-ui);font-size:21px;margin:0 0 4px;color:${NIGHT};letter-spacing:-.01em}
.dp h3{font-family:var(--font-display,"Sora",system-ui);font-size:14px;margin:0 0 8px;color:${NIGHT}}
.dp-sub{font-size:13px;color:#5b5f86;margin:0 0 16px}
.dp-card{background:#fff;border:1px solid #e4e3fb;border-radius:14px;padding:16px 18px;margin-bottom:14px}
.dp-steps{display:flex;justify-content:center;gap:6px;margin:0 0 20px;flex-wrap:wrap}
.dp-steps button{display:flex;align-items:center;gap:8px;border:0;background:none;padding:8px 14px;border-radius:999px;font:600 13.5px var(--font-body,system-ui);color:#6b6f93;cursor:pointer}
.dp-steps button i{font-style:normal;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#ecebfb;color:#6b6f93;font-size:12px;font-weight:800}
.dp-steps button.on{background:${INDIGO};color:#fff}
.dp-steps button.on i{background:rgba(255,255,255,.25);color:#fff}
.dp-steps button.done i{background:#16a34a;color:#fff}
.dp-steps span.sep{align-self:center;width:18px;height:2px;background:#e4e3fb;border-radius:2px}
.dp-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px}
.dp-primary{border:0;background:${INDIGO};color:#fff;border-radius:10px;padding:11px 20px;font:700 13px var(--font-body,system-ui);cursor:pointer}
.dp-primary:disabled{opacity:.45;cursor:not-allowed}
.dp-ghost{border:1px solid #d8d6f5;background:#fff;color:${NIGHT};border-radius:10px;padding:8px 14px;font:600 13px var(--font-body,system-ui);cursor:pointer}
.dp-link{border:0;background:none;color:${INDIGO};font:700 13px var(--font-body,system-ui);cursor:pointer;padding:4px 0}
.dp input,.dp select,.dp textarea{font:500 13px var(--font-body,system-ui);border:1px solid #d8d6f5;border-radius:8px;padding:7px 9px;color:${NIGHT};background:#fff;min-width:0}
.dp textarea{width:100%;resize:vertical}
.dp-matrix{width:100%;border-collapse:separate;border-spacing:0 6px}
.dp-matrix th{font-size:12px;font-weight:700;color:#6b6f93;text-align:center;padding:0 6px;vertical-align:bottom}
.dp-matrix th:first-child{text-align:left}
.dp-matrix td{padding:0 4px}
.dp-cell{width:100%;min-width:48px;height:36px;border-radius:9px;border:1.5px solid #e4e3fb;background:#fafaff;font:800 13px var(--font-display,system-ui);cursor:pointer;color:${NIGHT}}
.dp-cell.hyp{border-style:dashed;border-color:#b9b6f3}
.dp-cell.pos{background:#ecebfd;color:${INDIGO}}
.dp-cell.neg{background:#eef0f7;color:${NIGHT}}
.dp-legend{font-size:12.5px;color:#6b6f93;margin:6px 0 0}
.dp-rank{display:flex;flex-direction:column;gap:8px}
.dp-row{display:grid;grid-template-columns:34px minmax(0,1fr) 150px 150px;align-items:center;gap:12px;border:1px solid #e4e3fb;border-radius:12px;padding:10px 14px;background:#fff}
.dp-row.win{border:2px solid ${INDIGO};background:linear-gradient(90deg,#f1f0fe,#fff)}
.dp-row b{font-family:var(--font-display,system-ui);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dp-badge{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#ecebfb;font:800 13px var(--font-display,system-ui);color:${NIGHT}}
.dp-row.win .dp-badge{background:${INDIGO};color:#fff}
.dp-meter{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#6b6f93}
.dp-blocks{display:flex;gap:3px}
.dp-blocks i{flex:1;height:8px;border-radius:4px;background:#ecebfb}
.dp-change{border-left:4px solid ${INDIGO};background:#f5f4ff}
.dp-change p{margin:0;font-size:13px;line-height:1.5}
.dp-kr{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,.6fr)) minmax(0,.9fr) minmax(0,.9fr) 26px;gap:8px;align-items:end;margin-bottom:10px}
.dp-kr label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:#6b6f93;min-width:0}
.dp-gauge{height:10px;border-radius:5px;background:#ecebfb;overflow:hidden;margin:4px 0 2px}
.dp-gauge i{display:block;height:100%;border-radius:5px}
.dp-status{font-size:12.5px;font-weight:800}
.dp-alert{border:1.5px solid #d97706;background:#fff8ed;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}
.dp-tabs{display:flex;gap:2px;align-items:center;flex-wrap:wrap;margin:-6px 0 10px}
.dp-tabs > button{border:0;background:none;padding:4px 10px;border-radius:999px;font:600 12.5px var(--font-body,system-ui);color:#8a8db0;cursor:pointer}
.dp-tabs > button.on{background:#f1f0fd;color:${INDIGO};font-weight:700}
@media(max-width:760px){.dp-row{grid-template-columns:30px minmax(0,1fr)}.dp-row .dp-meter{grid-column:2}.dp-kr{grid-template-columns:1fr 1fr}}
`;

// ── Barre d'étapes (4 étapes) ───────────────────────────────────────────────
export const PARCOURS: { key: AtelierStep; label: string }[] = [
  { key: "comprendre", label: "Comprendre" },
  { key: "impacter", label: "Impacter" },
  { key: "decider", label: "Explorer / Résultat" },
  { key: "suivi", label: "Suivre" },
];
const stepIndex = (s: AtelierStep) => s === "composer" ? 1 : PARCOURS.findIndex(p => p.key === s);

export function ParcoursStepBar({ session, onGo }: { session: AtelierSession; onGo: (s: AtelierStep) => void }) {
  const cur = stepIndex(session.step);
  return (
    <nav className="dp dp-steps" aria-label="Étapes de la décision">
      <style>{CSS}</style>
      {PARCOURS.map((p, i) => (
        <span key={p.key} style={{ display: "contents" }}>
          {i > 0 && <span className="sep" aria-hidden="true" />}
          <button type="button" data-testid={`atelier-step-${p.key}`} aria-current={i === cur ? "step" : undefined} className={i === cur ? "on" : i < cur ? "done" : ""} onClick={() => onGo(p.key)}>
            <i>{i < cur ? "✓" : i + 1}</i>{p.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

// Onglets d'une étape : une vue principale, les autres à un clic (montées à l'ouverture).
export function StepTabs({ tabs, initial, label, footer }: { tabs: { id: string; label: string; render: () => ReactNode }[]; initial: string; label: string; footer?: ReactNode }) {
  const [tab, setTab] = useState(initial);
  const cur = tabs.find(t => t.id === tab) ?? tabs[0];
  return (
    <div className="dp">
      <style>{CSS}</style>
      <div className="dp-tabs" role="tablist" aria-label={label}>
        {tabs.map(t => <button key={t.id} type="button" role="tab" aria-selected={t.id === cur.id} className={t.id === cur.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
        {footer && <span style={{ marginLeft: "auto" }}>{footer}</span>}
      </div>
      <div>{cur.render()}</div>
    </div>
  );
}

type Props = { session: AtelierSession; onUpdate: (p: Partial<AtelierSession>) => void };

// ── 4. Suivre ───────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<KrStatus, string> = { "en avance": "#16a34a", "à l'heure": INDIGO, "en retard": "#d97706" };

export function StepFollow({ session, onUpdate, onRevise, onStart, liveValue }: Props & { onRevise: () => void; onStart: (scenarioId: string) => void; liveValue?: (kr: KeyResult) => number | undefined }) {
  const f = session.followUp;
  // Supply : les valeurs actuelles se relisent depuis les indicateurs.
  useEffect(() => {
    if (!f || !liveValue) return;
    let changed = false;
    const keyResults = f.keyResults.map(kr => { const v = liveValue(kr); if (v !== undefined && v !== kr.current) { changed = true; return { ...kr, current: v }; } return kr; });
    if (changed) onUpdate({ followUp: { ...f, keyResults } });
  }, [f, liveValue]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) {
    const ranked = session.scenarios.length ? rankOptions(session) : [];
    const pick = session.scenarios.find(x => x.id === session.retainedScenarioId) ?? ranked[0];
    return (
      <div className="dp"><style>{CSS}</style><h2>Suivre la décision</h2>
        <p className="dp-sub">{pick ? `Démarrez le suivi de « ${pick.label} » : 1 à 3 résultats clés, une date de revue.` : "Aucune option à suivre pour l'instant."}</p>
        {pick && <button type="button" className="dp-primary" onClick={() => onStart(pick.id)}>Suivre « {pick.label.length > 40 ? `${pick.label.slice(0, 39)}…` : pick.label} » →</button>}
      </div>
    );
  }
  const set = (patch: Partial<DecisionFollowUp>) => onUpdate({ followUp: { ...f, ...patch } });
  const setKr = (id: string, patch: Partial<KeyResult>) => set({ keyResults: f.keyResults.map(k => k.id === id ? { ...k, ...patch } : k) });
  const review = needsReview(f);
  return (
    <div className="dp">
      <style>{CSS}</style>
      <h2>Suivre la décision</h2>
      <p className="dp-sub">Décidé le {new Date(f.decidedAt).toLocaleDateString("fr-FR")} : <strong>{f.label}</strong>{f.journalId ? <> · <a href="/cockpit/resilience?section=cockpit#journal" data-testid="suivi-journal-link" style={{ color: INDIGO, fontWeight: 700 }}>voir dans le journal des décisions Supply →</a></> : ""}</p>
      {review && (
        <div className="dp-alert" role="alert" data-testid="review-alert">
          <span><strong>Réviser la décision ?</strong> {review}</span>
          <button type="button" className="dp-primary" onClick={onRevise}>Réviser la décision</button>
        </div>
      )}
      <div className="dp-card">
        <h3>Résultats clés ({f.keyResults.length}/3)</h3>
        {f.keyResults.map(kr => {
          const st = krStatus(kr, f.decidedAt);
          const p = krProgress(kr);
          return (
            <div key={kr.id} data-testid="key-result" style={{ borderTop: "1px solid #f0effb", paddingTop: 10, marginTop: 6 }}>
              <div className="dp-kr">
                <label>Résultat clé<input aria-label="Libellé du résultat clé" value={kr.label} onChange={e => setKr(kr.id, { label: e.target.value })} /></label>
                <label>Départ<input type="number" aria-label="Valeur de départ" value={kr.start} onChange={e => setKr(kr.id, { start: Number(e.target.value) })} /></label>
                <label>Cible<input type="number" aria-label="Valeur cible" value={kr.target} onChange={e => setKr(kr.id, { target: Number(e.target.value) })} /></label>
                <label>Actuelle<input type="number" aria-label="Valeur actuelle" value={kr.current} disabled={!!kr.kpiId} title={kr.kpiId ? "Relue automatiquement depuis l'indicateur Supply" : undefined} onChange={e => setKr(kr.id, { current: Number(e.target.value) })} /></label>
                <label>Échéance<input type="date" aria-label="Échéance" value={kr.deadline} onChange={e => setKr(kr.id, { deadline: e.target.value })} /></label>
                <label>Responsable<input aria-label="Responsable" value={kr.owner} onChange={e => setKr(kr.id, { owner: e.target.value })} placeholder="Nom" /></label>
                <button type="button" className="dp-link" aria-label={`Retirer ${kr.label}`} onClick={() => set({ keyResults: f.keyResults.filter(k => k.id !== kr.id) })}>×</button>
              </div>
              <div className="dp-gauge" role="img" aria-label={`Avancement ${Math.round(p * 100)} %`}><i style={{ width: `${Math.round(p * 100)}%`, background: STATUS_COLOR[st] }} /></div>
              <span className="dp-status" style={{ color: STATUS_COLOR[st] }}>{st}</span>
              <span className="dp-legend" style={{ marginLeft: 8 }}>{Math.round(p * 100)} % du chemin · {kr.start} → {kr.current} / cible {kr.target} {kr.unit}{kr.kpiId ? " · relu depuis Supply" : ""}</span>
            </div>
          );
        })}
        {f.keyResults.length < 3 && (
          <button type="button" className="dp-link" onClick={() => set({ keyResults: [...f.keyResults, { id: `kr-${Date.now()}`, label: "Nouveau résultat clé", unit: "", start: 0, target: 100, current: 0, deadline: addDays(f.decidedAt, 90), owner: "" }] })}>+ Résultat clé</button>
        )}
      </div>
      <div className="dp-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 700, fontSize: 13.5 }}>Revue de la décision le
          <input type="date" aria-label="Date de revue" value={f.reviewDate} onChange={e => set({ reviewDate: e.target.value })} />
        </label>
        <button type="button" className="dp-ghost" onClick={onRevise}>Réviser maintenant</button>
      </div>
    </div>
  );
}

// « Rapport PDF » : synthèse de la décision (même contenu dans Décider seul et depuis Supply).
export async function makeDecisionReport(session: AtelierSession) {
  const { decisionReport, decisionReportPdf } = await import("../../../lib/v4/decision-report");
  const bytes = await decisionReportPdf(decisionReport(session));
  const slug = (session.title || "decision").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
  return { filename: `rapport-decision-${slug}.pdf`, bytes };
}

export { MiniReportButton } from "./SolidityNote";
export function ReportButton({ session }: { session: AtelierSession }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="dp-ghost" data-testid="report-pdf" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const { filename, bytes } = await makeDecisionReport(session);
        audit("export", "rapport de décision (PDF)");
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } finally { setBusy(false); }
    }}>{busy ? "Rapport…" : "Rapport PDF"}</button>
  );
}

// Basculement discret entre le dialogue « Décider vite » et le parcours détaillé.
export function ModeSwitch({ mode, onChange }: { mode: "dialogue" | "detail"; onChange: (m: "dialogue" | "detail") => void }) {
  return (
    <div className="dp" style={{ display: "flex", justifyContent: "flex-end", margin: "-4px 0 6px" }}>
      <style>{CSS}</style>
      <div className="dp-tabs" role="tablist" aria-label="Mode de Décider" style={{ margin: 0 }}>
        <button type="button" role="tab" aria-selected={mode === "dialogue"} className={mode === "dialogue" ? "on" : ""} onClick={() => onChange("dialogue")}>Dialogue</button>
        <button type="button" role="tab" aria-selected={mode === "detail"} className={mode === "detail" ? "on" : ""} onClick={() => onChange("detail")}>Détail</button>
      </div>
    </div>
  );
}
