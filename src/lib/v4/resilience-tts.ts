// Résilience par nœud : Time-to-Survive (TTS) et Time-to-Recover (TTR), d'après
// Simchi-Levi (HBR, 2014 ; Interfaces, 2015).
// RÈGLE : Aura ne calcule rien. Le TTS, le TTR, la couverture, le CA à risque,
// la rupture projetée et la prochaine réception sont LUS dans le SI (APS, MRP)
// par site, via l'objet « Position planifiée ». Aura applique des règles
// causales : comparaisons à des seuils (SI TTR lu > TTS lu ALORS nœud critique).
// Une valeur absente reste absente : « donnée non fournie par le SI ».
import type { ArgusVocab } from "./argus-vocab-store";
import type { CatalogueAlert } from "./alert-catalogue";
import { ASIA as ASIA_ZONE, CHOKEPOINT, isMapped, normKey, num, readAll, readObject, skuResolver, str } from "./supply-data";

/** Compatibilité : lecture d'un objet par son attribut clé (voir supply-data.ts). Plus aucune colonne de repli. */
export function readEntity(v: ArgusVocab, entityId: string, keyAttr: string) {
  const r = readObject(v, entityId, keyAttr);
  return { rows: r.rows, sources: r.sources, unmapped: [] as string[] };
}

export const NON_FOURNI = "donnée non fournie par le SI";
export type TtrStatut = "lu";
/** Valeurs lues pour un article sur un site (APS, MRP). */
export interface PositionLue { site: string; couverture?: number; tts?: number; ttr?: number; caRisque?: number; rupture?: string; reception?: string }
export type Gravite = "critique" | "majeure" | "mineure";
export interface ArticleNode {
  sku: string; designation: string;
  fournisseurId?: string; fournisseurNom?: string; pays?: string; alternatif?: string;
  sites: string[];
  positions: PositionLue[];
  /** TTS lu au site le plus exposé (plus petit TTS lu : sélection, pas calcul). */
  tts?: number;
  /** Site dont le TTS lu est le plus court. */
  siteCritique?: string;
  /** Couverture lue au site le plus exposé. */
  couverture?: number;
  ttr?: number; ttrStatut?: TtrStatut; ttrDetail: string;
  /** Règle causale : TTR lu > TTS lu (au moins un site). */
  critique: boolean;
  /** CA à risque lu dans le SI pour le site le plus exposé (jamais calculé). */
  caRisque?: number;
  /** Gravité ordinale : critique (TTR > TTS), majeure (TTS lu sous le seuil court), mineure. */
  gravite: Gravite;
}
export interface AggregateNode {
  id: string; nom: string; kind: "fournisseur" | "site"; pays?: string;
  /** Nombre de références et de nœuds critiques (dénombrement, pas un calcul d'exposition). */
  articles: number; critiques: number; ttsMin?: number; ttrMax?: number;
}
export interface ResilienceHypotheses {
  /** TTS lu en dessous duquel un article est « majeur » (seuil de règle, jours). */
  ttsCourtJours: number;
}
export const DEFAULT_HYPOTHESES: ResilienceHypotheses = { ttsCourtJours: 14 };

export interface ResilienceResult {
  articles: ArticleNode[]; fournisseurs: AggregateNode[]; sites: AggregateNode[];
  sources: string[]; nonMappes: string[]; lecture?: string;
  /** Rien à lire : aucune position planifiée (TTS, couverture) fournie par le SI. */
  vide: boolean;
}

const GRAVITE_RANK: Record<Gravite, number> = { critique: 0, majeure: 1, mineure: 2 };

