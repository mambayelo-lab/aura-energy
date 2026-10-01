// Mode « Décider vite » : quelques phrases, Aura déduit tout le modèle (avec
// la source de chaque déduction), ne pose que les questions qui changent le
// résultat (0 à 3), accepte une correction libre à tout moment, puis montre le
// résultat et « Ce qui ferait changer la décision ». Même modèle que le mode
// Détail : toute modification se voit dans les deux.
import { CopyButtons } from "../CopyButtons";
import { useEffect, useMemo, useState } from "react";
import { STRATEGIC_EXAMPLES, STRATEGIC_GOALS } from "../../../lib/v4/strategic-examples";
import { CADRAGE_FALLBACK, PESTEL_LABELS, type PestelKey } from "../../../lib/v4/decision-dialogue";
import type { AtelierSession } from "../../../lib/v4/atelier-store";
import { MiniReportButton, SolidityNote } from "./SolidityNote";
import { COMPLETENESS_MIN, gapText, impactCompleteness, impactsToComplete, rankOptions, setImpact, suggestedOptionIds, validateOption } from "../../../lib/v4/decision-express";
import {
  applyCorrection, applyDeduction, completenessChecklist, completenessQuestions, deduceFromDescription, sanitizeProposal, type Deduction,
} from "../../../lib/v4/decision-dialogue";
import { mainLever } from "../../../lib/v4/decision-dialogue";
import { getLeafCriteria } from "../../../lib/v4/atelier-compute";
import { proposeDecisionModel } from "../../../lib/v4/decision-dialogue.functions";
import { InlineValueForm } from "../InlineValueForm";
import { currentLang } from "../../../lib/i18n-dom";
import { ChangeCard } from "./ChangeCard";
import { Paperclip } from "lucide-react";
import { DOC_FORMATS_LABEL } from "../DocumentDrop";
import { fallbackCitations, type Citation, type DialogueDoc } from "../../../lib/v4/doc-citations";
import { DOC_ACCEPT } from "../../../lib/v4/doc-formats";
import { DocStatusList } from "../DocumentDrop";
import type { DocResult } from "../../../lib/v4/doc-extract";

const INDIGO = "#4743E6", NIGHT = "#151D52";
const LEVEL: Record<string, string> = { "++": "Élevé ↑", "+": "Moyen ↑", "+L": "Faible ↑", "0": "—", "-L": "Faible ↓", "-": "Moyen ↓", "--": "Élevé ↓", U: "?" };
const IMP: Record<string, string> = { Essentiel: "Élevée", Important: "Moyenne", Secondaire: "Faible", Faible: "Nulle" };

