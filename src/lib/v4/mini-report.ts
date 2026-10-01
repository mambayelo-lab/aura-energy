// Mini-rapport de décision (une à deux pages narrées) et encart « Pourquoi
// cette recommandation est solide ». Uniquement ce que contient la session et
// ce que calcule le moteur Bora : aucun poids arbitraire, aucun fait inventé.
// Le PDF est enregistré dans la mémoire d'Aura (Supabase si une session est
// ouverte, sinon ce navigateur) et rattaché à la décision.
import { getLeafCriteria } from "./atelier-compute";
import type { AtelierSession } from "./atelier-store";
import { backwardSentence, backwardSmallestChange, rankOptions, type BackwardResult } from "./decision-express";
import { exploreSolutions, profileText } from "./solution-space";
import { pdfSafe } from "./supply-export";
import { getMemory } from "../memoire/memoire";

export interface Solidity {
  /** Évaluations qualitatives saisies (option × critère), sans poids numérique. */
  evaluations: number; judged: number;
  attitude: string;
  combinations: number; exhaustive: boolean;
  smallestChange: string;
  trace: string[];
}
export function solidity(session: AtelierSession, judgment?: BackwardResult | null): Solidity {
  const leaves = getLeafCriteria(session.criteria);
  const opts = session.leviersDef.flatMap(l => l.options);
  const evaluations = opts.reduce((n, o) => n + leaves.filter(c => o.impacts[c.id] && o.impacts[c.id] !== "U").length, 0);
  // Jugement d'expert : impact confirmé (plus marqué « hypothèse » par Aura).
  const judged = opts.reduce((n, o) => n + leaves.filter(c => o.impacts[c.id] && !(o.impactOrigins ?? {})[c.id]).length, 0);
  const space = session.leviersDef.length && session.leviersDef.every(l => l.options.length) ? exploreSolutions(session) : undefined;
  const b = judgment === undefined ? backwardSmallestChange(session, { limit: 20_000 }) : judgment;
  const trace = [
    session.alertLabel ? `Alerte d'origine : ${session.alertLabel}` : "Décision ouverte dans Décider",
    `Créée le ${new Date(session.createdAt).toLocaleDateString("fr-FR")}, mise à jour le ${new Date(session.updatedAt).toLocaleDateString("fr-FR")}`,
    session.decisionRecord ? "Fiche de décision signée (conditions, preuves, repli)" : "Fiche de décision à signer à l'étape Arbitrer",
  ];
  return {
    evaluations, judged,
    attitude: session.attitude === "Pessimiste" ? "prudente (pessimiste) : une option n'est bonne que si son pire effet l'est aussi" : "optimiste",
    combinations: space?.total ?? session.scenarios.length, exhaustive: space?.exhaustive ?? true,
    smallestChange: b ? backwardSentence(b) : "Plus petit changement non calculable (moins de deux options classées).",
    trace,
  };
}

export interface MiniReport {
  title: string; date: string; author: string;
  question: string; context?: string; origin?: string;
  options: string[]; ranking: { rank: number; label: string; profile: string }[];
  decision?: { label: string; justification: string };
  indicators: string[];
  solidity: Solidity;
}
export function miniReport(session: AtelierSession, author: string, now = new Date()): MiniReport {
  const ranking = session.scenarios.length ? rankOptions(session) : [];
  const retained = session.scenarios.find(s => s.id === (session.followUp?.scenarioId ?? session.retainedScenarioId)) ?? (ranking[0] ? session.scenarios.find(s => s.id === ranking[0].id) : undefined);
  const leaves = getLeafCriteria(session.criteria);
  const krs = session.followUp?.keyResults ?? [];
  return {
    title: session.title || "Décision", date: now.toLocaleDateString("fr-FR"), author: author || "utilisateur non identifié",
    question: session.title || session.contextRaw.split(/\n/)[0] || "Décision",
    context: session.contextRaw || undefined, origin: session.alertLabel ?? (session.alertId ? `Alerte ${session.alertId}` : undefined),
    options: session.scenarios.map(s => s.label),
    ranking: ranking.map(r => ({ rank: r.rank, label: r.label, profile: profileText(r) })),
    decision: retained ? { label: retained.label, justification: session.decisionRecord?.conditions?.join(" ; ") || session.tieBreak?.rationale || session.auraRecommendation || (ranking[0]?.label === retained.label ? "Premier du classement Bora avec l'attitude choisie." : "Choix de l'utilisateur, documenté dans la session.") } : undefined,
    indicators: krs.length ? krs.map(k => `${k.label} : ${k.start} → cible ${k.target} ${k.unit} au ${k.deadline}${k.owner ? ` (${k.owner})` : ""}`) : leaves.slice(0, 6).map(c => c.label),
    solidity: solidity(session),
  };
}

