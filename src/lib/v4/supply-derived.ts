// Tables de règles d'Aura, construites à partir des objets de l'ontologie
// branchés (jamais d'un nom de colonne). RÈGLE : Aura ne calcule rien. Chaque
// table reprend des valeurs LUES dans le SI (couverture, TTS/TTR, CA à risque,
// dates de rupture, de réception, de confirmation, délais planifiés et réels)
// et le résultat de comparaisons à des seuils (SI → ALORS). Aucun montant
// n'est dérivé (donnée × hypothèse), aucune couverture n'est divisée, aucune
// probabilité ni agrégat en euros n'est produit. Une valeur absente reste
// absente : « donnée non fournie par le SI ».
import type { ArgusVocab, AppField, CausalRule, CausalRuleEvaluation, KpiDef, MappingDef, RuleSeverity, SiTableSnapshot } from "./argus-vocab-store";
import { computeResilience, DEFAULT_HYPOTHESES, NON_FOURNI, type ResilienceResult } from "./resilience-tts";
import { ASIA, CHOKEPOINT, normKey, num, readAll, readObject, skuResolver } from "./supply-data";

export const DERIVED_APP = "aura-derive";
export interface DerivedParams {
  asOf: string;
  /** TTS lu en dessous duquel une attente au port devient critique (jours). */
  ttsCourt: number;
}
/** Seuils de règles par défaut, affichés et réglables dans le Studio (jamais des faits). */
export const HYPOTHESES_A_CONFIRMER = [
  "Écart TTR − TTS d'alerte (source unique) : 7 jours",
  "Couverture lue au-delà de laquelle le stock est excédentaire : 120 jours",
  "Écart d'alerte entre délai réel et délai planifié (paramètres MRP) : 5 jours",
] as const;
export const DEFAULT_DERIVED: DerivedParams = { asOf: new Date().toISOString().slice(0, 10), ttsCourt: 90 };

type Row = Record<string, string | number | null>;
interface Table { name: string; label: string; rows: Row[]; sources: string[] }
const days = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 86_400_000;
/** 1 si la condition de la règle est vraie, 0 sinon (résultat d'une comparaison, pas un calcul). */
const flag = (b: boolean) => (b ? 1 : 0);

