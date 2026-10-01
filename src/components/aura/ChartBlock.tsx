import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie,
  Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, ZAxis,
  Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, CartesianGrid, LabelList,
} from "recharts";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6", "#8b5cf6"];
const SEV_COLOR: Record<string, string> = {
  "Critique": "#ef4444", "critique": "#ef4444",
  "Élevé": "#f97316",   "élevé": "#f97316",   "elevé": "#f97316",
  "Moyen": "#f59e0b",   "moyen": "#f59e0b",
  "Faible": "#22c55e",  "faible": "#22c55e",
};

interface ChartSpec {
  type: "bar" | "line" | "pie" | "heatmap" | "bubble" | "waterfall" | "scatter" | "table";
  title?: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  color?: string;
  keys?: string[];
  columns?: string[];
  xLabel?: string;
  yLabel?: string;
  // Lignes de seuil horizontales (ex. seuil d'alerte / critique).
  thresholds?: { label: string; value: number; color?: string }[];
  // Thème Aura (copilote) : indigo + bleu nuit, un seul axe, légende.
  theme?: "aura";
  // Libellés de légende pour une série unique colorée selon `_breach`.
  legend?: { ok: string; breach: string };
}

const AURA_INDIGO = "#4743E6";
const AURA_NIGHT = "#151D52";

// Jetons du thème Aura, redéfinis en mode sombre : les couleurs d'état ne
// servent qu'à la sévérité (alerte, critique), jamais comme couleur de série.
const AURA_CHART_CSS = `
.aura-chart{--ac-bg:#fbfbff;--ac-border:#e4e3fb;--ac-title:${AURA_NIGHT};--ac-text:#4a4f6e;--ac-muted:#6b6f93;--ac-grid:#ecebfb;--ac-axis:#c9c8fb;--ac-s1:${AURA_INDIGO};--ac-s2:${AURA_NIGHT};--ac-ok:#16a34a;--ac-warn:#d97706;--ac-crit:#dc2626;--ac-cursor:#eeedfd;--ac-tip:#ffffff;
  margin:12px 0;border-radius:12px;border:1px solid var(--ac-border);background:var(--ac-bg);padding:12px 12px 6px;color:var(--ac-text)}
.dark .aura-chart,[data-theme=dark] .aura-chart{--ac-bg:#12163a;--ac-border:#2a2f63;--ac-title:#eef0ff;--ac-text:#c9ccef;--ac-muted:#9ea3d6;--ac-grid:#262b5c;--ac-axis:#3a4080;--ac-s1:#8b88f5;--ac-s2:#d5d4fb;--ac-ok:#4ade80;--ac-warn:#fbbf24;--ac-crit:#f87171;--ac-cursor:#1d2250;--ac-tip:#1a1f4a}
.aura-chart-title{margin:0;font-size:13.5px;font-weight:750;color:var(--ac-title)}
.aura-chart-sub{margin:2px 0 6px;font-size:12px;color:var(--ac-muted)}
.aura-chart-legend{display:flex;flex-wrap:wrap;gap:4px 12px;margin:2px 0 4px;font-size:11.5px;color:var(--ac-text)}
.aura-chart-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.aura-chart-legend i.dash{height:0;width:16px;border-top:2px dashed;border-radius:0;vertical-align:3px}
.aura-chart .recharts-cartesian-axis-tick-value,.aura-chart .recharts-label{fill:var(--ac-text)}
.aura-chart .recharts-cartesian-axis-line,.aura-chart .recharts-cartesian-axis-tick-line{stroke:var(--ac-axis)}
.aura-chart .recharts-cartesian-grid line{stroke:var(--ac-grid)}
.aura-chart-tip{background:var(--ac-tip);border:1px solid var(--ac-border);border-radius:8px;padding:7px 9px;font-size:12px;color:var(--ac-text);box-shadow:0 6px 18px rgba(21,29,82,.14)}
.aura-chart-tip b{display:block;color:var(--ac-title);font-size:12.5px;margin-bottom:2px}
.aura-chart-tip span{display:inline-block;margin-left:6px;font-weight:700}
`;

