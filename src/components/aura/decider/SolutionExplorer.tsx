// « Explorer les solutions » : toutes les combinaisons d'options par levier,
// évaluées par le moteur (forward de la thèse, agrégation max-min, attitude de la
// session). Carte des solutions (profils potentiel × risque, front des
// non-dominées), classement filtrable, plus petit changement et chemin
// d'amélioration depuis la solution actuelle, visibles sur l'arbre.
import { useEffect, useMemo, useState } from "react";
import type { AtelierSession } from "../../../lib/v4/atelier-store";
import { ChangeCard } from "./ChangeCard";
import { comboKey, currentCombo, LEVEL, profileText, type Combo, type ComboResult } from "../../../lib/v4/solution-space";
import { ImpactTree } from "./ImpactTree";

const INDIGO = "#4743E6", NIGHT = "#151D52";
import type { Explored } from "../../../lib/v4/solution.worker-core";

const CSS = `
.sx{font-family:var(--font-body,"Lexend",system-ui);color:${NIGHT};display:flex;flex-direction:column;gap:14px}
.sx-card{background:#fff;border:1px solid #e4e3fb;border-radius:14px;padding:14px 16px}
.sx-card h3{font-family:var(--font-display,"Sora",system-ui);font-size:16px;margin:0 0 8px}
.sx-meta{font-size:13px;color:#5b5f86}
.sx-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:14px}
@media(max-width:1000px){.sx-grid{grid-template-columns:minmax(0,1fr)}}
.sx-list{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}
.sx-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #e4e3fb;border-radius:10px;padding:7px 10px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:inherit}
.sx-row[aria-pressed=true]{border:2px solid ${INDIGO};background:#f5f4ff}
.sx-row.dom{opacity:.55}
.sx-row small{color:#6b6f93;font-size:12px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sx-row b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
.sx-chip{font-size:12px;font-weight:800;border-radius:999px;padding:2px 8px;background:#ecebfb;color:${NIGHT};white-space:nowrap}
.sx-chip.front{background:${INDIGO};color:#fff}
.sx-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.sx-tools input{font:500 13.5px var(--font-body,system-ui);border:1px solid #d8d6f5;border-radius:8px;padding:6px 9px;min-width:0}
.sx-steps{margin:0;padding-left:20px;font-size:14px;line-height:1.6}
.sx-btn{border:0;background:${INDIGO};color:#fff;border-radius:10px;padding:9px 16px;font:700 14px var(--font-body,system-ui);cursor:pointer}
.sx-ghost{border:1px solid #d8d6f5;background:#fff;color:${NIGHT};border-radius:10px;padding:8px 14px;font:600 13px var(--font-body,system-ui);cursor:pointer}
`;

