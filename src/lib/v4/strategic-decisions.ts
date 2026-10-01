// Décisions d'investissement et stratégiques Supply (hors alertes) : modèles
// pré-remplis simples que Bora évalue comme les autres (options comparées sur
// des critères ordinaux). Aucun moteur d'optimisation de réseau : Aura ne
// calcule pas l'emplacement optimal d'un site, il compare les options posées.
// Les effets des options sont des hypothèses « à confirmer » ; les faits
// viennent des données Maison Lucie branchées quand elles existent, sinon
// « donnée à renseigner » avec l'objet du modèle qui la porterait.
import type { ArgusVocab } from "./argus-vocab-store";
import { readAll, readObject, num, ASIA, isMapped } from "./supply-data";
import { DERIVED_APP } from "./supply-derived";
import { NON_FOURNI } from "./resilience-tts";

export interface StrategicDecision {
  id: string;            // identifiant de profil (STRAT-…), voir supply-profiles.ts
  titre: string;
  question: string;
  /** Options du levier principal (celles de la question). */
  options: string[];
  indicateur: string;    // indicateur principal à réduire (premier TPM)
  /** Faits Maison Lucie utiles à la décision, lus sur les données. */
  faits: (v: ArgusVocab | undefined) => string[];
}

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
const derived = (v: ArgusVocab, table: string) => (v.siTables ?? []).find(s => s.appId === DERIVED_APP && s.table === table)?.rows ?? [];
const aRenseigner = (quoi: string, objet: string) => `Donnée à renseigner : ${quoi} (objet « ${objet} » du modèle Supply, non branché).`;
const distinct = (v: ArgusVocab, entity: string, attr: string) => new Set(readAll(v, entity, attr).rows.map(r => r[attr]).filter(Boolean)).size;

function sites(v: ArgusVocab): string[] {
  const s = readObject(v, "sc-site", "id");
  if (!s.rows.length) return [aRenseigner("liste des sites et leur type", "Site")];
  const types = new Map<string, number>();
  for (const r of s.rows) types.set(r.type ?? "type non renseigné", (types.get(r.type ?? "type non renseigné") ?? 0) + 1);
  return [`${s.rows.length} sites lus (${[...types].map(([t, n]) => `${n} ${t}`).join(", ")}) — source ${s.sources.join(", ")}.`];
}
function flux(v: ArgusVocab): string[] {
  const n = readAll(v, "sc-commande-client", "id").rows.length, sitesServis = distinct(v, "sc-commande-client", "site");
  return n ? [`${fmt(n)} lignes de commande client lues, servies depuis ${sitesServis} site(s).`] : [aRenseigner("commandes clients par site", "Commande client")];
}
function stockValeur(v: ArgusVocab): string[] {
  // Valeur du stock : lue seulement si le SI la fournit (Aura ne multiplie pas quantité × coût).
  return [`Valeur du stock : ${NON_FOURNI}.`];
}
function secu(v: ArgusVocab): string[] {
  const rows = derived(v, "SourceUnique"), crit = rows.filter(r => (num(r.ecartJours) ?? 0) > 0);
  return rows.length ? [`${crit.length} article(s) à source unique sur ${rows.length} ont un délai de reprise lu supérieur à leur délai de survie lu (Aura · SourceUnique).`] : [`Délai de survie et délai de reprise par article : ${NON_FOURNI}.`];
}
function geo(v: ArgusVocab): string[] {
  const rows = derived(v, "ExpositionGeo");
  if (rows.length) return [`${rows.reduce((s, r) => s + (num(r.articlesCritiques) ?? 0), 0)} article(s) critique(s) dépendent de ${rows.length} fournisseur(s) situé(s) en Asie ou expédiant par un détroit (valeurs lues).`];
  const f = readObject(v, "sc-fournisseur", "id");
  return f.rows.length ? [`${f.rows.filter(x => ASIA.has(x.pays ?? "")).length} fournisseur(s) sur ${f.rows.length} situés en Asie.`] : [aRenseigner("pays des fournisseurs", "Fournisseur · pays")];
}
/** Durabilité : émissions du transport et statut ESG, lus dans le SI (aucun calcul d'émissions). */
function durabilite(v: ArgusVocab): string[] {
  const co2 = isMapped(v, "sc-expedition", "co2") ? readObject(v, "sc-expedition", "id").rows.map(r => num(r.co2)).filter((x): x is number => x !== undefined) : [];
  const esg = readAll(v, "sc-evaluation", "fournisseur").rows.filter(r => /esg|rse|csr/i.test(r.categorie ?? ""));
  const certs = readAll(v, "sc-certificat", "fournisseur").rows.filter(r => /14001|45001|sa ?8000/i.test(r.type ?? ""));
  return [
    co2.length ? `Émissions du transport lues dans le TMS sur ${co2.length} expédition(s) (valeurs par expédition, non recalculées).` : `Émissions CO2e du transport : ${NON_FOURNI}.`,
    esg.length ? `Statut ESG lu pour ${new Set(esg.map(r => r.fournisseur)).size} fournisseur(s) (SRM).` : `Statut ESG des fournisseurs : ${NON_FOURNI}.`,
    certs.length ? `${certs.length} certificat(s) environnemental ou social lu(s) (ISO 14001, ISO 45001, SA8000).` : `Certificats environnementaux et sociaux : ${NON_FOURNI}.`,
  ];
}
function transport(v: ArgusVocab): string[] {
  const n = distinct(v, "sc-expedition", "transporteur"), exp = derived(v, "Expeditions");
  const late = exp.filter(r => (num(r.retardHeures) ?? 0) > 24).length;
  return n ? [`${n} transporteur(s) dans les expéditions lues${exp.length ? ` ; ${late} expédition(s) sur ${exp.length} ont plus de 24 h de retard` : ""}.`] : [aRenseigner("transporteur de chaque expédition", "Expédition · transporteur")];
}
function volumes(v: ArgusVocab): string[] {
  const liv = readAll(v, "sc-livraison", "id").rows.length, abs = readAll(v, "sc-absence", "taux").rows.map(r => num(r.taux)).filter((x): x is number => x !== undefined);
  return [
    liv ? `${fmt(liv)} lignes de livraison lues (volume à préparer).` : aRenseigner("lignes de livraison", "Livraison"),
    abs.length ? `${fmt(abs.length)} relevés d'absentéisme lus (SIRH).` : aRenseigner("absentéisme des équipes", "Absence"),
  ];
}
function demande(v: ArgusVocab): string[] {
  const bw = derived(v, "CoupDeFouet"), sem = distinct(v, "sc-demande", "semaine"), prev = readAll(v, "sc-prevision", "quantite").rows.length;
  return [
    sem ? `${sem} semaines d'historique de demande lues${prev ? `, ${fmt(prev)} lignes de prévision` : ""}.` : aRenseigner("historique de demande", "Demande"),
    ...(bw.length ? [`${bw.filter(r => (num(r.ratio) ?? 0) > 1.5).length} article(s) où les commandes varient plus d'une fois et demie plus que la demande (Aura · CoupDeFouet).`] : []),
  ];
}
const HORS_CALCUL = "Aura lit et raisonne, il ne calcule pas : il compare les options posées (évaluation ordinale Bora) ; pas de moteur d'optimisation. Coûts et effets : à lire dans le SI ou à confirmer avec le client.";

