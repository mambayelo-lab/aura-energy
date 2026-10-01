// Rapport PDF de synthèse d'une décision (Décider autonome ou ouvert depuis
// Supply) : question, options et critères, classement Bora, plus petit
// changement, décision retenue, résultats clés, alerte d'origine, date, et
// l'arbre leviers → options → indicateurs. Uniquement ce que contient la
// session et ce que calcule le moteur : rien d'inventé.
import { getLeafCriteria } from "./atelier-compute";
import type { AtelierSession, QualitativeImpact } from "./atelier-store";
import { backwardSentence, krProgress, krStatus, rankOptions, type BackwardResult } from "./decision-express";
import { currentCombo, exploreSolutions, minimalMoveToBest, profileText } from "./solution-space";
import { pdfSafe } from "./supply-export";

export interface DecisionReport {
  title: string; context: string; date: string;
  origin?: string;
  attitude: string;
  criteria: { label: string; importance: string }[];
  levers: { label: string; options: { id: string; label: string; impacts: { crit: string; level: number; good: boolean }[] }[] }[];
  ranking: { rank: number; label: string; profile: string }[];
  space?: string;
  move?: string;
  judgment?: string;
  decision?: { label: string; date: string; justification: string };
  keyResults: { label: string; start: number; target: number; current: number; unit: string; deadline: string; owner: string; status: string; progress: number }[];
  reviewDate?: string;
}

const LV: Record<string, [number, boolean]> = { "++": [3, true], "+": [2, true], "+L": [1, true], "-L": [1, false], "-": [2, false], "--": [3, false] };

export function decisionReport(session: AtelierSession, judgment?: BackwardResult | null, now = new Date()): DecisionReport {
  const leaves = getLeafCriteria(session.criteria);
  const ranking = session.scenarios.length ? rankOptions(session) : [];
  let space: string | undefined, move: string | undefined;
  if (session.leviersDef.length && session.leviersDef.every(l => l.options.length)) {
    const sp = exploreSolutions(session);
    space = `${sp.results.length.toLocaleString("fr-FR")} combinaisons évaluées par le moteur sur ${sp.total.toLocaleString("fr-FR")} (${sp.exhaustive ? "exhaustif" : "budget de 10⁶ atteint"}) ; meilleur profil : ${sp.best ? profileText(sp.best) : "—"}.`;
    const from = currentCombo(session);
    const m = from && sp.best ? minimalMoveToBest(session, from, sp.best) : null;
    if (m) move = m.alreadyBest ? "La solution actuelle atteint déjà le meilleur profil de l'espace." : `En changeant ${m.changes.length} levier(s) (${m.changes.map(c => `${c.lever} : ${c.from} → ${c.to}`).join(" ; ")}), la solution atteint le meilleur profil (${profileText(m.reached)}).`;
  }
  const retained = session.scenarios.find(s => s.id === (session.followUp?.scenarioId ?? session.retainedScenarioId));
  const f = session.followUp;
  return {
    title: session.title || "Décision", context: session.contextRaw, date: now.toLocaleDateString("fr-FR"),
    origin: session.alertId ? session.alertLabel ?? `Alerte ${session.alertId}` : undefined,
    attitude: session.attitude === "Pessimiste" ? "pessimiste (prudente)" : "optimiste",
    criteria: session.criteria.map(c => ({ label: c.label, importance: c.importance })),
    levers: session.leviersDef.map(l => ({ label: l.label, options: l.options.map(o => ({ id: o.id, label: o.label, impacts: leaves.flatMap(c => { const v = LV[o.impacts[c.id] as QualitativeImpact]; return v ? [{ crit: c.label, level: v[0], good: v[1] }] : []; }) })) })),
    ranking: ranking.map(r => ({ rank: r.rank, label: r.label, profile: profileText(r) })),
    space, move,
    judgment: judgment ? backwardSentence(judgment) : undefined,
    decision: retained ? { label: retained.label, date: new Date(f?.decidedAt ?? now).toLocaleDateString("fr-FR"), justification: session.decisionRecord?.conditions?.join(" ; ") || session.tieBreak?.rationale || session.auraRecommendation || (ranking[0]?.label === retained.label ? "Premier du classement Bora." : "Choix de l'utilisateur.") } : undefined,
    keyResults: (f?.keyResults ?? []).map(kr => ({ label: kr.label, start: kr.start, target: kr.target, current: kr.current, unit: kr.unit, deadline: kr.deadline, owner: kr.owner, status: krStatus(kr, f!.decidedAt, now.getTime()), progress: krProgress(kr) })),
    reviewDate: f?.reviewDate,
  };
}

