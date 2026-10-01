// « Décider vite » : le dialogue écrit dans le MÊME modèle que le mode Détail
// (AtelierSession : critères, levier « Option retenue », scénarios, impacts).
// Générateur de secours sans clé : options lues dans la question, critères
// usuels, niveaux d'impact déduits des mots de chaque option, tous marqués
// « à confirmer ». Aucun chiffre n'est produit : uniquement des niveaux
// ordinaux (NUL, L, M, H) et un sens.
import type { AtelierCriterion, AtelierLevierDef, AtelierOptionDef, AtelierSession, ImportanceBadge, QualitativeImpact } from "./atelier-store";
import { setImpact } from "./decision-express";
import { buildModel, familyOf, pickTemplate, scenariosForModel, type Fam } from "./decision-templates";
import { getLeafCriteria } from "./atelier-compute";

export interface Proposal {
  options: string[];
  criteria: { label: string; importance: ImportanceBadge }[];
  impacts: Record<string, Record<string, QualitativeImpact>>; // option → critère → niveau
  source: "llm" | "heuristique";
  // Réponse riche (facultative ; le LLM la fournit, les gabarits la complètent) :
  enjeu?: string;                                  // reformulation de l'enjeu
  optionWhy?: Record<string, string>;              // option → ce qu'elle fait
  impactWhy?: Record<string, Record<string, string>>; // option → critère → raison de l'effet
  risques?: string[];                              // risques repérés
  /** Modèle propre au problème (LLM) : objectifs → critères → indicateurs, leviers et options ; sinon gabarit. */
  modele?: { objectifs: { label: string; criteres: { label: string; indicateurs: { label: string; why: string }[] }[] }[]; leviers: { label: string; options: { label: string; why: string }[] }[] };
  /** Contexte externe (PESTEL) : une phrase par dimension pertinente. */
  pestel?: Partial<Record<PestelKey, string>>;
  /** Questions de cadrage proposées (3 au plus). */
  questions?: string[];
  /** Extraits littéraux des documents joints qui ont servi à la déduction. */
  citations?: import("./doc-citations").Citation[];
  /** Contraintes tirées des documents joints (chacune appuyée par une citation). */
  contraintes?: string[];
}
export type PestelKey = "P" | "E" | "S" | "T" | "En" | "L";
export const PESTEL_LABELS: Record<PestelKey, string> = { P: "Politique", E: "Économique", S: "Social", T: "Technologique", En: "Environnemental", L: "Légal" };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// « Double source ou stock de sécurité pour SUP-003 ? » → ["Double source", "Stock de sécurité"]
export function optionsFromQuestion(q: string): string[] {
  let t = q.replace(/[?¿!]+/g, " ").trim();
  // Français et anglais (« … ou … ? », « should we … or … ? »).
  t = t.replace(/^(faut[- ]il|dois[- ]je|doit[- ]on|devons[- ]nous|choisir|quel(le)?s? (option|choix)( entre)?|entre|should (?:we|i)|do we|shall we|which (?:option|choice)(?: between)?|choose(?: between)?|between)\s+/i, "");
  t = t.replace(/\s+(pour|chez|sur|concernant|afin de|dans|for|at|on|regarding|to)\s+.*$/i, "");
  const parts = t.split(/\s*(?:,|;|\bou bien\b|\bou\b|\bor\b|\bvs\.?\b|\bversus\b|\bet\b(?=[^,]*$)|\band\b(?=[^,]*$))\s*/i).map(x => x.trim()).filter(x => x.length > 1);
  return [...new Set(parts.map(p => cap(p.replace(/^(l'|la |le |les |un |une |des |du |the |a |an )/i, ""))))].slice(0, 6);
}

// Critères usuels (3 à 5) selon les mots de la question.
export function criteriaFromQuestion(q: string, alertKpi?: string): Proposal["criteria"] {
  const n = norm(q);
  const out: Proposal["criteria"] = [{ label: alertKpi ? `Réduire : ${alertKpi}` : "Réduire le risque", importance: "Essentiel" }];
  out.push({ label: "Coût maîtrisé", importance: /cout|budget|prix|cher/.test(n) ? "Essentiel" : "Important" });
  out.push({ label: "Effet rapide", importance: /vite|rapide|urgence|delai|semaine|jours/.test(n) ? "Essentiel" : "Important" });
  if (/qualite|conform|client|service/.test(n)) out.push({ label: "Qualité de service", importance: "Important" });
  if (/faisab|simple|complex|equipe|ressource/.test(n)) out.push({ label: "Faisabilité", importance: "Secondaire" });
  return out.slice(0, 5);
}

// Effets usuels d'une option par famille de critère (hypothèses « à confirmer »).
// Familles de critères : voir decision-templates (Fam).
const HINTS: [RegExp, Partial<Record<Fam, QualitativeImpact>>][] = [
  // Stock immobilisé (BFR) : réduire les entrées, écouler, ou garder la couverture.
  [/(arret|suspen|gel|stop|reduction|reduire|report|freeze|halt|pause|cut).{0,20}(commande|approvisionnement|order|purchas|replenish)/, { risque: "++", cout: "+", rapide: "+", qualite: "-L" }],
  [/reappro|replenish|reassort|restock/, { risque: "+", cout: "-L", rapide: "-L", qualite: "+" }],
  [/promotion|promo|remise|destock|soldes|markdown|discount|clearance/, { risque: "+", cout: "-L", rapide: "+", qualite: "+L" }],
  [/(garder|conserver|maintenir|keep|maintain).{0,12}(couverture|stock|coverage|inventory)/, { risque: "--", cout: "-", rapide: "+", qualite: "+" }],
  [/double|dual|second|multi.?sourc|alternative supplier/, { risque: "++", cout: "-", rapide: "-", qualite: "+" }],
  [/nearshore|relocal|local|rapatri|reshor|onshor/, { risque: "++", cout: "--", rapide: "--", qualite: "+" }],
  [/stock|tampon|buffer|securite|safety|inventory/, { risque: "+", cout: "-", rapide: "+", qualite: "+" }],
  [/avion|aerien|accel|expedite|express|urgence|air|rush/, { rapide: "++", cout: "--", risque: "+", qualite: "+" }],
  [/navire|bateau|attendre|patienter|ship|vessel|wait/, { rapide: "--", cout: "+", risque: "-", qualite: "-" }],
  [/rerout|transfert|split|alternati|hub|transfer/, { risque: "+", cout: "-", rapide: "+" }],
  [/substitu|redesign|reconcep|replace/, { risque: "+", cout: "-", rapide: "--" }],
  [/allocation|priori|allocate/, { risque: "+", cout: "0", rapide: "+", qualite: "-L" }],
  [/audit|soutien|accompagn|correctif|support|coach/, { risque: "+", cout: "-", rapide: "-" }],
  [/acheter|achat|investir|construire|nouvelle ligne|nouvel equipement|buy|purchase|invest|build|new line|new equipment/, { cout: "--", rapide: "-", risque: "0", flex: "-", croissance: "+" }],
  [/louer|location|leasing|sous.?trait|externalis|rent|lease|outsourc/, { cout: "+", rapide: "+", risque: "-", flex: "++", faisab: "+" }],
  [/acquisition|racheter|rachat|fusion|acquire|merger/, { croissance: "++", risque: "-", cout: "--", rapide: "+", faisab: "-" }],
  [/alliance|partenariat|cooperation|joint|partnership/, { croissance: "+", risque: "+", cout: "+", rapide: "+" }],
  [/croissance interne|organique|interne|organic|in-house|internal/, { croissance: "+", risque: "+", cout: "0", rapide: "-" }],
  [/accepter|ne rien faire|statu quo|report|accept|do nothing|status quo|postpone/, { risque: "--", cout: "++", rapide: "0" }],
];
const family = (label: string): Fam | undefined => {
  const k = norm(label);
  return /risque|reduire|rupture/.test(k) ? "risque" : /cout|budget/.test(k) ? "cout" : /rapid|delai/.test(k) ? "rapide" : /croissance|part de marche/.test(k) ? "croissance" : /qualite|service/.test(k) ? "qualite" : /faisab|simpl/.test(k) ? "faisab" : /flexib/.test(k) ? "flex" : undefined;
};

/** Effets usuels d'une option, par famille de critère (hypothèses « à confirmer »). */
export function optionHints(option: string): Partial<Record<Fam, QualitativeImpact>> { return { ...(HINTS.find(([re]) => re.test(norm(option)))?.[1] ?? {}) }; }

export function heuristicImpacts(options: string[], criteria: Proposal["criteria"]): Proposal["impacts"] {
  const out: Proposal["impacts"] = {};
  for (const o of options) {
    const h = HINTS.find(([re]) => re.test(norm(o)))?.[1];
    out[o] = {};
    for (const c of criteria) { const f = family(c.label); out[o][c.label] = (h && f && h[f]) || "0"; }
  }
  return out;
}

export function heuristicProposal(question: string, alertKpi?: string, knownOptions?: string[]): Proposal {
  const options = knownOptions?.length ? knownOptions : optionsFromQuestion(question);
  const criteria = criteriaFromQuestion(question, alertKpi);
  return { options, criteria, impacts: heuristicImpacts(options, criteria), source: "heuristique" };
}

// Garde-fou : une proposition du modèle n'introduit aucun chiffre absent de la question.
export function sanitizeProposal(p: Partial<Proposal>, question: string): Proposal | null {
  // Garde-fou : le LLM ne calcule jamais. Une réponse qui contient un classement,
  // un gagnant ou un score est rejetée (repli sur le générateur sans clé) ;
  // le classement vient du seul moteur.
  if (llmClaimsResult(p)) return null;
  const digitsOk = (s: string) => (s.match(/\d+/g) ?? []).every(d => question.includes(d));
  const LEVELS: QualitativeImpact[] = ["++", "+", "+L", "0", "-L", "-", "--"];
  const IMPS: ImportanceBadge[] = ["Essentiel", "Important", "Secondaire", "Faible"];
  const options = (p.options ?? []).map(String).map(s => s.trim()).filter(s => s && s.length < 80 && digitsOk(s)).slice(0, 6);
  const criteria = (p.criteria ?? []).filter(c => c && typeof c.label === "string" && digitsOk(c.label)).map(c => ({ label: c.label.trim().slice(0, 60), importance: IMPS.includes(c.importance) ? c.importance : "Important" as ImportanceBadge })).slice(0, 5);
  if (options.length < 2 || criteria.length < 1) return null;
  const impacts: Proposal["impacts"] = {};
  for (const o of options) { impacts[o] = {}; for (const c of criteria) { const v = p.impacts?.[o]?.[c.label]; impacts[o][c.label] = LEVELS.includes(v as QualitativeImpact) ? v as QualitativeImpact : "0"; } }
  const clean = (x: unknown, max = 220) => typeof x === "string" && x.trim() && digitsOk(x) ? x.trim().slice(0, max) : undefined;
  const enjeu = clean(p.enjeu, 300);
  const optionWhy = Object.fromEntries(options.map(o => [o, clean(p.optionWhy?.[o])]).filter(([, v]) => v)) as Record<string, string>;
  const impactWhy: Proposal["impactWhy"] = {};
  for (const o of options) for (const c of criteria) { const v = clean(p.impactWhy?.[o]?.[c.label], 160); if (v) (impactWhy[o] ??= {})[c.label] = v; }
  const risques = (Array.isArray(p.risques) ? p.risques : []).map(r => clean(r, 140)).filter((r): r is string => !!r).slice(0, 5);
  return { options, criteria, impacts, source: "llm", enjeu, optionWhy, impactWhy, risques, modele: sanitizeModele(p.modele, clean), pestel: sanitizePestel(p.pestel, clean), questions: (Array.isArray(p.questions) ? p.questions : []).map(q => clean(q, 160)).filter((q): q is string => !!q).slice(0, 3) };
}
/** Modèle LLM retenu seulement s'il respecte les cibles : 1-2 objectifs, 2-3 critères, 5-8 indicateurs, 2-4 leviers de 2-4 options. */
function sanitizeModele(m: Proposal["modele"] | undefined, clean: (x: unknown, max?: number) => string | undefined): Proposal["modele"] {
  if (!m || !Array.isArray(m.objectifs) || !Array.isArray(m.leviers)) return undefined;
  const objectifs = m.objectifs.slice(0, 2).map(o => ({ label: clean(o?.label, 70) ?? "", criteres: (Array.isArray(o?.criteres) ? o.criteres : []).map(c => ({ label: clean(c?.label, 70) ?? "", indicateurs: (Array.isArray(c?.indicateurs) ? c.indicateurs : []).map(i => ({ label: (clean(i?.label, 80) ?? "").replace(/,?\s*Aura$/, ""), why: clean(i?.why, 180) ?? "" })).filter(i => i.label) })).filter(c => c.label && c.indicateurs.length) })).filter(o => o.label && o.criteres.length);
  const leviers = m.leviers.slice(0, 4).map(l => ({ label: clean(l?.label, 60) ?? "", options: (Array.isArray(l?.options) ? l.options : []).slice(0, 4).map(o => ({ label: clean(o?.label, 80) ?? "", why: clean(o?.why, 180) ?? "" })).filter(o => o.label) })).filter(l => l.label && l.options.length >= 2);
  // Ramené aux cibles plutôt que rejeté : 3 critères et 8 indicateurs au plus.
  let critBudget = 3, indBudget = 8;
  const kept = objectifs.map(o => ({ ...o, criteres: o.criteres.filter(() => critBudget-- > 0) })).filter(o => o.criteres.length);
  const nCritAll = kept.reduce((a, o) => a + o.criteres.length, 0);
  for (const o of kept) for (const c of o.criteres) { const share = Math.max(1, Math.floor(8 / nCritAll)); c.indicateurs = c.indicateurs.slice(0, Math.min(share + 1, indBudget)); indBudget -= c.indicateurs.length; }
  const nCrit = kept.reduce((a, o) => a + o.criteres.length, 0), nInd = kept.reduce((a, o) => a + o.criteres.reduce((b, c) => b + c.indicateurs.length, 0), 0);
  if (nCrit < 2 || nInd < 5 || leviers.length < 2) return undefined;
  objectifs.splice(0, objectifs.length, ...kept);
  return { objectifs, leviers };
}
function sanitizePestel(p: unknown, clean: (x: unknown, max?: number) => string | undefined): Proposal["pestel"] {
  if (!p || typeof p !== "object") return undefined;
  const out: Proposal["pestel"] = {};
  for (const k of Object.keys(PESTEL_LABELS) as PestelKey[]) { const v = clean((p as Record<string, unknown>)[k], 160); if (v) out[k] = v; }
  return Object.keys(out).length ? out : undefined;
}

// Écrit la proposition dans le modèle partagé : gabarit métier (MOE → MOP →
// TPM, leviers complémentaires ; decision-templates) et levier principal
// portant les options de la question. Cibles : 3 à 5 leviers, 2 à 4 options,
// 5 à 8 indicateurs sous 2 ou 3 MOP et 1 ou 2 MOE.
export function applyProposal(session: AtelierSession, p: Proposal, question: string, context = ""): Partial<AtelierSession> {
  const origin = p.source === "llm" ? "aura-llm" as const : "aura-heuristique" as const;
  const base = pickTemplate(`${question} ${context} ${p.options.join(" ")}`);
  // Modèle propre au problème (LLM, cibles vérifiées) ; sinon gabarit métier.
  const template: typeof base = p.modele ? {
    ...base, id: `${base.id}-llm`,
    moes: p.modele.objectifs.map(o => ({ label: o.label, mops: o.criteres.map(c => ({ label: c.label, tpms: c.indicateurs.map(i => ({ label: i.label, fam: familyOf(i.label) ?? "qualite", why: i.why })) })) })),
    levers: p.modele.leviers.map(l => ({ label: l.label, options: l.options.map(o => ({ label: o.label, does: o.why, impacts: optionHints(o.label) })) })),
  } : base;
  const emphasis: Partial<Record<Fam, ImportanceBadge>> = {};
  for (const c of p.criteria) { const f = familyOf(c.label); if (f && (!emphasis[f] || IMP_ORDER.indexOf(c.importance) > IMP_ORDER.indexOf(emphasis[f]!))) emphasis[f] = c.importance; }
  const mainImpacts = (o: string) => {
    const out: Partial<Record<Fam, QualitativeImpact>> = { ...(HINTS.find(([re]) => re.test(norm(o)))?.[1] ?? {}) };
    for (const c of p.criteria) { const f = familyOf(c.label); const v = p.impacts[o]?.[c.label]; if (f && v && v !== "0") out[f] = v; }
    return out;
  };
  const alertKpi = p.criteria.find(c => c.label.startsWith("Réduire : "))?.label.slice("Réduire : ".length);
  const m = buildModel({ prefix: `q${Date.now().toString(36)}`, template, mainOptions: p.options, mainImpacts, emphasis, alertKpi, origin });
  // Réponse riche du LLM : ce que fait chaque option, raison des effets (par famille de critère).
  const main = m.leviersDef[0];
  const leaves = getLeafCriteria(m.criteria);
  main.options = main.options.map(o => {
    const why = p.optionWhy?.[o.label];
    const reasons = { ...(o.impactReasons ?? {}) };
    for (const c of p.criteria) {
      const r = p.impactWhy?.[o.label]?.[c.label]; const f = familyOf(c.label);
      if (r && f) for (const l of leaves) if (familyOf(l.label) === f) reasons[l.id] = r;
    }
    return { ...o, justification: why ?? o.justification, impactReasons: reasons };
  });
  // Contexte externe (PESTEL) : proposé par le LLM ou par le secours ; il alimente les risques.
  const pestel = p.pestel ?? pestelFallback(template.id);
  const pestelRisks = (Object.entries(pestel) as [PestelKey, string][]).slice(0, 2).map(([k, v]) => `${PESTEL_LABELS[k]} : ${v}`);
  const risques = [...(p.risques?.length ? p.risques : template.risques ?? []), ...pestelRisks.filter(r => !(p.risques ?? []).includes(r))].slice(0, 7);
  const questions = p.questions?.length ? p.questions : CADRAGE_FALLBACK;
  return { title: question || session.title, contextRaw: session.contextRaw || question, criteria: m.criteria, leviersDef: m.leviersDef, scenarios: m.scenarios, modelValidated: true,
    elicitation: { ...(session.elicitation ?? {}), risques, pestelSelected: Object.keys(pestel), pestelAnswers: pestel, questionsCadrage: questions } as AtelierSession["elicitation"] };
}

// ── Corriger en une phrase ─────────────────────────────────────────────────
/** Tous les nœuds de l'arbre (MOE, MOP, TPM), en profondeur. */
export function flatCriteria(cs: AtelierCriterion[]): AtelierCriterion[] { return cs.flatMap(c => [c, ...flatCriteria(c.children ?? [])]); }
/** Levier principal : celui dont les options portent les scénarios. */
export function mainLever(session: AtelierSession): AtelierLevierDef | undefined {
  const ids = session.scenarios.map(s => s.leviers.map(l => l.valeur));
  return session.leviersDef.find(l => new Set(session.scenarios.map(sc => sc.leviers.find(x => x.id === l.id)?.valeur)).size > 1 || (session.scenarios.length <= 1 && l.label === "Option retenue")) ?? (ids.length ? undefined : session.leviersDef[0]);
}
function withMain(session: AtelierSession, lev: AtelierLevierDef): Partial<AtelierSession> {
  const leviersDef = session.leviersDef.map(l => l.id === lev.id ? lev : l);
  return { leviersDef, scenarios: scenariosForModel(leviersDef, lev.id) };
}
const IMP_ORDER: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];
function findByLabel<T extends { label: string }>(items: T[], text: string): T | undefined {
  const t = norm(text);
  if (!t) return undefined;
  const words = t.split(" ").filter(w => w.length > 3);
  return items.find(i => norm(i.label) === t) ?? items.find(i => norm(i.label).includes(t) || t.includes(norm(i.label)))
    ?? items.find(i => words.some(w => norm(i.label).includes(w.replace(/s$/, ""))));
}
const shift = (imp: ImportanceBadge, d: number) => IMP_ORDER[Math.max(0, Math.min(3, IMP_ORDER.indexOf(imp) + d))];

export function applyCorrection(session: AtelierSession, sentence: string): { patch: Partial<AtelierSession>; understood: string } | null {
  const s = sentence.trim();
  const crits = flatCriteria(session.criteria);
  const mapTree = (f: (c: AtelierCriterion) => AtelierCriterion) => { const rec = (cs: AtelierCriterion[]): AtelierCriterion[] => cs.map(c => f(c.children ? { ...c, children: rec(c.children) } : c)); return rec(session.criteria); };
  const setImp = (id: string, importance: ImportanceBadge) => ({ criteria: mapTree(c => c.id === id ? { ...c, importance, locked: true } : c) });
  let m = s.match(/^(?:l'|la |le |les )?(.+?)\s+compte\s+plus\s+que\s+(?:l'|la |le |les )?(.+?)[.!]?$/i);
  if (m) {
    const a = findByLabel(crits, m[1]), b = findByLabel(crits, m[2]);
    if (a && b && a.id !== b.id) {
      const up = shift(a.importance, IMP_ORDER.indexOf(a.importance) <= IMP_ORDER.indexOf(b.importance) ? 1 : 0);
      const down = IMP_ORDER.indexOf(up) <= IMP_ORDER.indexOf(b.importance) ? shift(b.importance, -1) : b.importance;
      return { patch: { criteria: mapTree(c => c.id === a.id ? { ...c, importance: up, locked: true } : c.id === b.id ? { ...c, importance: down, locked: true } : c) }, understood: `« ${a.label} » passe à ${up}, « ${b.label} » à ${down}.` };
    }
  }
  m = s.match(/^(?:l'|la |le |les )?(.+?)\s+(?:est|compte)\s+(?:tr[eè]s\s+|vraiment\s+)?(essentiel(?:le)?|prioritaire|important(?:e)?|secondaire|peu important(?:e)?|sans importance|n[' ]?est pas important(?:e)?)[.!]?$/i);
  if (m) {
    const c = findByLabel(crits, m[1]);
    if (c) {
      const w = norm(m[2]);
      const imp: ImportanceBadge = /essentiel|prioritaire/.test(w) ? "Essentiel" : /peu|sans|pas/.test(w) ? "Faible" : /secondaire/.test(w) ? "Secondaire" : "Important";
      return { patch: setImp(c.id, imp), understood: `« ${c.label} » : importance ${imp}.` };
    }
  }
  const lever = mainLever(session);
  m = s.match(/^(?:ajoute(?:r|z)?|ajout(?:e|er) l'option|il manque)\s+(?:l'option\s+|le critère\s+|le crit[eè]re\s+)?(.+?)[.!]?$/i);
  if (m) {
    const label = cap(m[1].trim());
    if (/crit[eè]re/i.test(s)) { const nc: AtelierCriterion = { id: `q-c${Date.now().toString(36)}`, label, importance: "Important", poids: 60, description: "Ajouté dans le dialogue.", level: "TPM" }; const lastMop = [...crits].reverse().find(c => c.children?.length && !c.children[0].children?.length); return { patch: { criteria: lastMop ? mapTree(c => c.id === lastMop.id ? { ...c, children: [...(c.children ?? []), nc] } : c) : [...session.criteria, nc] }, understood: `Critère ajouté : « ${label} ».` }; }
    if (lever) {
      const lev = { ...lever, options: [...lever.options, { id: `${lever.id}-o${Date.now().toString(36)}`, label, impacts: {} }] };
      return { patch: withMain(session, lev), understood: `Option ajoutée : « ${label} » (effets à préciser).` };
    }
  }
  m = s.match(/^(?:retire(?:r|z)?|supprime(?:r|z)?|enl[eè]ve(?:r|z)?)\s+(?:l'option\s+|le crit[eè]re\s+)?(.+?)[.!]?$/i);
  if (m) {
    const o = lever && findByLabel(lever.options, m[1]);
    if (o && lever && lever.options.length > 2) {
      const lev = { ...lever, options: lever.options.filter(x => x.id !== o.id) };
      return { patch: withMain(session, lev), understood: `Option retirée : « ${o.label} ».` };
    }
    const c = findByLabel(crits.filter(x => !x.children?.length), m[1]);
    if (c && getLeafCriteria(session.criteria).length > 1) { const rec = (cs: AtelierCriterion[]): AtelierCriterion[] => cs.filter(x => x.id !== c.id).map(x => x.children ? { ...x, children: rec(x.children) } : x); return { patch: { criteria: rec(session.criteria) }, understood: `Critère retiré : « ${c.label} ».` }; }
  }
  m = s.match(/^(?:l'|la |le |les )?(.+?)\s+(am[eé]liore\s+(?:beaucoup|fortement|un peu)?|d[eé]grade\s+(?:beaucoup|fortement|un peu)?|est\s+(?:tr[eè]s\s+)?(?:bon|bonne|mauvais|mauvaise|favorable|d[eé]favorable)\s+pour|n'a pas d'effet sur|est neutre sur)\s*(?:l'|la |le |les )?(.+?)[.!]?$/i);
  if (m && lever) {
    const o = findByLabel(lever.options, m[1]), c = findByLabel(crits.filter(x => !x.children?.length), m[3]) ?? findByLabel(crits, m[3]);
    if (o && c) {
      const v = norm(m[2]);
      const strong = /beaucoup|fortement|tres/.test(v), weak = /un peu/.test(v);
      const good = /amelior|bon|favorable/.test(v) && !/defavorable|mauvais/.test(v);
      const neutral = /pas d effet|neutre/.test(v);
      const level: QualitativeImpact = neutral ? "0" : good ? (strong ? "++" : weak ? "+L" : "+") : (strong ? "--" : weak ? "-L" : "-");
      return { patch: setImpact(session, o.id, c.id, level), understood: `« ${o.label} » sur « ${c.label} » : ${neutral ? "NUL" : `${strong ? "H" : weak ? "L" : "M"} ${good ? "favorable" : "défavorable"}`}.` };
    }
  }
  return null;
}

// ── Déduction complète depuis une description ──────────────────────────────
// Tout ce que captaient Comprendre et Impacter : objectif, horizon, parties
// prenantes, exigences non négociables, contraintes, attitude, options (levier),
// critères et poids, niveaux d'impact. Chaque déduction garde sa source.
export interface Deduction { field: "enjeu" | "objectif" | "options" | "critere" | "impacts" | "attitude" | "contraintes" | "horizon" | "parties" | "risques"; label: string; value: string; source: string; hypothesis: boolean }

const sentences = (t: string) => t.split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(Boolean);
const quote = (s: string) => `« ${s.length > 90 ? `${s.slice(0, 89)}…` : s} »`;

// Mots → critère usuel, avec son libellé.
const CRITERIA_WORDS: [RegExp, string][] = [
  [/\b(cout|couts|budget|prix|cher|economi|rentab|capex|opex|marge|tresorerie|cost|costs|price|expensive|margin|cash|spend)/, "Coût maîtrisé"],
  [/\b(vite|rapide|rapidement|delai|delais|urgence|urgent|semaines?|tot|fast|quick|quickly|speed|lead time|weeks?|asap|soon)\b/, "Effet rapide"],
  [/\b(risque|rupture|securi|continuite|fiabil|resilien|dependance|risk|stockout|shortage|secur|continuity|reliab|dependen)/, "Réduire le risque"],
  [/\b(qualite|conformite|defaut|client|service|satisfaction|quality|compliance|defect|customer)/, "Qualité de service"],
  [/\b(faisab|simple|complex|equipe|competence|ressource|mise en oeuvre|feasib|team|skills?|resource|implementation)/, "Faisabilité"],
  [/\b(croissance|chiffre d affaires|ca|marche|part de marche|revenu|growth|revenue|market share|market)/, "Croissance"],
  [/\b(carbone|environnement|durab|rse|co2|carbon|environment|sustainab|esg)/, "Impact environnemental"],
  [/\b(flexib|reversib|agilite|adaptab|agility)/, "Flexibilité"],
];
const STRONG = /\b(surtout|priorit|avant tout|crucial|imperati|absolument|essentiel|critique|indispensable|plus que tout|le plus important|above all|most important|critical|essential|must|top priority|key)/;
const COMPARE = /\b(compte plus que|compte davantage que|plus important(?:e)? que|prime sur|passe avant|matters more than|more important than|comes before)\b/;
const WEAK = /\b(si possible|idealement|accessoirement|secondaire|un peu|if possible|ideally|secondary|nice to have)\b/;

export interface DeducedModel { proposal: Proposal; deductions: Deduction[]; objectif: string; horizon: string; contraintes: string[]; parties: string; attitude: AtelierSession["attitude"] }

export function deduceFromDescription(text: string, opts: { alertKpi?: string; knownOptions?: string[] } = {}): DeducedModel {
  const all = sentences(text);
  const n = norm(text);
  const deductions: Deduction[] = [];
  // Options : phrase interrogative ou alternative explicite.
  const optSentence = all.find(s => /\bou\b|\bor\b|\bvs\b|\bentre\b|\bbetween\b|\?/.test(s.toLowerCase())) ?? all[0] ?? "";
  const options = opts.knownOptions?.length ? opts.knownOptions : optionsFromQuestion(optSentence);
  deductions.push({ field: "options", label: "Options", value: options.join(" · ") || "à préciser", source: opts.knownOptions?.length ? "la règle de l'alerte" : quote(optSentence), hypothesis: !opts.knownOptions?.length });
  // Objectif.
  const objSentence = all.find(s => /\b(objectif|afin de|pour (garantir|reduire|réduire|assurer|tenir|améliorer|ameliorer|eviter|éviter)|je veux|nous voulons|il faut|viser|garantir|goal|objective|aim|we want|i want|we need|to (?:avoid|reduce|ensure|keep|improve))\b/i.test(s));
  let objectif = objSentence ? objSentence.replace(/^.*?(objectif\s*:?\s*|afin de\s+|je veux\s+|nous voulons\s+|(?:the )?(?:goal|objective)(?: is)?\s*:?\s*|we want to\s+|i want to\s+|we need to\s+)/i, "").replace(/[.!]$/, "") : opts.alertKpi ? `Réduire : ${opts.alertKpi}` : "";
  let objectifSource = objSentence ? quote(objSentence) : opts.alertKpi ? "l'alerte" : "";
  // Critères et poids.
  const found = new Map<string, { importance: ImportanceBadge; source: string }>();
  if (opts.alertKpi) found.set(`Réduire : ${opts.alertKpi}`, { importance: "Essentiel", source: "l'indicateur de l'alerte" });
  for (const s of all) {
    // « A compte plus que B » : A essentiel, B secondaire ; sinon, un mot fort
    // rend essentiels les critères de la même proposition de phrase.
    const ns0 = norm(s);
    const cmp = ns0.match(COMPARE);
    const clauses = cmp ? [{ text: ns0.slice(0, cmp.index), imp: "Essentiel" as ImportanceBadge }, { text: ns0.slice((cmp.index ?? 0) + cmp[0].length), imp: "Secondaire" as ImportanceBadge }] : ns0.split(/,| et (?=[a-z])/).map(t => ({ text: t, imp: undefined as ImportanceBadge | undefined }));
    for (const cl of clauses) for (const [re, label] of CRITERIA_WORDS) {
      const ns = cl.text;
      if (!re.test(ns)) continue;
      const lbl = label === "Réduire le risque" && opts.alertKpi ? `Réduire : ${opts.alertKpi}` : label;
      const imp: ImportanceBadge = cl.imp ?? (STRONG.test(ns) ? "Essentiel" : WEAK.test(ns) ? "Secondaire" : "Important");
      const prev = found.get(lbl);
      if (!prev || IMP_ORDER.indexOf(imp) > IMP_ORDER.indexOf(prev.importance)) found.set(lbl, { importance: imp, source: quote(s) });
    }
  }
  // Toujours au moins le risque, le coût et la rapidité (3 critères).
  for (const [lbl, why] of [[opts.alertKpi ? `Réduire : ${opts.alertKpi}` : "Réduire le risque", "critère de base d'une décision"], ["Coût maîtrisé", "critère de base d'une décision"], ["Effet rapide", "critère de base d'une décision"]] as const) {
    if (found.size >= 3) break;
    if (!found.has(lbl)) found.set(lbl, { importance: "Important", source: why });
  }
  const criteria = [...found].slice(0, 5).map(([label, v]) => ({ label, importance: v.importance }));
  // Sans objectif explicite : celui qui ressort du critère le plus important.
  if (!objectif) { const top = [...found].find(([, v]) => v.importance === "Essentiel"); if (top) { objectif = `Privilégier « ${top[0]} »`; objectifSource = top[1].source; } }
  if (objectif) deductions.push({ field: "objectif", label: "Objectif", value: cap(objectif), source: objectifSource || "la description", hypothesis: !objSentence });
  for (const [label, v] of [...found].slice(0, 5)) deductions.push({ field: "critere", label, value: v.importance, source: v.source, hypothesis: v.source === "critère de base d'une décision" });
  const impacts = heuristicImpacts(options, criteria);
  deductions.push({ field: "impacts", label: "Niveaux d'impact", value: `${options.length} options × ${criteria.length} critères`, source: "les mots de chaque option", hypothesis: true });
  // Attitude.
  const prudent = /\b(prudent|prudence|securi|eviter|surtout pas|ne pas risquer|aucun risque|cautious|careful|avoid|safe|no risk)/.test(n), bold = /\b(audac|ambitieu|oser|agressi|gagner gros|pari|bold|ambitious|dare|aggressive|bet)/.test(n);
  const attitude: AtelierSession["attitude"] = bold && !prudent ? "Optimiste" : "Pessimiste";
  deductions.push({ field: "attitude", label: "Attitude face au risque", value: attitude === "Pessimiste" ? "Prudente" : "Audacieuse", source: prudent || bold ? quote(all.find(s => /(prudent|securi|eviter|audac|ambitieu|oser)/.test(norm(s))) ?? "") : "par défaut (prudente)", hypothesis: !(prudent || bold) });
  // Contraintes, horizon, parties prenantes.
  const contraintes = all.filter(s => /\b(sans|pas plus de|au plus|maximum|obligatoire|impossible|interdit|doit|imperatif|budget limite|contrainte|non negociable|without|no more than|at most|mandatory|must not|cannot|forbidden|constraint|non negotiable)\b/.test(norm(s))).map(s => s.replace(/[.!]$/, ""));
  deductions.push({ field: "contraintes", label: "Contraintes", value: contraintes.length ? contraintes.join(" · ") : "aucune mentionnée", source: contraintes.length ? "phrases contenant une limite ou une obligation" : "rien de tel dans la description", hypothesis: false });
  const hz = text.match(/(d'ici\s+[^,.;]+|sous\s+\d+\s+(?:jours?|semaines?|mois|ans?)|\bcette (?:semaine|année|annee)|\bce (?:mois|trimestre)|\bavant (?:la fin|fin)\s+[^,.;]+|\bby the end of\s+[^,.;]+|\bwithin\s+\d+\s+(?:days?|weeks?|months?|years?)|\bthis (?:week|month|quarter|year)|\bbefore\s+[^,.;]+)/i)?.[0] ?? "";
  if (hz) deductions.push({ field: "horizon", label: "Horizon", value: hz, source: quote(hz), hypothesis: false });
  const partiesWords = [...new Set((n.match(/\b(clients?|fournisseurs?|equipes?|direction|comite|actionnaires?|usines?|magasins?|salaries|partenaires?|customers?|suppliers?|teams?|management|board|shareholders?|plants?|stores?|employees|partners?)\b/g) ?? []))];
  const parties = partiesWords.join(", ");
  if (parties) deductions.push({ field: "parties", label: "Parties prenantes", value: parties, source: "mots de la description", hypothesis: false });
  // Enjeu reformulé et risques du métier (gabarit) : hypothèses, sans chiffre inventé.
  const tpl = pickTemplate(`${text} ${options.join(" ")}`);
  const q = options.map(o => `« ${o} »`);
  const list = q.length > 1 ? `${q.slice(0, -1).join(", ")} et ${q[q.length - 1]}` : q[0] ?? "plusieurs options";
  const low = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  const enjeu = `Choisir entre ${list}${objectif ? ` pour ${low(objectif)}` : ""}${contraintes.length ? ` (${low(contraintes[0])})` : ""}${hz ? `, ${hz}` : ""}.`;
  deductions.unshift({ field: "enjeu", label: "Enjeu", value: enjeu, source: "reformulation de la description", hypothesis: true });
  deductions.push({ field: "risques", label: "Risques repérés", value: (tpl.risques ?? []).join(" · "), source: `risques usuels d'une décision « ${tpl.label.toLowerCase()} »`, hypothesis: true });
  return { proposal: { options, criteria, impacts, source: "heuristique", enjeu, risques: tpl.risques }, deductions, objectif: cap(objectif), horizon: hz, contraintes, parties, attitude };
}

// Écrit la déduction dans le modèle partagé (mêmes champs que Comprendre).
export function applyDeduction(session: AtelierSession, d: DeducedModel, description: string): Partial<AtelierSession> {
  const base = applyProposal(session, d.proposal, session.alertId ? session.title : (sentences(description).find(s => s.includes("?")) ?? sentences(description)[0] ?? description), description);
  const eli = { ...(session.elicitation ?? {}), ...(base.elicitation ?? {}), step: 6, objectif: d.objectif, horizon: d.horizon, impactes: d.parties, exigencesNonNeg: d.contraintes.join(" ; "), contraintesDIP: d.contraintes.join(" ; ") };
  return { ...base, contextRaw: description, attitude: d.attitude, contraintes: d.contraintes, elicitation: eli as AtelierSession["elicitation"], caseType: session.caseType ?? "strategique" };
}

// ── Questions de complétude : seulement celles qui changent le classement ──
export interface CompletenessQuestion { id: string; text: string; why: string; choices: { label: string; hint?: string; patch: Partial<AtelierSession> }[]; suggestion?: string }

export function completenessQuestions(session: AtelierSession, rank: (s: AtelierSession) => { id: string }[], max = 3): CompletenessQuestion[] {
  const out: CompletenessQuestion[] = [];
  const winner = (patch: Partial<AtelierSession>) => rank({ ...session, ...patch })[0]?.id;
  const differ = (patches: Partial<AtelierSession>[]) => new Set(patches.map(winner)).size > 1;
  // 1. Essentiel manquant : options ou objectif.
  if (session.scenarios.length < 2) out.push({ id: "options", text: "Quelles options envisagez-vous ? (au moins deux, séparées par « ou »)", why: "Sans deux options, il n'y a rien à comparer.", choices: [], suggestion: session.scenarios.map(x => x.label).join(" ou ") });
  if (!session.elicitation?.objectif?.trim()) out.push({ id: "objectif", text: "Quel est l'objectif principal de cette décision ?", why: "L'objectif fixe le critère le plus important.", choices: [] });
  if (out.length) return out.slice(0, max);
  // 2. Attitude face au risque, si elle change le gagnant.
  const att = [{ attitude: "Pessimiste" as const }, { attitude: "Optimiste" as const }];
  if (differ(att)) out.push({ id: "attitude", text: "Face au risque, préférez-vous la prudence ou l'audace ?", why: "Le gagnant n'est pas le même selon votre attitude.", choices: [{ label: "Prudence", hint: "Juge chaque option sur ce qu'elle peut dégrader au pire ; un effet inconnu compte comme un risque.", patch: att[0] }, { label: "Audace", hint: "Juge chaque option sur ce qu'elle peut apporter au mieux ; un effet inconnu ne pénalise pas.", patch: att[1] }], suggestion: "Prudence" });
  // 3. Poids : quel critère compte le plus, quand la réponse change le gagnant.
  const leaves = getLeafCriteria(session.criteria);
  const setImpTree = (m: Record<string, ImportanceBadge>) => { const rec = (cs: AtelierCriterion[]): AtelierCriterion[] => cs.map(c => ({ ...(m[c.id] ? { ...c, importance: m[c.id] } : c), ...(c.children ? { children: rec(c.children) } : {}) })); return rec(session.criteria); };
  const crits = leaves;
  for (let i = 0; i < crits.length && out.length < max; i++) for (let j = i + 1; j < crits.length && out.length < max; j++) {
    const a = crits[i], b = crits[j];
    if (a.importance !== b.importance) continue; // ordre déjà connu : rien à demander
    const pa = { criteria: setImpTree({ [a.id]: "Essentiel", [b.id]: "Secondaire" }) };
    const pb = { criteria: setImpTree({ [b.id]: "Essentiel", [a.id]: "Secondaire" }) };
    if (differ([pa, pb])) out.push({ id: `poids-${a.id}-${b.id}`, text: `Qu'est-ce qui compte le plus : « ${a.label} » ou « ${b.label} » ?`, why: "Selon la réponse, ce n'est pas la même option qui l'emporte.", choices: [{ label: a.label, hint: a.description || `« ${a.label} » devient essentiel, « ${b.label} » secondaire.`, patch: pa }, { label: b.label, hint: b.description || `« ${b.label} » devient essentiel, « ${a.label} » secondaire.`, patch: pb }], suggestion: `${a.label} compte plus que ${b.label}` });
  }
  // 4. Effets incertains (hypothèses d'Aura) qui font basculer le résultat.
  const lever = mainLever(session);
  const askedOption = new Set<string>();
  if (lever) for (const o of lever.options) for (const c of crits) {
    if (out.length >= max) break;
    if (askedOption.has(o.id)) continue; // une question au plus par option
    if (!o.impactOrigins?.[c.id] || (o.impacts[c.id] ?? "0") !== "0") continue;
    const choices = ([["Améliore", "+", `« ${o.label} » fait progresser « ${c.label} ».`], ["Sans effet", "0", `« ${o.label} » ne change rien à « ${c.label} ».`], ["Dégrade", "-", `« ${o.label} » fait reculer « ${c.label} ».`]] as const).map(([label, v, hint]) => ({ label, hint, patch: setImpact(session, o.id, c.id, v) }));
    if (differ(choices.map(x => x.patch)) && askedOption.add(o.id)) out.push({ id: `effet-${o.id}-${c.id}`, text: `« ${o.label} » améliore-t-elle ou dégrade-t-elle « ${c.label} » ?`, why: "Cet effet est inconnu et change le résultat.", choices, suggestion: `${o.label} améliore ${c.label}` });
  }
  return out.slice(0, max);
}

// Liste de complétude : ce que captaient Comprendre et Impacter, et d'où ça vient.
export function completenessChecklist(session: AtelierSession): { label: string; ok: boolean; note: string }[] {
  const e = session.elicitation;
  return [
    { label: "Objectif", ok: !!e?.objectif, note: e?.objectif || "à préciser" },
    { label: "Options", ok: session.scenarios.length >= 2, note: `${session.scenarios.length}` },
    { label: "Critères et poids", ok: getLeafCriteria(session.criteria).length >= 5, note: `${getLeafCriteria(session.criteria).length} indicateurs` },
    { label: "Leviers", ok: session.leviersDef.length >= 3, note: `${session.leviersDef.length}` },
    { label: "Niveaux d'impact", ok: session.leviersDef.some(l => l.options.some(o => Object.values(o.impacts).some(v => v && v !== "0"))), note: "hypothèses à confirmer" },
    { label: "Attitude face au risque", ok: true, note: session.attitude === "Pessimiste" ? "prudente" : "audacieuse" },
    { label: "Contraintes", ok: true, note: session.contraintes?.length ? `${session.contraintes.length}` : "aucune mentionnée" },
    { label: "Horizon", ok: true, note: e?.horizon || "non précisé" },
    { label: "Parties prenantes", ok: true, note: e?.impactes || "non précisées" },
  ];
}

const RESULT_KEYS = /^(winner|gagnant|best|meilleur|ranking|classement|rank|score|scores|recommendation|recommandation|resultat|result)s?$/i;
/** Vrai si la réponse du LLM prétend donner un résultat (gagnant, classement, score) au lieu des seules entrées du modèle. */
export function llmClaimsResult(p: unknown): boolean {
  return !!p && typeof p === "object" && Object.keys(p as object).some(k => RESULT_KEYS.test(k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

/**
 * Garde-fou sur un texte du LLM : rejette toute phrase qui désigne comme
 * meilleure (ou première, recommandée) une autre option que celle du moteur.
 */
export function contradictsEngine(text: string, engineWinner: string, options: string[]): boolean {
  const t = norm(text);
  return options.filter(o => norm(o) !== norm(engineWinner)).some(o => {
    const n = norm(o);
    return new RegExp(`${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.]{0,40}(meilleur|premier|premiere|gagn|recommand|en tete)`).test(t)
      || new RegExp(`(meilleur|premier|premiere|gagn|recommand|en tete)[^.]{0,40}${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t);
  });
}

// ── Secours sans LLM : contexte externe et questions de cadrage ─────────────
const PESTEL_SUPPLY: Partial<Record<PestelKey, string>> = {
  P: "Tensions commerciales et droits de douane sur les pays d'approvisionnement", E: "Inflation des matières, de l'énergie et du fret",
  S: "Clients qui attendent une livraison rapide et fiable", T: "Visibilité de bout en bout (tour de contrôle, échanges EDI)",
  En: "Décarbonation du transport et reporting extra-financier", L: "Devoir de vigilance sur les fournisseurs et traçabilité",
};
const PESTEL_GENERIC: Partial<Record<PestelKey, string>> = {
  E: "Conjoncture et coût du capital", T: "Évolution rapide des technologies disponibles", L: "Réglementation applicable au secteur", S: "Attentes des clients et des équipes",
};
export function pestelFallback(templateId: string): Partial<Record<PestelKey, string>> {
  return /^(supply|logistique)/.test(templateId) ? PESTEL_SUPPLY : PESTEL_GENERIC;
}
export const CADRAGE_FALLBACK = ["Quel horizon pour cette décision : ce trimestre, cette année, au-delà ?", "Quelle limite est non négociable : budget, délai ou niveau de service ?", "Qui décide et qui subira les effets de la décision ?"];