/** PDF d'une à deux pages, rédigé en phrases (pas de tableau dense). */
export async function miniReportPdf(r: MiniReport): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Mini-rapport de décision — ${r.title}`)); doc.setAuthor(pdfSafe(r.author));
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const INDIGO = rgb(0.278, 0.263, 0.902), NIGHT = rgb(0.082, 0.114, 0.322), MUTED = rgb(0.42, 0.44, 0.58);
  const W = 595, H = 842, M = 48;
  let page = doc.addPage([W, H]), y = H - M;
  const band = () => { page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: NIGHT }); page.drawText(pdfSafe("AURA DÉCIDER · MINI-RAPPORT DE DÉCISION"), { x: M, y: H - 20, size: 9.5, font: bold, color: rgb(1, 1, 1) }); y = H - 58; };
  band();
  const wrap = (t: string, size: number, f = font) => { const out: string[] = []; let line = ""; for (const w of pdfSafe(t).split(/\s+/)) { const x = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(x, size) > W - 2 * M && line) { out.push(line); line = w; } else line = x; } if (line) out.push(line); return out; };
  const para = (t: string, size = 10.5, f = font, color = NIGHT) => { for (const l of wrap(t, size, f)) { if (y < M + size) { page = doc.addPage([W, H]); band(); } page.drawText(l, { x: M, y, size, font: f, color }); y -= size + 4.5; } y -= 3; };
  const head = (t: string) => { y -= 4; para(t.toUpperCase(), 9.5, bold, INDIGO); };
  para(r.title, 16, bold);
  para(`Rédigé le ${r.date} par ${r.author}.`, 9.5, font, MUTED);
  head("La question");
  para(`${r.question}${r.origin ? ` Elle part de l'alerte « ${r.origin} ».` : ""}`);
  if (r.context && r.context !== r.question) para(r.context.slice(0, 700), 9.5, font, MUTED);
  head("Les options");
  para(r.options.length ? `${r.options.length} options ont été comparées : ${r.options.map(o => `« ${o} »`).join(", ")}.` : "Aucune option n'a encore été composée.");
  head("Le classement");
  para(r.ranking.length ? r.ranking.map(o => `${o.rank === 1 ? "En tête" : `Rang ${o.rank}`}, « ${o.label} » (${o.profile})`).join(". ") + "." : "Pas encore de classement.");
  head("Le plus petit changement");
  para(r.solidity.smallestChange);
  head("La décision");
  para(r.decision ? `L'option retenue est « ${r.decision.label} ». Justification : ${r.decision.justification}` : "Aucune option n'a encore été retenue.");
  head("Pourquoi cette recommandation est solide");
  para(`${r.solidity.evaluations} évaluations qualitatives (dont ${r.solidity.judged} confirmées par un expert), sans poids numérique arbitraire. Attitude ${r.solidity.attitude}. ${r.solidity.combinations.toLocaleString("fr-FR")} combinaisons de leviers explorées${r.solidity.exhaustive ? ", sans échantillonnage" : ""}. ${r.solidity.trace.join(". ")}.`);
  head("Les indicateurs de suivi");
  para(r.indicators.length ? r.indicators.join(" · ") : "Aucun indicateur de suivi défini.");
  return doc.save();
}

/** Enregistre le mini-rapport dans la mémoire d'Aura, rattaché à la session ; indique où. */
export async function saveMiniReport(session: AtelierSession, bytes: Uint8Array, author: string): Promise<{ where: "supabase" | "local"; message: string; id: string }> {
  const m = await getMemory("decider");
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const e = await m.decide(`mini-rapport:${session.id}`, "accepte", `Mini-rapport de « ${session.title || "Décision"} »`, session.id, { kind: "mini-rapport", sessionId: session.id, title: session.title, author, pdfBase64: btoa(bin), size: bytes.length });
  const where = m.backend.name === "supabase" ? "supabase" : "local";
  return { where, id: e.id, message: where === "supabase" ? "Mini-rapport enregistré dans votre espace Aura (Supabase) et rattaché à la décision." : "Aucune session ouverte : mini-rapport enregistré dans ce navigateur seulement, rattaché à la décision. Connectez-vous pour le conserver dans votre espace." };
}
/** Mini-rapports enregistrés pour une session (le plus récent en premier). */
export async function miniReportsOf(sessionId: string): Promise<{ id: string; createdAt: string; bytes: Uint8Array; title?: string }[]> {
  const m = await getMemory("decider");
  return (await m.decisions()).filter(e => e.key === `mini-rapport:${sessionId}`).reverse().map(e => {
    const p = e.payload as { pdfBase64: string; title?: string };
    const s = atob(p.pdfBase64), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return { id: e.id, createdAt: e.createdAt, bytes: b, title: p.title };
  });
}
