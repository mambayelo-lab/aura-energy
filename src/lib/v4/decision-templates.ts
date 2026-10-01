// Gabarits métier des décisions générées (dialogue « Décider vite », secours
// sans LLM, pré-remplissage depuis une alerte Supply). Cibles d'une décision
// réaliste, ni maigre ni surchargée :
//   · 3 à 5 leviers, 2 à 4 options par levier ;
//   · 5 à 8 indicateurs (TPM), sous 2 ou 3 MOP et 1 ou 2 MOE.
// Chaque gabarit ne contient que des éléments propres à son métier. Les
// niveaux d'impact sont des hypothèses ordinales (NUL, L, M, H et un sens),
// toutes marquées « à confirmer » ; aucun chiffre n'est produit.
import type { AtelierCriterion, AtelierLevierDef, AtelierOptionDef, AtelierScenario, ImportanceBadge, QualitativeImpact } from "./atelier-store";

import { specialize, supplyProfileFor } from "./supply-profiles";
export type Fam = "risque" | "cout" | "rapide" | "croissance" | "qualite" | "faisab" | "flex" | "env";
type Imp = Partial<Record<Fam, QualitativeImpact>>;
interface TplTpm { label: string; fam: Fam; imp?: ImportanceBadge; why?: string }
interface TplMop { label: string; tpms: TplTpm[] }
interface TplMoe { label: string; mops: TplMop[] }
interface TplLever { label: string; options: { label: string; does?: string; impacts: Imp }[] }
export interface Template { id: string; label: string; match: RegExp; moes: TplMoe[]; levers: TplLever[]; risques?: string[] }

