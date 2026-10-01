import React, { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../../lib/voice.functions";
import {
  speak, stopSpeaking, loadLang, onLangChange, voiceEnabled,
  reformulationPhrase, savedPhrase, retryPhrase, type SpeechLang,
} from "../../lib/v4/speech-client";

type Status = "idle" | "recording" | "transcribing" | "confirming";

const MAX_MS = 120_000;

// Reconnaissance vocale intégrée au navigateur (Web Speech API) : gratuite,
// sans clé ni abonnement, déjà disponible dans Chrome/Edge. Utilisée en
// priorité — le circuit serveur (MediaRecorder + transcribeAudio, qui exige
// une clé Mistral ou une passerelle IA) ne sert plus que de secours, pour les
// navigateurs qui ne l'implémentent pas (Firefox, Safari) ou si elle échoue.
type WebSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
function reconnaissanceNavigateur(): (new () => WebSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => WebSpeechRecognition) | null ?? null;
}

/**
 * Bouton micro réutilisable — l'utilisateur dicte sa réponse, le texte
 * transcrit est renvoyé au champ appelant. Pensé pour les questionnaires
 * (Comprendre côté Décision, Cadrage côté Architecturer) où taper de longues
 * réponses est le principal frein à l'usage en atelier.
 *
 * Avec `question`, Aura lit la question à voix haute (bouton 🔊). Avec
 * `confirm`, la réponse dictée est reformulée oralement avant d'être écrite :
 * l'utilisateur valide, Aura répète ce qui est enregistré, puis on passe à la
 * suite.
 */
