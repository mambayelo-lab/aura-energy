// Mistral chat for Admin Copilot embedded in every admin page.
export type MistralContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export type MistralMsg = { role: "system" | "user" | "assistant"; content: string | MistralContentPart[] };

/**
 * Streaming version — consumes the Mistral SSE stream and calls onChunk for each token.
 * Returns the full accumulated content when done.
 */
export async function mistralStream(opts: {
  messages: MistralMsg[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onChunk: (token: string) => void;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const key = process.env.MISTRAL_API_KEY_2 ?? process.env.MISTRAL_API_KEY;
  if (!key) return { ok: false, error: "MISTRAL_API_KEY manquant." };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model || "mistral-small-latest",
        messages: opts.messages,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1200,
        stream: true,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok || !r.body) return { ok: false, error: `Mistral ${r.status}` };
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s || s === "data: [DONE]") continue;
        if (s.startsWith("data: ")) {
          try {
            const j = JSON.parse(s.slice(6));
            const tok = j.choices?.[0]?.delta?.content;
            if (tok) { opts.onChunk(tok); full += tok; }
          } catch { /* skip */ }
        }
      }
    }
    return { ok: true, content: full };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: (e as Error).name === "AbortError" ? "Timeout" : (e as Error).message };
  }
}

export async function mistralChat(opts: {
  messages: MistralMsg[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  // Garde-fous communs (llm-guardrails.ts), ajoutés au message système.
  // Par défaut, le contrat de vérité et le rappel du contrôle utilisateur
  // s'appliquent à TOUT appel : c'est ce qui garantit qu'aucun écran d'Aura ne
  // peut produire un chiffre, un nom propre ou un score inventé, même si le
  // prompt métier a oublié de l'interdire. Les volets « profondeur » et
  // « originalité » se demandent explicitement, là où l'on génère des leviers,
  // des options, des indicateurs ou des propositions d'architecture.
  // `false` désactive l'ajout (utile pour une transcription pure).
  guardrails?: false | Array<"verite" | "profondeur" | "originalite" | "controle">;
  // Lot 5 — la consommation renvoyée par Mistral est remontée telle quelle
  // (aucune estimation locale) pour alimenter le suivi de tokens.
}): Promise<{ ok: true; content: string; promptTokens?: number; completionTokens?: number } | { ok: false; error: string }> {
  const key = process.env.MISTRAL_API_KEY_2 ?? process.env.MISTRAL_API_KEY;
  if (!key) return { ok: false, error: "MISTRAL_API_KEY manquant côté serveur." };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    let messages = opts.messages;
    if (opts.guardrails !== false) {
      const { guardrails } = await import("./v4/llm-guardrails");
      const block = guardrails(opts.guardrails ?? ["verite", "controle"]);
      const i = messages.findIndex(m => m.role === "system");
      if (i < 0) {
        messages = [{ role: "system", content: block.trim() }, ...messages];
      } else {
        messages = messages.map((m, n) => {
          if (n !== i) return m;
          return typeof m.content === "string"
            ? { ...m, content: m.content + block }
            : { ...m, content: [...m.content, { type: "text" as const, text: block }] };
        });
      }
    }
    const body: Record<string, unknown> = {
      model: opts.model || "mistral-small-latest",
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 700,
    };
    if (opts.jsonMode) body.response_format = { type: "json_object" };

    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `Mistral ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      ok: true,
      content: j?.choices?.[0]?.message?.content ?? "",
      promptTokens: j?.usage?.prompt_tokens ?? 0,
      completionTokens: j?.usage?.completion_tokens ?? 0,
    };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: (e as Error).name === "AbortError" ? "Timeout Mistral (90s)" : (e as Error).message };
  }
}
