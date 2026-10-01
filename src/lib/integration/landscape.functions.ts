// Cartographie du SI à partir d'un texte de schéma (transcription d'image par vision, PDF…).
import { createServerFn } from "@tanstack/react-start";
import { LANDSCAPE_PROMPT, landscapeFromText, sanitizeLandscape, type Landscape } from "./landscape";

export const deduceLandscape = createServerFn({ method: "POST" })
  .validator((d: { text: string }) => ({ text: String(d.text ?? "").slice(0, 60_000) }))
  .handler(async ({ data }): Promise<Landscape> => {
    const fallback = landscapeFromText(data.text);
    try {
      const { mistralChat } = await import("../mistral.server");
      const r = await mistralChat({ jsonMode: true, temperature: 0.1, maxTokens: 2500, messages: [{ role: "system", content: LANDSCAPE_PROMPT }, { role: "user", content: data.text }] });
      if (!r.ok) return fallback;
      const l = sanitizeLandscape(JSON.parse(r.content), data.text);
      return l && l.apps.length ? l : fallback;
    } catch { return fallback; }
  });
