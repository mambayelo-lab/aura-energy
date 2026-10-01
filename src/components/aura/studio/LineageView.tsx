// Vue « Lignage » du mapping : sources (système → table → colonne), objets et
// attributs, indicateurs, reliés par des liens courbes colorés selon leur
// état. On crée un lien en glissant une colonne sur une cible, ou en cliquant
// l'une puis l'autre ; un clic sur un lien permet de le corriger.
import { useDismiss } from "@/lib/ui/use-dismiss";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ArgusVocab } from "../../../lib/v4/argus-vocab-store";
import {
  acceptProposal, addLink, buildLineage, changeLinkColumn, removeLink, takeMappingPrefill, type LineageLink,
} from "../../../lib/v4/supply-lineage";

const REFUSED_KEY = "aura-supply-lineage-refused";
const loadRefused = (): string[] => { try { return JSON.parse(localStorage.getItem(REFUSED_KEY) ?? "[]"); } catch { return []; } };
const COLOR: Record<LineageLink["state"], string> = { mappe: "#4743E6", propose: "#8583EE", erreur: "#c0392b" };

const CSS = `
.lg{border:1px solid var(--v4-border);border-radius:12px;background:var(--v4-surface);padding:10px 12px}
.lg-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:8px;font-size:12.5px;color:var(--v4-text3)}
.lg-bar select,.lg-bar button{font:600 12.5px var(--font-sans);border:1px solid var(--v4-border2);border-radius:7px;background:var(--v4-surface);color:var(--v4-text2);padding:4px 8px;cursor:pointer}
.lg-bar i{display:inline-block;width:18px;height:0;border-top:2px solid;margin-right:5px;vertical-align:3px}
.lg-hint{font-size:12.5px;color:var(--v4-accent2);font-weight:700}
.lg-scroll{overflow-x:auto}
.lg-grid{position:relative;display:grid;grid-template-columns:minmax(230px,1fr) minmax(230px,1fr) minmax(190px,.8fr);column-gap:90px;min-width:820px}
.lg-col{display:flex;flex-direction:column;gap:3px;position:relative;z-index:1}
.lg-col h5{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--v4-text3)}
.lg-group{font:800 12.5px var(--font-sans);color:var(--v4-text);margin-top:6px}
.lg-row:hover{border-color:var(--v4-accent-border)}
.lg-row{display:flex;align-items:center;gap:6px;border:1px solid var(--v4-border);border-radius:7px;padding:3px 8px;font-size:12.5px;background:var(--v4-surface);color:var(--v4-text);cursor:pointer;text-align:left;font-family:inherit;min-height:26px}
.lg-row.off{color:var(--v4-text3);background:var(--v4-bg);border-style:dashed}
.lg-row.sel{border-color:var(--v4-accent);box-shadow:0 0 0 2px var(--v4-accent-bg)}
.lg-row.drop{border-color:var(--v4-accent);background:var(--v4-accent-bg)}
.lg-row small{margin-left:auto;font-size:11.5px;color:var(--v4-text3)}
.lg-table{font-weight:700;background:var(--v4-panel)}
.lg-col-row{margin-left:14px}
.lg-svg{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:2}
.lg-svg path{pointer-events:stroke;cursor:pointer}
.lg-x{position:absolute;top:4px;right:6px;border:0;background:none;font-size:16px;cursor:pointer;color:inherit}.lg-pop{position:absolute;z-index:5;background:var(--v4-surface);border:1px solid var(--v4-border2);border-radius:9px;box-shadow:0 10px 26px rgba(26,20,51,.16);padding:8px;display:flex;flex-direction:column;gap:6px;font-size:12.5px;width:250px}
.lg-pop b{color:var(--v4-text)}
.lg-pop div{display:flex;gap:6px;flex-wrap:wrap}
.lg-pop button,.lg-pop select{font:600 12.5px var(--font-sans);border:1px solid var(--v4-border2);border-radius:6px;background:var(--v4-surface);color:var(--v4-text2);padding:3px 8px;cursor:pointer;max-width:100%}
.lg-pop button.primary{background:var(--v4-accent);border-color:var(--v4-accent);color:#fff}
.lg-pop button.danger{color:#b91c1c}
`;