/** Tables de règles (une par règle) à partir des objets branchés. */
export function deriveTables(v: ArgusVocab, p: DerivedParams = DEFAULT_DERIVED): { tables: Table[]; res: ResilienceResult } {
  const res = computeResilience(v, DEFAULT_HYPOTHESES);
  const resolve = skuResolver(v);
  const tables: Table[] = [];
  const four = readObject(v, "sc-fournisseur", "id");
  const supName = (id?: string | null) => (id ? four.rows.find(r => r.id && normKey(r.id) === normKey(id))?.nom ?? id : "");
  const supCountry = (id?: string | null) => (id ? four.rows.find(r => r.id && normKey(r.id) === normKey(id))?.pays : undefined);
  const src = readObject(v, "sc-source", "sku", ["sku", "fournisseur"]);

  // Positions par site : valeurs lues (couverture, TTS, TTR, CA à risque, rupture projetée, prochaine réception).
  const allPositions = res.articles.flatMap(a => a.positions.map(x => ({ sku: a.sku, siteId: x.site, description: a.designation, couvertureJours: x.couverture ?? null, caRisqueEur: x.caRisque ?? null, ruptureProjetee: x.rupture ?? null, prochaineReception: x.reception ?? null })));
  // Table compacte (stockage navigateur) : positions dont la couverture est lue, colonnes utiles aux règles seulement.
  const positions = allPositions.filter(x => x.couvertureJours !== null).map(({ sku, siteId, couvertureJours, caRisqueEur }) => ({ sku, siteId, couvertureJours, caRisqueEur }));
  if (positions.length) tables.push({ name: "Positions", label: "Positions lues par article et site", rows: positions, sources: res.sources });
  // Articles : valeurs lues au site le plus exposé.
  const articles = res.articles.map(a => ({ sku: a.sku, description: a.designation, supplierId: a.fournisseurId ?? null, siteCritique: a.siteCritique ?? null, couvertureJours: a.couverture ?? null, ttsJours: a.tts ?? null, ttrJours: a.ttr ?? null, caRisqueEur: a.caRisque ?? null, gravite: a.gravite }));
  if (articles.length) tables.push({ name: "Articles", label: "Valeurs lues au site le plus exposé", rows: articles, sources: res.sources });

  // Source unique et TTR lu > TTS lu (écart = comparaison des deux valeurs lues).
  const approved = new Map<string, Set<string>>();
  for (const r of src.rows) { const k = resolve(r.sku); if (k && r.fournisseur && r.bloquee !== "true") approved.set(k, new Set([...(approved.get(k) ?? []), normKey(r.fournisseur)])); }
  if (src.rows.length) tables.push({ name: "SourceUnique", label: "Articles à source unique", sources: [...src.sources, ...res.sources], rows: res.articles.filter(a => approved.get(a.sku)?.size === 1 && a.tts !== undefined && a.ttr !== undefined).map(a => ({ sku: a.sku, description: a.designation, supplierId: a.fournisseurId ?? null, siteId: a.siteCritique ?? null, ttsJours: a.tts!, ttrJours: a.ttr!, ecartJours: Math.round((a.ttr! - a.tts!) * 10) / 10, caRisqueEur: a.caRisque ?? null })) });

  // Durabilité et autonomie stratégique : classe ABC lue et nombre de sources actives lues (article A mono-source).
  const art = readObject(v, "sc-article", "sku");
  const artA = art.rows.filter(r => r.sku && /^a$/i.test(r.abc ?? ""));
  if (artA.length && src.rows.length) tables.push({ name: "MonoSourceA", label: "Articles de classe A et sources actives", sources: [...art.sources, ...src.sources], rows: artA.map(r => { const k = resolve(r.sku) ?? r.sku!, n = approved.get(k)?.size ?? 0; return { sku: k, description: r.designation ?? "", sourcesActives: n, monoSource: flag(n === 1) }; }) });
  // Concentration pays : part lue dans l'analyse des dépenses ; à défaut, famille dont toutes les sources lues sont dans un seul pays.
  const conc = readAll(v, "sc-concentration", "famille");
  if (conc.rows.some(r => r.pays && (num(r.part) !== undefined || num(r.sources) !== undefined))) {
    const paysDe = new Map<string, number>(); for (const r of conc.rows) if (r.famille && r.pays && (num(r.part) ?? num(r.sources) ?? 0) > 0) paysDe.set(r.famille, (paysDe.get(r.famille) ?? 0) + 1);
    tables.push({ name: "ConcentrationPays", label: "Part des achats par famille et pays (lue)", sources: conc.sources, rows: conc.rows.filter(r => r.famille && r.pays).map(r => ({ famille: r.famille!, pays: r.pays!, partPct: num(r.part) ?? (paysDe.get(r.famille!) === 1 ? 100 : null), sourcesActives: num(r.sources) ?? null })).filter(r => r.partPct !== null) });
  }
  // EUDR : produit de base visé lu, référence DDS ou géolocalisation absente.
  const eudr = readAll(v, "sc-eudr", "sku");
  if (eudr.rows.some(r => r.matiere)) tables.push({ name: "Eudr", label: "Articles EUDR et déclaration de diligence raisonnable", sources: eudr.sources, rows: eudr.rows.filter(r => r.sku && r.matiere && !/^(non|aucun|none|-)$/i.test(r.matiere)).map(r => ({ sku: resolve(r.sku) ?? r.sku!, supplierId: r.fournisseur ?? null, supplier: supName(r.fournisseur), matiere: r.matiere!, dds: r.dds ?? "absente", sansDds: flag(!r.dds || /^(false|0|non)$/i.test(r.geoloc ?? "")) })) });
  // CBAM : cumul annuel lu dans l'outil douane, comparé au seuil de minimis (50 t).
  const cbam = readAll(v, "sc-cbam", "code");
  if (cbam.rows.some(r => num(r.cumul) !== undefined)) tables.push({ name: "Cbam", label: "Cumul annuel des biens CBAM (lu)", sources: cbam.sources, rows: cbam.rows.filter(r => r.code && num(r.cumul) !== undefined).map(r => ({ codeNc: r.code!, masseT: num(r.masse) ?? null, cumulT: num(r.cumul)!, seuilT: num(r.seuil) ?? 50 })) });

  // Rupture projetée (lue) avant la prochaine réception (lue).
  const rupt = allPositions.filter(x => x.ruptureProjetee && x.prochaineReception).map(x => ({ sku: x.sku, siteId: x.siteId, description: x.description, ruptureProjetee: x.ruptureProjetee, prochaineReception: x.prochaineReception, avantReception: flag(x.ruptureProjetee! < x.prochaineReception!), caRisqueEur: x.caRisqueEur }));
  if (rupt.length) tables.push({ name: "RuptureProjetee", label: "Rupture projetée avant la prochaine réception", rows: rupt, sources: res.sources });

  // Promesse client : date de disponibilité confirmée (ATP) postérieure à la date promise, ou absente.
  const atp = readAll(v, "sc-promesse", "ligne");
  if (atp.rows.some(r => r.promise)) tables.push({ name: "PromesseClient", label: "Promesses clients menacées", sources: atp.sources, rows: atp.rows.filter(r => r.ligne && r.promise).map(r => ({ orderId: r.ligne!, sku: resolve(r.sku) ?? r.sku ?? "", siteId: r.site ?? "", datePromise: r.promise!, dateDisponible: r.dispo ?? NON_FOURNI, menacee: flag(!r.dispo || r.dispo > r.promise!) })) });

  // Commandes fournisseur : non confirmées, ou confirmées après la date de besoin (SAP EKES).
  const conf = readAll(v, "sc-confirmation", "commande");
  if (conf.rows.some(r => r.besoin)) tables.push({ name: "ConfirmationsFournisseur", label: "Commandes fournisseur non confirmées ou en retard", sources: conf.sources, rows: conf.rows.filter(r => r.commande && r.besoin).map(r => ({ purchaseOrderId: r.commande!, sku: resolve(r.sku) ?? r.sku ?? "", supplierId: r.fournisseur ?? null, supplier: supName(r.fournisseur), dateBesoin: r.besoin!, dateConfirmee: r.confirmee ?? "non confirmée", enRisque: flag(!r.confirmee || r.confirmee > r.besoin!) })) });

  // Paramètres MRP obsolètes : délai réel médian lu comparé au délai planifié lu.
  const mrp = readAll(v, "sc-parametre", "sku");
  if (mrp.rows.some(r => num(r.planifie) !== undefined && num(r.reel) !== undefined)) tables.push({ name: "ParametresMRP", label: "Délais planifiés et délais réels lus", sources: mrp.sources, rows: mrp.rows.filter(r => r.sku && num(r.planifie) !== undefined && num(r.reel) !== undefined).map(r => ({ sku: resolve(r.sku) ?? r.sku!, supplierId: r.fournisseur ?? null, supplier: supName(r.fournisseur), delaiPlanifieJours: num(r.planifie)!, delaiReelJours: num(r.reel)!, ecartJours: num(r.reel)! - num(r.planifie)! })) });

  // Exposition géographique : articles critiques (TTR lu > TTS lu) dont le fournisseur est en Asie ou expédie par un détroit.
  const via = new Set<string>();
  for (const r of readAll(v, "sc-etape", "expedition").rows) if (r.expedition && CHOKEPOINT.test(r.lieu ?? "")) via.add(normKey(r.expedition));
  const exp = readObject(v, "sc-expedition", "id");
  const po = readObject(v, "sc-commande", "id");
  const poSup = new Map(po.rows.filter(r => r.id && r.fournisseur).map(r => [normKey(r.id), normKey(r.fournisseur!)]));
  const viaSup = new Set(exp.rows.filter(r => r.id && via.has(normKey(r.id)) && r.commande).map(r => poSup.get(normKey(r.commande!))).filter((x): x is string => !!x));
  const expo = res.articles.filter(a => a.fournisseurId && (ASIA.has(supCountry(a.fournisseurId) ?? "") || viaSup.has(normKey(a.fournisseurId))));
  if (expo.length) tables.push({ name: "ExpositionGeo", label: "Articles critiques exposés à une zone ou un détroit", sources: [...res.sources, ...exp.sources], rows: [...new Set(expo.map(a => a.fournisseurId!))].map(s => { const l = expo.filter(a => a.fournisseurId === s); return { supplierId: s, supplier: supName(s), pays: supCountry(s) ?? "", articlesCritiques: l.filter(a => a.critique).length, articles: l.length }; }) });

  // Effet coup de fouet : ratio lu dans l'outil de planification (Aura ne calcule pas de variance).
  const sig = readAll(v, "sc-signal", "sku");
  if (sig.rows.some(r => num(r.bullwhip) !== undefined)) tables.push({ name: "CoupDeFouet", label: "Amplification des commandes (ratio lu)", sources: sig.sources, rows: sig.rows.filter(r => r.sku && num(r.bullwhip) !== undefined).map(r => ({ sku: resolve(r.sku) ?? r.sku!, ratio: num(r.bullwhip)! })) });

  // Défaillance financière : hausse du score de risque financier lu (première → dernière évaluation).
  const ev = readAll(v, "sc-evaluation", "fournisseur");
  if (ev.rows.length) {
    const fin = new Map<string, { d: string; s: number }[]>();
    for (const r of ev.rows) { const s = num(r.score); if (r.fournisseur && s !== undefined && r.date && /financ/i.test(r.categorie ?? "")) fin.set(r.fournisseur, [...(fin.get(r.fournisseur) ?? []), { d: r.date, s }]); }
    const rows = [...fin].map(([s, l]) => { l.sort((a, b) => a.d.localeCompare(b.d)); return { supplierId: s, supplier: supName(s), risqueFinancier: l.at(-1)!.s, hausse: l.at(-1)!.s - l[0].s, evaluations: l.length, depuis: l[0].d }; }).filter(r => r.evaluations >= 2);
    if (rows.length) tables.push({ name: "RisqueFinancier", label: "Risque financier des fournisseurs", rows, sources: ev.sources });
  }

  // Qualité : part de lots refusés lue dans l'outil qualité (QMS).
  const lots = readObject(v, "sc-controle", "id");
  const qual = readAll(v, "sc-qualite", "fournisseur");
  if (qual.rows.some(r => num(r.tauxRefus) !== undefined)) tables.push({ name: "QualiteLots", label: "Lots refusés (part lue dans le QMS)", sources: qual.sources, rows: qual.rows.filter(r => r.fournisseur && num(r.tauxRefus) !== undefined).map(r => ({ supplierId: r.fournisseur!, supplier: supName(r.fournisseur), tauxRefusPct: num(r.tauxRefus)! })) });
  const certs = readAll(v, "sc-certificat", "fournisseur");
  if (certs.rows.some(r => r.fin)) tables.push({ name: "Certificats", label: "Échéance des certificats fournisseurs", sources: certs.sources, rows: certs.rows.filter(r => r.fournisseur && r.fin).map(r => ({ supplierId: r.fournisseur!, supplier: supName(r.fournisseur), type: r.type ?? "", fin: r.fin!, joursRestants: Math.round(days(r.fin!, p.asOf)) })) });

  // Congestion portuaire ou grève : attente au port d'arrivée d'expéditions ouvertes dont l'article a un TTS lu court.
  const events = readAll(v, "sc-perturbation", "lieu").rows.filter(e => e.lieu && (num(e.retard) ?? 0) > 0 && (!e.fin || e.fin >= p.asOf) && (!e.debut || e.debut <= p.asOf) && /congest|strike|greve|grève|port/i.test(`${e.type ?? ""} ${e.titre ?? ""}`));
  if (events.length) {
    const stages = readAll(v, "sc-etape", "expedition").rows;
    const lastPort = new Map<string, string>();
    for (const s of stages) if (s.expedition && s.lieu && !s.reelle) lastPort.set(normKey(s.expedition), s.lieu);
    const ttsOf = new Map(res.articles.map(a => [a.sku, a]));
    const rows: Row[] = [];
    for (const e of events) {
      const ships = exp.rows.filter(s => s.id && !s.reelle && (lastPort.get(normKey(s.id)) === e.lieu));
      const hit = ships.map(s => ({ s, a: ttsOf.get(resolve(s.article) ?? "") })).filter(x => x.a?.tts !== undefined && x.a.tts <= p.ttsCourt);
      if (!hit.length) continue;
      rows.push({ port: e.lieu!, evenement: e.type ?? "", attenteJours: num(e.retard)!, expeditions: hit.length, ttsMinJours: Math.min(...hit.map(x => x.a!.tts!)) });
    }
    if (rows.length) tables.push({ name: "Ports", label: "Attente aux ports et TTS lu", rows, sources: [...readAll(v, "sc-perturbation", "lieu").sources, ...exp.sources] });
  }

  // Rappel : lot refusé au contrôle déjà livré à des clients (traçabilité lue).
  const del = readObject(v, "sc-livraison", "id");
  if (lots.rows.length && del.rows.some(r => r.lot)) {
    const refused = new Map(lots.rows.filter(l => l.lot && /^r|refus|reject/i.test(l.decision ?? "")).map(l => [normKey(l.lot), l]));
    const cust = new Map(readObject(v, "sc-commande-client", "id").rows.filter(r => r.id).map(r => [normKey(r.id), r.client]));
    const by = new Map<string, { clients: Set<string>; lignes: number; sku?: string; sup?: string }>();
    for (const d of del.rows) { const l = d.lot ? refused.get(normKey(d.lot)) : undefined; if (!l) continue; const x = by.get(d.lot!) ?? { clients: new Set<string>(), lignes: 0, sku: resolve(d.sku) ?? resolve(l.sku), sup: l.fournisseur }; const c = d.ligne ? cust.get(normKey(d.ligne)) : undefined; if (c) x.clients.add(c); x.lignes++; by.set(d.lot!, x); }
    const rows = [...by].map(([lot, x]) => ({ lot, sku: x.sku ?? "", supplierId: x.sup ?? null, clients: x.clients.size, livraisons: x.lignes }));
    if (rows.length) tables.push({ name: "Rappels", label: "Lots refusés déjà livrés", rows, sources: [...lots.sources, ...del.sources] });
  }

  // Devoir de vigilance : fournisseur actif sans évaluation ESG, score ESG lu élevé ou certificat environnemental ou social échu.
  if (ev.rows.length) {
    const active = new Set(po.rows.map(r => r.fournisseur).filter((x): x is string => !!x).map(normKey));
    const esg = new Map<string, number>();
    for (const r of ev.rows) { const s = num(r.score); if (r.fournisseur && s !== undefined && /esg|rse|csr/i.test(r.categorie ?? "")) esg.set(normKey(r.fournisseur), s); }
    const certKo = new Set(certs.rows.filter(c => c.fournisseur && /14001|sa ?8000|45001/i.test(c.type ?? "") && c.fin && c.fin < p.asOf).map(c => normKey(c.fournisseur!)));
    // Écart de vigilance : 1 si l'évaluation manque, le certificat est échu ou le score lu dépasse le seuil (règle), 0 sinon.
    const rows = [...active].map(s => { const sc = esg.get(s); const motif = sc === undefined ? "évaluation ESG absente" : certKo.has(s) ? "certificat environnemental ou social échu" : sc >= 70 ? "score ESG élevé" : ""; return { supplierId: s, supplier: supName(s), scoreEsg: sc ?? NON_FOURNI, ecart: flag(!!motif), motif }; }).filter(r => r.motif);
    if (rows.length) tables.push({ name: "Vigilance", label: "Devoir de vigilance fournisseurs", rows, sources: ev.sources });
  }

  // Fournisseurs (scores de risque lus par catégorie) et expéditions (retard) pour les indicateurs standard non branchés.
  if (ev.rows.length) {
    const latest = new Map<string, Map<string, { d: string; s: number }>>();
    for (const r of ev.rows) { const s = num(r.score); if (!r.fournisseur || s === undefined) continue; const m = latest.get(r.fournisseur) ?? new Map(); const k = (r.categorie ?? "").toUpperCase(); const cur = m.get(k); if (!cur || (r.date ?? "") >= cur.d) m.set(k, { d: r.date ?? "", s }); latest.set(r.fournisseur, m); }
    tables.push({ name: "Fournisseurs", label: "Scores de risque fournisseurs lus (niveaux, pas des probabilités)", sources: ev.sources, rows: [...latest].map(([s, m]) => ({ supplierId: s, supplier: supName(s), risqueGlobal: m.get("OVERALL")?.s ?? null, risqueCapacite: m.get("SUPPLY_CAPACITY")?.s ?? null, risqueGeopolitique: m.get("GEOPOLITICAL")?.s ?? null })) });
  }
  if (exp.rows.some(r => r.eta)) tables.push({ name: "Expeditions", label: "Retard des expéditions", sources: exp.sources, rows: exp.rows.filter(r => r.id && r.eta).map(r => ({ shipmentId: r.id!, carrier: r.transporteur ?? "", retardHeures: Math.max(0, Math.round(days(r.reelle ?? p.asOf, r.eta!) * 24)) })) });
  return { tables, res };
}

