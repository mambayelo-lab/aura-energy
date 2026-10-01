import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, FlaskConical, Loader2, RotateCcw, Sparkles, X, XCircle } from "lucide-react";
import { loadVocab, onVocabChange, saveVocab, type ArgusVocab } from "../../lib/v4/argus-vocab-store";
import { MAISON_LUCIE_PORTAL } from "../../lib/v4/maison-lucie-live";
import { loadStudioDraft, saveStudioDraft } from "../../lib/v4/studio.functions";
import {
  GUIDED_STEPS, SUPPLY_DEMO_NOTICE, SUPPLY_DEMO_STEPS, clearGuide, initialDemoProgress, isStaleSupplyDemo, isSupplyDemo, loadGuide,
  resetSupplyDemo, runSupplyDemo, saveGuide, type GuideState, type SupplyDemoProgress,
} from "../../lib/v4/supply-demo";

// Les secrets de session ne sont jamais persistés (même règle que le Studio).
function persistable(v: ArgusVocab): ArgusVocab {
  return { ...v, apps: v.apps.map(({ liveEndpoint, ...app }) => ({ ...app, secretConfigured: Boolean(liveEndpoint) || app.secretConfigured })) };
}

// Enregistre localement (le cockpit relit immédiatement) puis, si une
// session Studio existe, dans le brouillon serveur pour que le Studio
// retrouve le même état.
export async function persistSupplyVocab(v: ArgusVocab): Promise<void> {
  const clean = persistable(v);
  saveVocab(clean);
  try {
    const { context } = await loadStudioDraft();
    if (context?.id) await saveStudioDraft({ data: { contextId: context.id, name: clean.domaine || "SCRA Studio", sector: "Supply Chain", draft: clean as unknown as Record<string, unknown> } });
  } catch { /* hors connexion : persistance locale seulement */ }
}

export function useSupplyVocab(): ArgusVocab | undefined {
  const [vocab, setVocab] = useState<ArgusVocab | undefined>(undefined);
  useEffect(() => {
    const sync = () => { try { setVocab(loadVocab()); } catch { /* stockage indisponible */ } };
    sync();
    return onVocabChange(sync);
  }, []);
  return vocab;
}

// Démo enregistrée par une version antérieure (autre code, autres données du
// SI) : relue une fois en arrière-plan avec la chaîne actuelle. En cas
// d'échec de lecture, l'état enregistré reste affiché tel quel.
let refreshing = false;
export function useSupplyDemoRefresh(vocab: ArgusVocab | undefined): void {
  useEffect(() => {
    if (refreshing || !isStaleSupplyDemo(vocab)) return;
    refreshing = true;
    runSupplyDemo(vocab!).then(r => r.ok ? persistSupplyVocab(r.vocab) : undefined).catch(() => undefined).finally(() => { refreshing = false; });
  }, [vocab]);
}

export function SupplyDemoNotice() {
  return <span className="sd-notice" data-testid="supply-demo-notice"><FlaskConical size={13} aria-hidden="true" />{SUPPLY_DEMO_NOTICE}</span>;
}