export const TARGETS = { levers: [3, 5], options: [2, 4], tpm: [5, 8], mop: [2, 3], moe: [1, 2] } as const;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export const TEMPLATES: Template[] = [
  {
    id: "supply", risques: ["Rupture chez les clients si l'option agit trop tard", "Surcoût d'achat ou de stock", "Dépendance persistante au fournisseur"], label: "Approvisionnement",
    match: /\b(fournisseur|approvision|rupture|sourcing|stock|appro|composant|matiere|sup ?\d|achat|supplier|supply|shortage|stockout|component|procure|prevision de demande|s op|forecast|ecart entre sources|donnee maitre|nearshor)/,
    moes: [
      { label: "Continuité du service client", mops: [
        { label: "Résilience d'approvisionnement", tpms: [{ label: "Probabilité de rupture", fam: "risque", why: "Chance qu'une référence manque : c'est ce que les clients subissent en premier." }, { label: "Dépendance à un fournisseur unique", fam: "risque", why: "Exposition à un seul point de défaillance dans la chaîne amont." }] },
        { label: "Réactivité", tpms: [{ label: "Délai de mise en œuvre", fam: "rapide", why: "Temps avant que l'option protège réellement ; compte si l'alerte est proche." }, { label: "Taux de service client", fam: "qualite", why: "Commandes servies complètes et à l'heure : la promesse faite aux clients." }] },
      ] },
      { label: "Performance économique", mops: [
        { label: "Coûts d'approvisionnement", tpms: [{ label: "Coût d'achat unitaire", fam: "cout", why: "Prix payé par pièce ; pèse sur la marge.", imp: "Secondaire" }, { label: "Coût de possession du stock", fam: "cout", why: "Coût d'immobiliser et stocker des pièces ; pèse sur la trésorerie.", imp: "Secondaire" }] },
      ] },
    ],
    levers: [
      { label: "Couverture de stock", options: [{ label: "Couverture actuelle", does: "Garde le stock de sécurité tel qu'il est.", impacts: {} }, { label: "Couverture renforcée sur les références critiques", does: "Ajoute du stock uniquement sur les pièces à risque.", impacts: { risque: "+", qualite: "+", cout: "-" } }] },
      { label: "Contrat fournisseur", options: [{ label: "Commandes ponctuelles", does: "Achète au fil des besoins, sans engagement.", impacts: {} }, { label: "Accord-cadre avec engagement de capacité", does: "Réserve de la capacité chez le fournisseur contre un engagement.", impacts: { risque: "+", rapide: "+L", cout: "-L" } }] },
      { label: "Pilotage du risque", options: [{ label: "Revue mensuelle", does: "Fait le point sur les risques une fois par mois.", impacts: {} }, { label: "Suivi hebdomadaire des signaux fournisseur", does: "Surveille chaque semaine les signaux faibles des fournisseurs.", impacts: { risque: "+L", rapide: "+", cout: "-L" } }] },
    ],
  },
  {
    id: "solution", risques: ["Adoption faible par les équipes", "Dérive du projet d'intégration", "Enfermement chez l'éditeur"], label: "Choix de solution",
    match: /\b(crm|erp|logiciel|outil|saas|plateforme|solution|application|progiciel|editeur|sap|salesforce|microsoft|oracle)/,
    moes: [
      { label: "Valeur pour le métier", mops: [
        { label: "Adoption par les équipes", tpms: [{ label: "Simplicité d'usage", fam: "faisab", why: "Facilité de prise en main par les équipes ; conditionne l'adoption." }, { label: "Qualité du service client", fam: "qualite", why: "Ce que les clients perçoivent de la solution au quotidien." }] },
        { label: "Intégration au système d'information", tpms: [{ label: "Intégration à l'existant", fam: "faisab", why: "Effort pour relier la solution au système d'information actuel." }, { label: "Réversibilité", fam: "flex", why: "Capacité à changer d'avis plus tard sans tout refaire." }] },
      ] },
      { label: "Maîtrise du projet", mops: [
        { label: "Coût et délai", tpms: [{ label: "Coût total de possession", fam: "cout", why: "Licences, intégration et exploitation sur la durée." }, { label: "Délai de déploiement", fam: "rapide", why: "Temps avant que la solution soit utilisée en production." }, { label: "Risque projet", fam: "risque", why: "Probabilité de dérive (délai, périmètre, budget) pendant le projet." }] },
      ] },
    ],
    levers: [
      { label: "Niveau d'adaptation", options: [{ label: "Standard sans adaptation", does: "Utilise la solution telle quelle.", impacts: {} }, { label: "Paramétrage avancé", does: "Adapte la solution aux processus maison.", impacts: { qualite: "+", faisab: "-L", cout: "-", rapide: "-" } }] },
      { label: "Accompagnement", options: [{ label: "Équipe interne", does: "Mène le projet avec vos équipes.", impacts: {} }, { label: "Intégrateur partenaire", does: "Confie la mise en œuvre à un partenaire expérimenté.", impacts: { risque: "+", rapide: "+", cout: "-" } }] },
      { label: "Mise en service", options: [{ label: "Bascule en une fois", does: "Passe tout le monde sur la solution le même jour.", impacts: {} }, { label: "Déploiement par lots", does: "Déploie équipe par équipe pour limiter le risque.", impacts: { risque: "+", rapide: "-L", faisab: "+L" } }] },
    ],
  },
  {
    id: "investissement", risques: ["Trésorerie mobilisée trop tôt", "Capacité sous-utilisée si la demande baisse", "Mise au point technique plus longue que prévu"], label: "Investissement",
    match: /\b(investi|acheter|louer|location|leasing|machine|equipement|ligne de production|usine|capex|batiment|entrepot neuf|invest|buy|lease|rent|equipment|production line|plant)/,
    moes: [
      { label: "Rentabilité", mops: [
        { label: "Coût", tpms: [{ label: "Investissement initial", fam: "cout", why: "Dépense engagée au départ ; pèse sur la trésorerie." }, { label: "Coût d'exploitation", fam: "cout", why: "Dépenses récurrentes pour faire tourner l'équipement." }] },
        { label: "Risque", tpms: [{ label: "Flexibilité future", fam: "flex", why: "Marge de manœuvre si le besoin évolue." }, { label: "Risque technique", fam: "risque", why: "Probabilité de panne ou de mise au point difficile." }] },
      ] },
      { label: "Capacité opérationnelle", mops: [
        { label: "Capacité", tpms: [{ label: "Capacité de production", fam: "croissance", why: "Volume que l'on peut produire ; c'est l'effet recherché." }, { label: "Délai de disponibilité", fam: "rapide", why: "Temps avant de pouvoir produire." }, { label: "Qualité produite", fam: "qualite", why: "Conformité et régularité de la production." }] },
      ] },
    ],
    levers: [
      { label: "Financement", options: [{ label: "Fonds propres", does: "Finance sur la trésorerie de l'entreprise.", impacts: {} }, { label: "Crédit-bail", does: "Étale le coût par des loyers.", impacts: { cout: "+L", flex: "+" } }] },
      { label: "Maintenance", options: [{ label: "Maintenance interne", does: "Entretien assuré par vos techniciens.", impacts: {} }, { label: "Contrat constructeur", does: "Maintenance garantie par le fabricant.", impacts: { risque: "+", qualite: "+L", cout: "-L" } }] },
      { label: "Mise en route", options: [{ label: "Montée en charge progressive", does: "Augmente la production par paliers.", impacts: {} }, { label: "Pleine capacité dès le départ", does: "Produit à plein régime tout de suite.", impacts: { croissance: "+", rapide: "+", risque: "-" } }] },
    ],
  },
  {
    id: "strategie", risques: ["Investissement non rentabilisé", "Exécution plus difficile que prévu", "Obstacles réglementaires locaux"], label: "Stratégie",
    match: /\b(expansion|marche|acquisition|racheter|croissance|pays|international|implantation|diversifi|alliance|partenariat|market|acquire|growth|country|partnership)/,
    moes: [
      { label: "Croissance durable", mops: [
        { label: "Développement", tpms: [{ label: "Part de marché", fam: "croissance", why: "Position gagnée face aux concurrents ; mesure directe de la croissance." }, { label: "Chiffre d'affaires nouveau", fam: "croissance", why: "Revenus additionnels apportés par la décision." }, { label: "Vitesse d'entrée", fam: "rapide", why: "Temps pour être présent et vendre sur la cible." }] },
        { label: "Ressources", tpms: [{ label: "Investissement requis", fam: "cout", why: "Moyens financiers à engager." }, { label: "Capacité d'exécution", fam: "faisab", why: "Aptitude des équipes à mener l'opération." }] },
      ] },
      { label: "Maîtrise des risques", mops: [
        { label: "Risques", tpms: [{ label: "Risque financier", fam: "risque", why: "Exposition de la trésorerie et de l'endettement." }, { label: "Risque réglementaire", fam: "risque", why: "Obstacles juridiques ou d'autorisation." }] },
      ] },
    ],
    levers: [
      { label: "Rythme", options: [{ label: "Pilote sur un premier marché", does: "Teste sur une cible avant d'étendre.", impacts: {} }, { label: "Déploiement large", does: "Lance d'emblée sur toutes les cibles.", impacts: { croissance: "+", rapide: "+", risque: "-", cout: "-" } }] },
      { label: "Mode d'entrée", options: [{ label: "Seul", does: "Garde le contrôle complet de l'opération.", impacts: {} }, { label: "Avec un partenaire local", does: "S'appuie sur un acteur qui connaît le terrain.", impacts: { risque: "+", faisab: "+", croissance: "-L" } }] },
      { label: "Financement", options: [{ label: "Autofinancement", does: "Finance sans dette ni dilution.", impacts: {} }, { label: "Levée de fonds", does: "Fait entrer des investisseurs pour aller plus vite.", impacts: { rapide: "+", croissance: "+L", risque: "-L" } }] },
    ],
  },
  {
    id: "logistique", risques: ["Retards en période de pic", "Hausse du coût de transport", "Dégradation du service client"], label: "Logistique",
    match: /\b(transport|logisti|livraison|entrepot|expedition|flux|transporteur|messagerie|dernier kilometre|camion|avion|navire|rerout|fret|delivery|warehouse|shipping|freight|carrier|truck|plane|vessel|air)/,
    moes: [
      { label: "Service de livraison", mops: [
        { label: "Service", tpms: [{ label: "Délai de livraison", fam: "rapide", why: "Temps entre commande et réception par le client." }, { label: "Fiabilité des livraisons", fam: "qualite", why: "Livraisons conformes et à l'heure." }] },
        { label: "Robustesse", tpms: [{ label: "Risque de retard", fam: "risque", why: "Probabilité d'un retard subi (aléas, saturation)." }, { label: "Capacité en période de pic", fam: "flex", why: "Aptitude à absorber les pointes d'activité." }] },
      ] },
      { label: "Coût logistique", mops: [
        { label: "Coûts et empreinte", tpms: [{ label: "Coût de transport", fam: "cout", why: "Coût d'acheminement des flux." }, { label: "Coût d'entreposage", fam: "cout", why: "Coût des stocks et des entrepôts." }, { label: "Empreinte carbone", fam: "env", why: "Émissions liées aux flux ; enjeu réglementaire et d'image." }] },
      ] },
    ],
    levers: [
      { label: "Mode de transport", options: [{ label: "Routier", does: "Transport par camion, souple et direct.", impacts: {} }, { label: "Multimodal rail-route", does: "Combine rail et route pour les longues distances.", impacts: { env: "++", cout: "+L", rapide: "-" } }] },
      { label: "Stockage", options: [{ label: "Entrepôt central", does: "Un seul stock pour tout le réseau.", impacts: {} }, { label: "Entrepôts régionaux", does: "Des stocks proches des clients.", impacts: { rapide: "+", qualite: "+", cout: "-" } }] },
      { label: "Pilotage des flux", options: [{ label: "Planification hebdomadaire", does: "Planifie les flux une fois par semaine.", impacts: {} }, { label: "Tour de contrôle quotidienne", does: "Pilote les flux chaque jour et réagit aux aléas.", impacts: { risque: "+", qualite: "+L", cout: "-L" } }] },
    ],
  },
];