// ── Indicateurs et règles standard de résilience ──────────────────────────────
interface RuleDef { id: string; label: string; kpi: KpiDef; table: string; column: string; severity: RuleSeverity; display: "critique" | "majeure" | "mineure"; conclusion: string; question: string; causes: string[]; options: string[]; consequences: string[] }
const K = (id: string, label: string, unit: string, direction: KpiDef["direction"], seuilAlerte: number, seuilCritique: number, entityId?: string): KpiDef => ({ id, label, unit, direction, seuilAlerte, seuilCritique, perimetre: "Supply Chain", ...(entityId ? { entityId } : {}) });
export const RESILIENCE_RULES: RuleDef[] = [
  // ── Top 4 des alertes à forte valeur (règles causales pures sur des valeurs lues) ──
  { id: "RES-PROMESSE", label: "Promesse client menacée : disponibilité confirmée après la date promise", kpi: K("k-res-promesse", "Ligne client non couverte à la date promise (1 = oui)", "oui/non", "au_dessus_alerte", 0.5, 0.9, "sc-commande-client"), table: "PromesseClient", column: "menacee", severity: "critique", display: "critique",
    conclusion: "Le contrôle de disponibilité (ATP) ne confirme pas la date promise au client.", question: "Réallouer, expédier en express, livrer en plusieurs fois ou prévenir le client ?",
    causes: ["Date de disponibilité confirmée (ATP) lue", "Postérieure à la date promise, ou absente"], options: ["Réallouer le stock d'une autre commande", "Expédition express depuis un autre site", "Livraison partielle", "Prévenir le client et replanifier"],
    consequences: ["Retard client", "Pénalités ou perte de la commande", "Décision : réallouer ou prévenir"] },
  { id: "RES-CONFIRM", label: "Commande fournisseur non confirmée ou confirmée en retard", kpi: K("k-res-confirm", "Commande non confirmée ou confirmée après le besoin (1 = oui)", "oui/non", "au_dessus_alerte", 0.5, 2, "sc-commande"), table: "ConfirmationsFournisseur", column: "enRisque", severity: "alerte", display: "majeure",
    conclusion: "Le fournisseur n'a pas confirmé la commande, ou l'a confirmée après la date de besoin.", question: "Relancer, accélérer, basculer vers une autre source ou replanifier ?",
    causes: ["Confirmation fournisseur (SAP EKES) lue", "Absente, ou postérieure à la date de besoin (EKET)"], options: ["Relancer le fournisseur", "Demander une livraison partielle anticipée", "Basculer sur la source alternative", "Replanifier le besoin"],
    consequences: ["Réception en retard", "Rupture projetée", "Décision : relancer ou basculer"] },
  { id: "RES-RUPTURE", label: "Rupture projetée avant la prochaine réception", kpi: K("k-res-rupture", "Rupture projetée avant la prochaine réception (1 = oui)", "oui/non", "au_dessus_alerte", 0.5, 0.9, "sc-stock"), table: "RuptureProjetee", column: "avantReception", severity: "critique", display: "critique",
    conclusion: "La date de rupture projetée lue dans le SI tombe avant la prochaine réception planifiée.", question: "Transférer, accélérer la réception, prioriser ou substituer ?",
    causes: ["Date de rupture projetée (APS, MD04) lue", "Antérieure à la prochaine réception planifiée"], options: ["Transfert inter-sites", "Accélérer la prochaine réception", "Prioriser les clients", "Substitution"],
    consequences: ["Rupture sur le site", "CA à risque (lu)", "Décision : transférer ou accélérer"] },
  { id: "RES-MRP", label: "Paramètres MRP obsolètes : délai réel au-delà du délai planifié", kpi: K("k-res-mrp", "Écart entre délai réel lu et délai planifié lu", "jours", "au_dessus_alerte", 5, 15, "sc-article"), table: "ParametresMRP", column: "ecartJours", severity: "alerte", display: "majeure",
    conclusion: "Le délai planifié du MRP est plus court que le délai réellement constaté : le plan est faux.", question: "Mettre à jour le délai planifié, relancer le fournisseur ou basculer ?",
    causes: ["Délai planifié (MARC-PLIFZ) lu", "Délai réel médian lu (évaluation fournisseur)"], options: ["Mettre à jour le délai planifié", "Plan de progrès fournisseur", "Basculer une partie des volumes", "Revue mensuelle des paramètres"],
    consequences: ["Commandes passées trop tard", "Rupture projetée", "Décision : corriger le paramètre"] },
  // ── Résilience ──
  { id: "RES-UNIQUE", label: "Fournisseur unique : délai de reprise supérieur au délai de survie", kpi: K("k-res-unique", "Écart TTR − TTS lus d'un article à source unique", "jours", "au_dessus_alerte", 7, 30, "sc-article"), table: "SourceUnique", column: "ecartJours", severity: "critique", display: "critique",
    conclusion: "L'article n'a qu'une source approuvée et rompra avant qu'une autre soit qualifiée.", question: "Qualifier une seconde source, constituer un tampon ou accepter le risque ?",
    causes: ["Une seule source approuvée dans la liste de sources", "Délai de reprise lu (TTR) supérieur au délai de survie lu (TTS) de plus de 7 j"], options: ["Qualifier une source alternative", "Stock stratégique couvrant l'écart TTR − TTS", "Accord de capacité avec le fournisseur actuel", "Accepter le risque"],
    consequences: ["TTS dépassé : rupture avant la reprise", "Rupture projetée", "CA à risque (lu)", "Décision : second sourcing ou stock stratégique"] },
  { id: "RES-GEO", label: "Exposition géographique : articles critiques d'un fournisseur en Asie ou passant par un détroit", kpi: K("k-res-geo", "Articles critiques (TTR > TTS lus) d'un fournisseur exposé", "articles", "au_dessus_alerte", 1, 5, "sc-fournisseur"), table: "ExpositionGeo", column: "articlesCritiques", severity: "alerte", display: "majeure",
    conclusion: "Des articles critiques dépendent d'un fournisseur situé en Asie ou dont les expéditions passent par un détroit.", question: "Diversifier, prépositionner du stock ou accepter l'exposition ?",
    causes: ["Pays du fournisseur lu", "Escales des expéditions lues (Suez, mer Rouge)"], options: ["Double sourcing hors zone", "Stock stratégique en Europe", "Contrats de fret et itinéraires de repli", "Accepter l'exposition"],
    consequences: ["Retard transport en cas de fermeture", "TTS dépassé sur les articles concernés", "Décision : diversifier ou prépositionner"] },
  { id: "RES-BULLWHIP", label: "Effet coup de fouet : les commandes varient plus que la demande", kpi: K("k-res-bullwhip", "Ratio des variances commandes / demande", "ratio", "au_dessus_alerte", 1.5, 3, "sc-article"), table: "CoupDeFouet", column: "ratio", severity: "alerte", display: "majeure",
    conclusion: "La variance des commandes aux fournisseurs dépasse celle de la demande : surstock puis rupture à la reprise.", question: "Plafonner les commandes, partager la demande réelle ou accepter ?",
    causes: ["Ratio coup de fouet lu dans l'outil de planification", "Au-dessus de 1,5"], options: ["Plafonnement et allocation des commandes", "Partage de la demande réelle avec les fournisseurs", "Réapprovisionnement à la demande", "Commandes au fil de l'eau"],
    consequences: ["Surstock après le pic", "Rupture à la reprise", "Décision : lisser les commandes"] },
  { id: "RES-FINANCE", label: "Défaillance financière : le score de risque financier lu se dégrade", kpi: K("k-res-finance", "Hausse du score de risque financier lu", "points", "au_dessus_alerte", 15, 25, "sc-fournisseur"), table: "RisqueFinancier", column: "hausse", severity: "alerte", display: "majeure",
    conclusion: "Le score de risque financier du fournisseur augmente fortement dans le SRM (un niveau lu, pas une probabilité).", question: "Sécuriser l'approvisionnement, réduire l'exposition ou surveiller ?",
    causes: ["Évaluations successives du risque financier (SRM)", "Hausse de plus de 15 points"], options: ["Double sourcing sur les références critiques", "Stock tampon sur les références critiques", "Accord-cadre avec engagement de capacité", "Revue mensuelle"],
    consequences: ["Risque de rupture fournisseur", "TTS dépassé si le fournisseur s'arrête", "Décision : sécuriser ou réduire l'exposition"] },
  { id: "RES-QUALITE", label: "Qualité fournisseur : lots refusés au contrôle au-dessus du seuil", kpi: K("k-res-qualite", "Lots refusés au contrôle", "%", "au_dessus_alerte", 10, 20, "sc-fournisseur"), table: "QualiteLots", column: "tauxRefusPct", severity: "alerte", display: "majeure",
    conclusion: "Trop de lots du fournisseur sont refusés au contrôle à réception.", question: "Renforcer le contrôle, exiger un plan d'actions ou changer de source ?",
    causes: ["Part de lots refusés lue dans le QMS", "Au-dessus de 10 %"], options: ["Inspection renforcée", "Plan correctif fournisseur", "Réallocation vers une autre source", "Accompagnement"],
    consequences: ["Stock non conforme bloqué", "Rupture sur les références concernées", "Décision : corriger ou remplacer"] },
  { id: "RES-CERTIF", label: "Certification fournisseur échue ou proche de l'échéance", kpi: K("k-res-certif", "Jours avant l'échéance d'un certificat fournisseur", "jours", "en_dessous_alerte", 60, 0, "sc-fournisseur"), table: "Certificats", column: "joursRestants", severity: "alerte", display: "mineure",
    conclusion: "Un certificat du fournisseur est échu ou arrive à échéance.", question: "Relancer le renouvellement, suspendre les commandes ou accepter une dérogation ?",
    causes: ["Fin de validité du certificat (SRM)", "Échéance sous 60 jours"], options: ["Relancer le renouvellement", "Audit du fournisseur", "Suspendre les nouvelles commandes", "Dérogation documentée"],
    consequences: ["Non-conformité client ou réglementaire", "Blocage possible des livraisons", "Décision : renouveler ou suspendre"] },
  { id: "RES-PORT", label: "Congestion portuaire ou grève sur des articles à faible TTS", kpi: K("k-res-port", "Attente au port pour des expéditions à TTS court", "jours", "au_dessus_alerte", 2, 5), table: "Ports", column: "attenteJours", severity: "critique", display: "critique",
    conclusion: "Des expéditions attendent au port alors que leurs articles tiennent peu de jours (TTS lu).", question: "Changer de port, accélérer une partie des volumes ou attendre ?",
    causes: ["Évènement de congestion ou de grève en cours (TMS)", "Articles des expéditions avec un TTS lu court"], options: ["Hub alternatif", "Bascule en aérien sur les urgences", "Priorité aux commandes à forte pénalité", "Itinéraire actuel"],
    consequences: ["Retard transport critique", "TTS dépassé", "Décision : rerouter ou accélérer"] },
  { id: "RES-RAPPEL", label: "Rappel produit : lot refusé déjà livré à des clients", kpi: K("k-res-rappel", "Clients exposés à un lot refusé", "clients", "au_dessus_alerte", 1, 10), table: "Rappels", column: "clients", severity: "critique", display: "critique",
    conclusion: "Un lot refusé au contrôle a déjà été expédié : les clients concernés sont identifiés par la traçabilité.", question: "Rappeler, informer ou analyser avant de rappeler ?",
    causes: ["Lot refusé au contrôle qualité (QMS)", "Livraisons de ce lot (WMS) à des clients (OMS)"], options: ["Rappel ciblé des clients exposés", "Information et échange sans rappel", "Analyse complémentaire du lot", "Blocage du stock restant"],
    consequences: ["Clients exposés", "Risque d'image", "Décision : rappeler ou analyser"] },
  { id: "RES-ESG", label: "Devoir de vigilance (loi 2017-399, CS3D) : évaluation ESG absente ou insuffisante", kpi: K("k-res-esg", "Écart de vigilance ESG fournisseur (1 = oui)", "oui/non", "au_dessus_alerte", 0.5, 2, "sc-fournisseur"), table: "Vigilance", column: "ecart", severity: "alerte", display: "mineure",
    conclusion: "Un fournisseur actif n'a pas d'évaluation ESG lue, ou son score lu ou sa certification est insuffisant.", question: "Demander une évaluation, un plan d'actions ou réduire les volumes ?",
    causes: ["Évaluations ESG lues dans le SRM", "Certificats ISO 14001, ISO 45001 ou SA8000 lus"], options: ["Demander une évaluation ESG", "Plan d'actions et audit", "Réduire progressivement les volumes", "Suivi annuel"],
    consequences: ["Point de vigilance (loi 2017-399, CS3D ; la CSRD est une obligation de reporting)", "Décision : évaluer ou réduire"] },
  // ── Durabilité et autonomie stratégique (valeurs lues : classe ABC, part pays, DDS, cumul CBAM) ──
  { id: "RES-MONO-A", label: "Article de classe A à source unique", kpi: K("k-res-mono-a", "Article A avec une seule source active (1 = oui)", "oui/non", "au_dessus_alerte", 0.5, 2, "sc-article"), table: "MonoSourceA", column: "monoSource", severity: "alerte", display: "majeure",
    conclusion: "Un article de classe A n'a qu'une source active : son arrêt suit celui du fournisseur.", question: "Qualifier une seconde source, sécuriser le fournisseur actuel ou accepter le risque ?",
    causes: ["Classe ABC lue (MARC-MAABC) : A", "Une seule source active dans la liste de sources (EORD)"], options: ["Qualifier une seconde source", "Contrat de capacité avec le fournisseur actuel", "Stock de sécurité dédié à l'article", "Accepter le risque et surveiller"],
    consequences: ["Arrêt d'un article A si le fournisseur s'arrête", "Chiffre d'affaires de classe A exposé", "Décision : second sourcing ou sécurisation"] },
  { id: "RES-PAYS", label: "Concentration des achats d'une famille sur un seul pays", kpi: K("k-res-pays", "Part lue des achats d'une famille venant d'un seul pays", "%", "au_dessus_alerte", 50, 65), table: "ConcentrationPays", column: "partPct", severity: "alerte", display: "majeure",
    conclusion: "Plus de la moitié des achats d'une famille vient d'un seul pays (seuil déclaratif ; 65 % est le repère du règlement sur les matières premières critiques).", question: "Diversifier vers un autre pays, relocaliser une partie ou accepter la dépendance ?",
    causes: ["Part des achats par pays lue (analyse des dépenses du SRM) ou sources actives lues par pays", "Au-dessus de 50 %"], options: ["Diversifier vers un second pays", "Relocaliser une partie des volumes en Europe", "Stock stratégique sur la famille", "Accepter la dépendance et surveiller"],
    consequences: ["Arrêt de la famille en cas de crise dans le pays", "Exposition aux droits de douane et aux sanctions", "Décision : diversifier ou accepter"] },
  { id: "RES-EUDR", label: "EUDR : produit de base visé sans déclaration de diligence raisonnable", kpi: K("k-res-eudr", "Article visé sans DDS ni géolocalisation (1 = oui)", "oui/non", "au_dessus_alerte", 0.5, 0.9, "sc-article"), table: "Eudr", column: "sansDds", severity: "critique", display: "critique",
    conclusion: "L'article contient un produit de base visé par l'EUDR sans déclaration de diligence raisonnable : sa mise sur le marché sera bloquée au 30/12/2026.", question: "Obtenir la déclaration, changer de fournisseur ou suspendre la mise sur le marché ?",
    causes: ["Produit de base visé lu (bovins, cacao, café, palmier à huile, caoutchouc, soja, bois)", "Référence DDS ou géolocalisation absente (règlement (UE) 2023/1115)"], options: ["Exiger la DDS et la géolocalisation du fournisseur", "Basculer vers un fournisseur déjà conforme", "Substituer la matière", "Suspendre la mise sur le marché de l'article"],
    consequences: ["Blocage de mise sur le marché au 30/12/2026", "Sanctions (jusqu'à 4 % du chiffre d'affaires dans l'UE)", "Décision : documenter ou changer de source"] },
  { id: "RES-CBAM", label: "CBAM : importations de biens CBAM proches ou au-delà du seuil de 50 t", kpi: K("k-res-cbam", "Cumul annuel lu des biens CBAM importés", "t", "au_dessus_alerte", 40, 50), table: "Cbam", column: "cumulT", severity: "alerte", display: "majeure",
    conclusion: "Le cumul annuel des biens CBAM lu dans l'outil douane approche ou dépasse le seuil de minimis de 50 t : l'entreprise sort de l'exemption.", question: "Se préparer au régime CBAM, réduire les volumes concernés ou changer d'origine ?",
    causes: ["Cumul annuel des biens CBAM lu dans l'outil douane (codes NC)", "À partir de 40 t ; seuil de minimis 50 t par an (règlement 2025/2083)"], options: ["Demander le statut de déclarant CBAM autorisé", "Collecter les émissions intrinsèques des fournisseurs", "Basculer vers une origine UE", "Réduire les volumes importés concernés"],
    consequences: ["Sortie du régime de minimis", "Achat de certificats CBAM", "Décision : se déclarer ou réduire"] },
];
/** Indicateur du surstock (S3) : couverture lue par site, au-delà du seuil. S3 porte l'alerte (fusion avec l'ancienne RES-BFR). */
export const SURSTOCK_KPI = K("k-res-bfr", "Couverture lue au-delà de la cible", "jours", "au_dessus_alerte", 120, 240, "sc-stock");
/**
 * Scénarios illustratifs : sur le SI de démonstration Maison Lucie, trois cas sont
 * réglés à la main pour que l'alerte se déclenche (lignes marquées
 * `_scenario: "illustratif"` côté Maison Lucie). L'alerte le dit, avec ce qui a été calibré.
 */