type Status = "ok" | "alerte" | "critique";
const STATE_VAR: Record<Status, string> = { ok: "var(--ac-ok)", alerte: "var(--ac-warn)", critique: "var(--ac-crit)" };
const STATE_LABEL: Record<Status, string> = { ok: "dans les seuils", alerte: "alerte", critique: "critique" };
const statusOfPoint = (d: Record<string, string | number>): Status | undefined => {
  const s = d._status;
  if (s === "ok" || s === "alerte" || s === "critique") return s;
  if (d._breach !== undefined) return d._breach ? "alerte" : "ok";
  return undefined;
};
const fmtNum = (v: unknown) => typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : String(v ?? "");

function AuraTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name?: string; value?: unknown; payload?: Record<string, string | number> }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload ?? {};
  const st = statusOfPoint(point);
  return (
    <div className="aura-chart-tip">
      <b>{String(point.name ?? label ?? "")}</b>
      {payload.map(p => <div key={String(p.name)}>{p.name} : <strong>{fmtNum(p.value)}{unit ? ` ${unit}` : ""}</strong></div>)}
      {st && <div>État :<span style={{ color: STATE_VAR[st] }}>{STATE_LABEL[st]}</span></div>}
    </div>
  );
}

// Libellé de catégorie tronqué, texte complet au survol.
function CategoryTick({ x, y, payload, max, anchor = "end", dy = 4 }: { x?: number; y?: number; payload?: { value: string }; max: number; anchor?: "end" | "middle"; dy?: number }) {
  const full = String(payload?.value ?? "");
  const short = full.length > max ? `${full.slice(0, max - 1)}…` : full;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text className="recharts-cartesian-axis-tick-value" x={anchor === "end" ? -6 : 0} y={0} dy={dy} textAnchor={anchor} fontSize={11.5}>{short}</text>
    </g>
  );
}

