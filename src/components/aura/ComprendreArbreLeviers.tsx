import { useMemo, useState, type ReactNode } from "react";
import { Lightbulb, Link2, SlidersHorizontal, Target } from "lucide-react";
import type { AtelierCriterion, AtelierLevierDef, ImportanceBadge } from "@/lib/v4/atelier-store";

// Arbre Objectifs → Critères → Indicateurs avec réglage direct de l'importance
// (échelle ordinale NUL / L / M / H de la thèse, ωᵢ ∈ L) et rapprochement
// leviers ↔ indicateurs. Le réglage réutilise exactement le chemin existant
// (onSetOrdinal → importance + poids) : aucune sémantique moteur n'est modifiée.

export const POIDS_LEVELS: { key: string; label: string; title: string; poids: number; importance: ImportanceBadge; color: string }[] = [
  { key: "N", label: "NUL", title: "Nulle — négligeable", poids: 8, importance: "Faible", color: "#94a3b8" },
  { key: "L", label: "L", title: "Faible — secondaire", poids: 15, importance: "Secondaire", color: "#d97706" },
  { key: "M", label: "M", title: "Moyenne — importante", poids: 25, importance: "Important", color: "#0d9488" },
  { key: "H", label: "H", title: "Haute — essentielle", poids: 40, importance: "Essentiel", color: "#4f46e5" },
];

export const LEVER_PALETTE = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#0284c7", "#7c3aed", "#059669", "#ea580c"];
export function leverColor(index: number) {
  return LEVER_PALETTE[index % LEVER_PALETTE.length];
}

function ordKey(imp: ImportanceBadge | undefined) {
  if (imp === "Essentiel") return "H";
  if (imp === "Important") return "M";
  if (imp === "Secondaire") return "L";
  return "N";
}

const LEVEL_NAMES = ["Objectif", "Critère", "Indicateur"];
const STOP = new Set(["niveau", "nombre", "taux", "delai", "capacite", "indice", "qualite", "client", "clients", "service", "gestion", "moyen", "moyenne", "global", "globale", "total", "totale"]);

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function tokens(s: string) {
  return norm(s).split(/[^a-z0-9]+/).filter(t => t.length >= 5 && !STOP.has(t));
}

type Lien = "impact" | "suggere";

/** Liens levier → indicateurs : impacts déjà saisis (lien établi) ou rapprochement lexical (lien suggéré). */
export function computeLiens(leviers: AtelierLevierDef[], feuilles: AtelierCriterion[]): Map<string, Map<string, Lien>> {
  const out = new Map<string, Map<string, Lien>>();
  for (const lev of leviers) {
    const m = new Map<string, Lien>();
    for (const opt of lev.options) {
      for (const [cid, v] of Object.entries(opt.impacts ?? {})) {
        if (v && v !== "U" && v !== "0") m.set(cid, "impact");
      }
    }
    const texte = norm([lev.label, lev.description ?? "", ...lev.options.flatMap(o => [o.label, o.justification ?? ""])].join(" "));
    for (const f of feuilles) {
      if (m.has(f.id)) continue;
      const toks = tokens(f.label);
      if (toks.some(t => texte.includes(t))) m.set(f.id, "suggere");
    }
    out.set(lev.id, m);
  }
  return out;
}

function leaves(nodes: AtelierCriterion[]): AtelierCriterion[] {
  return nodes.flatMap(n => (n.children?.length ? leaves(n.children) : [n]));
}