export function computeResilience(v: ArgusVocab | undefined, hyp: ResilienceHypotheses = DEFAULT_HYPOTHESES): ResilienceResult {
  const empty: ResilienceResult = { articles: [], fournisseurs: [], sites: [], sources: [], nonMappes: [], vide: true };
  if (!v) return empty;
  const resolve = skuResolver(v);
  const pos = readAll(v, "sc-position", "sku");
  if (!pos.rows.length) return empty;
  const art = readObject(v, "sc-article", "sku");
  const four = readObject(v, "sc-fournisseur", "id");
  const site = readObject(v, "sc-site", "id");
  const src = readObject(v, "sc-source", "sku", ["sku", "fournisseur"]);
  const sources = [...pos.sources, ...art.sources, ...four.sources, ...src.sources];
  const supplier = (id?: string) => four.rows.find(r => r.id !== undefined && id !== undefined && normKey(r.id) === normKey(id));
  const srcBySku = new Map<string, typeof src.rows>();
  for (const r of src.rows) { const k = resolve(r.sku); if (!k || r.bloquee === "true") continue; srcBySku.set(k, [...(srcBySku.get(k) ?? []), r]); }
  const bySku = new Map<string, PositionLue[]>();
  for (const r of pos.rows) {
    const sku = resolve(r.sku) ?? r.sku; if (!sku) continue;
    bySku.set(sku, [...(bySku.get(sku) ?? []), { site: r.site ?? "", couverture: num(r.couverture), tts: num(r.tts), ttr: num(r.ttr), caRisque: num(r.caRisque), rupture: str(r.rupture), reception: str(r.reception) }]);
  }
  const artBySku = new Map(art.rows.filter(r => r.sku).map(r => [normKey(r.sku), r]));
  const articles: ArticleNode[] = [];
  for (const [sku, positions] of bySku) {
    const a = artBySku.get(normKey(sku)) ?? {};
    const approved = srcBySku.get(sku) ?? [];
    const fixed = approved.find(x => x.fixe === "true") ?? (approved.length === 1 ? approved[0] : undefined);
    const fid = fixed?.fournisseur ?? a.fournisseur; const f = supplier(fid);
    const altSrc = approved.find(x => x !== fixed && x.fournisseur && (!fid || normKey(x.fournisseur) !== normKey(fid)));
    const alt = a.alternatif ?? altSrc?.fournisseur;
    // Site le plus exposé : celui dont le TTS lu est le plus court (tri de valeurs lues).
    const worst = [...positions].filter(p => p.tts !== undefined).sort((x, y) => x.tts! - y.tts!)[0];
    const ttrLu = worst?.ttr ?? positions.find(p => p.ttr !== undefined)?.ttr ?? num(a.ttr);
    const ttrDetail = ttrLu !== undefined ? `Délai de reprise lu dans ${worst?.ttr !== undefined ? pos.sources[0] ?? "le SI" : "la fiche article"}.` : `Délai de reprise : ${NON_FOURNI}.`;
    const critique = positions.some(p => p.tts !== undefined && (p.ttr ?? ttrLu) !== undefined && (p.ttr ?? ttrLu)! > p.tts);
    const gravite: Gravite = critique ? "critique" : worst && worst.tts! < hyp.ttsCourtJours ? "majeure" : "mineure";
    articles.push({
      sku, designation: a.designation ?? sku, fournisseurId: fid, fournisseurNom: f?.nom ?? fid, pays: f?.pays, alternatif: alt ? supplier(alt)?.nom ?? alt : undefined,
      sites: positions.map(p => p.site).filter(Boolean), positions,
      tts: worst?.tts, siteCritique: worst?.site, couverture: worst?.couverture, ttr: ttrLu, ttrStatut: ttrLu !== undefined ? "lu" : undefined, ttrDetail,
      critique, caRisque: worst?.caRisque, gravite,
    });
  }
  // Tri ordinal : gravité de la règle, puis TTS lu le plus court.
  articles.sort((x, y) => GRAVITE_RANK[x.gravite] - GRAVITE_RANK[y.gravite] || (x.tts ?? 1e9) - (y.tts ?? 1e9));

  const group = (kind: "fournisseur" | "site", keyOf: (a: ArticleNode) => string[], label: (id: string) => { nom: string; pays?: string }, ttsOf: (a: ArticleNode, k: string) => number | undefined, critOf: (a: ArticleNode, k: string) => boolean) => {
    const m = new Map<string, ArticleNode[]>();
    for (const a of articles) for (const k of keyOf(a)) { if (!k) continue; m.set(k, [...(m.get(k) ?? []), a]); }
    return [...m].map(([id, list]): AggregateNode => {
      const tts = list.map(a => ttsOf(a, id)).filter((x): x is number => x !== undefined);
      const ttr = list.map(a => a.ttr).filter((x): x is number => x !== undefined);
      return { id, kind, ...label(id), articles: list.length, critiques: list.filter(a => critOf(a, id)).length, ttsMin: tts.length ? Math.min(...tts) : undefined, ttrMax: ttr.length ? Math.max(...ttr) : undefined };
    }).sort((a, b) => b.critiques - a.critiques || (a.ttsMin ?? 1e9) - (b.ttsMin ?? 1e9));
  };
  const fournisseurs = group("fournisseur", a => [a.fournisseurId ?? ""], id => ({ nom: supplier(id)?.nom ?? id, pays: supplier(id)?.pays }), a => a.tts, a => a.critique);
  // Sites : valeurs lues position par position (TTS du site face au TTR lu).
  const posOf = (a: ArticleNode, s: string) => a.positions.find(p => p.site === s);
  const sites = group("site", a => [...new Set(a.sites)], id => { const s = site.rows.find(r => r.id === id); return { nom: s?.nom ?? id, pays: s?.pays }; }, (a, s) => posOf(a, s)?.tts, (a, s) => { const p = posOf(a, s); const r = p?.ttr ?? a.ttr; return p?.tts !== undefined && r !== undefined && r > p.tts; });
  const lecture = (v.siTables ?? []).map(t => t.fetchedAt).sort().pop();
  // Rien de lu (ni TTS, ni TTR, ni couverture) : vue vide, jamais une valeur calculée.
  const vide = !articles.some(a => a.positions.some(p => p.tts !== undefined || p.ttr !== undefined || p.couverture !== undefined));
  return { articles, fournisseurs, sites, vide, lecture, sources: [...new Set(sources)], nonMappes: [] };
}

