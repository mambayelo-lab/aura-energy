// doc-extract.ts — lecture des documents dans le navigateur, partout où Aura charge un fichier.
// Le fichier d'origine ne quitte pas le navigateur : seul le texte extrait, ou une image réduite
// (2 000 px au plus) pour la vision, part vers le serveur. Chaque requête reste loin de la
// limite des fonctions (~4,5 Mo). Les très gros fichiers texte sont, si l'on est connecté,
// déposés dans le stockage par URL signée et synthétisés morceau par morceau côté serveur.
import JSZip from "jszip";
import {
  chunkText, diagramToText, formatOf, jsonText, LARGE_FILE_BYTES, MAX_TOTAL_BYTES, officeMedia, parseArchimate, parseBpmn,
  parseDrawio, parseSvg, parseVsdx, pptxText, sheetsToText, SYNTH_THRESHOLD, unsupportedMessage, VISION_MAX_PX, xmlFlavor,
  type Diagram, type FormatKind,
} from "./doc-formats";

export type DocStatus = "lu" | "partiel" | "non lisible";
export interface DocResult { name: string; status: DocStatus; text: string; note?: string; format: FormatKind; bytes: number; diagram?: Diagram; /** Aperçu local (object URL) d'une image chargée. */ preview?: string }

const SCANNED_DENSITY_THRESHOLD = 25; // caractères par page en dessous desquels une page est une image scannée
const MAX_VISION_PAGES = 8;           // pages PDF (scannées ou illustrées) envoyées à la vision
const MAX_VISION_MEDIA = 6;           // images d'une présentation ou d'un document Word
const MAX_PDF_PAGES = 400;

// ── Images : réduites dans le navigateur, puis lues par vision (Pixtral) ─────
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob); });
}
/** Réduit une image à VISION_MAX_PX de côté (JPEG), pour rester sous la limite d'une requête. */
export async function downscaleImage(blob: Blob, max = VISION_MAX_PX): Promise<string> {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * k)); canvas.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    let q = 0.86, url = canvas.toDataURL("image/jpeg", q);
    while (url.length > 3_000_000 && q > 0.4) { q -= 0.15; url = canvas.toDataURL("image/jpeg", q); }
    return url;
  } catch {
    return blobToDataUrl(blob); // format que le navigateur ne sait pas décoder : envoyé tel quel
  }
}
async function vision(dataUrl: string, label: string): Promise<string> {
  const { extractTextFromImage } = await import("./atelier-llm");
  return (await extractTextFromImage({ data: { dataUrl, label } })).text;
}

async function renderPdfPage(page: import("pdfjs-dist").PDFPageProxy): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, VISION_MAX_PX / Math.max(base.width, base.height)) });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ── Synthèse progressive des textes longs ─────────────────────────────────
async function progressive(name: string, text: string, onProgress?: (m: string) => void): Promise<{ text: string; partial: boolean; note: string }> {
  const chunks = chunkText(text);
  const { synthesizeChunk } = await import("./doc-extract.functions");
  let summary = "", failed = 0;
  for (const [i, chunk] of chunks.entries()) {
    onProgress?.(`${name} : synthèse ${i + 1}/${chunks.length}`);
    try { const r = await synthesizeChunk({ data: { name, index: i, total: chunks.length, summary, chunk } }); summary = r.summary; if (!r.ok) failed++; } catch { failed++; }
  }
  if (!summary) return { text: text.slice(0, SYNTH_THRESHOLD), partial: true, note: `synthèse indisponible : seuls les ${SYNTH_THRESHOLD.toLocaleString("fr-FR")} premiers caractères sont repris` };
  return { text: `${summary}\n\n[Début du document, tel quel]\n${text.slice(0, 4000)}`, partial: failed > 0, note: `synthèse progressive de ${chunks.length} morceaux${failed ? `, ${failed} non synthétisé(s)` : ""}` };
}

