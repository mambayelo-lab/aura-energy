// Illustration inline, sans dépendance ni asset externe : un motif SVG distinct
// par type de démo/pack, pour distinguer les démos au premier coup d'œil dans
// les listes (barre latérale Décider / Architecturer). Adapté d'un prototype
// fourni en inspiration — mêmes motifs, portés sans Tailwind pour rester
// cohérents avec le style inline (var(--v4-*)) du reste de l'app.
import type { CSSProperties } from "react";
import {
  Target, Scale, Handshake, Network, Factory, Droplets, Car, Plane, Bot, ShieldCheck, Boxes, TrendingDown,
  MessagesSquare, Workflow, Plug, ArrowLeftRight, Zap, GitBranch, UserCheck, Layers, SunMedium, RadioTower,
  ShoppingBag, Truck, HeartPulse, BrainCircuit, ShoppingCart, Cog, Rocket, Building2, Wind, Warehouse, Landmark, Leaf, ReceiptText, Flame,
  type LucideIcon,
} from "lucide-react";

export type PackIllustrationKind =
  | "decision" | "make-buy" | "supplier" | "network" | "factory" | "resources"
  | "vehicle" | "aircraft" | "agent" | "autonomy" | "architecture"
  | "minimal-change" | "copilot" | "fabric" | "mcp" | "a2a" | "event"
  | "strangler" | "human-gate" | "minimum-intelligence"
  | "solar-wind" | "dispatch";

const MOTIFS: Record<PackIllustrationKind, string> = {
  decision: `<circle cx="42" cy="42" r="18"/><path d="M42 16v52M16 42h52"/><circle cx="42" cy="42" r="5" fill="currentColor" stroke="none"/>`,
  "make-buy": `<rect x="12" y="18" width="24" height="24" rx="6"/><rect x="48" y="18" width="24" height="24" rx="6"/><path d="M24 42v18h36V42M42 54l-7-7M42 54l7-7"/>`,
  supplier: `<circle cx="18" cy="42" r="7"/><circle cx="42" cy="18" r="7"/><circle cx="66" cy="42" r="7"/><circle cx="42" cy="66" r="7"/><path d="M24 37 36 23M48 23l12 14M60 47 48 61M36 61 24 47"/>`,
  network: `<path d="M10 58c10-20 20-10 30-28s22-12 34 4"/><path d="M10 66c14-8 24 4 36-8s20-6 28 4"/><circle cx="24" cy="46" r="4" fill="currentColor" stroke="none"/><circle cx="48" cy="31" r="4" fill="currentColor" stroke="none"/><circle cx="66" cy="38" r="4" fill="currentColor" stroke="none"/>`,
  factory: `<path d="M12 66V36l15 9V33l16 10V28l17 10v28Z"/><path d="M18 66V54h10v12M36 66V54h10v12M54 66V54h10v12"/>`,
  resources: `<path d="M28 15c8 13 15 21 15 31a15 15 0 1 1-30 0c0-10 7-18 15-31Z"/><path d="M55 24c12 5 18 15 18 25 0 13-11 23-24 23"/><path d="m67 25-12-1 5 11"/>`,
  vehicle: `<path d="M14 51h56l-5-15-11-8H31l-10 8Z"/><circle cx="26" cy="55" r="7"/><circle cx="58" cy="55" r="7"/><path d="M32 28v23M51 28v23"/>`,
  aircraft: `<path d="m11 45 25-7 9-23 6 1-2 22 22 7-1 5-22-2-9 22-6-1 3-21-25 2Z"/>`,
  agent: `<rect x="20" y="18" width="44" height="44" rx="12"/><circle cx="34" cy="39" r="4" fill="currentColor" stroke="none"/><circle cx="50" cy="39" r="4" fill="currentColor" stroke="none"/><path d="M34 50h16M42 18V10"/>`,
  autonomy: `<path d="M42 10 68 20v18c0 17-11 29-26 36C27 67 16 55 16 38V20Z"/><path d="m31 42 7 7 15-18"/>`,
  architecture: `<rect x="12" y="12" width="22" height="16" rx="5"/><rect x="50" y="12" width="22" height="16" rx="5"/><rect x="31" y="54" width="22" height="16" rx="5"/><path d="M23 28v12h38V28M42 40v14"/>`,
  "minimal-change": `<path d="M12 64c16-4 17-22 30-24 10-2 13 10 28-20"/><circle cx="42" cy="40" r="5" fill="currentColor" stroke="none"/><path d="m62 18 9 2-2 9"/>`,
  copilot: `<rect x="14" y="18" width="56" height="44" rx="12"/><path d="M25 34h34M25 44h24M25 54h14"/><circle cx="61" cy="54" r="5" fill="currentColor" stroke="none"/>`,
  fabric: `<circle cx="20" cy="22" r="7"/><circle cx="64" cy="22" r="7"/><circle cx="20" cy="62" r="7"/><circle cx="64" cy="62" r="7"/><circle cx="42" cy="42" r="8"/><path d="M26 26 36 36M58 26 48 36M26 58 36 48M58 58 48 48"/>`,
  mcp: `<rect x="10" y="22" width="25" height="40" rx="7"/><rect x="49" y="22" width="25" height="40" rx="7"/><path d="M35 34h14M35 50h14"/><circle cx="42" cy="34" r="3" fill="currentColor" stroke="none"/><circle cx="42" cy="50" r="3" fill="currentColor" stroke="none"/>`,
  a2a: `<circle cx="23" cy="42" r="14"/><circle cx="61" cy="42" r="14"/><path d="M37 36h10m-7-5 7 5-7 5M47 48H37m7 5-7-5 7-5"/>`,
  event: `<path d="M16 22h24l-9 17h18L34 66l4-20H20Z"/><circle cx="62" cy="28" r="9"/><path d="M62 24v5l4 3"/>`,
  strangler: `<rect x="12" y="16" width="60" height="52" rx="10"/><rect x="20" y="24" width="22" height="36" rx="7"/><path d="M52 24h12M52 34h12M52 44h12M52 54h12"/><path d="M42 42h10"/>`,
  "human-gate": `<circle cx="42" cy="27" r="10"/><path d="M24 66c2-16 10-24 18-24s16 8 18 24"/><path d="M62 18v48M62 42h12"/>`,
  "minimum-intelligence": `<path d="M15 18h54v12H15zM22 36h40v12H22zM30 54h24v12H30z"/>`,
  "solar-wind": `<circle cx="26" cy="46" r="11"/><path d="M26 27v-6M13 33l-5-4M13 59l-5 4M39 33l5-4M39 59l5 4"/><path d="M62 14v52M62 20l14 6-14 6M62 36l11 5-11 5"/>`,
  dispatch: `<circle cx="42" cy="42" r="9" fill="currentColor" stroke="none"/><path d="M42 42 20 22M42 42 66 24M42 42 24 66M42 42 64 64"/><circle cx="20" cy="22" r="6"/><circle cx="66" cy="24" r="6"/><circle cx="24" cy="66" r="6"/><circle cx="64" cy="64" r="6"/>`,
};

