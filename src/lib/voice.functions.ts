import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";

/**
 * Transcription vocale — l'utilisateur dicte sa réponse dans le questionnaire
 * (Comprendre / Cadrage) et le texte se dépose dans le champ concerné.
 * L'audio arrive en base64 depuis le navigateur (MediaRecorder), repart en
 * multipart vers la passerelle IA.
 */
export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        audioBase64: z.string().min(32),
        mimeType: z.string().default("audio/webm"),
        language: z.string().default("fr"),
        /** Contexte facultatif pour guider le vocabulaire métier. */
        prompt: z.string().max(600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // Mistral d'abord (clé du projet) : Aura ne dépend d'aucun autre service.
    // La passerelle n'est qu'un secours quand la clé Mistral est absente.
    const mistral = process.env["MISTRAL_API_KEY"];
    const key = process.env["LOVABLE_API_KEY"];
    if (!mistral && !key) return { ok: false as const, error: "Transcription indisponible (clé IA manquante)." };


    let buffer: ArrayBuffer;
    try {
      const raw = data.audioBase64.includes(",") ? data.audioBase64.split(",")[1]! : data.audioBase64;
      const bin = atob(raw);
      buffer = new ArrayBuffer(bin.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    } catch {
      return { ok: false as const, error: "Audio illisible." };
    }
    if (buffer.byteLength < 2000) {
      return { ok: false as const, error: "Enregistrement trop court — reparlez un peu plus longtemps." };
    }


    const ext = data.mimeType.includes("mp4") || data.mimeType.includes("m4a")
      ? "mp4"
      : data.mimeType.includes("ogg")
        ? "ogg"
        : data.mimeType.includes("mpeg")
          ? "mp3"
          : data.mimeType.includes("wav")
            ? "wav"
            : "webm";

    // Voxtral (Mistral) : transcription sans autre dépendance.
    if (mistral) {
      try {
        const f = new FormData();
        f.append("file", new Blob([buffer], { type: data.mimeType }), `dictee.${ext}`);
        f.append("model", "voxtral-mini-latest");
        f.append("language", data.language);
        const r = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${mistral}` },
          body: f,
        });
        if (r.ok) {
          const j = (await r.json()) as { text?: string };
          const t = (j.text ?? "").trim();
          if (t) return { ok: true as const, text: t };
        } else {
          console.error(`Voxtral ${r.status}: ${(await r.text()).slice(0, 200)}`);
        }
      } catch (e) {
        console.error(`Voxtral injoignable : ${(e as Error).message}`);
      }
    }

    if (!key) {
      return { ok: false as const, error: "Rien n'a été compris — réessayez, ou saisissez votre réponse au clavier." };
    }

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: data.mimeType }), `dictee.${ext}`);
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("language", data.language);
    if (data.prompt) form.append("prompt", data.prompt);

    let res: Response;
    try {
      res = await fetch(GATEWAY, { method: "POST", headers: { "Lovable-API-Key": key }, body: form });
    } catch (e) {
      return { ok: false as const, error: `Service de transcription injoignable : ${(e as Error).message}` };
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`Transcription failed [${res.status}]: ${body}`);
      if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés — ajoutez des crédits pour utiliser la dictée." };
      if (res.status === 403) return { ok: false as const, error: "Transcription bloquée par la politique de l'espace de travail." };
      if (res.status === 429) return { ok: false as const, error: "Trop de demandes — réessayez dans quelques secondes." };
      return { ok: false as const, error: `Transcription en échec [${res.status}] : ${body.slice(0, 300)}` };
    }

    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();
    if (!text) return { ok: false as const, error: "Rien n'a été compris — reparlez plus près du micro." };
    return { ok: true as const, text };
  });

const TTS_GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/speech";

/**
 * Synthèse vocale — Aura lit ses questions à voix haute, puis répète la
 * reformulation de ce qui a été dicté avant enregistrement. Retour en base64
 * (mp3) : le navigateur le joue tel quel, pas de streaming à gérer côté UI.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        text: z.string().min(1).max(1200),
        lang: z.enum(["fr", "en"]).default("fr"),
        voice: z.string().default("alloy"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "Voix indisponible (clé IA manquante)." };

    const instructions = data.lang === "en"
      ? "Speak in English, calm, professional, executive briefing tone. Never add anything to the text."
      : "Parle en français, ton posé, professionnel, registre de comité de direction. N'ajoute rien au texte.";

    let res: Response;
    try {
      res = await fetch(TTS_GATEWAY, {
        method: "POST",
        headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: data.text,
          voice: data.voice,
          instructions,
          response_format: "mp3",
        }),
      });
    } catch (e) {
      return { ok: false as const, error: `Passerelle IA injoignable : ${(e as Error).message}` };
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`TTS failed [${res.status}]: ${body.slice(0, 300)}`);
      if (res.status === 402) return { ok: false as const, error: "Crédits IA épuisés — la lecture vocale est suspendue." };
      if (res.status === 403) return { ok: false as const, error: "Lecture vocale bloquée par la politique de l'espace de travail." };
      if (res.status === 429) return { ok: false as const, error: "Trop de demandes — réessayez dans quelques secondes." };
      return { ok: false as const, error: `Lecture vocale en échec [${res.status}].` };
    }

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return { ok: true as const, audioBase64: btoa(bin), mimeType: "audio/mpeg" };
  });
