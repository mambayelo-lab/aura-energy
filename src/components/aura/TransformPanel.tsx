// TransformPanel — module « Transformer » d'Aura (Incréments 1-3 de la spec).
//
// Déclenché depuis un objectif OKR de l'étape Suivi : Aura PROPOSE une
// trajectoire de transformation dérivée du modèle décisionnel (capabilities
// impactées avec t-shirt sizing et impacts de change, architectures
// fonctionnelle et applicative avec fonctions L4 imbriquées, flux nommés,
// séquence, backlog) — l'humain modifie et confirme tout.
// Aucun score numérique : sizing en t-shirt, tout est qualitatif.
// Persistance localStorage par session + objectif.
//
// RequirementsPanel — parcours « Innovation produit » : dossier d'exigences
// (fonctionnelles / non fonctionnelles / contraintes, MoSCoW éditable) +
// schéma d'illustration conceptuel (inspiration, PAS un design).

import { useState } from "react";
import type { AtelierCriterion, AtelierSession } from "../../lib/v4/atelier-store";

// ── Types ────────────────────────────────────────────────────────────────────
type Sizing = "XS" | "S" | "M" | "L" | "XL";
const SIZINGS: Sizing[] = ["XS", "S", "M", "L", "XL"];
const SIZING_COLOR: Record<Sizing, string> = { XS: "#10b981", S: "#22c55e", M: "#f59e0b", L: "#f97316", XL: "#dc2626" };
const CHANGE_IMPACTS = ["Processus", "Données", "Applications", "Organisation", "Compétences"];
// Codes visuels repris d'Architecturer : couleur = protocole, trait = criticité.
const PROTO_COLOR: Record<string, string> = { REST: "#2563eb", "Événements": "#7c3aed", Fichier: "#6b7280", API: "#0891b2", SOAP: "#b45309", MQ: "#059669" };
const protoColor = (p: string) => PROTO_COLOR[p] ?? "#64748b";
const critDash = (c: string) => c === "Batch" ? "7 4" : undefined;
const critWidth = (c: string) => c === "Critique" ? 2.4 : 1.6;

interface Capa { id: string; label: string; level: 1 | 2 | 3; parent?: string; sizing: Sizing; impacts: string[] }
interface AppBox { id: string; label: string; statut: "existante" | "nouvelle"; features: string[] } // features = capabilities L4
interface Flow { id: string; from: string; to: string; label: string; protocole: string; crit: "Critique" | "Standard" | "Batch" }
interface BacklogItem { id: string; titre: string; kr: string; prio: "Must" | "Should" | "Could"; done?: boolean; kind?: "Epic" | "Feature" | "Story" }
interface TransformData { capas: Capa[]; apps: AppBox[]; flows: Flow[]; backlog: BacklogItem[] }

// ── Génération heuristique (proposée par Aura, tout modifiable) ──────────────
function generateTransform(session: AtelierSession, moe: AtelierCriterion, moeIdx: number): TransformData {
  const mops = moe.children ?? [];
  const tpms = mops.flatMap(m => m.children?.length ? m.children : [m]);
  const sizingOf = (imp: string): Sizing =>
    imp === "Essentiel" ? "L" : imp === "Important" ? "M" : imp === "Secondaire" ? "S" : "XS";

  const capas: Capa[] = [
    { id: moe.id, label: moe.label, level: 1, sizing: sizingOf(moe.importance), impacts: ["Processus", "Organisation"] },
    ...mops.map(m => ({ id: m.id, label: m.label, level: 2 as const, parent: moe.id, sizing: sizingOf(m.importance), impacts: ["Processus", "Applications"] })),
    ...tpms.map(t => {
      const parent = mops.find(m => m.children?.some(c => c.id === t.id))?.id ?? moe.id;
      return { id: t.id, label: t.label, level: 3 as const, parent, sizing: sizingOf(t.importance), impacts: ["Applications", "Données"] };
    }),
  ];

  // On ne connaît pas les applications réelles du client : Aura baptise des
  // MODULES APPLICATIFS provisoires (A, B, …) que l'utilisateur renomme —
  // le nom provisoire dit explicitement qu'il attend son vrai nom.
  const nExisting = Math.min(3, Math.max(2, mops.length));
  const apps: AppBox[] = [
    ...Array.from({ length: nExisting }, (_, i) => ({
      id: `app${i}`, label: `Module applicatif ${"ABC"[i]}`, statut: "existante" as const,
      features: tpms.slice(i, i + 1).map(t => t.label),
    })),
    { id: "appNew", label: `Module cible — ${moe.label}`, statut: "nouvelle", features: tpms.map(t => t.label).slice(0, 4) },
  ];

  const flows: Flow[] = apps.filter(a => a.id !== "appNew").map((a, i) => ({
    id: `f${i}`, from: a.id, to: "appNew",
    label: `Données ${tpms[i]?.label?.toLowerCase() ?? moe.label.toLowerCase()}`,
    protocole: i === 0 ? "REST" : i === 1 ? "Événements" : "Fichier", crit: i === 0 ? "Critique" : "Standard",
  }));
  if (apps.length > 1) flows.push({ id: "fr", from: "appNew", to: apps[0].id, label: `Restitution ${moe.label.toLowerCase()}`, protocole: "REST", crit: "Standard" });

  // Hiérarchie agile : un EPIC par KR (MOP), des FEATURES (fonctions L4),
  // une STORY d'amorçage par epic.
  const backlog: BacklogItem[] = mops.flatMap((m, ki) => {
    const kr = `KR${moeIdx + 1}.${ki + 1}`;
    const prio = (m.importance === "Essentiel" ? "Must" : m.importance === "Important" ? "Should" : "Could") as BacklogItem["prio"];
    const feats = (m.children ?? []).slice(0, 2).map((t, fi) => ({
      id: `b${ki}f${fi}`, titre: `Feature — ${t.label}`, kr, prio, kind: "Feature" as const,
    }));
    return [
      { id: `b${ki}`, titre: `Epic — Mettre en œuvre « ${m.label} »`, kr, prio, kind: "Epic" as const },
      ...feats,
      { id: `b${ki}s`, titre: `Story — cadrer et estimer « ${m.label} »`, kr, prio: "Should" as const, kind: "Story" as const },
    ];
  });

  return { capas, apps, flows, backlog };
}

