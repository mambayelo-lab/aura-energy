// Interface de la mémoire Supply : cartes de choix du copilote, journal
// « décision → résultat », export comité et historique du modèle
// (annuler / rétablir / revenir à une version). Discret par défaut : chaque
// élément est replié ou n'apparaît que lorsqu'il sert.
import { useDismiss } from "@/lib/ui/use-dismiss";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { audit, useAccess } from "@/lib/security/use-access";
import { getMemory, type AuraMemory, type MemoryEntry } from "@/lib/memoire/memoire";
import type { ArgusVocab } from "../../lib/v4/argus-vocab-store";
import {
  applyModelSnapshot, decisionContext, decisionJournal, describeModelChange, journalSummary, modelSnapshot, ModelUndoStack,
  observedImpact, recordSupplyDecision, supplyDecisions, SUPPLY_MODEL_PROJECT, type ModelSnapshot, type SupplyDecision,
} from "../../lib/v4/supply-memory";
import { committeeBrief, committeePdf, committeePptx } from "../../lib/v4/supply-export";
import { evaluationsOf } from "./AlertChainDiagram";
import { CollabPanel } from "./CollabPanel";

// ── Accès à la mémoire ──────────────────────────────────────────────────────
export function useSupplyMemory(): { memory: AuraMemory | null; entries: MemoryEntry[]; decisions: SupplyDecision[] } {
  const [memory, setMemory] = useState<AuraMemory | null>(null);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    getMemory("supply").then(m => {
      if (!alive) return;
      setMemory(m);
      const load = () => { void m.all().then(x => { if (alive) setEntries([...x]); }); };
      load();
      off = m.onChange(load);
    }).catch(() => { /* mémoire indisponible : l'écran reste utilisable */ });
    return () => { alive = false; off?.(); };
  }, []);
  const decisions = useMemo(() => supplyDecisions(entries), [entries]);
  return { memory, entries, decisions };
}

const fmt = (n: number | undefined, unit = "") => n === undefined ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;

const CSS = `
.sm-cards{display:flex;flex-direction:column;gap:4px;padding:10px 14px;border-bottom:1px solid var(--v4-border,#e8e5f8);background:var(--v4-panel,#faf9ff);max-height:48vh;overflow:auto}
.sm-cards-head{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--v4-text3,#9585c4)}
.sm-cards-head button{margin-left:auto;border:0;background:none;color:var(--v4-text3,#9585c4);cursor:pointer;font:700 12px var(--font-sans)}
.sm-card{display:flex;align-items:baseline;gap:8px;text-align:left;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-surface,#fff);border-radius:8px;padding:5px 9px;cursor:pointer;font:inherit;color:var(--v4-text,#1a1433)}
.sm-card small{margin-left:auto;white-space:nowrap}
.sm-card:hover,.sm-card[aria-pressed=true]{border-color:var(--v4-accent,#7c3aed)}
.sm-card b{font-size:13px;font-weight:650}
.sm-card small{font-size:11.5px;color:var(--v4-text3,#9585c4)}
.sm-card small.sm-measured{color:var(--v4-green,#0d7a54);font-weight:700}
.sm-form{display:flex;flex-direction:column;gap:6px;border:1px solid var(--v4-accent-border,#c9bffd);border-radius:8px;padding:8px;background:var(--v4-surface,#fff)}
.sm-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--v4-text2,#4c3d7a)}
.sm-form input,.sm-form textarea{font:500 12.5px var(--font-sans);border:1px solid var(--v4-border2,#d8d3f0);border-radius:6px;padding:5px 7px;color:var(--v4-text,#1a1433);resize:vertical}
.sm-form-actions{display:flex;gap:6px;justify-content:flex-end}
.sm-btn{border:1px solid var(--v4-border2,#d8d3f0);background:var(--v4-surface,#fff);color:var(--v4-text2,#4c3d7a);border-radius:7px;padding:4px 10px;font:700 12.5px var(--font-sans);cursor:pointer}
.sm-btn.primary{background:var(--v4-accent,#7c3aed);border-color:var(--v4-accent,#7c3aed);color:#fff}
.sm-btn:disabled{opacity:.5;cursor:not-allowed}
.sm-note{font-size:12px;color:var(--v4-text3,#9585c4);margin:0}
.sm-journal{margin-top:18px;border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;background:var(--v4-surface,#fff)}
.sm-journal>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;padding:10px 14px;font:700 13.5px var(--font-sans);color:var(--v4-text2,#4c3d7a)}
.sm-journal>summary::-webkit-details-marker{display:none}
.sm-journal>summary span{font-weight:600;color:var(--v4-text3,#9585c4);font-size:12.5px}
.sm-journal table{width:100%;border-collapse:collapse;font-size:12.5px}
.sm-journal th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--v4-text3,#9585c4);padding:6px 14px;border-top:1px solid var(--v4-border,#e8e5f8)}
.sm-journal td{padding:7px 14px;border-top:1px solid var(--v4-border,#e8e5f8);color:var(--v4-text,#1a1433);vertical-align:top}
.sm-out-amélioration{color:var(--v4-green,#0d7a54);font-weight:800}
.sm-out-dégradation{color:var(--v4-red,#c0392b);font-weight:800}
.sm-out-stable,.sm-out-inconnu{color:var(--v4-text3,#9585c4);font-weight:700}
.sm-export{display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--v4-text3,#9585c4)}
.sm-history{display:inline-flex;gap:6px;align-items:center;position:relative}
.sm-x{position:absolute;top:4px;right:6px;border:0;background:none;font-size:16px;cursor:pointer;color:inherit}.sm-history-panel{position:absolute;right:0;top:calc(100% + 6px);z-index:30;width:380px;max-height:360px;overflow:auto;background:var(--v4-surface,#fff);border:1px solid var(--v4-border,#e8e5f8);border-radius:10px;box-shadow:0 12px 30px rgba(26,20,51,.14);padding:8px}
.sm-history-panel li{display:flex;gap:8px;align-items:flex-start;padding:6px;border-radius:6px;font-size:12.5px;color:var(--v4-text,#1a1433)}
.sm-history-panel li:hover{background:var(--v4-accent-bg,#f0ecff)}
.sm-history-panel li div{flex:1;min-width:0}
.sm-history-panel li small{display:block;color:var(--v4-text3,#9585c4)}
.sm-history-panel ul{list-style:none;margin:0;padding:0}
`;