// ── Scénario d'arrêt (qualitatif) ───────────────────────────────────────────
// On choisit un fournisseur, un port ou un détroit et une durée d'arrêt. Les
// règles montrent quels articles sont exposés : SI TTS lu < durée de l'arrêt
// ALORS l'article rompt avant la fin de l'arrêt. Aucun montant n'est calculé.
export type ArretKind = "fournisseur" | "port" | "detroit";
export const ARRET_KINDS: { id: ArretKind; label: string }[] = [
  { id: "fournisseur", label: "Un fournisseur s'arrête" }, { id: "port", label: "Un port est fermé" }, { id: "detroit", label: "Un détroit est fermé" },
];
export const DETROITS: { id: string; label: string; re: RegExp }[] = [
  { id: "suez", label: "Suez, mer Rouge, Bab el-Mandeb", re: /\b(EGSUZ|EGPSD|YEADE|DJJIB)\b|suez|mer rouge|red sea|bab.?el.?mandeb/i },
  { id: "ormuz", label: "Ormuz", re: /\bOMSOH\b|ormuz|hormuz/i },
];
export interface ArretParams { kind: ArretKind; cible: string; dureeJours: number }
export type ArretStatut = "exposé" | "tient" | "non fourni";
export interface ArretLigne { article: ArticleNode; statut: ArretStatut }
export interface ArretResult { kind: ArretKind; cible: string; cibleLabel: string; duree: number; lignes: ArretLigne[]; exposes: ArretLigne[]; perimetre: string; regle: string }

