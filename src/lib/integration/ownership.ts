// ACV Master/Consumer par attribut : pour chaque attribut d'objet métier, une seule
// application maître et des consommatrices, validées par l'architecte. Par défaut,
// l'attribut hérite du maître du domaine. Contrôle « golden record » : deux sources
// qui donnent des valeurs différentes pour le même id_or sont signalées.
import { normName } from "./normalize";
import type { Domain } from "./crosswalk";

/** Tolérance d'écart par attribut : exact, forme (casse, forme juridique), ±N %, ±N jours. */
export type Tolerance = { kind: "exact" } | { kind: "forme" } | { kind: "pct"; value: number } | { kind: "days"; value: number };

export interface AttributeOwnership {
  domain: Domain;
  attribute: string;
  tolerance?: Tolerance;
  /** Application maître (hérite du maître du domaine si absente). */
  master?: string;
  consumers: string[];
  validated: boolean;
  validatedBy?: string;
  validatedAt?: string;
}

export interface Acv { domainMasters: Record<Domain, string>; attributes: AttributeOwnership[] }

export function masterOf(acv: Acv, domain: Domain, attribute: string): { system: string; inherited: boolean } {
  const a = acv.attributes.find(x => x.domain === domain && x.attribute === attribute);
  return a?.master ? { system: a.master, inherited: false } : { system: acv.domainMasters[domain], inherited: true };
}

/** Noms d'attributs partagés avec le questionnaire. */
export const ATTR = { supplierName: "Nom fournisseur", supplierCountry: "Pays", productRef: "SKU (référence interne)", productEan: "EAN / GTIN", siteCode: "Code site" } as const;

/** Une ACV valide : un seul maître par attribut, jamais consommateur de lui-même. */
export function validateAcv(acv: Acv): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const a of acv.attributes) {
    const k = `${a.domain}.${a.attribute}`;
    if (seen.has(k)) errors.push(`Attribut ${k} déclaré deux fois : un seul maître par attribut.`);
    seen.add(k);
    const m = a.master ?? acv.domainMasters[a.domain];
    if (a.consumers.includes(m)) errors.push(`${k} : ${m} ne peut pas être à la fois maître et consommateur.`);
  }
  return errors;
}

export interface ObservedValue { idOr: string; domain: Domain; attribute: string; system: string; value: unknown }
export interface Divergence {
  idOr: string; domain: Domain; attribute: string;
  master: { system: string; value: string };
  others: { system: string; value: string }[];
  /** « forme » : même valeur une fois normalisée (casse, forme juridique) ; « fond » : valeurs réellement différentes. */
  kind: "forme" | "fond";
}

const canon = (attribute: string, v: unknown) => (/name|nom|raison/i.test(attribute) ? normName(v) : String(v ?? "").trim().toUpperCase().replace(/[\s._-]/g, ""));

/** La valeur d'une autre source est-elle acceptable face à celle du maître ? */
export function withinTolerance(t: Tolerance, attribute: string, master: unknown, other: unknown): boolean {
  const a = String(master ?? "").trim(), b = String(other ?? "").trim();
  if (a === b) return true;
  switch (t.kind) {
    case "exact": return false;
    case "forme": return canon(attribute, a) === canon(attribute, b);
    case "pct": { const x = Number(a), y = Number(b); return Number.isFinite(x) && Number.isFinite(y) && Math.abs(y - x) <= (Math.abs(x) * t.value) / 100; }
    case "days": { const x = Date.parse(a), y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) && Math.abs(y - x) <= t.value * 86400_000; }
  }
}

export function detectDivergences(acv: Acv, observed: ObservedValue[]): Divergence[] {
  const groups = new Map<string, ObservedValue[]>();
  for (const o of observed) {
    if (o.value == null || o.value === "") continue;
    const k = `${o.domain}|${o.attribute}|${o.idOr}`;
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const out: Divergence[] = [];
  for (const list of groups.values()) {
    const { domain, attribute, idOr } = list[0];
    const { system: masterSystem } = masterOf(acv, domain, attribute);
    const master = list.find(o => o.system === masterSystem) ?? list[0];
    const tol = acv.attributes.find(a => a.domain === domain && a.attribute === attribute)?.tolerance ?? { kind: "exact" };
    const seen = new Set<string>();
    const others = list.filter(o => o !== master && !withinTolerance(tol, attribute, master.value, o.value) && !seen.has(`${o.system}|${o.value}`) && seen.add(`${o.system}|${o.value}`));
    if (!others.length) continue;
    const fond = others.some(o => canon(attribute, o.value) !== canon(attribute, master.value));
    out.push({ idOr, domain, attribute, master: { system: master.system, value: String(master.value) }, others: others.map(o => ({ system: o.system, value: String(o.value) })), kind: fond ? "fond" : "forme" });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "fond" ? -1 : 1));
}

/** ACV proposée par le modèle Maison Lucie (à valider par l'architecte). */
export function defaultAcv(masters: { supplier: string; product: string; site: string }, consumers: { supplier: string[]; product: string[]; site: string[] }): Acv {
  const attr = (domain: Domain, attribute: string, tolerance: Tolerance): AttributeOwnership => ({ domain, attribute, consumers: consumers[domain].filter(c => c !== masters[domain]), validated: false, tolerance });
  return {
    domainMasters: masters,
    attributes: [
      attr("supplier", ATTR.supplierName, { kind: "forme" }), attr("supplier", ATTR.supplierCountry, { kind: "exact" }),
      attr("product", ATTR.productRef, { kind: "forme" }), attr("product", ATTR.productEan, { kind: "exact" }),
      attr("site", ATTR.siteCode, { kind: "forme" }),
    ],
  };
}

export const ACV_TOLERANCE_LABEL: Record<Tolerance["kind"], string> = { exact: "exacte", forme: "forme (casse, forme juridique)", pct: "± %", days: "± jours" };