// Bouton « Charger la démo Maison Lucie » + progression cochée.
// `onApplied` : le Studio passe son propre `update` ; sinon on persiste ici.
export function SupplyDemoLauncher({ variant, vocab, onApplied, onReset }: {
  variant: "studio" | "cockpit";
  vocab?: ArgusVocab;
  onApplied?: (v: ArgusVocab) => void;
  onReset?: (v: ArgusVocab) => void;
}) {
  const [progress, setProgress] = useState<SupplyDemoProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const active = isSupplyDemo(vocab);

  async function start() {
    setRunning(true); setError(null); setSummary(null);
    const p = initialDemoProgress();
    setProgress({ ...p });
    const result = await runSupplyDemo(vocab ?? loadVocab(), (id, state, detail) => {
      p[id] = { state, detail };
      setProgress({ ...p });
    });
    setRunning(false);
    if (!result.ok) { setError(result.error); return; }
    clearGuide();
    if (onApplied) onApplied(result.vocab); else await persistSupplyVocab(result.vocab);
    setSummary(`${result.alerts} alerte(s) issue(s) des règles causales · ${result.mappings} mapping(s) validé(s).`);
  }

  async function reset() {
    if (typeof window !== "undefined" && !window.confirm("Retirer les sources, données et mappings de la démo Maison Lucie ?")) return;
    const next = resetSupplyDemo(vocab ?? loadVocab());
    clearGuide();
    setProgress(null); setSummary(null); setError(null);
    if (onReset) onReset(next); else await persistSupplyVocab(next);
  }

  return <div className={`sd-launcher sd-${variant}`} data-testid="supply-demo-launcher">
    <div className="sd-actions">
      <button type="button" className={variant === "studio" ? "sd-primary" : "sd-discreet"} onClick={start} disabled={running} data-testid="supply-demo-load">
        {running ? <Loader2 size={14} className="sd-spin" /> : <Sparkles size={14} />}
        {running ? "Chargement de la démo…" : active ? "Recharger la démo Maison Lucie" : "Charger la démo Maison Lucie"}
      </button>
      {active && !running && <button type="button" className="sd-reset" onClick={reset} data-testid="supply-demo-reset"><RotateCcw size={13} />Réinitialiser la démo</button>}
    </div>
    {(progress || active) && <SupplyDemoNotice />}
    {progress && <ol className="sd-steps" aria-label="Progression de la démo">
      {SUPPLY_DEMO_STEPS.map(step => {
        const st = progress[step.id];
        const Icon = st.state === "done" ? CheckCircle2 : st.state === "error" ? XCircle : st.state === "running" ? Loader2 : Circle;
        return <li key={step.id} className={`sd-step sd-${st.state}`} data-state={st.state}>
          <Icon size={15} className={st.state === "running" ? "sd-spin" : undefined} aria-hidden="true" />
          <span>{step.label}</span>{st.detail && st.state === "done" && <small>{st.detail}</small>}
        </li>;
      })}
    </ol>}
    {error && <div className="sd-error" role="alert">
      <AlertTriangle size={15} aria-hidden="true" />
      <div><b>Le SI de démonstration Maison Lucie n’est pas joignable ({MAISON_LUCIE_PORTAL}).</b><span>Aucune donnée n’a été chargée ni inventée. Réessayez plus tard.</span><small>{error}</small></div>
    </div>}
    {summary && <div className="sd-ok" role="status"><CheckCircle2 size={15} aria-hidden="true" /><span>Démo chargée : {summary}</span>
      {variant === "studio" && <Link to="/cockpit/resilience" search={{ section: "cockpit" }} className="sd-link">Voir le cockpit <ArrowRight size={13} /></Link>}
    </div>}
    <style>{SD_CSS}</style>
  </div>;
}

export function useGuide(): [GuideState, (s: GuideState) => void] {
  const [state, setState] = useState<GuideState>({ dismissed: false, done: [] });
  useEffect(() => {
    const sync = () => setState(loadGuide());
    sync();
    window.addEventListener("aura-supply-guide", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("aura-supply-guide", sync); window.removeEventListener("storage", sync); };
  }, []);
  return [state, (s: GuideState) => { saveGuide(s); setState(s); }];
}

// Bandeau du cockpit quand la démo est active : mention claire + scénario
// guidé optionnel (refermable) + réinitialisation.
export function SupplyDemoBanner({ vocab }: { vocab: ArgusVocab | undefined }) {
  const [guide, setGuide] = useGuide();
  const [showAll, setShowAll] = useState(false);
  if (!isSupplyDemo(vocab)) return null;
  const toggle = (id: (typeof GUIDED_STEPS)[number]["id"]) =>
    setGuide({ ...guide, done: guide.done.includes(id) ? guide.done.filter(x => x !== id) : [...guide.done, id] });
  const next = GUIDED_STEPS.find(s => !guide.done.includes(s.id));
  return <section className="sd-banner" aria-label="Démonstration Maison Lucie" data-testid="supply-demo-banner">
    <div className="sd-banner-head">
      <SupplyDemoNotice />
      <div className="sd-banner-actions">
        {guide.dismissed && <button type="button" className="sd-discreet" onClick={() => setGuide({ ...guide, dismissed: false })}>Scénario guidé</button>}
        <SupplyDemoResetButton vocab={vocab} />
      </div>
    </div>
    {!guide.dismissed && <div className="sd-guide" data-testid="supply-demo-guide">
      <div className="sd-guide-head">
        <b>Scénario guidé · {guide.done.length}/{GUIDED_STEPS.length}</b>
        {next && <span>{next.hint}</span>}
        <button type="button" className="sd-close" onClick={() => setGuide({ ...guide, dismissed: true })} aria-label="Fermer le scénario guidé"><X size={16} /></button>
      </div>
      <ol className={`sd-guide-steps${showAll ? "" : " compact"}`}>
        {GUIDED_STEPS.map((s, i) => {
          const done = guide.done.includes(s.id);
          if (!showAll && next && next.id !== s.id) return null;
          return <li key={s.id} className={next?.id === s.id ? "is-next" : undefined}><button type="button" className={done ? "done" : next?.id === s.id ? "next" : ""} aria-pressed={done} onClick={() => toggle(s.id)} title={s.hint}>
            {done ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="sd-num">{i + 1}</span>}<span>{s.label}</span>
          </button></li>;
        })}
      </ol>
      <button type="button" className="sd-more" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}>{showAll ? "Masquer les étapes" : `Voir les ${GUIDED_STEPS.length} étapes`}</button>
    </div>}
    <style>{SD_CSS}</style>
  </section>;
}

