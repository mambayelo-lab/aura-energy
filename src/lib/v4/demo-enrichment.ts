import { applyDemoJudgements, completeDemoImpacts } from "./decision-templates";
import { optionHints } from "./decision-dialogue";
import { rankOptions } from "./decision-express";
import { newSession } from "./atelier-store";
import type {
  AtelierCriterion,
  AtelierLevierDef,
  AtelierScenario,
  ElicitationData,
} from "./atelier-store";
import type { SectorCase } from "./packs-sectoriels";

function cloneCriterion(item: AtelierCriterion): AtelierCriterion {
  return { ...item, children: item.children?.map(cloneCriterion) };
}

function cloneLever(item: AtelierLevierDef): AtelierLevierDef {
  return {
    ...item,
    options: item.options.map(option => ({
      ...option,
      impacts: { ...option.impacts },
      ...(option.impactOrigins ? { impactOrigins: { ...option.impactOrigins } } : {}),
      ...(option.incompatibleAvec ? { incompatibleAvec: [...option.incompatibleAvec] } : {}),
    })),
  };
}

const IMP_RANK: Record<string, number> = { Essentiel: 0, Important: 1, Secondaire: 2, Faible: 3 };
const byImportance = <T extends { importance?: string }>(xs: T[]) => xs.map((x, i) => ({ x, i })).sort((a, b) => (IMP_RANK[a.x.importance ?? ""] ?? 2) - (IMP_RANK[b.x.importance ?? ""] ?? 2) || a.i - b.i).map(e => e.x);
/** Répartit `max` places entre des groupes, au moins une par groupe, par tours successifs. */
function roundRobin<T>(groups: T[][], max: number): T[][] {
  const kept = groups.map(() => [] as T[]);
  for (let round = 0, n = 0; n < max; round++) {
    let added = false;
    for (let g = 0; g < groups.length && n < max; g++) if (groups[g][round]) { kept[g].push(groups[g][round]); n++; added = true; }
    if (!added) break;
  }
  return kept;
}

/**
 * Ramène un cas aux cibles d'une décision lisible : 1 à 2 MOE, 2 à 3 MOP, 5 à 8 TPM,
 * 3 à 5 leviers de 2 à 4 options. Garde d'abord ce qui est Essentiel, les options
 * retenues par les scénarios et au moins une option inspirante. Rien n'est ajouté.
 */
export function moePairs(criteria: AtelierCriterion[]): AtelierCriterion[][] {
  const ranked = byImportance(criteria);
  const mopsOf = (ms: AtelierCriterion[]) => roundRobin(ms.map(m => byImportance((m.children ?? []).filter(x => x.children?.length))), 3);
  const tpmCount = (ms: AtelierCriterion[]) => Math.min(8, mopsOf(ms).flat().reduce((n, m) => n + (m.children?.length ?? 0), 0));
  const pairs: AtelierCriterion[][] = ranked.length < 2 ? [ranked] : ranked.flatMap((a, i) => ranked.slice(i + 1).map(b => [a, b]));
  const isCost = (m: AtelierCriterion) => (m as { nature?: string }).nature === "cout" || /co[uû]t|[ée]conom|budget|financ|invest/i.test(m.label);
  const fits = pairs.filter(p => tpmCount(p) >= 5 && mopsOf(p).flat().length >= 2);
  // Un arbitrage oppose presque toujours une valeur à un coût : à taille égale, les paires qui gardent l'objectif économique passent devant.
  const ordered = [...fits.filter(p => p.some(isCost)), ...fits.filter(p => !p.some(isCost))];
  return ordered.length ? ordered : [[...pairs].sort((a, b) => tpmCount(b) - tpmCount(a))[0] ?? []];
}

