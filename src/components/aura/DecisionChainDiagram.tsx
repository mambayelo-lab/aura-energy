/**
 * DecisionChainDiagram v3
 * 6 colonnes : Options → Leviers → TPM → MOP → MOE → Objectif
 * Agrégation visible : impacts sur TPM, agrégés en MOP, agrégés en MOE.
 * Mode arbre actif quand `critTree` est fourni ; fallback flat sinon.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChainCrit {
  id: string;
  label: string;
  w: number;
  importance: string;
  description?: string;
  source?: "playbook" | "doors" | "catia" | "document";
}

/** Nœud hiérarchique (MOE > MOP > TPM) */
export interface CritNode {
  id: string;
  label: string;
  w: number;           // 0–1 (poids normalisé)
  importance?: string;
  description?: string;
  children?: CritNode[];
}

export interface ChainOption {
  label: string;
  worthIndex?: number;
  score?: number;
}

export interface ChainLev {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  options: ChainOption[];
  description?: string;
  source?: "playbook" | "doors" | "catia";
}

export interface ChainInteraction {
  i: string;
  j: string;
  coeff: number;
}

export interface ChainObjective {
  label: string;
  critIds: string[];
}

export interface DecisionChainProps {
  mission?: string;
  objectives?: ChainObjective[];
  crits: ChainCrit[];          // flat list (fallback / compat)
  /** Hiérarchie MOE→MOP→TPM — active le mode 6 colonnes */
  critTree?: CritNode[];
  levs: ChainLev[];
  impacts: Record<string, Record<string, Record<string, number>>>;
  interactions?: ChainInteraction[];
  color: string;
  gradient?: [string, string];
  importSources?: ImportSource[];
  selectedOptions?: Record<string, string>;
  score?: number;
  onCritEdit?: (id: string, field: "label" | "w", value: string | number) => void;
  onOptionSelect?: (levId: string, option: string) => void;
  onWeightChange?: (critId: string, newPct: number) => void;
  blueprintCrits?: Record<string, string>;
  height?: number;
  showWeightPct?: boolean;
}

export interface ImportSource {
  id: string;
  label: string;
  type: "doors" | "catia" | "sap" | "document" | "playbook";
  status: "connected" | "mock" | "partial";
  extractedCount: number;
  lastSync?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Flat mode column X
const OPT_X  = 20;
const LEV_X  = 175;
const CRIT_X = 360;
const OBJ_X  = 570;

// Tree mode column X (6 colonnes)
const T_OPT_X = 20;
const T_LEV_X = 140;
const T_TPM_X = 280;
const T_MOP_X = 415;
const T_MOE_X = 540;
const T_OBJ_X = 665;

const OPT_W  = 120; const OPT_H  = 26;
const LEV_W  = 135; const LEV_H  = 38;
const CRIT_W = 145; const CRIT_H = 36;
const OBJ_R  = 54;

const SOURCE_COLORS: Record<string, string> = {
  doors:    "#7c3aed",
  catia:    "#0ea5e9",
  sap:      "#3b82f6",
  document: "#10b981",
  playbook: "#6366f1",
};

const SOURCE_ICONS: Record<string, string> = {
  doors: "D", catia: "C", sap: "S", document: "📄", playbook: "P",
};

const IMP_COLORS: Record<string, string> = {
  Critique:  "#ef4444",
  Important: "#f59e0b",
  Utile:     "#10b981",
};

const LEVEL_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa"]; // MOE, MOP, TPM

// ── Utility ───────────────────────────────────────────────────────────────────

function cubicBezier(x1: number, y1: number, x2: number, y2: number): string {
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

function impactColor(v: number): string {
  if (v >= 70) return "#10b981";
  if (v >= 40) return "#f59e0b";
  if (v > 0)   return "#6366f1";
  return "#d1d5db";
}

function scoreColor(s: number): string {
  return s >= 70 ? "#16a34a" : s >= 50 ? "#d97706" : "#dc2626";
}

// ── Flatten tree helpers ──────────────────────────────────────────────────────

interface FlatNode extends CritNode { _depth: number; _parentId?: string; }

function flattenTree(nodes: CritNode[], depth = 0, parentId?: string): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    out.push({ ...n, _depth: depth, _parentId: parentId });
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1, n.id));
  }
  return out;
}

// ── Score ring mini ───────────────────────────────────────────────────────────

