// doc-formats.ts — lecture des formats de fichiers dans le navigateur, sans rien envoyer.
// Schémas (draw.io, BPMN, ArchiMate, Visio, SVG) : on relève les éléments et les flux
// tels qu'ils sont écrits, rien n'est déduit ici.
import JSZip from "jszip";

/** Garde-fou global : 500 Mo par chargement (tous fichiers et archives compris). */
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
/** Au-delà, le fichier est traité par morceaux (et, connecté, déposé dans le stockage par URL signée). */
export const LARGE_FILE_BYTES = 50 * 1024 * 1024;
/** Côté le plus long d'une image envoyée à la vision (réduite dans le navigateur). */
export const VISION_MAX_PX = 2000;
/** Taille d'un morceau de texte pour la synthèse progressive. */
export const CHUNK_CHARS = 12_000;
/** Au-delà de cette longueur, le texte est synthétisé morceau par morceau. */
export const SYNTH_THRESHOLD = 40_000;

export const DOC_FORMATS_LABEL = "PDF, Word, PowerPoint, Excel, CSV, image, SVG, draw.io, BPMN, ArchiMate, Visio, JSON, Markdown, texte, archive zip";
export const DOC_ACCEPT = ".pdf,.docx,.pptx,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.drawio,.bpmn,.archimate,.xml,.vsdx,.json,.md,.txt,.zip";

export type FormatKind = "pdf" | "docx" | "pptx" | "xlsx" | "csv" | "image" | "svg" | "drawio" | "bpmn" | "archimate" | "xml" | "vsdx" | "json" | "text" | "zip" | "unsupported";
export const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
export function formatOf(name: string): FormatKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "md" || ext === "txt") return "text";
  if (ext === "drawio" || ext === "dio") return "drawio";
  if (ext === "bpmn") return "bpmn";
  if (ext === "archimate") return "archimate";
  if (["pdf", "docx", "pptx", "xlsx", "csv", "svg", "xml", "vsdx", "json", "zip"].includes(ext)) return ext as FormatKind;
  return "unsupported";
}
/** Message clair pour un format illisible. */
export const unsupportedMessage = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const hint = ext === "doc" ? " Enregistrez-le en .docx." : ext === "xls" ? " Enregistrez-le en .xlsx." : ext === "ppt" ? " Enregistrez-le en .pptx." : ext === "vsd" ? " Enregistrez-le en .vsdx." : "";
  return `Format .${ext || "?"} non lisible par Aura.${hint} Formats lus : ${DOC_FORMATS_LABEL}.`;
};

// ── Schémas ───────────────────────────────────────────────────────────────
export interface DiagramNode { id: string; label: string; type?: string }
export interface DiagramEdge { from: string; to: string; label?: string }
export interface Diagram { kind: "drawio" | "bpmn" | "archimate" | "vsdx" | "svg"; nodes: DiagramNode[]; edges: DiagramEdge[]; texts?: string[] }