/** Ports lus dans les escales et les perturbations (UN/LOCODE). */
export function portsLus(v: ArgusVocab | undefined): string[] {
  if (!v) return [];
  const out = new Set<string>();
  for (const r of readAll(v, "sc-etape", "expedition").rows) if (r.lieu && !CHOKEPOINT.test(r.lieu)) out.add(r.lieu);
  for (const r of readAll(v, "sc-perturbation", "lieu").rows) if (r.lieu) out.add(r.lieu);
  return [...out].sort();
}

/** Articles dont une expédition ouverte passe par un lieu (escale, origine ou destination), ou dont le fournisseur y expédie. */
function articlesVia(v: ArgusVocab, test: (lieu: string) => boolean): { skus: Set<string>; fournisseurs: Set<string> } {
  const resolve = skuResolver(v);
  const via = new Set<string>();
  for (const r of readAll(v, "sc-etape", "expedition").rows) if (r.expedition && test(r.lieu ?? "")) via.add(normKey(r.expedition));
  const exp = readObject(v, "sc-expedition", "id");
  for (const r of exp.rows) if (r.id && test(`${r.origine ?? ""} ${r.destination ?? ""}`)) via.add(normKey(r.id));
  const po = new Map(readObject(v, "sc-commande", "id").rows.filter(r => r.id).map(r => [normKey(r.id), r]));
  const skus = new Set<string>(), fournisseurs = new Set<string>();
  for (const r of exp.rows) if (r.id && via.has(normKey(r.id))) {
    const k = resolve(r.article); if (k) skus.add(k);
    const c = r.commande ? po.get(normKey(r.commande)) : undefined;
    if (c?.fournisseur) fournisseurs.add(normKey(c.fournisseur)); const ck = resolve(c?.sku); if (ck) skus.add(ck);
  }
  return { skus, fournisseurs };
}

export function scenarioArret(res: ResilienceResult, p: ArretParams, v?: ArgusVocab): ArretResult {
  let touched: ArticleNode[] = [], cibleLabel = p.cible, perimetre = "";
  if (p.kind === "fournisseur") {
    touched = res.articles.filter(a => a.fournisseurId && normKey(a.fournisseurId) === normKey(p.cible));
    cibleLabel = res.fournisseurs.find(f => f.id === p.cible)?.nom ?? p.cible;
    perimetre = `Articles dont ${cibleLabel} est la source principale (liste de sources).`;
  } else if (v) {
    const d = DETROITS.find(x => x.id === p.cible);
    const test = p.kind === "detroit" ? (l: string) => (d?.re ?? CHOKEPOINT).test(l) : (l: string) => normKey(l).includes(normKey(p.cible));
    const hit = articlesVia(v, test);
    touched = res.articles.filter(a => hit.skus.has(a.sku) || (a.fournisseurId && hit.fournisseurs.has(normKey(a.fournisseurId))) || (p.kind === "detroit" && p.cible === "suez" && a.pays !== undefined && ASIA_ZONE.has(a.pays)));
    cibleLabel = p.kind === "detroit" ? d?.label ?? p.cible : p.cible;
    perimetre = p.kind === "detroit" ? `Articles dont une expédition passe par ${cibleLabel}${p.cible === "suez" ? ", ou dont le fournisseur est en Asie" : ""} (escales lues dans le TMS).` : `Articles dont une expédition ouverte passe par le port ${cibleLabel} (escales lues dans le TMS).`;
  }
  const lignes: ArretLigne[] = touched.map(a => ({ article: a, statut: a.tts === undefined ? "non fourni" : a.tts < p.dureeJours ? "exposé" : "tient" }));
  const rank: Record<ArretStatut, number> = { "exposé": 0, "non fourni": 1, tient: 2 };
  lignes.sort((x, y) => rank[x.statut] - rank[y.statut] || (x.article.tts ?? 1e9) - (y.article.tts ?? 1e9));
  return { kind: p.kind, cible: p.cible, cibleLabel, duree: p.dureeJours, lignes, exposes: lignes.filter(l => l.statut === "exposé"), perimetre, regle: `SI le délai de survie lu (TTS) < ${p.dureeJours} j ALORS l'article rompt avant la fin de l'arrêt.` };
}