// ── Journal « décision → résultat » ─────────────────────────────────────────
const NOTES_KEY = "aura.journal.annotations";
export function DecisionJournal({ vocab, decisions }: { vocab: ArgusVocab; decisions: SupplyDecision[] }) {
  const rows = useMemo(() => decisionJournal(vocab, decisions), [vocab, decisions]);
  const access = useAccess();
  const [open, setOpen] = useState<string | null>(null);
  // Annotations du journal : une note libre par décision (analystes et administrateurs).
  const [notes, setNotes] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? "{}"); } catch { return {}; } });
  const saveNote = (id: string, v: string) => { const n = { ...notes, [id]: v }; setNotes(n); try { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); } catch { /* stockage indisponible */ } };
  if (!rows.length) return null;
  const s = journalSummary(rows);
  return (
    <details className="sm-journal" data-testid="decision-journal" id="journal" open={typeof window !== "undefined" && window.location.hash === "#journal" ? true : undefined}>
      <style>{CSS}</style>
      <summary>{`Journal des décisions (${s.total})`}<span>{`${s.improved} en amélioration · ${s.worse} en dégradation${s.resolved ? ` · ${s.resolved} revenue(s) sous le seuil` : ""}`}</span></summary>
      <table>
        <thead><tr><th>Date</th><th>Alerte · entité</th><th>Option choisie</th><th title="Cadre Revilla et Sáenz : assistée, semi-autonome, autonome bornée. Aura propose ; une personne valide.">Mode</th><th>À la décision</th><th>Aujourd'hui</th><th>Évolution</th><th>Suivi</th><th>Annotation</th><th>Échanges</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <Fragment key={r.id}><tr>
              <td>{new Date(r.date).toLocaleDateString("fr-FR")}</td>
              <td>{r.alert}{r.entity ? <><br /><small>{r.entity}</small></> : null}</td>
              <td title={[r.reason && `Raison : ${r.reason}`, r.expected && `Attendu : ${r.expected}`].filter(Boolean).join("\n")}>{r.option}</td>
              <td title={r.validation}><small>{r.mode}</small><br /><small>{r.validation}</small></td>
              <td>{fmt(r.before, r.unit)}</td>
              <td>{fmt(r.now, r.unit)}</td>
              <td className={`sm-out-${r.outcome}`}>{r.delta !== undefined ? `${r.delta > 0 ? "+" : ""}${fmt(r.delta)} · ` : ""}<span>{r.outcome}</span></td>
              <td>{r.sessionId ? <><a href={`/cockpit/atelier?sessionId=${encodeURIComponent(r.sessionId)}`} data-testid="journal-suivi-link" style={{ fontWeight: 700, color: "var(--v4-accent,#7c3aed)" }}>Suivi dans Décider →</a><br /><MiniReportLink sessionId={r.sessionId} /></> : <small>—</small>}</td>
              <td><input aria-label={`Annotation de ${r.alert}`} disabled={!access.can("comment.write")} defaultValue={notes[r.id] ?? ""} placeholder="Ajouter une note" onBlur={e => { if ((notes[r.id] ?? "") !== e.target.value) { saveNote(r.id, e.target.value); audit("decision.annotation", r.alert); } }} style={{ width: 160, padding: "3px 6px", border: "1px solid var(--v4-border,#e8e5f8)", borderRadius: 6 }} /></td>
              <td><button type="button" data-testid="journal-collab" onClick={() => setOpen(open === r.id ? null : r.id)} style={{ border: "1px solid var(--v4-border,#e8e5f8)", borderRadius: 6, background: "none", cursor: "pointer", padding: "3px 8px" }}>{open === r.id ? "Fermer" : "Commentaires"}</button></td>
            </tr>
            {open === r.id && <tr><td colSpan={10}><CollabPanel targetType="decision" targetId={r.id} label={r.alert} /></td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Mini-rapport PDF enregistré pour la décision (mémoire d'Aura : Supabase ou ce navigateur).
function MiniReportLink({ sessionId }: { sessionId: string }) {
  const [reports, setReports] = useState<{ id: string; createdAt: string; bytes: Uint8Array }[]>([]);
  useEffect(() => { let alive = true; void import("../../lib/v4/mini-report").then(m => m.miniReportsOf(sessionId)).then(r => { if (alive) setReports(r); }).catch(() => undefined); return () => { alive = false; }; }, [sessionId]);
  if (!reports.length) return null;
  const last = reports[0];
  return <button type="button" className="sm-btn" data-testid="journal-mini-report" title={`Enregistré le ${new Date(last.createdAt).toLocaleString("fr-FR")}`} onClick={() => download(new Blob([last.bytes as BlobPart], { type: "application/pdf" }), `mini-rapport-${sessionId}.pdf`)}>Mini-rapport PDF</button>;
}

// ── Export comité ───────────────────────────────────────────────────────────
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function CommitteeExport({ vocab, alertId, decisions }: { vocab: ArgusVocab | undefined; alertId: string; decisions: SupplyDecision[] }) {
  const [busy, setBusy] = useState(false);
  if (!vocab) return null;
  const evaluation = evaluationsOf(vocab).find(e => e.rule.id === alertId);
  if (!evaluation?.triggered) return null;
  const last = decisionJournal(vocab, decisions.filter(d => d.alertId === alertId))[0];
  const name = `comite-${evaluation.rule.label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const run = async (kind: "pdf" | "pptx") => {
    setBusy(true);
    try {
      const brief = committeeBrief(vocab, evaluation, last);
      audit("export", `${name}.${kind}`);
      if (kind === "pdf") { const bytes = await committeePdf(brief); download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${name}.pdf`); }
      else download(await committeePptx(brief), `${name}.pptx`);
    } finally { setBusy(false); }
  };
  return (
    <span className="sm-export">
      <style>{CSS}</style>
      Export comité :
      <button type="button" className="sm-btn" disabled={busy} onClick={() => void run("pdf")}>PDF</button>
      <button type="button" className="sm-btn" disabled={busy} onClick={() => void run("pptx")}>PowerPoint</button>
    </span>
  );
}