// Graphique du copilote : titre et unité, séries indigo / bleu nuit, états
// (alerte, critique) réservés à la sévérité, seuils en pointillé libellés,
// grille discrète, valeur concernée mise en avant, lisible jusqu'à 390 px.
export function AuraChart({ spec, keys }: { spec: ChartSpec; keys: string[] }) {
  const series = ["var(--ac-s1)", "var(--ac-s2)"];
  const unit = spec.yLabel ?? "";
  const statuses = spec.data.map(statusOfPoint);
  const stateMode = keys.length === 1 && statuses.some(Boolean);
  const focusIndex = (() => {
    const f = spec.data.findIndex(d => d._focus === 1);
    if (f >= 0) return f;
    if (spec.type === "line") return spec.data.length - 1; // point le plus récent
    return stateMode ? statuses.findIndex(s => s === "critique") >= 0 ? statuses.findIndex(s => s === "critique") : statuses.findIndex(s => s === "alerte") : -1;
  })();
  const thresholdColor = (i: number) => i === 0 ? "var(--ac-warn)" : "var(--ac-crit)";
  const horizontal = spec.type === "bar" && (spec.data.length > 5 || spec.data.some(d => String(d.name).length > 10));
  const refs = spec.thresholds?.map((t, i) => (
    <ReferenceLine key={t.label} {...(horizontal ? { x: t.value } : { y: t.value })} stroke={thresholdColor(i)} strokeDasharray="5 4" strokeWidth={1.4} ifOverflow="extendDomain"
      label={horizontal
        // Au-dessus du tracé : le premier seuil à gauche de sa ligne, le second à droite, sans chevauchement.
        ? (p: { viewBox?: { x?: number; y?: number } }) => <text x={(p.viewBox?.x ?? 0) + (i === 0 ? -4 : 4)} y={(p.viewBox?.y ?? 0) - 5} textAnchor={i === 0 ? "end" : "start"} fontSize={11} fontWeight={700} style={{ fill: thresholdColor(i) }}>{t.label}</text>
        : { value: t.label, position: i === 0 ? "insideBottomRight" : "insideTopRight", fontSize: 11, fill: thresholdColor(i) }} />
  ));
  const tooltip = <Tooltip cursor={{ fill: "var(--ac-cursor)" }} content={<AuraTooltip unit={unit} />} />;
  const grid = <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />;
  const fillFor = (i: number, k: number) => stateMode && statuses[i] && statuses[i] !== "ok" ? STATE_VAR[statuses[i]!] : series[k % 2];
  const focusLabel = (k: number) => (
    <LabelList dataKey={keys[k]} content={(p: { index?: number; x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown }) => {
      if (p.index !== focusIndex || k !== 0) return null;
      const x = Number(p.x), y = Number(p.y), w = Number(p.width), h = Number(p.height);
      return horizontal
        ? <text x={x + w + 6} y={y + h / 2 + 4} fontSize={12} fontWeight={800} style={{ fill: "var(--ac-title)" }}>{fmtNum(p.value)}</text>
        : <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={800} style={{ fill: "var(--ac-title)" }}>{fmtNum(p.value)}</text>;
    }} />
  );
  const legend = spec.type === "pie" ? (
    <div className="aura-chart-legend" aria-hidden="true">
      {spec.data.map((d, i) => <span key={String(d.name)}><i style={{ background: statuses[i] ? STATE_VAR[statuses[i]!] : [AURA_INDIGO, AURA_NIGHT, "#8583EE", "#2B3380"][i % 4] }} />{String(d.name)} · {fmtNum(d[keys[0]])}</span>)}
    </div>
  ) : (
    <div className="aura-chart-legend" aria-hidden="true">
      {(stateMode ? [keys[0]] : keys).map((k, i) => <span key={k}><i style={{ background: series[i % 2] }} />{stateMode ? (spec.legend?.ok ?? "Dans les seuils") : k}</span>)}
      {stateMode && statuses.includes("alerte") && <span><i style={{ background: "var(--ac-warn)" }} />Alerte</span>}
      {stateMode && statuses.includes("critique") && <span><i style={{ background: "var(--ac-crit)" }} />Critique</span>}
      {(spec.thresholds ?? []).map((t, i) => <span key={t.label}><i className="dash" style={{ borderColor: thresholdColor(i) }} />Seuil {t.label}</span>)}
    </div>
  );
  const valueAxisLabel = unit ? { value: unit, fontSize: 11, ...(horizontal ? { position: "insideBottomRight" as const, offset: -2 } : { position: "top" as const, offset: 8 }) } : undefined;
  const height = horizontal ? Math.min(460, Math.max(180, spec.data.length * 28 + 56)) : 230;
  let chart: React.ReactElement;
  if (spec.type === "pie") {
    const total = spec.data.reduce((sum, d) => sum + Number(d[keys[0]] ?? 0), 0);
    chart = (
      <PieChart>
        <Pie data={spec.data} dataKey={keys[0]} nameKey="name" innerRadius="52%" outerRadius="80%" paddingAngle={2} stroke="var(--ac-bg)" strokeWidth={2} isAnimationActive={false}
          label={({ percent }: { percent?: number }) => percent && percent > 0.04 ? `${Math.round(percent * 100)} %` : ""} labelLine={false}>
          {spec.data.map((d, i) => <Cell key={i} fill={statuses[i] ? STATE_VAR[statuses[i]!] : [AURA_INDIGO, AURA_NIGHT, "#8583EE", "#2B3380"][i % 4]} />)}
        </Pie>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight={800} style={{ fill: "var(--ac-title)" }}>{total}</text>
        {tooltip}
      </PieChart>
    );
  } else if (spec.type === "line") {
    const last = spec.data.length - 1;
    chart = (
      <LineChart data={spec.data} margin={{ top: 24, right: 16, bottom: 4, left: 4 }}>
        {grid}
        <XAxis dataKey="name" tick={(p: object) => <CategoryTick {...p} max={10} anchor="middle" dy={14} />} interval="preserveStartEnd" minTickGap={8} />
        <YAxis width={44} tick={{ fontSize: 11.5 }} label={valueAxisLabel} />
        {tooltip}
        {refs}
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={series[i % 2]} strokeWidth={2.2} isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number; payload?: Record<string, string | number> }) => {
              const st = p.payload ? statusOfPoint(p.payload) : undefined;
              const focus = p.index === (focusIndex >= 0 ? focusIndex : last) && i === 0;
              return <g key={p.index}>
                <circle cx={p.cx} cy={p.cy} r={focus ? 5.5 : 3} style={{ fill: st && st !== "ok" ? STATE_VAR[st] : series[i % 2], stroke: "var(--ac-bg)", strokeWidth: focus ? 2 : 1 }} />
                {focus && <text x={p.cx} y={(p.cy ?? 0) - 10} textAnchor="middle" fontSize={12} fontWeight={800} style={{ fill: "var(--ac-title)" }}>{fmtNum(p.payload?.[k])}</text>}
              </g>;
            }} />
        ))}
      </LineChart>
    );
  } else if (horizontal) {
    chart = (
      <BarChart data={spec.data} layout="vertical" margin={{ top: 22, right: 36, bottom: 8, left: 0 }} barCategoryGap={keys.length > 1 ? "18%" : "26%"}>
        {grid}
        <XAxis type="number" tick={{ fontSize: 11.5 }} label={valueAxisLabel} />
        <YAxis type="category" dataKey="name" width={112} interval={0} tick={(p: object) => <CategoryTick {...p} max={16} />} />
        {tooltip}
        {refs}
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={series[i % 2]} radius={4} maxBarSize={16} isAnimationActive={false}>
            {spec.data.map((d, j) => <Cell key={j} fill={fillFor(j, i)} fillOpacity={focusIndex < 0 || j === focusIndex || i > 0 ? 1 : 0.78} stroke={j === focusIndex && i === 0 ? "var(--ac-title)" : undefined} strokeWidth={j === focusIndex && i === 0 ? 1.5 : 0} />)}
            {focusLabel(i)}
          </Bar>
        ))}
      </BarChart>
    );
  } else {
    chart = (
      <BarChart data={spec.data} margin={{ top: 24, right: 10, bottom: 4, left: 4 }}>
        {grid}
        <XAxis dataKey="name" interval={0} tick={(p: object) => <CategoryTick {...p} max={9} anchor="middle" dy={14} />} />
        <YAxis width={44} tick={{ fontSize: 11.5 }} label={valueAxisLabel} />
        {tooltip}
        {refs}
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={series[i % 2]} radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false}>
            {spec.data.map((d, j) => <Cell key={j} fill={fillFor(j, i)} fillOpacity={focusIndex < 0 || j === focusIndex || i > 0 ? 1 : 0.78} stroke={j === focusIndex && i === 0 ? "var(--ac-title)" : undefined} strokeWidth={j === focusIndex && i === 0 ? 1.5 : 0} />)}
            {focusLabel(i)}
          </Bar>
        ))}
      </BarChart>
    );
  }
  return (
    <div className="aura-chart" data-chart-type={spec.type} role="figure" aria-label={`${spec.title ?? "Graphique"}${unit ? ` (${unit})` : ""}`}>
      <style>{AURA_CHART_CSS}</style>
      {spec.title && <p className="aura-chart-title">{spec.title}{unit && spec.type !== "pie" ? ` (${unit})` : ""}</p>}
      {spec.subtitle && <p className="aura-chart-sub">{spec.subtitle}</p>}
      {legend}
      <ResponsiveContainer width="100%" height={spec.type === "pie" ? 210 : height}>{chart}</ResponsiveContainer>
    </div>
  );
}