// ── Signaux de crise sanitaire (pic de demande, amplification, rupture, absentéisme) ──
export interface SignauxSanitaires {
  picDemande?: { sku: string; pct: number };
  amplification?: { sku: string; ratio: number };
  ruptures: number; positions: number;
  absenteisme?: number;
  sources: string[];
}
/**
 * Lecture « crise sanitaire » des données : pic de demande (prévision promue vs
 * baseline), amplification des commandes (commandes ouvertes rapportées à la
 * demande sur le délai, indicateur approché de l'effet coup de fouet), positions
 * sous le stock de sécurité ; l'absentéisme n'est lu que si une source le fournit.
 */
export function signauxSanitaires(v: ArgusVocab | undefined, res: ResilienceResult): SignauxSanitaires {
  const out: SignauxSanitaires = { ruptures: 0, positions: 0, sources: [] };
  if (!v) return out;
  // Pic de demande et coup de fouet : lus dans l'outil de planification (Aura ne calcule ni variance ni pourcentage).
  const sig = readAll(v, "sc-signal", "sku");
  const best = (k: "pic" | "bullwhip") => sig.rows.filter(r => r.sku && num(r[k]) !== undefined).sort((x, y) => num(y[k])! - num(x[k])!)[0];
  const p = best("pic"), b = best("bullwhip");
  if (p) { out.picDemande = { sku: p.sku!, pct: num(p.pic)! }; out.sources.push(`${sig.sources.join(", ")} (pic de demande lu)`); }
  if (b) { out.amplification = { sku: b.sku!, ratio: num(b.bullwhip)! }; out.sources.push(`${sig.sources.join(", ")} (ratio coup de fouet lu)`); }
  // Ruptures : positions dont le disponible passe sous le stock de sécurité (attributs du stock).
  const st = readObject(v, "sc-stock", "sku", ["sku", "site"]);
  if (st.rows.length && isMapped(v, "sc-stock", "securite") && isMapped(v, "sc-stock", "dispo")) {
    out.positions = st.rows.length;
    out.ruptures = st.rows.filter(r => { const d = num(r.dispo), s = num(r.securite); return d !== undefined && s !== undefined && d < s; }).length;
    out.sources.push(`${st.sources[0]} (disponible < stock de sécurité)`);
  }
  // Absentéisme : attribut branché (SIRH, WFM) ; absent sinon.
  const abs = readAll(v, "sc-absence", "taux");
  const vals = abs.rows.map(r => num(r.taux)).filter((x): x is number => x !== undefined);
  if (vals.length) { out.absenteisme = Math.max(...vals); out.sources.push(`${abs.sources.join(", ")} (taux d'absentéisme)`); }
  return out;
}
export const signalSanitaireActif = (s: SignauxSanitaires) => (s.picDemande?.pct ?? 0) >= 30 || (s.amplification?.ratio ?? 0) >= 1.5;

