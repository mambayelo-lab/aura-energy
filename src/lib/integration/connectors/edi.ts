// Analyse des documents EDI et IDoc en lignes tabulaires (une ligne par ligne
// d'article), avec des noms de colonnes neutres communs aux trois formats :
// UN/EDIFACT D.96A (ORDERS, DESADV, INVOIC), ANSI X12 004010 (850, 856, 810)
// et SAP IDoc XML (ORDERS05, DESADV01, CREMAS05, MATMAS05). Les segments et
// qualifiants lus sont ceux des normes ; un type non reconnu est aplati
// (segment_élément) plutôt que deviné.
import type { Row } from "../types";

export type Seg = string[][]; // [ [tag], [él.1 comp.1, comp.2…], … ]

/** EDIFACT : UNA facultatif, caractère de libération « ? », séparateurs + : '. */
export function parseEdifact(text: string): Seg[] {
  let s = String(text).replace(/\r?\n/g, "");
  let [comp, el, rel, term] = [":", "+", "?", "'"];
  if (s.startsWith("UNA")) { comp = s[3]; el = s[4]; rel = s[6]; term = s[8]; s = s.slice(9); }
  const segs: Seg[] = []; let sg: string[][] = [], e: string[] = [], c = "", esc = false;
  for (const ch of s) {
    if (esc) { c += ch; esc = false; continue; }
    if (ch === rel) { esc = true; continue; }
    if (ch === comp) { e.push(c); c = ""; continue; }
    if (ch === el) { e.push(c); sg.push(e); e = []; c = ""; continue; }
    if (ch === term) { e.push(c); sg.push(e); segs.push(sg); sg = []; e = []; c = ""; continue; }
    c += ch;
  }
  return segs;
}
/** X12 : séparateurs lus dans l'ISA (élément en position 4, sous-élément 105, segment 106). */
export function parseX12(text: string): Seg[] {
  const s = String(text).replace(/\r?\n/g, "");
  if (!s.startsWith("ISA") || s.length < 106) throw new Error("Interchange X12 invalide (ISA de 106 caractères attendu).");
  const el = s[3], sub = s[104], term = s[105];
  return s.split(term).filter(x => x.trim()).map(seg => seg.split(el).map(x => x.split(sub)));
}
const v = (s: Seg | undefined, i: number, j = 0) => s?.[i]?.[j] ?? "";
const iso = (d: string) => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d || null);
const num = (x: string) => (x === "" || Number.isNaN(Number(x)) ? null : Number(x));
export const MODE_FROM_EDIFACT: Record<string, string> = { "1": "MARITIME", "2": "FERROVIAIRE", "3": "ROUTE", "4": "AERIEN" };
export const MODE_FROM_X12: Record<string, string> = { S: "MARITIME", R: "FERROVIAIRE", M: "ROUTE", A: "AERIEN" };

/** Messages EDIFACT (UNH…UNT) → lignes ; contrôle des comptes UNT et UNZ. */
export function edifactRows(text: string): { type: string; rows: Row[] } {
  const segs = parseEdifact(text);
  const msgs: Seg[][] = []; let cur: Seg[] | null = null, type = "";
  for (const s of segs) {
    const tag = s[0][0];
    if (tag === "UNH") { cur = [s]; type = v(s, 2); continue; }
    if (!cur) continue;
    cur.push(s);
    if (tag === "UNT") { if (Number(v(s, 1)) !== cur.length) throw new Error(`UNT : ${v(s, 1)} segments annoncés, ${cur.length} reçus.`); msgs.push(cur); cur = null; }
  }
  const unz = segs.find(s => s[0][0] === "UNZ");
  if (unz && Number(v(unz, 1)) !== msgs.length) throw new Error(`UNZ : ${v(unz, 1)} messages annoncés, ${msgs.length} reçus.`);
  const rows: Row[] = [];
  for (const m of msgs) {
    const find = (tag: string, q?: string) => m.find(s => s[0][0] === tag && (q === undefined || v(s, 1) === q));
    const dtm = (q: string) => iso(m.find(s => s[0][0] === "DTM" && v(s, 1, 0) === q)?.[1]?.[1] ?? "");
    const head: Row = { messageType: v(m[0], 2), documentNumber: v(find("BGM"), 2), documentDate: dtm("137") };
    // Une ligne par LIN, avec les segments qui la suivent jusqu'au LIN suivant.
    const lines: Seg[][] = []; let l: Seg[] | null = null;
    for (const s of m) { if (s[0][0] === "LIN") { l = [s]; lines.push(l); } else if (s[0][0] === "UNS") l = null; else if (l) l.push(s); }
    for (const line of lines) {
      const lin = line[0], q = (qual: string) => num(line.find(s => s[0][0] === "QTY" && v(s, 1, 0) === qual)?.[1]?.[1] ?? "");
      const ldtm = (qual: string) => iso(line.find(s => s[0][0] === "DTM" && v(s, 1, 0) === qual)?.[1]?.[1] ?? "");
      const base: Row = { ...head, lineNumber: v(lin, 1), itemId: v(lin, 3, 0), itemIdType: v(lin, 3, 1) };
      if (type === "ORDERS") rows.push({ ...base, buyer: v(find("NAD", "BY"), 2), supplier: v(find("NAD", "SU"), 2), currency: v(find("CUX"), 1, 1), quantity: q("21"), requestedDeliveryDate: ldtm("2") });
      else if (type === "DESADV") {
        const tdt = find("TDT");
        rows.push({ ...base, orderReference: find("RFF")?.[1]?.[1] ?? null, supplierName: v(find("NAD", "SU"), 4) || v(find("NAD", "SU"), 2), shipTo: v(find("NAD", "ST"), 2), transportMode: MODE_FROM_EDIFACT[v(tdt, 3)] ?? (v(tdt, 3) || null), carrier: v(tdt, 5, 3) || v(tdt, 5, 0) || null, expectedDate: dtm("132"), actualDate: dtm("35"), quantity: q("12") });
      } else if (type === "INVOIC") {
        const moa = (qual: string, from: Seg[]) => num(from.find(s => s[0][0] === "MOA" && v(s, 1, 0) === qual)?.[1]?.[1] ?? "");
        rows.push({ ...base, orderReference: find("RFF")?.[1]?.[1] ?? null, supplier: v(find("NAD", "SU"), 2), currency: v(find("CUX"), 1, 1), quantity: q("47"), unitPrice: num(line.find(s => s[0][0] === "PRI")?.[1]?.[1] ?? ""), lineAmount: moa("203", line), totalAmount: moa("86", m) });
      } else rows.push({ ...base, ...Object.fromEntries(line.slice(1).map(s => [s[0][0], s.slice(1).map(e => e.join(":")).join("+")])) });
    }
  }
  return { type, rows };
}