// ── Risk Heatmap (Impact × Probability scatter) ───────────────────────────────

function RiskHeatmapTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">Impact : <span className="font-medium text-foreground">{d.impact}</span></p>
      <p className="text-muted-foreground">Probabilité : <span className="font-medium text-foreground">{d.probability}%</span></p>
      {d.value && <p className="text-muted-foreground">Valeur : <span className="font-medium text-foreground">{d.value}</span></p>}
    </div>
  );
}

function RiskHeatmap({ spec }: { spec: ChartSpec }) {
  // data items: { name, impact (0-10), probability (0-100), severity?, value? }
  const scatterData = spec.data.map(d => ({
    ...d,
    x: Number(d.probability ?? d.x ?? 50),
    y: Number(d.impact ?? d.y ?? 5),
    z: 80,
  }));

  return (
    <div className="my-4 rounded-2xl bg-foreground/[0.02] p-4">
      {spec.title && <p className="text-[13px] font-semibold text-foreground mb-1.5 tracking-tight">{spec.title}</p>}
      {spec.subtitle && <p className="text-[13px] text-muted-foreground/80 mb-2.5">{spec.subtitle}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 22, left: 10 }}>
          <XAxis
            type="number" dataKey="x" domain={[0, 100]}
            label={{ value: spec.xLabel ?? "Probabilité (%)", position: "insideBottom", offset: -10, fontSize: 13 }}
            tick={{ fontSize: 13 }} tickCount={6}
          />
          <YAxis
            type="number" dataKey="y" domain={[0, 10]}
            label={{ value: spec.yLabel ?? "Impact (0-10)", angle: -90, position: "insideLeft", offset: 10, fontSize: 13 }}
            tick={{ fontSize: 13 }} tickCount={6}
          />
          <ZAxis type="number" dataKey="z" range={[60, 120]} />
          <ReferenceLine x={50} stroke="var(--border)" strokeDasharray="3 3" />
          <ReferenceLine y={5} stroke="var(--border)" strokeDasharray="3 3" />
          <Tooltip content={<RiskHeatmapTooltip />} />
          <Scatter
            data={scatterData}
            shape={(props: any) => {
              const { cx, cy, payload } = props;
              const sev = payload.severity ?? "";
              const fill = SEV_COLOR[sev] ?? "#6366f1";
              return (
                <g>
                  <circle cx={cx} cy={cy} r={8} fill={fill} fillOpacity={0.85} stroke={fill} strokeWidth={1.5} />
                  <text x={cx} y={cy + 14} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)" fontWeight="500">
                    {String(payload.name ?? "").split(" ")[0].slice(0, 9)}
                  </text>
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
      {/* Quadrant labels */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="text-[12px] text-muted-foreground text-center">← Faible impact + faible prob.</div>
        <div className="text-[12px] text-red-500 text-center font-medium">⚠ Fort impact + forte prob.</div>
      </div>
    </div>
  );
}

// ── Bubble Chart (ROI × Probability × Investment size) ────────────────────────

function BubbleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">ROI : <span className="font-medium text-foreground">{d.roi ?? d.x}</span></p>
      <p className="text-muted-foreground">Probabilité succès : <span className="font-medium text-foreground">{d.probability ?? d.y}%</span></p>
      {(d.investment ?? d.size) && <p className="text-muted-foreground">Investissement : <span className="font-medium text-foreground">{d.investment ?? d.size}</span></p>}
    </div>
  );
}