export const GENERIC: Template = {
  id: "generique", risques: ["Effet plus faible que prévu", "Coût ou délai qui dérive", "Difficile de revenir en arrière"], label: "Décision", match: /$^/,
  moes: [
    { label: "Atteinte de l'objectif", mops: [
      { label: "Résultat", tpms: [{ label: "Effet sur l'objectif", fam: "croissance", why: "Contribution directe à ce que vous cherchez à obtenir." }, { label: "Qualité du résultat", fam: "qualite", why: "Niveau de qualité obtenu." }] },
      { label: "Risques", tpms: [{ label: "Risque principal", fam: "risque", why: "Ce qui peut mal tourner de plus grave." }, { label: "Réversibilité", fam: "flex", why: "Capacité à changer d'avis plus tard sans tout refaire." }] },
    ] },
    { label: "Maîtrise des moyens", mops: [
      { label: "Ressources", tpms: [{ label: "Coût", fam: "cout", why: "Dépense engagée." }, { label: "Délai", fam: "rapide", why: "Temps avant l'effet." }, { label: "Faisabilité", fam: "faisab", why: "Capacité réelle à mettre en œuvre." }] },
    ] },
  ],
  levers: [
    { label: "Rythme", options: [{ label: "Pilote limité", does: "Commence petit pour apprendre.", impacts: {} }, { label: "Déploiement complet", does: "Met en œuvre partout d'un coup.", impacts: { croissance: "+", rapide: "+", risque: "-" } }] },
    { label: "Conduite", options: [{ label: "Équipe interne", does: "Mène le projet avec vos équipes.", impacts: {} }, { label: "Appui externe", does: "Se fait accompagner par des spécialistes.", impacts: { faisab: "+", risque: "+L", cout: "-" } }] },
    { label: "Suivi", options: [{ label: "Revue mensuelle", does: "Fait le point sur les risques une fois par mois.", impacts: {} }, { label: "Suivi hebdomadaire", does: "Fait le point chaque semaine.", impacts: { risque: "+L", qualite: "+L", cout: "-L" } }] },
  ],
};