type Pt = { x: number; y: number };

export function LineageView({ vocab, onUpdate, initialObject = "" }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void; initialObject?: string }) {
  const [refused, setRefused] = useState<string[]>(loadRefused);
  const { systems, links, linkedTargets } = useMemo(() => buildLineage(vocab, refused), [vocab, refused]);
  const entities = vocab.entities ?? [];
  const [objectFilter, setObjectFilter] = useState(initialObject);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [selField, setSelField] = useState<string | null>(null);
  const [selTarget, setSelTarget] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [active, setActive] = useState<LineageLink | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useDismiss(!!active, () => setActive(null), popRef);
  // Élément survolé : ses liens ressortent, les autres s'estompent.
  const [focus, setFocus] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<Record<string, { l: Pt; r: Pt }>>({});
  const grid = useRef<HTMLDivElement>(null);

  // Pastille « à mapper » du graphe : l'attribut arrive présélectionné.
  useEffect(() => {
    const p = takeMappingPrefill();
    if (!p) return;
    setSelTarget(p);
    const e = entities.find(x => x.attributes.some(a => `a:${a.id}` === p));
    if (e) setObjectFilter(e.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldTable = useMemo(() => new Map(systems.flatMap(s => s.tables.flatMap(t => t.columns.map(c => [c.fieldId, t.key] as const)))), [systems]);
  const visibleEntities = objectFilter ? entities.filter(e => e.id === objectFilter) : entities;
  const visibleTargets = new Set([...visibleEntities.flatMap(e => e.attributes.map(a => `a:${a.id}`)), ...vocab.kpis.map(k => `k:${k.id}`)]);
  const shownLinks = links.filter(l => visibleTargets.has(l.target));
  const relevantTables = new Set(shownLinks.map(l => fieldTable.get(l.fieldId)));
  const tablesShown = systems.map(s => ({ ...s, tables: objectFilter && !selTarget && !selField ? s.tables.filter(t => relevantTables.has(t.key) || open.has(t.key)) : s.tables })).filter(s => s.tables.length);

  // Position des ancres (bord gauche / droit de chaque ligne), relative à la grille.
  useLayoutEffect(() => {
    const measure = () => {
      const root = grid.current;
      if (!root) return;
      const box = root.getBoundingClientRect();
      const next: Record<string, { l: Pt; r: Pt }> = {};
      root.querySelectorAll<HTMLElement>("[data-node]").forEach(el => {
        const r = el.getBoundingClientRect();
        next[el.dataset.node!] = { l: { x: r.left - box.left, y: r.top - box.top + r.height / 2 }, r: { x: r.right - box.left, y: r.top - box.top + r.height / 2 } };
      });
      setAnchors(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (grid.current) ro.observe(grid.current);
    return () => ro.disconnect();
  }, [vocab, open, objectFilter, refused]);

  const connect = (fieldId: string, target: string) => { onUpdate(addLink(vocab, fieldId, target)); setSelField(null); setSelTarget(null); };
  const clickField = (id: string) => { if (selTarget) connect(id, selTarget); else setSelField(selField === id ? null : id); };
  const clickTarget = (t: string) => { if (selField) connect(selField, t); else setSelTarget(selTarget === t ? null : t); };
  const dropProps = (t: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDropOn(t); },
    onDragLeave: () => setDropOn(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDropOn(null); const f = e.dataTransfer.getData("text/aura-field"); if (f) connect(f, t); },
  });
  const refuse = (l: LineageLink) => { const next = [...refused, l.id]; setRefused(next); try { localStorage.setItem(REFUSED_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ } setActive(null); };
  const sourceAnchor = (fieldId: string) => anchors[`f:${fieldId}`] ?? anchors[`t:${fieldTable.get(fieldId)}`];
  const allFields = systems.flatMap(s => s.tables.flatMap(t => t.columns.map(c => ({ id: c.fieldId, label: `${s.label} · ${t.table}.${c.column}` }))));
  const count = (st: LineageLink["state"]) => shownLinks.filter(l => l.state === st).length;
  const targetLabel = (t: string) => t.startsWith("k:") ? vocab.kpis.find(k => `k:${k.id}` === t)?.label : entities.flatMap(e => e.attributes.map(a => ({ e, a }))).find(x => `a:${x.a.id}` === t)?.a.name;

  return (
    <div className="lg" data-testid="lineage">
      <style>{CSS}</style>
      <div className="lg-bar">
        <select aria-label="Filtrer par objet" value={objectFilter} onChange={e => setObjectFilter(e.target.value)}>
          <option value="">Tous les objets</option>
          {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(prev => prev.size ? new Set() : new Set(systems.flatMap(s => s.tables.map(t => t.key))))}>{open.size ? "Replier les tables" : "Déplier les tables"}</button>
        <span><i style={{ borderColor: COLOR.mappe }} />mappé ({count("mappe")})</span>
        <span><i style={{ borderColor: COLOR.propose, borderTopStyle: "dashed" }} />proposé ({count("propose")})</span>
        <span><i style={{ borderColor: COLOR.erreur }} />erreur de type ({count("erreur")})</span>
        {(selField || selTarget) && <span className="lg-hint">{selField ? "Cliquez l'attribut ou l'indicateur cible" : `Cliquez la colonne source de « ${targetLabel(selTarget!)} »`} · <button type="button" onClick={() => { setSelField(null); setSelTarget(null); }}>Annuler</button></span>}
      </div>
      <div className="lg-scroll">
        <div className="lg-grid" ref={grid} onMouseOver={e => { const n = (e.target as HTMLElement).closest<HTMLElement>("[data-node]"); setFocus(n?.dataset.node ?? null); }} onMouseLeave={() => setFocus(null)} onClick={e => { if (e.target === e.currentTarget) setActive(null); }}>
          <div className="lg-col">
            <h5>Sources</h5>
            {tablesShown.map(s => (
              <div key={s.appId}>
                <div className="lg-group">{s.label}</div>
                {s.tables.map(t => {
                  const isOpen = open.has(t.key) || (!!objectFilter && relevantTables.has(t.key));
                  return (
                    <div key={t.key} style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 3 }}>
                      <button type="button" className={`lg-row lg-table${t.linked ? "" : " off"}`} data-node={`t:${t.key}`} aria-expanded={isOpen}
                        onClick={() => setOpen(prev => { const n = new Set(prev); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n; })}>
                        {isOpen ? "▾" : "▸"} {t.table}<small>{t.columns.length} col.</small>
                      </button>
                      {isOpen && t.columns.map(c => (
                        <button key={c.fieldId} type="button" draggable className={`lg-row lg-col-row${c.linked ? "" : " off"}${selField === c.fieldId ? " sel" : ""}`} data-node={`f:${c.fieldId}`}
                          aria-label={`Colonne ${t.table}.${c.column}`} onClick={() => clickField(c.fieldId)}
                          onDragStart={e => { e.dataTransfer.setData("text/aura-field", c.fieldId); e.dataTransfer.effectAllowed = "link"; }}>
                          {c.column}<small>{c.numeric ? "nombre" : "texte"}</small>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="lg-col">
            <h5>Objets et attributs</h5>
            {visibleEntities.map(e => (
              <div key={e.id}>
                <div className="lg-group">{e.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 3 }}>
                  {e.attributes.map(a => {
                    const t = `a:${a.id}`;
                    return (
                      <button key={a.id} type="button" className={`lg-row${linkedTargets.has(t) ? "" : " off"}${selTarget === t ? " sel" : ""}${dropOn === t ? " drop" : ""}`} data-node={t}
                        aria-label={`Attribut ${e.name} · ${a.name}`} onClick={() => clickTarget(t)} {...dropProps(t)}>
                        {a.name}<small>{a.type}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="lg-col">
            <h5>Indicateurs</h5>
            {vocab.kpis.map(k => {
              const t = `k:${k.id}`;
              return (
                <button key={k.id} type="button" className={`lg-row${linkedTargets.has(t) ? "" : " off"}${selTarget === t ? " sel" : ""}${dropOn === t ? " drop" : ""}`} data-node={t}
                  aria-label={`Indicateur ${k.label}`} onClick={() => clickTarget(t)} {...dropProps(t)}>
                  {k.label}<small>{k.unit}</small>
                </button>
              );
            })}
          </div>
          <svg className="lg-svg" aria-hidden="false" role="group" aria-label="Liens de mapping">
            {shownLinks.map(l => {
              const a = sourceAnchor(l.fieldId), b = anchors[l.target];
              if (!a || !b) return null;
              // Lien vers un indicateur : il passe au-dessus de la colonne des attributs.
              const p1 = a.r, p2 = b.l, mx = (p1.x + p2.x) / 2;
              const d = `M ${p1.x} ${p1.y} C ${mx} ${p1.y} ${mx} ${p2.y} ${p2.x} ${p2.y}`;
              const hot = active?.id === l.id;
              const touches = focus && (focus === l.target || focus === `f:${l.fieldId}` || focus === `t:${fieldTable.get(l.fieldId)}`);
              const opacity = hot || touches ? 1 : focus ? 0.1 : shownLinks.length > 20 ? 0.4 : 0.9;
              return (
                <g key={l.id}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={10} onClick={() => setActive(l)} />
                  <path d={d} fill="none" stroke={COLOR[l.state]} strokeWidth={hot ? 3 : 1.6} strokeDasharray={l.state === "propose" ? "5 4" : undefined} opacity={opacity} onClick={() => setActive(l)} data-link={l.id} data-state={l.state}>
                    <title>{`${allFields.find(f => f.id === l.fieldId)?.label} → ${targetLabel(l.target)} (${l.state === "mappe" ? "mappé" : l.state === "propose" ? "proposé" : "erreur de type"})`}</title>
                  </path>
                </g>
              );
            })}
          </svg>
          {active && (() => {
            const a = sourceAnchor(active.fieldId), b = anchors[active.target];
            if (!a || !b) return null;
            const left = Math.max(0, (a.r.x + b.l.x) / 2 - 125), top = (a.r.y + b.l.y) / 2 + 8;
            return (
              <div ref={popRef} className="lg-pop" style={{ left, top }} role="dialog" aria-label="Lien de mapping">
                <button type="button" className="lg-x" aria-label="Fermer" onClick={() => setActive(null)}>×</button>
                <b>{allFields.find(f => f.id === active.fieldId)?.label} → {targetLabel(active.target)}</b>
                {active.state === "erreur" && <span style={{ color: COLOR.erreur }}>Type incompatible : une colonne texte ne peut pas alimenter une valeur numérique.</span>}
                {active.state === "propose" ? (
                  <div>
                    <button type="button" className="primary" onClick={() => { onUpdate(acceptProposal(vocab, active)); setActive(null); }}>Valider</button>
                    <button type="button" onClick={() => refuse(active)}>Refuser</button>
                    <button type="button" onClick={() => setActive(null)}>Fermer</button>
                  </div>
                ) : (
                  <>
                    <select aria-label="Changer la colonne" value={active.fieldId} onChange={e => { onUpdate(changeLinkColumn(vocab, active, e.target.value)); setActive(null); }}>
                      {allFields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                    <div>
                      <button type="button" className="danger" onClick={() => { onUpdate(removeLink(vocab, active)); setActive(null); }}>Supprimer</button>
                      <button type="button" onClick={() => setActive(null)}>Fermer</button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
