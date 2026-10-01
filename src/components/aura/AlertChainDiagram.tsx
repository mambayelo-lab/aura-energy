// Mini-schéma de la chaîne de causalité d'une alerte du cockpit :
// entité concernée → indicateur(s) et seuil → règle → décision, avec la
// tendance de l'indicateur pour cette entité. Un clic sur l'indicateur ou la
// règle ouvre l'éditeur correspondant dans le Studio.
import { Link } from "@tanstack/react-router";
import type { ArgusVocab, CausalRuleEvaluation } from "../../lib/v4/argus-vocab-store";
import { evaluateCausalRules } from "../../lib/v4/argus-vocab-store";
import { alertChain, entityTrend, type Status } from "../../lib/v4/supply-diagrams";

const COLOR: Record<Status, string> = { ok: "#0d7a54", alerte: "#a85d0f", critique: "#c0392b" };
const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

const cache = new WeakMap<ArgusVocab, CausalRuleEvaluation[]>();
export function evaluationsOf(vocab: ArgusVocab): CausalRuleEvaluation[] {
  let e = cache.get(vocab);
  if (!e) { e = evaluateCausalRules(vocab); cache.set(vocab, e); }
  return e;
}

const CSS = `
.acd{margin:8px 0 2px;display:flex;flex-direction:column;gap:6px}
.acd-chain{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px 16px;position:relative}
.acd-large .acd-chain{display:flex;flex-direction:column;gap:12px}
.acd-large .acd-step{display:grid;grid-template-columns:118px minmax(0,1fr);column-gap:10px;align-items:baseline}
.acd-large .acd-step>*:not(small){grid-column:2}
.acd-large .acd-step small{grid-row:1 / span 3}
.acd-large .acd-step:not(:last-child)::after{right:auto;left:26px;top:auto;bottom:-12px;width:0;height:10px;border-top:0;border-left:1.5px solid #c9bffd}
.acd-large .acd-step:not(:last-child)::before{right:auto;left:22.5px;top:auto;bottom:-14px;border-top:5px solid #c9bffd;border-left:3.5px solid transparent;border-right:3.5px solid transparent;border-bottom:0}
.acd:not(.acd-large) .acd-step{flex:0 1 auto;max-width:100%;padding:3px 8px;border-radius:999px;flex-direction:row;align-items:center;gap:5px}
.acd:not(.acd-large) .acd-step small,.acd:not(.acd-large) .acd-step span{display:none}
.acd:not(.acd-large) .acd-step b{max-width:150px}
.acd-step{position:relative;border:1px solid #e8e5f8;border-radius:8px;padding:5px 7px;background:#faf9ff;min-width:0;display:flex;flex-direction:column;gap:1px;text-decoration:none;color:inherit}
.acd-step:not(:last-child)::after{content:"";position:absolute;right:-12px;top:50%;width:10px;height:0;border-top:1.5px solid #c9bffd}
.acd-step:not(:last-child)::before{content:"";position:absolute;right:-13px;top:calc(50% - 3.5px);border-left:5px solid #c9bffd;border-top:3.5px solid transparent;border-bottom:3.5px solid transparent}
a.acd-step:hover{border-color:#7c3aed;background:#f0ecff}
.acd-step small{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#9585c4}
.acd-step b{font-size:11.5px;font-weight:750;color:#1a1433;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acd-step span{font-size:11px;color:#4c3d7a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acd-large .acd-step{padding:8px 10px}
.acd-large .acd-step b{font-size:13px;white-space:normal}
.acd-large .acd-step span{font-size:12px;white-space:normal}
.acd-consequence{background:#fff7f5;border-color:#f3d2c8}
.acd-trend{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#5b5f7a}
.acd-trend svg{flex:none}
`;

export function AlertChainDiagram({ vocab, ruleId, large = false }: { vocab: ArgusVocab | undefined; ruleId: string; large?: boolean }) {
  if (!vocab) return null;
  const evaluation = evaluationsOf(vocab).find(e => e.rule.id === ruleId);
  if (!evaluation?.triggered) return null;
  const chain = alertChain(vocab, evaluation);
  const main = chain.indicators[0];
  const record = evaluation.matches[0]?.facts.find(f => f.kpiId === main?.kpiId)?.record;
  const trend = main ? entityTrend(vocab, main.kpiId, record) : undefined;
  return (
    <div className={`acd${large ? " acd-large" : ""}`} data-testid="alert-chain" aria-label={`Chaîne de causalité de ${chain.rule.label}`}>
      <style>{CSS}</style>
      <div className="acd-chain">
        <div className="acd-step" title={chain.entity}>
          <small>{chain.scope ?? "Entité"}</small>
          <b>{chain.entity ?? "ensemble des données"}</b>
          <span>{chain.others ? `+${chain.others} autre${chain.others > 1 ? "s" : ""}` : "seule concernée"}</span>
        </div>
        <Link to="/cockpit/studio" search={{ tab: "vocab" }} className="acd-step" title="Modifier les seuils dans le Studio" style={{ borderColor: main ? COLOR[main.status] : undefined }}>
          <small>Indicateur{chain.indicators.length > 1 ? "s" : ""}</small>
          {chain.indicators.slice(0, large ? 4 : 2).map(i => (
            <b key={i.kpiId} style={{ color: COLOR[i.status] }} title={i.label}>{fmt(i.value)} {i.sens} {fmt(i.seuil)}{large ? ` ${i.unit} · ${i.label}` : ""}</b>
          ))}
          {!large && main && <span title={main.label}>{main.label}</span>}
        </Link>
        <Link to="/cockpit/studio" search={{ tab: "rules" }} className="acd-step" title="Modifier la règle dans le Studio">
          <small>{chain.rule.conditions > 1 ? "Règle causale" : "Alerte"}</small>
          <b title={chain.rule.label}>{chain.rule.label}</b>
          <span>{chain.rule.conditions} condition{chain.rule.conditions > 1 ? "s" : ""}</span>
        </Link>
        {chain.consequences.map((c, i) => (
          <div key={c} className="acd-step acd-consequence" title={c} data-testid="alert-consequence">
            <small>{i === 0 ? "Conséquence" : "Puis"}</small>
            <b>{c}</b>
          </div>
        ))}
        <div className="acd-step" title={chain.decision}>
          <small>Décision</small>
          <b>{chain.decision}</b>
        </div>
      </div>
      {trend && <TrendLine points={trend.points} source={trend.source} status={main?.status ?? "ok"} unit={main?.unit ?? ""} />}
    </div>
  );
}

function TrendLine({ points, source, status, unit }: { points: { label: string; value: number }[]; source: string; status: Status; unit: string }) {
  const W = 96, H = 26;
  const vals = points.map(p => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const x = (i: number) => 3 + (i * (W - 6)) / Math.max(1, points.length - 1);
  const y = (v: number) => hi === lo ? H / 2 : H - 3 - ((v - lo) * (H - 6)) / (hi - lo);
  const first = points[0], last = points[points.length - 1];
  const delta = last.value - first.value;
  return (
    <div className="acd-trend" data-testid="alert-trend">
      <svg width={W} height={H} role="img" aria-label={`Tendance ${points.map(p => `${p.label} ${fmt(p.value)}`).join(", ")}`}>
        <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke={COLOR[status]} strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={2.8} fill={COLOR[status]} />
      </svg>
      <span>Tendance : {fmt(first.value)} → {fmt(last.value)} {unit} ({delta >= 0 ? "+" : ""}{fmt(delta)}) · {source === "série" ? `${points.length} points, ${first.label} → ${last.label}` : "évaluation précédente publiée par la source"}</span>
    </div>
  );
}