// ── Historique du modèle (Studio) ───────────────────────────────────────────
export function ModelHistoryBar({ vocab, ready, onApply }: { vocab: ArgusVocab; ready: boolean; onApply: (v: ArgusVocab) => void }) {
  const [memory, setMemory] = useState<AuraMemory | null>(null);
  const [versions, setVersions] = useState<MemoryEntry<ModelSnapshot>[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);
  useDismiss(open, () => setOpen(false), boxRef);
  const [, force] = useState(0);
  const stack = useRef<ModelUndoStack | null>(null);
  const saved = useRef<ModelSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const vocabRef = useRef(vocab);
  // Un état issu d'annuler / rétablir ne doit pas vider la pile « rétablir ».
  const applying = useRef(false);
  vocabRef.current = vocab;

  useEffect(() => {
    let alive = true;
    let off: (() => void) | undefined;
    getMemory("supply").then(m => {
      if (!alive) return;
      setMemory(m);
      const load = () => { void m.versions<ModelSnapshot>(SUPPLY_MODEL_PROJECT).then(v => { if (alive) setVersions([...v].reverse()); }); };
      load();
      off = m.onChange(load);
    }).catch(() => undefined);
    return () => { alive = false; off?.(); };
  }, []);

  // Chaque modification du modèle entre dans la pile annuler/rétablir ; une
  // version est enregistrée dans la mémoire après une courte pause d'édition.
  useEffect(() => {
    if (!ready || !memory) return;
    const snap = modelSnapshot(vocab);
    if (!stack.current) {
      stack.current = new ModelUndoStack(snap);
      void memory.versions<ModelSnapshot>(SUPPLY_MODEL_PROJECT).then(vs => {
        const last = vs[vs.length - 1];
        saved.current = last?.payload ?? snap;
        if (!last) void memory.saveVersion(SUPPLY_MODEL_PROJECT, "Version initiale", snap);
      });
      force(x => x + 1);
      return;
    }
    if (applying.current) { applying.current = false; stack.current.current = snap; }
    else if (stack.current.push(snap)) force(x => x + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = modelSnapshot(vocabRef.current);
      const base = saved.current;
      if (!base || JSON.stringify(base) === JSON.stringify(current)) return;
      saved.current = current;
      void memory.saveVersion(SUPPLY_MODEL_PROJECT, describeModelChange(base, current), current);
    }, 900);
  }, [vocab, ready, memory]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const undo = () => { const s = stack.current?.undo(); if (s) { applying.current = true; onApply(applyModelSnapshot(vocab, s)); force(x => x + 1); } };
  const redo = () => { const s = stack.current?.redo(); if (s) { applying.current = true; onApply(applyModelSnapshot(vocab, s)); force(x => x + 1); } };
  const restore = async (id: string) => {
    if (!memory) return;
    const v = await memory.rollback<ModelSnapshot>(SUPPLY_MODEL_PROJECT, id);
    if (v?.payload) { saved.current = v.payload; onApply(applyModelSnapshot(vocab, v.payload)); }
    setOpen(false);
  };
  // Ctrl+Z / Ctrl+Y (ou Cmd) hors des champs de saisie.
  const undoRef = useRef(undo); undoRef.current = undo;
  const redoRef = useRef(redo); redoRef.current = redo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]"))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undoRef.current(); }
      else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redoRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!ready) return null;
  return (
    <span ref={boxRef} className="sm-history" data-testid="model-history">
      <style>{CSS}</style>
      <button type="button" className="sm-btn" onClick={undo} disabled={!stack.current?.past.length} aria-label="Annuler la dernière modification du modèle" title="Annuler">↶ Annuler</button>
      <button type="button" className="sm-btn" onClick={redo} disabled={!stack.current?.future.length} aria-label="Rétablir la modification annulée" title="Rétablir">↷ Rétablir</button>
      <button type="button" className="sm-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} disabled={!versions.length}>Versions ({versions.length})</button>
      {open && (
        <div className="sm-history-panel" role="dialog" aria-label="Versions du modèle">
          <button type="button" className="sm-x" aria-label="Fermer" onClick={() => setOpen(false)}>×</button>
          <p className="sm-note" style={{ padding: "2px 6px 6px" }}>Indicateurs, seuils, règles, mappings et relations. Revenir à une version en crée une nouvelle : rien n'est perdu.</p>
          <ul>
            {versions.map((v, i) => (
              <li key={v.id}>
                <div>{v.label}<small>{new Date(v.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}{i === 0 ? " · version actuelle" : ""}</small></div>
                {i > 0 && <button type="button" className="sm-btn" onClick={() => void restore(v.id)}>Revenir</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
