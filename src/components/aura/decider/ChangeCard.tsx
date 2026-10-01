// « Ce qui ferait changer la décision » : le plus petit changement (recherche
// exhaustive, jugée par le moteur) montré sans jargon. À gauche le classement
// actuel, au centre le changement en langage simple avec une jauge à 4 crans
// (NUL, Faible, Moyen, Élevé), à droite le nouveau classement où le gagnant
// monte. Plusieurs changements : étapes numérotées. Rien ne bascule : badge
// « Décision robuste ». Le détail technique reste replié.
import { useEffect, useState } from "react";
import type { AtelierSession, ImportanceBadge, QualitativeImpact } from "../../../lib/v4/atelier-store";
import { applyBackward, backwardSmallestChange, rankOptions, type BackwardChange, type BackwardResult } from "../../../lib/v4/decision-express";

const INDIGO = "#4743E6", NIGHT = "#151D52", GOOD = "#0d7a54", BAD = "#c0392b";
const CRANS = ["NUL", "Faible", "Moyen", "Élevé"];
const IMP_CRAN: Record<ImportanceBadge, number> = { Faible: 0, Secondaire: 1, Important: 2, Essentiel: 3 };
const NOTE: Record<QualitativeImpact, { cran: number; good: boolean }> = {
  "--": { cran: 3, good: false }, "-": { cran: 2, good: false }, "-L": { cran: 1, good: false }, "0": { cran: 0, good: true },
  "+L": { cran: 1, good: true }, "+": { cran: 2, good: true }, "++": { cran: 3, good: true }, U: { cran: 0, good: true },
};

export function changeText(c: BackwardChange): string {
  if (c.kind === "importance") return `Si l'importance de « ${c.criterion} » passe de ${CRANS[IMP_CRAN[c.from as ImportanceBadge]]} à ${CRANS[IMP_CRAN[c.to as ImportanceBadge]]}`;
  const a = NOTE[c.from as QualitativeImpact], b = NOTE[c.to as QualitativeImpact];
  const say = (x: { cran: number; good: boolean }) => x.cran === 0 ? "sans effet" : `${CRANS[x.cran].toLowerCase()}${x.good ? " et favorable" : " et défavorable"}`;
  return `Si l'effet de « ${c.option} » sur « ${c.criterion} » devient ${say(b)} (au lieu de ${say(a)})`;
}

const CSS = `
.cc small{font-size:12px}
.cc{border:1px solid #e4e3fb;border-radius:14px;background:#fff;padding:14px 16px;font-family:var(--font-body,"Lexend",system-ui);color:${NIGHT}}
.cc h3{font:700 16px var(--font-display,"Sora",system-ui);margin:0 0 4px}
.cc-lead{font-size:14px;margin:0 0 12px;color:#3b3f68}
.cc-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,1.1fr) minmax(0,1fr);gap:12px;align-items:center}
@media(max-width:820px){.cc-grid{grid-template-columns:minmax(0,1fr)}}
.cc-col h4{margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6f93}
.cc-row{display:flex;align-items:center;gap:8px;border:1px solid #ecebfb;border-radius:9px;padding:6px 9px;margin-bottom:5px;font-size:13.5px;background:#fff}
.cc-row b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.cc-row i{font-style:normal;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#ecebfb;font-size:12px;font-weight:800;flex:none}
.cc-row.win{border-color:${INDIGO};background:#f5f4ff}
.cc-row.win i{background:${INDIGO};color:#fff}
.cc-row.up{animation:cc-up .9s ease-out both}
@keyframes cc-up{0%{transform:translateY(22px);opacity:.3}100%{transform:none;opacity:1}}
@media (prefers-reduced-motion: reduce){.cc-row.up{animation:none}}
.cc-mid{display:flex;flex-direction:column;gap:10px;align-items:stretch}
.cc-step{border:1.5px solid ${INDIGO};border-radius:12px;padding:9px 11px;background:#f7f7ff;font-size:13.5px;line-height:1.45}
.cc-step small{display:block;color:#6b6f93;margin-top:4px}
.cc-arrow{text-align:center;font-size:22px;color:${INDIGO};line-height:1}
.cc-gauge{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:6px}
.cc-gauge span{font-size:12px;text-align:center;border-radius:6px;padding:3px 0;background:#ecebfb;color:#6b6f93;font-weight:700}
.cc-gauge span.from{background:#fff;border:1.5px dashed #9ea3d6;color:${NIGHT}}
.cc-gauge span.to{background:${INDIGO};color:#fff}
.cc-robust{display:inline-flex;align-items:center;gap:8px;background:#ecfdf5;color:${GOOD};border-radius:999px;padding:5px 12px;font-weight:800;font-size:13.5px;margin-bottom:6px}
.cc details{margin-top:10px;font-size:12.5px;color:#6b6f93}
.cc summary{cursor:pointer;font-weight:700}
`;

function Gauge({ from, to, good }: { from: number; to: number; good?: boolean }) {
  return (
    <div className="cc-gauge" role="img" aria-label={`De ${CRANS[from]} à ${CRANS[to]}`}>
      {CRANS.map((c, i) => <span key={c} className={i === to ? "to" : i === from ? "from" : ""} style={i === to && good === false ? { background: BAD } : undefined}>{c}</span>)}
    </div>
  );
}

