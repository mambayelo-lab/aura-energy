// Comparaison du générateur (ancien 2df68072 / actuel) sur 5 énoncés. Prérequis : extraire le prompt de
// generateFullModel de l'ancien commit dans /tmp/claude-0/old-prompt.json ; MISTRAL_API_KEY. SKIP_OLD=1 : actuel seulement.
import { readFileSync, writeFileSync } from "node:fs";
import { deduceFromDescription, applyDeduction, completenessQuestions, sanitizeProposal } from "../src/lib/v4/decision-dialogue";
import { DECISION_PROMPT } from "../src/lib/v4/decision-dialogue.functions";
import { newSession } from "../src/lib/v4/atelier-store";
import { getLeafCriteria } from "../src/lib/v4/atelier-compute";
import { rankOptions } from "../src/lib/v4/decision-express";

const OLD = JSON.parse(readFileSync("/tmp/claude-0/old-prompt.json", "utf8"));
const STATEMENTS = [
  "Double sourcing ou accord-cadre avec notre fournisseur unique de composants critiques ? Nous voulons éviter l'arrêt de ligne sans dépasser le budget achats.",
  "Faut-il ouvrir un hub régional ou confier la logistique e-commerce à un prestataire (3PL) ? Livrer en 24 h sans dégrader la marge.",
  "La prévision de demande dérive avant la promotion de Noël : prévision collaborative, tampon renforcé ou S&OP hebdomadaire ?",
  "Retard transport critique sur l'axe Asie-Europe : passer une partie en aérien, rerouter par un hub alternatif ou attendre ?",
  "Choisir un nouveau WMS/TMS du marché ou faire évoluer l'outil actuel, sans risque pendant les pics de fin d'année.",
];
async function chat(system: string, user: string, maxTokens: number, json = true) {
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MISTRAL_API_KEY_2 ?? process.env.MISTRAL_API_KEY}` },
    body: JSON.stringify({ model: "mistral-small-latest", temperature: 0.2, max_tokens: maxTokens, ...(json ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  const j: any = await r.json(); return j.choices?.[0]?.message?.content ?? "";
}
const leaves = (c: any[]): any[] => c.flatMap(x => (x.children?.length ? leaves(x.children) : [x]));
const out: any[] = [];
for (const q of STATEMENTS) {
  const t0 = Date.now();
  let old: any = null;
  if (!process.env.SKIP_OLD) try { old = JSON.parse((await chat(OLD.system, OLD.user.replace("${data.context}${elicitCtx}${data.companyContext ?? \"\"}", q).replace("${data.problemType}", "operationnel").replace('${data.dimensions.join(", ")}', "coût, délai, risque"), 12000)).replace(/^```json|```$/g, "")); } catch (e) { old = { error: String(e) }; }
  const tOld = Date.now() - t0;
  const t1 = Date.now();
  const d = deduceFromDescription(q);
  let llm: any = null; try { llm = sanitizeProposal(JSON.parse(await chat(DECISION_PROMPT, `Question : ${q}`, 3200)), q); } catch { llm = null; }
  if (llm) d.proposal = { ...llm, enjeu: llm.enjeu ?? d.proposal.enjeu, risques: llm.risques?.length ? llm.risques : d.proposal.risques };
  const s = { ...newSession({ contextRaw: q }), ...applyDeduction(newSession({ contextRaw: q }), d, q) } as any;
  const tNew = Date.now() - t1;
  const oldL = old?.criteria ? leaves(old.criteria) : [];
  out.push({
    question: q,
    ancien: { ms: tOld, moe: old?.criteria?.length ?? 0, mop: (old?.criteria ?? []).reduce((a: number, m: any) => a + (m.children?.length ?? 0), 0), tpm: oldL.length, leviers: old?.leviers?.length ?? 0, options: (old?.leviers ?? []).reduce((a: number, l: any) => a + (l.options?.length ?? 0), 0), justifiees: (old?.leviers ?? []).flatMap((l: any) => l.options ?? []).filter((o: any) => o.justification).length, exemplesTPM: oldL.slice(0, 6).map((x: any) => x.label), exemplesLeviers: (old?.leviers ?? []).slice(0, 5).map((l: any) => `${l.label} : ${(l.options ?? []).map((o: any) => o.label).join(" / ")}`), questions: "élicitation : 8 champs + PESTEL (6 dimensions) + questions discriminantes" },
    nouveau: { ms: tNew, llm: !!llm, moe: s.criteria.length, mop: s.criteria.reduce((a: number, m: any) => a + (m.children?.length ?? 0), 0), tpm: getLeafCriteria(s.criteria).length, leviers: s.leviersDef.length, options: s.leviersDef.reduce((a: number, l: any) => a + l.options.length, 0), justifiees: s.leviersDef.flatMap((l: any) => l.options).filter((o: any) => o.justification).length, risques: (s.elicitation?.risques ?? []).length, modeleLLM: !!llm?.modele, pestel: s.elicitation?.pestelAnswers, questionsCadrage: s.elicitation?.questionsCadrage, exemplesTPM: getLeafCriteria(s.criteria).map((c: any) => c.label), exemplesLeviers: s.leviersDef.map((l: any) => `${l.label} : ${l.options.map((o: any) => o.label).join(" / ")}`), questions: completenessQuestions(s, rankOptions).map(x => x.text) },
  });
  console.error("fait", q.slice(0, 40), tOld, tNew);
}
writeFileSync("/tmp/claude-0/-home-user-aura-decision-zen/bd2e1136-920a-5889-b580-c4043d9a7ce4/scratchpad/chantier-suivant/comparaison-generateur-apres.json", JSON.stringify(out, null, 1));