const clean = (s: string | null | undefined) => (s ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const xml = (s: string) => {
  const doc = new DOMParser().parseFromString(s, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XML illisible.");
  return doc;
};
const all = (d: Document | Element, local: string) => Array.from(d.getElementsByTagNameNS("*", local));

async function inflateDrawio(payload: string): Promise<string> {
  const bin = Uint8Array.from(atob(payload.trim()), c => c.charCodeAt(0));
  const ds = new DecompressionStream("deflate-raw");
  const out = await new Response(new Response(bin).body!.pipeThrough(ds)).text();
  return decodeURIComponent(out);
}

export async function parseDrawio(src: string): Promise<Diagram> {
  let doc = xml(src);
  const diag = all(doc, "diagram")[0];
  if (diag && !all(diag, "mxGraphModel").length && diag.textContent?.trim()) doc = xml(await inflateDrawio(diag.textContent));
  const cells = all(doc, "mxCell");
  const label = (c: Element) => clean(c.getAttribute("value") ?? c.parentElement?.getAttribute("label"));
  const idOf = (c: Element) => c.getAttribute("id") ?? c.parentElement?.getAttribute("id") ?? "";
  const nodes = cells.filter(c => c.getAttribute("vertex") === "1" && label(c)).map(c => ({ id: idOf(c), label: label(c), type: (c.getAttribute("style") ?? "").split(";")[0] || undefined }));
  const edgeCells = cells.filter(c => c.getAttribute("edge") === "1");
  // Libellé d'un flux : sur l'arête, ou dans une étiquette enfant.
  const childLabel = (id: string) => cells.filter(c => c.getAttribute("parent") === id && c.getAttribute("vertex") === "1").map(label).filter(Boolean).join(" ");
  const edges = edgeCells.filter(c => c.getAttribute("source") && c.getAttribute("target")).map(c => ({ from: c.getAttribute("source")!, to: c.getAttribute("target")!, label: label(c) || childLabel(idOf(c)) || undefined }));
  const edgeLabelIds = new Set(edgeCells.flatMap(e => cells.filter(c => c.getAttribute("parent") === idOf(e)).map(idOf)));
  return { kind: "drawio", nodes: nodes.filter(n => !edgeLabelIds.has(n.id)), edges };
}

export function parseBpmn(src: string): Diagram {
  const doc = xml(src);
  const named = (local: string, type: string) => all(doc, local).filter(e => e.getAttribute("name")).map(e => ({ id: e.getAttribute("id") ?? "", label: clean(e.getAttribute("name")), type }));
  const nodes = [
    ...named("participant", "participant"), ...named("lane", "lane"),
    ...["task", "userTask", "serviceTask", "sendTask", "receiveTask", "manualTask", "scriptTask", "businessRuleTask", "subProcess", "callActivity"].flatMap(t => named(t, "activité")),
    ...named("dataObjectReference", "objet"), ...named("dataStoreReference", "stockage"),
    ...["startEvent", "endEvent", "intermediateCatchEvent", "intermediateThrowEvent"].flatMap(t => named(t, "événement")),
    ...["exclusiveGateway", "parallelGateway", "inclusiveGateway"].flatMap(t => named(t, "décision")),
  ];
  const flow = (local: string) => all(doc, local).map(e => ({ from: e.getAttribute("sourceRef") ?? "", to: e.getAttribute("targetRef") ?? "", label: clean(e.getAttribute("name")) || undefined })).filter(e => e.from && e.to);
  return { kind: "bpmn", nodes, edges: [...flow("messageFlow"), ...flow("sequenceFlow")] };
}

export function parseArchimate(src: string): Diagram {
  const doc = xml(src);
  const typeOf = (e: Element) => (e.getAttribute("xsi:type") ?? e.getAttributeNS("http://www.w3.org/2001/XMLSchema-instance", "type") ?? "").replace(/^archimate:/, "");
  const nameOf = (e: Element) => clean(e.getAttribute("name") ?? all(e, "name")[0]?.textContent);
  const elements = [...all(doc, "element"), ...all(doc, "child")].filter(e => !/Relationship$/.test(typeOf(e)) && nameOf(e) && typeOf(e) !== "DiagramObject");
  const nodes = elements.map(e => ({ id: e.getAttribute("identifier") ?? e.getAttribute("id") ?? "", label: nameOf(e), type: typeOf(e) }));
  const rels = [...all(doc, "relationship"), ...all(doc, "element").filter(e => /Relationship$/.test(typeOf(e)))];
  const edges = rels.map(e => ({ from: e.getAttribute("source") ?? "", to: e.getAttribute("target") ?? "", label: [typeOf(e).replace(/Relationship$/, ""), nameOf(e)].filter(Boolean).join(" · ") || undefined })).filter(e => e.from && e.to);
  return { kind: "archimate", nodes, edges };
}

export function parseSvg(src: string): Diagram {
  const doc = xml(src);
  const texts = [...all(doc, "text"), ...all(doc, "title"), ...all(doc, "desc")].map(t => clean(t.textContent)).filter(Boolean);
  // SVG exporté par draw.io : le modèle d'origine est parfois embarqué dans l'attribut content.
  return { kind: "svg", nodes: [], edges: [], texts: [...new Set(texts)] };
}

export async function parseVsdx(zip: JSZip): Promise<Diagram> {
  const nodes: DiagramNode[] = [], edges: DiagramEdge[] = [], connectors = new Set<string>();
  const pages = Object.keys(zip.files).filter(p => /^visio\/pages\/page\d+\.xml$/.test(p)).sort();
  for (const p of pages) {
    const doc = xml(await zip.file(p)!.async("string"));
    const prefix = p.match(/page(\d+)/)![1] + ":";
    for (const s of all(doc, "Shape")) {
      const t = clean(all(s, "Text")[0]?.textContent);
      if (t && !all(s, "Shape").length) nodes.push({ id: prefix + s.getAttribute("ID"), label: t, type: s.getAttribute("NameU") ?? undefined });
    }
    // Connecteurs : Connect FromSheet (connecteur) → ToSheet, BeginX puis EndX.
    const by = new Map<string, { begin?: string; end?: string }>();
    for (const c of all(doc, "Connect")) {
      const k = prefix + c.getAttribute("FromSheet"), v = by.get(k) ?? {};
      if (c.getAttribute("FromCell") === "BeginX") v.begin = prefix + c.getAttribute("ToSheet"); else if (c.getAttribute("FromCell") === "EndX") v.end = prefix + c.getAttribute("ToSheet");
      by.set(k, v);
    }
    for (const [k, v] of by) { connectors.add(k); if (v.begin && v.end) edges.push({ from: v.begin, to: v.end, label: nodes.find(n => n.id === k)?.label }); }
  }
  return { kind: "vsdx", nodes: nodes.filter(n => !connectors.has(n.id)), edges };
}

export function diagramToText(d: Diagram, name = ""): string {
  const label = new Map(d.nodes.map(n => [n.id, n.label]));
  const lines = [`Schéma ${d.kind}${name ? ` « ${name} »` : ""} : ${d.nodes.length} élément(s), ${d.edges.length} flux.`];
  if (d.nodes.length) lines.push("Éléments :", ...d.nodes.map(n => `- ${n.label}${n.type ? ` (${n.type})` : ""}`));
  const flows = d.edges.filter(e => label.has(e.from) && label.has(e.to));
  if (flows.length) lines.push("Flux :", ...flows.map(e => `- ${label.get(e.from)} → ${label.get(e.to)}${e.label ? ` : ${e.label}` : ""}`));
  if (d.texts?.length) lines.push("Textes :", ...d.texts.map(t => `- ${t}`));
  return lines.join("\n");
}

// ── Bureautique ───────────────────────────────────────────────────────────
export async function pptxText(zip: JSZip): Promise<string> {
  const slides = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, p] of slides.entries()) {
    const x = await zip.file(p)!.async("string");
    const paras = [...x.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)].map(m => clean([...m[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(t => t[1]).join(""))).filter(Boolean);
    if (paras.length) out.push(`Diapositive ${i + 1}\n${paras.join("\n")}`);
  }
  return out.join("\n\n");
}
/** Médias d'une archive bureautique (images de diapositives, par exemple), pour la vision. */
export function officeMedia(zip: JSZip): string[] {
  return Object.keys(zip.files).filter(p => /^(ppt|word|xl)\/media\/.+\.(png|jpe?g|gif|bmp|webp)$/i.test(p));
}

export function sheetsToText(sheets: { name: string; rows: string[][] }[], maxRows = 2000): { text: string; truncated: boolean } {
  let truncated = false;
  const text = sheets.map(s => {
    const rows = s.rows.filter(r => r.some(c => c));
    if (rows.length > maxRows) truncated = true;
    return `Feuille « ${s.name} » (${rows.length} lignes)\n${rows.slice(0, maxRows).map(r => r.join(" ; ")).join("\n")}`;
  }).join("\n\n");
  return { text, truncated };
}

export function jsonText(src: string): string {
  try { return JSON.stringify(JSON.parse(src), null, 1); } catch { return src; }
}

/** Découpe un texte long en morceaux, sur des fins de paragraphe si possible. */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    if (end < text.length) { const cut = text.lastIndexOf("\n", end); if (cut > i + size / 2) end = cut; }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

/** Détecte le type d'un XML générique (BPMN, ArchiMate, draw.io) par son contenu. */
export function xmlFlavor(src: string): "bpmn" | "archimate" | "drawio" | "svg" | "xml" {
  const head = src.slice(0, 4000);
  if (/bpmn/i.test(head)) return "bpmn";
  if (/archimate|opengroup\.org\/xsd\/archimate/i.test(head)) return "archimate";
  if (/<mxfile|<mxGraphModel/.test(head)) return "drawio";
  if (/<svg\b/.test(head)) return "svg";
  return "xml";
}
