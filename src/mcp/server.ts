/**
 * Aura Décision — serveur MCP (Model Context Protocol).
 *
 * Expose le moteur décisionnel d'Aura (modèle ordinal bipolaire de la thèse Lo
 * + moteur Sow IPMU 2016) comme outils appelables par tout assistant IA
 * compatible MCP. L'assistant structure et propose ; le moteur garantit :
 * jamais de fausse précision, ex æquo assumés, inconnues explicites.
 *
 * Build  : npm run mcp:build
 * Lancer : npm run mcp:start   (transport stdio)
 * Config Claude Desktop / Code : { "command": "node", "args": ["dist-mcp/aura-mcp.mjs"] }
 *
 * Persistance : fichier JSON (AURA_MCP_STORE, défaut ./aura-mcp-store.json).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { aggregateCriterion, aggregateNode, type ElementaryImpact, thesisWeights, compareASC } from "../lib/engine/lo/aggregation";
import type { Attitude, OrdinalLevel, OrdinalImpact, RawCell } from "../lib/engine/lo/types";
import { analyzeSow, possibilisticCapacity } from "../lib/engine/sow";
import type { SowAction } from "../lib/engine/sow";

// ── Modèle de données ────────────────────────────────────────────────────────
type Impact = "++" | "+" | "0" | "-" | "--" | "U";
interface Criterion { id: string; label: string; importance: "Essentiel" | "Important" | "Secondaire" | "Faible"; children?: Criterion[] }
interface Option { id: string; label: string; impacts: Record<string, Impact> }
interface Lever { id: string; label: string; options: Option[] }
interface Scenario { id: string; label: string; choice: Record<string, string> } // leverId → optionId
interface Study {
  id: string; title: string; context: string; createdAt: string;
  attitude: "Prudent" | "Optimiste";
  criteria: Criterion[]; levers: Lever[]; scenarios: Scenario[];
}

const STORE = process.env.AURA_MCP_STORE ?? path.join(process.cwd(), "aura-mcp-store.json");
const loadAll = (): Record<string, Study> => {
  try { return JSON.parse(fs.readFileSync(STORE, "utf8")); } catch { return {}; }
};
const saveAll = (all: Record<string, Study>) => fs.writeFileSync(STORE, JSON.stringify(all, null, 2));
const getStudy = (id: string): Study => {
  const s = loadAll()[id];
  if (!s) throw new Error(`Étude inconnue : ${id}`);
  return s;
};
const putStudy = (s: Study) => { const all = loadAll(); all[s.id] = s; saveAll(all); };

// ── Moteur ordinal (identique au parcours Atelier) ───────────────────────────
const IMPACT_MAP: Record<Impact, { gPlus: RawCell; dMinus: RawCell }> = {
  "++": { gPlus: "H", dMinus: "N" }, "+": { gPlus: "M", dMinus: "N" },
  "0": { gPlus: "N", dMinus: "N" }, "-": { gPlus: "N", dMinus: "M" },
  "--": { gPlus: "N", dMinus: "H" }, "U": { gPlus: "U", dMinus: "U" },
};
const IMP_W: Record<Criterion["importance"], OrdinalLevel> = { Essentiel: 3, Important: 2, Secondaire: 1, Faible: 0 };
const ORD = ["Nul", "Faible", "Modéré", "Élevé"];
const leaves = (cs: Criterion[]): Criterion[] => cs.flatMap(c => c.children?.length ? leaves(c.children) : [c]);

function normalizeW(ws: OrdinalLevel[]): OrdinalLevel[] {
  return ws.length ? thesisWeights(ws) : [3]; // éq. (9) thèse Lô, poids tels quels
}

function aggregateTree(crit: Criterion, sc: Scenario, study: Study, at: Attitude, profile: "prudent" | "optimiste"): OrdinalImpact {
  if (!crit.children?.length) {
    const imps: ElementaryImpact[] = [];
    for (const lev of study.levers) {
      const opt = lev.options.find(o => o.id === sc.choice[lev.id]);
      const v = opt?.impacts[crit.id];
      if (v !== undefined) imps.push({ leverIndex: imps.length, ...IMPACT_MAP[v] });
    }
    return aggregateCriterion(imps.length ? imps : [{ leverIndex: 0, gPlus: "N", dMinus: "N" }], at)[profile];
  }
  const children = crit.children.map(c => aggregateTree(c, sc, study, at, profile));
  const ws = normalizeW(crit.children.map(c => IMP_W[c.importance]));
  try { return aggregateNode(children, ws); } catch { return { gPlus: 0, dMinus: 0 }; }
}

function evaluateStudy(study: Study) {
  const at: Attitude = study.attitude === "Prudent" ? 1 : 2;
  const profile = study.attitude === "Prudent" ? "prudent" as const : "optimiste" as const;
  const results = study.scenarios.map(sc => {
    const stage1 = study.criteria.map(c => aggregateTree(c, sc, study, at, profile));
    const ws = normalizeW(study.criteria.map(c => IMP_W[c.importance]));
    let global: OrdinalImpact;
    try { global = aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], ws.length ? ws : [3]); }
    catch { global = { gPlus: 0, dMinus: 0 }; }
    return { scenario: sc, global };
  });
  // Classement lexicographique de la thèse (Lô p. 83) : détérioration d'abord, puis amélioration
  const cmp = (a: OrdinalImpact, b: OrdinalImpact) => compareASC(b, a); // thèse Lô p. 83 : δ⁻ d'abord, puis δ⁺
  results.sort((a, b) => cmp(a.global, b.global));
  const top = results[0]?.global;
  const promising = top ? results.filter(r => cmp(r.global, top) === 0) : [];
  return { results, promising, tie: promising.length > 1 };
}

const fmt = (r: OrdinalImpact) => `potentiel ${ORD[r.gPlus]} · risque ${ORD[r.dMinus]}`;

// ── Serveur MCP ──────────────────────────────────────────────────────────────
// Fabrique : un serveur par connexion (stdio en local, HTTP stateless pour
// les clients distants type ChatGPT — voir src/mcp/http.ts).
export function createAuraServer(): McpServer {
const server = new McpServer({ name: "aura-decision", version: "1.0.0" });
const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
// Enregistrement d'outil via une signature allégée : l'inférence Zod complète
// des schémas imbriqués fait exploser le vérificateur de types (TS2589).
type ToolRegister = (
  name: string,
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shape: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => any,
) => void;
const registerTool = server.tool.bind(server) as unknown as ToolRegister;


const criterionSchema: z.ZodType<Criterion> = z.lazy(() => z.object({
  id: z.string(), label: z.string(),
  importance: z.enum(["Essentiel", "Important", "Secondaire", "Faible"]),
  children: z.array(criterionSchema).optional(),
}));

registerTool(
  "create_study",
  "Crée une étude décisionnelle Aura : contexte, arbre de critères ordinaux (MOE/MOP/TPM), leviers avec options, attitude du décideur (Prudent = principe de précaution, Optimiste). Renvoie l'id de l'étude.",
  {
    title: z.string(), context: z.string(),
    attitude: z.enum(["Prudent", "Optimiste"]).default("Prudent"),
    criteria: z.array(criterionSchema).min(1),
    levers: z.array(z.object({
      id: z.string(), label: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
    })).min(1),
  },
  async ({ title, context, attitude, criteria, levers }) => {
    const id = `study_${Date.now().toString(36)}`;
    putStudy({
      id, title, context, attitude, criteria,
      levers: levers.map((l: any) => ({ ...l, options: l.options.map((o: any) => ({ ...o, impacts: {} })) })),
      scenarios: [], createdAt: new Date().toISOString(),
    });
    return text(`Étude créée : ${id}. Renseignez les impacts (set_impact) puis les scénarios (add_scenario). Toute cellule non renseignée est un Inconnu ("U") — Aura ne suppose jamais un effet neutre.`);
  },
);

registerTool(
  "set_impact",
  "Renseigne l'impact d'une option de levier sur un critère feuille (TPM). Échelle ordinale : '++' forte amélioration, '+' amélioration, '0' effet évalué comme neutre, '-' dégradation, '--' forte dégradation, 'U' inconnu / information insuffisante. Ne jamais convertir des jugements en nombres.",
  {
    studyId: z.string(), leverId: z.string(), optionId: z.string(),
    criterionId: z.string(), impact: z.enum(["++", "+", "0", "-", "--", "U"]),
  },
  async ({ studyId, leverId, optionId, criterionId, impact }) => {
    const s = getStudy(studyId);
    const lev = s.levers.find(l => l.id === leverId) ?? (() => { throw new Error(`Levier inconnu : ${leverId}`); })();
    const opt = lev.options.find(o => o.id === optionId) ?? (() => { throw new Error(`Option inconnue : ${optionId}`); })();
    if (!leaves(s.criteria).some(c => c.id === criterionId)) throw new Error(`Critère feuille inconnu : ${criterionId}`);
    opt.impacts[criterionId] = impact;
    putStudy(s);
    return text(`Impact enregistré : ${opt.label} → ${criterionId} = ${impact}`);
  },
);

registerTool(
  "add_scenario",
  "Ajoute un scénario : une option choisie par levier (configuration).",
  {
    studyId: z.string(), label: z.string(),
    choice: z.record(z.string(), z.string()).describe("leverId → optionId, une entrée par levier"),
  },
  async ({ studyId, label, choice }) => {
    const s = getStudy(studyId);
    for (const lev of s.levers) {
      const oid = choice[lev.id];
      if (!oid || !lev.options.some(o => o.id === oid)) throw new Error(`Choix manquant ou invalide pour le levier ${lev.id}`);
    }
    const id = `sc_${s.scenarios.length + 1}`;
    s.scenarios.push({ id, label, choice });
    putStudy(s);
    return text(`Scénario ajouté : ${id} — ${label}`);
  },
);

registerTool(
  "evaluate_scenarios",
  "Évalue et classe les scénarios avec le moteur ordinal bipolaire (thèse Lo / IFAC 2015) : chaque scénario reçoit un profil (potentiel d'amélioration, risque de détérioration) sur l'échelle Nul/Faible/Modéré/Élevé — jamais fusionnés en un score. Si plusieurs scénarios sont ex æquo, Aura le dit explicitement au lieu de fabriquer un départage.",
  { studyId: z.string() },
  async ({ studyId }) => {
    const s = getStudy(studyId);
    if (s.scenarios.length < 2) return text("Il faut au moins 2 scénarios pour arbitrer.");
    const { results, promising, tie } = evaluateStudy(s);
    const lines = results.map((r, i) => `${i + 1}. ${r.scenario.label} — ${fmt(r.global)}`);
    const verdict = tie
      ? `NON-DISCRIMINATION : ${promising.map(p => p.scenario.label).join(" et ")} présentent le même profil ordinal. Le modèle et les connaissances disponibles ne permettent pas de les distinguer — Aura ne fabrique pas de départage artificiel. Appelez next_information pour savoir quoi apprendre afin de trancher.`
      : `Scénario prometteur : ${promising[0]?.scenario.label ?? "—"} (${fmt(promising[0].global)}).`;
    return text(`Attitude ${s.attitude}.\n${lines.join("\n")}\n\n${verdict}`);
  },
);

registerTool(
  "next_information",
  "Le prochain renseignement à obtenir : pour chaque impact inconnu ('U' ou non renseigné) des scénarios de tête, Aura simule sa résolution (hypothèse haute '++' vs basse '--') dans le moteur ordinal et indique s'il est DÉCISIF (sa valeur peut changer le classement). Inutile de payer pour apprendre ce qui ne change pas la décision.",
  { studyId: z.string() },
  async ({ studyId }) => {
    const s = getStudy(studyId);
    const { results, promising, tie } = evaluateStudy(s);
    const topSet = tie ? promising : results.slice(0, 2);
    if (topSet.length < 2) return text("Pas assez de scénarios pour analyser les renseignements décisifs.");
    const at: Attitude = s.attitude === "Prudent" ? 1 : 2;
    const profile = s.attitude === "Prudent" ? "prudent" as const : "optimiste" as const;
    const cmp = (a: OrdinalImpact, b: OrdinalImpact) => compareASC(b, a); // thèse Lô p. 83 : δ⁻ d'abord, puis δ⁺
    const out: string[] = [];
    let budget = 24;
    for (const r of topSet) {
      const other = topSet.find(o => o !== r)!;
      for (const lev of s.levers) {
        const opt = lev.options.find(o => o.id === r.scenario.choice[lev.id]);
        if (!opt) continue;
        for (const leaf of leaves(s.criteria)) {
          const v = opt.impacts[leaf.id];
          if (v !== "U" && v !== undefined) continue;
          if (budget-- <= 0) { out.push(`· à instruire — ${leaf.label} (effet de « ${opt.label} », scénario ${r.scenario.label})`); continue; }
          const simulate = (hyp: Impact) => {
            const saved = opt.impacts[leaf.id];
            opt.impacts[leaf.id] = hyp;
            const stage1 = s.criteria.map(c => aggregateTree(c, r.scenario, s, at, profile));
            const ws = normalizeW(s.criteria.map(c => IMP_W[c.importance]));
            let g: OrdinalImpact;
            try { g = aggregateNode(stage1, ws.length ? ws : [3]); } catch { g = { gPlus: 0, dMinus: 0 }; }
            if (saved === undefined) delete opt.impacts[leaf.id]; else opt.impacts[leaf.id] = saved;
            return g;
          };
          const decisive = Math.sign(cmp(simulate("++"), other.global)) !== Math.sign(cmp(simulate("--"), other.global));
          out.push(`· ${decisive ? "DÉCISIF" : "à instruire"} — ${leaf.label} (effet de « ${opt.label} », scénario ${r.scenario.label})${decisive ? ` : selon sa valeur, ${r.scenario.label} passe devant ou derrière ${other.scenario.label}` : ""}`);
        }
      }
    }
    return text(out.length ? `Renseignements à obtenir avant de décider :\n${out.join("\n")}` : "Aucun impact inconnu sur les scénarios de tête — le modèle est complètement renseigné.");
  },
);

registerTool(
  "improvement_coalitions",
  "Moteur Sow (IPMU 2016) : quelles coalitions de critères améliorer en priorité — maximisation du gain de satisfaction attendu (intégrale qualitative + médiane) SOUS CONTRAINTE d'atteignabilité par les leviers disponibles. Renvoie les coalitions « ambitieuses & atteignables » pour fonder des OKR.",
  { studyId: z.string() },
  async ({ studyId }) => {
    const s = getStudy(studyId);
    const lf = leaves(s.criteria);
    if (lf.length < 2 || lf.length > 12) return text("L'analyse Sow requiert entre 2 et 12 critères feuilles.");
    const S_MAP: Record<string, number> = { "++": 3, "+": 2 };
    const D_MAP: Record<string, number> = { "--": 3, "-": 2 };
    const actions: SowAction[] = s.levers.flatMap(lev => lev.options.map(opt => {
      const support: Record<number, number> = {}; const distract: Record<number, number> = {};
      lf.forEach((leaf, i) => {
        const v = opt.impacts[leaf.id];
        if (v && S_MAP[v]) support[i] = S_MAP[v];
        if (v && D_MAP[v]) distract[i] = D_MAP[v];
      });
      return { id: opt.id, label: opt.label, group: lev.id, support, distract };
    }));
    const att = s.attitude === "Prudent" ? "pessimiste" as const : "optimiste" as const;
    const analysis = analyzeSow({
      nCriteria: lf.length, p0: lf.map(() => 0),
      mu: possibilisticCapacity(lf.map(l => IMP_W[l.importance]), 3), maxL: 3,
      actions, worthAttitude: att, achievAttitude: att,
    });
    const name = (I: number[]) => I.map(i => lf[i].label).join(" + ");
    const lbl = ["nul", "faible", "moyen", "fort"];
    const lines = analysis.optimal.map(c => `★ ${name(c.criteria)} — apport ${lbl[c.worth]}, capacité d'action ${lbl[c.achievability]} (plans : ${c.bestPlans.slice(0, 3).map(p => p.join("+")).join(" ; ")})`);
    return text(lines.length
      ? `Coalitions d'amélioration ambitieuses & atteignables :\n${lines.join("\n")}\nFondez les OKR sur ces coalitions : l'ambition y est couverte par les leviers.`
      : "Aucune coalition à la fois valorisée et atteignable avec les leviers actuels.");
  },
);

registerTool(
  "decision_record",
  "Génère le Decision Record (markdown) : la décision (ou la non-discrimination assumée), le classement ordinal, la configuration, et les inconnues restantes — horodaté. C'est l'acte notarié de la décision.",
  { studyId: z.string() },
  async ({ studyId }) => {
    const s = getStudy(studyId);
    const { results, promising, tie } = evaluateStudy(s);
    const unknownCount = s.levers.flatMap(l => l.options).reduce((n, o) =>
      n + leaves(s.criteria).filter(c => (o.impacts[c.id] ?? "U") === "U").length, 0);
    const md = [
      `# Decision Record — ${s.title}`,
      `*Établi le ${new Date().toLocaleString("fr-FR")} · Moteur ordinal bipolaire (thèse Lo) · Attitude ${s.attitude}*`,
      ``, `## Contexte`, s.context, ``,
      tie
        ? `## Scénarios non discriminés\n${promising.map(p => `- **${p.scenario.label}** (${fmt(p.global)})`).join("\n")}\n\nLe modèle et les connaissances disponibles à cette date ne permettent pas de les distinguer. Tout départage est un choix hors modèle et doit être motivé.`
        : `## Décision\n**${promising[0]?.scenario.label ?? "—"}** — ${promising[0] ? fmt(promising[0].global) : ""}`,
      ``, `## Classement complet`,
      ...results.map((r, i) => `${i + 1}. ${r.scenario.label} — ${fmt(r.global)}`),
      ``, `## Inconnues`,
      unknownCount > 0
        ? `${unknownCount} impact(s) inconnu(s) ou non renseigné(s) au moment de la décision — voir next_information pour leur caractère décisif.`
        : `Le modèle est complètement renseigné.`,
    ].join("\n");
    return text(md);
  },
);

registerTool(
  "list_studies",
  "Liste les études décisionnelles existantes.",
  {},
  async () => {
    const all = Object.values(loadAll());
    return text(all.length
      ? all.map(s => `${s.id} — ${s.title} (${s.scenarios.length} scénarios, ${s.createdAt})`).join("\n")
      : "Aucune étude. Créez-en une avec create_study.");
  },
);

return server;
}

// Entrée stdio (Claude Desktop / Claude Code). Le point d'entrée HTTP
// (src/mcp/http.ts) positionne AURA_MCP_HTTP=1 avant d'importer ce module.
if (process.env.AURA_MCP_HTTP !== "1") {
  const server = createAuraServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Aura Décision MCP server — prêt (stdio).");
}
