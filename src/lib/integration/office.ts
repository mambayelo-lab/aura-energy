// Écriture et lecture minimales de classeurs Excel (.xlsx) et export Word (.docx),
// sans dépendance lourde : JSZip + XML OpenXML. Suffisant pour le questionnaire.
import JSZip from "jszip";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

export interface SheetSpec {
  name: string;
  rows: (string | number | null)[][];
  /** Index de la ligne d'en-tête (gras, fond, filtre) ; lignes antérieures = notice. */
  headerRow?: number;
  widths?: number[];
}

export async function writeXlsx(sheets: SheetSpec[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Styles : 0 normal, 1 en-tête (gras, fond), 2 notice (italique, retour à la ligne), 3 cellule à remplir (retour à la ligne).
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF3B3F5C"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4B3FA8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf><xf fontId="2" applyFont="1"><alignment wrapText="0"/></xf><xf applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>`);
  sheets.forEach((s, i) => {
    const h = s.headerRow ?? 0;
    const cols = s.widths?.length ? `<cols>${s.widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === null || v === undefined || v === "") return "";
      const ref = `${colName(ci)}${ri + 1}`, style = ri === h ? 1 : ri < h ? 2 : 3;
      return typeof v === "number" ? `<c r="${ref}" s="${style}"><v>${v}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
    }).join("")}</row>`).join("");
    const width = Math.max(1, ...s.rows.map(r => r.length));
    const filter = s.rows.length > h + 1 ? `<autoFilter ref="A${h + 1}:${colName(width - 1)}${s.rows.length}"/>` : "";
    const pane = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${h + 1}" topLeftCell="A${h + 2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData>${filter}</worksheet>`);
  });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unesc(m[1])).join("");
const colIndex = (ref: string) => { const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A"; return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1; };

/** Lit toutes les feuilles d'un .xlsx (chaînes partagées, chaînes en ligne, nombres). */
export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<{ name: string; rows: string[][] }[]> {
  const zip = await JSZip.loadAsync(data);
  const shared = await zip.file("xl/sharedStrings.xml")?.async("string");
  const strings = shared ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1])) : [];
  const wb = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const rels = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";
  const target = new Map([...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(m => [m[1], m[2].replace(/^\/?xl\//, "")]));
  const out: { name: string; rows: string[][] }[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)) {
    const xml = await zip.file(`xl/${target.get(m[2]) ?? ""}`)?.async("string");
    if (!xml) continue;
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = r[1].match(/\br="(\d+)"/)?.[1];
      const idx = rn ? Number(rn) - 1 : rows.length;
      const row: string[] = [];
      for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], body = c[2] ?? "";
        const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
        const type = attrs.match(/t="([^"]+)"/)?.[1];
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        const value = type === "s" ? strings[Number(v)] ?? "" : type === "inlineStr" ? texts(body) : v !== undefined ? unesc(v) : "";
        row[ref ? colIndex(ref) : row.length] = value;
      }
      rows[idx] = Array.from(row, x => x ?? "");
    }
    out.push({ name: unesc(m[1]), rows: Array.from(rows, r => r ?? []) });
  }
  return out;
}

/** CSV (séparateur , ou ;) → lignes. */
export function readCsv(text: string): string[][] {
  const sep = (text.split(/\r?\n/)[0].match(/;/g)?.length ?? 0) > (text.split(/\r?\n/)[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Document Word : titre, paragraphes de notice et tableaux. */
export async function writeDocx(title: string, paragraphs: string[], tables: { title: string; rows: string[][] }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const run = (t: string, opts: { b?: boolean; sz?: number } = {}) => `<w:r><w:rPr>${opts.b ? "<w:b/>" : ""}<w:sz w:val="${opts.sz ?? 18}"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  const p = (t: string, opts: { b?: boolean; sz?: number } = {}) => `<w:p>${run(t, opts)}</w:p>`;
  const table = (rows: string[][]) => `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(b => `<w:${b} w:val="single" w:sz="4" w:color="A0A0B0"/>`).join("")}</w:tblBorders></w:tblPr>${rows.map((r, i) => `<w:tr>${r.map(c => `<w:tc><w:p>${run(c || (i ? " " : ""), { b: i === 0, sz: 14 })}</w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  const body = [p(title, { b: true, sz: 32 }), ...paragraphs.map(t => p(t)), ...tables.flatMap(t => [p(t.title, { b: true, sz: 24 }), table(t.rows), p("")])].join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