export function SolutionExplorer({ session, onUpdate, onRetain }: { session: AtelierSession; onUpdate: (p: Partial<AtelierSession>) => void; onRetain: (scenarioId: string, patch?: Partial<AtelierSession>) => void }) {
  const [data, setData] = useState<Explored | "calcul">("calcul");
  const [selected, setSelected] = useState<string | null>(null);
  const [cell, setCell] = useState<string | null>(null);
  const [frontOnly, setFrontOnly] = useState(false);
  const [q, setQ] = useState("");
  const modelKey = useMemo(() => JSON.stringify([session.leviersDef, session.criteria, session.attitude, session.scenarios.map(s => s.leviers)]), [session]);

  useEffect(() => {
    setData("calcul");
    let worker: Worker | undefined;
    try { worker = new Worker(new URL("../../../lib/v4/solution.worker.ts", import.meta.url), { type: "module" }); } catch { worker = undefined; }
    if (!worker) { void import("../../../lib/v4/solution.worker-core").then(m => setData(m.exploreAll(session))); return; }
    worker.onmessage = (e: MessageEvent<Explored>) => { setData(e.data); worker?.terminate(); };
    worker.onerror = () => { void import("../../../lib/v4/solution.worker-core").then(m => setData(m.exploreAll(session))); };
    worker.postMessage(JSON.parse(JSON.stringify(session)));
    return () => worker?.terminate();
  }, [modelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data === "calcul") return <div className="sx"><style>{CSS}</style><div className="sx-card"><h3>Explorer les solutions</h3><p className="sx-meta">Évaluation de toutes les combinaisons d'options par le moteur (jusqu'à 10⁶)…</p></div></div>;
  if (!data.results.length) return <div className="sx"><style>{CSS}</style><div className="sx-card"><p className="sx-meta">Ajoutez des leviers et des options dans Impacter pour explorer les solutions.</p></div></div>;

  const front = new Set(data.front);
  const pk = (r: { gPlus: number; dMinus: number }) => `${r.gPlus},${r.dMinus}`;
  const optLabel = new Map(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o.label] as const)));
  const comboText = (c: Combo) => session.leviersDef.map(l => optLabel.get(c[l.id]) ?? "?").join(" · ");
  const counts = new Map(data.counts);
  const needle = q.trim().toLowerCase();
  const list = data.results.filter(r => (!frontOnly || front.has(pk(r))) && (!cell || pk(r) === cell) && (!needle || comboText(r.combo).toLowerCase().includes(needle)));
  const shown = list.slice(0, 60);
  const best = data.results[0];
  const sel = data.results.find(r => r.key === selected) ?? best;
  const from = currentCombo(session);
  const changes = new Map<string, { from: string; to: string }>();
  if (from) for (const l of session.leviersDef) if (from[l.id] !== sel.combo[l.id]) changes.set(l.id, { from: optLabel.get(from[l.id]) ?? "", to: optLabel.get(sel.combo[l.id]) ?? "" });
  const scenarioFor = (c: Combo) => session.scenarios.find(s => comboKey(session, Object.fromEntries(s.leviers.map(l => [l.id, l.valeur]))) === comboKey(session, c));
  const retain = (r: ComboResult) => {
    const existing = scenarioFor(r.combo);
    if (existing) { onRetain(existing.id); return; }
    const id = `sc-x-${Date.now()}`;
    const scenario = { id, label: cut(comboText(r.combo), 60), color: INDIGO, description: "Combinaison trouvée dans l'exploration des solutions.", leviers: session.leviersDef.map(l => ({ id: l.id, label: l.label, valeur: r.combo[l.id], type: l.type })), scores: {}, valeur: 50, faisabilite: 50 };
    onRetain(id, { scenarios: [...session.scenarios, scenario] });
  };

  return (
    <div className="sx" data-testid="solution-explorer">
      <style>{CSS}</style>
      <div className="sx-card">
        <h3>Espace des solutions</h3>
        <p className="sx-meta" data-testid="space-extent">
          {data.evaluated.toLocaleString("fr-FR")} combinaison{data.evaluated > 1 ? "s" : ""} d'options évaluée{data.evaluated > 1 ? "s" : ""} par le moteur de décision sur {data.total.toLocaleString("fr-FR")} ·{" "}
          <strong style={{ color: data.exhaustive ? "#0d7a54" : "#a85d0f" }}>{data.exhaustive ? "calcul exact sur tout l'espace" : "calcul refusé"}</strong> · attitude {session.attitude === "Pessimiste" ? "pessimiste" : "optimiste"}
        </p>
        {data.refused && <p className="sx-meta" role="alert" style={{ color: "#a85d0f" }}>{data.refused}</p>}
      </div>
      <div className="sx-grid">
        <div className="sx-card">
          <h3>Carte des solutions</h3>
          <SolutionMap counts={counts} front={front} best={pk(best)} selected={pk(sel)} cell={cell} onCell={k => { setCell(c => c === k ? null : k); const r = data.results.find(x => pk(x) === k); if (r) setSelected(r.key); }} />
          <p className="sx-meta">Chaque case croise le potentiel (en hauteur) et le risque (en largeur) ; la taille du disque compte les combinaisons qui y aboutissent. En indigo : les meilleurs compromis, qu'aucune autre combinaison ne bat à la fois sur le potentiel et sur le risque. Cliquer une case filtre la liste.</p>
        </div>
        <div className="sx-card">
          <h3>Classement des combinaisons</h3>
          <div className="sx-tools">
            <label style={{ fontSize: 13.5, display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={frontOnly} onChange={e => setFrontOnly(e.target.checked)} /> Meilleurs compromis seulement</label>
            <input aria-label="Filtrer les combinaisons" placeholder="Filtrer par option…" value={q} onChange={e => setQ(e.target.value)} />
            {cell && <button type="button" className="sx-ghost" onClick={() => setCell(null)}>Toutes les cases</button>}
            <span className="sx-meta">{cell ? `${(counts.get(cell) ?? 0).toLocaleString("fr-FR")} dans cette case` : `${list.length.toLocaleString("fr-FR")} affichables`}{list.length > shown.length ? ` · ${shown.length} premières` : ""}</span>
          </div>
          <div className="sx-list" data-testid="solution-list">
            {shown.map(r => {
              const i = data.results.indexOf(r);
              return (
                <button key={r.key} type="button" className={`sx-row${front.has(pk(r)) ? "" : " dom"}`} aria-pressed={r.key === sel.key} onClick={() => setSelected(r.key)} title={comboText(r.combo)}>
                  <span className="sx-chip">{i + 1}</span>
                  <span style={{ minWidth: 0 }}><b>{comboText(r.combo)}</b><small>{profileText(r)}{scenarioFor(r.combo) ? ` · scénario « ${scenarioFor(r.combo)!.label} »` : ""}</small></span>
                  {front.has(pk(r)) && <span className="sx-chip front">meilleur compromis</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="sx-card" data-testid="improvement-path">
        <h3>Comment atteindre la meilleure solution</h3>
        {!from ? <p className="sx-meta">Aucune solution actuelle : composez un scénario.</p> : data.move?.alreadyBest ? (
          <p>Votre solution actuelle atteint déjà le meilleur profil de l'espace ({profileText(best)}).</p>
        ) : data.move ? (
          <>
            <p data-testid="minimal-move">En changeant {data.move.changes.length} levier{data.move.changes.length > 1 ? "s" : ""} ({data.move.changes.map(c => `${c.lever} : ${c.from} → ${c.to}`).join(" ; ")}), votre solution atteint le meilleur profil ({profileText(data.move.reached)}).</p>
            <details className="sx-meta"><summary>Détail technique</summary>{data.move.evaluated.toLocaleString("fr-FR")} combinaisons évaluées par le moteur de décision, {data.move.exhaustive ? "exploration complète" : "dans la limite d'un million d'évaluations"}{data.move.count !== undefined ? ` · ${data.move.count.toLocaleString("fr-FR")} solution${data.move.count > 1 ? "s" : ""} de même taille` : ""}.</details>
            {data.path.length > 1 && <ol className="sx-steps">{data.path.map((s, i) => <li key={i}>{s.lever} : {s.from} → {s.to} <span className="sx-meta">({profileText(s.result)})</span></li>)}</ol>}
          </>
        ) : <p>Aucune combinaison ne fait mieux que la solution actuelle.</p>}
      </div>
      <ChangeCard session={session} result={data.judgment} />
      <div>
        <ImpactTree session={session} readOnly highlight={{ options: new Set(Object.values(sel.combo)), changes }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <span className="sx-meta" style={{ alignSelf: "center" }}>Solution affichée : {profileText(sel)}{sel.key === best.key ? " · meilleure de l'espace" : ""}</span>
          <button type="button" className="sx-btn" onClick={() => retain(sel)}>Retenir cette solution et suivre →</button>
        </div>
      </div>
    </div>
  );
}

const cut = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;

// Carte 4 × 4 des profils : potentiel en ordonnée (H en haut), risque en abscisse (NUL à gauche).
function SolutionMap({ counts, front, best, selected, cell, onCell }: { counts: Map<string, number>; front: Set<string>; best: string; selected: string; cell: string | null; onCell: (k: string) => void }) {
  const S = 74, P = 58;
  const max = Math.max(1, ...counts.values());
  return (
    <svg viewBox={`0 0 ${P + 4 * S + 10} ${4 * S + 44}`} style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto" }} role="group" aria-label="Carte des solutions">
      {[0, 1, 2, 3].map(g => <text key={`g${g}`} x={P - 8} y={10 + (3 - g) * S + S / 2 + 4} textAnchor="end" style={{ fontSize: 12, fontWeight: 700, fill: "#6b6f93" }}>{LEVEL[g]}</text>)}
      {[0, 1, 2, 3].map(d => <text key={`d${d}`} x={P + d * S + S / 2} y={10 + 4 * S + 16} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: "#6b6f93" }}>{LEVEL[d]}</text>)}
      <text x={P + 2 * S} y={10 + 4 * S + 34} textAnchor="middle" style={{ fontSize: 12, fill: "#6b6f93" }}>risque →</text>
      <text x={12} y={10 + 2 * S} textAnchor="middle" transform={`rotate(-90 12 ${10 + 2 * S})`} style={{ fontSize: 12, fill: "#6b6f93" }}>potentiel →</text>
      {[0, 1, 2, 3].flatMap(g => [0, 1, 2, 3].map(d => {
        const k = `${g},${d}`, n = counts.get(k) ?? 0, onFront = front.has(k);
        const x = P + d * S, y = 10 + (3 - g) * S;
        return (
          <g key={k} role={n ? "button" : undefined} tabIndex={n ? 0 : undefined} aria-label={n ? `Potentiel ${LEVEL[g]}, risque ${LEVEL[d]} : ${n} combinaisons${onFront ? ", front" : ""}` : undefined}
            onClick={() => n && onCell(k)} onKeyDown={e => { if (n && e.key === "Enter") onCell(k); }} style={{ cursor: n ? "pointer" : "default" }}>
            <rect x={x + 2} y={y + 2} width={S - 4} height={S - 4} rx={10} style={{ fill: cell === k ? "#ecebfd" : "#fafaff", stroke: k === selected ? INDIGO : "#e4e3fb", strokeWidth: k === selected ? 2.5 : 1 }} />
            {n > 0 && <circle cx={x + S / 2} cy={y + S / 2} r={8 + 22 * Math.sqrt(n / max)} style={{ fill: onFront ? INDIGO : "#c9c8e8", opacity: onFront ? 0.95 : 0.6 }} />}
            {n > 0 && <text x={x + S / 2} y={y + S / 2 + 4.5} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 800, fill: onFront ? "#fff" : NIGHT }}>{n > 999 ? `${Math.round(n / 1000)}k` : n}</text>}
            {k === best && <text x={x + S - 8} y={y + 16} textAnchor="end" style={{ fontSize: 12, fontWeight: 800, fill: INDIGO }}>★</text>}
          </g>
        );
      }))}
    </svg>
  );
}
