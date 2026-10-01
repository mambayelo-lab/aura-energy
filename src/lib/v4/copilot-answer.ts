import { memoryHint, type SupplyDecision } from "./supply-memory";
import {
  evaluateCausalRules, kpiStatus,
  type ArgusVocab, type CausalRule, type KpiDef,
} from "./argus-vocab-store";

// Générateur déterministe des réponses du copilote Supply. Il lit les
// valeurs réellement observées dans le Studio (instantanés des tables
// mappées) et les règles, choisit l'intention de la question et décide si
// un graphique aide : tendance ou comparaison → graphique ; explication
// causale, recommandation ou synthèse → texte seul. Sans clé LLM, son texte
// est la réponse ; avec Mistral, il sert de faits imposés au modèle.

export type CopilotIntent = "tendance" | "comparaison" | "explication" | "recommandation" | "synthese";

export type AuraChartSpec = {
  type: "bar" | "line" | "pie";
  theme: "aura";
  title: string;
  subtitle: string;
  data: Record<string, string | number>[];
  keys: string[];
  yLabel?: string;
  thresholds?: { label: string; value: number }[];
  legend?: { ok: string; breach: string };
};

export type CopilotPlan = {
  intent: CopilotIntent;
  kpi?: KpiDef;
  text: string;          // réponse déterministe (markdown)
  facts: string;         // faits transmis au LLM
  chart?: AuraChartSpec; // présent seulement quand un graphique aide
  evidence: string[];
};

const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

