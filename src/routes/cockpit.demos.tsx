import { createFileRoute } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import { PageBody, PageHeader } from "../components/aura/AuraUI";
import { PackIllustration, type PackIllustrationKind } from "../components/aura/PackIllustration";
import { SECTOR_PACKS } from "../lib/v4/packs-sectoriels";
import { countDecisionIndicators, enrichDecisionDemoCase } from "../lib/v4/demo-enrichment";
import { DEMO_FACTORIES } from "../lib/v4/atelier-cases";
import { newSession } from "../lib/v4/atelier-store";

const telereleve = DEMO_FACTORIES.telereleve(newSession({ contextRaw: "" }));

export const Route = createFileRoute("/cockpit/demos")({ component: () => <DemosGallery /> });

// Tons curés par pack : chaque secteur garde toujours la même couleur ; un id
// sans pack connu retombe sur un hachage stable parmi les mêmes tons.
const FALLBACK_TONES = [["#5b3dff", "#eeeaff"], ["#0f9f7a", "#e8fbf5"], ["#ec7c2d", "#fff2e8"], ["#e34370", "#ffedf3"]] as const;
const TONE_BY_PACK: Record<string, readonly [string, string]> = {
  demos: ["#5b3dff", "#eeeaff"],
  retail: ["#e34370", "#ffedf3"],
  energie: ["#0f6fa8", "#e7f4fb"],
  supply: ["#ec7c2d", "#fff2e8"],
  renouvelables: ["#0f9f7a", "#e8fbf5"],
  "architecture-entreprise": ["#5b3dff", "#eeeaff"],
};
const KIND_BY_PACK: Record<string, PackIllustrationKind> = {
  demos: "decision", retail: "network", energie: "resources", supply: "supplier", renouvelables: "solar-wind",
  "architecture-entreprise": "architecture",
};
/** Tronque sur un mot entier — jamais au milieu d'un mot, jamais un simple "…substring". */
function softTruncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}
function Card({ id, packId, title, description, details, kind, onOpen, onPreview }: {
  id: string; packId?: string; title: string; description: string; details?: string; kind: PackIllustrationKind;
  onOpen: () => void; onPreview?: () => void;
}) {
  const [accent, wash] = TONE_BY_PACK[packId ?? ""] ?? FALLBACK_TONES[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FALLBACK_TONES.length];
  return <article className="pack-card" style={{ "--accent": accent, "--wash": wash } as CSSProperties}>
    <div className="pack-visual"><span/><div><PackIllustration kind={kind} size={56} pill hint={[title, details ?? "", description]}/></div></div>
    <div className="pack-copy">
      <small>Pack Aura · copie modifiable</small>
      <h3>{title}</h3><p>{softTruncate(description, 118)}</p>
      {details && <div className="pack-details">{details}</div>}
      <footer>{onPreview && <button onClick={onPreview}>Visualiser</button>}<button className="primary" onClick={onOpen}>Ouvrir une copie →</button></footer>
    </div>
  </article>;
}