export const ILLUSTRATIVE_SCENARIOS: Record<string, string> = {
  "RES-UNIQUE": "Scénario illustratif (démo Maison Lucie) : sur 6 articles, une seule source approuvée (liste de sources EORD) et un délai planifié allongé (fiche info-achat EINE-APLFZ) pour que le délai de reprise dépasse la couverture. Ce n'est pas une distribution observée.",
  "RES-PORT": "Scénario illustratif (démo Maison Lucie) : un évènement de congestion (4 jours au Havre) est placé sur le port d'arrivée de l'expédition maritime ouverte la moins couverte. Ce n'est pas un évènement réel.",
  "RES-PAYS": "Scénario illustratif (démo Maison Lucie) : les achats de composants chinois sont pondérés pour que la famille Composants dépasse 50 % sur un pays. Ce n'est pas une répartition observée.",
  "RES-EUDR": "Scénario illustratif (démo Maison Lucie) : un article visé sur quatre n'a pas de référence DDS. Ce n'est pas un état observé.",
  "RES-CBAM": "Scénario illustratif (démo Maison Lucie) : trois codes NC et leurs masses sont fixés pour un cumul de 44,9 t. Ce ne sont pas des volumes observés.",
  "RES-MRP": "Scénario illustratif (démo Maison Lucie) : les réceptions des 4 dernières semaines de deux fournisseurs (0000100003 et 0000100006) arrivent 35 à 50 % plus tard que le délai planifié, ce qui allonge le délai réel médian lu. Ce n'est pas une dérive observée.",
};
/** Note « scénario illustratif » d'une alerte, seulement quand les données viennent de la démo Maison Lucie. */
export function illustrativeNote(v: Pick<ArgusVocab, "apps">, ruleId: string): string | undefined {
  const note = ILLUSTRATIVE_SCENARIOS[ruleId];
  return note && v.apps.some(a => /maison lucie/i.test(`${a.environment ?? ""} ${a.label}`)) ? note : undefined;
}
/** Chaînes causales : une règle reliée à une conséquence existante (graphe causal). */
export const CHAIN_RULES: { id: string; label: string; from: string; to: string; conclusion: string }[] = [
  { id: "RES-CH-UNIQUE", label: "Source unique puis rupture projetée : rupture sans repli", from: "RES-UNIQUE", to: "RES-RUPTURE", conclusion: "Rupture avant la qualification d'une autre source." },
  { id: "RES-CH-PORT", label: "Attente au port puis retard transport : TTS dépassé", from: "RES-PORT", to: "S4", conclusion: "Le retard consomme le délai de survie : rupture sur les articles à TTS court." },
  { id: "RES-CH-MRP", label: "Paramètres MRP obsolètes puis commande en retard : rupture", from: "RES-MRP", to: "RES-CONFIRM", conclusion: "Un délai planifié trop court fait commander trop tard." },
  { id: "RES-CH-CONFIRM", label: "Commande fournisseur en retard puis promesse client menacée", from: "RES-CONFIRM", to: "RES-PROMESSE", conclusion: "La réception en retard ne couvre pas la date promise au client." },
  { id: "RES-CH-FINANCE", label: "Défaillance financière puis risque de rupture fournisseur", from: "RES-FINANCE", to: "S1", conclusion: "La dégradation financière précède souvent l'arrêt des livraisons." },
  { id: "RES-CH-BFR", label: "Coup de fouet puis surstock", from: "RES-BULLWHIP", to: "S3", conclusion: "Les surcommandes deviennent du stock excédentaire." },
];
/**
 * S3 (surstock) n'a pas d'indicateur propre : elle se déclenche sur la
 * couverture lue par site (fusion avec l'ancienne RES-BFR). S5 reste l'OTIF
 * fournisseur (livraison à temps et complète), distinct de RES-QUALITE (lots
 * refusés) : sans donnée OTIF fournie par le SI, elle reste « à renseigner ».
 */