export function pickTemplate(text: string): Template {
  const n = norm(text);
  let best: Template = GENERIC, score = 0;
  for (const t of TEMPLATES) { const m = n.match(new RegExp(t.match.source, "g")); if (m && m.length > score) { best = t; score = m.length; } }
  // Approvisionnement : spécialisé selon la situation (stock, transport, prévision…).
  if (best.id === "supply") { const p = supplyProfileFor(undefined, text); if (p) return specialize(best, p); }
  return best;
}

/** Famille d'un libellé de critère (utilisé pour relier critères cités et effets usuels). */
export function familyOf(label: string): Fam | undefined {
  const k = norm(label);
  return /risque|reduire|rupture|dependance|fiabil/.test(k) ? "risque" : /cout|budget|investissement|prix/.test(k) ? "cout" : /rapid|delai|vitesse/.test(k) ? "rapide" : /croissance|part de marche|chiffre|capacite de production|effet sur/.test(k) ? "croissance" : /qualite|service|satisfaction/.test(k) ? "qualite" : /faisab|simpl|integration|execution/.test(k) ? "faisab" : /flexib|reversib|pic/.test(k) ? "flex" : /carbone|environ|rse/.test(k) ? "env" : undefined;
}

const REASON: Record<Fam, [string, string]> = {
  risque: ["réduit l'exposition au risque", "ajoute un risque"],
  cout: ["allège la dépense", "demande une dépense supplémentaire"],
  rapide: ["agit vite", "demande du temps de mise en place"],
  croissance: ["apporte du volume ou des revenus", "freine le développement"],
  qualite: ["améliore le service rendu", "dégrade le service rendu"],
  faisab: ["est simple à mettre en œuvre", "est complexe à mettre en œuvre"],
  flex: ["garde de la marge de manœuvre", "réduit la marge de manœuvre"],
  env: ["réduit les émissions", "augmente les émissions"],
};
const STRENGTH: Record<string, string> = { "++": "fortement", "+": "", "+L": "un peu", "--": "fortement", "-": "", "-L": "un peu" };
/** Raison qualitative d'un effet supposé (jamais un chiffre). */
export function impactReason(option: string, fam: Fam, level: QualitativeImpact): string | undefined {
  if (level === "0" || level === "U") return undefined;
  const good = level.startsWith("+");
  const [g, b] = REASON[fam];
  const adv = STRENGTH[level];
  return `« ${option} » ${adv ? `${adv} : ` : ""}${good ? g : b}.`;
}
/** Résumé d'une option à partir de ses effets supposés, faute de description métier. */
export function optionSummary(imp: Imp): string {
  const up = (Object.keys(imp) as Fam[]).filter(f => imp[f]?.startsWith("+")).map(f => REASON[f][0]);
  const down = (Object.keys(imp) as Fam[]).filter(f => imp[f]?.startsWith("-")).map(f => REASON[f][1]);
  if (!up.length && !down.length) return "Effets à préciser.";
  return [up.length ? `Elle ${up.join(", ")}` : "", down.length ? `${up.length ? "mais" : "Elle"} ${down.join(", ")}` : ""].filter(Boolean).join(", ") + " (à confirmer).";
}