export function ChangeCard({ session, result, onHighlight }: { session: AtelierSession; result?: BackwardResult | null | "calcul"; onHighlight?: (changes: BackwardChange[]) => void }) {
  // Calcul hors du fil principal si aucun résultat n'est fourni.
  const [own, setOwn] = useState<BackwardResult | null | "calcul">("calcul");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (result !== undefined) return;
    setOwn("calcul"); setProgress(0);
    let worker: Worker | undefined;
    try { worker = new Worker(new URL("../../../lib/v4/backward.worker.ts", import.meta.url), { type: "module" }); } catch { worker = undefined; }
    if (!worker) { const t = setTimeout(() => setOwn(backwardSmallestChange(session)), 20); return () => clearTimeout(t); }
    worker.onmessage = (e: MessageEvent<{ result?: BackwardResult | null; progress?: number }>) => {
      if (e.data.progress !== undefined) { setProgress(e.data.progress); return; }
      setOwn(e.data.result ?? null); worker?.terminate();
    };
    worker.onerror = () => setOwn(backwardSmallestChange(session));
    worker.postMessage({ id: Date.now(), session: JSON.parse(JSON.stringify(session)) });
    return () => worker?.terminate();
  }, [session, result]);
  const b = result !== undefined ? result : own;
  useEffect(() => { if (b && b !== "calcul" && b.found) onHighlight?.(b.changes); }, [b]); // eslint-disable-line react-hooks/exhaustive-deps

  const before = rankOptions(session);
  if (before.length < 2) return null;
  if (b === "calcul") return <div className="cc" data-testid="change-card"><style>{CSS}</style><h3>Ce qui ferait changer la décision</h3><p className="cc-lead">Aura cherche le plus petit changement qui modifierait le choix…</p><div role="progressbar" aria-label="Avancement du calcul" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} data-testid="change-progress" style={{ height: 6, borderRadius: 3, background: "#e7e6fb", overflow: "hidden", marginTop: 8 }}><div style={{ width: `${Math.max(4, Math.round(progress * 100))}%`, height: "100%", background: "#4743E6", transition: "width .2s" }} /></div></div>;
  if (!b) return null;
  const after = b.found ? rankOptions({ ...session, ...applyBackward(session, b.changes) }) : before;
  const lead = b.found
    ? `« ${b.winner} » passerait devant « ${b.before} » ${b.changes.length > 1 ? `avec ${b.changes.length} changements` : "avec un seul changement"}${b.count && b.count > 1 ? ` (${b.count.toLocaleString("fr-FR")} façons ; voici la plus proche)` : ""}.`
    : `« ${before[0].label} » reste en tête même si l'on modifie un jugement : c'est un choix solide.`;
  const list = (rows: typeof before, win: string, animate: boolean) => rows.slice(0, 5).map(r => (
    <div key={r.id} className={`cc-row${r.id === win ? " win" : ""}${animate && r.id === win ? " up" : ""}`}><i>{r.rank}</i><b title={r.label}>{r.label}</b></div>
  ));
  return (
    <div className="cc" data-testid="change-card">
      <style>{CSS}</style>
      <h3>Ce qui ferait changer la décision</h3>
      {!b.found && <div className="cc-robust" data-testid="robust-badge">✓ Décision robuste</div>}
      <p className="cc-lead" data-testid="change-lead">{lead}</p>
      {b.found && (
        <div className="cc-grid">
          <div className="cc-col"><h4>Aujourd'hui</h4>{list(before, before[0].id, false)}</div>
          <div className="cc-mid">
            {b.changes.map((c, i) => {
              const imp = c.kind === "importance";
              const from = imp ? IMP_CRAN[c.from as ImportanceBadge] : NOTE[c.from as QualitativeImpact].cran;
              const to = imp ? IMP_CRAN[c.to as ImportanceBadge] : NOTE[c.to as QualitativeImpact].cran;
              return (
                <div key={i} className="cc-step" title={`${imp ? "Importance du critère" : "Effet de l'option sur le critère"} : cran actuel en pointillé, cran nécessaire en plein.`}>
                  {b.changes.length > 1 && <strong>{i + 1}. </strong>}{changeText(c)}
                  <Gauge from={from} to={to} good={imp ? undefined : NOTE[c.to as QualitativeImpact].good} />

                </div>
              );
            })}
            <div className="cc-arrow" aria-hidden="true">→</div>
          </div>
          <div className="cc-col"><h4>Après ce changement</h4>{list(after, b.winnerId!, true)}</div>
        </div>
      )}
      <details>
        <summary>Détail technique</summary>
        {b.evaluated.toLocaleString("fr-FR")} combinaisons de jugements évaluées par le moteur de décision, {b.complete ? "exploration complète" : "dans la limite d'un million d'évaluations"}. {b.found ? `Aucun changement plus petit (${b.minSize} modification${(b.minSize ?? 0) > 1 ? "s" : ""}) ne fait basculer le choix.` : ""}
      </details>
    </div>
  );
}