export const CATALOGUE_CONDITIONS: Record<string, { kpiId: string; minStatus: "alerte" }> = {
  S3: { kpiId: "k-res-bfr", minStatus: "alerte" },
};
const STANDARD_KPI_TARGET: Record<string, { table: string; column: string }> = {
  "k-s2": { table: "Positions", column: "couvertureJours" }, "k-s4": { table: "Expeditions", column: "retardHeures" },
  "k-s1": { table: "Fournisseurs", column: "risqueCapacite" }, "k-s9": { table: "Fournisseurs", column: "risqueGlobal" }, "k-s10": { table: "Fournisseurs", column: "risqueGeopolitique" },
};

/**
 * Ajoute au vocabulaire les tables calculées, leurs champs, les indicateurs et
 * règles de résilience, et branche chaque indicateur sur sa colonne calculée.
 * Idempotent : un nouvel appel remplace les tables calculées précédentes.
 */
export function withDerivedIndicators(v: ArgusVocab, params: Partial<DerivedParams> = {}): ArgusVocab {
  const p = { ...DEFAULT_DERIVED, ...params };
  const { tables } = deriveTables(v, p);
  const now = new Date().toISOString();
  const snapshots: SiTableSnapshot[] = tables.map(t => { const cols = [...new Set(t.rows.flatMap(r => Object.keys(r)))]; return { id: `${DERIVED_APP}:${t.name}`, appId: DERIVED_APP, table: t.name, columns: cols, rows: t.rows.map(r => Object.fromEntries(cols.map(c => [c, r[c] === null || r[c] === undefined ? "" : String(r[c])]))), fetchedAt: now }; });
  const fields: AppField[] = snapshots.flatMap(s => s.columns.map(c => ({ id: `${DERIVED_APP}:${s.table}:${c}`, appId: DERIVED_APP, name: `${s.table}.${c}`, liveTable: s.table, sampleValues: s.rows.slice(0, 6).map(r => r[c]) })));
  const has = (table: string, column: string) => snapshots.some(s => s.table === table && s.columns.includes(column));
  const sourcesOf = (table: string) => tables.find(t => t.name === table)?.sources ?? [];
  // Indicateurs de résilience : ajoutés s'ils manquent (les seuils modifiés dans le Studio sont conservés).
  const kpis = [...v.kpis];
  for (const k of [...RESILIENCE_RULES.map(r => r.kpi), SURSTOCK_KPI]) { const i = kpis.findIndex(x => x.id === k.id); if (i < 0) kpis.push(k); else if (kpis[i].unit !== k.unit) kpis[i] = k; }
  const mappings: MappingDef[] = v.mappings.filter(m => m.appId !== DERIVED_APP);
  const mapTo = (kpiId: string, table: string, column: string) => { if (has(table, column)) mappings.push({ id: `drv:${kpiId}`, kpiId, appId: DERIVED_APP, fieldId: `${DERIVED_APP}:${table}:${column}`, method: "manuel", confidence: 1, attribut: column, rationale: `Lu par Aura dans ${sourcesOf(table).slice(0, 3).join(", ") || "les objets branchés"} (valeurs du SI, règle de comparaison).` }); };
  for (const r of RESILIENCE_RULES) mapTo(r.kpi.id, r.table, r.column);
  mapTo(SURSTOCK_KPI.id, "Positions", "couvertureJours");
  // Indicateurs standard : branchés sur la colonne calculée seulement s'ils n'ont aucune source directe.
  for (const [kpiId, t] of Object.entries(STANDARD_KPI_TARGET)) if (!mappings.some(m => m.kpiId === kpiId)) mapTo(kpiId, t.table, t.column);
  // Règles : standard de résilience (une condition) et chaînes (deux règles), ajoutées si absentes.
  const rules: CausalRule[] = [...v.causalRules];
  for (const r of RESILIENCE_RULES) if (!rules.some(x => x.id === r.id)) rules.push({ id: r.id, label: r.label, conditions: [{ kpiId: r.kpi.id, minStatus: "alerte" }], conclusion: r.conclusion, severity: r.severity, displaySeverity: r.display, origin: "manuel", validation: "validee", alertEnabled: true, causes: r.causes, options: r.options, decisionQuestion: r.question, consequences: r.consequences, tags: ["Résilience"] });
  // Alertes du catalogue sans indicateur propre : branchées sur l'indicateur calculé qui mesure leur signal.
  for (const [id, cond] of Object.entries(CATALOGUE_CONDITIONS)) { const i = rules.findIndex(x => x.id === id && !x.conditions.length); if (i >= 0 && mappings.some(m => m.kpiId === cond.kpiId)) rules[i] = { ...rules[i], conditions: [cond] }; }
  for (const c of CHAIN_RULES) if (!rules.some(x => x.id === c.id)) rules.push({ id: c.id, label: c.label, conditions: [{ ruleId: c.from }, { ruleId: c.to }], conclusion: c.conclusion, severity: "critique", origin: "manuel", validation: "validee", alertEnabled: false, tags: ["Chaîne causale"] });
  return {
    ...v,
    apps: [...v.apps.filter(a => a.id !== DERIVED_APP), ...(snapshots.length ? [{ id: DERIVED_APP, label: "Aura · règles sur valeurs lues", type: "Règles Aura", connectionHint: "Valeurs lues dans les objets branchés et résultats de comparaisons (aucun calcul)", secretConfigured: true, sourceStatus: "connected" as const, lastSyncAt: now }] : [])],
    fields: [...v.fields.filter(f => f.appId !== DERIVED_APP), ...fields],
    siTables: [...(v.siTables ?? []).filter(s => s.appId !== DERIVED_APP), ...snapshots],
    kpis, mappings, causalRules: rules,
  };
}