// Galerie de Décider : uniquement ses packs de décision.
export function DemosGallery() {
  const decisions = useMemo(() => SECTOR_PACKS.flatMap(pack => pack.cases.map(source => {
    const item = enrichDecisionDemoCase(source);
    return ({
    ...item,
    packId: pack.id,
    packLabel: pack.label,
    sector: pack.sector,
  }); })), []);

  return <div className="packs-page">
    <PageHeader hero title="Démonstrations" badge="Aura Décider" subtitle="Cas complets, entièrement modifiables."/>
    <PageBody width={1800}>
      <style>{`
        .packs-page{display:flex;flex:1;min-height:0;flex-direction:column}.packs-hero{padding:2px 2px 18px}.packs-hero small{font-size:12.5px;font-weight:600;letter-spacing:.08em;color:#8a8a8a;text-transform:uppercase}.packs-hero h2{font:600 26px/1.25 var(--font-display);margin:6px 0 4px;color:#111}.packs-hero p{margin:0;max-width:560px;font-size:13px;line-height:1.5;color:#8a8a8a}.packs-tabs{display:inline-flex;width:max-content;margin:16px 0 20px;padding:0;border-bottom:1px solid #e5e5e5;gap:4px}.packs-tabs button{border:0;background:transparent;color:#8a8a8a;border-radius:0;padding:9px 4px;margin-right:20px;font:600 13px var(--font-sans);border-bottom:2px solid transparent}.packs-tabs button.active{color:#111;border-color:var(--v4-accent,#7c3aed)}.packs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:14px}.pack-card{background:var(--aura-glass-bg,#fff);border:1px solid var(--aura-glass-border,#e5e5e5);border-radius:14px;box-shadow:var(--aura-glass-shadow);overflow:hidden;min-width:0;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.pack-card:hover{transform:translateY(-2px);box-shadow:var(--aura-glass-shadow-hover);border-color:rgb(71 67 230 / .3)}@media (prefers-reduced-motion: reduce){.pack-card,.pack-card:hover{transition:none;transform:none}}.pack-visual{height:100px;background:radial-gradient(circle at 30% 30%,var(--wash),#fff 78%);display:grid;place-items:center;position:relative}.pack-visual>span{position:absolute;width:138px;height:76px;border:1px solid var(--accent);border-radius:50%;opacity:.08;transform:rotate(-14deg)}.pack-visual>div{width:56px;height:56px;border-radius:8px;background:#fff;display:grid;place-items:center;z-index:1;box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 14%,transparent)}.pack-copy{padding:18px}.pack-copy>small{font-size:12px;font-weight:600;letter-spacing:.05em;color:#aaa}.pack-copy h3{font-size:15px;line-height:1.3;margin:6px 0;color:#111;font-weight:600}.pack-copy p{font-size:13px;line-height:1.55;color:#767676;min-height:52px}.pack-details{margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;color:#9a9a9a;font-size:12.5px;font-weight:500;line-height:1.5}.pack-copy footer{display:flex;gap:8px;margin-top:15px}.pack-copy button{border:1px solid #ddd;background:#fff;color:#444;border-radius:8px;padding:9px 11px;font:600 13px var(--font-sans)}.pack-copy button.primary{margin-left:auto;background:var(--aura-night,#0a0b1e);color:#fff;border-color:var(--aura-night,#0a0b1e)}.pack-preview{margin:0 0 20px;padding:22px 0;border-bottom:1px solid #e5e5e5;display:grid;grid-template-columns:minmax(240px,.8fr) minmax(360px,1.2fr);gap:28px}.pack-preview h3{font:600 22px var(--font-display);margin:5px 0 8px;color:#111}.pack-preview p{font-size:13px;line-height:1.55;color:#767676}.pack-preview button{border:0;border-radius:8px;background:var(--aura-night,#0a0b1e);color:#fff;padding:10px 13px;font:600 13px var(--font-sans)}.pack-flow{display:grid;grid-template-columns:repeat(4,1fr);align-items:center;gap:12px}.pack-flow span{position:relative;padding:16px 8px;background:transparent;border:1px solid #e5e5e5;border-radius:8px;text-align:center;font-size:13px;font-weight:600;color:#333}.pack-flow span:not(:last-child):after{content:"→";position:absolute;right:-12px;color:#bbb}@media(max-width:760px){.pack-preview{grid-template-columns:1fr}.pack-flow{grid-template-columns:1fr 1fr}.packs-tabs{display:grid;grid-template-columns:1fr 1fr;width:100%}.packs-tabs button{padding-inline:8px;margin-right:0}}
      `}</style>
      <section className="packs-hero"><small>Expériences Aura</small><h2>Partez d'un dossier déjà crédible</h2><p>Cadrage, indicateurs, leviers et options prêts à corriger, pas à écrire.</p></section>
      <div className="packs-grid">
        <Card key="telereleve" id="telereleve" title="Modernisation de la télérelève" description="Moderniser la télérelève du territoire à horizon 2030 : plateforme mutualisée ou infrastructure existante ?" details={`Investissement · ${countDecisionIndicators(telereleve.criteria)} indicateurs · ${telereleve.leviersDef.length} leviers · ${telereleve.leviersDef.reduce((sum, lever) => sum + lever.options.length, 0)} options`} kind="decision" onOpen={() => location.href = "/cockpit/atelier?demo=telereleve"}/>
        {decisions.map(item => <Card key={item.key} id={item.key} packId={item.packId} title={item.title} description={item.contextRaw} details={`${item.packLabel} · ${countDecisionIndicators(item.criteria)} indicateurs · ${item.leviersDef.length} leviers · ${item.leviersDef.reduce((sum, lever) => sum + lever.options.length, 0)} options`} kind={KIND_BY_PACK[item.packId] ?? "decision"} onOpen={() => location.href = `/cockpit/atelier?demo=${item.key}`}/>)}
      </div>
    </PageBody>
  </div>;
}
