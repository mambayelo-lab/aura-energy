// AuraUI.tsx — le socle visuel partagé des quatre espaces d'Aura.
//
// Il existe pour une seule raison : avant lui, chaque espace redéfinissait sa
// propre identité, ses propres icônes (des emoji) et son propre gabarit de page.
// Résultat : trois logos Aura, dix tailles de texte, des glyphes manquants.
// Tout ce qui est ici est la version unique — un espace ne redéfinit plus.

import React from "react";
import { AuraArtwork } from "./AuraMark";
import {
  BookOpen, Plug, Puzzle, Boxes, BarChart3, Link2, Compass, Zap, Globe,
  Search, Target, Scale, Bell, ScrollText, User, Settings, FolderTree,
  Satellite, KeyRound, Lock, ClipboardList, Building2, Users, Lightbulb,
  FileText, MessageSquare, Ruler, Coins, Handshake, TrendingUp, Trash2,
  PenLine, Mic, Library, Shield, SlidersHorizontal, Network, Clapperboard,
  Paperclip, Layers, Flag, HelpCircle, Map, Leaf, Timer, Diamond, Rocket,
  AlertTriangle, type LucideIcon,
} from "lucide-react";

/* ── Icônes ──────────────────────────────────────────────────────────────────
   Un seul jeu, de trait, à la taille du texte qu'il accompagne. Les clés
   reprennent les emoji historiques pour que la reprise soit mécanique et sûre. */
const ICONS: Record<string, LucideIcon> = {
  "📖": BookOpen, "🔌": Plug, "🧩": Puzzle, "🔷": Boxes, "📊": BarChart3,
  "🔗": Link2, "🧭": Compass, "⚡": Zap, "🌐": Globe, "🔍": Search,
  "🎯": Target, "⚖": Scale, "🔔": Bell, "🧾": ScrollText, "👤": User,
  "⚙": Settings, "🗂": FolderTree, "🗂️": FolderTree, "🛰": Satellite,
  "🔑": KeyRound, "🔒": Lock, "📋": ClipboardList, "🏛": Building2,
  "🏗": Building2, "👥": Users, "💡": Lightbulb, "📄": FileText,
  "💬": MessageSquare, "📐": Ruler, "💰": Coins, "🤝": Handshake,
  "📈": TrendingUp, "🗑": Trash2, "📝": PenLine, "🎙": Mic, "🔊": Mic,
  "📚": Library, "🛡": Shield, "🎛": SlidersHorizontal, "⛓": Network,
  "🎬": Clapperboard, "📎": Paperclip, "🧱": Layers, "🏁": Flag,
  "❓": HelpCircle, "🗺": Map, "🌿": Leaf, "⏱": Timer, "◈": Diamond,
  "🚀": Rocket, "⚠": AlertTriangle,
};

/** Icône Aura. `e` est la clé historique (emoji) ; le rendu est une icône de trait. */
export function AuraIcon({ e, size = 15, color = "currentColor", strokeWidth = 1.7 }: {
  e: string; size?: number; color?: string; strokeWidth?: number;
}) {
  const Cmp = ICONS[e.replace("\uFE0F", "")] ?? ICONS[e];
  if (!Cmp) return null;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} style={{ flexShrink: 0 }} />;
}

/* ── Identité ────────────────────────────────────────────────────────────── */

/** Le lockup Aura — la seule marque, identique dans les quatre espaces.
 * Rendu via l'image du logo officiel (public/aura-logo.png), pour que
 * l'application affiche exactement la même marque que le reste de la
 * communication Aura, plutôt qu'une reconstruction texte+SVG. */