function SupplyDemoResetButton({ vocab }: { vocab: ArgusVocab | undefined }) {
  return <button type="button" className="sd-reset" data-testid="supply-demo-reset" onClick={async () => {
    if (!window.confirm("Retirer les sources, données et mappings de la démo Maison Lucie ?")) return;
    clearGuide();
    await persistSupplyVocab(resetSupplyDemo(vocab ?? loadVocab()));
  }}><RotateCcw size={13} />Réinitialiser la démo</button>;
}

const SD_CSS = `
.sd-launcher{display:grid;gap:10px;min-width:0}
.sd-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sd-primary,.sd-discreet,.sd-reset,.sd-link{display:inline-flex;align-items:center;gap:6px;min-height:36px;border-radius:9px;padding:7px 12px;font:700 13px var(--font-sans);cursor:pointer;text-decoration:none}
.sd-primary{border:0;background:var(--v4-accent,#7c3aed);color:#fff}
.sd-primary:disabled,.sd-discreet:disabled{opacity:.7;cursor:wait}
.sd-discreet{border:1px solid var(--v4-accent-border,#c9bffd);background:var(--v4-accent-bg,#f0ecff);color:var(--v4-accent2,#6d28d9)}
.sd-reset{border:1px solid var(--v4-border2,#d8d3f0);background:#fff;color:var(--v4-text2,#4c3d7a)}
.sd-link{padding:4px 8px;color:var(--v4-accent2,#6d28d9);min-height:32px}
.sd-notice{display:inline-flex;align-items:center;gap:6px;align-self:start;justify-self:start;max-width:100%;padding:4px 10px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font:750 12.5px var(--font-sans)}
.sd-steps{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.sd-step{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:13px;color:var(--v4-text3,#9585c4)}
.sd-step small{font-size:12.5px;color:var(--v4-text3,#9585c4)}
.sd-step.sd-done{color:var(--v4-text,#1a1433)}.sd-step.sd-done svg{color:#16a34a}
.sd-step.sd-running{color:var(--v4-accent2,#6d28d9);font-weight:700}
.sd-step.sd-error{color:#b91c1c;font-weight:700}
.sd-spin{animation:sd-spin 1s linear infinite}@keyframes sd-spin{to{transform:rotate(360deg)}}
.sd-error,.sd-ok{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;padding:10px 12px;border-radius:9px;font-size:13px;line-height:1.45}
.sd-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.sd-error>div{display:grid;gap:2px;min-width:0;flex:1}.sd-error small{color:#b45309;overflow-wrap:anywhere}
.sd-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;align-items:center}
.sd-banner{display:grid;gap:10px;margin:0 0 16px;padding:12px 14px;border:1px solid #fed7aa;border-radius:12px;background:linear-gradient(180deg,#fffaf3,#fff)}
.sd-banner-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.sd-banner-actions{display:flex;flex-wrap:wrap;gap:6px}
.sd-guide{display:grid;gap:8px;border-top:1px dashed #fed7aa;padding-top:10px}
.sd-guide-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
.sd-guide-head b{font-size:13.5px;color:var(--v4-text,#1a1433)}
.sd-guide-head span{flex:1 1 220px;font-size:13px;color:var(--v4-text2,#4c3d7a)}
.sd-close{margin-left:auto;display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--v4-border,#e8e5f8);border-radius:9px;background:#fff;color:var(--v4-text2,#4c3d7a);cursor:pointer}
.sd-guide-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.sd-guide-steps button{width:100%;height:100%;display:flex;align-items:center;gap:7px;text-align:left;min-height:40px;padding:6px 10px;border:1px solid var(--v4-border,#e8e5f8);border-radius:9px;background:#fff;color:var(--v4-text2,#4c3d7a);font:650 13px var(--font-sans);cursor:pointer}
.sd-guide-steps button.next{border-color:var(--v4-accent,#7c3aed);box-shadow:0 0 0 3px color-mix(in srgb,var(--v4-accent,#7c3aed) 12%,transparent);color:var(--v4-text,#1a1433)}
.sd-guide-steps button.done{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.sd-guide-steps button.done svg{color:#16a34a;flex:none}
.sd-more{display:none}
.sd-num{display:grid;place-items:center;flex:none;width:20px;height:20px;border-radius:50%;background:var(--v4-accent-bg,#f0ecff);color:var(--v4-accent2,#6d28d9);font-size:12px;font-weight:800}
@media(max-width:1100px){.sd-guide-steps{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:640px){.sd-guide-steps{grid-template-columns:1fr}.sd-guide-steps.compact li:not(.is-next){display:none}.sd-more{display:inline-flex;align-items:center;justify-self:start;min-height:40px;padding:0 4px;border:0;background:none;color:var(--v4-accent2,#6d28d9);font:700 13px var(--font-sans);cursor:pointer;text-decoration:underline}.sd-primary,.sd-discreet,.sd-reset{min-height:44px}.sd-close{width:44px;height:44px}}
`;