export interface BuiltModel { criteria: AtelierCriterion[]; leviersDef: AtelierLevierDef[]; scenarios: AtelierScenario[]; template: Template; mainLeverId: string }

const PALETTE = ["#4743E6", "#151D52", "#8583EE", "#2B3380", "#6d5ef5", "#3b3f8f"];
const IMP_ORDER: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];
const poids = (i: ImportanceBadge) => i === "Essentiel" ? 90 : i === "Important" ? 60 : i === "Secondaire" ? 30 : 10;

/**
 * Construit le modèle complet : arbre MOE → MOP → TPM du gabarit, levier
 * principal (les options de la question, 2 à 4) et leviers complémentaires
 * du métier. `emphasis` : importance par famille (mots de la description) ;
 * `mainImpacts` : effets de chaque option principale par famille.
 */
export function buildModel(opts: {
  prefix: string; template: Template; mainOptions: string[]; mainImpacts: (option: string) => Imp;
  emphasis?: Partial<Record<Fam, ImportanceBadge>>; alertKpi?: string; origin?: "aura-llm" | "aura-heuristique";
}): BuiltModel {
  const { prefix, template } = opts;
  const origin = opts.origin ?? "aura-heuristique";
  const leaves: { id: string; fam: Fam }[] = [];
  let k = 0;
  const id = () => `${prefix}-c${k++}`;
  const criteria: AtelierCriterion[] = template.moes.map((moe, mi) => ({
    id: id(), label: moe.label, importance: "Important", poids: 60, description: `Objectif : ${moe.label.toLowerCase()}, mesuré par ${moe.mops.map(m => m.label.toLowerCase()).join(" et ")}.`, level: "MOE",
    children: moe.mops.map(mop => ({
      id: id(), label: mop.label, importance: "Important", poids: 60, description: `Critère : ${mop.label.toLowerCase()}, lu sur ${mop.tpms.map(t => t.label.toLowerCase()).join(", ")}.`, level: "MOP",
      children: mop.tpms.map((t, ti) => {
        const alert = opts.alertKpi && mi === 0 && ti === 0 && t.fam === "risque";
        const imp: ImportanceBadge = alert ? "Essentiel" : opts.emphasis?.[t.fam] ?? t.imp ?? "Important";
        const c: AtelierCriterion = { id: id(), label: alert ? `Réduire : ${opts.alertKpi}` : t.label, importance: imp, poids: poids(imp), description: alert ? `Indicateur de l'alerte : la décision doit le ramener dans la zone normale. ${t.why ?? ""}`.trim() : t.why ?? "", level: "TPM" };
        leaves.push({ id: c.id, fam: t.fam });
        return c;
      }),
    })),
  }));
  // Importance d'un MOP / MOE : la plus forte de ses indicateurs.
  const lift = (c: AtelierCriterion): ImportanceBadge => {
    if (!c.children?.length) return c.importance;
    const m = c.children.map(lift).reduce((a, b) => IMP_ORDER.indexOf(a) >= IMP_ORDER.indexOf(b) ? a : b);
    c.importance = m; c.poids = poids(m);
    return m;
  };
  criteria.forEach(lift);
  const optionOf = (lid: string, i: number, label: string, imp: Imp, does?: string): AtelierOptionDef => ({
    id: `${lid}-o${i}`, label, justification: does ?? optionSummary(imp),
    impactReasons: Object.fromEntries(leaves.map(l => [l.id, impactReason(label, l.fam, imp[l.fam] ?? "0")]).filter(([, r]) => r)) as Record<string, string>,
    impacts: Object.fromEntries(leaves.map(l => [l.id, imp[l.fam] ?? "0"])),
    impactOrigins: Object.fromEntries(leaves.map(l => [l.id, origin])),
  });
  const mainId = `${prefix}-L0`;
  const main: AtelierLevierDef = { id: mainId, label: "Option retenue", type: "decision", options: opts.mainOptions.slice(0, TARGETS.options[1]).map((o, i) => optionOf(mainId, i, o, opts.mainImpacts(o))) };
  const extra: AtelierLevierDef[] = template.levers.map((l, li) => {
    const lid = `${prefix}-L${li + 1}`;
    return { id: lid, label: l.label, type: "decision", options: l.options.map((o, i) => optionOf(lid, i, o.label, o.impacts, o.does)) };
  });
  const leviersDef = [main, ...extra];
  return { criteria, leviersDef, scenarios: scenariosForModel(leviersDef, mainId), template, mainLeverId: mainId };
}

