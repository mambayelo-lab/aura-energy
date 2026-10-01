// Arbre d'Impacter : Leviers → Options → Indicateurs, sur le même moteur de
// graphe que Supply (nœuds déplaçables, mise en page mémorisée, Réorganiser).
// Chaque lien option → indicateur porte un niveau d'impact de la thèse
// (NUL < L < M < H) et un sens (favorable / défavorable) : épaisseur = niveau,
// couleur = sens, pointillé = hypothèse d'Aura à confirmer. Un clic sur un
// lien ou une option ouvre le choix du niveau. En mode « lecture », l'arbre
// met en lumière une combinaison (options retenues, indicateurs atteints,
// leviers à faire évoluer).
import { useMemo, useRef, useState } from "react";
import type { AtelierLevierDef, AtelierSession, ImportanceBadge, QualitativeImpact } from "../../../lib/v4/atelier-store";
import { getLeafCriteria } from "../../../lib/v4/atelier-compute";
import { scenariosFromLever, setImpact } from "../../../lib/v4/decision-express";
import { DIAGRAM_CSS, useNodeDrag } from "../studio/SupplyDiagrams";

const INDIGO = "#4743E6", NIGHT = "#151D52", GOOD = "#0d7a54", BAD = "#c0392b";
type Level = 0 | 1 | 2 | 3;
const LEVELS = ["NUL", "L", "M", "H"] as const;
const HELP = "NUL : aucun effet · L : effet faible · M : effet net · H : effet déterminant";
const toLevel = (v: QualitativeImpact | undefined): { level: Level; good: boolean } => {
  switch (v) {
    case "++": return { level: 3, good: true };
    case "+": return { level: 2, good: true };
    case "+L": return { level: 1, good: true };
    case "-L": return { level: 1, good: false };
    case "-": return { level: 2, good: false };
    case "--": return { level: 3, good: false };
    default: return { level: 0, good: true };
  }
};
const fromLevel = (level: Level, good: boolean): QualitativeImpact =>
  level === 0 ? "0" : good ? (["0", "+L", "+", "++"] as const)[level] : (["0", "-L", "-", "--"] as const)[level];
const IMP_SHORT: Record<ImportanceBadge, string> = { Faible: "N", Secondaire: "L", Important: "M", Essentiel: "H" };
const IMPORTANCES: ImportanceBadge[] = ["Essentiel", "Important", "Secondaire", "Faible"];
const cut = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;

const COL = { lev: 16, opt: 300, crit: 690 };
const W = { lev: 230, opt: 250, crit: 330 };
const ROW = 46;

export interface TreeHighlight {
  options: Set<string>;                          // options retenues
  changes?: Map<string, { from: string; to: string }>; // levierId → changement proposé
}