/** Icône lucide par type (repli quand aucun secteur n'est reconnu). */
const LUCIDE_BY_KIND: Record<PackIllustrationKind, LucideIcon> = {
  decision: Target, "make-buy": Scale, supplier: Handshake, network: Network, factory: Factory, resources: Droplets,
  vehicle: Car, aircraft: Plane, agent: Bot, autonomy: ShieldCheck, architecture: Boxes, "minimal-change": TrendingDown,
  copilot: MessagesSquare, fabric: Workflow, mcp: Plug, a2a: ArrowLeftRight, event: Zap, strangler: GitBranch,
  "human-gate": UserCheck, "minimum-intelligence": Layers, "solar-wind": SunMedium, dispatch: RadioTower,
};

/** Icône parlante par secteur / cas, repérée dans le titre ou la description. */
const SECTOR_ICONS: [RegExp, LucideIcon][] = [
  [/genai|ia g[ée]n[ée]rative|agenti|agent|llm|copilote/i, BrainCircuit],
  [/drone|mars|martien|spatial|satellite/i, Rocket],
  [/m[ée]catroni|robot|actionneur|moteur/i, Cog],
  [/avion|a[ée]ronauti/i, Plane],
  [/v[ée]hicule|automobile|flotte/i, Car],
  [/factur|client[èe]le/i, ReceiptText],
  [/\bgaz\b|biom[ée]thane/i, Flame],
  [/sant[ée]|h[ôo]pital|patient|pharma|clinique/i, HeartPulse],
  [/solaire|photovolta|renouvelable/i, SunMedium],
  [/[ée]olien/i, Wind],
  [/t[ée]l[ée]rel[èe]ve|compteur|r[ée]seau [ée]lectrique|[ée]nergie|[ée]lectricit|gaz|smart grid/i, Zap],
  [/achat|fournisseur|sourcing|approvisionnement/i, ShoppingCart],
  [/retail|magasin|enseigne|commerce|client/i, ShoppingBag],
  [/entrep[ôo]t|stock|logistique/i, Warehouse],
  [/supply|transport|livraison|distribution/i, Truck],
  [/usine|industri|production|manufactur/i, Factory],
  [/banque|financ|assurance/i, Landmark],
  [/carbone|climat|durable|rse/i, Leaf],
  [/r[ée]seau|infrastructure|t[ée]l[ée]com/i, Network],
  [/architecture|si |syst[èe]me d'information|application/i, Boxes],
  [/public|collectivit|administration/i, Building2],
];

export function pickDemoIcon(kind: PackIllustrationKind, hint?: string | readonly string[]): LucideIcon {
  const hints = (Array.isArray(hint) ? hint : [hint]).filter(Boolean) as string[];
  for (const h of hints) for (const [re, icon] of SECTOR_ICONS) if (re.test(h)) return icon;
  return LUCIDE_BY_KIND[kind] ?? Target;
}

/**
 * Icône de démo (lucide), dans une pastille indigo cohérente si `pill`.
 * `hint` (titre / secteur) permet de choisir une icône propre au cas.
 */
export function PackIllustration({ kind, size = 20, color = "var(--v4-accent)", style, hint, pill }: {
  kind: PackIllustrationKind;
  size?: number;
  color?: string;
  style?: CSSProperties;
  hint?: string | readonly string[];
  pill?: boolean;
}) {
  const Icon = pickDemoIcon(kind, hint);
  if (pill) {
    return <span className="aura-icon-pill" data-testid="demo-icon" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), ...style }} aria-hidden="true">
      <Icon style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} strokeWidth={1.9} />
    </span>;
  }
  return <Icon width={size} height={size} color={color} strokeWidth={1.9} style={{ flexShrink: 0, ...style }} aria-hidden="true" />;
}

/** Ancienne illustration SVG (motifs), conservée pour usage décoratif éventuel. */
export function PackMotif({ kind, size = 20, color = "var(--v4-accent)", style }: {
  kind: PackIllustrationKind;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const inner = MOTIFS[kind] ?? MOTIFS.decision;
  return (
    <svg
      viewBox="0 0 84 84" width={size} height={size}
      stroke={color} fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, color, ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