/**
 * Montant en euros d'une alerte : uniquement une valeur LUE dans le SI (CA à
 * risque fourni par l'APS), pour l'entité qui déclenche la règle, avec sa
 * source. Jamais une somme ni une valeur × hypothèse. undefined quand le SI
 * ne fournit pas la valeur (affiché « donnée non fournie par le SI »).
 */
export interface Exposure { eur: number; source: string; what: string }
const READ_EXPOSURE: Record<string, { table: string; by: string[] }> = {
  "RES-UNIQUE": { table: "SourceUnique", by: ["sku"] }, "RES-RUPTURE": { table: "RuptureProjetee", by: ["sku", "siteId"] },
  S2: { table: "Positions", by: ["sku", "siteId"] }, S1: { table: "Articles", by: ["supplierId"] },
};
export function exposureFor(v: ArgusVocab, ruleId: string, evaluation?: CausalRuleEvaluation): Exposure | undefined {
  const def = READ_EXPOSURE[ruleId];
  if (!def) return undefined;
  const snap = (v.siTables ?? []).find(s => s.appId === DERIVED_APP && s.table === def.table && s.columns.includes("caRisqueEur"));
  if (!snap) return undefined;
  // Entité déclenchante (la plus grave, en tête) : sa valeur lue, jamais un total.
  const top = evaluation?.matches[0]?.label.split(" · ");
  const row = top ? snap.rows.find(r => def.by.every((k, i) => !top[i] || normKey(r[k]) === normKey(top[i])) && num(r.caRisqueEur) !== undefined) : undefined;
  const eur = num(row?.caRisqueEur);
  if (!row || eur === undefined || eur <= 0) return undefined;
  const who = def.by.map(k => row[k]).filter(Boolean).join(" · ");
  return { eur, what: `CA à risque lu (${who})`, source: `APS · position planifiée (valeur lue, ${who})` };
}
