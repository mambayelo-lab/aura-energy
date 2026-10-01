// Routage des questions du copilote selon l'intention, avant tout accès à la donnée :
// structurel → ontologie ; factuel → faits en cache ; causal → règles ; temporel → historique.
// Le copilote ne déclenche jamais d'appel à une source : il lit l'instantané d'Aura.
export type CopilotIntent = "structurel" | "factuel" | "causal" | "temporel";

const RX: [CopilotIntent, RegExp][] = [
  ["temporel", /(évolu|tendan|historique|depuis|dernier(e|s)? (mois|semaine|jour)|hier|la semaine|au fil|série|trend|history|over time|last (week|month)|since)/i],
  ["causal", /(pourquoi|cause|expliqu|à cause|origine|d'où vient (le|la) (retard|rupture)|règle|why|because|root cause|explain)/i],
  ["structurel", /(qu['’]est-ce qu|c['’]est quoi|définition|relation|lien entre|quels? (objets|attributs|champs|sources)|source de|maître|ontologie|modèle de données|what is|schema|structure|which (source|field))/i],
];

export function classifyIntent(question: string): CopilotIntent {
  for (const [intent, rx] of RX) if (rx.test(question)) return intent;
  return "factuel";
}

export interface RouteInputs {
  ontology?: string;
  facts?: string;
  rules?: string;
  history?: string;
}
export interface Routed { intent: CopilotIntent; context: string; reads: "ontologie" | "cache" | "règles" | "historique"; sourceCalls: 0 }

/** Contexte transmis au copilote : seulement le compartiment utile à l'intention. */
export function routeQuestion(question: string, inputs: RouteInputs): Routed {
  const intent = classifyIntent(question);
  const pick = { structurel: ["ontologie", inputs.ontology], factuel: ["cache", inputs.facts], causal: ["règles", inputs.rules], temporel: ["historique", inputs.history] } as const;
  const [reads, context] = pick[intent];
  return { intent, reads, context: context ? `[${reads}] ${context}` : "", sourceCalls: 0 };
}