// ── Composant principal ──────────────────────────────────────────────────────
export function TransformPanel({ session, moe, moeIdx, color, onClose }: {
  session: AtelierSession; moe: AtelierCriterion; moeIdx: number; color: string; onClose: () => void;
}) {
  const KEY = `aura-transform-${session.id}-${moe.id}`;
  const [data, setData] = useState<TransformData>(() => {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* régénère */ }
    return generateTransform(session, moe, moeIdx);
  });
  const save = (next: TransformData) => {
    setData(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };
  const [tab, setTab] = useState<"capa" | "appli" | "seq" | "flux" | "backlog">("capa");
  const appById = (id: string) => data.apps.find(a => a.id === id);
  const [refining, setRefining] = useState(false);
  const [refineMsg, setRefineMsg] = useState<string | null>(null);

  // ✦ Affinage LLM : l'heuristique donne la structure, Aura affine les libellés
  // métier (flux, fonctions du module cible, épics). Repli sans échec bloquant.
  async function refineWithAura() {
    setRefining(true); setRefineMsg(null);
    try {
      const { refineTransform } = await import("../../lib/v4/atelier-llm");
      const cible = data.apps.find(a => a.statut === "nouvelle");
      const out = await refineTransform({ data: {
        context: session.contextEnriched ?? session.contextRaw ?? "",
        objective: moe.label,
        flows: data.flows.map(f => ({ id: f.id, label: f.label, fromLabel: appById(f.from)?.label ?? f.from, toLabel: appById(f.to)?.label ?? f.to })),
        ciblesFeatures: cible?.features ?? [],
        backlog: data.backlog.map(b => ({ id: b.id, titre: b.titre })),
      }});
      if (!out) { setRefineMsg("Affinage indisponible — les libellés heuristiques sont conservés."); return; }
      const flowLbl = new Map(out.flows?.map(f => [f.id, f.label]) ?? []);
      const backLbl = new Map(out.backlog?.map(b => [b.id, b.titre]) ?? []);
      save({
        ...data,
        flows: data.flows.map(f => flowLbl.get(f.id) ? { ...f, label: flowLbl.get(f.id)! } : f),
        backlog: data.backlog.map(b => backLbl.get(b.id) ? { ...b, titre: backLbl.get(b.id)! } : b),
        apps: data.apps.map(a => a.statut === "nouvelle" && out.extraFeatures?.length
          ? { ...a, features: [...a.features, ...out.extraFeatures.filter(x => !a.features.includes(x))] } : a),
      });
      setRefineMsg("✦ Libellés affinés par Aura — vérifiez et ajustez.");
    } catch {
      setRefineMsg("Affinage indisponible — les libellés heuristiques sont conservés.");
    } finally { setRefining(false); }
  }

  // Boîte conteneur C4 (éditable) — réutilisée par le diagramme applicatif.
  const renderAppBox = (app: AppBox) => (
    <div style={{ border: `2px solid ${app.statut === "nouvelle" ? color : "var(--v4-border)"}`, borderStyle: app.statut === "nouvelle" ? "dashed" : "solid", borderRadius: 8, padding: "8px 10px", background: app.statut === "nouvelle" ? "var(--v4-surface)" : "var(--v4-bg)", boxShadow: "0 2px 8px rgba(20,15,50,.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input value={app.label} onChange={e => save({ ...data, apps: data.apps.map(a => a.id === app.id ? { ...a, label: e.target.value } : a) })}
          style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)", border: "none", background: "transparent", fontFamily: "inherit", width: "100%", outline: "none" }} />
        <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: app.statut === "nouvelle" ? color : "var(--v4-surface2)", color: app.statut === "nouvelle" ? "#fff" : "var(--v4-text3)", flexShrink: 0 }}>{app.statut}</span>
      </div>
      <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--v4-text3)", margin: "1px 0 4px" }}>[Conteneur {app.statut === "nouvelle" ? "applicatif — à créer" : "applicatif"}]</div>
      {app.label.startsWith("Module") && (
        <div style={{ fontSize: 12, color: "#b45309", fontStyle: "italic", marginBottom: 5 }}>✎ nom provisoire — cliquez pour le remplacer</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {app.features.map((f, fi) => (
          <div key={fi} style={{ fontSize: 12, padding: "3px 7px", borderRadius: 6, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", color: "var(--v4-text2)", display: "flex", gap: 4 }}>
            <span style={{ color: "var(--v4-text3)", fontWeight: 700 }}>L4</span>
            <span style={{ flex: 1 }}>{f}</span>
            <button onClick={() => save({ ...data, apps: data.apps.map(a => a.id === app.id ? { ...a, features: a.features.filter((_, j) => j !== fi) } : a) })}
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 12, padding: 0 }}>×</button>
          </div>
        ))}
        <button onClick={() => { const f = window.prompt("Nouvelle fonction (capability L4) :"); if (f) save({ ...data, apps: data.apps.map(a => a.id === app.id ? { ...a, features: [...a.features, f] } : a) }); }}
          style={{ fontSize: 12, padding: "2px 6px", borderRadius: 6, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>+ fonction</button>
      </div>
    </div>
  );

  const cycleSizing = (id: string) => save({ ...data, capas: data.capas.map(c => c.id === id ? { ...c, sizing: SIZINGS[(SIZINGS.indexOf(c.sizing) + 1) % 5] } : c) });
  const toggleImpact = (id: string, imp: string) => save({ ...data, capas: data.capas.map(c => c.id === id ? { ...c, impacts: c.impacts.includes(imp) ? c.impacts.filter(i => i !== imp) : [...c.impacts, imp] } : c) });

  const tabBtn = (k: typeof tab, lbl: string) => (
    <button key={k} onClick={() => setTab(k)} style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: "none", background: tab === k ? color : "transparent", color: tab === k ? "#fff" : "var(--v4-text3)" }}>{lbl}</button>
  );

  return (
    <div style={{ borderTop: `1px solid ${color}20`, background: "var(--v4-surface)", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".08em" }}>🏗 Trajectoire de transformation — O{moeIdx + 1}</span>
        <span style={{ fontSize: 12, color: "#8b5cf6", border: "1px dashed #8b5cf6", borderRadius: 8, padding: "1px 7px" }}>✦ Proposée par Aura — tout est modifiable</span>
        <span style={{ fontSize: 12, color: "var(--v4-text3)" }}>Tracée depuis la décision « {session.title} »</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={refineWithAura} disabled={refining}
            style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, cursor: refining ? "wait" : "pointer", fontFamily: "inherit", border: "1.5px dashed #8b5cf6", background: "transparent", color: "#8b5cf6" }}>
            {refining ? "Affinage…" : "✦ Affiner avec Aura"}
          </button>
          {tabBtn("capa", "Capabilities")}{tabBtn("appli", "Archi applicative")}{tabBtn("seq", "Séquence")}{tabBtn("flux", "Flux")}{tabBtn("backlog", "Backlog")}
          <button onClick={onClose} style={{ fontSize: 12.5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
      </div>
      {refineMsg && (
        <div style={{ fontSize: 12, color: refineMsg.startsWith("✦") ? "#7c3aed" : "#92400e", marginBottom: 8, padding: "4px 9px", borderRadius: 6, background: refineMsg.startsWith("✦") ? "#8b5cf610" : "#fffbeb", border: `1px solid ${refineMsg.startsWith("✦") ? "#8b5cf640" : "#fcd34d"}` }}>{refineMsg}</div>
      )}

      {/* ── Capabilities impactées : heatmap t-shirt + impacts de change ── */}
      {tab === "capa" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic" }}>
            Carte de travail restreinte (jamais un référentiel exhaustif). Cliquez un badge pour changer le sizing ; cliquez les impacts pour les activer/désactiver.
          </div>
          {([1, 2, 3] as const).map(lvl => (
            <div key={lvl}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", margin: "6px 0 4px" }}>Niveau L{lvl}{lvl === 3 ? " — sur le chemin de la transformation" : ""}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.capas.filter(c => c.level === lvl).map(c => (
                  <div key={c.id} style={{ border: `1.5px solid ${SIZING_COLOR[c.sizing]}60`, background: `${SIZING_COLOR[c.sizing]}0d`, borderRadius: 8, padding: "7px 10px", minWidth: 180, flex: "0 1 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--v4-text)", flex: 1 }}>{c.label}</span>
                      <button onClick={() => cycleSizing(c.id)} title="Cliquer pour changer le t-shirt sizing"
                        style={{ fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", background: SIZING_COLOR[c.sizing], color: "#fff" }}>{c.sizing}</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                      {CHANGE_IMPACTS.map(imp => (
                        <button key={imp} onClick={() => toggleImpact(c.id, imp)}
                          style={{ fontSize: 12, fontWeight: 600, padding: "1px 6px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            border: `1px solid ${c.impacts.includes(imp) ? color : "var(--v4-border)"}`,
                            background: c.impacts.includes(imp) ? `${color}15` : "transparent",
                            color: c.impacts.includes(imp) ? color : "var(--v4-text3)" }}>{imp}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Architecture applicative : L4 imbriquées + liens nommés ── */}
      {tab === "appli" && (() => {
        // ── Diagramme applicatif de style C4 (niveau conteneurs) ──
        // Boîtes HTML éditables positionnées + calque SVG pour les liens
        // orthogonaux étiquetés (couleur = protocole, trait = criticité).
        const BOX_W = 262, GAP_X = 46, PAD_X = 18;
        const hOf = (a: AppBox) => 62 + (a.label.startsWith("Module") ? 15 : 0) + a.features.length * 23 + 24;
        const existing = data.apps.filter(a => a.statut !== "nouvelle");
        const targets = data.apps.filter(a => a.statut === "nouvelle");
        const topY = 30;
        const topMaxH = Math.max(...existing.map(hOf), 90);
        const boundaryY = topY + topMaxH + 64;
        const contentW = Math.max(existing.length * (BOX_W + GAP_X) - GAP_X + PAD_X * 2, 660);
        const pos: Record<string, { x: number; y: number; h: number }> = {};
        existing.forEach((a, i) => { pos[a.id] = { x: PAD_X + i * (BOX_W + GAP_X), y: topY, h: hOf(a) }; });
        targets.forEach((a, i) => { pos[a.id] = { x: (contentW - (targets.length * (BOX_W + 24) - 24)) / 2 + i * (BOX_W + 24), y: boundaryY + 34, h: hOf(a) }; });
        const boundaryH = (targets.length ? Math.max(...targets.map(hOf)) : 90) + 58;
        const contentH = boundaryY + boundaryH + 46;
        const anchorBottom = (id: string) => ({ x: (pos[id]?.x ?? 0) + BOX_W / 2, y: (pos[id]?.y ?? 0) + (pos[id]?.h ?? 0) });
        const anchorTop = (id: string) => ({ x: (pos[id]?.x ?? 0) + BOX_W / 2, y: pos[id]?.y ?? 0 });
        return (
        <div>
          <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 12 }}>
            Vue conteneurs (style C4) — la frontière pointillée délimite le système cible ; chaque conteneur imbrique ses fonctions L4 ; les liens portent l'information transitée.
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ position: "relative", width: contentW, height: contentH }}>
              {/* Frontière du système cible */}
              <div style={{ position: "absolute", left: PAD_X - 10, top: boundaryY, width: contentW - (PAD_X - 10) * 2, height: boundaryH, border: `1.5px dashed ${color}70`, borderRadius: 8, background: `${color}05` }}>
                <span style={{ position: "absolute", top: -9, left: 14, fontSize: 12, fontWeight: 800, color, background: "var(--v4-surface)", padding: "0 7px", letterSpacing: ".06em", textTransform: "uppercase" }}>Système cible — {moe.label}</span>
              </div>
              {/* Liens orthogonaux étiquetés */}
              <svg width={contentW} height={contentH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <defs><marker id="c4arr" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L8,3.5 L0,7 Z" fill="context-stroke" /></marker></defs>
                {data.flows.map((f, fi) => {
                  const pc = protoColor(f.protocole);
                  const fromT = data.apps.find(a => a.id === f.from), toT = data.apps.find(a => a.id === f.to);
                  if (!fromT || !toT || !pos[f.from] || !pos[f.to]) return null;
                  const downward = pos[f.to].y > pos[f.from].y;
                  const a1 = downward ? anchorBottom(f.from) : anchorBottom(f.from);
                  const a2 = downward ? anchorTop(f.to) : anchorBottom(f.to);
                  const midY = downward ? (a1.y + a2.y) / 2 + fi * 6 : Math.max(a1.y, a2.y) + 22 + fi * 8;
                  const d = downward
                    ? `M ${a1.x} ${a1.y} V ${midY} H ${a2.x + (fi - 1) * 10} V ${a2.y}`
                    : `M ${a1.x} ${a1.y} V ${midY} H ${a2.x - 24} V ${a2.y + pos[f.to].h} `;
                  return <path key={f.id} d={d} fill="none" stroke={pc} strokeWidth={critWidth(f.crit)} strokeDasharray={critDash(f.crit)} markerEnd="url(#c4arr)" />;
                })}
              </svg>
              {/* Étiquettes des liens */}
              {data.flows.map((f, fi) => {
                const pc = protoColor(f.protocole);
                if (!pos[f.from] || !pos[f.to]) return null;
                const a1 = anchorBottom(f.from), a2 = anchorTop(f.to);
                const downward = pos[f.to].y > pos[f.from].y;
                const lx = (a1.x + a2.x) / 2, ly = downward ? (a1.y + a2.y) / 2 + fi * 6 : Math.max(a1.y, a2.y) + 22 + fi * 8;
                return (
                  <span key={`l${f.id}`} title={`${f.protocole} · ${f.crit}`} style={{ position: "absolute", left: lx, top: ly, transform: "translate(-50%, -60%)", fontSize: 12, fontWeight: 700, color: pc, background: "var(--v4-surface)", border: `1px solid ${pc}50`, padding: "1px 7px", borderRadius: 8, whiteSpace: "nowrap" }}>
                    {f.label}
                  </span>
                );
              })}
              {/* Conteneurs */}
              {data.apps.map(app => pos[app.id] && (
                <div key={app.id} style={{ position: "absolute", left: pos[app.id].x, top: pos[app.id].y, width: BOX_W }}>
                  {renderAppBox(app)}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--v4-text3)" }}>
            <span style={{ fontWeight: 700 }}>Légende :</span>
            {Object.entries(PROTO_COLOR).slice(0, 4).map(([p2, c2]) => (
              <span key={p2} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={c2} strokeWidth={2} /></svg>{p2}
              </span>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke="#6b7280" strokeWidth={1.6} strokeDasharray="5 3" /></svg>Batch
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke="#dc2626" strokeWidth={2.6} /></svg>Critique
            </span>
          </div>
        </div>
        );
      })()}

      {/* ── Diagramme de séquence applicatif ── */}
      {tab === "seq" && (() => {
        const W = Math.max(560, data.apps.length * 190);
        const H = 90 + data.flows.length * 46;
        const x = (id: string) => 95 + data.apps.findIndex(a => a.id === id) * 190;
        return (
          <div style={{ overflowX: "auto" }}>
            <svg width={W} height={H} style={{ fontFamily: "inherit" }}>
              {data.apps.map((a, i) => (
                <g key={a.id}>
                  <rect x={20 + i * 190} y={8} width={150} height={30} rx={7} fill={a.statut === "nouvelle" ? color : "var(--v4-surface2)"} opacity={a.statut === "nouvelle" ? 0.9 : 1} />
                  <text x={95 + i * 190} y={27} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={a.statut === "nouvelle" ? "#fff" : "var(--v4-text)"}>{a.label.slice(0, 22)}</text>
                  <line x1={95 + i * 190} y1={40} x2={95 + i * 190} y2={H - 10} stroke="var(--v4-border)" strokeDasharray="4 4" />
                </g>
              ))}
              {data.flows.map((f, i) => {
                const y = 70 + i * 46; const x1 = x(f.from), x2 = x(f.to);
                return (
                  <g key={f.id}>
                    <line x1={x1} y1={y} x2={x2} y2={y} stroke={protoColor(f.protocole)} strokeWidth={critWidth(f.crit)} strokeDasharray={critDash(f.crit)} markerEnd="url(#arr)" />
                    <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize={12} fill="var(--v4-text2)">{i + 1}. {f.label}</text>
                  </g>
                );
              })}
              <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={color} /></marker></defs>
            </svg>
          </div>
        );
      })()}

      {/* ── Liste des flux (éditable) ── */}
      {tab === "flux" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
            <thead><tr>{["De", "Vers", "Information transitée", "Protocole", "Criticité", ""].map(h => <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "var(--v4-text3)", fontSize: 12, textTransform: "uppercase", borderBottom: "1px solid var(--v4-border)" }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.flows.map(f => (
                <tr key={f.id}>
                  <td style={{ padding: "4px 8px" }}>
                    <select value={f.from} onChange={e => save({ ...data, flows: data.flows.map(x2 => x2.id === f.id ? { ...x2, from: e.target.value } : x2) })} style={{ fontSize: 12.5, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "2px 4px" }}>
                      {data.apps.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select></td>
                  <td style={{ padding: "4px 8px" }}>
                    <select value={f.to} onChange={e => save({ ...data, flows: data.flows.map(x2 => x2.id === f.id ? { ...x2, to: e.target.value } : x2) })} style={{ fontSize: 12.5, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "2px 4px" }}>
                      {data.apps.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select></td>
                  <td style={{ padding: "4px 8px" }}><input value={f.label} onChange={e => save({ ...data, flows: data.flows.map(x2 => x2.id === f.id ? { ...x2, label: e.target.value } : x2) })} style={{ fontSize: 12.5, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "2px 6px", width: 200 }} /></td>
                  <td style={{ padding: "4px 8px" }}><input value={f.protocole} onChange={e => save({ ...data, flows: data.flows.map(x2 => x2.id === f.id ? { ...x2, protocole: e.target.value } : x2) })} style={{ fontSize: 12.5, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "2px 6px", width: 90 }} /></td>
                  <td style={{ padding: "4px 8px" }}>
                    <select value={f.crit} onChange={e => save({ ...data, flows: data.flows.map(x2 => x2.id === f.id ? { ...x2, crit: e.target.value as Flow["crit"] } : x2) })} style={{ fontSize: 12.5, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "2px 4px" }}>
                      {["Critique", "Standard", "Batch"].map(c => <option key={c}>{c}</option>)}
                    </select></td>
                  <td><button onClick={() => save({ ...data, flows: data.flows.filter(x2 => x2.id !== f.id) })} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)" }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => save({ ...data, flows: [...data.flows, { id: `f${Date.now()}`, from: data.apps[0]?.id ?? "", to: data.apps[1]?.id ?? data.apps[0]?.id ?? "", label: "Nouveau flux", protocole: "REST", crit: "Standard" }] })}
            style={{ marginTop: 6, fontSize: 12.5, padding: "4px 10px", borderRadius: 8, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>+ Ajouter un flux</button>
        </div>
      )}

      {/* ── Backlog de transformation ── */}
      {tab === "backlog" && (
        <div>
          <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 12 }}>
            Kanban MoSCoW — cochez ◻ pour marquer un élément livré ; le bouton de priorité déplace la carte.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
            {(["Must", "Should", "Could"] as const).map(pr => {
              const items = data.backlog.filter(b => b.prio === pr);
              const doneN = items.filter(b => b.done).length;
              const prColor = pr === "Must" ? "#dc2626" : pr === "Should" ? "#f59e0b" : "#64748b";
              return (
                <div key={pr} style={{ borderRadius: 8, border: `1px solid ${prColor}35`, background: "var(--v4-bg)", overflow: "hidden" }}>
                  <div style={{ padding: "6px 10px", background: `${prColor}0d`, borderBottom: `1px solid ${prColor}25`, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: prColor }}>{pr}</span>
                    <span style={{ fontSize: 12, color: "var(--v4-text3)" }}>{doneN}/{items.length} livré{doneN > 1 ? "s" : ""}</span>
                    <div style={{ marginLeft: "auto", width: 52, height: 4, borderRadius: 6, background: "var(--v4-border)", overflow: "hidden" }}>
                      <div style={{ width: `${items.length ? (doneN / items.length) * 100 : 0}%`, height: "100%", background: prColor }} />
                    </div>
                  </div>
                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 5, minHeight: 46 }}>
                    {items.map(b => (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 8, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", opacity: b.done ? 0.55 : 1 }}>
                        <button onClick={() => save({ ...data, backlog: data.backlog.map(x2 => x2.id === b.id ? { ...x2, done: !x2.done } : x2) })}
                          title={b.done ? "Marquer non livré" : "Marquer livré"}
                          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: b.done ? "#059669" : "var(--v4-text3)", padding: 0 }}>{b.done ? "☑" : "◻"}</button>
                        <input value={b.titre} onChange={e => save({ ...data, backlog: data.backlog.map(x2 => x2.id === b.id ? { ...x2, titre: e.target.value } : x2) })}
                          style={{ flex: 1, fontSize: 12.5, fontFamily: "inherit", background: "transparent", color: "var(--v4-text)", border: "none", outline: "none", textDecoration: b.done ? "line-through" : "none" }} />
                        {b.kind && <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".04em", color: b.kind === "Epic" ? "#7c3aed" : b.kind === "Feature" ? "#0284c7" : "var(--v4-text3)", background: b.kind === "Epic" ? "#7c3aed12" : b.kind === "Feature" ? "#0284c712" : "var(--v4-surface2)", padding: "1px 5px", borderRadius: 6, flexShrink: 0 }}>{b.kind.toUpperCase()}</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}12`, padding: "1px 5px", borderRadius: 6, flexShrink: 0 }}>{b.kr}</span>
                        <button onClick={() => save({ ...data, backlog: data.backlog.map(x2 => x2.id === b.id ? { ...x2, prio: x2.prio === "Must" ? "Should" : x2.prio === "Should" ? "Could" : "Must" } : x2) })}
                          title="Changer de colonne" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 12.5, padding: 0 }}>⇄</button>
                        <button onClick={() => save({ ...data, backlog: data.backlog.filter(x2 => x2.id !== b.id) })}
                          style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 12.5, padding: 0 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => save({ ...data, backlog: [...data.backlog, { id: `b${Date.now()}`, titre: "Nouvel élément", kr: `O${moeIdx + 1}`, prio: pr }] })}
                      style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>+ Ajouter</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dossier d'exigences (parcours Innovation produit) ────────────────────────
type ExiType = "Fonctionnelle" | "Non fonctionnelle" | "Contrainte";
interface Exigence { id: string; type: ExiType; texte: string; prio: "Must" | "Should" | "Could" }

function generateExigences(session: AtelierSession): Exigence[] {
  const leaves = (cs: AtelierCriterion[]): AtelierCriterion[] => cs.flatMap(c => c.children?.length ? leaves(c.children) : [c]);
  const tpms = leaves(session.criteria);
  // Formulation normalisée « Le système doit être capable de … » (the system
  // shall be able to), avec un NIVEAU DE PERFORMANCE ordinal — jamais un chiffre
  // inventé : le niveau reste sur l'échelle qualitative du modèle.
  const perfOf = (imp: string) => imp === "Essentiel" ? "Élevé" : imp === "Important" ? "Modéré" : "Faible";
  // Format : « Le système doit être capable de <capacité>, avec <performance>,
  // en <contexte> » — contexte optionnel ; la cible chiffrée est un champ à
  // préciser par l'expert (jamais inventée), le niveau exigé reste ordinal.
  const ctx = session.elicitation?.horizon ? `, en conditions nominales à l'horizon ${session.elicitation.horizon}` : "";
  const out: Exigence[] = tpms.map((t, i) => ({
    id: `ex${i}`,
    type: t.importance === "Essentiel" ? "Non fonctionnelle" : "Fonctionnelle",
    texte: `Le système doit être capable d'assurer « ${t.label.toLowerCase()} », avec un niveau de performance ${perfOf(t.importance)} (cible chiffrée : à préciser)${ctx}.`,
    prio: t.importance === "Essentiel" ? "Must" : t.importance === "Important" ? "Should" : "Could",
  }));
  const nonNeg = session.elicitation?.exigencesNonNeg;
  if (nonNeg) out.push({ id: "exC0", type: "Contrainte", texte: nonNeg, prio: "Must" });
  session.contraintes.forEach((c, i) => out.push({ id: `exC${i + 1}`, type: "Contrainte", texte: c, prio: "Must" }));
  return out;
}

export function RequirementsPanel({ session, onClose }: { session: AtelierSession; onClose: () => void }) {
  const KEY = `aura-exigences-${session.id}`;
  const [exigences, setExigences] = useState<Exigence[]>(() => {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* régénère */ }
    return generateExigences(session);
  });
  const save = (next: Exigence[]) => {
    setExigences(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };
  const [refining, setRefining] = useState(false);
  const [refineMsg, setRefineMsg] = useState<string | null>(null);
  async function refineWithAura() {
    setRefining(true); setRefineMsg(null);
    try {
      const { refineExigences } = await import("../../lib/v4/atelier-llm");
      const out = await refineExigences({ data: {
        context: session.contextEnriched ?? session.contextRaw ?? "",
        exigences: exigences.map(e => ({ id: e.id, type: e.type, texte: e.texte })),
      }});
      if (!out) { setRefineMsg("Affinage indisponible — les exigences dérivées sont conservées."); return; }
      const byId = new Map(out.exigences?.map(e => [e.id, e.texte]) ?? []);
      const nouvelles: Exigence[] = (out.nouvelles ?? []).slice(0, 2).map((n, i) => ({
        id: `exN${Date.now()}${i}`, type: (["Fonctionnelle", "Non fonctionnelle", "Contrainte"].includes(n.type) ? n.type : "Fonctionnelle") as ExiType,
        texte: n.texte, prio: "Should",
      }));
      save([...exigences.map(e => byId.get(e.id) ? { ...e, texte: byId.get(e.id)! } : e), ...nouvelles]);
      setRefineMsg("✦ Exigences affinées par Aura — vérifiez et ajustez.");
    } catch {
      setRefineMsg("Affinage indisponible — les exigences dérivées sont conservées.");
    } finally { setRefining(false); }
  }

  const TYPES: ExiType[] = ["Fonctionnelle", "Non fonctionnelle", "Contrainte"];
  const typeColor: Record<ExiType, string> = { Fonctionnelle: "#0284c7", "Non fonctionnelle": "#7c3aed", Contrainte: "#b45309" };
  const feats = exigences.filter(e => e.type === "Fonctionnelle").slice(0, 5);

  return (
    <div style={{ borderRadius: 8, border: "1.5px solid #7c3aed40", background: "var(--v4-surface)", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #7c3aed30", background: "#7c3aed08", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".08em" }}>📋 Dossier d'exigences — produit / offre</span>
        <span style={{ fontSize: 12, color: "#8b5cf6", border: "1px dashed #8b5cf6", borderRadius: 8, padding: "1px 7px" }}>✦ Dérivé des raisons de la décision — tout est modifiable</span>
        <button onClick={refineWithAura} disabled={refining}
          style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, cursor: refining ? "wait" : "pointer", fontFamily: "inherit", border: "1.5px dashed #8b5cf6", background: "transparent", color: "#8b5cf6" }}>
          {refining ? "Affinage…" : "✦ Affiner avec Aura"}
        </button>
        <button onClick={onClose} style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
      </div>
      {refineMsg && (
        <div style={{ fontSize: 12, color: refineMsg.startsWith("✦") ? "#7c3aed" : "#92400e", margin: "8px 16px 0", padding: "4px 9px", borderRadius: 6, background: refineMsg.startsWith("✦") ? "#8b5cf610" : "#fffbeb", border: `1px solid ${refineMsg.startsWith("✦") ? "#8b5cf640" : "#fcd34d"}` }}>{refineMsg}</div>
      )}
      <div style={{ padding: "8px 16px 0", fontSize: 12, color: "var(--v4-text3)" }}>
        Vaut pour un <strong>produit</strong> comme pour une <strong>nouvelle offre</strong> (service, offre commerciale, offre interne) : les exigences dérivent des raisons de la décision.
      </div>
      <div style={{ padding: "12px 16px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 8 }}>
          {TYPES.map(ty => (
            <div key={ty}>
              <div style={{ fontSize: 12, fontWeight: 800, color: typeColor[ty], textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{ty}s</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {exigences.filter(e => e.type === ty).map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 9px", borderRadius: 8, background: "var(--v4-bg)", border: `1px solid ${typeColor[ty]}25` }}>
                    <button onClick={() => save(exigences.map(x => x.id === e.id ? { ...x, prio: x.prio === "Must" ? "Should" : x.prio === "Should" ? "Could" : "Must" } : x))}
                      style={{ fontSize: 12, fontWeight: 800, padding: "1px 7px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", background: e.prio === "Must" ? "#dc2626" : e.prio === "Should" ? "#f59e0b" : "var(--v4-surface2)", color: e.prio === "Could" ? "var(--v4-text3)" : "#fff" }}>{e.prio}</button>
                    <input value={e.texte} onChange={ev => save(exigences.map(x => x.id === e.id ? { ...x, texte: ev.target.value } : x))}
                      style={{ flex: 1, fontSize: 12.5, fontFamily: "inherit", background: "transparent", color: "var(--v4-text)", border: "none", outline: "none" }} />
                    <button onClick={() => save(exigences.filter(x => x.id !== e.id))} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => save([...exigences, { id: `ex${Date.now()}`, type: ty, texte: "Nouvelle exigence", prio: "Should" }])}
                  style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>+ Ajouter</button>
              </div>
            </div>
          ))}
        </div>
        {/* Schéma d'illustration conceptuel — inspiration, pas un design */}
        <div style={{ flex: "0 1 300px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Schéma d'illustration</div>
          <svg viewBox="0 0 300 230" style={{ width: "100%", border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-bg)" }}>
            <ellipse cx={150} cy={110} rx={90} ry={62} fill="#7c3aed12" stroke="#7c3aed" strokeWidth={1.5} />
            <text x={150} y={106} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="var(--v4-text)">{session.title.length > 22 ? `${session.title.slice(0, 21)}…` : session.title}<title>{session.title}</title></text>
            <text x={150} y={122} textAnchor="middle" fontSize={12.5} fill="var(--v4-text3)">concept retenu</text>
            {feats.map((f, i) => {
              const ang = (i / Math.max(feats.length, 1)) * Math.PI * 2 - Math.PI / 2;
              const cx2 = 150 + Math.cos(ang) * 118, cy2 = 110 + Math.sin(ang) * 86;
              return (
                <g key={f.id}>
                  <line x1={150 + Math.cos(ang) * 88} y1={110 + Math.sin(ang) * 60} x2={cx2} y2={cy2} stroke="#7c3aed55" />
                  <circle cx={cx2} cy={cy2} r={5} fill="#7c3aed" />
                  {(() => {
                    // Libellé court, ancré vers l'intérieur pour rester dans le cadre.
                    const full = f.texte.replace(/^Le produit doit (permettre|garantir) « /, "").replace(/ ».*$/, "");
                    const short = full.length > 18 ? `${full.slice(0, 17)}…` : full;
                    const anchor = cx2 < 110 ? "start" : cx2 > 190 ? "end" : "middle";
                    const tx = anchor === "start" ? Math.max(4, cx2 - 8) : anchor === "end" ? Math.min(296, cx2 + 8) : cx2;
                    return <text x={tx} y={cy2 + (cy2 > 110 ? 18 : -10)} textAnchor={anchor} fontSize={12.5} fill="var(--v4-text2)">{short}<title>{full}</title></text>;
                  })()}
                </g>
              );
            })}
          </svg>
          <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", marginTop: 4 }}>
            Illustration d'inspiration générée depuis les exigences — ce n'est pas un design ni un rendu 3D d'ingénierie.
          </div>
        </div>
      </div>
    </div>
  );
}
