// Normalisation des clés métier pour le rapprochement inter-sources.
// Chaque fonction renvoie la forme canonique, ou null si la valeur est invalide.

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const compact = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** SIRET : 14 chiffres. */
export function normSiret(v: unknown): string | null {
  const d = digits(v);
  return d.length === 14 ? d : null;
}
/** SIREN : 9 chiffres, tirés d'un SIREN, d'un SIRET ou d'une TVA FR. */
export function normSiren(v: unknown): string | null {
  const c = compact(v);
  if (/^FR[0-9A-Z]{2}\d{9}$/.test(c)) return c.slice(4);
  const d = digits(v);
  if (d.length === 14 || d.length === 9) return d.slice(0, 9);
  return null;
}
/** Clé de TVA FR : (12 + 3 × (SIREN mod 97)) mod 97. */
export function frVatKey(siren: string): string {
  return String((12 + 3 * (Number(siren) % 97)) % 97).padStart(2, "0");
}
/** TVA intracommunautaire : majuscules sans séparateurs ; clé contrôlée pour la France. */
export function normVat(v: unknown): string | null {
  const c = compact(v);
  if (!/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(c)) return null;
  if (c.startsWith("FR")) {
    if (!/^FR[0-9A-Z]{2}\d{9}$/.test(c)) return null;
    const key = c.slice(2, 4), siren = c.slice(4);
    if (/^\d\d$/.test(key) && key !== frVatKey(siren)) return null;
  }
  return c;
}
/** TVA FR reconstruite depuis un SIREN/SIRET. */
export function vatFromSiren(v: unknown): string | null {
  const s = normSiren(v);
  return s ? `FR${frVatKey(s)}${s}` : null;
}
/** DUNS : 9 chiffres (tirets et espaces ignorés). */
export function normDuns(v: unknown): string | null {
  const d = digits(v);
  return d.length === 9 ? d : null;
}
function gtinCheckOk(d: string): boolean {
  const body = d.slice(0, -1), check = Number(d.at(-1));
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === check;
}
/** EAN/GTIN : ramené en EAN-13 (GTIN-14 à zéro de tête, UPC-A 12 chiffres), clé de contrôle vérifiée. */
export function normEan(v: unknown): string | null {
  let d = digits(v);
  if (d.length === 14 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12) d = `0${d}`;
  if (d.length === 8 || d.length === 13 || d.length === 14) return gtinCheckOk(d) ? d : null;
  return null;
}
/** Référence fabricant / interne : majuscules, espaces et casse neutralisés. */
export function normRef(v: unknown): string | null {
  const s = String(v ?? "").trim().toUpperCase().replace(/\s+/g, "-").replace(/_/g, "-");
  return s ? s : null;
}
/** Code site : alphanumérique compact (WH-PAR, WHPAR, wh_par → WHPAR). */
export function normSite(v: unknown): string | null {
  const c = compact(v);
  return c ? c : null;
}
/** Commande d'achat : chiffres significatifs (PO-4500000001 → 4500000001). */
export function normPo(v: unknown): string | null {
  const d = digits(v).replace(/^0+/, "");
  return d ? d : null;
}

const LEGAL = /\b(sas|sasu|sarl|sa|spa|s\.p\.a|srl|gmbh|ag|ab|ltd|limited|inc|co|company|llc|bv|nv|oy|as|plc|sl)\b/g;
/** Raison sociale : minuscules, sans accents, formes juridiques ni ponctuation. */
export function normName(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(LEGAL, " ").replace(/\s+/g, " ").trim();
}

/** Similarité Jaro-Winkler (0..1). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false), bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++; }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < 4 && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}
/** Recouvrement de trigrammes (Dice). */
export function trigramDice(a: string, b: string): number {
  const grams = (s: string) => { const g = new Map<string, number>(); const p = `  ${s} `; for (let i = 0; i < p.length - 2; i++) { const t = p.slice(i, i + 3); g.set(t, (g.get(t) ?? 0) + 1); } return g; };
  const ga = grams(a), gb = grams(b);
  let inter = 0, total = 0;
  for (const [t, n] of ga) { inter += Math.min(n, gb.get(t) ?? 0); total += n; }
  for (const n of gb.values()) total += n;
  return total ? (2 * inter) / total : 0;
}
/** Score de ressemblance de deux raisons sociales (0..1). */
export function nameScore(a: unknown, b: unknown): number {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  return Math.round((0.5 * jaroWinkler(x, y) + 0.5 * trigramDice(x, y)) * 1000) / 1000;
}