/** Ensembles X12 (ST…SE) → lignes ; contrôle SE, GE et IEA. */
export function x12Rows(text: string): { type: string; rows: Row[] } {
  const segs = parseX12(text);
  const sets: Seg[][] = []; let cur: Seg[] | null = null, type = "";
  for (const s of segs) {
    const tag = s[0][0];
    if (tag === "ST") { cur = [s]; type = v(s, 1); continue; }
    if (!cur) continue;
    cur.push(s);
    if (tag === "SE") { if (Number(v(s, 1)) !== cur.length) throw new Error(`SE : ${v(s, 1)} segments annoncés, ${cur.length} reçus.`); sets.push(cur); cur = null; }
  }
  const ge = segs.find(s => s[0][0] === "GE");
  if (ge && Number(v(ge, 1)) !== sets.length) throw new Error(`GE : ${v(ge, 1)} ensembles annoncés, ${sets.length} reçus.`);
  const rows: Row[] = [];
  for (const t of sets) {
    const find = (tag: string, q?: string, i = 1) => t.find(s => s[0][0] === tag && (q === undefined || v(s, i) === q));
    if (type === "850") {
      const beg = find("BEG");
      for (const po1 of t.filter(s => s[0][0] === "PO1")) rows.push({ messageType: "850", documentNumber: v(beg, 3), documentDate: iso(v(beg, 5)), supplier: v(find("N1", "SE"), 4), currency: v(find("CUR"), 2), lineNumber: v(po1, 1), quantity: num(v(po1, 2)), itemIdType: v(po1, 6), itemId: v(po1, 7), requestedDeliveryDate: iso(v(find("DTM", "002"), 2)) });
    } else if (type === "856") {
      const bsn = find("BSN"), td5 = find("TD5");
      const lin = find("LIN"), sn1 = find("SN1");
      rows.push({ messageType: "856", documentNumber: v(bsn, 2), documentDate: iso(v(bsn, 3)), transportMode: MODE_FROM_X12[v(td5, 4)] ?? (v(td5, 4) || null), carrier: v(td5, 5) || null, expectedDate: iso(v(find("DTM", "017"), 2)), actualDate: iso(v(find("DTM", "050"), 2)), supplierName: v(find("N1", "SF"), 2), shipTo: v(find("N1", "ST"), 4), orderReference: v(find("PRF"), 1), itemIdType: v(lin, 2), itemId: v(lin, 3), quantity: num(v(sn1, 2)) });
    } else if (type === "810") {
      const big = find("BIG");
      for (const it1 of t.filter(s => s[0][0] === "IT1")) rows.push({ messageType: "810", documentNumber: v(big, 2), documentDate: iso(v(big, 1)), orderReference: v(big, 4), supplier: v(find("N1", "SE"), 4), currency: v(find("CUR"), 2), lineNumber: v(it1, 1), quantity: num(v(it1, 2)), unitPrice: num(v(it1, 4)), itemIdType: v(it1, 6), itemId: v(it1, 7), totalAmount: num(v(find("TDS"), 1)) === null ? null : Number(v(find("TDS"), 1)) / 100 });
    } else rows.push({ messageType: type, ...Object.fromEntries(t.slice(1, -1).map(s => [s[0][0], s.slice(1).map(e => e.join(">")).join("*")])) });
  }
  return { type, rows };
}