export function fitToTargets(c: { criteria: AtelierCriterion[]; leviersDef: AtelierLevierDef[]; scenarios: AtelierScenario[] }, pair?: AtelierCriterion[]) {
  const moes = pair ?? moePairs(c.criteria)[0];
  const mopsOf = (ms: AtelierCriterion[]) => roundRobin(ms.map(m => byImportance((m.children ?? []).filter(x => x.children?.length))), 3);
  const mopGroups = mopsOf(moes);
  const tpmGroups = roundRobin(mopGroups.flat().map(m => byImportance(m.children ?? [])), 8);
  const keepMop = new Map(mopGroups.flat().map((m, i) => [m.id, tpmGroups[i]]));
  const criteria = moes.map((m, i) => ({ ...m, children: mopGroups[i].map(mop => ({ ...mop, children: keepMop.get(mop.id) ?? [] })) }));
  const leaves = new Set(tpmGroups.flat().map(t => t.id));
  const used = new Set(c.scenarios.flatMap(s => s.leviers.map(l => `${l.id}|${l.valeur}`)));
  const reach = (l: AtelierLevierDef) => l.options.reduce((n, o) => n + Object.entries(o.impacts ?? {}).filter(([k, v]) => leaves.has(k) && v && v !== "0").length, 0);
  const inspiring = (l: AtelierLevierDef) => l.options.some(o => o.exploratoire);
  let levers = [c.leviersDef[0], ...c.leviersDef.slice(1).filter(l => reach(l) > 0 || inspiring(l)).map((l, i) => ({ l, i })).sort((a, b) => reach(b.l) - reach(a.l) || a.i - b.i).map(e => e.l)].filter(Boolean).slice(0, 5);
  if (!levers.some(inspiring)) { const extra = c.leviersDef.find(inspiring); if (extra) levers = [...levers.slice(0, 4), extra]; }
  levers = c.leviersDef.filter(l => levers.includes(l)); // ordre d'origine
  const leviersDef = levers.map(l => {
    const rank = (o: AtelierLevierDef["options"][number]) => (used.has(`${l.id}|${o.id}`) ? 0 : o.exploratoire ? 1 : 2);
    const keep = new Set(l.options.map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i).slice(0, 4).map(e => e.o.id));
    return { ...l, options: l.options.filter(o => keep.has(o.id)).map(o => ({ ...o, impacts: Object.fromEntries(Object.entries(o.impacts ?? {}).filter(([k]) => leaves.has(k))) })) };
  });
  const ids = new Set(leviersDef.map(l => l.id));
  const scenarios = c.scenarios.map(s => ({ ...s, leviers: s.leviers.filter(l => ids.has(l.id)) }));
  return { criteria, leviersDef, scenarios };
}

/**
 * Prépare un cas de démonstration : matrice complétée (effets usuels ou « sans effet
 * direct », justifiés, à confirmer), puis ramenée aux cibles. Les données sources ne
 * sont pas modifiées ; les moteurs Forward, Backward et BORA ne sont pas appelés ici.
 */
export function enrichDecisionDemoCase(source: SectorCase): SectorCase {
  const criteria = source.criteria.map(cloneCriterion);
  const leviersDef = applyDemoJudgements(source.key, completeDemoImpacts(source.leviersDef.map(cloneLever), criteria, optionHints), criteria);
  const scenarios: AtelierScenario[] = source.scenarios.map(s => ({ ...s, leviers: s.leviers.map(l => ({ ...l })), scores: { ...s.scores } }));
  // Parmi les paires d'objectifs qui tiennent les cibles, on garde la première qui départage les scénarios.
  const input = { criteria, leviersDef, scenarios };
  let fitted = fitToTargets(input);
  for (const pair of moePairs(criteria)) {
    const f = fitToTargets(input, pair);
    const r = rankOptions({ ...newSession({ contextRaw: "" }), ...f });
    if (r.length < 2 || r[1].rank === 2) { fitted = f; break; }
  }
  return { ...source, ...fitted, risques: [...source.risques] };
}

const PESTEL_RULES: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: "P", label: "Politique", pattern: /collectivit|politique publique|régulation|territoire/i },
  { id: "E", label: "Économique", pattern: /coût|prix|budget|investissement|marge|trésorerie/i },
  { id: "S", label: "Social", pattern: /client|équipe|acteur|adhésion|accepta|emploi|riverain/i },
  { id: "T", label: "Technologique", pattern: /techn|système|logiciel|donnée|capteur|équipement|procédé/i },
  { id: "En", label: "Environnemental", pattern: /émission|carbone|énergie|environnement|empreinte|décarbon/i },
  { id: "L", label: "Légal", pattern: /conformité|réglement|contrat|certif|sécurité|sûreté/i },
];

/** Préremplit uniquement les réponses de Comprendre déjà présentes dans le cas. */
export function buildDemoElicitation(source: SectorCase): Partial<ElicitationData> {
  const text = [
    source.contextRaw,
    source.objectif,
    source.exigencesNonNeg,
    source.risques.join(" "),
  ].join(" ");
  const selected = PESTEL_RULES.filter(rule => rule.pattern.test(text));
  const pestelAnswers = Object.fromEntries(selected.map(rule => [
    rule.id,
    `${rule.label} — ${source.risques.find(risk => rule.pattern.test(risk)) ?? source.exigencesNonNeg}`,
  ]));

  return {
    step: 5,
    objectif: source.objectif,
    horizon: source.horizon,
    decideurs: source.decideurs,
    impactes: source.impactes,
    resistances: `Adoption à sécuriser avec ${source.impactes}.`,
    exigencesNonNeg: source.exigencesNonNeg,
    risques: [...source.risques],
    leviersDDP: source.leviersDef.map(lever => lever.label).join(" · "),
    contraintesDIP: source.risques.join(" · "),
    pestelSelected: selected.map(rule => rule.id),
    pestelAnswers,
  };
}

export function countDecisionIndicators(items: AtelierCriterion[]): number {
  return items.reduce((total, item) => total + 1 + countDecisionIndicators(item.children ?? []), 0);
}
