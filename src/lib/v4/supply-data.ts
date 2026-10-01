// Lecture des objets de l'ontologie Supply à partir des tables SI lues et des
// correspondances validées (Studio, questionnaire, mapping avec score). Aucun
// nom de colonne n'est écrit ici : une valeur n'existe que si l'attribut de
// l'objet est branché sur une colonne. Les jointures entre tables passent par
// les attributs clés branchés dans chacune (ex. « Article » branché sur
// PIM.internalRef et sur SAP.Material), jamais par un nom de colonne supposé.
import type { AppField, ArgusVocab } from "./argus-vocab-store";

const clean = (n: string) => n.replace(/\s*\(.*\)$/, "");
export const tableOf = (f: AppField) => f.liveTable ?? clean(f.name).split(".").slice(0, -1).join(".");
export const columnOf = (f: AppField) => clean(f.name).split(".").pop() ?? f.name;
export const num = (v: unknown) => { if (v === undefined || v === null || v === "") return undefined; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : undefined; };
export const str = (v: unknown) => (v === undefined || v === null || v === "" || v === "null" ? undefined : String(v));

type Snap = NonNullable<ArgusVocab["siTables"]>[number];
export interface ObjectRead { rows: Record<string, string | undefined>[]; sources: string[]; mapped: string[] }

function snapOf(v: ArgusVocab, f: AppField): Snap | undefined {
  const app = v.apps.find(a => a.id === f.appId);
  if (app && app.enabled === false) return undefined;
  return (v.siTables ?? []).find(t => t.appId === f.appId && t.table === tableOf(f) && t.columns.includes(columnOf(f)));
}

/**
 * Enregistrements d'un objet : la table qui porte l'attribut clé (maître de
 * préférence) donne les lignes ; les attributs branchés dans d'autres tables y
 * sont joints par les attributs clés (`joinOn`) branchés dans ces tables aussi.
 * `keys` : attributs de jointure, du plus fort au plus faible (ex. ["sku", "fournisseur"]).
 */
export function readObject(v: ArgusVocab, entityId: string, keyAttr: string, joinOn: string[] = [keyAttr]): ObjectRead {
  const maps = (v.entityMappings ?? []).filter(m => m.entityId === entityId);
  // Colonnes d'un attribut : maître d'abord, puis la lecture la plus complète (un échantillon de profilage
  // de quelques lignes ne masque pas la lecture complète de la même source).
  const rowsOf = (f: AppField) => snapOf(v, f)?.rows.length ?? 0;
  const fieldsOf = (attr: string) => maps.filter(x => x.attributeId === `${entityId}.${attr}`).map(m => ({ m, f: v.fields.find(f => f.id === m.fieldId) })).filter((x): x is { m: typeof maps[number]; f: AppField } => !!x.f)
    .sort((a, b) => Number(b.m.isMaster) - Number(a.m.isMaster) || rowsOf(b.f) - rowsOf(a.f)).map(x => x.f);
  const keyField = fieldsOf(keyAttr).find(f => snapOf(v, f));
  const main = keyField ? snapOf(v, keyField) : undefined;
  if (!keyField || !main) return { rows: [], sources: [], mapped: [] };
  const appLabel = (id: string) => v.apps.find(a => a.id === id)?.label?.split(" · ")[0] ?? id;
  const sources = new Set<string>([`${appLabel(main.appId)} · ${main.table}`]);
  // Colonne d'un attribut dans une table donnée (si l'attribut y est branché).
  const colIn = (attr: string, snap: Snap) => fieldsOf(attr).find(f => snapOf(v, f) === snap);
  const cols: { attr: string; snap: Snap; col: string; join?: { main: string; other: string }[] }[] = [];
  const attrs = [...new Set(maps.map(m => m.attributeId.slice(entityId.length + 1)))];
  for (const attr of attrs) {
    const candidates = fieldsOf(attr);
    const same = candidates.find(f => snapOf(v, f) === main);
    if (same) { cols.push({ attr, snap: main, col: columnOf(same) }); continue; }
    for (const f of candidates) {
      const snap = snapOf(v, f); if (!snap) continue;
      let join = joinOn.flatMap(k => { const a = colIn(k, main), b = colIn(k, snap); return a && b ? [{ main: columnOf(a), other: columnOf(b) }] : []; });
      // Clé non branchée dans l'autre table : jointure sur la même colonne d'identifiant (même nom des deux côtés).
      if (!join.length && joinOn.length) { const kc = columnOf(keyField); if (snap.columns.includes(kc)) join = [{ main: kc, other: kc }]; }
      if (!join.length) continue;
      cols.push({ attr, snap, col: columnOf(f), join });
      sources.add(`${appLabel(snap.appId)} · ${snap.table}`);
      break;
    }
  }
  // Index des tables jointes (clé composite) pour éviter un parcours par ligne.
  const indexes = new Map<string, Map<string, Record<string, string>>>();
  const idx = (c: (typeof cols)[number]) => {
    const k = `${c.snap.appId}|${c.snap.table}|${c.join!.map(j => j.other).join(",")}`;
    let m = indexes.get(k);
    if (!m) { m = new Map(); for (const r of c.snap.rows) { const key = c.join!.map(j => normKey(r[j.other])).join("|"); if (!m.has(key)) m.set(key, r); } indexes.set(k, m); }
    return m;
  };
  const rows = main.rows.map(r => {
    const out: Record<string, string | undefined> = {};
    for (const c of cols) {
      const src = c.join ? idx(c).get(c.join.map(j => normKey(r[j.main])).join("|")) : r;
      out[c.attr] = str(src?.[c.col]);
    }
    return out;
  });
  return { rows, sources: [...sources], mapped: cols.map(c => c.attr) };
}