function ScoreRing({ cx, cy, r, score, color }: { cx: number; cy: number; r: number; score: number; color: string }) {
  const circ = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const sc    = scoreColor(score);
  return (
    <g style={{ transition: "all .5s" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={sc} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray .6s ease" }} />
      <circle cx={cx} cy={cy} r={r - 10} fill={`${color}10`} stroke={`${color}20`} strokeWidth={1} />
    </g>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DecisionChainDiagram({
  mission,
  objectives = [],
  crits,
  critTree,
  levs,
  impacts,
  interactions = [],
  color,
  gradient,
  importSources = [],
  selectedOptions = {},
  score,
  onOptionSelect,
  onWeightChange,
  blueprintCrits = {},
  height = 560,
  showWeightPct = true,
}: DecisionChainProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW]       = useState(900);
  const [tooltip, setTooltip]             = useState<{ x: number; y: number; text: string } | null>(null);
  const [highlightId, setHighlightId]     = useState<string | null>(null);
  const [highlightLev, setHighlightLev]   = useState<string | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      setContainerW(entries[0]?.contentRect.width ?? 900);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const objLabel = objectives.length > 0 ? objectives[0].label : (mission ?? "Objectif de décision");
  const g0 = gradient?.[0] ?? color;
  const g1 = gradient?.[1] ?? color;
  const scoreVal = score ?? 0;
  const hasScore = score !== undefined;

  const showTooltip = useCallback((e: React.MouseEvent, text: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 36, text });
  }, []);
  const hideTooltip = () => setTooltip(null);

  const svgW = Math.max(containerW - 24, 700);

  // ── Decide tree mode ─────────────────────────────────────────────────────────
  const treeMode = !!critTree?.length;

  if (treeMode) {
    return (
      <TreeDiagram
        critTree={critTree!}
        levs={levs}
        impacts={impacts}
        color={color}
        g0={g0} g1={g1}
        objLabel={objLabel}
        scoreVal={scoreVal}
        hasScore={hasScore}
        selectedOptions={selectedOptions}
        onOptionSelect={onOptionSelect}
        onWeightChange={onWeightChange}
        importSources={importSources}
        height={height}
        svgW={svgW}
        containerRef={containerRef}
        containerW={containerW}
        tooltip={tooltip}
        setTooltip={setTooltip}
        highlightId={highlightId}
        setHighlightId={setHighlightId}
        highlightLev={highlightLev}
        setHighlightLev={setHighlightLev}
        showTooltip={showTooltip}
        hideTooltip={hideTooltip}
        showWeightPct={showWeightPct}
      />
    );
  }

  // ── Flat mode (backward compat) ──────────────────────────────────────────────
  const nCrits = crits.length;
  const optionsPerLev  = levs.map(l => l.options.length);
  const levHeights     = optionsPerLev.map(n => Math.max(LEV_H, n * (OPT_H + 6)));
  const totalLevH      = levHeights.reduce((a, b) => a + b + 14, 0);
  const totalCritH     = nCrits * (CRIT_H + 14);
  const svgH           = Math.max(height - 100, totalLevH, totalCritH, 280);

  const xScale = Math.min(1.2, (svgW - 40) / (OBJ_X + OBJ_R + 20));
  function cx(base: number) { return base * xScale + 20; }

  function critY(i: number) { return (svgH - totalCritH) / 2 + i * (CRIT_H + 14); }

  let levStartY: number[] = [];
  {
    let acc = (svgH - totalLevH) / 2;
    levs.forEach((_, i) => { levStartY.push(acc); acc += levHeights[i] + 14; });
  }
  function levCY(i: number) { return levStartY[i] + levHeights[i] / 2; }
  function optY(li: number, oi: number): number {
    const n = levs[li].options.length;
    const totalH = n * OPT_H + (n - 1) * 6;
    const startY = levStartY[li] + levHeights[li] / 2 - totalH / 2;
    return startY + oi * (OPT_H + 6);
  }

  const objCX = cx(OBJ_X) + OBJ_R;
  const objCY = svgH / 2;

  const levCritMaxImpact: Record<string, Record<string, number>> = {};
  levs.forEach(l => {
    levCritMaxImpact[l.id] = {};
    const levImp = impacts[l.id] ?? {};
    l.options.forEach(opt => {
      const row = levImp[opt.label] ?? {};
      crits.forEach(c => {
        const v = row[c.id] ?? 0;
        levCritMaxImpact[l.id][c.id] = Math.max(levCritMaxImpact[l.id][c.id] ?? 0, v);
      });
    });
  });

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", userSelect: "none" }}>
      {importSources.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", flexWrap: "wrap" }}>
          {importSources.map(src => (
            <div key={src.id} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
              borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              background: SOURCE_COLORS[src.type] + "18", border: `1px solid ${SOURCE_COLORS[src.type]}40`,
              color: SOURCE_COLORS[src.type],
            }}>
              <span style={{ fontWeight: 800 }}>{SOURCE_ICONS[src.type]}</span>
              {src.label}
            </div>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: svgH, overflow: "visible", display: "block" }} onMouseLeave={hideTooltip}>
        <defs>
          <linearGradient id="dcg-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g0} /><stop offset="100%" stopColor={g1} />
          </linearGradient>
          <linearGradient id="dcg-score-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g0 + "22"} /><stop offset="100%" stopColor={g1 + "10"} />
          </linearGradient>
          <filter id="dcg-shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000015" /></filter>
          <filter id="dcg-glow"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={color} floodOpacity="0.3" /></filter>
          <marker id="dcg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#cbd5e1" />
          </marker>
        </defs>
        {[
          { x: cx(OPT_X) + OPT_W / 2,  label: "Options" },
          { x: cx(LEV_X) + LEV_W / 2,  label: "Leviers" },
          { x: cx(CRIT_X) + CRIT_W / 2, label: "Critères" },
          { x: objCX, label: "Objectif" },
        ].map(col => (
          <text key={col.label} x={col.x} y={22} textAnchor="middle" fontSize={11.5} fontWeight={700} letterSpacing=".08em" fill="#94a3b8">{col.label}</text>
        ))}
        {[cx(LEV_X) - 8, cx(CRIT_X) - 8, objCX - OBJ_R - 14].map((x, i) => (
          <line key={i} x1={x} y1={32} x2={x} y2={svgH - 8} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
        ))}
        <g filter={hasScore ? "url(#dcg-glow)" : undefined}>
          <circle cx={objCX} cy={objCY} r={OBJ_R + 8} fill="url(#dcg-score-bg)" stroke={`${color}30`} strokeWidth={1.5} />
          {hasScore ? <ScoreRing cx={objCX} cy={objCY} r={OBJ_R - 2} score={scoreVal} color={color} /> : <circle cx={objCX} cy={objCY} r={OBJ_R - 2} fill="none" stroke={`${color}30`} strokeWidth={4} />}
          {hasScore ? (
            <>
              <text x={objCX} y={objCY - 6} textAnchor="middle" fontSize={15} fontWeight={900} fill={scoreColor(scoreVal)} style={{ transition: "all .4s" }}>
                {scoreVal >= 75 ? "++" : scoreVal >= 62 ? "+" : scoreVal >= 50 ? "0" : scoreVal >= 37 ? "−" : "−−"}
              </text>
              <text x={objCX} y={objCY + 10} textAnchor="middle" fontSize={12} fontWeight={700} fill={scoreColor(scoreVal)} style={{ transition: "all .4s" }}>
                {scoreVal >= 75 ? "Très favorable" : scoreVal >= 62 ? "Favorable" : scoreVal >= 50 ? "Neutre" : scoreVal >= 37 ? "Défavorable" : "Très défavorable"}
              </text>
            </>
          ) : (
            <text x={objCX} y={objCY + 4} textAnchor="middle" fontSize={11} fill={`${color}90`} fontWeight={600}>🎯</text>
          )}
          <text x={objCX} y={objCY + OBJ_R + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
            {objLabel.length > 20 ? objLabel.slice(0, 19) + "…" : objLabel}
          </text>
          {hasScore && <text x={objCX} y={objCY + OBJ_R + 29} textAnchor="middle" fontSize={12} fill="#94a3b8">Score de décision</text>}
        </g>
        {crits.map((c, ci) => {
          const cy2 = critY(ci) + CRIT_H / 2;
          const isHL = highlightId === c.id;
          const impColor2 = IMP_COLORS[c.importance] ?? color;
          return <path key={`co-${c.id}`} d={cubicBezier(cx(CRIT_X) + CRIT_W, cy2, objCX - OBJ_R - 8, objCY)} fill="none" stroke={isHL ? impColor2 : `${color}30`} strokeWidth={isHL ? 2 : Math.max(0.8, c.w * 8)} opacity={isHL ? .9 : .4} style={{ transition: "all .15s" }} />;
        })}
        {levs.map((l, li) => {
          const lcy = levCY(li);
          return crits.map((c, ci) => {
            const selOpt = selectedOptions[l.id] ?? l.options[0]?.label;
            const imp = selOpt ? (impacts[l.id]?.[selOpt]?.[c.id] ?? 0) : (levCritMaxImpact[l.id]?.[c.id] ?? 0);
            if (imp < 20) return null;
            const isHL = highlightId === c.id || highlightLev === l.id;
            const cy2 = critY(ci) + CRIT_H / 2;
            return <path key={`${l.id}-${c.id}`} d={cubicBezier(cx(LEV_X) + LEV_W, lcy, cx(CRIT_X), cy2)} fill="none" stroke={isHL ? color : impactColor(imp)} strokeWidth={isHL ? 2 : Math.max(0.8, imp / 50)} opacity={isHL ? .9 : .3} style={{ transition: "all .15s" }} />;
          });
        })}
        {crits.map((c, ci) => {
          const cy2 = critY(ci);
          const isHL = highlightId === c.id;
          const impColor2 = IMP_COLORS[c.importance] ?? "#6366f1";
          return (
            <g key={c.id} onMouseEnter={e => { setHighlightId(c.id); showTooltip(e, `${c.label} — poids ${Math.round(c.w * 100)}%`); }} onMouseLeave={() => { setHighlightId(null); hideTooltip(); }} style={{ cursor: "pointer" }}>
              <rect x={cx(CRIT_X)} y={cy2} width={CRIT_W} height={CRIT_H} rx={8} fill={isHL ? impColor2 + "22" : "var(--v4-surface, #fff)"} stroke={isHL ? impColor2 : "#e2e8f0"} strokeWidth={isHL ? 1.8 : 1.2} filter="url(#dcg-shadow)" />
              <rect x={cx(CRIT_X)} y={cy2} width={4} height={CRIT_H} rx={7} fill={impColor2} />
              <text x={cx(CRIT_X) + 11} y={cy2 + CRIT_H / 2 - 2} fontSize={12} fontWeight={600} fill={isHL ? impColor2 : "var(--v4-text, #1e293b)"} style={{ pointerEvents: "none" }}>
                {c.label.length > 16 ? c.label.slice(0, 15) + "…" : c.label}
              </text>
              <g>
                <rect x={cx(CRIT_X) + CRIT_W - 38} y={cy2 + CRIT_H/2 + 2} width={30} height={14} rx={7} fill={impColor2 + "22"} />
                <text x={cx(CRIT_X) + CRIT_W - 23} y={cy2 + CRIT_H/2 + 13} textAnchor="middle" fontSize={12} fontWeight={700} fill={impColor2} style={{ pointerEvents: "none" }}>{Math.round(c.w * 100)}%</text>
              </g>
            </g>
          );
        })}
        {levs.map((l, li) => {
          const lcy = levCY(li);
          const ly = lcy - LEV_H / 2;
          const isHL = highlightLev === l.id;
          const levColor = l.color ?? color;
          return (
            <g key={l.id} onMouseEnter={e => { setHighlightLev(l.id); showTooltip(e, l.label); }} onMouseLeave={() => { setHighlightLev(null); hideTooltip(); }} style={{ cursor: "pointer" }}>
              <rect x={cx(LEV_X)} y={ly} width={LEV_W} height={LEV_H} rx={8} fill={isHL ? levColor + "28" : levColor + "14"} stroke={levColor + (isHL ? "cc" : "60")} strokeWidth={isHL ? 1.8 : 1.2} filter="url(#dcg-shadow)" />
              <text x={cx(LEV_X) + 11} y={ly + LEV_H / 2 + 5} fontSize={13}>{l.icon ?? "⚙"}</text>
              <text x={cx(LEV_X) + 27} y={ly + LEV_H / 2 + 4} fontSize={12} fontWeight={700} fill={levColor} style={{ pointerEvents: "none" }}>
                {l.label.length > 14 ? l.label.slice(0, 13) + "…" : l.label}
              </text>
            </g>
          );
        })}
        {levs.map((l, li) => {
          const lcy = levCY(li);
          const levColor = l.color ?? color;
          const selOpt = selectedOptions[l.id];
          return l.options.map((opt, oi) => {
            const oy = optY(li, oi) + OPT_H / 2;
            const isSelected = selOpt === opt.label;
            return <path key={`ol-${l.id}-${oi}`} d={cubicBezier(cx(OPT_X) + OPT_W, oy, cx(LEV_X), lcy)} fill="none" stroke={levColor} strokeWidth={isSelected ? 2 : 1} opacity={isSelected ? .7 : .25} style={{ transition: "all .15s" }} />;
          });
        })}
        {levs.map((l, li) => {
          const levColor = l.color ?? color;
          const selOpt = selectedOptions[l.id];
          return l.options.map((opt, oi) => {
            const oy = optY(li, oi);
            const oCY = oy + OPT_H / 2;
            const isSelected = selOpt === opt.label;
            const isHL = highlightLev === l.id;
            return (
              <g key={`opt-${l.id}-${oi}`} onMouseEnter={e => showTooltip(e, opt.label)} onMouseLeave={hideTooltip} onClick={() => onOptionSelect?.(l.id, opt.label)} style={{ cursor: onOptionSelect ? "pointer" : "default" }}>
                <rect x={cx(OPT_X)} y={oy} width={OPT_W} height={OPT_H} rx={OPT_H / 2} fill={isSelected ? levColor : isHL ? levColor + "18" : "#f8fafc"} stroke={isSelected ? levColor : isHL ? levColor + "80" : "#e2e8f0"} strokeWidth={isSelected ? 2 : 1} style={{ transition: "all .15s" }} />
                {isSelected && <text x={cx(OPT_X) + 10} y={oCY + 4} fontSize={12} fontWeight={900} fill="#fff" style={{ pointerEvents: "none" }}>✓</text>}
                <text x={isSelected ? cx(OPT_X) + OPT_W / 2 + 5 : cx(OPT_X) + OPT_W / 2} y={oCY + 4} textAnchor="middle" fontSize={12} fontWeight={isSelected ? 700 : 500} fill={isSelected ? "#fff" : "#64748b"} style={{ pointerEvents: "none" }}>
                  {opt.label.length > 16 ? opt.label.slice(0, 15) + "…" : opt.label}
                </text>
              </g>
            );
          });
        })}
      </svg>
      {tooltip && (
        <div style={{ position: "absolute", left: tooltip.x + 12, top: tooltip.y, background: "rgba(15,23,42,.92)", color: "#f1f5f9", padding: "6px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.6, maxWidth: 240, pointerEvents: "none", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,.25)" }}>
          {tooltip.text}
        </div>
      )}
      <div style={{ display: "flex", gap: 14, padding: "10px 16px", flexWrap: "wrap", borderTop: "1px solid var(--v4-border, #e2e8f0)", marginTop: 4 }}>
        {[{ color: "#ef4444", label: "Critique" }, { color: "#f59e0b", label: "Important" }, { color: "#10b981", label: "Utile" }].map(({ color: c, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
            <div style={{ width: 10, height: 10, borderRadius: 6, background: c }} />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tree Diagram (6 colonnes) ─────────────────────────────────────────────────

interface TreeDiagramProps {
  critTree: CritNode[];
  levs: ChainLev[];
  impacts: Record<string, Record<string, Record<string, number>>>;
  color: string; g0: string; g1: string;
  objLabel: string;
  scoreVal: number; hasScore: boolean;
  selectedOptions: Record<string, string>;
  onOptionSelect?: (levId: string, opt: string) => void;
  onWeightChange?: (critId: string, pct: number) => void;
  importSources: ImportSource[];
  height: number;
  svgW: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerW: number;
  tooltip: { x: number; y: number; text: string } | null;
  setTooltip: (t: { x: number; y: number; text: string } | null) => void;
  highlightId: string | null;
  setHighlightId: (id: string | null) => void;
  highlightLev: string | null;
  setHighlightLev: (id: string | null) => void;
  showTooltip: (e: React.MouseEvent, text: string) => void;
  hideTooltip: () => void;
  showWeightPct?: boolean;
}

function TreeDiagram({
  critTree, levs, impacts, color, g0, g1, objLabel,
  scoreVal, hasScore, selectedOptions, onOptionSelect, onWeightChange,
  importSources, height, svgW,
  containerRef, tooltip, setTooltip,
  highlightId, setHighlightId, highlightLev, setHighlightLev,
  showTooltip, hideTooltip, showWeightPct,
}: TreeDiagramProps) {

  // ── Flatten & classify ─────────────────────────────────────────────────────
  const allFlat = flattenTree(critTree);
  const moeNodes = allFlat.filter(n => n._depth === 0);
  const mopNodes = allFlat.filter(n => n._depth === 1);
  const tpmNodes = allFlat.filter(n => n._depth === 2);
  // Fallback: if no 3-level tree, use what we have
  const useTPM   = tpmNodes.length > 0;
  const leafNodes = useTPM ? tpmNodes : (mopNodes.length > 0 ? mopNodes : moeNodes);
  const midNodes  = useTPM ? mopNodes : [];
  const topNodes  = moeNodes;

  // parent lookups: childId → parentId
  const childToParent: Record<string, string> = {};
  for (const n of allFlat) {
    if (n._parentId) childToParent[n.id] = n._parentId;
  }
  // id → FlatNode
  const nodeById: Record<string, FlatNode> = {};
  for (const n of allFlat) nodeById[n.id] = n;

  // ── Levier layout ──────────────────────────────────────────────────────────
  const optionsPerLev = levs.map(l => l.options.length);
  const levHeights    = optionsPerLev.map(n => Math.max(LEV_H, n * (OPT_H + 6)));
  const totalLevH     = levHeights.reduce((a, b) => a + b + 12, 0);

  // ── TPM layout ────────────────────────────────────────────────────────────
  const totalTPMH = leafNodes.length * (CRIT_H + 10);
  const svgH = Math.max(height - 60, Math.max(totalLevH, totalTPMH) + 80, 320);

  // xScale so 6 columns fit
  const maxX = T_OBJ_X + OBJ_R + 20;
  const xScale = Math.min(1.0, (svgW - 40) / maxX);
  function cx(base: number) { return base * xScale + 10; }

  // TPM Y positions
  function tpmY(i: number) { return (svgH - totalTPMH) / 2 + i * (CRIT_H + 10); }
  function tpmCY(i: number) { return tpmY(i) + CRIT_H / 2; }

  // Mid (MOP) Y = average Y of their leaf children
  function midCY(mid: FlatNode): number {
    const children = leafNodes.filter(t => childToParent[t.id] === mid.id);
    if (!children.length) return svgH / 2;
    const indices = children.map(c => leafNodes.indexOf(c));
    const avg = indices.reduce((a, b) => a + b, 0) / indices.length;
    return tpmY(avg) + CRIT_H / 2;
  }

  // Top (MOE) Y = average Y of their MOP children (or leaf if 2-level)
  function topCY(top: FlatNode): number {
    if (midNodes.length > 0) {
      const children = midNodes.filter(m => childToParent[m.id] === top.id);
      if (!children.length) return svgH / 2;
      const avg = children.map(midCY).reduce((a, b) => a + b, 0) / children.length;
      return avg;
    }
    // 2-level: MOE→TPM directly
    const children = leafNodes.filter(t => childToParent[t.id] === top.id);
    if (!children.length) return svgH / 2;
    const indices = children.map(c => leafNodes.indexOf(c));
    const avg = indices.reduce((a, b) => a + b, 0) / indices.length;
    return tpmY(avg) + CRIT_H / 2;
  }

  // Lever layout
  let levStartY: number[] = [];
  {
    let acc = (svgH - totalLevH) / 2;
    levs.forEach((_, i) => { levStartY.push(acc); acc += levHeights[i] + 12; });
  }
  function levCY(i: number) { return levStartY[i] + levHeights[i] / 2; }
  function optY(li: number, oi: number): number {
    const n = levs[li].options.length;
    const totalH = n * OPT_H + (n - 1) * 6;
    const startY = levStartY[li] + levHeights[li] / 2 - totalH / 2;
    return startY + oi * (OPT_H + 6);
  }

  const objCX = cx(T_OBJ_X) + OBJ_R;
  const objCY = svgH / 2;

  // Column labels
  const colLabels: Array<{ x: number; label: string; sub?: string }> = [
    { x: cx(T_OPT_X) + OPT_W / 2, label: "Options" },
    { x: cx(T_LEV_X) + LEV_W / 2, label: "Leviers" },
    { x: cx(T_TPM_X) + CRIT_W / 2, label: useTPM ? "TPM" : "Critères", sub: useTPM ? "Indicateurs terrain" : undefined },
    ...(midNodes.length > 0 ? [{ x: cx(T_MOP_X) + CRIT_W / 2, label: "MOP", sub: "Objectifs mesurables" }] : []),
    ...(topNodes.length > 0 && midNodes.length > 0 ? [{ x: cx(T_MOE_X) + CRIT_W / 2, label: "MOE", sub: "Critères majeurs" }] : []),
    { x: objCX, label: "Objectif" },
  ];

  const separators: number[] = [
    cx(T_LEV_X) - 6,
    cx(T_TPM_X) - 6,
    ...(midNodes.length > 0 ? [cx(T_MOP_X) - 6] : []),
    ...(topNodes.length > 0 && midNodes.length > 0 ? [cx(T_MOE_X) - 6] : []),
    objCX - OBJ_R - 12,
  ];

  const levColor0 = color;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", userSelect: "none" }}>
      {importSources.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", flexWrap: "wrap" }}>
          {importSources.map(src => (
            <div key={src.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: SOURCE_COLORS[src.type] + "18", border: `1px solid ${SOURCE_COLORS[src.type]}40`, color: SOURCE_COLORS[src.type] }}>
              <span style={{ fontWeight: 800 }}>{SOURCE_ICONS[src.type]}</span>
              {src.label}
            </div>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: svgH, overflow: "visible", display: "block" }} onMouseLeave={hideTooltip}>
        <defs>
          <linearGradient id="dct-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g0} /><stop offset="100%" stopColor={g1} />
          </linearGradient>
          <linearGradient id="dct-score-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g0 + "22"} /><stop offset="100%" stopColor={g1 + "10"} />
          </linearGradient>
          <filter id="dct-shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000015" /></filter>
          <filter id="dct-glow"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={color} floodOpacity="0.3" /></filter>
        </defs>

        {/* Column headers */}
        {colLabels.map(col => (
          <g key={col.label}>
            <text x={col.x} y={20} textAnchor="middle" fontSize={11.5} fontWeight={800} letterSpacing=".08em" fill="#64748b">{col.label}</text>
            {col.sub && <text x={col.x} y={31} textAnchor="middle" fontSize={12} fill="#94a3b8">{col.sub}</text>}
          </g>
        ))}

        {/* Separators */}
        {separators.map((x, i) => (
          <line key={i} x1={x} y1={36} x2={x} y2={svgH - 8} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* ── Objectif circle ── */}
        <g filter={hasScore ? "url(#dct-glow)" : undefined}>
          <circle cx={objCX} cy={objCY} r={OBJ_R + 8} fill="url(#dct-score-bg)" stroke={`${color}30`} strokeWidth={1.5} />
          {hasScore ? <ScoreRing cx={objCX} cy={objCY} r={OBJ_R - 2} score={scoreVal} color={color} /> : <circle cx={objCX} cy={objCY} r={OBJ_R - 2} fill="none" stroke={`${color}30`} strokeWidth={4} />}
          {hasScore ? (
            <>
              <text x={objCX} y={objCY - 6} textAnchor="middle" fontSize={15} fontWeight={900} fill={scoreColor(scoreVal)} style={{ transition: "all .4s" }}>
                {scoreVal >= 75 ? "++" : scoreVal >= 62 ? "+" : scoreVal >= 50 ? "0" : scoreVal >= 37 ? "−" : "−−"}
              </text>
              <text x={objCX} y={objCY + 10} textAnchor="middle" fontSize={12} fontWeight={700} fill={scoreColor(scoreVal)} style={{ transition: "all .4s" }}>
                {scoreVal >= 75 ? "Très favorable" : scoreVal >= 62 ? "Favorable" : scoreVal >= 50 ? "Neutre" : scoreVal >= 37 ? "Défavorable" : "Très défavorable"}
              </text>
            </>
          ) : (
            <text x={objCX} y={objCY + 4} textAnchor="middle" fontSize={11} fill={`${color}90`} fontWeight={600}>🎯</text>
          )}
          <text x={objCX} y={objCY + OBJ_R + 16} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
            {objLabel.length > 20 ? objLabel.slice(0, 19) + "…" : objLabel}
          </text>
          {hasScore && <text x={objCX} y={objCY + OBJ_R + 27} textAnchor="middle" fontSize={12} fill="#94a3b8">Score de décision</text>}
        </g>

        {/* ── MOE → Objectif edges ── */}
        {topNodes.map(moe => {
          const moeX = midNodes.length > 0 ? cx(T_MOE_X) + CRIT_W : cx(T_TPM_X) + CRIT_W;
          const moeCy = midNodes.length > 0 ? topCY(moe) : tpmCY(leafNodes.indexOf(moe as unknown as FlatNode));
          const isHL = highlightId === moe.id;
          return <path key={`moe-obj-${moe.id}`} d={cubicBezier(moeX, moeCy, objCX - OBJ_R - 8, objCY)} fill="none" stroke={isHL ? LEVEL_COLORS[0] : `${color}35`} strokeWidth={isHL ? 2.5 : Math.max(1, moe.w * 10)} opacity={isHL ? .9 : .5} style={{ transition: "all .15s" }} />;
        })}

        {/* ── MOP → MOE aggregation edges ── */}
        {midNodes.map(mop => {
          const parentMOE = topNodes.find(moe => moe.id === childToParent[mop.id]);
          if (!parentMOE) return null;
          const mopCy = midCY(mop);
          const moeCy = topCY(parentMOE);
          const isHL = highlightId === mop.id || highlightId === parentMOE.id;
          return (
            <path key={`mop-moe-${mop.id}`}
              d={cubicBezier(cx(T_MOP_X) + CRIT_W, mopCy, cx(T_MOE_X), moeCy)}
              fill="none"
              stroke={isHL ? LEVEL_COLORS[1] : `${LEVEL_COLORS[1]}50`}
              strokeWidth={isHL ? 2 : 1.2}
              strokeDasharray={isHL ? "none" : "5 3"}
              opacity={isHL ? .9 : .6}
              style={{ transition: "all .15s" }}
            />
          );
        })}

        {/* ── TPM → MOP aggregation edges ── */}
        {useTPM && leafNodes.map((tpm, ti) => {
          const parentMOP = midNodes.find(m => m.id === childToParent[tpm.id]);
          if (!parentMOP) {
            // 2-level: TPM→MOE
            const parentMOE = topNodes.find(m => m.id === childToParent[tpm.id]);
            if (!parentMOE) return null;
            const isHL = highlightId === tpm.id || highlightId === parentMOE.id;
            return (
              <path key={`tpm-moe-${tpm.id}`}
                d={cubicBezier(cx(T_TPM_X) + CRIT_W, tpmCY(ti), cx(T_MOE_X), topCY(parentMOE))}
                fill="none" stroke={isHL ? LEVEL_COLORS[0] : `${LEVEL_COLORS[0]}40`}
                strokeWidth={isHL ? 2 : 1} strokeDasharray={isHL ? "none" : "5 3"}
                opacity={isHL ? .9 : .5} style={{ transition: "all .15s" }}
              />
            );
          }
          const isHL = highlightId === tpm.id || highlightId === parentMOP.id;
          return (
            <path key={`tpm-mop-${tpm.id}`}
              d={cubicBezier(cx(T_TPM_X) + CRIT_W, tpmCY(ti), cx(T_MOP_X), midCY(parentMOP))}
              fill="none"
              stroke={isHL ? LEVEL_COLORS[2] : `${LEVEL_COLORS[2]}45`}
              strokeWidth={isHL ? 2 : 1.2}
              strokeDasharray={isHL ? "none" : "5 3"}
              opacity={isHL ? .9 : .55}
              style={{ transition: "all .15s" }}
            />
          );
        })}

        {/* ── Levier → TPM impact edges ── */}
        {levs.map((l, li) => {
          const lcy = levCY(li);
          return leafNodes.map((tpm, ti) => {
            const selOpt = selectedOptions[l.id] ?? l.options[0]?.label;
            const imp = selOpt ? (impacts[l.id]?.[selOpt]?.[tpm.id] ?? 0) : 0;
            if (imp < 20) return null;
            const isHL = highlightId === tpm.id || highlightLev === l.id;
            return (
              <path key={`lev-tpm-${l.id}-${tpm.id}`}
                d={cubicBezier(cx(T_LEV_X) + LEV_W, lcy, cx(T_TPM_X), tpmCY(ti))}
                fill="none"
                stroke={isHL ? color : impactColor(imp)}
                strokeWidth={isHL ? 2 : Math.max(0.8, imp / 50)}
                opacity={isHL ? .9 : .35}
                style={{ transition: "all .15s" }}
              />
            );
          });
        })}

        {/* ── MOE boxes ── */}
        {topNodes.map(moe => {
          if (midNodes.length === 0) return null; // no separate MOE column if 2-level
          const cy2 = topCY(moe) - CRIT_H / 2;
          const isHL = highlightId === moe.id;
          const col = LEVEL_COLORS[0];
          return (
            <g key={`moe-${moe.id}`}
              onMouseEnter={e => { setHighlightId(moe.id); showTooltip(e, `MOE · ${moe.label} — poids ${Math.round(moe.w * 100)}%`); }}
              onMouseLeave={() => { setHighlightId(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}>
              <rect x={cx(T_MOE_X)} y={cy2} width={CRIT_W} height={CRIT_H} rx={8}
                fill={isHL ? col + "22" : "var(--v4-surface, #fff)"}
                stroke={isHL ? col : col + "60"}
                strokeWidth={isHL ? 2 : 1.5}
                filter="url(#dct-shadow)" />
              <rect x={cx(T_MOE_X)} y={cy2} width={5} height={CRIT_H} rx={7} fill={col} />
              <text x={cx(T_MOE_X) + 12} y={cy2 + CRIT_H / 2 - 3} fontSize={12} fontWeight={800} fill={isHL ? col : "var(--v4-text, #1e293b)"} style={{ pointerEvents: "none" }}>
                {moe.label.length > 15 ? moe.label.slice(0, 14) + "…" : moe.label}
              </text>
              <text x={cx(T_MOE_X) + 12} y={cy2 + CRIT_H / 2 + 9} fontSize={12} fill={col + "cc"} style={{ pointerEvents: "none" }}>
                {Math.round(moe.w * 100)}% · Majeur
              </text>
            </g>
          );
        })}

        {/* ── MOP boxes ── */}
        {midNodes.map(mop => {
          const cy2 = midCY(mop) - CRIT_H / 2;
          const isHL = highlightId === mop.id;
          const col = LEVEL_COLORS[1];
          return (
            <g key={`mop-${mop.id}`}
              onMouseEnter={e => { setHighlightId(mop.id); showTooltip(e, `MOP · ${mop.label} — poids ${Math.round(mop.w * 100)}%`); }}
              onMouseLeave={() => { setHighlightId(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}>
              <rect x={cx(T_MOP_X)} y={cy2} width={CRIT_W} height={CRIT_H} rx={8}
                fill={isHL ? col + "22" : "var(--v4-surface, #fff)"}
                stroke={isHL ? col : col + "60"}
                strokeWidth={isHL ? 2 : 1.5}
                filter="url(#dct-shadow)" />
              <rect x={cx(T_MOP_X)} y={cy2} width={5} height={CRIT_H} rx={7} fill={col} />
              <text x={cx(T_MOP_X) + 12} y={cy2 + CRIT_H / 2 - 3} fontSize={12} fontWeight={700} fill={isHL ? col : "var(--v4-text, #1e293b)"} style={{ pointerEvents: "none" }}>
                {mop.label.length > 15 ? mop.label.slice(0, 14) + "…" : mop.label}
              </text>
              <text x={cx(T_MOP_X) + 12} y={cy2 + CRIT_H / 2 + 9} fontSize={12} fill={col + "cc"} style={{ pointerEvents: "none" }}>
                {Math.round(mop.w * 100)}% · Mesurable
              </text>
            </g>
          );
        })}

        {/* ── TPM boxes ── */}
        {leafNodes.map((tpm, ti) => {
          const cy2 = tpmY(ti);
          const isHL = highlightId === tpm.id;
          const col = useTPM ? LEVEL_COLORS[2] : LEVEL_COLORS[0];
          // Live impact from selected options
          let totalImp = 0, totalW = 0;
          for (const lev of levs) {
            const selOpt = selectedOptions[lev.id] ?? lev.options[0]?.label;
            const imp = selOpt ? (impacts[lev.id]?.[selOpt]?.[tpm.id] ?? 0) : 0;
            if (imp > 0) { totalImp += imp; totalW++; }
          }
          const avgImp = totalW > 0 ? Math.round(totalImp / totalW) : 0;
          const impStr = avgImp >= 75 ? "++" : avgImp >= 55 ? "+" : avgImp >= 30 ? "0" : avgImp > 0 ? "−" : "·";
          const impCol = avgImp >= 55 ? "#10b981" : avgImp >= 30 ? "#f59e0b" : avgImp > 0 ? "#ef4444" : "#cbd5e1";
          return (
            <g key={`tpm-${tpm.id}`}
              onMouseEnter={e => { setHighlightId(tpm.id); showTooltip(e, `${useTPM ? "TPM" : "Critère"} · ${tpm.label} — poids ${Math.round(tpm.w * 100)}%${tpm.description ? "\n" + tpm.description.slice(0, 60) : ""}`); }}
              onMouseLeave={() => { setHighlightId(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}>
              <rect x={cx(T_TPM_X)} y={cy2} width={CRIT_W} height={CRIT_H} rx={6}
                fill={isHL ? col + "18" : "var(--v4-surface, #fff)"}
                stroke={isHL ? col : "#e2e8f0"}
                strokeWidth={isHL ? 1.8 : 1}
                filter="url(#dct-shadow)" />
              <rect x={cx(T_TPM_X)} y={cy2} width={4} height={CRIT_H} rx={6} fill={col} />
              <text x={cx(T_TPM_X) + 10} y={cy2 + CRIT_H / 2 - 3} fontSize={12} fontWeight={600} fill={isHL ? col : "var(--v4-text, #1e293b)"} style={{ pointerEvents: "none" }}>
                {tpm.label.length > 16 ? tpm.label.slice(0, 15) + "…" : tpm.label}
              </text>
              {/* Impact live badge */}
              <text x={cx(T_TPM_X) + 10} y={cy2 + CRIT_H / 2 + 9} fontSize={12} fill={impCol} fontWeight={700} style={{ pointerEvents: "none" }}>
                {impStr}
              </text>
              {/* Weight pill */}
              {onWeightChange ? (
                <foreignObject x={cx(T_TPM_X) + CRIT_W - 46} y={cy2 + CRIT_H / 2 + 1} width={42} height={14}>
                  <input type="range" min={1} max={99} value={Math.round(tpm.w * 100)}
                    style={{ width: "100%", height: 10, accentColor: col, cursor: "pointer", margin: 0, padding: 0 }}
                    onChange={(e) => { e.stopPropagation(); onWeightChange(tpm.id, parseInt(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()} />
                </foreignObject>
              ) : (
                <text x={cx(T_TPM_X) + CRIT_W - 6} y={cy2 + CRIT_H / 2 + 5} textAnchor="end" fontSize={12} fontWeight={700} fill={col + "bb"} style={{ pointerEvents: "none" }}>
                  {Math.round(tpm.w * 100)}%
                </text>
              )}
            </g>
          );
        })}

        {/* ── Lever boxes ── */}
        {levs.map((l, li) => {
          const lcy = levCY(li);
          const ly = lcy - LEV_H / 2;
          const isHL = highlightLev === l.id;
          const levColor = l.color ?? color;
          return (
            <g key={l.id}
              onMouseEnter={e => { setHighlightLev(l.id); showTooltip(e, l.label + (l.description ? " — " + l.description.slice(0, 60) : "")); }}
              onMouseLeave={() => { setHighlightLev(null); hideTooltip(); }}
              style={{ cursor: "pointer" }}>
              <rect x={cx(T_LEV_X)} y={ly} width={LEV_W} height={LEV_H} rx={8}
                fill={isHL ? levColor + "28" : levColor + "14"}
                stroke={levColor + (isHL ? "cc" : "60")}
                strokeWidth={isHL ? 1.8 : 1.2}
                filter="url(#dct-shadow)" />
              <text x={cx(T_LEV_X) + 11} y={ly + LEV_H / 2 + 5} fontSize={12}>{l.icon ?? "⚙"}</text>
              <text x={cx(T_LEV_X) + 26} y={ly + LEV_H / 2 + 4} fontSize={12} fontWeight={700} fill={levColor} style={{ pointerEvents: "none" }}>
                {l.label.length > 13 ? l.label.slice(0, 12) + "…" : l.label}
              </text>
              {selectedOptions[l.id] && (
                <text x={cx(T_LEV_X) + LEV_W / 2} y={ly + LEV_H - 5} textAnchor="middle" fontSize={12} fill={levColor} opacity={.8} style={{ pointerEvents: "none" }}>
                  ✓ {(selectedOptions[l.id] ?? "").length > 14 ? (selectedOptions[l.id] ?? "").slice(0, 13) + "…" : selectedOptions[l.id]}
                </text>
              )}
            </g>
          );
        })}

        {/* ── Option → Lever edges ── */}
        {levs.map((l, li) => {
          const lcy = levCY(li);
          const levColor = l.color ?? color;
          const selOpt = selectedOptions[l.id];
          return l.options.map((opt, oi) => {
            const oy = optY(li, oi) + OPT_H / 2;
            const isSelected = selOpt === opt.label;
            return <path key={`ol-${l.id}-${oi}`} d={cubicBezier(cx(T_OPT_X) + OPT_W, oy, cx(T_LEV_X), lcy)} fill="none" stroke={levColor} strokeWidth={isSelected ? 2 : 1} opacity={isSelected ? .7 : .25} style={{ transition: "all .15s" }} />;
          });
        })}

        {/* ── Option pills ── */}
        {levs.map((l, li) => {
          const levColor = l.color ?? color;
          const selOpt = selectedOptions[l.id];
          return l.options.map((opt, oi) => {
            const oy = optY(li, oi);
            const oCY = oy + OPT_H / 2;
            const isSelected = selOpt === opt.label;
            const isHL = highlightLev === l.id;
            return (
              <g key={`opt-${l.id}-${oi}`}
                onMouseEnter={e => showTooltip(e, `${opt.label}${isSelected ? " · ✓ Active" : ""}`)}
                onMouseLeave={hideTooltip}
                onClick={() => onOptionSelect?.(l.id, opt.label)}
                style={{ cursor: onOptionSelect ? "pointer" : "default" }}>
                <rect x={cx(T_OPT_X)} y={oy} width={OPT_W} height={OPT_H} rx={OPT_H / 2}
                  fill={isSelected ? levColor : isHL ? levColor + "18" : "#f8fafc"}
                  stroke={isSelected ? levColor : isHL ? levColor + "80" : "#e2e8f0"}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ transition: "all .15s" }} />
                {isSelected && <text x={cx(T_OPT_X) + 10} y={oCY + 4} fontSize={12} fontWeight={900} fill="#fff" style={{ pointerEvents: "none" }}>✓</text>}
                <text x={isSelected ? cx(T_OPT_X) + OPT_W / 2 + 5 : cx(T_OPT_X) + OPT_W / 2} y={oCY + 4}
                  textAnchor="middle" fontSize={12} fontWeight={isSelected ? 700 : 500}
                  fill={isSelected ? "#fff" : "#64748b"} style={{ pointerEvents: "none" }}>
                  {opt.label.length > 14 ? opt.label.slice(0, 13) + "…" : opt.label}
                </text>
              </g>
            );
          });
        })}
      </svg>

      {tooltip && (
        <div style={{ position: "absolute", left: tooltip.x + 12, top: tooltip.y, background: "rgba(15,23,42,.92)", color: "#f1f5f9", padding: "6px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.6, maxWidth: 260, pointerEvents: "none", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,.25)", whiteSpace: "pre-line" }}>
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, padding: "10px 16px", flexWrap: "wrap", borderTop: "1px solid var(--v4-border, #e2e8f0)", marginTop: 4 }}>
        {[
          { color: LEVEL_COLORS[0], label: "MOE — Critère majeur" },
          { color: LEVEL_COLORS[1], label: "MOP — Objectif mesurable" },
          { color: LEVEL_COLORS[2], label: "TPM — Indicateur terrain" },
        ].map(({ color: c, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
            <div style={{ width: 10, height: 10, borderRadius: 6, background: c }} />{label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
          <div style={{ width: 20, height: 1, borderTop: "2px dashed #a78bfa" }} />
          Agrégation montante
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
          <div style={{ width: 20, height: 2, background: `linear-gradient(90deg,${color}50,${color})`, borderRadius: 6 }} />
          Impact levier → TPM
        </div>
      </div>
    </div>
  );
}

// ── Mock DOORS import ──────────────────────────────────────────────────────────

export interface DoorsRequirement {
  id: string;
  text: string;
  type: "performance" | "reliability" | "safety" | "regulatory" | "cost";
  derivedCrit?: { label: string; w: number; importance: "Critique" | "Important" | "Utile" };
}

export function mockDoorsImport(domain: string): DoorsRequirement[] {
  const base: DoorsRequirement[] = [
    { id: "REQ-001", text: "La solution doit respecter la réglementation EN 9100 / DO-178C", type: "regulatory", derivedCrit: { label: "Conformité réglementaire", w: 0.20, importance: "Critique" } },
    { id: "REQ-002", text: "Le MTBF du système principal doit être ≥ 10 000h", type: "reliability", derivedCrit: { label: "Fiabilité (MTBF)", w: 0.18, importance: "Critique" } },
    { id: "REQ-003", text: "Le coût unitaire de production ne doit pas dépasser le plafond budgétaire", type: "cost", derivedCrit: { label: "Coût unitaire", w: 0.15, importance: "Important" } },
    { id: "REQ-004", text: "Le délai de mise en service est ≤ 18 mois", type: "performance", derivedCrit: { label: "Délai de mise en œuvre", w: 0.12, importance: "Important" } },
    { id: "REQ-005", text: "La solution doit être interfaçable avec les systèmes ERP existants", type: "performance", derivedCrit: { label: "Intégration SI", w: 0.10, importance: "Utile" } },
  ];
  if (domain.includes("aircraft") || domain.includes("mecatr")) {
    base.push({ id: "REQ-006", text: "La masse totale ne doit pas excéder la limite structurelle", type: "performance", derivedCrit: { label: "Masse / Poids", w: 0.14, importance: "Critique" } });
    base.push({ id: "REQ-007", text: "SIL/DAL requis : Niveau B (catastrophique réduit à majeur)", type: "safety", derivedCrit: { label: "Niveau de sécurité SIL/DAL", w: 0.22, importance: "Critique" } });
  }
  return base;
}

// ── Mock CATIA/3DX import ──────────────────────────────────────────────────────

export interface CatiaComponent {
  id: string;
  name: string;
  function: string;
  alternatives: string[];
  derivedLever?: { label: string; icon: string; options: string[] };
}

export function mockCatiaImport(domain: string): CatiaComponent[] {
  const base: CatiaComponent[] = [
    { id: "SYS-ACT",  name: "Actionneur principal",      function: "Conversion énergie → mouvement",              alternatives: ["Électrique brushless", "Hydraulique proportionnel", "Hybride"], derivedLever: { label: "Type d'actionneur",    icon: "⚙", options: ["Électrique brushless", "Hydraulique proportionnel", "Hybride"] } },
    { id: "SYS-CTRL", name: "Unité de contrôle-commande", function: "Traitement signaux & contrôle loi de commande", alternatives: ["Microcontrôleur AURIX", "FPGA Xilinx", "SoC hétérogène"],       derivedLever: { label: "Plateforme contrôle",  icon: "🔲", options: ["AURIX ASIL-D", "FPGA Xilinx", "SoC hétérogène"] } },
    { id: "SYS-SENS", name: "Capteurs & mesures",         function: "Acquisition état système",                     alternatives: ["Capteur redondant SIL2", "Capteur simple + watchdog", "Fusion multi-capteurs"], derivedLever: { label: "Architecture capteur", icon: "📡", options: ["Redondance SIL2", "Simple + watchdog", "Fusion multi-capteurs"] } },
  ];
  if (domain.includes("supply") || domain.includes("logistics")) {
    return [
      { id: "SC-STOCK", name: "Gestion des stocks",    function: "Disponibilité matière",               alternatives: ["Stock centralisé", "Stock distribué", "Flux tiré JIT"],         derivedLever: { label: "Politique de stock",   icon: "📦", options: ["Stock centralisé", "Stock distribué", "Flux tiré JIT"] } },
      { id: "SC-SOURC", name: "Stratégie sourcing",    function: "Approvisionnement fournisseurs",      alternatives: ["Mono-source", "Dual-source", "Multi-source géodiversifié"],     derivedLever: { label: "Stratégie sourcing",   icon: "🏭", options: ["Mono-source", "Dual-source", "Multi-source"] } },
    ];
  }
  return base;
}