/** Un scénario par option du levier principal ; les autres leviers à leur première option (situation actuelle). */
export function scenariosForModel(leviersDef: AtelierLevierDef[], mainId = leviersDef[0]?.id): AtelierScenario[] {
  const main = leviersDef.find(l => l.id === mainId);
  if (!main) return [];
  return main.options.map((o, i) => ({
    id: `sc-${o.id}`, label: o.label, color: PALETTE[i % PALETTE.length], description: "",
    leviers: leviersDef.map(l => ({ id: l.id, label: l.label, type: l.type, valeur: l.id === main.id ? o.id : l.options[0].id })),
    scores: {}, valeur: 50, faisabilite: 50,
  }));
}

/**
 * Complète la matrice d'impacts d'une DÉMO (jamais d'une étude réelle) :
 * chaque case vide ou « ? » reçoit l'effet usuel de l'option sur la famille
 * de l'indicateur quand un indice métier existe, sinon « sans effet direct »,
 * toujours avec sa justification et marqué « à confirmer ». Aucun chiffre.
 */
export function completeDemoImpacts(leviersDef: AtelierLevierDef[], criteria: AtelierCriterion[], hints: (option: string) => Imp): AtelierLevierDef[] {
  const leaves: AtelierCriterion[] = [];
  const walk = (cs: AtelierCriterion[]) => cs.forEach(c => c.children?.length ? walk(c.children) : leaves.push(c));
  walk(criteria);
  return leviersDef.map(l => ({ ...l, options: l.options.map(o => {
    const imp = hints(o.label);
    const impacts = { ...o.impacts }, origins = { ...(o.impactOrigins ?? {}) }, reasons = { ...(o.impactReasons ?? {}) };
    for (const c of leaves) {
      const v = impacts[c.id];
      if (v !== undefined && v !== "U") continue;
      const f = familyOf(c.label);
      // Démo : on n'ajoute jamais de dégradation non documentée (elle créerait des points bloquants).
      const hinted = f ? imp[f] : undefined;
      const level: QualitativeImpact = hinted && hinted.startsWith("+") ? hinted : "0";
      impacts[c.id] = level;
      origins[c.id] = "aura-heuristique";
      reasons[c.id] = level === "0" ? `« ${o.label} » n'agit pas directement sur « ${c.label} » (à confirmer).` : impactReason(o.label, f!, level) ?? "";
    }
    return { ...o, impacts, impactOrigins: origins, impactReasons: reasons };
  }) }));
}