export async function decisionReportPdf(r: DecisionReport): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Rapport de décision — ${r.title}`));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const INDIGO = rgb(0.278, 0.263, 0.902), NIGHT = rgb(0.082, 0.114, 0.322), MUTED = rgb(0.42, 0.44, 0.58), LINE = rgb(0.89, 0.89, 0.98);
  const GOOD = rgb(0.05, 0.48, 0.33), BAD = rgb(0.75, 0.22, 0.17);
  const W = 595, H = 842, M = 40;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const header = () => {
    page.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: NIGHT });
    page.drawText(pdfSafe("AURA DÉCIDER · RAPPORT DE DÉCISION"), { x: M, y: H - 22, size: 10, font: bold, color: rgb(1, 1, 1) });
    page.drawText(pdfSafe(r.date), { x: W - M - 60, y: H - 22, size: 9.5, font, color: rgb(0.8, 0.8, 0.95) });
    y = H - 60;
  };
  header();
  const ensure = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); header(); } };
  const wrap = (text: string, size: number, width: number, f = font) => {
    const out: string[] = []; let line = "";
    for (const w of pdfSafe(text).split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  };
  const para = (text: string, size = 10, f = font, color = NIGHT, width = W - 2 * M, x = M) => {
    for (const l of wrap(text, size, width, f)) { ensure(size + 4); page.drawText(l, { x, y, size, font: f, color }); y -= size + 4; }
  };
  const title = (t: string) => { y -= 6; ensure(24); page.drawText(pdfSafe(t).toUpperCase(), { x: M, y, size: 9.5, font: bold, color: INDIGO }); y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE }); y -= 12; };

  para(r.title, 17, bold);
  y -= 2;
  if (r.origin) para(`Origine : ${r.origin}`, 10, font, MUTED);
  para(`Attitude face au risque : ${r.attitude} · classement du moteur de décision Bora (thèse Lô 2013)`, 9.5, font, MUTED);
  if (r.context) { title("Question et contexte"); for (const line of r.context.slice(0, 1200).split(/\n+/)) para(line, 10); }

  if (r.decision) {
    title("Décision retenue");
    ensure(40);
    page.drawRectangle({ x: M, y: y - 26, width: W - 2 * M, height: 34, color: rgb(0.945, 0.94, 1), borderColor: INDIGO, borderWidth: 1 });
    page.drawText(pdfSafe(r.decision.label).slice(0, 80), { x: M + 10, y: y - 6, size: 12.5, font: bold, color: NIGHT });
    page.drawText(pdfSafe(`le ${r.decision.date}`), { x: M + 10, y: y - 20, size: 9, font, color: MUTED });
    y -= 40;
    para(`Justification : ${r.decision.justification}`, 9.5);
  }

  title("Classement Bora");
  r.ranking.forEach((o, i) => {
    ensure(20);
    const first = i === 0;
    page.drawCircle({ x: M + 9, y: y + 3, size: 8, color: first ? INDIGO : LINE });
    page.drawText(String(o.rank), { x: M + 6.5, y: y - 0.5, size: 9, font: bold, color: first ? rgb(1, 1, 1) : NIGHT });
    page.drawText(pdfSafe(o.label).slice(0, 70), { x: M + 24, y, size: 10.5, font: first ? bold : font, color: NIGHT });
    page.drawText(pdfSafe(o.profile), { x: W - M - 150, y, size: 9, font, color: MUTED });
    y -= 18;
  });

  title("Ce qui ferait changer la décision");
  if (r.space) para(r.space, 9.5, font, MUTED);
  if (r.move) para(r.move, 10);
  if (r.judgment) para(r.judgment, 9.5);

  title("Critères (importance)");
  para(r.criteria.map(c => `${c.label} (${c.importance})`).join(" · "), 9.5);

  // Arbre leviers → options → indicateurs (liens colorés par sens, épaisseur = niveau).
  title("Arbre des impacts");
  const crits = [...new Set(r.levers.flatMap(l => l.options.flatMap(o => o.impacts.map(i => i.crit))))];
  const rows = r.levers.reduce((n, l) => n + l.options.length, 0);
  const rowH = 15, treeH = Math.max(rows * rowH + r.levers.length * 6, crits.length * rowH) + 10;
  if (y - treeH < M) { page = doc.addPage([W, H]); header(); title("Arbre des impacts"); }
  const top = y;
  const cx = { lev: M, opt: M + 128, crit: M + 390 };
  const optPos = new Map<string, number>();
  let yy = top;
  const retainedLabel = r.decision?.label;
  for (const l of r.levers) {
    const start = yy;
    for (const o of l.options) { optPos.set(o.id, yy); yy -= rowH; }
    const ly = (start + yy + rowH) / 2;
    page.drawText(pdfSafe(l.label).slice(0, 24), { x: cx.lev, y: ly - 3, size: 8.5, font: bold, color: NIGHT });
    for (const o of l.options) page.drawLine({ start: { x: cx.opt - 14, y: ly }, end: { x: cx.opt - 3, y: optPos.get(o.id)! }, thickness: 0.5, color: LINE });
    yy -= 6;
  }
  const critPos = new Map(crits.map((c, i) => [c, top - i * ((top - yy) / Math.max(1, crits.length))]));
  for (const l of r.levers) for (const o of l.options) {
    const oy = optPos.get(o.id)!;
    for (const i of o.impacts) page.drawLine({ start: { x: cx.opt + 168, y: oy }, end: { x: cx.crit - 4, y: critPos.get(i.crit)! + 3 }, thickness: [0, 0.6, 1.3, 2.2][i.level], color: i.good ? GOOD : BAD, opacity: 0.75 });
    const on = !!retainedLabel && retainedLabel.includes(o.label);
    page.drawText(pdfSafe(o.label).slice(0, 36), { x: cx.opt, y: oy - 3, size: 8, font: on ? bold : font, color: on ? INDIGO : NIGHT });
  }
  for (const c of crits) page.drawText(pdfSafe(c).slice(0, 32), { x: cx.crit, y: critPos.get(c)!, size: 8, font, color: NIGHT });
  y = Math.min(yy, top - crits.length * rowH) - 8;
  para("Vert : effet favorable · rouge : défavorable · épaisseur : niveau L, M, H.", 8.5, font, MUTED);

  if (r.keyResults.length) {
    title("Résultats clés");
    for (const k of r.keyResults) {
      ensure(34);
      page.drawText(pdfSafe(k.label).slice(0, 60), { x: M, y, size: 10, font: bold, color: NIGHT });
      page.drawText(pdfSafe(k.status), { x: W - M - 60, y, size: 9.5, font: bold, color: k.status === "en retard" ? rgb(0.66, 0.36, 0.06) : k.status === "en avance" ? GOOD : INDIGO });
      y -= 12;
      page.drawRectangle({ x: M, y: y - 2, width: W - 2 * M, height: 6, color: LINE });
      page.drawRectangle({ x: M, y: y - 2, width: (W - 2 * M) * k.progress, height: 6, color: INDIGO });
      y -= 12;
      para(`${k.start} → ${k.current} / cible ${k.target} ${k.unit} · échéance ${k.deadline}${k.owner ? ` · ${k.owner}` : ""}`, 9, font, MUTED);
    }
    if (r.reviewDate) para(`Revue de la décision : ${r.reviewDate}`, 9.5);
  }
  return doc.save();
}