export function AuraLogo({ size = "md", product }: {
  size?: "sm" | "md" | "lg";
  product?: string;
}) {
  const artworkHeight = size === "lg" ? 46 : size === "sm" ? 29 : 37;
  return (
    <span className="aura-brand-lockup" style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
      <AuraArtwork height={artworkHeight} title="Aura" />
      {product && <span style={{ marginTop: 2, paddingLeft: 2, fontSize: 12, fontWeight: 750, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--v4-text3)", whiteSpace: "nowrap" }}>{product}</span>}
    </span>
  );
}

/* ── Gabarit de page ─────────────────────────────────────────────────────────
   Même en-tête, même largeur utile, même respiration — partout. */

export function PageHeader({ title, subtitle, badge, actions, hero }: {
  title: string; subtitle?: string; badge?: string; actions?: React.ReactNode;
  /** Bandeau sombre indigo (Supply Chain, Décider). */
  hero?: boolean;
}) {
  return (
    <header className={`aura-page-header${hero ? " aura-hero-band" : ""}`} style={{
      display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap",
      padding: "13px 20px", borderBottom: "1px solid var(--v4-border)",
      background: "var(--v4-surface)", position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{
            margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--aura-t1)",
            fontWeight: 600, letterSpacing: "-.015em", color: "var(--v4-text)",
          }}>{title}</h1>
          {badge && (
            <span className={hero ? "aura-hero-badge" : undefined} style={{
              fontSize: "var(--aura-t6)", fontWeight: 700, letterSpacing: ".05em",
              textTransform: "uppercase", padding: "3px 8px", borderRadius: 999,
              background: "var(--v4-accent-bg)", color: "var(--v4-accent2)",
            }}>{badge}</span>
          )}
        </div>
        {subtitle && (
          <p style={{ margin: "5px 0 0", fontSize: "var(--aura-t5)", color: "var(--v4-text2)" }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>{actions}</div>
      )}
    </header>
  );
}

/** Corps fluide : centré sur portable, exploite les grands écrans sans étirer la lecture. */
export function PageBody({ children, width = 1180 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      className="aura-page-body"
      style={{ "--aura-page-max": `${Math.max(width, 1360)}px` } as React.CSSProperties}
    >{children}</div>
  );
}

/** État vide : occupe la hauteur au lieu de laisser un canevas nu. */
export function EmptyState({ icon, title, hint, action }: {
  icon?: string; title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      flex: 1, minHeight: 280, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center",
      border: "1px dashed var(--v4-border2)", borderRadius: 8,
      background: "var(--v4-surface)", padding: "40px 28px",
    }}>
      {icon && (
        <span style={{
          width: 44, height: 44, borderRadius: 8, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          background: "var(--v4-accent-bg)", color: "var(--v4-accent)",
        }}>
          <AuraIcon e={icon} size={21} />
        </span>
      )}
      <div style={{ fontSize: "var(--aura-t3)", fontWeight: 600, color: "var(--v4-text)" }}>{title}</div>
      {hint && (
        <div style={{ fontSize: "var(--aura-t5)", color: "var(--v4-text2)", maxWidth: 420 }}>{hint}</div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

/* ── Parcours numéroté ───────────────────────────────────────────────────────
   Le modèle 1000minds : des étapes ordonnées, l'avancement visible, et à tout
   moment la réponse à « où j'en suis, qu'est-ce qui suit ». */

export type JourneyStep = {
  key: string; label: string; icon?: string;
  /** L'étape est-elle remplie ? Sert au décompte et à la prochaine étape. */
  done?: boolean;
  /** Étape de lecture (un résultat), pas de saisie : hors numérotation. */
  readOnly?: boolean;
  hint?: string;
  /** Phase du parcours — regroupe les étapes par intention (facultatif). */
  phase?: string;
};

/** Anneau d'avancement — l'état du parcours lisible sans lire de texte. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 15, c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" style={{ flexShrink: 0 }}>
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--v4-border)" strokeWidth="3" />
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--v4-accent)" strokeWidth="3"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 19 19)" style={{ transition: "stroke-dashoffset .4s" }} />
      <text x="19" y="22.5" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--v4-text)">{done}</text>
    </svg>
  );
}

export function JourneyRail({ steps, active, onGo }: {
  steps: JourneyStep[]; active: string; onGo: (key: string) => void;
}) {
  const numbered = steps.filter(s => !s.readOnly);
  const doneCount = numbered.filter(s => s.done).length;
  const next = numbered.find(s => !s.done);
  // Le parcours se lit par phases quand elles sont déclarées : on comprend
  // l'intention (définir, raccorder, raisonner) avant la liste d'étapes.
  const phases: { name: string | undefined; items: JourneyStep[] }[] = [];
  for (const s of steps) {
    const last = phases[phases.length - 1];
    if (last && last.name === s.phase) last.items.push(s);
    else phases.push({ name: s.phase, items: [s] });
  }
  return (
    <nav style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ padding: "0 8px 12px", display: "flex", alignItems: "center", gap: 11 }}>
        <ProgressRing done={doneCount} total={numbered.length} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: "var(--aura-t6)", fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase", color: "var(--v4-text3)",
          }}>Parcours</div>
          <div style={{ fontSize: "var(--aura-t5)", fontWeight: 700, color: "var(--v4-text)" }}>
            {doneCount} / {numbered.length} étapes
          </div>
        </div>
      </div>
      {phases.map((ph, pi) => (
        <div key={ph.name ?? pi} style={{ marginBottom: 6 }}>
          {ph.name && (
            <div style={{
              padding: "8px 9px 4px", fontSize: 12, fontWeight: 800, letterSpacing: ".12em",
              textTransform: "uppercase", color: "var(--v4-text3)",
            }}>{ph.name}</div>
          )}
          {/* Colonne verticale : les étapes d'une phase forment une chaîne. */}
          <div style={{ position: "relative", paddingLeft: 2 }}>
            {ph.items.length > 1 && (
              <span style={{ position: "absolute", left: 13, top: 16, bottom: 16, width: 1, background: "var(--v4-border)" }} />
            )}
            {ph.items.map(step => {
              const idx = numbered.indexOf(step);
              const isActive = step.key === active;
              const isNext = next?.key === step.key;
              return (
                <button key={step.key} type="button" onClick={() => onGo(step.key)}
                  style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                    padding: "8px 9px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "inherit", width: "100%",
                    background: isActive ? "var(--v4-accent-bg)" : "transparent",
                    color: isActive ? "var(--v4-accent2)" : "var(--v4-text2)",
                    fontWeight: isActive ? 700 : 500, fontSize: "var(--aura-t5)",
                  }}>
                  <span style={{
                    width: 19, height: 19, borderRadius: 999, flexShrink: 0, fontSize: 12, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `1.5px solid ${step.done ? "var(--v4-green)" : isActive ? "var(--v4-accent)" : "var(--v4-border2)"}`,
                    background: step.done ? "var(--v4-green)" : "var(--v4-surface)",
                    color: step.done ? "#fff" : isActive ? "var(--v4-accent)" : "var(--v4-text3)",
                  }}>
                    {step.done ? "✓" : idx >= 0 ? idx + 1 : "·"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {step.label}
                  </span>
                  {isNext && !isActive && (
                    <span style={{
                      fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
                      color: "var(--v4-accent)", flexShrink: 0,
                    }}>à faire</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Bandeau d'état du modèle — ce que le Studio a réellement produit, chiffré,
    en tête de chaque étape : on voit d'un coup d'œil ce qui manque. */
export function ModelState({ items }: { items: { label: string; value: number }[] }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 0, border: "1px solid var(--v4-border)",
      borderRadius: 8, background: "var(--v4-surface)", overflow: "hidden",
    }}>
      {items.map((it, i) => (
        <div key={it.label} style={{
          flex: "1 1 110px", padding: "8px 12px",
          borderLeft: i === 0 ? "none" : "1px solid var(--v4-border)",
        }}>
          <div style={{
            fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
            color: "var(--v4-text3)", marginBottom: 3,
          }}>{it.label}</div>
          <div style={{
            fontSize: 17, fontWeight: 800, lineHeight: 1,
            color: it.value > 0 ? "var(--v4-text)" : "var(--v4-text3)",
            fontVariantNumeric: "tabular-nums",
          }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Parcours en onglets, posé DANS la page (sous l'en-tête) au lieu d'une
    colonne latérale dédiée — même structure que JourneyRail (phases →
    étapes, anneau de progression, badge "à faire") mais horizontale, pour
    regagner la largeur qu'une colonne fixe de ~240px coûtait à chaque page
    Studio. Utilisé à la place de JourneyRail sur /cockpit/argus-admin. */
export function JourneyTabs({ steps, active, onGo }: {
  steps: JourneyStep[]; active: string; onGo: (key: string) => void;
}) {
  const numbered = steps.filter(s => !s.readOnly);
  const doneCount = numbered.filter(s => s.done).length;
  const next = numbered.find(s => !s.done);
  const phases: { name: string | undefined; items: JourneyStep[] }[] = [];
  for (const s of steps) {
    const last = phases[phases.length - 1];
    if (last && last.name === s.phase) last.items.push(s);
    else phases.push({ name: s.phase, items: [s] });
  }
  return (
    <nav aria-label="Parcours Studio" style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16,
      padding: "10px 0 14px", borderBottom: "1px solid var(--v4-border)", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <ProgressRing done={doneCount} total={numbered.length} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "var(--aura-t6)", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--v4-text3)" }}>Parcours</div>
          <div style={{ fontSize: "var(--aura-t5)", fontWeight: 700, color: "var(--v4-text)", whiteSpace: "nowrap" }}>{doneCount} / {numbered.length} étapes</div>
        </div>
      </div>
      {phases.map((ph, pi) => (
        <div key={ph.name ?? pi} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {ph.name && (
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--v4-text3)" }}>{ph.name}</span>
          )}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ph.items.map(step => {
              const idx = numbered.indexOf(step);
              const isActive = step.key === active;
              const isNext = next?.key === step.key;
              return (
                <button key={step.key} type="button" onClick={() => onGo(step.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, textAlign: "left",
                    padding: "6px 10px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${isActive ? "var(--v4-accent)" : "var(--v4-border)"}`,
                    background: isActive ? "var(--v4-accent-bg)" : "var(--v4-surface)",
                    color: isActive ? "var(--v4-accent2)" : "var(--v4-text2)",
                    fontWeight: isActive ? 700 : 500, fontSize: "var(--aura-t6)", whiteSpace: "nowrap",
                  }}>
                  <span style={{
                    width: 15, height: 15, borderRadius: 999, flexShrink: 0, fontSize: 12, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `1.5px solid ${step.done ? "var(--v4-green)" : isActive ? "var(--v4-accent)" : "var(--v4-border2)"}`,
                    background: step.done ? "var(--v4-green)" : "var(--v4-surface)",
                    color: step.done ? "#fff" : isActive ? "var(--v4-accent)" : "var(--v4-text3)",
                  }}>
                    {step.done ? "✓" : idx >= 0 ? idx + 1 : "·"}
                  </span>
                  {step.label}
                  {isNext && !isActive && (
                    <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--v4-accent)" }}>à faire</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** En-tête d'étape — l'objet de l'étape et ce qu'elle alimente ensuite. */
export function StageIntro({ step, total, title, purpose, feeds }: {
  step: number; total: number; title: string; purpose: string; feeds?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "2px 0 4px" }}>
      <div style={{
        flexShrink: 0, width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--v4-accent-bg)", color: "var(--v4-accent2)",
        fontSize: 13, fontWeight: 800,
      }}>{step}<span style={{ opacity: .5, fontSize: 13 }}>/{total}</span></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--aura-t3)", fontWeight: 700, color: "var(--v4-text)" }}>{title}</div>
        <div style={{ fontSize: "var(--aura-t5)", color: "var(--v4-text2)", marginTop: 2 }}>{purpose}</div>
        {feeds && (
          <div style={{ fontSize: "var(--aura-t6)", color: "var(--v4-text3)", marginTop: 3 }}>Alimente — {feeds}</div>
        )}
      </div>
    </div>
  );
}


/** Le pied de page du parcours : ce qui reste, et l'étape suivante. */
export function JourneyNext({ steps, active, onGo }: {
  steps: JourneyStep[]; active: string; onGo: (key: string) => void;
}) {
  const numbered = steps.filter(s => !s.readOnly);
  const here = numbered.findIndex(s => s.key === active);
  const next = here >= 0 ? numbered[here + 1] : numbered.find(s => !s.done);
  if (!next) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
      padding: "13px 16px", borderRadius: 8, border: "1px solid var(--v4-border)",
      background: "var(--v4-panel)",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: "var(--aura-t6)", fontWeight: 700, letterSpacing: ".08em",
          textTransform: "uppercase", color: "var(--v4-text3)",
        }}>Étape suivante</div>
        <div style={{ fontSize: "var(--aura-t4)", fontWeight: 600, color: "var(--v4-text)", marginTop: 2 }}>
          {next.label}
        </div>
        {next.hint && (
          <div style={{ fontSize: "var(--aura-t6)", color: "var(--v4-text2)", marginTop: 2 }}>{next.hint}</div>
        )}
      </div>
      <button type="button" onClick={() => onGo(next.key)}
        style={{
          flexShrink: 0, padding: "9px 16px", borderRadius: 8, border: "none",
          background: "var(--v4-accent,#7c3aed)", color: "#fff", fontFamily: "inherit",
          fontSize: "var(--aura-t5)", fontWeight: 700, cursor: "pointer",
        }}>
        Continuer →
      </button>
    </div>
  );
}
