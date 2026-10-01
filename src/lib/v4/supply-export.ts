import { tr } from "../i18n-dom";
// Export « comité » d'une alerte Supply et de sa décision, sur une page :
// PDF (pdf-lib) ou PowerPoint (pptxgenjs). Le contenu vient uniquement des
// valeurs lues, de la règle et de la décision enregistrée : rien d'inventé.
import type { ArgusVocab, CausalRuleEvaluation } from "./argus-vocab-store";
import { alertChain } from "./supply-diagrams";
import type { JournalRow } from "./supply-memory";

export interface CommitteeBrief {
  title: string;
  severity: string;
  entity?: string;
  others: string[];
  indicators: { label: string; value: string; threshold: string; status: string }[];
  conclusion: string;
  causes: string[];
  options: string[];
  question: string;
  decision?: { date: string; option: string; reason: string; expected: string; before?: string; now?: string; outcome: string };
  source: string;
  generatedAt: string;
}

const fmt = (n: number | undefined, unit = "") => n === undefined ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ""}`;

export function committeeBrief(vocab: ArgusVocab, evaluation: CausalRuleEvaluation, decision?: JournalRow, now = new Date()): CommitteeBrief {
  const chain = alertChain(vocab, evaluation);
  const rule = evaluation.rule;
  const critical = chain.indicators.some(i => i.status === "critique") || rule.severity === "critique";
  const kpiId = chain.indicators[0]?.kpiId;
  const mapping = kpiId ? vocab.mappings.find(m => m.kpiId === kpiId && !m.condition) ?? vocab.mappings.find(m => m.kpiId === kpiId) : undefined;
  const field = mapping ? vocab.fields.find(f => f.id === mapping.fieldId) : undefined;
  const app = field ? vocab.apps.find(a => a.id === field.appId) : undefined;
  return {
    title: rule.label,
    severity: critical ? "Critique" : "À surveiller",
    entity: chain.entity,
    others: evaluation.matches.slice(1, 6).map(m => m.label),
    indicators: chain.indicators.map(i => ({ label: i.label, value: fmt(i.value, i.unit), threshold: `${i.sens} ${fmt(i.seuil, i.unit)}`, status: i.status })),
    conclusion: rule.conclusion,
    causes: (rule.causes ?? []).slice(0, 4),
    options: (rule.options ?? []).slice(0, 6),
    question: rule.decisionQuestion ?? rule.conclusion,
    decision: decision ? {
      date: new Date(decision.date).toLocaleDateString("fr-FR"), option: decision.option, reason: decision.reason, expected: decision.expected,
      before: decision.before !== undefined ? fmt(decision.before, decision.unit) : undefined,
      now: decision.now !== undefined ? fmt(decision.now, decision.unit) : undefined,
      outcome: decision.outcome,
    } : undefined,
    source: app && field ? `${app.label.split(" · ")[0]} · ${field.name}` : "Studio Aura",
    generatedAt: now.toLocaleDateString("fr-FR"),
  };
}

// Les polices standard du PDF (WinAnsi) n'ont pas ≥, ≤, → ni l'espace fine.
export function pdfSafe(input: string): string {
  // Langue de l'interface : un rapport produit en anglais est traduit ici.
  const s = tr(input);
  return s.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[→⟶]/g, "->").replace(/[−–]/g, "-")
    .replace(/[   ]/g, " ").replace(/[“”]/g, "\"").replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e -ÿ€…«»·•—œŒ]/g, "");
}

export async function committeePdf(b: CommitteeBrief): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`Comité — ${b.title}`));
  const page = doc.addPage([842, 595]); // A4 paysage
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.10, 0.08, 0.20), muted = rgb(0.45, 0.40, 0.60), accent = rgb(0.49, 0.23, 0.93);
  const sev = b.severity === "Critique" ? rgb(0.75, 0.22, 0.17) : rgb(0.66, 0.36, 0.06);
  const wrap = (text: string, size: number, width: number, f = font) => {
    const words = pdfSafe(text).split(/\s+/); const lines: string[] = []; let line = "";
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  };
  const write = (text: string, x: number, y: number, size: number, width: number, f = font, color = ink, max = 6) => {
    const lines = wrap(text, size, width, f).slice(0, max);
    lines.forEach((l, i) => page.drawText(l, { x, y: y - i * (size + 3), size, font: f, color }));
    return y - lines.length * (size + 3);
  };
  page.drawRectangle({ x: 0, y: 555, width: 842, height: 40, color: rgb(0.10, 0.08, 0.20) });
  page.drawText(pdfSafe("AURA SUPPLY CHAIN · NOTE AU COMITÉ"), { x: 36, y: 570, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText(pdfSafe(b.generatedAt), { x: 760, y: 570, size: 10, font, color: rgb(0.8, 0.78, 0.95) });
  page.drawRectangle({ x: 36, y: 512, width: 82, height: 20, color: sev });
  page.drawText(pdfSafe(b.severity.toUpperCase()), { x: 44, y: 518, size: 9.5, font: bold, color: rgb(1, 1, 1) });
  write(b.title, 130, 517, 18, 670, bold, ink, 1);
  let y = write(`Entité concernée : ${b.entity ?? "ensemble des données"}${b.others.length ? `  (aussi : ${b.others.join(", ")})` : ""}`, 36, 490, 10.5, 770, font, muted, 2);
  // Colonne gauche : faits et chaîne de causalité.
  y -= 10;
  page.drawText("FAITS OBSERVÉS", { x: 36, y, size: 9, font: bold, color: accent });
  y -= 16;
  for (const i of b.indicators) {
    page.drawText(pdfSafe(i.value), { x: 36, y: y - 10, size: 20, font: bold, color: i.status === "critique" ? rgb(0.75, 0.22, 0.17) : i.status === "alerte" ? rgb(0.66, 0.36, 0.06) : rgb(0.05, 0.48, 0.33) });
    write(`${i.label} · seuil ${i.threshold}`, 36, y - 26, 9.5, 360, font, muted, 1);
    y -= 44;
  }
  page.drawText("CHAÎNE DE CAUSALITÉ", { x: 36, y, size: 9, font: bold, color: accent });
  y -= 16;
  const steps = [b.entity ?? "Données", b.indicators.map(i => `${i.value} ${i.threshold}`).join(" et "), b.title, b.decision ? `Décision : ${b.decision.option}` : "Décision à prendre"];
  steps.forEach((s, k) => {
    const x = 36 + k * 88;
    page.drawRectangle({ x, y: y - 30, width: 80, height: 38, borderColor: rgb(0.79, 0.75, 0.99), borderWidth: 1, color: rgb(0.98, 0.97, 1) });
    wrap(s, 7.5, 72).slice(0, 3).forEach((l, i) => page.drawText(l, { x: x + 4, y: y - 2 - i * 9.5, size: 7.5, font, color: ink }));
    if (k < steps.length - 1) page.drawText("->", { x: x + 81, y: y - 14, size: 7, font: bold, color: accent });
  });
  y -= 50;
  page.drawText("LECTURE", { x: 36, y, size: 9, font: bold, color: accent });
  y = write(b.conclusion, 36, y - 14, 10, 340, font, ink, 5);
  if (b.causes.length) { y -= 6; page.drawText("CAUSES", { x: 36, y, size: 9, font: bold, color: accent }); y -= 14; for (const c of b.causes) y = write(`• ${c}`, 36, y, 9.5, 340, font, ink, 2); }
  y -= 6;
  write(`Source : ${b.source}`, 36, Math.min(y, 60), 8.5, 360, font, muted, 2);
  // Colonne droite : question, options, décision.
  let r = 450;
  page.drawText("QUESTION AU COMITÉ", { x: 430, y: r, size: 9, font: bold, color: accent });
  r = write(b.question, 430, r - 16, 12, 370, bold, ink, 3) - 8;
  page.drawText("OPTIONS", { x: 430, y: r, size: 9, font: bold, color: accent });
  r -= 14;
  for (const o of b.options) { const chosen = b.decision?.option === o; r = write(`${chosen ? "[x]" : "[ ]"} ${o}`, 430, r, 10, 370, chosen ? bold : font, ink, 1); }
  r -= 10;
  page.drawRectangle({ x: 424, y: 40, width: 382, height: r - 30, borderColor: rgb(0.79, 0.75, 0.99), borderWidth: 1 });
  page.drawText("DÉCISION", { x: 436, y: r - 16, size: 9, font: bold, color: accent });
  if (b.decision) {
    let d = write(`${b.decision.date} · ${b.decision.option}`, 436, r - 32, 12, 360, bold, ink, 2);
    if (b.decision.reason) d = write(`Raison : ${b.decision.reason}`, 436, d - 4, 10, 360, font, ink, 3);
    if (b.decision.expected) d = write(`Résultat attendu : ${b.decision.expected}`, 436, d - 4, 10, 360, font, ink, 3);
    if (b.decision.before) write(`Indicateur : ${b.decision.before} à la décision -> ${b.decision.now ?? "non relu"} aujourd'hui (${b.decision.outcome})`, 436, d - 4, 10, 360, font, muted, 2);
  } else {
    write("Aucune décision enregistrée pour cette alerte : à arbitrer en comité.", 436, r - 32, 10.5, 360, font, muted, 2);
  }
  return doc.save();
}

