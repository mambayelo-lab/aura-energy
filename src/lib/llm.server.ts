// Unified LLM caller — Mistral, seul moteur texte de l'application.
// Aucune passerelle IA tierce (Lovable) n'est plus appelée ici : tout appel
// texte passe par la clé Mistral du projet. La transcription et la synthèse
// vocales (voice.functions.ts) restent un sujet séparé, non concerné ici.
export type LlmMsg = { role: "system" | "user" | "assistant"; content: string };

export type LlmResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string; status?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function llmChat(opts: {
  messages: LlmMsg[];
  model?: string;
  temperature?: number;
  responseFormat?: { type: "json_object" };
  /** Conservé pour compatibilité des appelants existants ; sans effet — Mistral est l'unique moteur. */
  preferMistral?: boolean;
}): Promise<LlmResult> {
  if (!process.env.MISTRAL_API_KEY && !process.env.MISTRAL_API_KEY_2) {
    return { ok: false, error: "Aucun moteur IA disponible côté serveur (clé Mistral absente)." };
  }
  const { mistralChat } = await import("./mistral.server");
  const model = opts.model || "mistral-small-latest";

  let last: LlmResult = { ok: false, error: "Aucune tentative IA." };
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await mistralChat({
      messages: opts.messages,
      model,
      temperature: opts.temperature ?? 0,
      jsonMode: opts.responseFormat?.type === "json_object",
      maxTokens: 1600,
      guardrails: false, // les prompts d'Aura portent déjà leurs propres règles
    });
    if (r.ok) {
      if (!r.content.trim()) return { ok: false, error: "Réponse IA vide." };
      return { ok: true, content: r.content, model };
    }
    // Repli transitoire uniquement (timeout, erreur réseau) — une clé absente
    // ou une erreur de requête ne se résout pas en réessayant.
    last = { ok: false, error: r.error };
    const transitoire = /timeout|429|5\d\d|réseau|network/i.test(r.error);
    if (!transitoire || attempt === 2) break;
    await sleep(800 * (attempt + 1));
  }
  return last;
}