export const STRATEGIC_DECISIONS: StrategicDecision[] = [
  { id: "STRAT-ENTREPOT", titre: "Ouvrir ou fermer un entrepôt ou un hub", question: "Faut-il ouvrir un hub, fermer un entrepôt ou garder le réseau actuel ?", options: ["Garder le réseau actuel", "Ouvrir un hub régional", "Fermer ou regrouper un entrepôt"], indicateur: "Délai de livraison client", faits: v => v ? [...sites(v), ...flux(v), ...stockValeur(v), HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-RESEAU", titre: "Concevoir le réseau logistique", question: "Combien de sites, où, et en direct ou en cross-dock ?", options: ["Réseau centralisé (un entrepôt)", "Réseau régional (plusieurs entrepôts)", "Cross-dock sans stock"], indicateur: "Coût logistique total", faits: v => v ? [...sites(v), ...flux(v), ...transport(v), HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-3PL", titre: "Faire ou faire faire (3PL)", question: "Garder la logistique en propre ou l'externaliser à un prestataire (3PL) ?", options: ["En propre", "Externaliser à un 3PL", "Modèle mixte (pics chez un 3PL)"], indicateur: "Coût par commande préparée", faits: v => v ? [...sites(v), ...volumes(v), HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-TRANSPORT", titre: "Choisir transporteurs et modes", question: "Quels transporteurs et quels modes (mer, air, rail, route) retenir ?", options: ["Transporteurs actuels", "Consolider sur moins de transporteurs", "Report modal (rail ou mer)"], indicateur: "Retards de livraison", faits: v => v ? [...transport(v), ...geo(v), ...durabilite(v), HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-NEARSHORING", titre: "Relocaliser (nearshoring)", question: "Rapprocher une partie des achats de l'Europe ou garder les sources actuelles ?", options: ["Sources actuelles", "Nearshoring partiel des références critiques", "Double sourcing Europe et Asie"], indicateur: "Délai de reprise (TTR)", faits: v => v ? [...geo(v), ...secu(v), ...durabilite(v), HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-STOCK-SECU", titre: "Dimensionner les stocks de sécurité", question: "Quel niveau de stock de sécurité, et pour quelles références ?", options: ["Niveau actuel", "Relever sur les références critiques", "Seuils dynamiques selon la saison"], indicateur: "Jours de rupture", faits: v => v ? [...secu(v), ...stockValeur(v), HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-AUTOMATISATION", titre: "Automatiser un entrepôt", question: "Investir dans l'automatisation d'un entrepôt, et à quel degré ?", options: ["Pas d'automatisation", "Automatisation légère (convoyeurs, tri)", "Automatisation poussée (stockage automatisé, robots)"], indicateur: "Coût de préparation par ligne", faits: v => v ? [...sites(v), ...volumes(v), HORS_CALCUL] : [HORS_CALCUL] },
  // Anciennes alertes S14 (réseau, porté par STRAT-RESEAU) et S15 (transformation SI) : décisions stratégiques, pas des alertes quotidiennes.
  { id: "STRAT-SI", titre: "Séquencer une transformation du SI supply", question: "Quelle architecture et quelle séquence minimisent le risque métier ?", options: ["Big bang", "Phasage par lot", "Coexistence avec interfaces temporaires"], indicateur: "Risque de rupture pendant la bascule", faits: v => v ? [`${(v.siTables ?? []).length} tables SI lues dans ${new Set((v.siTables ?? []).map(t => t.appId)).size} applications.`, "Couverture fonctionnelle du SI cible : à lire dans Aura Architect.", HORS_CALCUL] : [HORS_CALCUL] },
  { id: "STRAT-SOP", titre: "Choisir le S&OP et son horizon", question: "Quel rythme et quel horizon pour le S&OP ?", options: ["S&OP mensuel à 12 mois", "S&OP hebdomadaire à 3 mois", "S&OP mensuel et revue hebdomadaire des exceptions"], indicateur: "Écart entre prévision et demande", faits: v => v ? [...demande(v), ...secu(v), HORS_CALCUL] : [HORS_CALCUL] },
];