/** Clé de jointure : casse et espaces ignorés ; GTIN-14 ramené à l'EAN-13 ; préfixe « PO- » d'une commande ignoré. */
export function normKey(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  if (/^0\d{13}$/.test(s)) return s.slice(1);
  if (/^PO-?\d{6,}$/.test(s)) return s.replace(/^PO-?/, "");
  return s;
}

/** Toutes les lignes de la table qui porte `attr` (objets à plusieurs lignes par clé : historiques, étapes). */
export function readAll(v: ArgusVocab, entityId: string, attr: string): ObjectRead {
  return readObject(v, entityId, attr, []);
}

/** L'attribut est-il branché (au moins une colonne lue) ? */
export const isMapped = (v: ArgusVocab, entityId: string, attr: string) =>
  (v.entityMappings ?? []).some(m => m.entityId === entityId && m.attributeId === `${entityId}.${attr}` && v.fields.some(f => f.id === m.fieldId && snapOf(v, f)));

/**
 * Résolution des références article : une valeur lue dans une autre source
 * (GTIN-14 du WMS, EAN du lac, référence en minuscules de l'OMS) est ramenée
 * au SKU de l'article par les attributs branchés « SKU » et « EAN / GTIN ».
 */
export function skuResolver(v: ArgusVocab): (raw: string | undefined) => string | undefined {
  const art = readObject(v, "sc-article", "sku");
  const bySku = new Map<string, string>(), byEan = new Map<string, string>();
  for (const r of art.rows) { if (!r.sku) continue; bySku.set(normKey(r.sku), r.sku); if (r.ean) byEan.set(normKey(r.ean), r.sku); }
  return raw => { if (!raw) return undefined; const k = normKey(raw); return bySku.get(k) ?? byEan.get(k) ?? (bySku.size ? undefined : raw); };
}

export const ASIA = new Set(["CN", "HK", "TW", "VN", "IN", "KR", "JP", "TH", "BD", "ID", "MY", "PK", "LK", "PH", "SG", "KH", "MM"]);
/** Points de passage obligés lus dans les escales (UN/LOCODE) ou un libellé de route. */
export const CHOKEPOINT = /\b(EGSUZ|EGPSD|YEADE|DJJIB|OMSOH)\b|suez|mer rouge|red sea|bab.?el.?mandeb|ormuz|hormuz/i;
