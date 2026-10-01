// Schémas du Studio Supply : graphe de l'ontologie (Modéliser → Objets métier)
// et graphe causal des règles (Raisonner → Règles & alertes). Rendu SVG pur,
// aux couleurs du thème (variables --v4-*). Ce qui se règle simplement se
// règle sur le schéma (cardinalité, seuils, attribut) ; le reste renvoie vers
// l'éditeur existant.
import { useMemo, useRef, useState } from "react";
import type { ArgusVocab, BusinessEntity, RelationshipCardinality } from "../../../lib/v4/argus-vocab-store";
import { evaluateCausalRules } from "../../../lib/v4/argus-vocab-store";
import {
  causalFlow, entityDetail, nextCardinality, ONTOLOGY_VIEW, ontologyGraph, setRelationshipCardinality,
  type FlowKpi, type OntologyNode, type Status, ATTR_H, NODE_W,
} from "../../../lib/v4/supply-diagrams";
import { setMappingPrefill } from "../../../lib/v4/supply-lineage";
import { removeKpi, updateKpi } from "../../../lib/v4/studio-editing";
import { suggestEntityModel } from "../../../lib/v4/argus-llm";

const STATUS: Record<Status, string> = { ok: "var(--v4-green, #0d7a54)", alerte: "var(--v4-amber, #a85d0f)", critique: "var(--v4-red, #c0392b)" };
const STATUS_LABEL: Record<Status, string> = { ok: "dans les seuils", alerte: "alerte", critique: "critique" };
const fmt = (n: number | undefined) => n === undefined ? "—" : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const cut = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;

export const DIAGRAM_CSS = `
.sd-graph{border:1px solid var(--v4-border);border-radius:12px;background:linear-gradient(180deg,var(--v4-panel,#faf9ff),var(--v4-surface,#fff));padding:12px;margin-bottom:16px}
.sd-graph-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 4px 8px}
.sd-graph-head b{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--v4-text2)}
.sd-graph-head span{font-size:12.5px;color:var(--v4-text3)}
.sd-legend{display:flex;gap:12px;margin-left:auto;font-size:12px;color:var(--v4-text3)}
.sd-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.sd-split{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;align-items:start}
@media (max-width:1100px){.sd-split{grid-template-columns:minmax(0,1fr)}}
.sd-svg{width:100%;height:auto;display:block}
@media (max-width:700px){.sd-onto-wrap{overflow-x:auto}.sd-onto-wrap .sd-svg{min-width:880px}}
.sd-svg text{font-family:var(--font-sans,inherit)}
.sd-node{cursor:pointer}
.sd-node:focus-visible{outline:none}
.sd-node:focus-visible rect.sd-box{stroke:var(--v4-accent);stroke-width:2.5}
.sd-card{cursor:pointer}
.sd-card:hover rect.sd-box{stroke:var(--v4-accent)}
.sd-rel{cursor:pointer}
.sd-rel:hover rect{fill:var(--v4-accent-bg)}
.sd-panel{border:1px solid var(--v4-border);border-radius:10px;background:var(--v4-surface);padding:12px 14px;font-size:13px;color:var(--v4-text2);display:flex;flex-direction:column;gap:10px}
.sd-entity{margin-top:10px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr);gap:16px}
.sd-entity>div{display:flex;flex-direction:column;gap:8px;min-width:0}
@media (max-width:900px){.sd-entity{grid-template-columns:minmax(0,1fr)}}
.sd-panel h4{margin:0;font-size:15px;color:var(--v4-text)}
.sd-panel h5{margin:0;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--v4-text3)}
.sd-panel ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.sd-panel li{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.sd-panel code{font-size:11.5px;background:var(--v4-bg);border:1px solid var(--v4-border);border-radius:4px;padding:0 4px;color:var(--v4-text2)}
.sd-panel small{color:var(--v4-text3)}
.sd-dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
.sd-panel input,.sd-panel select{font:inherit;font-size:12.5px;border:1px solid var(--v4-border2);border-radius:6px;padding:3px 6px;background:var(--v4-surface);color:var(--v4-text)}
.sd-panel input[type=number]{width:64px}
.sd-panel button,.sd-link{font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--v4-border2);background:var(--v4-surface);color:var(--v4-accent);border-radius:6px;padding:3px 9px;cursor:pointer}
.sd-kpi-edit{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px dashed var(--v4-border);padding-top:6px}
`;


// Glisser un nœud de schéma : en dessous de 4 px c'est un clic ; au-delà, la
// nouvelle position est remise à onDrop (unités du viewBox).
export function useNodeDrag(svgRef: React.RefObject<SVGSVGElement | null>, onDrop: (id: string, dx: number, dy: number) => void, onClick: (id: string) => void) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const cur = useRef<{ id: string; x: number; y: number; scale: number; moved: boolean; dx: number; dy: number } | null>(null);
  const bind = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      cur.current = { id, x: e.clientX, y: e.clientY, scale: svgRef.current?.getScreenCTM()?.a ?? 1, moved: false, dx: 0, dy: 0 };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const c = cur.current;
      if (!c || c.id !== id) return;
      c.dx = (e.clientX - c.x) / c.scale; c.dy = (e.clientY - c.y) / c.scale;
      if (!c.moved && Math.hypot(c.dx, c.dy) < 4) return;
      c.moved = true;
      setDrag({ id, dx: c.dx, dy: c.dy });
    },
    onPointerUp: () => {
      const c = cur.current;
      cur.current = null;
      if (!c || c.id !== id) return;
      setDrag(null);
      if (c.moved) onDrop(id, c.dx, c.dy); else onClick(id);
    },
    style: { cursor: "grab", touchAction: "none" } as React.CSSProperties,
  });
  return { drag, bind };
}
const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