const CSS = `
.dd-count{font-size:12px;color:#6b6f8a;margin-left:6px}.dd-strat .dd-strat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:6px}.dd-strat ul{margin:4px 0 0;padding-left:16px;font-size:13px}.dd-strat small{color:#6b6f8a}.dd-q{border:0;background:none;padding:0;text-align:left;color:#4b3fa8;cursor:pointer;font:inherit;font-size:13px}
.dd-examples{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.dd-examples button{border:1px solid #e3e0f3;background:#fff;border-radius:999px;padding:5px 10px;font:inherit;font-size:13px;cursor:pointer;color:#2a1d73}.dd-examples small{color:#6b6f8a;font-size:12px}
[data-testid="decision-dialogue"] small, .dd small{font-size:12px}
.dd{font-family:var(--font-body,"Lexend",system-ui);color:${NIGHT};display:flex;flex-direction:column;gap:12px;max-width:960px;margin:0 auto}
.dd-msg{max-width:92%;border-radius:14px;padding:11px 14px;font-size:13px;line-height:1.5}
.dd-aura{background:#fff;border:1px solid #e4e3fb;align-self:flex-start}
.dd-user{background:${INDIGO};color:#fff;align-self:flex-end;white-space:pre-wrap}
.dd-card{background:#fff;border:1px solid #e4e3fb;border-radius:14px;padding:14px 16px}
.dd-card h3{font:700 13.5px var(--font-display,"Sora",system-ui);margin:0 0 8px}
.dd-ded{display:grid;grid-template-columns:170px minmax(0,1fr);gap:4px 12px;font-size:13.5px}
.dd-ded dt{font-weight:700;color:#4c3d7a}
.dd-ded dd{margin:0}
.dd-ded small{display:block;color:#8a8db0;font-size:12px}
.dd-hyp{font-size:12px;font-weight:800;color:#a85d0f;background:#fff8ed;border-radius:999px;padding:1px 7px;margin-left:6px}
.dd-mx{border-collapse:collapse;font-size:13px;width:100%}
.dd-mx th,.dd-mx td{padding:5px 8px;border-bottom:1px solid #f0effb;text-align:center}
.dd-mx th:first-child,.dd-mx td:first-child{text-align:left}
.dd-q{border:1.5px solid ${INDIGO};border-radius:14px;padding:12px 14px;background:#f7f7ff}
.dd-q p{margin:0 0 4px;font-weight:700}
.dd-q small{color:#6b6f93}
.dd-choices{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.dd-choices button,.dd-ghost{border:1px solid #d8d6f5;background:#fff;color:${NIGHT};border-radius:10px;padding:7px 13px;font:600 13.5px var(--font-body,system-ui);cursor:pointer}
.dd-choices button:hover{border-color:${INDIGO}}
.dd-primary{border:0;background:${INDIGO};color:#fff;border-radius:10px;padding:10px 18px;font:700 13px var(--font-body,system-ui);cursor:pointer}
.dd-primary:disabled{opacity:.5;cursor:not-allowed}
.dd-input{display:flex;gap:8px;align-items:flex-end}
.dd[data-drag=true]{outline:2px dashed #7c6cf0;outline-offset:4px}
.dd-clip{display:grid;place-items:center;width:36px;height:36px;border:1px solid #d8d6f5;border-radius:10px;cursor:pointer;color:#4938ec;flex:none}
.dd-clip:hover{background:#f1efff}
.dd-docs{display:flex;flex-wrap:wrap;gap:6px;font-size:12.5px;margin:6px 0}
.dd-doc{background:#f1efff;color:#3b3f68;border-radius:8px;padding:3px 8px}
.dd-doc button{border:0;background:none;cursor:pointer;color:#6b6f93}
.dd-docs [data-testid=doc-status]{flex-basis:100%}
.dd-input textarea,.dd-input input{flex:1;font:500 13px var(--font-body,system-ui);border:1px solid #d8d6f5;border-radius:10px;padding:9px 11px;resize:vertical;color:${NIGHT}}
.dd-win{display:flex;align-items:center;gap:14px;border:2px solid ${INDIGO};border-radius:14px;padding:12px 16px;background:linear-gradient(90deg,#f1f0fe,#fff)}
.dd-win b{font:800 16.5px var(--font-display,"Sora",system-ui)}
.dd-missing{list-style:none;padding:0;margin:8px 0;display:grid;gap:5px}.dd-missing li{display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-size:13px}.dd-missing li span{flex:1 1 260px}.dd-missing button{padding:3px 8px;border-radius:6px;border:1px solid #d9d6f5;background:#fff;cursor:pointer;font-weight:700}.dd-sugg{font-size:12px;color:#8a5a00;background:#fff4e0;border-radius:6px;padding:1px 6px;margin-left:4px}.dd-sugg button{font-size:12px;margin-left:4px;border:1px solid #d9a441;background:#fff;border-radius:5px;cursor:pointer}
.dd-data{font-size:12px;font-weight:700;color:#0d7a54;background:#e8f7ef;border-radius:5px;padding:0 5px}
.dd-more{margin-top:3px;font-size:12.5px;color:#3b3f68}.dd-more summary{cursor:pointer;color:#4743E6;font-weight:600;font-size:12.5px}.dd-more ul{margin:4px 0 4px 16px;padding:0}.dd-tree{margin:4px 0}
.dd-check{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:#4c3d7a}
.dd-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
`;