const WANTS_CHART = /\b(graph|graphique|courbe|visualis|montre|affiche|trace|histogramme|diagramme)/;
const TREND = /(tendance|evolution|evolue|historique|progression|au fil|dans le temps|par semaine|semaine apres|se degrade|s'aggrave|trajectoire)/;
const COMPARE = /(compar|classement|classe|\btop\b|\bquels\b|\bquelles\b|lesquel|repartition|liste|par fournisseur|par expedition|par article|les plus|le plus|pire|meilleur|ecart entre)/;
const EXPLAIN = /(pourquoi|explique|expliquer|explication|cause|origine|comment se fait|d'ou vient|raison|que signifie|qu'est-ce qui)/;
const RECOMMEND = /(recommand|que faire|que dois|quoi faire|quelle action|quelles actions|conseil|priori|decid|option|arbitr|plan d'action|comment reagir|comment traiter|agir)/;

export function classifyIntent(question: string): CopilotIntent {
  const q = norm(question);
  const chart = WANTS_CHART.test(q);
  if (TREND.test(q)) return "tendance";
  if (RECOMMEND.test(q) && !chart) return "recommandation";
  if (EXPLAIN.test(q) && !chart) return "explication";
  if (COMPARE.test(q) || chart) return "comparaison";
  return "synthese";
}

// ── Lecture des valeurs observées ──────────────────────────────────────────

type Row = Record<string, string>;
type Observed = { kpi: KpiDef; table: string; column: string; source: string; rows: Row[]; columns: string[]; fetchedAt?: string };

const toNumber = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(String(raw).replace(",", ".").replace(/[^0-9.eE+-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

export function observedRows(vocab: ArgusVocab, kpi: KpiDef): Observed | undefined {
  const mapping = vocab.mappings.find(m => m.kpiId === kpi.id && !m.condition) ?? vocab.mappings.find(m => m.kpiId === kpi.id);
  const field = mapping ? vocab.fields.find(f => f.id === mapping.fieldId) : undefined;
  if (!field) return undefined;
  const app = vocab.apps.find(a => a.id === field.appId);
  if (app?.enabled === false) return undefined;
  const base = field.name.replace(/\s*\(.*\)$/, "");
  const column = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  const table = field.liveTable ?? (base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base);
  const snap = (vocab.siTables ?? []).find(t => t.appId === field.appId && (t.table === table || t.table === field.liveTable) && t.columns.includes(column));
  if (!snap) return undefined;
  const rows = snap.rows.filter(r => toNumber(r[column]) !== undefined);
  if (!rows.length) return undefined;
  return { kpi, table: snap.table, column, source: `${app?.label ?? field.appId} · ${base}`, rows, columns: snap.columns, fetchedAt: snap.fetchedAt };
}

const NAME_COLUMNS = ["supplier", "supplierName", "name", "shipmentId", "sku", "purchaseOrderId", "supplierId", "siteId", "id"];
const TIME_COLUMNS = ["week", "period", "date", "requestedDate", "eta", "assessedAt"];

function recordName(o: Observed, row: Row, index: number): string {
  const col = NAME_COLUMNS.find(c => o.columns.includes(c) && c !== o.column && row[c]);
  const label = col ? row[col] : `#${index + 1}`;
  const extra = col && col !== "sku" && o.columns.includes("sku") && row.sku && o.columns.includes("week") ? ` ${row.sku}` : "";
  return `${label}${extra}`;
}

function recordRef(o: Observed, row: Row): string {
  const id = ["supplierId", "shipmentId", "purchaseOrderId", "sku", "siteId", "id"].find(c => o.columns.includes(c) && row[c]);
  const name = ["supplier", "name"].find(c => o.columns.includes(c) && row[c]);
  return [id ? row[id] : undefined, name ? row[name] : undefined, o.columns.includes("week") ? row.week : undefined].filter(Boolean).join(" · ") || "enregistrement";
}

const statusOf = (kpi: KpiDef, v: number) => kpiStatus({ ...kpi, currentValue: v });
const worseFirst = (kpi: KpiDef) => (a: number, b: number) => kpi.direction === "au_dessus_alerte" ? b - a : a - b;

// ── Choix de l'indicateur ──────────────────────────────────────────────────

const SYNONYMS: [RegExp, RegExp][] = [
  [/capacit|satur/, /capacit/],
  [/retard|transport|expedition|livraison/, /retard|transport/],
  [/stock|couverture|rupture/, /couverture|stock/],
  [/geopoli|pays|sanction/, /geopoli/],
  [/prevision|demande|forecast/, /prevision/],
  [/risque global|global/, /global/],
];

export function pickKpi(vocab: ArgusVocab, question: string, focusLabel?: string): KpiDef | undefined {
  const q = norm(question);
  const fed = vocab.kpis.filter(k => observedRows(vocab, k));
  const score = (k: KpiDef) => {
    const text = norm([k.label, ...(k.attributs ?? [])].join(" "));
    let s = text.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !["risque", "fournisseur"].includes(w)).filter(w => q.includes(w)).length * 2;
    for (const [inQ, inK] of SYNONYMS) if (inQ.test(q) && inK.test(text)) s += 3;
    if (/fournisseur/.test(q) && /fournisseur/.test(text)) s += 1;
    return s;
  };
  const ranked = fed.map(k => ({ k, s: score(k) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (ranked[0]) return ranked[0].k;
  const focus = focusLabel ? fed.find(k => k.label === focusLabel) : undefined;
  if (focus) return focus;
  const triggered = evaluateCausalRules(vocab).filter(r => r.triggered).map(r => r.rule);
  const fromRule = triggered.flatMap(r => r.conditions.map(c => c.kpiId)).map(id => fed.find(k => k.id === id)).find(Boolean);
  return fromRule ?? fed[0];
}

// ── Graphiques ─────────────────────────────────────────────────────────────

function comparisonChart(o: Observed, limit = 10): AuraChartSpec {
  const { kpi } = o;
  const points = o.rows.map((r, i) => ({ name: recordName(o, r, i), value: toNumber(r[o.column])! }))
    .sort((a, b) => worseFirst(kpi)(a.value, b.value)).slice(0, limit);
  const breaches = o.rows.filter(r => statusOf(kpi, toNumber(r[o.column])!) !== "ok").length;
  return {
    type: "bar", theme: "aura", title: `${kpi.label} par enregistrement`,
    subtitle: `${Math.min(limit, o.rows.length)} plus exposés sur ${o.rows.length} lus · ${breaches} au-delà du seuil · ${o.source}`,
    // _status : sévérité (couleur d'état) ; _focus : l'enregistrement le plus exposé, mis en avant.
    data: points.map((p, i) => ({ name: p.name, [kpi.label]: p.value, _breach: statusOf(kpi, p.value) === "ok" ? 0 : 1, _status: statusOf(kpi, p.value), ...(i === 0 ? { _focus: 1 } : {}) })),
    keys: [kpi.label], yLabel: kpi.unit,
    thresholds: [{ label: `alerte ${fmt(kpi.seuilAlerte)}`, value: kpi.seuilAlerte }, { label: `critique ${fmt(kpi.seuilCritique)}`, value: kpi.seuilCritique }],
    legend: { ok: "Dans les seuils", breach: "Au-delà du seuil d'alerte" },
  };
}

// Répartition des enregistrements par état : ici les couleurs d'état sont la donnée.
function distributionChart(o: Observed): AuraChartSpec {
  const { kpi } = o;
  const count = (st: string) => o.rows.filter(r => statusOf(kpi, toNumber(r[o.column])!) === st).length;
  const data = [["Dans les seuils", "ok"], ["Alerte", "alerte"], ["Critique", "critique"]]
    .map(([name, st]) => ({ name, Enregistrements: count(st), _status: st }))
    .filter(d => d.Enregistrements > 0);
  return {
    type: "pie", theme: "aura", title: `${kpi.label} : répartition par état`,
    subtitle: `${o.rows.length} enregistrements lus · alerte ${kpi.direction === "au_dessus_alerte" ? "≥" : "≤"} ${fmt(kpi.seuilAlerte)}, critique ${kpi.direction === "au_dessus_alerte" ? "≥" : "≤"} ${fmt(kpi.seuilCritique)} ${kpi.unit} · ${o.source}`,
    data, keys: ["Enregistrements"],
  };
}

function trendChart(o: Observed): AuraChartSpec {
  const { kpi } = o;
  const thresholds = [{ label: `alerte ${fmt(kpi.seuilAlerte)}`, value: kpi.seuilAlerte }, { label: `critique ${fmt(kpi.seuilCritique)}`, value: kpi.seuilCritique }];
  // Évaluation précédente reconstituée à partir de la colonne `trend` (écart
  // publié par la source) : deux séries sur la même échelle.
  if (o.columns.includes("trend") && o.rows.some(r => toNumber(r.trend) !== undefined)) {
    const rows = [...o.rows].sort((a, b) => Math.abs(toNumber(b.trend) ?? 0) - Math.abs(toNumber(a.trend) ?? 0)).slice(0, 8);
    return {
      type: "bar", theme: "aura", title: `${kpi.label} : évaluation précédente et actuelle`,
      subtitle: `Précédente = actuelle − tendance publiée · ${o.source}`,
      data: rows.map((r, i) => { const now = toNumber(r[o.column])!; return { name: recordName(o, r, i), "Évaluation précédente": now - (toNumber(r.trend) ?? 0), "Dernière évaluation": now }; }),
      keys: ["Évaluation précédente", "Dernière évaluation"], yLabel: kpi.unit, thresholds,
    };
  }
  const timeCol = TIME_COLUMNS.find(c => o.columns.includes(c) && c !== o.column);
  if (timeCol) {
    const byPeriod = new Map<string, number[]>();
    for (const r of o.rows) if (r[timeCol]) (byPeriod.get(r[timeCol]) ?? byPeriod.set(r[timeCol], []).get(r[timeCol])!).push(toNumber(r[o.column])!);
    const periods = [...byPeriod.keys()].sort();
    if (periods.length >= 2) {
      const pick = (vals: number[]) => kpi.direction === "au_dessus_alerte" ? Math.max(...vals) : Math.min(...vals);
      return {
        type: "line", theme: "aura", title: `${kpi.label} : tendance par ${timeCol === "week" ? "semaine" : "période"}`,
        subtitle: `Valeur la plus défavorable par période · ${o.source}`,
        data: periods.map(p => ({ name: p, [kpi.label]: pick(byPeriod.get(p)!), _status: statusOf(kpi, pick(byPeriod.get(p)!)) })),
        keys: [kpi.label], yLabel: kpi.unit, thresholds,
      };
    }
  }
  const c = comparisonChart(o);
  return { ...c, subtitle: `Pas d'historique daté dans la source : comparaison des enregistrements · ${o.source}` };
}

// ── Texte ──────────────────────────────────────────────────────────────────

// Entités qui déclenchent la règle (toutes ses conditions vraies pour la même
// entité), la plus grave en tête.
function ruleMatches(vocab: ArgusVocab, rule: CausalRule) {
  return evaluateCausalRules(vocab).find(r => r.rule.id === rule.id)?.matches ?? [];
}

function entityLine(vocab: ArgusVocab, rule: CausalRule): string {
  const m = ruleMatches(vocab, rule);
  if (!m.length) return "";
  return `Entité concernée : **${m[0].label}**${m.length > 1 ? ` (la plus exposée sur ${m.length} ; aussi ${m.slice(1, 5).map(x => x.label).join(", ")}${m.length > 5 ? "…" : ""})` : ""}`;
}

function conditionText(vocab: ArgusVocab, rule: CausalRule): string[] {
  const top = ruleMatches(vocab, rule)[0];
  return rule.conditions.map(c => {
    if (c.ruleId) return `la règle « ${vocab.causalRules.find(r => r.id === c.ruleId)?.label ?? c.ruleId} » est déclenchée`;
    const kpi = vocab.kpis.find(k => k.id === c.kpiId);
    if (!kpi) return "indicateur inconnu";
    const o = observedRows(vocab, kpi);
    const seuil = c.minStatus === "critique" ? kpi.seuilCritique : kpi.seuilAlerte;
    const sens = kpi.direction === "au_dessus_alerte" ? "≥" : "≤";
    if (!o) return `${kpi.label} ${sens} ${fmt(seuil)} ${kpi.unit} (non alimenté)`;
    const fact = top?.facts.find(f => f.kpiId === kpi.id);
    if (fact) return `${kpi.label} ${sens} ${fmt(seuil)} ${kpi.unit} : observé **${fmt(fact.value)} ${kpi.unit}** sur ${top!.label}`;
    const sorted = [...o.rows].sort((a, b) => worseFirst(kpi)(toNumber(a[o.column])!, toNumber(b[o.column])!));
    const worst = sorted[0];
    return `${kpi.label} ${sens} ${fmt(seuil)} ${kpi.unit} : observé **${fmt(toNumber(worst[o.column])!)} ${kpi.unit}** sur ${recordRef(o, worst)}`;
  });
}

function breachLines(o: Observed, max = 5): string[] {
  const { kpi } = o;
  return [...o.rows]
    .map(r => ({ r, v: toNumber(r[o.column])! }))
    .filter(x => statusOf(kpi, x.v) !== "ok")
    .sort((a, b) => worseFirst(kpi)(a.v, b.v))
    .slice(0, max)
    .map(x => `- **${recordRef(o, x.r)}** : ${fmt(x.v)} ${kpi.unit} (${statusOf(kpi, x.v)})`);
}

function relevantRules(vocab: ArgusVocab, kpi?: KpiDef): CausalRule[] {
  const triggered = evaluateCausalRules(vocab).filter(r => r.triggered).map(r => r.rule);
  const touching = kpi ? triggered.filter(r => r.conditions.some(c => c.kpiId === kpi.id)) : [];
  const rank = (r: CausalRule) => (r.severity === "critique" ? 0 : 1) + (r.conditions.length > 1 ? -0.5 : 0);
  return (touching.length ? touching : triggered).sort((a, b) => rank(a) - rank(b));
}

export function planCopilotAnswer(vocab: ArgusVocab, question: string, opts: { focusKpiLabel?: string; decisions?: SupplyDecision[] } = {}): CopilotPlan {
  const remember = (r: CausalRule) => opts.decisions?.length ? memoryHint(opts.decisions, { entity: ruleMatches(vocab, r)[0]?.label, alertId: r.id }) : undefined;
  const intent = classifyIntent(question);
  const kpi = pickKpi(vocab, question, opts.focusKpiLabel);
  const o = kpi ? observedRows(vocab, kpi) : undefined;
  // Une règle nommée dans la question passe en tête.
  const named = vocab.causalRules.filter(r => r.label.length > 3 && norm(question).includes(norm(r.label)));
  const triggeredRules = relevantRules(vocab, kpi);
  const triggeredIds = new Set(evaluateCausalRules(vocab).filter(r => r.triggered).map(r => r.rule.id));
  const rules = named.length ? [...named.filter(r => triggeredIds.has(r.id)), ...triggeredRules.filter(r => !named.some(n => n.id === r.id))] : triggeredRules;
  const evidence: string[] = [];
  if (o) evidence.push(`Source : ${o.source}`);
  if (rules.length) evidence.push(`${rules.length} règle(s) déclenchée(s)`);

  if (!o && !rules.length) {
    const text = vocab.kpis.some(k => vocab.mappings.some(m => m.kpiId === k.id))
      ? "Les indicateurs sont mappés mais aucune valeur n'a encore été lue : actualisez les données dans le Studio (Connecter → Métadonnées & échantillons)."
      : "Aucun indicateur n'est alimenté par une source : connectez Maison Lucie puis mappez une colonne à un indicateur dans le Studio (Mapper). Je ne peux rien affirmer sans données.";
    return { intent, kpi, text, facts: text, evidence: ["Aucune donnée observée"] };
  }

  const lines: string[] = [];
  let chart: AuraChartSpec | undefined;

  if (intent === "tendance" && o) {
    chart = trendChart(o);
    const withTrend = o.columns.includes("trend") ? [...o.rows].filter(r => (toNumber(r.trend) ?? 0) !== 0).sort((a, b) => (toNumber(b.trend) ?? 0) - (toNumber(a.trend) ?? 0)) : [];
    lines.push(`**${o.kpi.label}** — ${o.rows.length} enregistrement(s) lus dans ${o.source}.`);
    if (withTrend.length) {
      const up = withTrend.filter(r => (toNumber(r.trend) ?? 0) > 0).slice(0, 3);
      if (up.length) lines.push(`Plus forte dégradation : ${up.map(r => `**${recordRef(o, r)}** (${r.trend} → ${fmt(toNumber(r[o.column])!)} ${o.kpi.unit})`).join(", ")}.`);
    }
    const b = breachLines(o, 3);
    lines.push(b.length ? `Au-delà du seuil aujourd'hui :\n${b.join("\n")}` : "Aucun enregistrement au-delà du seuil d'alerte aujourd'hui.");
  } else if (intent === "comparaison" && o) {
    chart = /(repartition|reparti|proportion|part des)/.test(norm(question)) ? distributionChart(o) : comparisonChart(o);
    const b = breachLines(o, 6);
    lines.push(`**${o.kpi.label}** — ${b.length ? `${o.rows.filter(r => statusOf(o.kpi, toNumber(r[o.column])!) !== "ok").length} enregistrement(s) sur ${o.rows.length}` : `aucun des ${o.rows.length} enregistrements`} au-delà du seuil d'alerte (${fmt(o.kpi.seuilAlerte)} ${o.kpi.unit}, critique ${fmt(o.kpi.seuilCritique)}).`);
    if (b.length) lines.push(b.join("\n"));
    if (rules[0]) lines.push(`Règle concernée : **${rules[0].label}**${rules[0].decisionQuestion ? ` — ${rules[0].decisionQuestion}` : ""}`);
  } else if (intent === "explication") {
    const top = rules.slice(0, 2);
    if (!top.length && o) {
      lines.push(`Aucune règle n'est déclenchée sur **${o.kpi.label}** : ${breachLines(o, 1).length ? "des valeurs dépassent le seuil mais aucune règle active ne les relie." : "toutes les valeurs observées restent dans les seuils."}`);
    }
    for (const r of top) {
      lines.push(`**${r.label}** est déclenchée (${r.conditions.length > 1 ? "règle causale" : "alerte"}, ${r.severity}) parce que :\n${conditionText(vocab, r).map(t => `- ${t}`).join("\n")}`);
      const who = entityLine(vocab, r);
      if (who) lines.push(who);
      const past = remember(r);
      if (past) lines.push(`Mémoire : ${past}`);
      if (r.conclusion) lines.push(`Lecture : ${r.conclusion}`);
      if (r.causes?.length) lines.push(`Causes identifiées : ${r.causes.join(" ; ")}.`);
    }
  } else if (intent === "recommandation") {
    const top = rules.slice(0, 2);
    if (!top.length) lines.push("Aucune règle n'est déclenchée : pas d'action requise, continuez la surveillance.");
    for (const [i, r] of top.entries()) {
      const cond = conditionText(vocab, r);
      lines.push([
        `**Priorité ${i + 1} — ${r.label}** (${r.severity})`,
        `- Constat : ${cond.join(" ; ")}`,
        ...(entityLine(vocab, r) ? [`- ${entityLine(vocab, r)}`] : []),
        ...(remember(r) ? [`- Mémoire : ${remember(r)}`] : []),
        ...(r.decisionQuestion ? [`- Question à trancher : ${r.decisionQuestion}`] : []),
        ...(r.options?.length ? [`- Options à évaluer : ${r.options.slice(0, 3).join(", ")}${r.options.length > 3 ? ` (+${r.options.length - 3})` : ""}`] : []),
      ].join("\n"));
    }
    if (top.length) lines.push("Ouvrez l'alerte puis « Décider → » pour comparer ces options ; la décision reste la vôtre.");
  } else {
    const all = evaluateCausalRules(vocab);
    const on = all.filter(r => r.triggered);
    const crit = on.filter(r => r.rule.severity === "critique");
    lines.push(`${on.length} alerte(s) ou règle(s) déclenchée(s) sur ${all.filter(r => r.rule.conditions.length).length} paramétrée(s), dont ${crit.length} critique(s).`);
    for (const r of on.slice(0, 4).map(x => x.rule)) lines.push(`- **${r.label}** : ${conditionText(vocab, r)[0] ?? ""}`);
    if (o && !on.length) lines.push(...breachLines(o, 3));
  }

  const text = lines.join("\n\n");
  const facts = [
    `Intention détectée : ${intent}.`,
    o ? `Indicateur : ${o.kpi.label} (${o.kpi.unit}, seuil alerte ${o.kpi.seuilAlerte}, critique ${o.kpi.seuilCritique}, ${o.kpi.direction === "au_dessus_alerte" ? "mauvais si trop haut" : "mauvais si trop bas"}), source ${o.source}. Valeurs : ${o.rows.slice(0, 20).map(r => `${recordRef(o, r)}=${r[o.column]}${r.trend ? ` (tendance ${r.trend})` : ""}`).join(", ")}.` : "",
    rules.length ? `Règles déclenchées :\n${rules.slice(0, 4).map(r => `- ${r.label} [${r.severity}] : ${conditionText(vocab, r).join(" ET ").replace(/\*\*/g, "")}.${ruleMatches(vocab, r).length ? ` Entités (même objet pour toutes les conditions) : ${ruleMatches(vocab, r).slice(0, 6).map(m => m.label).join(", ")}.` : ""} Conclusion : ${r.conclusion || "—"}. Options : ${(r.options ?? []).join(", ") || "—"}.`).join("\n")}` : "Aucune règle déclenchée.",
    opts.decisions?.length ? `Décisions déjà prises (mémoire Supply) :\n${opts.decisions.slice(0, 6).map(d => `- ${new Date(d.createdAt).toLocaleDateString("fr-FR")} · ${d.alertLabel}${d.entity ? ` · ${d.entity}` : ""} → ${d.option}${d.reason ? ` (raison : ${d.reason})` : ""}`).join("\n")}` : "",
    `Réponse de référence (faits vérifiés) :\n${text}`,
  ].filter(Boolean).join("\n");
  return { intent, kpi, text, facts, chart, evidence };
}

export function chartBlock(spec: AuraChartSpec): string {
  return `\n\n\`\`\`chart\n${JSON.stringify(spec)}\n\`\`\``;
}

// Retire tout bloc graphique d'une réponse LLM : l'interface seule décide.
export function stripChartBlocks(reply: string): string {
  return reply.replace(/```chart[\s\S]*?```/g, "").trim();
}

// ── Garde-fou contre les hallucinations ────────────────────────────────────
// Une réponse rédigée par le modèle n'est affichée que si chaque chiffre
// qu'elle cite figure dans les faits transmis (valeurs lues, seuils, règles)
// et si chaque règle qu'elle nomme existe. Sinon la réponse de référence,
// calculée sans modèle, la remplace.
const NUM = /-?\d+(?:[ \u202f\u00a0]\d{3})*(?:[.,]\d+)?/g;
function numbersIn(text: string): number[] {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\b(?:W|S)\d{1,2}\b/g, " ")               // semaines 2026-W40
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, " ")      // dates 12/09/2026
    .replace(/\b[A-Z][A-Z0-9]*-[A-Z0-9-]*\d[A-Z0-9-]*\b/g, " "); // identifiants SUP-001, SHP-893, BAG-LUNA
  return (clean.match(NUM) ?? []).map(n => Number(n.replace(/[ \u202f\u00a0]/g, "").replace(",", "."))).filter(n => Number.isFinite(n));
}

export function verifyGrounding(reply: string, sources: string[], vocab?: ArgusVocab): { ok: boolean; unverified: number[]; unknownRules: string[] } {
  const allowed = numbersIn(sources.join("\n"));
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.051, Math.abs(b) * 0.001);
  const unverified = [...new Set(numbersIn(reply)
    // Petits entiers (comptes, numérotation) et années tolérés.
    .filter(n => !(Number.isInteger(n) && Math.abs(n) <= 10) && !(Number.isInteger(n) && n >= 2000 && n <= 2100))
    .filter(n => !allowed.some(a => close(Math.abs(n), Math.abs(a)))))];
  const labels = new Set((vocab?.causalRules ?? []).map(r => norm(r.label)));
  const unknownRules = vocab
    ? [...reply.matchAll(/r[eè]gle\s+(?:causale\s+)?(?:\*\*)?«\s*([^»]+?)\s*»/gi)].map(m => m[1]).filter(l => !labels.has(norm(l)))
    : [];
  return { ok: unverified.length === 0 && unknownRules.length === 0, unverified, unknownRules };
}

// ── Valeur attendue : seuils d'un indicateur ──────────────────────────────
// « change le seuil », « quel seuil pour… » : le copilote répond par un petit
// formulaire (seuil d'alerte et seuil critique, unité de l'indicateur), plus
// rapide qu'une phrase libre.
const THRESHOLD = /(seuil|limite d'alerte|niveau d'alerte|declench)/;
export function thresholdRequest(vocab: ArgusVocab, question: string, focusKpiLabel?: string): KpiDef | undefined {
  const q = norm(question);
  if (!THRESHOLD.test(q)) return undefined;
  // Tous les indicateurs, même non alimentés : un seuil se règle avant les données.
  const words = (k: KpiDef) => norm(k.label).split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const named = vocab.kpis.map(k => ({ k, s: words(k).filter(w => q.includes(w)).length })).filter(x => x.s > 0).sort((a, b) => b.s - a.s)[0]?.k;
  return named ?? vocab.kpis.find(k => k.label === focusKpiLabel) ?? pickKpi(vocab, question, focusKpiLabel);
}

/** Vérifie la cohérence des deux seuils selon le sens de l'indicateur. */
export function checkThresholds(kpi: KpiDef, alerte: number, critique: number): string | null {
  if (kpi.direction === "au_dessus_alerte" && critique < alerte) return "Le seuil critique doit être au-dessus du seuil d'alerte.";
  if (kpi.direction === "en_dessous_alerte" && critique > alerte) return "Le seuil critique doit être en dessous du seuil d'alerte.";
  if (kpi.unit.trim() === "%" && (alerte < 0 || alerte > 100 || critique < 0 || critique > 100)) return "Un pourcentage est compris entre 0 et 100.";
  return null;
}

export function withThresholds(vocab: ArgusVocab, kpiId: string, alerte: number, critique: number): ArgusVocab {
  return { ...vocab, kpis: vocab.kpis.map(k => k.id === kpiId ? { ...k, seuilAlerte: alerte, seuilCritique: critique, updatedAt: new Date().toISOString() } : k) };
}