export async function committeePptx(b: CommitteeBrief): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13,33 × 7,5 pouces
  const s = pptx.addSlide();
  const INK = "1A1433", MUTED = "7D71A8", ACCENT = "7C3AED", SEV = b.severity === "Critique" ? "C0392B" : "A85D0F";
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.55, fill: { color: INK } });
  s.addText(tr("AURA SUPPLY CHAIN · NOTE AU COMITÉ"), { x: 0.4, y: 0.08, w: 9, h: 0.4, fontSize: 12, bold: true, color: "FFFFFF" });
  s.addText(tr(b.generatedAt), { x: 11, y: 0.08, w: 2, h: 0.4, fontSize: 11, color: "D8D3F0", align: "right" });
  s.addText(tr(b.severity.toUpperCase()), { x: 0.4, y: 0.8, w: 1.3, h: 0.35, fontSize: 10, bold: true, color: "FFFFFF", fill: { color: SEV }, align: "center" });
  s.addText(tr(b.title), { x: 1.85, y: 0.72, w: 11, h: 0.5, fontSize: 24, bold: true, color: INK });
  s.addText(`Entité concernée : ${b.entity ?? "ensemble des données"}${b.others.length ? ` (aussi : ${b.others.join(", ")})` : ""}`, { x: 0.4, y: 1.25, w: 12.5, h: 0.35, fontSize: 12, color: MUTED });
  s.addText(tr("FAITS OBSERVÉS"), { x: 0.4, y: 1.75, w: 6, h: 0.3, fontSize: 10, bold: true, color: ACCENT });
  b.indicators.forEach((i, k) => {
    s.addText([{ text: tr(`${i.value}  `), options: { fontSize: 22, bold: true, color: i.status === "critique" ? "C0392B" : i.status === "alerte" ? "A85D0F" : "0D7A54" } }, { text: tr(`${i.label} · seuil ${i.threshold}`), options: { fontSize: 11, color: MUTED } }], { x: 0.4, y: 2.05 + k * 0.55, w: 6, h: 0.5 });
  });
  const chainY = 2.2 + b.indicators.length * 0.55;
  s.addText(tr("CHAÎNE DE CAUSALITÉ"), { x: 0.4, y: chainY, w: 6, h: 0.3, fontSize: 10, bold: true, color: ACCENT });
  [b.entity ?? "Données", b.indicators.map(i => `${i.value} ${i.threshold}`).join(" et "), b.title, b.decision ? `Décision : ${b.decision.option}` : "Décision à prendre"].forEach((t, k) => {
    s.addText(tr(t), { x: 0.4 + k * 1.55, y: chainY + 0.35, w: 1.4, h: 0.75, fontSize: 9, color: INK, fill: { color: "F6F5FF" }, line: { color: "C9BFFD", width: 1 }, valign: "middle", align: "center" });
    if (k < 3) s.addText(tr("→"), { x: 1.8 + k * 1.55, y: chainY + 0.55, w: 0.15, h: 0.3, fontSize: 10, color: ACCENT });
  });
  s.addText([{ text: tr("LECTURE\n"), options: { fontSize: 10, bold: true, color: ACCENT } }, { text: tr(b.conclusion), options: { fontSize: 11, color: INK } }, ...(b.causes.length ? [{ text: tr("\n\nCAUSES\n"), options: { fontSize: 10, bold: true, color: ACCENT } }, { text: b.causes.map(c => `• ${c}`).join("\n"), options: { fontSize: 10.5, color: INK } }] : [])], { x: 0.4, y: chainY + 1.25, w: 6.1, h: 7.1 - (chainY + 1.25), valign: "top" });
  s.addText(tr(`Source : ${b.source}`), { x: 0.4, y: 7.05, w: 6.5, h: 0.3, fontSize: 9, color: MUTED });
  s.addText([{ text: tr("QUESTION AU COMITÉ\n"), options: { fontSize: 10, bold: true, color: ACCENT } }, { text: tr(b.question), options: { fontSize: 14, bold: true, color: INK } }], { x: 6.9, y: 1.75, w: 6, h: 1, valign: "top" });
  s.addText([{ text: tr("OPTIONS\n"), options: { fontSize: 10, bold: true, color: ACCENT } }, ...b.options.map(o => ({ text: tr(`${b.decision?.option === o ? "☑" : "☐"} ${o}\n`), options: { fontSize: 11.5, bold: b.decision?.option === o, color: INK } }))], { x: 6.9, y: 2.85, w: 6, h: 2, valign: "top" });
  const d = b.decision;
  s.addText(d
    ? [{ text: tr("DÉCISION\n"), options: { fontSize: 10, bold: true, color: ACCENT } }, { text: tr(`${d.date} · ${d.option}\n`), options: { fontSize: 14, bold: true, color: INK } }, ...(d.reason ? [{ text: tr(`Raison : ${d.reason}\n`), options: { fontSize: 11, color: INK } }] : []), ...(d.expected ? [{ text: tr(`Résultat attendu : ${d.expected}\n`), options: { fontSize: 11, color: INK } }] : []), ...(d.before ? [{ text: tr(`Indicateur : ${d.before} à la décision → ${d.now ?? "non relu"} aujourd'hui (${d.outcome})`), options: { fontSize: 10.5, color: MUTED } }] : [])]
    : [{ text: tr("DÉCISION\n"), options: { fontSize: 10, bold: true, color: ACCENT } }, { text: tr("Aucune décision enregistrée pour cette alerte : à arbitrer en comité."), options: { fontSize: 11, color: MUTED } }],
    { x: 6.9, y: 4.95, w: 6, h: 2.2, valign: "top", line: { color: "C9BFFD", width: 1 }, margin: 8 });
  return (await pptx.write({ outputType: "blob" })) as Blob;
}