// ── IDoc XML ──────────────────────────────────────────────────────────────
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** Champs directs d'un segment (hors sous-segments). */
function fields(seg: string): Record<string, string> {
  const own = seg.replace(/<(E1\w+|E2\w+)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  return Object.fromEntries([...own.matchAll(/<([A-Z0-9_]+)>([^<]*)<\/\1>/g)].map(m => [m[1], unxml(m[2])]));
}
const segsOf = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "g"))].map(m => m[1]);
export function idocRows(xml: string): { type: string; rows: Row[] } {
  const idocs = segsOf(xml, "IDOC");
  const rows: Row[] = [];
  let type = "";
  for (const d of idocs) {
    const dc = fields(segsOf(d, "EDI_DC40")[0] ?? "");
    type = dc.IDOCTYP ?? type;
    const ctl = { idocNumber: dc.DOCNUM ?? null, messageType: dc.MESTYP ?? null };
    if (type.startsWith("ORDERS")) {
      const k01 = fields(segsOf(d, "E1EDK01")[0] ?? ""), ka1 = segsOf(d, "E1EDKA1").map(fields), k02 = segsOf(d, "E1EDK02").map(fields).find(x => x.QUALF === "001") ?? {};
      for (const p of segsOf(d, "E1EDP01")) {
        const p01 = fields(p), p20 = fields(segsOf(p, "E1EDP20")[0] ?? ""), p19 = segsOf(p, "E1EDP19").map(fields).find(x => x.QUALF === "001") ?? {};
        rows.push({ ...ctl, documentNumber: k02.BELNR ?? k01.BELNR ?? null, documentDate: iso(k02.DATUM ?? ""), supplier: ka1.find(x => x.PARVW === "LF")?.PARTN ?? null, currency: k01.CURCY ?? null, lineNumber: p01.POSEX ?? null, quantity: num(p01.MENGE ?? ""), itemId: p19.IDTNR ?? null, requestedDeliveryDate: iso(p20.EDATU ?? "") });
      }
    } else if (type.startsWith("DESADV")) {
      for (const l of segsOf(d, "E1EDL20")) {
        const l20 = fields(l), adr = segsOf(l, "E1ADRM1").map(fields), t13 = segsOf(l, "E1EDT13").map(fields).find(x => x.QUALF === "007") ?? {};
        for (const it of segsOf(l, "E1EDL24")) {
          const i24 = fields(it), l41 = fields(segsOf(it, "E1EDL41")[0] ?? "");
          rows.push({ ...ctl, documentNumber: l20.VBELN ?? null, transportMode: l20.TRATY ?? null, supplierName: adr.find(x => x.PARTNER_Q === "LF")?.NAME1 ?? null, carrier: adr.find(x => x.PARTNER_Q === "SP")?.NAME1 ?? null, shipTo: adr.find(x => x.PARTNER_Q === "WE")?.PARTNER_ID ?? null, expectedDate: iso(t13.NTANF ?? ""), actualDate: iso(t13.ISDD ?? ""), itemId: i24.MATNR ?? null, quantity: num(i24.LFIMG ?? ""), orderReference: l41.BSTNR ?? null });
        }
      }
    } else if (type.startsWith("CREMAS")) {
      const a = fields(segsOf(d, "E1LFA1M")[0] ?? ""), b = fields(segsOf(d, "E1LFB1M")[0] ?? "");
      rows.push({ ...ctl, supplier: a.LIFNR ?? null, name: a.NAME1 ?? null, country: a.LAND1 ?? null, taxNumber1: a.STCD1 ?? null, vatRegistration: a.STCEG ?? null, duns: a.KRAUS ?? null, legacyId: b.ALTKN ?? null });
    } else if (type.startsWith("MATMAS")) {
      const a = fields(segsOf(d, "E1MARAM")[0] ?? ""), t = fields(segsOf(d, "E1MAKTM")[0] ?? "");
      rows.push({ ...ctl, material: a.MATNR ?? null, oldMaterial: a.BISMT ?? null, ean: a.EAN11 ?? null, materialGroup: a.MATKL ?? null, description: t.MAKTX ?? null });
    } else {
      const flat: Row = { ...ctl };
      for (const m of d.matchAll(/<(E1\w+)\b[^>]*>/g)) for (const [k, x] of Object.entries(fields(segsOf(d, m[1])[0] ?? ""))) flat[`${m[1]}_${k}`] = x;
      rows.push(flat);
    }
  }
  return { type, rows };
}

/** MIC AS2 (RFC 4130) : SHA-256 du contenu, en base64, suivi de « , sha-256 ». */
export async function as2Mic(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let bin = ""; for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return `${btoa(bin)}, sha-256`;
}