export function ImpactTree({ session, onUpdate, highlight, readOnly = false }: {
  session: AtelierSession; onUpdate?: (p: Partial<AtelierSession>) => void; highlight?: TreeHighlight; readOnly?: boolean;
}) {
  const leaves = useMemo(() => getLeafCriteria(session.criteria), [session.criteria]);
  const parentOf = useMemo(() => {
    const m = new Map<string, string>();
    const walk = (cs: AtelierSession["criteria"], top?: string) => cs.forEach(c => { if (!c.children?.length) { if (top && top !== c.label) m.set(c.id, top); } else walk(c.children, top ?? c.label); });
    walk(session.criteria);
    return m;
  }, [session.criteria]);
  const [sel, setSel] = useState<{ kind: "option" | "edge" | "lever" | "crit"; id: string; crit?: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const saved = session.treeLayout ?? {};
  const update = (p: Partial<AtelierSession>) => onUpdate?.(p);
  const { drag, bind } = useNodeDrag(svgRef,
    (key, dx, dy) => { if (readOnly) return; const p = saved[key] ?? { x: 0, y: 0 }; update({ treeLayout: { ...saved, [key]: { x: Math.round(p.x + dx), y: Math.round(p.y + dy) } } }); },
    key => { const [k, id] = key.split(":"); setSel(s => s?.id === id && s.kind === k ? null : { kind: k as "option" | "lever" | "crit", id }); });
  const off = (key: string) => { const p = saved[key] ?? { x: 0, y: 0 }; return drag?.id === key ? { x: p.x + drag.dx, y: p.y + drag.dy } : p; };

  // Mise en page automatique : options empilées sous leur levier, indicateurs en colonne.
  const optY = new Map<string, number>(), levY = new Map<string, number>();
  let y = 36;
  for (const l of session.leviersDef) {
    const start = y;
    for (const o of l.options) { optY.set(o.id, y + ROW / 2); y += ROW; }
    levY.set(l.id, (start + y) / 2);
    y += 14;
  }
  const critSpacing = Math.max(ROW, (y - 36) / Math.max(1, leaves.length));
  const critY = new Map(leaves.map((c, i) => [c.id, 36 + i * critSpacing + critSpacing / 2]));
  const height = Math.max(y, 36 + leaves.length * critSpacing) + 20;
  const P = (kind: "lev" | "opt" | "crit", id: string, yy: number) => { const o = off(`${kind === "lev" ? "lever" : kind === "opt" ? "option" : "crit"}:${id}`); return { x: COL[kind] + o.x, y: yy + o.y }; };
  const link = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; };

  const hi = highlight?.options;
  const reached = new Set<string>();
  if (hi) for (const l of session.leviersDef) for (const o of l.options) if (hi.has(o.id)) for (const c of leaves) if (toLevel(o.impacts[c.id]).level > 0 && toLevel(o.impacts[c.id]).good) reached.add(c.id);

  // ── édition ──
  const setLevers = (leviersDef: AtelierLevierDef[]) => {
    // Les scénarios gardent une option valide pour chaque levier.
    const scenarios = session.leviersDef.length === 1 && session.scenarios.length === session.leviersDef[0].options.length && leviersDef.length === 1
      ? scenariosFromLever(leviersDef[0])
      : session.scenarios.map(s => ({ ...s, leviers: leviersDef.map(l => { const cur = s.leviers.find(x => x.id === l.id); return cur && l.options.some(o => o.id === cur.valeur) ? cur : { id: l.id, label: l.label, valeur: l.options[0]?.id ?? "", type: l.type }; }).filter(x => x.valeur) }));
    update({ leviersDef, scenarios });
  };
  const addLever = () => {
    const id = `lev-${Date.now()}`;
    setLevers([...session.leviersDef, { id, label: "Nouveau levier", type: "decision", options: [{ id: `${id}-o1`, label: "Option A", impacts: {} }, { id: `${id}-o2`, label: "Option B", impacts: {} }] }]);
    setSel({ kind: "lever", id });
  };
  const leverOf = (optId: string) => session.leviersDef.find(l => l.options.some(o => o.id === optId));
  const optionOf = (optId: string) => leverOf(optId)?.options.find(o => o.id === optId);

  const legend = (
    <span className="sd-legend">
      <span><i style={{ background: GOOD }} />favorable</span>
      <span><i style={{ background: BAD }} />défavorable</span>
      <span>épaisseur = niveau (L, M, H)</span>
      <span>pointillé = à confirmer</span>
    </span>
  );

  return (
    <div className="sd-graph" data-testid="impact-tree">
      <style>{DIAGRAM_CSS}</style>
      <div className="sd-graph-head">
        <b>{readOnly ? "Arbre de la solution" : "Arbre des impacts"}</b>
        <span>{session.leviersDef.length} leviers · {session.leviersDef.reduce((n, l) => n + l.options.length, 0)} options · {leaves.length} indicateurs{readOnly ? "" : " · clic : éditer · glisser : déplacer"}</span>
        {!readOnly && <button type="button" className="sd-link" onClick={addLever}>+ Levier</button>}
        {!readOnly && <button type="button" className="sd-link" disabled={!session.treeLayout} onClick={() => update({ treeLayout: undefined })}>Réorganiser</button>}
        {legend}
      </div>
      <svg ref={svgRef} className="sd-svg" viewBox={`0 0 ${COL.crit + W.crit + 16} ${height}`} role="group" aria-label="Arbre leviers, options et indicateurs" style={{ overflow: "visible" }}>
        {[["LEVIERS", COL.lev], ["OPTIONS", COL.opt], ["INDICATEURS (IMPORTANCE)", COL.crit]].map(([t, x]) => <text key={t as string} x={x as number} y={14} style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", fill: "var(--v4-text3)" }}>{t}</text>)}
        {/* liens levier → option */}
        {session.leviersDef.flatMap(l => l.options.map(o => {
          const a = P("lev", l.id, levY.get(l.id)!), b = P("opt", o.id, optY.get(o.id)!);
          const on = hi?.has(o.id);
          return <path key={`lo-${o.id}`} d={link(a.x + W.lev, a.y, b.x, b.y)} fill="none" style={{ stroke: on ? INDIGO : "var(--v4-border2)", strokeWidth: on ? 2.4 : 1.3, opacity: hi && !on ? 0.35 : 1 }} />;
        }))}
        {/* liens option → indicateur */}
        {session.leviersDef.flatMap(l => l.options.flatMap(o => leaves.map(c => {
          const { level, good } = toLevel(o.impacts[c.id]);
          if (!level) return null;
          const a = P("opt", o.id, optY.get(o.id)!), b = P("crit", c.id, critY.get(c.id)!);
          const hyp = !!o.impactOrigins?.[c.id];
          const faded = hi && !hi.has(o.id);
          const selected = sel?.kind === "edge" && sel.id === o.id && sel.crit === c.id;
          const d = link(a.x + W.opt, a.y, b.x, b.y);
          const open = () => { if (!readOnly) setSel({ kind: "edge", id: o.id, crit: c.id }); };
          return (
            <g key={`oc-${o.id}-${c.id}`}>
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: readOnly ? "default" : "pointer" }} onClick={open} />
              <path d={d} fill="none" onClick={open} data-level={LEVELS[level]} data-sens={good ? "favorable" : "defavorable"}
                style={{ stroke: good ? GOOD : BAD, strokeWidth: [0, 1.6, 3.2, 5][level] + (selected ? 1.5 : 0), strokeDasharray: hyp ? "6 4" : undefined, opacity: faded ? 0.12 : 0.8, cursor: readOnly ? "default" : "pointer" }}>
                <title>{`${o.label} → ${c.label} : ${LEVELS[level]} ${good ? "favorable" : "défavorable"}${hyp ? " (hypothèse Aura, à confirmer)" : ""}`}</title>
              </path>
            </g>
          );
        })))}
        {/* nœuds leviers */}
        {session.leviersDef.map(l => {
          const p = P("lev", l.id, levY.get(l.id)!);
          const ch = highlight?.changes?.get(l.id);
          return (
            <g key={l.id} className="sd-card" role="button" tabIndex={0} aria-label={`Levier ${l.label}`} {...bind(`lever:${l.id}`)} transform={`translate(${p.x - COL.lev} ${p.y - levY.get(l.id)!})`}>
              <rect className="sd-box" x={COL.lev} y={levY.get(l.id)! - 20} width={W.lev} height={40} rx={10} style={{ fill: "var(--v4-surface)", stroke: ch ? INDIGO : "var(--v4-border2)", strokeWidth: ch ? 2.4 : 1.3 }} />
              <text x={COL.lev + 12} y={levY.get(l.id)! + (ch ? -2 : 5)} style={{ fontSize: 13, fontWeight: 800, fill: NIGHT }}>{cut(l.label, 28)}<title>{l.label}</title></text>
              {ch && <text x={COL.lev + 12} y={levY.get(l.id)! + 14} style={{ fontSize: 12, fontWeight: 800, fill: INDIGO }}>{cut(`${ch.from} → ${ch.to}`, 30)}<title>{`${ch.from} → ${ch.to}`}</title></text>}
            </g>
          );
        })}
        {/* nœuds options */}
        {session.leviersDef.flatMap(l => l.options.map(o => {
          const p = P("opt", o.id, optY.get(o.id)!);
          const on = hi?.has(o.id);
          const hyp = Object.keys(o.impactOrigins ?? {}).length > 0;
          return (
            <g key={o.id} className="sd-card" role="button" tabIndex={0} aria-label={`Option ${o.label}`} {...bind(`option:${o.id}`)} transform={`translate(${p.x - COL.opt} ${p.y - optY.get(o.id)!})`} opacity={hi && !on ? 0.4 : 1}>
              <rect className="sd-box" x={COL.opt} y={optY.get(o.id)! - 17} width={W.opt} height={34} rx={17}
                style={{ fill: on ? INDIGO : "var(--v4-surface)", stroke: on ? INDIGO : sel?.id === o.id ? INDIGO : "var(--v4-border2)", strokeWidth: 1.4, strokeDasharray: hyp && !on ? "5 3" : undefined }} />
              <text x={COL.opt + 14} y={optY.get(o.id)! + 4.5} style={{ fontSize: 13, fontWeight: 700, fill: on ? "#fff" : NIGHT }}>{cut(o.label, 30)}<title>{o.label}</title></text>
            </g>
          );
        }))}
        {/* nœuds indicateurs */}
        {leaves.map(c => {
          const p = P("crit", c.id, critY.get(c.id)!);
          const isReached = reached.has(c.id);
          return (
            <g key={c.id} className="sd-card" role="button" tabIndex={0} aria-label={`Indicateur ${c.label}`} {...bind(`crit:${c.id}`)} transform={`translate(${p.x - COL.crit} ${p.y - critY.get(c.id)!})`}>
              <rect className="sd-box" x={COL.crit} y={critY.get(c.id)! - 18} width={W.crit} height={36} rx={10} style={{ fill: isReached ? "#ecebfd" : "var(--v4-surface)", stroke: isReached ? INDIGO : "var(--v4-border2)", strokeWidth: isReached ? 2 : 1.3 }} />
              <text x={COL.crit + 12} y={critY.get(c.id)! + (parentOf.get(c.id) ? -1 : 5)} style={{ fontSize: 13, fontWeight: 700, fill: NIGHT }}>{cut(c.label, 34)}<title>{c.label}</title></text>
              {parentOf.get(c.id) && <text x={COL.crit + 12} y={critY.get(c.id)! + 13} style={{ fontSize: 12, fill: "var(--v4-text3)" }}>{cut(parentOf.get(c.id)!, 38)}</text>}
              <rect x={COL.crit + W.crit - 30} y={critY.get(c.id)! - 11} width={22} height={22} rx={11} style={{ fill: NIGHT }} />
              <text x={COL.crit + W.crit - 19} y={critY.get(c.id)! + 4.5} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "#fff" }}>{IMP_SHORT[c.importance]}<title>{`Importance : ${c.importance}`}</title></text>
            </g>
          );
        })}
      </svg>
      {!readOnly && sel && <Editor session={session} sel={sel} leaves={leaves} update={update} setLevers={setLevers} leverOf={leverOf} optionOf={optionOf} close={() => setSel(null)} />}
    </div>
  );
}