async function signedIn(): Promise<boolean> {
  try { const { supabase } = await import("../../integrations/supabase/client"); return !!(await supabase.auth.getSession()).data.session; } catch { return false; }
}

/** Très gros fichier texte : dépôt par URL signée puis synthèse côté serveur, par plages d'octets. */
async function viaStorage(file: File, onProgress?: (m: string) => void): Promise<{ text: string; partial: boolean; note: string } | null> {
  if (!(await signedIn())) return null;
  try {
    const { supabase } = await import("../../integrations/supabase/client");
    const { createDocUpload, synthesizeStoredChunk, DOCS_BUCKET } = await import("./doc-extract.functions");
    onProgress?.(`${file.name} : dépôt dans le stockage`);
    const { path, token } = await createDocUpload({ data: { name: file.name } });
    const up = await supabase.storage.from(DOCS_BUCKET).uploadToSignedUrl(path, token, file);
    if (up.error) throw up.error;
    const step = 1_000_000, total = Math.ceil(file.size / step);
    let summary = "", failed = 0;
    for (let i = 0; i < total; i++) {
      onProgress?.(`${file.name} : synthèse ${i + 1}/${total}`);
      try { const r = await synthesizeStoredChunk({ data: { path, start: i * step, end: Math.min(file.size, (i + 1) * step), index: i, total, summary } }); summary = r.summary; if (!r.ok) failed++; } catch { failed++; }
    }
    if (!summary) return null;
    return { text: summary, partial: failed > 0, note: `déposé dans le stockage, synthèse de ${total} morceaux${failed ? `, ${failed} non synthétisé(s)` : ""}` };
  } catch { return null; }
}

async function readBytesAsText(file: Blob): Promise<string> { return file.text(); }