// ── Maturité (sensing, seizing, reconfiguring : capacités dynamiques, Sáenz et al.) ──
export interface MaturiteAxe { id: "sensing" | "seizing" | "reconfiguring"; label: string; niveau: 0 | 1 | 2 | 3 | 4; preuve: string }
export const NIVEAUX_MATURITE = ["Non évalué", "Données", "Visibilité", "Décision assistée", "Décision autonome bornée"] as const;
/** Maturité digitale lue sur l'état réel d'Aura (sources, fraîcheur, décisions, TTR), pas sur une déclaration. */
export function maturite(v: ArgusVocab | undefined, res: ResilienceResult, decisions: number, rulesTriggered: number): MaturiteAxe[] {
  const tables = (v?.siTables ?? []).length;
  const ageH = res.lecture ? (Date.now() - Date.parse(res.lecture)) / 3_600_000 : undefined;
  const sensing: MaturiteAxe["niveau"] = tables === 0 ? 0 : !res.articles.length ? 1 : ageH !== undefined && ageH < 24 ? 3 : 2;
  const seizing: MaturiteAxe["niveau"] = !rulesTriggered && !decisions ? (tables ? 1 : 0) : decisions ? 3 : 2;
  const withAlt = res.articles.filter(a => a.alternatif).length;
  const declared = res.articles.filter(a => a.ttrStatut === "lu").length;
  const reconfiguring: MaturiteAxe["niveau"] = !res.articles.length ? 0 : declared > 0 && withAlt / res.articles.length >= 0.8 ? 3 : withAlt / res.articles.length >= 0.5 ? 2 : 1;
  return [
    { id: "sensing", label: "Détecter", niveau: sensing, preuve: tables ? `${tables} tables SI lues${ageH !== undefined ? `, dernière lecture il y a ${Math.round(ageH)} h` : ""}` : "aucune source connectée" },
    { id: "seizing", label: "Décider", niveau: seizing, preuve: `${rulesTriggered} alerte(s) évaluée(s) sur les données, ${decisions} décision(s) Supply tracée(s)` },
    { id: "reconfiguring", label: "Reconfigurer", niveau: reconfiguring, preuve: res.articles.length ? `${withAlt} référence(s) sur ${res.articles.length} avec une source alternative, ${declared} TTR lu(s) dans le SI` : "aucune référence lue" },
  ];
}

// ── Alertes du cockpit ──────────────────────────────────────────────────────
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
/** Options de décision d'un nœud critique (premier levier du profil « Nœud critique »). */
export const OPTIONS_NOEUD = ["Qualifier une source alternative", "Tampon égal à l'écart TTR − TTS", "Accord de capacité avec la source alternative"];
export const OPTIONS_PANDEMIE = ["Double sourcing dans une autre région", "Stock tampon là où TTR > TTS", "Plafonnement et allocation des commandes"];

/**
 * Alertes issues de la résilience : une par nœud critique (TTR > TTS, trois au
 * plus, les plus exposés), et un signal « crise sanitaire » quand les données
 * montrent un pic de demande ou une amplification des commandes. Le délai
 * avant rupture (TTS) est porté par l'alerte pour trier le cockpit.
 */