function LevelPicker({ value, onChange, label }: { value: QualitativeImpact | undefined; onChange: (v: QualitativeImpact) => void; label: string }) {
  const { level, good } = toLevel(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} role="group" aria-label={`Impact ${label}`}>
      <span style={{ flex: "1 1 200px", fontWeight: 650, color: NIGHT, minWidth: 0 }}>{label}</span>
      {LEVELS.map((t, i) => (
        <button key={t} type="button" aria-pressed={level === i} onClick={() => onChange(fromLevel(i as Level, good))}
          style={{ minWidth: 44, borderColor: level === i ? INDIGO : undefined, background: level === i ? INDIGO : undefined, color: level === i ? "#fff" : undefined }}>{t}</button>
      ))}
      <button type="button" aria-pressed={good} disabled={level === 0} onClick={() => onChange(fromLevel(level, true))} style={{ color: good && level ? GOOD : undefined, borderColor: good && level ? GOOD : undefined }}>favorable</button>
      <button type="button" aria-pressed={!good && level > 0} disabled={level === 0} onClick={() => onChange(fromLevel(level, false))} style={{ color: !good && level ? BAD : undefined, borderColor: !good && level ? BAD : undefined }}>défavorable</button>
    </div>
  );
}

function Editor({ session, sel, leaves, update, setLevers, leverOf, optionOf, close }: {
  session: AtelierSession; sel: { kind: string; id: string; crit?: string }; leaves: AtelierSession["criteria"];
  update: (p: Partial<AtelierSession>) => void; setLevers: (l: AtelierLevierDef[]) => void;
  leverOf: (optId: string) => AtelierLevierDef | undefined; optionOf: (optId: string) => AtelierLevierDef["options"][number] | undefined; close: () => void;
}) {
  const help = <small style={{ color: "var(--v4-text3)" }}>{HELP}. Le sens dit si l'option améliore (favorable) ou dégrade (défavorable) l'indicateur.</small>;
  if (sel.kind === "edge" || sel.kind === "option") {
    const o = optionOf(sel.id);
    const lev = leverOf(sel.id);
    if (!o || !lev) return null;
    const crits = sel.kind === "edge" ? leaves.filter(c => c.id === sel.crit) : leaves;
    return (
      <div className="sd-panel" style={{ marginTop: 10 }} aria-label={`Impacts de ${o.label}`}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label="Nom de l'option" value={o.label} onChange={e => setLevers(session.leviersDef.map(l => l.id !== lev.id ? l : { ...l, options: l.options.map(x => x.id === o.id ? { ...x, label: e.target.value } : x) }))} style={{ fontWeight: 800, minWidth: 220 }} />
          <small>levier « {lev.label} »</small>
          <button type="button" className="sd-link" style={{ marginLeft: "auto", color: "#b91c1c" }} disabled={lev.options.length <= 1} onClick={() => { setLevers(session.leviersDef.map(l => l.id !== lev.id ? l : { ...l, options: l.options.filter(x => x.id !== o.id) })); close(); }}>Supprimer l'option</button>
          <button type="button" className="sd-link" onClick={close} aria-label="Fermer">×</button>
        </div>
        {help}
        {crits.map(c => (
          <LevelPicker key={c.id} label={c.label} value={o.impacts[c.id]} onChange={v => update(setImpact(session, o.id, c.id, v))} />
        ))}
      </div>
    );
  }
  if (sel.kind === "lever") {
    const lev = session.leviersDef.find(l => l.id === sel.id);
    if (!lev) return null;
    const setLev = (patch: Partial<AtelierLevierDef>) => setLevers(session.leviersDef.map(l => l.id === lev.id ? { ...l, ...patch } : l));
    return (
      <div className="sd-panel" style={{ marginTop: 10 }} aria-label={`Levier ${lev.label}`}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label="Nom du levier" value={lev.label} onChange={e => setLev({ label: e.target.value })} style={{ fontWeight: 800, minWidth: 220 }} />
          <button type="button" className="sd-link" onClick={() => setLev({ options: [...lev.options, { id: `${lev.id}-o${Date.now()}`, label: "Nouvelle option", impacts: {} }] })}>+ Option</button>
          <button type="button" className="sd-link" style={{ marginLeft: "auto", color: "#b91c1c" }} disabled={session.leviersDef.length <= 1} onClick={() => { setLevers(session.leviersDef.filter(l => l.id !== lev.id)); close(); }}>Supprimer le levier</button>
          <button type="button" className="sd-link" onClick={close} aria-label="Fermer">×</button>
        </div>
        <ul>{lev.options.map(o => <li key={o.id}>{o.label}</li>)}</ul>
      </div>
    );
  }
  const c = leaves.find(x => x.id === sel.id);
  if (!c) return null;
  const setCrit = (patch: Partial<AtelierSession["criteria"][number]>) => {
    const walk = (cs: AtelierSession["criteria"]): AtelierSession["criteria"] => cs.map(x => x.id === c.id ? { ...x, ...patch, locked: true } : x.children ? { ...x, children: walk(x.children) } : x);
    update({ criteria: walk(session.criteria) });
  };
  return (
    <div className="sd-panel" style={{ marginTop: 10 }} aria-label={`Indicateur ${c.label}`}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input aria-label="Nom de l'indicateur" value={c.label} onChange={e => setCrit({ label: e.target.value })} style={{ fontWeight: 800, minWidth: 220 }} />
        <label>Importance <select aria-label={`Importance de ${c.label}`} value={c.importance} onChange={e => setCrit({ importance: e.target.value as ImportanceBadge })}>{IMPORTANCES.map(i => <option key={i} value={i}>{i} ({IMP_SHORT[i]})</option>)}</select></label>
        <button type="button" className="sd-link" onClick={close} aria-label="Fermer" style={{ marginLeft: "auto" }}>×</button>
      </div>
      {session.leviersDef.flatMap(l => l.options).map(o => (
        <LevelPicker key={o.id} label={o.label} value={o.impacts[c.id]} onChange={v => update(setImpact(session, o.id, c.id, v))} />
      ))}
    </div>
  );
}