// ── Graphe de l'ontologie ───────────────────────────────────────────────────
export function OntologyGraph({ vocab, onUpdate, onOpenTab }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void; onOpenTab?: (tab: string) => void }) {
  // Tout est replié par défaut ; un clic sur un objet le déplie dans le graphe.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const base = useMemo(() => ontologyGraph(vocab, expanded), [vocab, expanded]);
  const withPos = (id: string, dx: number, dy: number): ArgusVocab => {
    const a = base.nodes.find(n => n.id === id)!.anchor;
    const x = Math.max(NODE_W / 2 + 4, Math.min(ONTOLOGY_VIEW.width - NODE_W / 2 - 4, a.x + dx)), y = Math.max(30, a.y + dy);
    return { ...vocab, layout: { ...vocab.layout, ontologie: { ...vocab.layout?.ontologie, [id]: { x: Math.round(x), y: Math.round(y) } } } };
  };
  const { drag, bind } = useNodeDrag(svgRef, (id, dx, dy) => onUpdate(withPos(id, dx, dy)), id => toggle(id));
  const { nodes, edges, height } = useMemo(() => drag ? ontologyGraph(withPos(drag.id, drag.dx, drag.dy), expanded) : base, [drag, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const addObject = () => {
    const id = crypto.randomUUID();
    onUpdate({ ...vocab, entities: [...(vocab.entities ?? []), { id, name: "Nouvel objet", attributes: [] }] });
    setSelected(id);
  };
  const [genState, setGenState] = useState<"idle" | "loading" | string>("idle");
  // Modèle de départ proposé par l'IA pour le domaine : ajouté, jamais substitué.
  async function generate() {
    if (!vocab.domaine?.trim()) return;
    setGenState("loading");
    const r = await suggestEntityModel({ data: { domaine: vocab.domaine } });
    if (!r.ok || !r.entities) { setGenState(r.error ?? "Génération indisponible."); return; }
    const idByName = new Map<string, string>();
    const ents: BusinessEntity[] = r.entities.map(e => { const id = crypto.randomUUID(); idByName.set(e.name, id); return { id, name: e.name, description: e.description || undefined, attributes: e.attributes.map(a => ({ id: crypto.randomUUID(), name: a, type: "text" as const })) }; });
    const rels = (r.relationships ?? []).flatMap(x => { const f = idByName.get(x.from), t = idByName.get(x.to); return f && t ? [{ id: crypto.randomUUID(), fromEntityId: f, toEntityId: t, label: x.label, cardinality: x.cardinality }] : []; });
    onUpdate({ ...vocab, entities: [...(vocab.entities ?? []), ...ents], relationships: [...(vocab.relationships ?? []), ...rels] });
    setGenState("idle");
  }
  const reorganize = () => { const { ontologie: _o, ...rest } = vocab.layout ?? {}; onUpdate({ ...vocab, layout: rest }); };
  const toggle = (id: string) => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allOpen = nodes.length > 0 && nodes.every(n => expanded.has(n.id));
  const mapAttr = (attrId: string) => { setMappingPrefill(`a:${attrId}`); onOpenTab?.("mapping"); };
  if (!nodes.length) return (
    <div className="sd-graph" data-testid="ontology-graph"><style>{DIAGRAM_CSS}</style>
      <div className="sd-graph-head"><b>Graphe de l'ontologie</b><span>Aucun objet : chargez le modèle Supply Chain ou ajoutez un objet.</span>
        <button type="button" className="sd-link" onClick={addObject}>+ Objet</button></div>
    </div>
  );
  const byId = new Map(nodes.map(n => [n.id, n]));
  const active = selected && byId.has(selected) ? selected : null;
  const cycle = (id: string, c: RelationshipCardinality) => onUpdate(setRelationshipCardinality(vocab, id, nextCardinality(c)));
  return (
    <div className="sd-graph" data-testid="ontology-graph">
      <style>{DIAGRAM_CSS}</style>
      <div className="sd-graph-head">
        <b>Graphe de l'ontologie</b>
        <span>{nodes.length} objets · {edges.length} relations · cliquer un objet pour le déplier</span>
        <button type="button" className="sd-link" onClick={() => setExpanded(allOpen ? new Set() : new Set(nodes.map(n => n.id)))}>{allOpen ? "Tout replier" : "Tout déplier"}</button>
        <button type="button" className="sd-link" onClick={addObject}>+ Objet</button>
        {vocab.domaine?.trim() && <button type="button" className="sd-link" onClick={() => void generate()} disabled={genState === "loading"} title={typeof genState === "string" && genState !== "idle" && genState !== "loading" ? genState : "Proposer des objets pour le domaine"}>{genState === "loading" ? "…" : "✦ Générer par IA"}</button>}
        <button type="button" className="sd-link" onClick={reorganize} disabled={!vocab.layout?.ontologie} title="Relancer la mise en page automatique">Réorganiser</button>
        <span className="sd-legend">
          <span><i style={{ background: STATUS.ok }} />dans les seuils</span>
          <span><i style={{ background: STATUS.alerte }} />alerte</span>
          <span><i style={{ background: STATUS.critique }} />critique</span>
        </span>
      </div>
      <div className="sd-onto-wrap">
        <svg ref={svgRef} className="sd-svg" viewBox={`0 0 ${ONTOLOGY_VIEW.width} ${height}`} role="group" aria-label="Graphe de l'ontologie Supply Chain">
          {edges.map(e => {
            const hot = active === e.from || active === e.to;
            return <path key={e.id} d={e.path} fill="none" style={{ stroke: hot ? "var(--v4-accent)" : "var(--v4-border2)", strokeWidth: hot ? 2.2 : 1.6 }} />;
          })}
          {edges.map(e => {
            const hot = active === e.from || active === e.to;
            const text = `${e.label} · ${e.cardinality}`;
            const w = text.length * 7.2 + 20;
            return (
              <g key={`l-${e.id}`}>
                <text x={e.fromEnd.x} y={e.fromEnd.y} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: hot ? "var(--v4-accent)" : "var(--v4-text3)" }}>{e.fromEnd.text}</text>
                <text x={e.toEnd.x} y={e.toEnd.y} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: hot ? "var(--v4-accent)" : "var(--v4-text3)" }}>{e.toEnd.text}</text>
                <g className="sd-rel" role="button" tabIndex={0} aria-label={`${byId.get(e.from)?.name} ${e.label} ${byId.get(e.to)?.name} (${e.cardinality}) : changer la cardinalité`}
                  onClick={() => cycle(e.id, e.cardinality)} onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); cycle(e.id, e.cardinality); } }}>
                  <title>Cliquer pour changer la cardinalité (1-1 → 1-N → N-N)</title>
                  <rect x={e.mid.x - w / 2} y={e.mid.y - 12} width={w} height={24} rx={12} style={{ fill: "var(--v4-surface)", stroke: hot ? "var(--v4-accent)" : "var(--v4-border)" }} />
                  <text x={e.mid.x} y={e.mid.y + 4} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 650, fill: "var(--v4-text2)" }}>{text}</text>
                </g>
              </g>
            );
          })}
          {nodes.map(n => <EntityNode key={n.id} n={n} selected={active === n.id} drag={bind(n.id)} onSelect={() => toggle(n.id)} onDetail={() => setSelected(active === n.id ? null : n.id)} onMap={mapAttr} />)}
        </svg>
        {active && <EntityPanel vocab={vocab} entityId={active} onUpdate={onUpdate} onOpenTab={onOpenTab} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function EntityNode({ n, selected, drag, onSelect, onDetail, onMap }: { n: OntologyNode; selected: boolean; drag: ReturnType<ReturnType<typeof useNodeDrag>["bind"]>; onSelect: () => void; onDetail: () => void; onMap: (attrId: string) => void }) {
  const x = n.x - n.w / 2;
  const worst: Status = n.kpis.some(k => k.status === "critique") ? "critique" : n.kpis.some(k => k.status === "alerte") ? "alerte" : "ok";
  return (
    <g className="sd-node" role="button" tabIndex={0} aria-pressed={selected} aria-expanded={!!n.attributes} aria-label={`Objet ${n.name}`}
      {...drag} onDoubleClick={onDetail} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}>
      <rect className="sd-box" x={x} y={n.y} width={n.w} height={n.h} rx={12}
        style={{ fill: selected ? "var(--v4-accent-bg)" : "var(--v4-surface)", stroke: selected ? "var(--v4-accent)" : "var(--v4-border2)", strokeWidth: selected ? 2.2 : 1.4, filter: "drop-shadow(0 2px 4px rgba(76,61,122,.10))" }} />
      <rect x={x} y={n.y} width={5} height={n.h} rx={2.5} style={{ fill: n.kpis.length ? STATUS[worst] : "var(--v4-accent-border)" }} />
      <text x={x + 16} y={n.y + 22} style={{ fontSize: 14.5, fontWeight: 800, fill: "var(--v4-text)" }}>{cut(n.name, n.attributes ? 26 : 16)}</text>
      <text x={x + 16} y={n.y + 39} style={{ fontSize: 12.5, fill: n.mappedCount < n.attributeCount ? "var(--v4-amber)" : "var(--v4-text3)" }}>{n.mappedCount}/{n.attributeCount} attributs sourcés</text>
      <text x={x + n.w - 14} y={n.y + 22} textAnchor="end" style={{ fontSize: 12.5, fill: "var(--v4-text3)" }}>{n.attributes ? "▾" : "▸"}</text>
      <g role="button" tabIndex={0} aria-label={`Détail de ${n.name}`} {...stop} onClick={e => { e.stopPropagation(); onDetail(); }} onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onDetail(); } }} style={{ cursor: "pointer" }}>
        <title>Seuils et relations</title>
        <circle cx={x + n.w - 34} cy={n.y + 18} r={8} style={{ fill: "var(--v4-bg)", stroke: "var(--v4-border2)" }} />
        <text x={x + n.w - 34} y={n.y + 22} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 800, fill: "var(--v4-text3)" }}>i</text>
      </g>
      <title>{`${n.name}${n.keys.length ? ` — clé ${n.keys.join(" + ")}` : ""}${n.description ? ` — ${n.description}` : ""}`}</title>
      {n.kpis.map((k, i) => {
        const y = n.y + 50 + i * 26;
        return (
          <g key={k.id}>
            <title>{`${k.label} : ${fmt(k.value)} ${k.unit} (${STATUS_LABEL[k.status]}) — alerte ${k.direction === "au_dessus_alerte" ? "≥" : "≤"} ${k.seuilAlerte}, critique ${k.seuilCritique}`}</title>
            <rect x={x + 10} y={y} width={n.w - 20} height={22} rx={11} style={{ fill: "var(--v4-bg)", stroke: STATUS[k.status], strokeWidth: 1 }} />
            <circle cx={x + 21} cy={y + 11} r={4} style={{ fill: STATUS[k.status] }} />
            <text x={x + 30} y={y + 15.5} style={{ fontSize: 12.5, fontWeight: 650, fill: "var(--v4-text2)" }}>{cut(k.label, 18)}</text>
            <text x={x + n.w - 16} y={y + 15.5} textAnchor="end" style={{ fontSize: 12.5, fontWeight: 800, fill: STATUS[k.status] }}>{fmt(k.value)}</text>
          </g>
        );
      })}
      {n.attributes?.map((a, i) => {
        const y = n.y + n.baseH + 4 + i * ATTR_H;
        const right = [a.value !== undefined ? cut(a.value, 16) : undefined, a.fresh].filter(Boolean).join(" · ");
        const maxChars = Math.floor((n.w - 40) / 6.6);
        return (
          <g key={a.id} data-attr={a.id}>
            <line x1={x + 10} x2={x + n.w - 10} y1={y} y2={y} style={{ stroke: "var(--v4-border)" }} />
            <text x={x + 14} y={y + 16} style={{ fontSize: 12.5, fontWeight: 700, fill: "var(--v4-text)" }}>{cut(a.name, Math.floor((n.w - 90) / 7))}<title>{a.name}</title></text>
            <text x={x + n.w - 12} y={y + 16} textAnchor="end" style={{ fontSize: 12.5, fill: "var(--v4-text3)" }}>{a.type}</text>
            {a.source ? (
              <g>
                <title>{`${a.source}${a.count ? ` — ${a.count} valeur(s) lue(s)` : ""}`}</title>
                <rect x={x + 12} y={y + 22} width={n.w - 24} height={19} rx={9.5} style={{ fill: "var(--v4-accent-bg)" }} />
                <text x={x + 20} y={y + 36} style={{ fontSize: 12.5, fontWeight: 650, fill: "var(--v4-accent2)" }}>{cut(a.source, maxChars)}</text>
                {right && <text x={x + 14} y={y + 58} style={{ fontSize: 12.5, fill: "var(--v4-text2)" }}>{cut(right, maxChars + 4)}<title>{right}</title></text>}
              </g>
            ) : (
              <g role="button" tabIndex={0} aria-label={`Mapper ${n.name} · ${a.name}`} style={{ cursor: "pointer" }} {...stop}
                onClick={e => { e.stopPropagation(); onMap(a.id); }} onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onMap(a.id); } }}>
                <rect x={x + 12} y={y + 22} width={84} height={19} rx={9.5} style={{ fill: "var(--v4-amber-bg, #fff8ed)", stroke: "var(--v4-amber)" }} />
                <text x={x + 54} y={y + 36} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 800, fill: "var(--v4-amber)" }}>à mapper</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

function EntityPanel({ vocab, entityId, onUpdate, onOpenTab, onClose }: { vocab: ArgusVocab; entityId: string; onUpdate: (v: ArgusVocab) => void; onOpenTab?: (tab: string) => void; onClose: () => void }) {
  const d = entityDetail(vocab, entityId);
  const [attr, setAttr] = useState("");
  const [rel, setRel] = useState({ to: "", label: "", card: "1-N" as RelationshipCardinality, out: true });
  if (!d) return null;
  const entities = vocab.entities ?? [];
  const setEntity = (patch: Partial<BusinessEntity>) => onUpdate({ ...vocab, entities: entities.map(e => e.id === entityId ? { ...e, ...patch } : e) });
  const addAttribute = () => {
    const name = attr.trim();
    if (!name) return;
    setEntity({ attributes: [...d.entity.attributes, { id: `${entityId}.${crypto.randomUUID().slice(0, 8)}`, name, type: "text" }] });
    setAttr("");
  };
  const removeAttribute = (id: string) => onUpdate({
    ...vocab,
    entities: entities.map(e => e.id === entityId ? { ...e, attributes: e.attributes.filter(a => a.id !== id) } : e),
    entityMappings: (vocab.entityMappings ?? []).filter(m => m.attributeId !== id),
  });
  const removeObject = () => {
    if (!window.confirm(`Supprimer l'objet « ${d.entity.name} », ses relations et ses branchements ?`)) return;
    onUpdate({
      ...vocab,
      entities: entities.filter(e => e.id !== entityId),
      relationships: (vocab.relationships ?? []).filter(r => r.fromEntityId !== entityId && r.toEntityId !== entityId),
      entityMappings: (vocab.entityMappings ?? []).filter(m => m.entityId !== entityId),
      kpis: vocab.kpis.map(k => k.entityId === entityId ? { ...k, entityId: undefined } : k),
    });
    onClose();
  };
  const addRelation = () => {
    if (!rel.to || !rel.label.trim()) return;
    const [from, to] = rel.out ? [entityId, rel.to] : [rel.to, entityId];
    onUpdate({ ...vocab, relationships: [...(vocab.relationships ?? []), { id: crypto.randomUUID(), fromEntityId: from, toEntityId: to, label: rel.label.trim(), cardinality: rel.card }] });
    setRel({ ...rel, label: "" });
  };
  const unattached = vocab.kpis.filter(k => !d.kpis.some(x => x.id === k.id));
  return (
    <aside className="sd-panel" aria-label={`Détail de l'objet ${d.entity.name}`} style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input aria-label="Nom de l'objet" value={d.entity.name} onChange={e => setEntity({ name: e.target.value })} style={{ fontSize: 15, fontWeight: 800, minWidth: 180 }} />
        <input aria-label="Description de l'objet" value={d.entity.description ?? ""} placeholder="Description" onChange={e => setEntity({ description: e.target.value || undefined })} style={{ flex: 1, minWidth: 200 }} />
        {onOpenTab && <button type="button" className="sd-link" onClick={() => onOpenTab("mapping")}>Mapper →</button>}
        <button type="button" className="sd-link" style={{ color: "#b91c1c" }} onClick={removeObject}>Supprimer l'objet</button>
        <button type="button" className="sd-link" onClick={onClose} aria-label="Fermer le détail">×</button>
      </div>
      <div className="sd-entity">
      <div>
      <h5>Indicateurs ({d.kpis.length})</h5>
      {d.kpis.map(k => (
        <div key={k.id}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="sd-dot" style={{ background: STATUS[k.status] }} />
            <input aria-label={`Libellé de ${k.label}`} value={k.label} onChange={e => onUpdate(updateKpi(vocab, k.id, { label: e.target.value }))} style={{ flex: 1, fontWeight: 700 }} />
            <span style={{ fontWeight: 800, color: STATUS[k.status] }}>{fmt(k.value)}</span>
            <button type="button" aria-label={`Détacher ${k.label}`} title="Détacher de l'objet" onClick={() => onUpdate(updateKpi(vocab, k.id, { entityId: undefined }))}>×</button>
          </div>
          <small>{k.field ? <>← <code>{k.field}</code></> : "non mappé"}</small>
          <div className="sd-kpi-edit">
            <label>alerte {k.direction === "au_dessus_alerte" ? "≥" : "≤"} <input type="number" aria-label={`Seuil d'alerte de ${k.label}`} value={k.seuilAlerte} onChange={e => onUpdate(updateKpi(vocab, k.id, { seuilAlerte: Number(e.target.value) }))} /></label>
            <label>critique <input type="number" aria-label={`Seuil critique de ${k.label}`} value={k.seuilCritique} onChange={e => onUpdate(updateKpi(vocab, k.id, { seuilCritique: Number(e.target.value) }))} /></label>
          </div>
        </div>
      ))}
      {unattached.length > 0 && (
        <select aria-label={`Rattacher un indicateur à ${d.entity.name}`} value="" onChange={e => e.target.value && onUpdate(updateKpi(vocab, e.target.value, { entityId }))}>
          <option value="">+ Rattacher un indicateur…</option>
          {unattached.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      )}
      </div>
      <div>
      <h5>Attributs et mappings ({d.attributes.filter(a => a.field).length}/{d.attributes.length})</h5>
      <ul>
        {d.attributes.map(a => (
          <li key={a.id}>
            <span className="sd-dot" style={{ background: a.field ? (a.count ? STATUS.ok : STATUS.alerte) : "var(--v4-border2)" }} />
            <input aria-label={`Nom de l'attribut ${a.name}`} value={a.name} onChange={e => setEntity({ attributes: d.entity.attributes.map(x => x.id === a.id ? { ...x, name: e.target.value } : x) })} style={{ fontWeight: 650, minWidth: 0, flex: 1 }} />
            <button type="button" aria-label={`Supprimer l'attribut ${a.name}`} onClick={() => removeAttribute(a.id)}>×</button>
            {a.field ? <small style={{ width: "100%" }}>← <code>{a.field}</code>{a.master ? " · MASTER" : ""}</small> : <small style={{ width: "100%" }}>non branché</small>}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={attr} onChange={e => setAttr(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addAttribute(); }} placeholder="+ attribut" aria-label={`Nouvel attribut de ${d.entity.name}`} style={{ flex: 1 }} />
        <button type="button" onClick={addAttribute} disabled={!attr.trim()}>Ajouter</button>
      </div>
      </div>
      <div>
      <h5>Relations ({d.relations.length})</h5>
      <ul>
        {d.relations.map(r => (
          <li key={r.id}>
            <span style={{ flex: 1 }}>{r.outgoing ? `${r.label} → ${r.other}` : `${r.other} ${r.label} →`}</span>
            <select aria-label={`Cardinalité ${r.label} ${r.other}`} value={r.cardinality} onChange={e => onUpdate(setRelationshipCardinality(vocab, r.id, e.target.value as RelationshipCardinality))}>
              <option value="1-1">1-1</option><option value="1-N">1-N</option><option value="N-N">N-N</option>
            </select>
            <button type="button" aria-label={`Supprimer la relation ${r.label} ${r.other}`} onClick={() => onUpdate({ ...vocab, relationships: (vocab.relationships ?? []).filter(x => x.id !== r.id) })}>×</button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <select aria-label="Sens de la nouvelle relation" value={rel.out ? "out" : "in"} onChange={e => setRel({ ...rel, out: e.target.value === "out" })}><option value="out">{d.entity.name} →</option><option value="in">→ {d.entity.name}</option></select>
        <input aria-label="Libellé de la nouvelle relation" value={rel.label} onChange={e => setRel({ ...rel, label: e.target.value })} placeholder="ex. livre" style={{ width: 90 }} />
        <select aria-label="Objet relié" value={rel.to} onChange={e => setRel({ ...rel, to: e.target.value })}><option value="">objet…</option>{entities.filter(e => e.id !== entityId).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select aria-label="Cardinalité de la nouvelle relation" value={rel.card} onChange={e => setRel({ ...rel, card: e.target.value as RelationshipCardinality })}><option value="1-1">1-1</option><option value="1-N">1-N</option><option value="N-N">N-N</option></select>
        <button type="button" onClick={addRelation} disabled={!rel.to || !rel.label.trim()}>+ Relation</button>
      </div>
      </div>
      </div>
    </aside>
  );
}

// ── Graphe causal ───────────────────────────────────────────────────────────
const COL = { kpi: 16, cond: 316, rule: 546, out: 850 };
const W = { kpi: 262, cond: 180, rule: 256, out: 330 };
const NODE_H = 38;

export function CausalFlowGraph({ vocab, onEditRule, onUpdate, visibleRuleIds }: { vocab: ArgusVocab; onEditRule: (ruleId: string) => void; onUpdate: (v: ArgusVocab) => void; visibleRuleIds?: Set<string> }) {
  const flow = useMemo(() => causalFlow(vocab, evaluateCausalRules(vocab).filter(e => !visibleRuleIds || visibleRuleIds.has(e.rule.id))), [vocab, visibleRuleIds]);
  const [kpiSel, setKpiSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Nœuds déplaçables : décalage mémorisé par nœud (clé « k: », « c: », « r: », « o: »).
  const saved = vocab.layout?.causal ?? {};
  const { drag, bind } = useNodeDrag(svgRef,
    (key, dx, dy) => { const p = saved[key] ?? { x: 0, y: 0 }; onUpdate({ ...vocab, layout: { ...vocab.layout, causal: { ...saved, [key]: { x: Math.round(p.x + dx), y: Math.round(p.y + dy) } } } }); },
    key => { if (key.startsWith("k:")) setKpiSel(k => k === key.slice(2) ? null : key.slice(2)); else onEditRule(key.startsWith("c:") ? key.slice(2).split("#")[0] : key.slice(2)); });
  const off = (key: string) => { const p = saved[key] ?? { x: 0, y: 0 }; return drag?.id === key ? { x: p.x + drag.dx, y: p.y + drag.dy } : p; };
  const moved = (key: string) => { const o = off(key); return `translate(${o.x} ${o.y})`; };
  const addKpi = () => {
    const id = crypto.randomUUID();
    onUpdate({ ...vocab, kpis: [...vocab.kpis, { id, label: "Nouvel indicateur", unit: "", direction: "au_dessus_alerte", seuilAlerte: 50, seuilCritique: 80 }] });
    setKpiSel(id);
  };
  const reorganize = () => { const { causal: _c, ...rest } = vocab.layout ?? {}; onUpdate({ ...vocab, layout: rest }); };
  if (!flow.rules.length) return <div style={{ fontSize: 13.5, color: "var(--v4-text3)", marginBottom: 16 }}>Aucune règle raccordée à un indicateur ne correspond.</div>;
  const ruleById = new Map(flow.rules.map(r => [r.id, r]));
  const kpiById = new Map(flow.kpis.map(k => [k.id, k]));
  const width = COL.out + W.out + 16;
  const sevColor = (s: "alerte" | "critique") => s === "critique" ? STATUS.critique : STATUS.alerte;
  const link = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; };
  const selectedKpi = kpiSel ? vocab.kpis.find(k => k.id === kpiSel) : undefined;
  const keyNav = (fn: () => void) => ({ onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } } });
  const triggered = flow.rules.filter(r => r.triggered).length;
  return (
    <div className="sd-graph" data-testid="causal-graph">
      <style>{DIAGRAM_CSS}</style>
      <div className="sd-graph-head">
        <b>Graphe causal</b>
        <span>{flow.rules.length} règles · {triggered} active(s) en surbrillance · clic : éditer · glisser : déplacer</span>
        <button type="button" className="sd-link" onClick={addKpi}>+ Indicateur</button>
        <button type="button" className="sd-link" onClick={reorganize} disabled={!vocab.layout?.causal} title="Relancer la mise en page automatique">Réorganiser</button>
      </div>
      <svg ref={svgRef} className="sd-svg" viewBox={`0 0 ${width} ${flow.height + 26}`} role="group" aria-label="Graphe causal des règles" style={{ overflow: "visible" }}>
        {[["Indicateurs", COL.kpi], ["Conditions", COL.cond], ["Règles", COL.rule], ["Conclusion et options", COL.out]].map(([t, x]) => (
          <text key={t as string} x={x as number} y={14} style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", fill: "var(--v4-text3)" }}>{String(t).toUpperCase()}</text>
        ))}
        <g transform="translate(0 22)">
          {flow.conditions.map(c => {
            const rule = ruleById.get(c.ruleId)!;
            const hot = rule.triggered && c.met;
            const color = hot ? sevColor(rule.severity) : "var(--v4-border2)";
            const k = c.kpiId ? kpiById.get(c.kpiId) : undefined;
            return (
              <g key={`e-${c.id}`} style={{ fill: "none", stroke: color, strokeWidth: hot ? 2.2 : 1.4, opacity: rule.enabled ? 1 : 0.45 }}>
                {k && <path d={link(COL.kpi + W.kpi + off(`k:${k.id}`).x, k.y + off(`k:${k.id}`).y, COL.cond + off(`c:${c.id}`).x, c.y + off(`c:${c.id}`).y)} />}
                <path d={link(COL.cond + W.cond + off(`c:${c.id}`).x, c.y + off(`c:${c.id}`).y, COL.rule + off(`r:${rule.id}`).x, rule.y + off(`r:${rule.id}`).y)} />
              </g>
            );
          })}
          {flow.rules.map(r => <path key={`o-${r.id}`} d={link(COL.rule + W.rule + off(`r:${r.id}`).x, r.y + off(`r:${r.id}`).y, COL.out + off(`o:${r.id}`).x, r.y + off(`o:${r.id}`).y)} style={{ fill: "none", stroke: r.triggered ? sevColor(r.severity) : "var(--v4-border2)", strokeWidth: r.triggered ? 2.2 : 1.4, opacity: r.enabled ? 1 : 0.45 }} />)}
          {flow.kpis.map(k => <g key={k.id} transform={moved(`k:${k.id}`)}><KpiBox k={k} selected={kpiSel === k.id} {...bind(`k:${k.id}`)} {...keyNav(() => setKpiSel(kpiSel === k.id ? null : k.id))} /></g>)}
          {flow.conditions.map(c => {
            const rule = ruleById.get(c.ruleId)!;
            const hot = rule.triggered && c.met;
            return (
              <g key={c.id} transform={moved(`c:${c.id}`)} className="sd-card" role="button" tabIndex={0} aria-label={`Condition de ${rule.label} : ${c.text}`} {...bind(`c:${c.id}`)} {...keyNav(() => onEditRule(c.ruleId))} opacity={rule.enabled ? 1 : 0.55}>
                <rect className="sd-box" x={COL.cond} y={c.y - NODE_H / 2 + 4} width={W.cond} height={NODE_H - 8} rx={15}
                  style={{ fill: hot ? "var(--v4-accent-bg)" : "var(--v4-surface)", stroke: hot ? sevColor(rule.severity) : "var(--v4-border2)", strokeDasharray: c.refRuleId ? "4 3" : undefined, strokeWidth: 1.3 }} />
                <text x={COL.cond + W.cond / 2} y={c.y + 4} textAnchor="middle" style={{ fontSize: 12.5, fontWeight: 700, fill: hot ? sevColor(rule.severity) : "var(--v4-text2)" }}>{cut(c.text, 24)}</text>
              </g>
            );
          })}
          {flow.rules.map(r => {
            const color = sevColor(r.severity);
            const sub = r.triggered ? `déclenchée · ${r.entities.length ? `${r.entities.length} ${r.scope ? r.scope.toLowerCase() : "entité"}${r.entities.length > 1 ? "s" : ""}` : "ensemble"}` : r.enabled ? "non déclenchée" : "désactivée";
            return (
              <g key={r.id} transform={moved(`r:${r.id}`)} className="sd-card" role="button" tabIndex={0} aria-label={`Règle ${r.label} (${sub}) : modifier`} data-triggered={r.triggered} {...bind(`r:${r.id}`)} {...keyNav(() => onEditRule(r.id))} opacity={r.enabled ? 1 : 0.5}>
                <title>{r.entities.length ? `Entités : ${r.entities.join(", ")}` : r.label}</title>
                <rect className="sd-box" x={COL.rule} y={r.y - 24} width={W.rule} height={48} rx={10}
                  style={{ fill: r.triggered ? "var(--v4-surface)" : "var(--v4-bg)", stroke: r.triggered ? color : "var(--v4-border2)", strokeWidth: r.triggered ? 2.4 : 1.2, filter: r.triggered ? "drop-shadow(0 0 6px rgba(192,57,43,.25))" : undefined }} />
                {r.triggered && <rect x={COL.rule} y={r.y - 24} width={6} height={48} rx={3} style={{ fill: color }} />}
                <text x={COL.rule + 16} y={r.y - 4} style={{ fontSize: 12.5, fontWeight: 800, fill: "var(--v4-text)" }}>{cut(r.label, 27)}<title>{r.label}</title></text>
                <text x={COL.rule + 16} y={r.y + 13} style={{ fontSize: 12.5, fontWeight: 650, fill: r.triggered ? color : "var(--v4-text3)" }}>{cut(sub, 32)}</text>
              </g>
            );
          })}
          {flow.rules.map(r => (
            <g key={`c-${r.id}`} transform={moved(`o:${r.id}`)} className="sd-card" role="button" tabIndex={0} aria-label={`Conclusion de ${r.label} : modifier`} {...bind(`o:${r.id}`)} {...keyNav(() => onEditRule(r.id))} opacity={r.enabled ? 1 : 0.5}>
              <rect className="sd-box" x={COL.out} y={r.y - 24} width={W.out} height={48} rx={10} style={{ fill: "var(--v4-surface)", stroke: r.triggered ? "var(--v4-accent-border)" : "var(--v4-border)", strokeWidth: 1.2 }} />
              <text x={COL.out + 12} y={r.y - 4} style={{ fontSize: 12.5, fontWeight: 650, fill: "var(--v4-text2)" }}>{cut(r.conclusion || "—", 42)}<title>{r.conclusion}</title></text>
              <text x={COL.out + 12} y={r.y + 13} style={{ fontSize: 12.5, fill: "var(--v4-text3)" }}>{r.options.length ? cut(`Options : ${r.options.join(" · ")}`, 44) : "Aucune option renseignée"}<title>{r.options.join(" · ")}</title></text>
            </g>
          ))}
        </g>
      </svg>
      {selectedKpi && (
        <div className="sd-panel" style={{ marginTop: 8 }} aria-label={`Seuils de ${selectedKpi.label}`}>
          <div className="sd-kpi-edit" style={{ borderTop: 0, paddingTop: 0 }}>
            <input aria-label="Libellé de l'indicateur" value={selectedKpi.label} onChange={e => onUpdate(updateKpi(vocab, selectedKpi.id, { label: e.target.value }))} style={{ fontWeight: 700, minWidth: 200 }} />
            <input aria-label="Unité de l'indicateur" value={selectedKpi.unit} placeholder="unité" onChange={e => onUpdate(updateKpi(vocab, selectedKpi.id, { unit: e.target.value }))} style={{ width: 80 }} />
            <label>alerte {selectedKpi.direction === "au_dessus_alerte" ? "≥" : "≤"} <input type="number" aria-label={`Seuil d'alerte de ${selectedKpi.label}`} value={selectedKpi.seuilAlerte} onChange={e => onUpdate(updateKpi(vocab, selectedKpi.id, { seuilAlerte: Number(e.target.value) }))} /></label>
            <label>critique <input type="number" aria-label={`Seuil critique de ${selectedKpi.label}`} value={selectedKpi.seuilCritique} onChange={e => onUpdate(updateKpi(vocab, selectedKpi.id, { seuilCritique: Number(e.target.value) }))} /></label>
            <small>{selectedKpi.unit} · les règles sont réévaluées aussitôt</small>
            <button type="button" style={{ marginLeft: "auto", color: "#b91c1c" }} onClick={() => { if (window.confirm(`Supprimer l'indicateur « ${selectedKpi.label} » et les conditions qui le citent ?`)) { onUpdate(removeKpi(vocab, selectedKpi.id)); setKpiSel(null); } }}>Supprimer</button>
            <button type="button" onClick={() => setKpiSel(null)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ k, selected, ...handlers }: { k: FlowKpi; selected: boolean } & Omit<React.SVGProps<SVGGElement>, "k">) {
  const color = STATUS[k.status];
  return (
    <g className="sd-card" role="button" tabIndex={0} aria-pressed={selected} aria-label={`Indicateur ${k.label} : ${fmt(k.value)} ${k.unit}, seuils`} {...handlers}>
      <rect className="sd-box" x={COL.kpi} y={k.y - 22} width={W.kpi} height={44} rx={10} style={{ fill: selected ? "var(--v4-accent-bg)" : "var(--v4-surface)", stroke: selected ? "var(--v4-accent)" : color, strokeWidth: 1.4 }} />
      <circle cx={COL.kpi + 13} cy={k.y - 6} r={4.5} style={{ fill: color }} />
      <text x={COL.kpi + 24} y={k.y - 2} style={{ fontSize: 12.5, fontWeight: 800, fill: "var(--v4-text)" }}>{cut(k.label, 24)}<title>{k.label}</title></text>
      <text x={COL.kpi + W.kpi - 10} y={k.y - 2} textAnchor="end" style={{ fontSize: 12.5, fontWeight: 800, fill: color }}>{fmt(k.value)}</text>
      <text x={COL.kpi + 24} y={k.y + 14} style={{ fontSize: 12.5, fill: "var(--v4-text3)" }}>{cut(`alerte ${k.sens} ${fmt(k.seuilAlerte)} · critique ${k.sens} ${fmt(k.seuilCritique)} ${k.unit}`, 32)}</text>
    </g>
  );
}