export function resilienceAlerts(v: ArgusVocab | undefined, hyp: ResilienceHypotheses = DEFAULT_HYPOTHESES): CatalogueAlert[] {
  const res = computeResilience(v, hyp);
  if (res.vide) return [];
  // Articles à source unique : portés par RES-UNIQUE (même règle TTR > TTS), pas dupliqués ici.
  const out: CatalogueAlert[] = res.articles.filter(a => a.critique && a.alternatif).slice(0, 3).map(a => {
    const src = res.sources[0] ?? "SI";
    const fields: Record<string, string | number> = { TTS_jours: a.tts ?? NON_FOURNI, TTR_jours: a.ttr ?? NON_FOURNI, site: a.siteCritique ?? "—", ca_a_risque_eur: a.caRisque ?? NON_FOURNI, fournisseur: a.fournisseurNom ?? "—" };
    return {
      id: `RES-TTS-${a.sku}`, label: `Nœud critique : ${a.designation} (${a.sku}) tient ${a.tts} j, il en faut ${a.ttr} pour le remplacer`,
      sector: "supply-chain",
      signal: `Délai de survie lu ${a.tts} j < délai de reprise lu ${a.ttr} j (site ${a.siteCritique ?? "—"}) ; source ${res.sources.slice(0, 3).join(", ")}.`,
      decisionQuestion: `Comment ramener le délai de reprise de ${a.sku} sous son délai de survie ?`,
      options: OPTIONS_NOEUD, recurrence: "à chaque lecture des sources",
      severity: a.gravite === "critique" ? "critique" : "majeure",
      siteLabelExemple: `${a.fournisseurNom ?? "fournisseur inconnu"}${a.pays ? ` (${a.pays})` : ""}`,
      expositionExempleEur: a.caRisque ?? 0, ...(a.caRisque ? { exposition: { eur: a.caRisque, what: `CA à risque lu (site ${a.siteCritique ?? "—"})`, source: src } } : {}), delaiAvantImpactExemple: a.tts !== undefined ? `${a.tts} j` : "",
      causes: [`Délai de survie lu : ${a.tts} j (site ${a.siteCritique ?? "—"})`, a.ttrDetail, `CA à risque : ${a.caRisque !== undefined ? eur(a.caRisque) : NON_FOURNI}`],
      causalRule: { condition: "SI le délai de reprise lu (TTR) dépasse le délai de survie lu (TTS)", consequence: "ALORS le nœud rompt avant d'être remplacé : décider d'une protection" },
      variables: ["TTS", "TTR", "CA à risque"],
      grounded: { sourceRecord: `${src} — ${a.sku}`, realFields: fields },
    };
  });
  const s = signauxSanitaires(v, res);
  if (signalSanitaireActif(s)) {
    const tts = res.articles.map(a => a.tts).filter((x): x is number => x !== undefined);
    out.push({
      id: "RES-PANDEMIE", label: "Pic de demande et commandes amplifiées : tester la réponse à une crise sanitaire",
      sector: "supply-chain",
      signal: `${s.picDemande ? `Pic de +${s.picDemande.pct} % sur ${s.picDemande.sku}` : ""}${s.amplification ? `, ratio coup de fouet lu ${s.amplification.ratio.toLocaleString("fr-FR")} sur ${s.amplification.sku}` : ""}, ${s.ruptures} position(s) sous le stock de sécurité (${s.sources.join(" ; ")}).`,
      decisionQuestion: "Comment tenir le service si une crise sanitaire amplifie ce pic et ferme une zone de production ?",
      options: OPTIONS_PANDEMIE, recurrence: "à chaque lecture des sources", severity: "majeure",
      siteLabelExemple: s.picDemande?.sku ?? "", expositionExempleEur: 0,
      delaiAvantImpactExemple: tts.length ? `${Math.min(...tts)} j` : "",
      causes: [s.picDemande ? `Pic de demande : +${s.picDemande.pct} % (${s.picDemande.sku})` : "Pic de demande non lu", s.amplification ? `Amplification : ${s.amplification.ratio} (${s.amplification.sku})` : "Amplification non lue", `Ruptures : ${s.ruptures} sur ${s.positions}`, s.absenteisme !== undefined ? `Absentéisme : ${s.absenteisme} %` : "Absentéisme : aucune source"],
      causalRule: { condition: "SI la demande bondit et les commandes s'amplifient le long de la chaîne", consequence: "ALORS préparer la réponse : sources, stock stratégique, plafonnement, équipes" },
      variables: ["Pic de demande", "Amplification des commandes", "Ruptures", "Absentéisme"],
      grounded: { sourceRecord: s.sources.join(" ; "), realFields: { pic_demande_pct: s.picDemande?.pct ?? "—", amplification: s.amplification?.ratio ?? "—", ruptures: s.ruptures, positions: s.positions } },
    });
  }
  return out;
}
/** Jours avant impact lus dans une alerte (« 12,5 j »), pour trier à gravité égale. */
export const joursAvantImpact = (a: Pick<CatalogueAlert, "delaiAvantImpactExemple">) => { const m = a.delaiAvantImpactExemple?.match(/(\d+(?:[.,]\d+)?)\s*j/); return m ? Number(m[1].replace(",", ".")) : Number.POSITIVE_INFINITY; };
