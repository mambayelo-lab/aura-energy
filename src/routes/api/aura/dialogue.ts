import { createFileRoute } from "@tanstack/react-router";

type DialogueMessage = { role: "user" | "assistant"; content: string };
type DialogueRequest = {
  space: "home" | "decide" | "architect" | "packs" | "connect";
  path?: string;
  messages: DialogueMessage[];
};

const encoder = new TextEncoder();
const send = (controller: ReadableStreamDefaultController<Uint8Array>, payload: unknown) =>
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

function systemPrompt(space: DialogueRequest["space"]) {
  const mission = space === "decide"
    ? "Aidez à cadrer une décision, expliciter ce qui compte, les leviers modifiables, les options, les impacts et les informations manquantes. Ne calculez jamais à la place du moteur BORA."
    : space === "architect"
      ? "Aidez à cadrer la transformation et à proposer des évolutions de capacités, applications, données, flux, exigences, trajectoire et backlog comme un architecte d'entreprise et de solution."
      : space === "connect"
        ? "Aidez à identifier les sources et connecteurs pertinents sans prétendre qu'une connexion existe."
        : "Aidez l'utilisateur à choisir entre Décider et Architecturer et à formuler son objectif.";

  return `Vous êtes Aura, copilote professionnel de décision et d'architecture.
${mission}

Règles impératives :
- Répondez en français, avec vouvoiement, en 2 à 6 phrases courtes.
- Utilisez uniquement les faits fournis. Signalez explicitement toute hypothèse ou information manquante.
- Ne produisez aucun score, mesure, application, flux, personne ou fait non fourni.
- Une demande de modification est toujours une PROPOSITION à confirmer ; ne dites jamais qu'elle est déjà appliquée.
- Terminez une proposition par une ligne exactement sous la forme :
PROPOSITION: <résumé concret et court>
- Pour une simple question, n'ajoutez pas de ligne PROPOSITION.
- Orientez vers l'étape utile, sans exposer le jargon interne inutilement.
- Ne modifiez jamais et ne réinterprétez jamais les calculs BORA.`;
}

async function callMistral(body: DialogueRequest) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return { ok: false as const, status: 503, error: "Moteur IA indisponible : clé Mistral absente." };

  const messages = body.messages
    .slice(-12)
    .map(message => ({
      role: message.role,
      content: String(message.content || "").slice(0, 4000),
    }))
    .filter(message => message.content.trim());

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.MISTRAL_DIALOGUE_MODEL || "mistral-small-latest",
        messages: [
          { role: "system", content: systemPrompt(body.space) },
          { role: "system", content: `Contexte d'interface : espace=${body.space}; route=${String(body.path || "").slice(0, 200)}.` },
          ...messages,
        ],
        temperature: 0.2,
        max_tokens: 700,
        stream: true,
      }),
    });

    if (response.ok && response.body) return { ok: true as const, response };
    const details = (await response.text().catch(() => "")).slice(0, 240);
    if (response.status !== 429 || attempt === 2) {
      return {
        ok: false as const,
        status: response.status === 429 ? 503 : Math.max(400, response.status),
        error: response.status === 429
          ? "Aura est momentanément très sollicitée. Réessayez dans quelques instants."
          : `Mistral ${response.status}: ${details}`,
      };
    }
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 700 * (attempt + 1)));
  }
  return { ok: false as const, status: 503, error: "Moteur IA temporairement indisponible." };
}

export const Route = createFileRoute("/api/aura/dialogue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: DialogueRequest;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Requête invalide." }, { status: 400 });
        }
        if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
          return Response.json({ error: "Message manquant." }, { status: 400 });
        }

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              const result = await callMistral(body);
              if (!result.ok) {
                send(controller, { error: result.error, retryable: result.status === 503 });
                send(controller, { done: true });
                controller.close();
                return;
              }

              const reader = result.response.body!.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let full = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const token = json.choices?.[0]?.delta?.content;
                    if (typeof token === "string" && token) {
                      full += token;
                      send(controller, { token });
                    }
                  } catch {
                    // Une ligne SSE incomplète est ignorée ; le buffer conserve les fragments.
                  }
                }
              }

              const proposal = full.match(/(?:^|\n)PROPOSITION:\s*(.+)$/im)?.[1]?.trim();
              send(controller, { done: true, proposal: proposal || null });
              controller.close();
            } catch (error) {
              send(controller, { error: error instanceof Error ? error.message : "Erreur IA inattendue.", retryable: true });
              send(controller, { done: true });
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