/** Jugements d'expert ajoutés aux démos pour départager des options à égalité (justifiés, à confirmer). */
export const DEMO_JUDGEMENTS: Record<string, { option: string; criterion: string; level: QualitativeImpact; reason: string }[]> = {
  telereleve: [{ option: "Internaliser", criterion: "Sécurité des données de relève", level: "+", reason: "Les données de relève restent traitées par les équipes internes : leur maîtrise s'améliore (à confirmer)." }, { option: "Sous-traiter", criterion: "Fiabilité réseau", level: "-L", reason: "Le prestataire est tenu par un contrat de niveau de service : la fiabilité ne se dégrade que faiblement (à confirmer)." }],
};

export function applyDemoJudgements(key: string, leviersDef: AtelierLevierDef[], criteria: AtelierCriterion[]): AtelierLevierDef[] {
  const js = DEMO_JUDGEMENTS[key];
  if (!js) return leviersDef;
  const leaves: AtelierCriterion[] = [];
  const walk = (cs: AtelierCriterion[]) => cs.forEach(c => c.children?.length ? walk(c.children) : leaves.push(c));
  walk(criteria);
  return leviersDef.map(l => ({ ...l, options: l.options.map(o => {
    const mine = js.filter(j => j.option === o.label);
    if (!mine.length) return o;
    const impacts = { ...o.impacts }, origins = { ...(o.impactOrigins ?? {}) }, reasons = { ...(o.impactReasons ?? {}) };
    for (const j of mine) { const c = leaves.find(x => x.label === j.criterion); if (!c) continue; impacts[c.id] = j.level; origins[c.id] = "aura-heuristique"; reasons[c.id] = j.reason; }
    return { ...o, impacts, impactOrigins: origins, impactReasons: reasons };
  }) }));
}
