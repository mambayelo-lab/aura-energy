// speech-client.ts — lecture vocale côté navigateur (Aura pose ses questions
// à voix haute, puis répète la reformulation avant enregistrement) et petit
// magasin local de langue d'échange (fr / en) partagé par le Studio et le
// Copilote Décisionnel.
import { synthesizeSpeech } from "../voice.functions";

export type SpeechLang = "fr" | "en";

// ── Langue d'échange ────────────────────────────────────────────────────────
const LANG_KEY = "aura.v4.lang";
const VOICE_KEY = "aura.v4.voiceEnabled";
type Listener = () => void;
const langListeners = new Set<Listener>();

export function loadLang(): SpeechLang {
  if (typeof localStorage === "undefined") return "fr";
  return localStorage.getItem(LANG_KEY) === "en" ? "en" : "fr";
}
export function saveLang(lang: SpeechLang) {
  if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, lang);
  langListeners.forEach(l => l());
}
export function onLangChange(fn: Listener): () => void {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
}

/** La voix est-elle activée ? Par défaut oui — c'est l'usage demandé en atelier. */
export function voiceEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(VOICE_KEY) !== "0";
}
export function setVoiceEnabled(on: boolean) {
  if (typeof localStorage !== "undefined") localStorage.setItem(VOICE_KEY, on ? "1" : "0");
  langListeners.forEach(l => l());
}

// ── Lecture ─────────────────────────────────────────────────────────────────
// La voix d'Aura n'appelle aucun service extérieur par défaut : elle utilise la
// synthèse intégrée au navigateur. Aura reste ainsi autonome (dépôt Git + clé
// Mistral pour le raisonnement). Le service de synthèse distant n'est appelé
// qu'en dernier recours, si le navigateur n'en propose aucune.
let current: HTMLAudioElement | null = null;
const cache = new Map<string, string>(); // texte+langue → data URL

export function stopSpeaking() {
  if (current) { try { current.pause(); } catch { /* déjà arrêté */ } current = null; }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch { /* déjà arrêté */ }
  }
}

/** Voix du navigateur : disponible partout, sans clé ni serveur. */
function parleNavigateur(text: string, lang: SpeechLang): Promise<boolean> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve(false);
  const synth = window.speechSynthesis;
  const voix = synth.getVoices?.() ?? [];
  const cible = lang === "en" ? "en" : "fr";
  return new Promise<boolean>((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "en" ? "en-US" : "fr-FR";
      const v = voix.find((x) => x.lang?.toLowerCase().startsWith(cible));
      if (v) u.voice = v;
      u.rate = 1;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      synth.speak(u);
      // Certains navigateurs n'émettent ni onend ni onerror si aucune voix
      // n'est installée : on considère l'échec au bout d'un instant.
      setTimeout(() => { if (!synth.speaking && !synth.pending) resolve(voix.length > 0); }, 400);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Lit un texte à voix haute. Résolue quand la lecture est terminée (ou
 * immédiatement si la voix est coupée / indisponible) — jamais rejetée : une
 * voix qui échoue ne doit pas bloquer le questionnaire.
 */
export async function speak(text: string, lang: SpeechLang = loadLang()): Promise<void> {
  const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (!clean || !voiceEnabled()) return;
  stopSpeaking();

  if (await parleNavigateur(clean, lang)) return;
  if (typeof Audio === "undefined") return;

  const key = `${lang}:${clean}`;
  let src = cache.get(key);
  if (!src) {
    try {
      const r = await synthesizeSpeech({ data: { text: clean, lang } });
      if (!r.ok) { console.warn("Lecture vocale indisponible :", r.error); return; }
      src = `data:${r.mimeType};base64,${r.audioBase64}`;
      cache.set(key, src);
    } catch (e) {
      console.warn("Lecture vocale impossible :", (e as Error).message);
      return;
    }
  }

  await new Promise<void>(resolve => {
    const audio = new Audio(src);
    current = audio;
    audio.onended = () => { if (current === audio) current = null; resolve(); };
    audio.onerror = () => { if (current === audio) current = null; resolve(); };
    audio.play().catch(() => resolve());
  });
}

// ── Formules parlées ────────────────────────────────────────────────────────
// Registre volontairement sobre : celui d'un directeur de mission qui pose la
// question, restitue, propose, puis fait valider — jamais familier, jamais
// bavard.
export function reformulationPhrase(text: string, lang: SpeechLang): string {
  return lang === "en"
    ? `Let me play that back: ${text}. Have I captured it correctly?`
    : `Je vous restitue : ${text}. Est-ce fidèle à votre pensée ?`;
}
export function savedPhrase(text: string, lang: SpeechLang): string {
  return lang === "en"
    ? `Noted: ${text}. Let's move to the next point.`
    : `C'est noté : ${text}. Passons au point suivant.`;
}
export function retryPhrase(lang: SpeechLang): string {
  return lang === "en" ? "Of course, please restate it." : "Bien sûr, reformulez votre réponse.";
}

/**
 * Déduction proposée à partir des réponses déjà données : Aura pose la
 * question, énonce sa déduction, puis demande un arbitrage explicite
 * (valider / ajuster / écarter / passer).
 */
export function suggestionPhrase(question: string, suggestion: string, lang: SpeechLang): string {
  return lang === "en"
    ? `${question} Based on what you have told me so far, my working hypothesis is: ${suggestion}. Would you like to confirm it, adjust it, set it aside and answer yourself, or skip this point?`
    : `${question} À partir de ce que vous m'avez dit, ma lecture est la suivante : ${suggestion}. Souhaitez-vous la valider, l'ajuster, l'écarter et répondre vous-même, ou passer ce point ?`;
}
export function suggestionAcceptedPhrase(lang: SpeechLang): string {
  return lang === "en"
    ? "Confirmed — I keep that hypothesis and record it."
    : "Validé — je retiens cette lecture et je l'enregistre.";
}
export function suggestionRejectedPhrase(lang: SpeechLang): string {
  return lang === "en"
    ? "Understood, I set it aside. Please give me your own answer."
    : "Entendu, je l'écarte. Donnez-moi votre propre réponse.";
}