function BubbleChart({ spec }: { spec: ChartSpec }) {
  // data items: { name, x, y, z (size), color? }
  const scatterData = spec.data.map(d => ({
    ...d,
    x: Number(d.x ?? d.roi ?? d.valeur ?? d.performance ?? 0),
    y: Number(d.y ?? d.risk ?? d.risque ?? d.probability ?? 50),
    z: Number(d.z ?? d.size ?? d.investment ?? d.taille ?? 40),
  }));

  const xs = scatterData.map(d => d.x);
  const ys = scatterData.map(d => d.y);
  const xMin = Math.max(0, Math.floor(Math.min(...xs) * 0.8));
  const xMax = Math.ceil(Math.max(...xs) * 1.2);
  const yMin = Math.max(0, Math.floor(Math.min(...ys) * 0.8));
  const yMax = Math.ceil(Math.max(...ys) * 1.2);
  const xMid = Math.round((xMin + xMax) / 2);
  const yMid = Math.round((yMin + yMax) / 2);

  return (
    <div className="my-4 rounded-2xl bg-foreground/[0.02] p-4">
      {spec.title && <p className="text-[13px] font-semibold text-foreground mb-1.5 tracking-tight">{spec.title}</p>}
      {spec.subtitle && <p className="text-[13px] text-muted-foreground/80 mb-2.5">{spec.subtitle}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 10 }}>
          <XAxis
            type="number" dataKey="x" domain={[xMin, xMax]}
            label={{ value: spec.xLabel ?? "X", position: "insideBottom", offset: -12, fontSize: 13 }}
            tick={{ fontSize: 13 }} tickCount={5}
          />
          <YAxis
            type="number" dataKey="y" domain={[yMin, yMax]}
            label={{ value: spec.yLabel ?? "Y", angle: -90, position: "insideLeft", offset: 12, fontSize: 13 }}
            tick={{ fontSize: 13 }} tickCount={5} width={32}
          />
          <ZAxis type="number" dataKey="z" range={[300, 1200]} />
          <ReferenceLine x={xMid} stroke="var(--border)" strokeDasharray="3 3" />
          <ReferenceLine y={yMid} stroke="var(--border)" strokeDasharray="3 3" />
          <Tooltip content={<BubbleTooltip />} />
          <Scatter
            data={scatterData}
            shape={(props: any) => {
              const { cx, cy, payload } = props;
              const colors = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#f43f5e"];
              const idx = spec.data.findIndex(d => d.name === payload.name);
              const fill = typeof payload.color === "string" ? payload.color : colors[idx % colors.length];
              const r = Math.max(14, Math.min(32, Math.sqrt(Number(payload.z ?? 40)) * 2));
              const label = String(payload.name ?? "").split(" ")[0].slice(0, 8);
              return (
                <g>
                  <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.8} stroke={fill} strokeWidth={1.5} />
                  <text x={cx} y={cy + r + 13} textAnchor="middle" fontSize={12} fill="#334155" fontWeight="700">{label}<title>{String(payload.name ?? "")}</title></text>
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Waterfall Chart (margin/cash decomposition) ───────────────────────────────

function WaterfallBar(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const isNeg = (payload.value as number) < 0;
  const isTotal = payload.isTotal;
  const fill = isTotal ? "#6366f1" : isNeg ? "#ef4444" : "#10b981";
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={fill} fillOpacity={0.85} rx={2} />;
}

function WaterfallChart({ spec }: { spec: ChartSpec }) {
  // data items: { name, value (signed — negative = decrease), isTotal? }
  let running = 0;
  const bars = spec.data.map((d, i) => {
    const val = Number(d.value ?? 0);
    const isTotal = Boolean(d.isTotal) || i === spec.data.length - 1;
    const base = isTotal ? 0 : running;
    if (!isTotal) running += val;
    return { ...d, base, display: isTotal ? running : val, value: val, isTotal };
  });

  return (
    <div className="my-4 rounded-2xl bg-foreground/[0.02] p-4">
      {spec.title && <p className="text-[13px] font-semibold text-foreground mb-1.5 tracking-tight">{spec.title}</p>}
      {spec.subtitle && <p className="text-[13px] text-muted-foreground/80 mb-2.5">{spec.subtitle}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={bars} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
          <XAxis dataKey="name" tick={{ fontSize: 13 }} />
          <YAxis tick={{ fontSize: 13 }} />
          <Tooltip formatter={(v: any, n: string, p: any) => [p.payload.display, p.payload.name]} />
          <Bar dataKey="display" shape={<WaterfallBar />} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-1 text-[12px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> Hausse</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500 inline-block" /> Baisse</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-500 inline-block" /> Total</span>
      </div>
    </div>
  );
}

// ── Robust JSON parser (handles LLM formatting artifacts) ────────────────────

function parseChartSafe(raw: string): ChartSpec | null {
  // Try 1: direct
  try { return JSON.parse(raw.trim()) as ChartSpec; } catch {}

  // Try 2: extract outermost { ... }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let s = raw.slice(start, end + 1);

  // Try 3: parse extracted
  try { return JSON.parse(s) as ChartSpec; } catch {}

  // Try 4: fix common LLM JSON artifacts
  s = s
    .replace(/,(\s*[}\]])/g, "$1")                               // trailing commas
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // unquoted keys
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');       // single-quoted values

  try { return JSON.parse(s) as ChartSpec; } catch {}

  return null;
}

// ── Table chart ───────────────────────────────────────────────────────────────

function TableChart({ spec }: { spec: ChartSpec }) {
  if (!spec.data.length) return null;
  const cols = spec.columns ?? Object.keys(spec.data[0]);
  return (
    <div className="my-4 rounded-2xl bg-foreground/[0.02] p-4 overflow-x-auto">
      {spec.title && <p className="text-[13px] font-semibold text-foreground mb-1.5 tracking-tight">{spec.title}</p>}
      {spec.subtitle && <p className="text-[13px] text-muted-foreground/80 mb-2.5">{spec.subtitle}</p>}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {cols.map(c => (
              <th key={c} className="text-left py-1.5 pr-3 font-semibold text-muted-foreground whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.data.map((row, i) => (
            <tr key={i} className={`border-b border-border/40 ${i % 2 === 0 ? "" : "bg-foreground/[0.02]"}`}>
              {cols.map(c => {
                const val = row[c];
                const isNum = typeof val === "number";
                const isPos = isNum && val > 0;
                const isNeg = isNum && val < 0;
                return (
                  <td key={c} className={`py-1.5 pr-3 ${isPos ? "text-emerald-600 dark:text-emerald-400" : isNeg ? "text-red-500" : "text-foreground"} ${isNum ? "tabular-nums font-medium" : ""}`}>
                    {val !== undefined && val !== null ? String(val) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ChartBlock ───────────────────────────────────────────────────────────

export function ChartBlock({ raw }: { raw: string }) {
  const spec = parseChartSafe(raw);
  if (!spec?.data?.length) return null;

  if (spec.type === "table") return <TableChart spec={spec} />;
  if (spec.type === "heatmap" || spec.type === "scatter") return <RiskHeatmap spec={spec} />;
  if (spec.type === "bubble") return <BubbleChart spec={spec} />;
  if (spec.type === "waterfall") return <WaterfallChart spec={spec} />;

  const dataKeys =
    spec.keys ??
    Object.keys(spec.data[0]).filter(
      (k) => k !== "name" && typeof spec.data[0][k] === "number"
    );
  if (!dataKeys.length) {
    // All string columns — fall back to table view
    return <TableChart spec={{ ...spec, type: "table" }} />;
  }
  if (spec.theme === "aura" && (spec.type === "bar" || spec.type === "line" || spec.type === "pie")) return <AuraChart spec={spec} keys={dataKeys} />;

  return (
    <div className="my-4 rounded-2xl bg-foreground/[0.02] p-4">
      {spec.title && (
        <p className="text-[13px] font-semibold text-foreground mb-1.5 tracking-tight">{spec.title}</p>
      )}
      {spec.subtitle && (
        <p className="text-[13px] text-muted-foreground/80 mb-2.5">{spec.subtitle}</p>
      )}
      <ResponsiveContainer width="100%" height={170}>
        {spec.type === "pie" ? (
          <PieChart>
            <Pie
              data={spec.data}
              dataKey={dataKeys[0]}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ name, value }: { name: string; value: number }) =>
                `${name}: ${value}`
              }
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : spec.type === "line" ? (
          <LineChart data={spec.data}>
            <XAxis dataKey="name" tick={{ fontSize: 13.5 }} />
            <YAxis tick={{ fontSize: 13.5 }} />
            <Tooltip />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={spec.color ?? COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={spec.data}>
            <XAxis dataKey="name" tick={{ fontSize: 13.5 }} />
            <YAxis tick={{ fontSize: 13.5 }} />
            <Tooltip />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={spec.color ?? COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]}>
                {spec.data.some(d => typeof d._color === "string") && spec.data.map((d, j) => <Cell key={j} fill={String(d._color ?? spec.color ?? COLORS[i % COLORS.length])} />)}
              </Bar>
            ))}
            {spec.thresholds?.map(t => <ReferenceLine key={t.label} y={t.value} stroke={t.color ?? "#d97706"} strokeDasharray="4 3" label={{ value: t.label, position: "insideTopRight", fontSize: 12, fill: t.color ?? "#d97706" }} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