export function VoiceInput({
  onText,
  label,
  contextPrompt,
  compact = false,
  disabled = false,
  question,
  confirm = false,
  onValidated,
}: {
  /** Reçoit le texte transcrit (à concaténer ou remplacer par l'appelant). */
  onText: (text: string) => void;
  label?: string;
  /** Vocabulaire métier pour guider la transcription. */
  contextPrompt?: string;
  compact?: boolean;
  disabled?: boolean;
  /** Question posée — lue à voix haute par Aura. */
  question?: string;
  /** Reformulation orale + validation avant écriture. */
  confirm?: boolean;
  /** Appelé après validation orale du texte. */
  onValidated?: (text: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [lang, setLang] = useState<SpeechLang>(() => loadLang());
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => onLangChange(() => setLang(loadLang())), []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnaissanceRef = useRef<WebSpeechRecognition | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function say(text: string) {
    setSpeaking(true);
    await speak(text, lang);
    setSpeaking(false);
  }

  async function readQuestion() {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    if (question) await say(question);
  }

  async function traiterTexte(texte: string) {
    if (!texte.trim()) {
      setStatus("idle");
      setError(lang === "en" ? "Nothing understood — try again." : "Rien n'a été compris — réessayez.");
      return;
    }
    if (confirm) {
      setPending(texte);
      setStatus("confirming");
      if (voiceEnabled()) await say(reformulationPhrase(texte, lang));
    } else {
      onText(texte);
      setStatus("idle");
    }
  }

  /** Dictée via le navigateur : gratuite, sans clé, sans aller-retour serveur.
   * Essayée en premier partout où elle existe (Chrome, Edge). */
  function startNavigateur(Ctor: new () => WebSpeechRecognition): boolean {
    try {
      const reco = new Ctor();
      reco.lang = lang === "en" ? "en-US" : "fr-FR";
      reco.continuous = true;
      reco.interimResults = false;
      let texte = "";
      reco.onresult = (e) => {
        texte = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
      };
      reco.onerror = (e) => {
        // "no-speech"/"aborted" : l'utilisateur a juste arrêté sans parler —
        // pas une panne à signaler. "not-allowed"/"network" : bascule serveur.
        if (e.error === "not-allowed" || e.error === "network") {
          reconnaissanceRef.current = null;
          void startServeur();
          return;
        }
      };
      reco.onend = () => {
        reconnaissanceRef.current = null;
        cleanup();
        setSeconds(0);
        setStatus((s) => (s === "recording" ? "idle" : s));
        if (texte) void traiterTexte(texte);
      };
      reconnaissanceRef.current = reco;
      reco.start();
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      autoStopRef.current = setTimeout(() => { try { reco.stop(); } catch { /* déjà arrêté */ } }, MAX_MS);
      return true;
    } catch {
      return false;
    }
  }

  /** Circuit de secours : enregistrement + transcription serveur (Mistral
   * Voxtral, ou passerelle IA) — pour les navigateurs sans reconnaissance
   * intégrée (Firefox, Safari), ou si celle-ci échoue. */
  async function startServeur() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(lang === "en" ? "Microphone unavailable in this browser." : "Micro non disponible dans ce navigateur.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(lang === "en" ? "Microphone access denied." : "Accès au micro refusé.");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      .find(m => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;

    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = async () => {
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      cleanup();
      setSeconds(0);
      if (blob.size < 2000) {
        setStatus("idle");
        setError(lang === "en" ? "Recording too short." : "Enregistrement trop court.");
        return;
      }
      setStatus("transcribing");
      try {
        const base64 = await blobToBase64(blob);
        const r = await transcribeAudio({ data: { audioBase64: base64, mimeType: type, language: lang, prompt: contextPrompt } });
        if (!r.ok) { setError(r.error); setStatus("idle"); return; }
        await traiterTexte(r.text);
      } catch (e) {
        setError((e as Error).message || (lang === "en" ? "Transcription failed." : "Transcription impossible."));
        setStatus("idle");
      }
    };

    rec.start();
    setStatus("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    autoStopRef.current = setTimeout(() => { try { rec.stop(); } catch { /* déjà arrêté */ } }, MAX_MS);
  }

  async function start() {
    setError(null);
    stopSpeaking();
    setSpeaking(false);
    const Ctor = reconnaissanceNavigateur();
    if (Ctor && startNavigateur(Ctor)) return;
    await startServeur();
  }

  function stop() {
    if (reconnaissanceRef.current) { try { reconnaissanceRef.current.stop(); } catch { /* déjà arrêté */ } return; }
    try { recorderRef.current?.stop(); } catch { /* déjà arrêté */ }
  }

  async function validate() {
    const text = pending ?? "";
    setPending(null);
    setStatus("idle");
    onText(text);
    onValidated?.(text);
    if (voiceEnabled()) await say(savedPhrase(text, lang));
  }

  async function retry() {
    setPending(null);
    setStatus("idle");
    if (voiceEnabled()) await say(retryPhrase(lang));
    void start();
  }

  const recording = status === "recording";
  const busy = status === "transcribing";
  const confirming = status === "confirming";
  // Le micro est l'action principale de ces écrans : il doit se voir comme un
  // bouton d'action (indigo plein, halo pulsé au repos) et dire explicitement
  // ce qu'on attend — "Cliquez pour parler" —, pas ressembler à une icône
  // secondaire posée à côté du champ.
  const micLabel = label ?? (lang === "en" ? "Click to speak" : "Cliquez pour parler");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {question && (
        <button
          type="button"
          onClick={readQuestion}
          aria-label={lang === "en" ? "Read the question aloud" : "Écouter la question"}
          title={lang === "en" ? "Read the question aloud" : "Écouter la question à voix haute"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: compact ? "4px 9px" : "6px 11px",
            fontSize: compact ? 13 : 13.5, fontWeight: 700,
            borderRadius: 999, cursor: "pointer",
            border: `1px solid ${speaking ? "#6C5CE7" : "#CBD5E1"}`,
            background: speaking ? "#F1EFFB" : "#FFFFFF",
            color: speaking ? "#4C3FBF" : "#334155", whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden style={speaking ? { animation: "aura-mic-pulse 1s ease-in-out infinite" } : undefined}>
            {speaking ? "⏸" : "🔊"}
          </span>
          {speaking ? (lang === "en" ? "Stop" : "Stopper") : (lang === "en" ? "Listen" : "Écouter")}
        </button>
      )}

      {!confirming && (
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={disabled || busy}
          aria-label={recording ? "Arrêter la dictée" : "Dicter la réponse"}
          title={recording ? "Cliquer pour arrêter et transcrire" : "Dicter votre réponse à voix haute"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: compact ? "4px 9px" : "6px 12px",
            fontSize: compact ? 13 : 13.5, fontWeight: 700,
            borderRadius: 999, cursor: disabled || busy ? "default" : "pointer",
            border: `1px solid ${recording ? "#DC2626" : busy ? "#CBD5E1" : "#111111"}`,
            background: recording ? "#FEF2F2" : busy ? "#FFFFFF" : "#111111",
            color: recording ? "#B91C1C" : busy ? "#64748B" : "#FFFFFF",
            boxShadow: recording || busy || disabled ? "none" : "0 2px 10px rgba(0,0,0,.25)",
            animation: recording || busy || disabled ? undefined : "aura-mic-halo 2.2s ease-in-out infinite",
            opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden style={recording ? { animation: "aura-mic-pulse 1s ease-in-out infinite" } : undefined}>
            {busy ? "\u23F3" : recording ? "\u23F9" : "\uD83C\uDF99"}
          </span>
          {busy
            ? (lang === "en" ? "Transcribing…" : "Transcription…")
            : recording
              ? `${lang === "en" ? "Stop" : "Arrêter"} · ${fmt(seconds)}`
              : micLabel}
        </button>
      )}

      {confirming && pending !== null && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap", padding: "5px 10px", borderRadius: 8, background: "#F8F7FD", border: "1px solid #E2E0F4", maxWidth: 520 }}>
          <span style={{ fontSize: 13, color: "#4A4A6A", fontStyle: "italic" }}>
            « {pending} »
          </span>
          <button type="button" onClick={validate}
            style={{ padding: "4px 11px", borderRadius: 999, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ✓ {lang === "en" ? "Correct" : "C'est bon"}
          </button>
          <button type="button" onClick={retry}
            style={{ padding: "4px 11px", borderRadius: 999, border: "1px solid #CBD5E1", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ↺ {lang === "en" ? "Say again" : "Reformuler"}
          </button>
        </span>
      )}

      {error && <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>{error}</span>}
      <style>{"@keyframes aura-mic-pulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes aura-mic-halo{0%,100%{box-shadow:0 2px 10px rgba(0,0,0,.25)}50%{box-shadow:0 2px 10px rgba(0,0,0,.25),0 0 0 6px rgba(0,0,0,.1)}}"}</style>
    </span>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m > 0 ? `${m}:` : ""}${String(s % 60).padStart(2, "0")}${m > 0 ? "" : "s"}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Lecture de l'audio impossible."));
    fr.onload = () => {
      const s = String(fr.result ?? "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    fr.readAsDataURL(blob);
  });
}

/** Ajoute le texte dicté à la fin d'une valeur existante, proprement espacé. */
export function appendDictation(current: string, dictated: string): string {
  const base = (current ?? "").trimEnd();
  if (!base) return dictated;
  const needsPunct = !/[.!?…:;,]$/.test(base);
  return `${base}${needsPunct ? "." : ""} ${dictated}`;
}