export function DecisionDialogue({ session, onUpdate, onDetail, onFollow, onReport }: {
  session: AtelierSession; onUpdate: (p: Partial<AtelierSession>) => void;
  onDetail: () => void; onFollow: (scenarioId: string) => void; onReport: () => void;
}) {
  const thread = session.dialogue?.messages ?? [];
  const deductions = session.dialogue?.deductions;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [docs, setDocs] = useState<DialogueDoc[]>([]);
  const [docBusy, setDocBusy] = useState(false);
  const [docResults, setDocResults] = useState<DocResult[]>([]);
  const [docProgress, setDocProgress] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const citations: Citation[] = (session.dialogue as { citations?: Citation[] } | undefined)?.citations ?? [];
  const hasModel = session.scenarios.length >= 2 && session.criteria.length >= 1;
  const say = (msgs: { role: "aura" | "user"; text: string }[], extra: Record<string, unknown> = {}) =>
    ({ dialogue: { ...(session.dialogue ?? { messages: [] }), ...extra, messages: [...thread, ...msgs] } } as Partial<AtelierSession>);

  const ranking = useMemo(() => hasModel ? rankOptions(session) : [], [session, hasModel]);
  const questions = useMemo(() => hasModel ? completenessQuestions(session, rankOptions).filter(q => !asked.includes(q.id)) : [], [session, hasModel, asked]);

  // Exemple choisi à l'accueil : la question arrive pré-remplie.
  useEffect(() => { const q = session.contextRaw?.trim(); if (!hasModel && thread.length === 0 && q && STRATEGIC_EXAMPLES.some(e => e.question === q)) setText(q); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);
  // 1. Première description : Aura déduit tout le modèle d'un coup.
  const analyse = async () => {
    const description = text.trim();
    if (!description) return;
    setBusy(true);
    try {
      const alertKpi = session.alertId ? session.criteria[0]?.label.replace(/^Réduire : /, "") : undefined;
      const knownOptions = session.alertId ? mainLever(session)?.options.map(o => o.label) : undefined;
      const d = deduceFromDescription(description, { alertKpi, knownOptions });
      let llmCitations: Citation[] | undefined, llmContraintes: string[] | undefined;
      // Le LLM, s'il répond, affine options, critères et niveaux (garde-fous appliqués).
      try {
        const llm = await proposeDecisionModel({ data: { question: description, alertKpi, knownOptions, lang: currentLang(), documents: docs } });
        if (llm.citations?.length) llmCitations = llm.citations;
        if (llm.contraintes?.length) llmContraintes = llm.contraintes;
        const clean = sanitizeProposal(llm, description);
        if (clean && llm.source === "llm") {
          d.proposal = { ...clean, enjeu: clean.enjeu ?? d.proposal.enjeu, risques: clean.risques?.length ? clean.risques : d.proposal.risques };
          d.deductions = d.deductions.map(x => x.field === "enjeu" && clean.enjeu ? { ...x, value: clean.enjeu, source: "reformulation d'Aura (modèle de langage)" } : x.field === "risques" && clean.risques?.length ? { ...x, value: clean.risques.join(" · "), source: "risques repérés par Aura (modèle de langage)" } : x);
        }
      } catch { /* générateur de secours */ }
      const patch = applyDeduction(session, d, description);
      const cites = docs.length ? (llmCitations ?? fallbackCitations(description, docs)) : [];
      if (llmContraintes?.length) patch.contraintes = [...new Set([...(patch.contraintes ?? session.contraintes ?? []), ...llmContraintes.map(c => `${c} (d'après vos documents, à confirmer)`)])];
      if (docs.length) patch.contextRaw = `${patch.contextRaw ?? description}\n\nDocuments : ${docs.map(x => x.name).join(", ")}`;
      onUpdate({ ...patch, ...say([{ role: "user", text: description + (docs.length ? ` (documents : ${docs.map(x => x.name).join(", ")})` : "") }, { role: "aura", text: `Voici ce que j'en déduis${cites.length ? `, avec ${cites.length} extrait(s) de vos documents` : ""}. Corrigez d'une phrase si besoin.` }], { deductions: d.deductions, citations: cites }) });
      setText(""); setDocs([]);
    } finally { setBusy(false); }
  };
  // Documents joints (trombone ou glisser-déposer dans le fil) : plusieurs fichiers ou une archive .zip, mêmes formats que le mode Détail.
  const attach = async (files: FileList | File[] | null) => {
    if (!files || !files.length) return;
    setDocBusy(true);
    let added: DialogueDoc[] = [];
    try {
      const { extractFiles } = await import("../../../lib/v4/doc-extract");
      const rs = await extractFiles(Array.from(files), setDocProgress);
      setDocResults(prev => [...prev, ...rs]);
      added = rs.filter(r => r.status !== "non lisible" && r.text.trim()).map(r => ({ name: r.name, text: r.text.trim() }));
    } finally { setDocBusy(false); setDocProgress(null); }
    if (!added.length) return;
    if (!hasModel) { setDocs(d => [...d, ...added]); return; }
    // Modèle déjà posé (par exemple depuis une alerte) : les extraits utiles sont cités tout de suite.
    const q = [session.title, session.contextRaw, ...session.criteria.map(c => c.label), ...(lever?.options.map(o => o.label) ?? [])].filter(Boolean).join(" ");
    const cites = [...citations, ...fallbackCitations(q, added)].slice(0, 5);
    const n = cites.length - citations.length;
    onUpdate({ contextRaw: `${session.contextRaw ?? ""}\n\nDocuments : ${added.map(x => x.name).join(", ")}`.trim(), ...say([{ role: "user", text: `Document joint : ${added.map(x => x.name).join(", ")}` }, { role: "aura", text: n ? `J'ai repris ${n} extrait(s), cités ci-dessous. Corrigez d'une phrase si l'un d'eux change le modèle.` : "Je n'ai trouvé aucun extrait qui touche cette décision : rien n'est repris." }], { citations: cites }) });
  };
  // 4. Correction libre.
  const correct = () => {
    const t = text.trim();
    if (!t) return;
    const r = applyCorrection(session, t);
    onUpdate({ ...(r?.patch ?? {}), ...say([{ role: "user", text: t }, { role: "aura", text: r ? `Compris : ${r.understood} Le résultat est recalculé.` : "Je n'ai pas compris cette correction. Exemples : « le coût compte plus que la rapidité », « ajoute l'option location », « la location améliore beaucoup la rapidité », « retire l'option achat »." }]) });
    setText("");
  };
  const answer = (qid: string, qtext: string, label: string, patch: Partial<AtelierSession>) => {
    setAsked(a => [...a, qid]);
    onUpdate({ ...patch, ...say([{ role: "aura", text: qtext }, { role: "user", text: label }]) });
  };

  const winner = ranking[0];
  const shownDeductions: Deduction[] = deductions ?? (hasModel ? [
    { field: "enjeu", label: "Enjeu", value: `${session.alertLabel ? `${session.alertLabel.replace(/^Depuis l'alerte /, "Alerte ")} : ` : ""}choisir entre ${session.scenarios.map(x => `« ${x.label} »`).join(", ")}${session.elicitation?.objectif ? ` pour ${session.elicitation.objectif.charAt(0).toLowerCase()}${session.elicitation.objectif.slice(1)}` : ""}.`, source: session.alertId ? "l'alerte et sa règle" : "le mode Détail", hypothesis: true },
    { field: "options", label: "Options", value: session.scenarios.map(s => s.label).join(" · "), source: session.alertId ? "l'alerte et sa règle" : "le mode Détail", hypothesis: false },
    ...session.criteria.map(c => ({ field: "critere" as const, label: c.label, value: c.importance, source: session.alertId ? "l'alerte" : "le mode Détail", hypothesis: false })),
    { field: "attitude", label: "Attitude face au risque", value: session.attitude === "Pessimiste" ? "Prudente" : "Audacieuse", source: "par défaut", hypothesis: false },
  ] : []);
  const lever = mainLever(session);
  const leaves = getLeafCriteria(session.criteria);
  const completeness = impactCompleteness(session);
  const suggested = suggestedOptionIds(session);

  return (
    <div className="dd" data-testid="decision-dialogue" data-drag={drag ? "true" : undefined}
      onDragOver={e => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); setDrag(false); void attach(e.dataTransfer.files); }}>
      <style>{CSS}</style>
      {!hasModel && thread.length === 0 && (
        <div className="dd-msg dd-aura">Décrivez votre décision en quelques phrases : les options, ce qui compte, les limites éventuelles. Aura en déduit le modèle ; vous corrigez d'une phrase si besoin.</div>
      )}
      {!hasModel && thread.length === 0 && (
        <div className="dd-examples" aria-label="Exemples stratégiques Supply Chain">
          {STRATEGIC_EXAMPLES.map(ex => <button key={ex.titre} type="button" data-testid="dialogue-example" title={ex.question} onClick={() => setText(ex.question)}><small>{ex.secteur}</small> {ex.titre}</button>)}
        </div>
      )}
      {hasModel && thread.length === 0 && session.alertId && (
        <div className="dd-msg dd-aura">Modèle préparé depuis l'alerte.</div>
      )}
      {/(r[ée]seau|stocks? de s[ée]curit[ée]|entrep[ôo]t|implantation|sourcing|capacit[ée])/i.test(`${session.title ?? ""} ${session.contextRaw ?? ""}`) && <p className="dd-note" data-testid="strategic-optim-note" style={{ fontSize: 12.5, color: "var(--v4-text3, #6b6f93)", margin: "4px 0" }}>Les options peuvent venir d'un outil d'optimisation ou d'un expert ; Aura les évalue (Aura n'exécute aucune optimisation ni prévision).</p>}
      {thread.map((m, i) => <div key={i} className={`dd-msg ${m.role === "user" ? "dd-user" : "dd-aura"}`}>{m.text}{m.role !== "user" && <CopyButtons text={m.text} />}</div>)}

      {hasModel && (
        <div className="dd-card" data-testid="deductions">
          <h3>Ce qu'Aura a compris</h3>
          <dl className="dd-ded">
            {shownDeductions.filter(d => !["impacts", "critere", "risques", "contraintes"].includes(d.field)).map((d, i) => (
              <div key={i} style={{ display: "contents" }}><dt>{d.label}</dt><dd>{d.value}{d.hypothesis && <span className="dd-hyp">à confirmer</span>}<details className="dd-more"><summary>d'où ça vient</summary>{d.source}</details></dd></div>
            ))}
            <dt>Objectifs et indicateurs</dt>
            <dd>{session.criteria.map(m => `${m.label} (${getLeafCriteria([m]).length})`).join(" · ")}
              <details className="dd-more" data-testid="rich-indicateurs"><summary>sens et justification</summary>
                {session.criteria.map(m => (
                  <div key={m.id} className="dd-tree">
                    <b>{m.label}</b>{m.description && <span> — {m.description}</span>}
                    {(m.children ?? []).map(mop => (
                      <div key={mop.id} style={{ marginLeft: 12 }}><i>{mop.label}</i>
                        <ul>{getLeafCriteria([mop]).map(c => <li key={c.id}><b>{c.label}</b> ({IMP[c.importance]}){c.description && ` : ${c.description}`}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                ))}
              </details></dd>
            <dt>Leviers et options</dt>
            <dd>{session.leviersDef.length} leviers · <span data-testid="option-counts">{session.leviersDef.map(l => l.options.length).join(" / ")} options</span>
              <details className="dd-more" data-testid="rich-leviers"><summary>ce que fait chaque option</summary>
                {session.leviersDef.map(l => (
                  <div key={l.id} className="dd-tree"><b>{l.id === lever?.id ? "Vos options" : l.label}</b> <span className="dd-count">{l.options.length} options</span>
                    <ul>{l.options.map(o => <li key={o.id}><b>{o.label}</b>{o.justification && ` : ${o.justification}`}</li>)}</ul>
                  </div>
                ))}
              </details></dd>
            <dt>Contraintes et risques</dt>
            <dd>{session.contraintes?.length ?? 0} contrainte(s) · {session.elicitation?.risques?.length ?? 0} risque(s) <span className="dd-hyp">à confirmer</span>
              <details className="dd-more" data-testid="rich-risques"><summary>voir</summary>
                <ul>{(session.contraintes ?? []).map(c => <li key={c}>Contrainte : {c}</li>)}{(session.elicitation?.risques ?? []).map(r => <li key={r}>Risque : {r}</li>)}</ul>
              </details></dd>
            {!!Object.keys(session.elicitation?.pestelAnswers ?? {}).length && <><dt>Contexte externe</dt>
              <dd><details className="dd-more" data-testid="pestel"><summary>PESTEL ({Object.keys(session.elicitation?.pestelAnswers ?? {}).length} facteurs, repris dans les risques)</summary>
                <ul>{Object.entries(session.elicitation?.pestelAnswers ?? {}).map(([k, v]) => <li key={k}><b>{PESTEL_LABELS[k as PestelKey] ?? k}</b> : {v}</li>)}</ul>
              </details></dd></>}
            {session.alertId && session.contextRaw && <><dt>Faits</dt><dd><details data-testid="alert-facts"><summary>Contexte de l'alerte</summary><div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{session.contextRaw}</div></details></dd></>}
          </dl>
          <details className="dd-more dd-strat" data-testid="strategic-suggestions"><summary>Suggestions stratégiques : objectifs, enjeux, questions de cadrage, exemples</summary>
            <div className="dd-strat-grid">
              <div><b>Objectifs proposés</b><ul>{STRATEGIC_GOALS.map(g => <li key={g}>{g}</li>)}</ul></div>
              <div><b>Enjeux à vérifier</b><ul>{(session.elicitation?.risques ?? []).slice(0, 4).map(r => <li key={r}>{r}</li>)}</ul></div>
              <div><b>Questions de cadrage</b><ul>{(session.elicitation?.questionsCadrage ?? CADRAGE_FALLBACK).map(q => <li key={q}><button type="button" className="dd-q" onClick={() => setText(q)}>{q}</button></li>)}</ul></div>
              <div><b>Problématiques par secteur</b><ul>{STRATEGIC_EXAMPLES.slice(0, 8).map(e => <li key={e.titre}><small>{e.secteur}</small> {e.titre}</li>)}</ul></div>
            </div>
          </details>
          {lever && (
            <table className="dd-mx" aria-label="Effets des options">
              <thead><tr><th>Effets</th>{leaves.map(c => <th key={c.id} title={`${c.description ?? ""} Importance : ${IMP[c.importance]}`}>{c.importance === "Essentiel" ? "★ " : ""}{c.label}</th>)}</tr></thead>
              <tbody>{lever.options.map(o => (
                <tr key={o.id}><td><b title={o.justification}>{o.label}</b>{suggested.has(o.id) && <span className="dd-sugg" data-testid="suggested-option"> suggérée par Aura, hors classement <button type="button" onClick={() => onUpdate(validateOption(session, o.id))}>Valider</button></span>}</td>{leaves.map(c => <td key={c.id} title={[o.impactOrigins?.[c.id] && o.impactReasons?.[c.id], o.impactOrigins?.[c.id] === "donnees" ? "Donnée mesurée" : o.impactOrigins?.[c.id] ? "Hypothèse d'Aura, à confirmer" : undefined].filter(Boolean).join(" ")} style={{ color: (o.impacts[c.id] ?? "0").startsWith("-") ? "#c0392b" : (o.impacts[c.id] ?? "0") === "0" ? "#8a8db0" : "#0d7a54", fontWeight: 700, textDecoration: o.impactOrigins?.[c.id] ? "underline dotted" : undefined }}>{LEVEL[o.impacts[c.id] ?? "0"]}</td>)}</tr>
              ))}</tbody>
            </table>
          )}
          {lever && <details className="dd-more" data-testid="rich-impacts"><summary>pourquoi ces effets</summary>
            <ul>{lever.options.flatMap(o => leaves.filter(c => o.impactOrigins?.[c.id] && o.impactReasons?.[c.id]).map(c => <li key={o.id + c.id}><b>{c.label}</b> : {o.impactReasons![c.id]} {o.impactOrigins?.[c.id] === "donnees" ? <span className="dd-data">donnée mesurée</span> : <span className="dd-hyp">à confirmer</span>}</li>))}</ul>
          </details>}
          {lever?.options.some(o => Object.keys(o.impactOrigins ?? {}).length) && <small className="dd-hyp-note" title="Effets soulignés en pointillé : hypothèses d'Aura, à confirmer."><span className="dd-hyp">à confirmer</span> pointillés</small>}
          {!session.elicitation?.horizon && <InlineValueForm testId="form-horizon" submitLabel="Fixer l'échéance" fields={[{ key: "date", label: "Échéance", kind: "date", default: new Date(Date.now() + 90 * 864e5).toLocaleDateString("fr-FR") }]}
            onSubmit={v => onUpdate({ elicitation: { ...(session.elicitation ?? {}), horizon: new Date(String(v.date)).toLocaleDateString("fr-FR") } as AtelierSession["elicitation"] })} />}
          <div className="dd-check" style={{ marginTop: 8 }} aria-label="Complétude">
            {(() => { const cl = completenessChecklist(session); const todo = cl.filter(c => !c.ok); return <>{todo.map(c => <span key={c.label}>○ {c.label} : {c.note}</span>)}<details><summary>{todo.length ? "Détail" : "✓ Modèle complet"}</summary>{cl.map(c => <span key={c.label}>{c.ok ? "✓" : "○"} {c.label} : {c.note} </span>)}</details></>; })()}
          </div>
        </div>
      )}

      {questions.slice(0, 3).map(q => (
        <div key={q.id} className="dd-q" data-testid="completeness-question">
          <p>{q.text}</p><small>{q.why}</small>
          {q.choices.length > 0 && <div className="dd-choices">{q.choices.map(c => <button key={c.label} type="button" title={c.hint} onClick={() => answer(q.id, q.text, c.label, c.patch)}>{c.label}</button>)}</div>}
          {q.choices.some(c => c.hint) && <details className="dd-more" data-testid="choice-hints"><summary>ce que change chaque choix</summary><ul>{q.choices.map(c => <li key={c.label}><b>{c.label}</b> : {c.hint}</li>)}</ul></details>}
          {q.choices.length > 0 && q.suggestion && <InlineValueForm testId="form-suggestion" submitLabel="Répondre" fields={[{ key: "r", label: "Votre réponse", kind: "text", default: q.suggestion }]}
            onSubmit={v => {
              const r = String(v.r);
              const choice = q.choices.find(c => c.label.toLowerCase() === r.toLowerCase());
              if (choice) return answer(q.id, q.text, choice.label, choice.patch);
              const cor = applyCorrection(session, r);
              answer(q.id, q.text, r, cor?.patch ?? {});
            }} />}
          {q.id === "objectif" && <InlineValueForm testId="form-objectif" fields={[{ key: "objectif", label: "Objectif", kind: "text", default: session.title && !session.title.includes("?") ? session.title : "", placeholder: "Ex. éviter une rupture chez nos clients" }]}
            onSubmit={v => answer(q.id, q.text, String(v.objectif), { elicitation: { ...(session.elicitation ?? {}), objectif: String(v.objectif) } as AtelierSession["elicitation"] })} />}
          {q.id === "options" && <InlineValueForm testId="form-options" fields={[{ key: "a", label: "Option 1", kind: "text", default: session.scenarios[0]?.label ?? "" }, { key: "b", label: "Option 2", kind: "text", default: session.scenarios[1]?.label ?? "" }]}
            validate={v => String(v.a).toLowerCase() === String(v.b).toLowerCase() ? "Deux options différentes attendues" : null}
            onSubmit={v => { const q2 = `${v.a} ou ${v.b} ?`; const d = deduceFromDescription(`${q2} ${session.contextRaw ?? ""}`); answer(q.id, q.text, `${v.a} · ${v.b}`, applyDeduction(session, d, `${q2} ${session.contextRaw ?? ""}`)); }} />}
        </div>
      ))}

      {hasModel && !completeness.reliable && questions.filter(q => !q.choices.length).length === 0 && (
        <div className="dd-card" data-testid="completeness-gate">
          <h3>{`Complétez ${impactsToComplete(completeness)} impact${impactsToComplete(completeness) > 1 ? "s" : ""} pour une recommandation fiable`}</h3>
          <small>{`${completeness.filled} sur ${completeness.total} impacts renseignés (${Math.round(completeness.ratio * 100)} %) : il en faut au moins ${Math.round(COMPLETENESS_MIN * 100)} % pour afficher un gagnant.`}</small>
          <ul className="dd-missing">{completeness.missing.slice(0, 6).map(m => (
            <li key={m.optionId + m.criterionId} data-testid="missing-impact"><span>{`« ${m.option} » sur « ${m.criterion} »`}</span>
              {([["++", "↑↑"], ["+", "↑"], ["0", "0"], ["-", "↓"], ["--", "↓↓"]] as const).map(([v, l]) => <button key={v} type="button" title={v === "0" ? "Sans effet" : v.startsWith("+") ? "Améliore" : "Dégrade"} onClick={() => onUpdate(setImpact(session, m.optionId, m.criterionId, v))}>{l}</button>)}
            </li>))}</ul>
          <button type="button" className="dd-ghost" onClick={onDetail}>Compléter dans la matrice</button>
        </div>
      )}

      {hasModel && winner && completeness.reliable && questions.filter(q => !q.choices.length).length === 0 && (
        <>
          <div className="dd-win" data-testid="dialogue-winner">
            <span style={{ fontSize: 26 }} aria-hidden="true">★</span>
            <div><small style={{ color: "#6b6f93", fontWeight: 700 }}>Option recommandée</small><br /><b>{winner.label}</b><div style={{ fontSize: 13.5, color: "#3b3f68" }}>{gapText(winner, ranking[1])}</div></div>
          </div>
          <ChangeCard session={session} />
          {(session.alertId || /supply/i.test(session.sector ?? "")) && <SolidityNote session={session} />}
          <div className="dd-actions">
            <button type="button" className="dd-ghost" onClick={onDetail}>Voir le détail</button>
            <button type="button" className="dd-ghost" onClick={onReport}>Rapport PDF</button>
            <MiniReportButton session={session} className="dd-ghost" />
            <button type="button" className="dd-primary" onClick={() => onFollow(winner.id)}>Suivre cette décision →</button>
          </div>
        </>
      )}

      {citations.length > 0 && (
        <details className="dd-more" open data-testid="dd-citations"><summary>D'après vos documents ({citations.length} extrait{citations.length > 1 ? "s" : ""} cité{citations.length > 1 ? "s" : ""})</summary>
          <ul>{citations.map(c => <li key={c.fichier + c.extrait}><q>{c.extrait}</q> <small>({c.fichier} · {c.usage})</small></li>)}</ul>
        </details>
      )}
      {(docs.length > 0 || docResults.length > 0 || docBusy) && (
        <div className="dd-docs" data-testid="dd-docs">
          {docBusy && <span role="status">{docProgress ?? "Lecture du document…"}</span>}
          {docs.map(d => <span key={d.name} className="dd-doc">{d.name} <button type="button" aria-label={`Retirer ${d.name}`} onClick={() => setDocs(x => x.filter(y => y.name !== d.name))}>×</button></span>)}
          <DocStatusList results={docResults} />
        </div>
      )}
      <div className="dd-input">
        <label className="dd-clip" title={`Joindre un document · glisser-déposer dans le fil · plusieurs fichiers ou une archive .zip · ${DOC_FORMATS_LABEL}`}>
          <input type="file" multiple hidden aria-label="Joindre un document" data-testid="dd-file" disabled={docBusy} accept={DOC_ACCEPT}
            onChange={e => { void attach(e.target.files ? Array.from(e.target.files) : null); e.target.value = ""; }} />
          <Paperclip size={16} aria-hidden="true" /><span className="sr-only">Joindre un document</span>
        </label>
        <textarea aria-label={hasModel ? "Corriger en une phrase" : "Décrire la décision"} rows={hasModel ? 1 : 3} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void (hasModel ? correct() : analyse()); } }}
          placeholder={hasModel ? "Corriger en une phrase : « le coût compte plus que la rapidité », « ajoute l'option location »…" : "Ex. Double source ou stock de sécurité pour SUP-003 ? Nous voulons surtout éviter une rupture, sans dépasser le budget."} />
        <button type="button" className={hasModel ? "dd-ghost" : "dd-primary"} disabled={busy || !text.trim()} onClick={() => void (hasModel ? correct() : analyse())}>{busy ? "Analyse…" : hasModel ? "Corriger" : "Analyser"}</button>
      </div>
    </div>
  );
}