// ── Lecture d'un fichier ─────────────────────────────────────────────────
async function extractOne(name: string, blob: Blob, onProgress?: (m: string) => void): Promise<DocResult> {
  const format = formatOf(name), bytes = blob.size;
  const res = (status: DocStatus, text: string, note?: string): DocResult => ({ name, status, text, note, format, bytes });
  const dia = (d: Diagram, note?: string): DocResult => ({ ...res(d.nodes.length || d.texts?.length ? "lu" : "non lisible", d.nodes.length || d.texts?.length ? diagramToText(d, name) : "", note ?? (d.nodes.length ? undefined : "schéma sans élément nommé")), diagram: d });
  try {
    switch (format) {
      case "unsupported": return res("non lisible", "", unsupportedMessage(name));
      case "image": {
        onProgress?.(`${name} : lecture par vision`);
        const t = (await vision(await downscaleImage(blob), name)).trim();
        return t ? res("lu", t, "lu par vision (image réduite à 2 000 px au plus)") : res("non lisible", "", "la vision n'a rien pu lire dans cette image (service indisponible ou image vide)");
      }
      case "pdf": {
        const pdfjsLib = await import("pdfjs-dist");
        const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
        const n = Math.min(pdf.numPages, MAX_PDF_PAGES);
        const pages: string[] = [], visual: number[] = [];
        for (let i = 1; i <= n; i++) {
          onProgress?.(`${name} : page ${i}/${n}`);
          const page = await pdf.getPage(i);
          const t = (await page.getTextContent()).items.map(it => ("str" in it ? it.str : "")).join(" ");
          pages.push(t);
          // Page scannée ou illustrée (schéma, image) : lue aussi par vision.
          const ops = await page.getOperatorList();
          const hasImage = ops.fnArray.some(f => f === pdfjsLib.OPS.paintImageXObject || f === pdfjsLib.OPS.paintInlineImageXObject);
          if (t.replace(/\s/g, "").length < SCANNED_DENSITY_THRESHOLD || hasImage) visual.push(i);
        }
        const out = pages.map((t, i) => `[Page ${i + 1}]\n${t}`);
        let seen = 0;
        for (const i of visual.slice(0, MAX_VISION_PAGES)) {
          onProgress?.(`${name} : vision page ${i}`);
          const v = (await vision(await renderPdfPage(await pdf.getPage(i)), `${name} — page ${i}`)).trim();
          if (v) { out[i - 1] += `\n[Lecture visuelle de la page ${i}]\n${v}`; seen++; }
        }
        const text = out.join("\n\n");
        const notes = [pdf.numPages > n ? `${pdf.numPages - n} page(s) au-delà de ${n} non lues` : "", visual.length > MAX_VISION_PAGES ? `${visual.length - MAX_VISION_PAGES} page(s) illustrée(s) non lues par vision` : "", visual.length && !seen ? "vision indisponible pour les pages illustrées" : ""].filter(Boolean);
        if (!text.replace(/\[Page \d+\]|\s/g, "")) return res("non lisible", "", "PDF sans texte lisible, et la vision n'a rien rendu");
        return finish(res(notes.length ? "partiel" : "lu", text, notes.join(" ; ") || undefined), onProgress);
      }
      case "docx": {
        const mammoth = await import("mammoth");
        const buf = await blob.arrayBuffer();
        const text = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
        const media = await mediaVision(await JSZip.loadAsync(buf), name, onProgress);
        return finish(res(media.skipped ? "partiel" : "lu", [text, media.text].filter(Boolean).join("\n\n"), media.note), onProgress);
      }
      case "pptx": {
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const text = await pptxText(zip);
        const media = await mediaVision(zip, name, onProgress);
        const all = [text, media.text].filter(Boolean).join("\n\n");
        return all ? finish(res(media.skipped ? "partiel" : "lu", all, media.note), onProgress) : res("non lisible", "", "présentation sans texte lisible");
      }
      case "xlsx": {
        const { readXlsx } = await import("../integration/office");
        const { text, truncated } = sheetsToText(await readXlsx(await blob.arrayBuffer()));
        return finish(res(truncated ? "partiel" : "lu", text, truncated ? "2 000 premières lignes par feuille" : undefined), onProgress);
      }
      case "vsdx": return dia(await parseVsdx(await JSZip.loadAsync(await blob.arrayBuffer())));
      case "drawio": return dia(await parseDrawio(await readBytesAsText(blob)));
      case "bpmn": return dia(parseBpmn(await readBytesAsText(blob)));
      case "archimate": return dia(parseArchimate(await readBytesAsText(blob)));
      case "svg": {
        const src = await readBytesAsText(blob);
        const embedded = src.match(/content="([^"]*mxfile[^"]*)"/)?.[1];
        if (embedded) { const x = embedded.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"); return dia(await parseDrawio(x), "modèle draw.io embarqué dans le SVG"); }
        const d = parseSvg(src);
        return d.texts?.length ? res("partiel", diagramToText(d, name), "SVG : seuls les textes sont lus, pas les formes") : res("non lisible", "", "SVG sans texte");
      }
      case "xml": {
        const src = await readBytesAsText(blob), flavor = xmlFlavor(src);
        if (flavor === "bpmn") return dia(parseBpmn(src));
        if (flavor === "archimate") return dia(parseArchimate(src));
        if (flavor === "drawio") return dia(await parseDrawio(src));
        return finish(res("lu", src), onProgress);
      }
      case "json": case "csv": case "text": {
        if (bytes > LARGE_FILE_BYTES) {
          const stored = await viaStorage(blob as File, onProgress);
          if (stored) return res(stored.partial ? "partiel" : "lu", stored.text, stored.note);
        }
        const src = await readBytesAsText(blob);
        return finish(res("lu", format === "json" ? jsonText(src) : src), onProgress);
      }
      case "zip": return res("non lisible", "", "archive imbriquée : décompressez-la d'abord");
    }
  } catch (e) {
    return res("non lisible", "", `lecture impossible : ${(e as Error).message}`);
  }
}

async function mediaVision(zip: JSZip, name: string, onProgress?: (m: string) => void) {
  const media = officeMedia(zip);
  const texts: string[] = [];
  for (const p of media.slice(0, MAX_VISION_MEDIA)) {
    onProgress?.(`${name} : vision ${p.split("/").pop()}`);
    try { const t = (await vision(await downscaleImage(await zip.file(p)!.async("blob")), `${name} — ${p.split("/").pop()}`)).trim(); if (t) texts.push(`[Image ${p.split("/").pop()}]\n${t}`); } catch { /* image ignorée */ }
  }
  const skipped = media.length > MAX_VISION_MEDIA;
  return { text: texts.join("\n\n"), skipped, note: media.length ? `${Math.min(media.length, MAX_VISION_MEDIA)} image(s) lue(s) par vision${skipped ? `, ${media.length - MAX_VISION_MEDIA} non lue(s)` : ""}` : undefined };
}

/** Texte long : synthèse progressive (le texte complet ne part jamais en une seule requête). */
async function finish(r: DocResult, onProgress?: (m: string) => void): Promise<DocResult> {
  if (r.text.length <= SYNTH_THRESHOLD) return r;
  const p = await progressive(r.name, r.text, onProgress);
  return { ...r, text: p.text, status: p.partial || r.status === "partiel" ? "partiel" : "lu", note: [r.note, p.note].filter(Boolean).join(" ; ") };
}

/** Lit plusieurs fichiers, archives .zip comprises (décompressées dans le navigateur). */
export async function extractFiles(files: FileList | File[], onProgress?: (m: string) => void): Promise<DocResult[]> {
  const list = Array.from(files);
  const total = list.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return list.map(f => ({ name: f.name, status: "non lisible" as const, text: "", format: formatOf(f.name), bytes: f.size, note: `chargement refusé : ${(total / 1048576).toFixed(0)} Mo au total, au-delà du garde-fou de 500 Mo. Chargez les fichiers en plusieurs fois.` }));
  }
  const out: DocResult[] = [];
  for (const f of list) {
    if (formatOf(f.name) !== "zip") {
      const r = await extractOne(f.name, f, onProgress);
      if (f.type?.startsWith("image/") && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") { try { r.preview = URL.createObjectURL(f); } catch { /* aperçu indisponible */ } }
      out.push(r); continue;
    }
    try {
      onProgress?.(`${f.name} : décompression`);
      const zip = await JSZip.loadAsync(await f.arrayBuffer());
      const entries = Object.values(zip.files).filter(e => !e.dir && !/(^|\/)(__MACOSX|\.DS_Store)/.test(e.name));
      let unpacked = 0;
      for (const e of entries) {
        const blob = await e.async("blob");
        unpacked += blob.size;
        if (unpacked > MAX_TOTAL_BYTES) { out.push({ name: `${f.name} › ${e.name}`, status: "non lisible", text: "", format: formatOf(e.name), bytes: blob.size, note: "archive décompressée au-delà de 500 Mo : fichiers suivants ignorés" }); break; }
        out.push(await extractOne(`${f.name} › ${e.name}`, blob, onProgress));
      }
      if (!entries.length) out.push({ name: f.name, status: "non lisible", text: "", format: "zip", bytes: f.size, note: "archive vide" });
    } catch (e) {
      out.push({ name: f.name, status: "non lisible", text: "", format: "zip", bytes: f.size, note: `archive illisible : ${(e as Error).message}` });
    }
  }
  return out;
}

/** Compatibilité : texte d'un seul fichier (erreur explicite s'il est illisible). */
export async function extractTextFromFile(file: File): Promise<string> {
  const [r] = await extractFiles([file]);
  if (!r || r.status === "non lisible") throw new Error(r?.note ?? "fichier illisible");
  return r.text;
}
