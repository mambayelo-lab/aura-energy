// ChaineObjectifs.tsx — « Chaîne dépliable » (direction retenue avec le décideur).
//
// POURQUOI CETTE FIGURE. L'évaluation n'est pas plate : un indicateur (TPM)
// alimente une dimension (MOP), qui alimente un objectif (MOE). La chaîne rend
// visible cette remontée — et rien d'autre. Repliée, elle tient en trois lignes
// par objectif ; dépliée, elle montre d'où vient le niveau.
//
// AXIOMES RESPECTÉS (BORA)
//  · Lecture bipolaire systématique : chaque nœud porte son potentiel
//    d'amélioration (δ⁺) ET son potentiel de dégradation (δ⁻). Jamais l'un seul.
//  · Aucune compensation : les deux pôles ne se soustraient pas, ne se moyennent
//    pas. Ils s'affichent côte à côte.
//  · Aucun chiffre : niveaux ordinaux Nul · Faible · Modéré · Élevé uniquement.
//  · Un critère essentiel sans apport reste bloquant : il est marqué, pas noyé.
import { useState } from "react";

const WARN = "#b45309";
const LVL = ["Nul", "Faible", "Modéré", "Élevé"] as const;
export type Niveau = 0 | 1 | 2 | 3;

export interface ChaineNode {
  id: string;
  label: string;
  /** MOE = objectif, MOP = dimension, TPM = indicateur. */
  niveau: "MOE" | "MOP" | "TPM";
  importance?: string;
  plus: Niveau;
  minus: Niveau;
  children?: ChaineNode[];
}

const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: ".08em",
  textTransform: "uppercase", color: "var(--v4-text3)",
};

/** Deux rampes ordinales superposées : ↑ apport, ↓ risque. Jamais de score. */
function Bipolaire({ plus, minus, compact }: { plus: Niveau; minus: Niveau; compact?: boolean }) {
  const w = compact ? 14 : 20;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {([["↑", plus, "var(--v4-accent)"], ["↓", minus, WARN]] as const).map(([sign, lvl, col]) => (
        <div key={sign} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ display: "flex", gap: 3 }}>
            {[1, 2, 3].map(i => (
              <span key={i} style={{
                width: w, height: 4, borderRadius: 999,
                background: i <= lvl ? col : "var(--v4-border)",
              }} />
            ))}
          </span>
          <span style={{
            fontSize: compact ? 13 : 12.5, fontWeight: 700, whiteSpace: "nowrap",
            color: lvl === 0 ? "var(--v4-text3)" : col,
          }}>{sign} {LVL[lvl]}</span>
        </div>
      ))}
    </div>
  );
}

/** Bloquant : importance essentielle et aucun apport → le verdict ne peut pas l'ignorer. */
const bloquant = (n: ChaineNode) =>
  (n.importance === "Essentiel" || n.importance === "Critique") && n.plus === 0;

function Ligne({ node, depth }: { node: ChaineNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const kids = node.children ?? [];
  return (
    <div>
      <div
        onClick={kids.length ? () => setOpen(o => !o) : undefined}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
          padding: depth === 0 ? "14px 18px" : "10px 18px",
          paddingLeft: 18 + depth * 18,
          cursor: kids.length ? "pointer" : "default",
          borderTop: "1px solid var(--v4-border)",
          background: depth === 0 ? "var(--v4-surface)" : "transparent",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: "var(--v4-text3)", width: 10, flexShrink: 0 }}>
            {kids.length ? (open ? "▾" : "▸") : ""}
          </span>
          <span style={{ ...label, width: 30, flexShrink: 0 }}>{node.niveau}</span>
          <span style={{
            fontSize: depth === 0 ? 13.5 : 13, fontWeight: depth === 0 ? 600 : 500,
            color: depth === 0 ? "var(--v4-text)" : "var(--v4-text2)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{node.label}</span>
          {bloquant(node) && (
            <span style={{
              padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800,
              letterSpacing: ".06em", textTransform: "uppercase",
              background: "color-mix(in oklab, #b45309 12%, transparent)", color: WARN, flexShrink: 0,
            }}>Bloquant</span>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          <Bipolaire plus={node.plus} minus={node.minus} compact={depth > 0} />
        </div>
      </div>
      {open && kids.map(k => <Ligne key={k.id} node={k} depth={depth + 1} />)}
    </div>
  );
}

export function ChaineObjectifs({ nodes }: { nodes: ChaineNode[] }) {
  if (!nodes.length) return null;
  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
        padding: "12px 18px", background: "color-mix(in oklab, var(--v4-border) 22%, transparent)",
      }}>
        <span style={label}>Objectif · dimension · indicateur</span>
        <span style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 700, color: "var(--v4-text3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 4, borderRadius: 999, background: "var(--v4-accent)" }} />Amélioration
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 4, borderRadius: 999, background: WARN }} />Dégradation
          </span>
        </span>
      </div>
      {nodes.map(n => <Ligne key={n.id} node={n} depth={0} />)}
      <div style={{ padding: "9px 18px", borderTop: "1px solid var(--v4-border)", fontSize: 12.5, color: "var(--v4-text3)" }}>
        Chaque niveau se lit sur ses deux pôles. Aucun pôle n'en compense un autre.
      </div>
    </div>
  );
}