function PoidsControl({ node, onSet }: { node: AtelierCriterion; onSet: (id: string, key: string) => void }) {
  const current = ordKey(node.importance);
  return (
    <div className="cal-seg" role="group" aria-label={`Importance de ${node.label}`} data-testid="poids-seg">
      {POIDS_LEVELS.map(l => (
        <button key={l.key} type="button" title={l.title} aria-pressed={current === l.key}
          data-level={l.key}
          onClick={e => { e.stopPropagation(); onSet(node.id, l.key); }}
          style={current === l.key ? { background: l.color, borderColor: l.color, color: "#fff" } : undefined}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function PoidsBar({ node }: { node: AtelierCriterion }) {
  const lvl = POIDS_LEVELS.find(l => l.key === ordKey(node.importance))!;
  return <span className="cal-bar" aria-hidden><i style={{ width: `${Math.round((lvl.poids / 40) * 100)}%`, background: lvl.color }} /></span>;
}

export function ComprendreArbreLeviers({ criteria, leviers, onSetOrdinal }: {
  criteria: AtelierCriterion[];
  leviers: AtelierLevierDef[];
  onSetOrdinal: (id: string, key: string) => void;
}) {
  const feuilles = useMemo(() => leaves(criteria), [criteria]);
  const liens = useMemo(() => computeLiens(leviers, feuilles), [leviers, feuilles]);
  const [hoverLev, setHoverLev] = useState<string | null>(null);
  const [hoverInd, setHoverInd] = useState<string | null>(null);
  const [pinLev, setPinLev] = useState<string | null>(null);
  const [pinInd, setPinInd] = useState<string | null>(null);
  const activeLev = hoverLev ?? pinLev;
  const activeInd = hoverInd ?? pinInd;

  const leversByInd = useMemo(() => {
    const m = new Map<string, { id: string; idx: number; label: string; kind: Lien }[]>();
    leviers.forEach((lev, idx) => {
      for (const [cid, kind] of liens.get(lev.id) ?? []) {
        const arr = m.get(cid) ?? [];
        arr.push({ id: lev.id, idx, label: lev.label, kind });
        m.set(cid, arr);
      }
    });
    return m;
  }, [leviers, liens]);

  const feuilleIds = new Set(feuilles.map(f => f.id));
  const label = new Map(feuilles.map(f => [f.id, f.label]));

  function indActive(id: string) {
    if (activeLev) return liens.get(activeLev)?.has(id) ?? false;
    return activeInd === id;
  }
  function levActive(id: string) {
    if (activeInd) return liens.get(id)?.has(activeInd) ?? false;
    return activeLev === id;
  }
  const dimmed = !!(activeLev || activeInd);

  function renderNode(node: AtelierCriterion, depth: number): ReactNode {
    const isLeaf = !node.children?.length;
    const linked = isLeaf ? leversByInd.get(node.id) ?? [] : [];
    const on = isLeaf && indActive(node.id);
    return (
      <li key={node.id} className={`cal-node d${Math.min(depth, 2)}${on ? " on" : ""}${dimmed && isLeaf && !on ? " dim" : ""}`}>
        <div className="cal-row" data-testid={isLeaf ? "arbre-indicateur" : "arbre-noeud"} data-lien-actif={on ? "true" : "false"}
          onMouseEnter={isLeaf ? () => setHoverInd(node.id) : undefined}
          onMouseLeave={isLeaf ? () => setHoverInd(null) : undefined}
          onClick={isLeaf ? () => setPinInd(v => (v === node.id ? null : node.id)) : undefined}>
          <span className={`cal-dot d${Math.min(depth, 2)}`} aria-hidden>{depth === 0 ? <Target size={13} /> : null}</span>
          <span className="cal-main">
            <small>{LEVEL_NAMES[Math.min(depth, 2)]}{node.exploratoire ? " · " : ""}{node.exploratoire && <Lightbulb size={12} className="cal-lamp-ic" aria-label="Indicateur inspirant" />}</small>
            <strong>{node.label}</strong>
            {isLeaf && linked.length > 0 && (
              <span className="cal-puces">
                {linked.map(l => (
                  <span key={l.id} className={`cal-puce ${l.kind}`} title={`${l.label} — ${l.kind === "impact" ? "impact évalué" : "lien suggéré"}`}
                    style={{ ["--c" as string]: leverColor(l.idx) }}>
                    <i />{l.label}
                  </span>
                ))}
              </span>
            )}
          </span>
          <PoidsBar node={node} />
          <PoidsControl node={node} onSet={onSetOrdinal} />
        </div>
        {!isLeaf && (
          <ul className="cal-children">
            {node.children!.map(c => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <section className="cal-wrap" data-testid="comprendre-arbre">
      <style>{css}</style>
      <div className="cal-col tree">
        <header>
          <span className="cal-h" title="Objectifs → critères → indicateurs. Réglez l'importance (ωᵢ) de chaque nœud : NUL · L faible · M moyenne · H haute."><Target size={16} /> Arbre de décision</span>
        </header>
        <ul className="cal-tree">{criteria.map(c => renderNode(c, 0))}</ul>
      </div>
      <div className="cal-col levers">
        <header>
          <span className="cal-h" title="Survolez ou cliquez un levier pour voir les indicateurs qu'il influence ; un indicateur pour voir ses leviers. Trait plein : impact évalué · pointillé : lien suggéré."><SlidersHorizontal size={16} /> Leviers et indicateurs liés</span>
        </header>
        <div className="cal-levers">
          {leviers.map((lev, idx) => {
            const c = leverColor(idx);
            const inds = [...(liens.get(lev.id) ?? [])].filter(([id]) => feuilleIds.has(id));
            const on = levActive(lev.id);
            return (
              <article key={lev.id} className={`cal-lever${on ? " on" : ""}${dimmed && !on ? " dim" : ""}`} style={{ ["--c" as string]: c }}
                data-testid="arbre-levier" data-lien-actif={on ? "true" : "false"}
                onMouseEnter={() => setHoverLev(lev.id)} onMouseLeave={() => setHoverLev(null)}
                onClick={() => setPinLev(v => (v === lev.id ? null : lev.id))}>
                <div className="cal-lever-head"><span className="cal-swatch" /> <strong>{lev.label}</strong><em>{lev.options.length} option{lev.options.length > 1 ? "s" : ""}</em></div>
                <div className="cal-opts">
                  {lev.options.map((o, oi) => (
                    <span key={o.id} className={`cal-opt${oi === 0 ? " ref" : ""}`} title={oi === 0 ? "Option de référence (situation actuelle)" : o.justification || o.label}>
                      {o.exploratoire && <span data-testid="lampe-inspirante" role="img" aria-label="Option inspirante / innovante" title="Option inspirante / innovante — piste inattendue proposée par Aura, crédible, à explorer" className="cal-lamp"><Lightbulb size={12} strokeWidth={2.2} /></span>}
                      {o.label}
                    </span>
                  ))}
                </div>
                <div className="cal-links">
                  <Link2 size={13} />
                  {inds.length ? inds.map(([id, kind]) => (
                    <span key={id} className={`cal-link ${kind}`}>{label.get(id)}</span>
                  )) : <span className="cal-none">Aucun indicateur lié pour l'instant — les impacts se précisent dans Impacter.</span>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const css = `
.cal-wrap{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
.cal-col{background:#fff;border:1px solid #e9e6f4;border-radius:12px;padding:14px 16px;box-shadow:0 8px 24px rgba(48,39,103,.045);min-width:0}
.cal-col header{display:grid;gap:4px;margin-bottom:10px}
.cal-h{display:flex;align-items:center;gap:7px;font:650 16px var(--font-display,inherit);color:#1e194d}
.cal-col header small{font-size:13.5px;line-height:1.5;color:#6b6585}
.cal-tree,.cal-children{list-style:none;margin:0;padding:0}
.cal-children{margin-left:13px;padding-left:16px;border-left:1.5px solid #e4e0f3}
.cal-node{position:relative}
.cal-children>.cal-node:before{content:"";position:absolute;left:-16px;top:22px;width:13px;border-top:1.5px solid #e4e0f3}
.cal-row{display:grid;grid-template-columns:auto minmax(0,1fr) 54px auto;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;transition:background .12s,opacity .12s}
.cal-node.d0>.cal-row{background:#f5f3ff;margin-top:8px}
.cal-node.d2>.cal-row{cursor:pointer}
.cal-node.d2>.cal-row:hover,.cal-node.on>.cal-row{background:#eef2ff;box-shadow:inset 0 0 0 1.5px #a5b4fc}
.cal-node.dim>.cal-row{opacity:.45}
.cal-dot{width:12px;height:12px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}
.cal-dot.d0{width:26px;height:26px;border-radius:8px;background:#4f46e5;color:#fff}
.cal-dot.d1{background:#0d9488;box-shadow:0 0 0 3px #ccfbf1}
.cal-dot.d2{background:#f59e0b;box-shadow:0 0 0 3px #fef3c7;width:10px;height:10px}
.cal-main{display:grid;gap:1px;min-width:0}
.cal-main small{font-size:12px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:#8a83a3;display:flex;align-items:center;gap:3px}
.cal-lamp-ic{color:#d97706}
.cal-main strong{font-size:14.5px;font-weight:600;color:#231d4f;line-height:1.35}
.cal-node.d0>.cal-row .cal-main strong{font-size:15.5px;font-weight:700}
.cal-puces{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:4px;margin-top:3px}
.cal-puces>.cal-puce{flex:0 0 auto;width:auto}
.cal-puce{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:650;color:color-mix(in srgb,var(--c) 80%,#111);background:color-mix(in srgb,var(--c) 9%,#fff);border:1px solid color-mix(in srgb,var(--c) 35%,#fff);border-radius:99px;padding:1px 8px}
.cal-puce.suggere{border-style:dashed}
.cal-puce i{width:7px;height:7px;border-radius:50%;background:var(--c)}
.cal-bar{height:6px;border-radius:99px;background:#eeecf6;overflow:hidden}
.cal-bar i{display:block;height:100%;border-radius:99px;transition:width .2s}
.cal-seg{display:inline-flex;border:1px solid #dcd8ee;border-radius:9px;overflow:hidden;background:#fff}
.cal-seg button{border:0;border-right:1px solid #ece9f6;background:transparent;color:#6b6585;font:750 12.5px var(--font-sans,inherit);padding:5px 9px;min-width:34px;cursor:pointer;transition:background .12s,color .12s}
.cal-seg button:last-child{border-right:0}
.cal-seg button:hover{background:#f3f1ff;color:#3f37c9}
.cal-levers{display:grid;gap:10px}
.cal-lever{border:1px solid color-mix(in srgb,var(--c) 30%,#fff);border-left:4px solid var(--c);border-radius:12px;padding:11px 12px;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 6%,#fff),#fff 70%);cursor:pointer;transition:box-shadow .15s,opacity .15s,transform .15s}
.cal-lever.on{box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 55%,#fff),0 10px 24px color-mix(in srgb,var(--c) 18%,transparent);transform:translateY(-1px)}
.cal-lever.dim{opacity:.5}
.cal-lever-head{display:flex;align-items:center;gap:8px}
.cal-lever-head strong{font-size:15px;color:#1f1a48;flex:1;min-width:0}
.cal-lever-head em{font-style:normal;font-size:12px;font-weight:700;color:color-mix(in srgb,var(--c) 75%,#222);background:color-mix(in srgb,var(--c) 10%,#fff);border-radius:99px;padding:2px 8px;white-space:nowrap}
.cal-swatch{width:10px;height:10px;border-radius:3px;background:var(--c);flex-shrink:0}
.cal-opts{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 8px}
.cal-opt{display:inline-flex;align-items:center;gap:5px;font-size:13.5px;font-weight:550;line-height:1.3;padding:5px 11px;border-radius:9px;color:color-mix(in srgb,var(--c) 70%,#1a1a2e);background:color-mix(in srgb,var(--c) 8%,#fff);border:1px solid color-mix(in srgb,var(--c) 32%,#fff)}
.cal-opt.ref{background:var(--c);border-color:var(--c);color:#fff;font-weight:700;box-shadow:0 4px 12px color-mix(in srgb,var(--c) 28%,transparent)}
.cal-lamp{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;color:#b45309;background:#fef3c7;border:1px solid #fcd34d;box-shadow:0 0 6px #f59e0b33}
.cal-links{display:flex;flex-wrap:wrap;align-items:center;gap:5px;color:#7a7396;border-top:1px dashed #e7e3f3;padding-top:7px}
.cal-link{font-size:12.5px;font-weight:600;color:#3c3566;background:#f6f5fb;border:1px solid #e3e0ef;border-radius:7px;padding:2px 8px}
.cal-link.suggere{border-style:dashed;color:#6b6585}
.cal-none{font-size:12.5px;color:#8f89a8;font-style:italic}
.cal-col.tree{container-type:inline-size}
.cal-puce{max-width:100%;white-space:normal;line-height:1.35}
@media(max-width:1180px){.cal-wrap{grid-template-columns:1fr}}
/* Colonne étroite : le contrôle NUL/L/M/H passe sous le libellé, aligné sur lui. */
@container (max-width:520px){.cal-row{grid-template-columns:auto minmax(0,1fr);row-gap:6px}.cal-bar{display:none}.cal-seg{grid-column:2;justify-self:start}.cal-children{margin-left:6px;padding-left:10px}.cal-children>.cal-node:before{left:-10px;width:8px}}
@media(max-width:640px){.cal-seg button{min-width:44px;min-height:40px}.cal-col{padding:12px}}
`;
