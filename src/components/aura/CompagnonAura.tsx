// CompagnonAura.tsx — le « compagnon » d'Aura : une pop-up unique, réutilisable
// partout où l'utilisateur doit répondre à des questions (Comprendre côté
// Décider, Cadrage côté Architecturer, vocabulaire métier du Studio…).
//
// Boucle d'un pas : Aura pose la question (voix + texte) → l'utilisateur dicte
// (ou tape) → Aura reformule et lit la reformulation → l'utilisateur corrige ou
// valide → la réponse est écrite dans le champ prévu de la page derrière, Aura
// confirme oralement, puis propose l'étape suivante.
//
// Le composant n'invente aucune donnée et ne calcule rien : il ne fait que
// remplir les champs déjà existants des pages hôtes via `apply`. Les
// expériences des trois espaces restent donc distinctes — chaque page décide
// de ses propres étapes et de l'endroit où atterrit la réponse.

import { Q } from "./KeywordText";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { transcribeAudio } from "../../lib/voice.functions";
import {
  speak, stopSpeaking, loadLang, onLangChange, voiceEnabled,
  reformulationPhrase, savedPhrase, suggestionPhrase,
  suggestionAcceptedPhrase, suggestionRejectedPhrase, type SpeechLang,
} from "../../lib/v4/speech-client";

export interface CompanionStep {
  id: string;
  /** Question posée à l'oral et à l'écrit. */
  question: string;
  /** Précision courte affichée sous la question (facultatif). */
  hint?: string;
  /** Valeur actuelle du champ de la page — affichée pour contexte. */
  current?: string;
  /** Écrit la réponse validée dans la page hôte. */
  apply: (text: string) => void;
  /** Étape facultative : « Passer » reste toujours possible, ceci n'est qu'informatif. */
  optional?: boolean;
  /** Nom de l'étape hôte (carte / sous-étape) — affiché en fil d'Ariane. */
  group?: string;
  /**
   * Déduction proposée à partir des réponses déjà données (évaluée à l'affichage
   * du pas). Si elle renvoie un texte, Aura énonce la question puis sa lecture,
   * et demande un arbitrage : valider / ajuster / écarter / passer.
   *
   * Peut être asynchrone : la préconisation peut être calculée par le LLM au
   * moment où la question est posée (« Aura prépare une préconisation… »),
   * plutôt que de dépendre d'une inférence déclenchée au préalable.
   */
  suggest?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Origine de la déduction, affichée en clair : « déduit de votre contexte ». */
  suggestSource?: string;
}


const MAX_MS = 120_000;
const ACCENT = "#6C5CE7";

type Phase = "asking" | "thinking" | "suggested" | "recording" | "transcribing" | "reviewing" | "saved" | "done";


export function CompagnonAura({
  open,
  onClose,
  steps,
  title,
  contextPrompt,
  startAt = 0,
  onStepChange,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  steps: CompanionStep[];
  /** Titre du parcours, ex. « Comprendre la décision » ou « Cadrer la transformation ». */
  title: string;
  /** Vocabulaire métier passé à la transcription pour améliorer la reconnaissance. */
  contextPrompt?: string;
  /** Question d'entrée — permet de lancer le fil depuis la carte affichée. */
  startAt?: number;
  /** La page hôte suit le fil : elle affiche la carte / sous-étape concernée. */
  onStepChange?: (index: number, step: CompanionStep) => void;
  /** Fin du fil — la page hôte peut proposer l'étape suivante. */
  onFinish?: () => void;
}) {
  const [index, setIndex] = useState(startAt);
  const [phase, setPhase] = useState<Phase>("asking");
  const [draft, setDraft] = useState("");
  /** Déduction proposée par Aura pour le pas courant (null = aucune). */
  const [suggestion, setSuggestion] = useState<string | null>(null);
  /** Réponses retenues au fil du parcours — restituées en synthèse finale. */
  const [answers, setAnswers] = useState<Record<string, { question: string; text: string; from: "vous" | "aura"; group?: string }>>({});

  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLang] = useState<SpeechLang>(() => loadLang());

  useEffect(() => onLangChange(() => setLang(loadLang())), []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[index];
  const en = lang === "en";

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Ouverture : on entre dans le fil à la question demandée (celle de la carte
  // affichée), pour qu'aucun parcours ne soit dupliqué ni perdu.
  useEffect(() => {
    if (!open) return;
    setIndex(Math.max(0, Math.min(steps.length - 1, startAt)));
    setDraft(""); setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startAt]);

  // La page hôte suit la question en cours (carte / sous-étape mise en avant).
  useEffect(() => {
    if (!open || !step) return;
    onStepChange?.(index, step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Arrivée sur un pas : s'il existe une déduction (locale ou calculée par le
  // LLM à cet instant), Aura la propose (valider / ajuster / écarter) ; sinon
  // elle pose simplement la question. Une préconisation asynchrone affiche
  // « Aura prépare une préconisation… » sans jamais bloquer la réponse.
  useEffect(() => {
    if (!open || !step) return;
    if (phase === "saved" || phase === "reviewing" || phase === "recording" || phase === "transcribing") return;
    let cancelled = false;
    const raw = step.suggest?.();
    if (raw && typeof (raw as Promise<unknown>).then === "function") {
      setSuggestion(null);
      setPhase("thinking");
      (raw as Promise<string | null | undefined>)
        .then(v => {
          if (cancelled) return;
          const s = (v ?? "").trim();
          if (s) { setSuggestion(s); setPhase("suggested"); }
          else { setSuggestion(null); setPhase("asking"); }
        })
        .catch(() => { if (!cancelled) { setSuggestion(null); setPhase("asking"); } });
      return () => { cancelled = true; };
    }
    const s = ((raw as string | null | undefined) ?? "").trim();
    if (s) { setSuggestion(s); setPhase("suggested"); }
    else { setSuggestion(null); setPhase("asking"); }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Fermeture ou changement de parcours : micro coupé, voix stoppée.
  useEffect(() => {
    if (open) return;
    stopSpeaking();
    cleanup();
    setPhase("asking"); setDraft(""); setError(null); setSpeaking(false); setSuggestion(null);
  }, [open, cleanup]);



  async function say(text: string) {
    if (!voiceEnabled()) return;
    setSpeaking(true);
    await speak(text, lang);
    setSpeaking(false);
  }

  // Aura mène le dialogue : elle énonce la question — et, si une déduction est
  // proposée, la restitue puis demande l'arbitrage. Voix coupée : tout reste
  // lisible à l'écran.
  useEffect(() => {
    if (!open || !step) return;
    if (phase !== "asking" && phase !== "suggested") return;
    const line = phase === "suggested" && suggestion
      ? suggestionPhrase(step.question, suggestion, lang)
      : step.question;
    let cancelled = false;
    (async () => {
      if (!voiceEnabled()) return;
      setSpeaking(true);
      await speak(line, lang);
      if (!cancelled) setSpeaking(false);
    })();
    return () => { cancelled = true; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, phase, suggestion, lang]);


  async function startRecording() {
    setError(null);
    stopSpeaking(); setSpeaking(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(en ? "Microphone unavailable in this browser." : "Micro non disponible dans ce navigateur.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(en ? "Microphone access denied." : "Accès au micro refusé.");
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
        setPhase("asking");
        setError(en ? "Recording too short — try again." : "Enregistrement trop court — réessayez.");
        return;
      }
      setPhase("transcribing");
      try {
        const base64 = await blobToBase64(blob);
        const r = await transcribeAudio({ data: { audioBase64: base64, mimeType: type, language: lang, prompt: contextPrompt } });
        if (!r.ok) { setError(r.error); setPhase("asking"); return; }
        setDraft(r.text);
        setPhase("reviewing");
        await say(reformulationPhrase(r.text, lang));
      } catch (e) {
        setError((e as Error).message || (en ? "Transcription failed." : "Transcription impossible."));
        setPhase("asking");
      }
    };

    rec.start();
    setPhase("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    autoStopRef.current = setTimeout(() => { try { rec.stop(); } catch { /* déjà arrêté */ } }, MAX_MS);
  }

  function stopRecording() {
    try { recorderRef.current?.stop(); } catch { /* déjà arrêté */ }
  }

  /** Mémorise la réponse retenue — sert à la synthèse finale du fil. */
  function record(text: string, from: "vous" | "aura") {
    if (!step) return;
    setAnswers(prev => ({ ...prev, [step.id]: { question: step.question, text, from, group: step.group } }));
  }

  async function validate() {
    const text = draft.trim();
    if (!text || !step) return;
    step.apply(text);
    record(text, "vous");
    setPhase("saved");
    await say(savedPhrase(text, lang));
  }

  /** « OK » — la déduction proposée est retenue telle quelle. */
  async function acceptSuggestion() {
    const text = (suggestion ?? "").trim();
    if (!text || !step) return;
    stopSpeaking(); setSpeaking(false);
    step.apply(text);
    record(text, "aura");
    setDraft(text);
    setPhase("saved");
    await say(`${suggestionAcceptedPhrase(lang)} ${savedPhrase(text, lang)}`);
  }

  /** « Modifier » — la déduction devient un brouillon corrigeable. */
  function adjustSuggestion() {
    stopSpeaking(); setSpeaking(false);
    setDraft((suggestion ?? "").trim());
    setPhase("reviewing");
  }

  /** « KO » — la déduction est écartée, l'utilisateur répond lui-même. */
  async function rejectSuggestion() {
    stopSpeaking(); setSpeaking(false);
    setSuggestion(null);
    setDraft("");
    setPhase("asking");
    await say(suggestionRejectedPhrase(lang));
  }


  function goNext() {
    stopSpeaking(); setSpeaking(false);
    setDraft(""); setError(null);
    if (index + 1 >= steps.length) { setPhase("done"); onFinish?.(); return; }
    setIndex(i => i + 1);
    setPhase("asking");
  }

  function goTo(i: number) {
    stopSpeaking(); setSpeaking(false);
    setDraft(""); setError(null);
    setIndex(Math.max(0, Math.min(steps.length - 1, i)));
    setPhase("asking");
  }


  function skip() {
    goNext();
  }

  // Fermeture au clavier (Échap), où que soit le focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Rendu au niveau du document : un parent transformé ne peut plus le rogner.
  return createPortal(
    <div
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,15,35,.42)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto",
        background: "var(--v4-surface, #fff)", borderRadius: 8,
        boxShadow: "0 24px 70px rgba(20,16,60,.28)", padding: "26px 28px 22px",
      }}>
        {/* En-tête : orbe + titre + progression */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Orb active={speaking || phase === "recording"} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--v4-text)", letterSpacing: "-.01em" }}>{title}</div>
            <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {phase === "done"
                ? (en ? "All questions answered" : "Toutes les questions sont passées")
                : `${en ? "Question" : "Question"} ${index + 1} / ${steps.length}`}
              {step?.group && phase !== "done" && (
                <span style={{ color: ACCENT, fontWeight: 700 }}> · {step.group}</span>
              )}
              {speaking && <span style={{ marginLeft: 8, color: ACCENT, fontWeight: 700 }}>{en ? "Aura is speaking…" : "Aura parle…"}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={en ? "Close" : "Fermer"} title={en ? "Close (Esc)" : "Fermer (Échap)"}
            style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface,#fff)", cursor: "pointer", color: "var(--aura-ink,#15121f)", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* Fil de progression — chaque question reste accessible, rien n'est perdu */}
        <div style={{ display: "flex", gap: 4, margin: "16px 0 18px", flexWrap: "wrap" }}>
          {steps.map((s, i) => {
            const done = i < index || phase === "done";
            const here = i === index && phase !== "done";
            return (
              <button key={s.id} type="button" onClick={() => goTo(i)}
                title={`${s.group ? `${s.group} — ` : ""}${s.question}`}
                aria-current={here ? "step" : undefined}
                style={{
                  height: 6, flex: here ? "0 0 34px" : "1 1 10px", minWidth: 10, borderRadius: 999, border: "none",
                  cursor: "pointer", padding: 0,
                  background: here ? ACCENT : done ? `${ACCENT}66` : "var(--v4-border)",
                  boxShadow: here ? "0 0 0 3px rgba(108,92,231,.16)" : undefined,
                  transition: "flex .3s ease, background .2s ease",
                }} />
            );
          })}
        </div>

        {phase === "done" || !step ? (
          <div>
            <p style={{ fontSize: 14, color: "var(--v4-text)", lineHeight: 1.6, marginTop: 0 }}>
              {en
                ? "Here is what I have recorded. Everything below is already written into the page — review and adjust it there before continuing."
                : "Voici ce que j'ai retenu. Tout ceci est déjà inscrit dans la page — vous pouvez le relire et l'ajuster avant de continuer."}
            </p>

            {/* Synthèse du fil : question par question, ce qui a été retenu et
                qui l'a formulé (vous, ou une lecture d'Aura que vous avez validée). */}
            {(() => {
              const kept = steps.map(s => answers[s.id]).filter(Boolean) as Array<NonNullable<typeof answers[string]>>;
              if (kept.length === 0) {
                return (
                  <div style={{ fontSize: 13.5, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 16 }}>
                    {en ? "No answer was recorded during this pass." : "Aucune réponse n'a été retenue pendant ce passage."}
                  </div>
                );
              }
              const recapText = kept.map(a => `${a.question} ${a.text}`).join(". ");
              return (
                <>
                  <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
                    {kept.map((a, i) => (
                      <div key={i} style={{ padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid var(--v4-border)", background: i % 2 ? "var(--v4-bg)" : "transparent" }}>
                        <div style={{ fontSize: 12.5, color: "var(--v4-text3)", fontWeight: 700 }}>
                          {a.group ? `${a.group} · ` : ""}<Q>{a.question}</Q>
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--v4-text)", marginTop: 3, lineHeight: 1.55 }}>{a.text}</div>
                        <div style={{ fontSize: 12, color: a.from === "aura" ? ACCENT : "#059669", fontWeight: 800, marginTop: 4 }}>
                          {a.from === "aura"
                            ? (en ? "✦ Aura's reading, confirmed by you" : "✦ lecture d'Aura, validée par vous")
                            : (en ? "✓ your own words" : "✓ vos propres mots")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                    <button type="button" style={ghostBtn}
                      onClick={() => { stopSpeaking(); setSpeaking(false); void say(recapText); }}>
                       {en ? "Read the recap aloud" : "Me lire la synthèse"}
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => goTo(0)} style={ghostBtn}>↺ {en ? "Review from the start" : "Reprendre au début"}</button>
                      <button type="button" onClick={onClose} style={primaryBtn}>{en ? "Back to the page" : "Revenir à la page"}</button>
                    </div>
                  </div>
                </>
              );
            })()}

            {Object.keys(answers).length === 0 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={primaryBtn}>{en ? "Back to the page" : "Revenir à la page"}</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--v4-text)", lineHeight: 1.35, letterSpacing: "-.015em" }}>
              <Q>{step.question}</Q>
            </div>
            {step.hint && <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 6, lineHeight: 1.55 }}>{step.hint}</div>}
            {step.current?.trim() && (
              <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "var(--v4-bg)" }}>
                <b style={{ color: "var(--v4-text2)" }}>{en ? "Already on the page" : "Déjà dans la page"} : </b>{step.current.trim()}
              </div>
            )}

            {/* Préconisation en préparation — Aura interroge son moteur avant de
                proposer une lecture, sans jamais empêcher de répondre soi-même. */}
            {phase === "thinking" && (
              <div style={{
                marginTop: 18, padding: "13px 16px", borderRadius: 8,
                border: `1px dashed ${ACCENT}`, background: "var(--v4-accent-bg, #F8F7FD)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Orb active small />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#4C3FBF" }}>
                  {en ? "Aura is preparing a recommendation…" : "Aura prépare une préconisation…"}
                </div>
                <div style={{ flex: 1 }} />
                <button type="button" style={ghostBtn} onClick={() => setPhase("asking")}>
                  {en ? "Answer now" : "Répondre maintenant"}
                </button>
              </div>
            )}

            {/* Déduction proposée — Aura restitue sa lecture et fait arbitrer */}
            {phase === "suggested" && suggestion && (
              <div style={{
                marginTop: 18, padding: "14px 16px", borderRadius: 8,
                border: `1px solid ${ACCENT}`, background: "var(--v4-accent-bg, #F5F3FE)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: ACCENT }}>
                    ✦ {en ? "Working hypothesis" : "Lecture proposée"}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>
                    · {step.suggestSource ?? (en ? "inferred from your earlier answers" : "déduite de vos réponses précédentes")}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button type="button" style={ghostBtn}
                    onClick={() => { stopSpeaking(); setSpeaking(false); void say(suggestionPhrase(step.question, suggestion, lang)); }}>
                     {en ? "Repeat" : "Réécouter"}
                  </button>
                </div>
                <div style={{ fontSize: 14.5, color: "var(--v4-text)", lineHeight: 1.6, fontWeight: 600 }}>{suggestion}</div>
                <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 12.5 }}>
                  {en ? "Confirm it, adjust the wording, set it aside and answer yourself — or skip this point."
                      : "Validez-la, ajustez la formulation, écartez-la et répondez vous-même — ou passez ce point."}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button type="button" onClick={acceptSuggestion} style={primaryBtn}>
                    ✓ {en ? "Confirm" : "OK, je valide"}
                  </button>
                  <button type="button" onClick={adjustSuggestion} style={ghostBtn}>
                    ✎ {en ? "Adjust" : "Modifier"}
                  </button>
                  <button type="button" onClick={rejectSuggestion} style={ghostBtn}>
                    ✕ {en ? "Set aside — I'll answer" : "Non, je réponds"}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={skip} style={ghostBtn}>{en ? "Skip" : "Passer"}</button>
                </div>
              </div>
            )}

            {/* Barre d'écoute */}
            {(phase === "asking" || phase === "recording" || phase === "transcribing") && (

              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginTop: 18,
                padding: "12px 14px", borderRadius: 8,
                border: `1px solid ${phase === "recording" ? ACCENT : "var(--v4-border)"}`,
                background: phase === "recording" ? "var(--v4-accent-bg, #F5F3FE)" : "var(--v4-bg)",
              }}>
                <button type="button"
                  onClick={phase === "recording" ? stopRecording : startRecording}
                  disabled={phase === "transcribing"}
                  aria-label={phase === "recording" ? (en ? "Stop recording" : "Arrêter l'enregistrement") : (en ? "Answer by voice" : "Répondre à la voix")}
                  style={{
                    width: 42, height: 42, borderRadius: 999, flexShrink: 0, cursor: phase === "transcribing" ? "default" : "pointer",
                    border: "none", background: phase === "recording" ? "#DC2626" : ACCENT, color: "#fff", fontSize: 17,
                    // Au repos, le micro pulse doucement : c'est l'action
                    // attendue de l'utilisateur, elle ne doit pas se confondre
                    // avec un bouton secondaire.
                    animation: phase === "recording" ? "aura-orb-pulse 1.4s ease-in-out infinite" : "aura-mic-halo 2.2s ease-in-out infinite",
                    boxShadow: "0 2px 12px rgba(108,92,231,.4)",
                  }}>
                  {phase === "transcribing" ? "⏳" : phase === "recording" ? "⏹" : "🎙"}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text2)" }}>
                    {phase === "recording"
                      ? `${en ? "I'm listening…" : "Je vous écoute…"} ${fmt(seconds)}`
                      : phase === "transcribing"
                        ? (en ? "Writing down your answer…" : "Je mets votre réponse par écrit…")
                        : (en ? "Click the microphone to speak — or type below" : "Cliquez sur le micro pour parler — ou écrivez ci-dessous")}
                  </div>
                  <Waveform active={phase === "recording"} />
                </div>
                <button type="button" onClick={() => { stopSpeaking(); setSpeaking(false); void say(step.question); }}
                  title={en ? "Hear the question again" : "Réécouter la question"}
                  style={ghostBtn}> {en ? "Repeat" : "Réécouter"}</button>
              </div>
            )}

            {/* Saisie / reformulation : la réponse reste toujours corrigeable au clavier */}
            {phase !== "suggested" && (
            <div style={{ marginTop: 14 }}>

              {phase === "reviewing" && (
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>
                  ✦ {en ? "Reformulation — check before saving" : "Reformulation — à vérifier avant enregistrement"}
                </div>
              )}
              <textarea
                value={draft}
                onChange={e => { setDraft(e.target.value); if (phase === "saved") setPhase("reviewing"); }}
                rows={phase === "reviewing" ? 4 : 3}
                placeholder={en ? "Your answer…" : "Votre réponse…"}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 8,
                  border: `1px solid ${phase === "reviewing" ? ACCENT : "var(--v4-border)"}`,
                  background: phase === "reviewing" ? "var(--v4-accent-bg, #F8F7FD)" : "var(--v4-surface)",
                  color: "var(--v4-text)", fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.6, resize: "vertical",
                }}
              />
            </div>
            )}

            {error && <div style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600, marginTop: 12 }}>{error}</div>}

            {phase !== "suggested" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>

              <button type="button" onClick={skip} style={ghostBtn}>
                {en ? "Skip" : "Passer"}
              </button>
              <div style={{ flex: 1 }} />
              {phase === "saved" ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
                    ✓ {en ? "Saved into the page" : "Enregistré dans la page"}
                  </span>
                  <button type="button" onClick={goNext} style={primaryBtn}>
                    {index + 1 >= steps.length
                      ? (en ? "Finish" : "Terminer")
                      : (en ? "Next question →" : "Question suivante →")}
                  </button>
                </>
              ) : (
                <>
                  {draft.trim() && (
                    <button type="button" onClick={() => { setDraft(""); setPhase("asking"); }} style={ghostBtn}>
                      ↺ {en ? "Start over" : "Recommencer"}
                    </button>
                  )}
                  <button type="button" onClick={validate} disabled={!draft.trim()}
                    style={{ ...primaryBtn, opacity: draft.trim() ? 1 : 0.45, cursor: draft.trim() ? "pointer" : "default" }}>
                    {en ? "Confirm and continue →" : "Valider et continuer →"}
                  </button>
                </>
              )}
            </div>
            )}

          </>
        )}

        <style>{`
@keyframes aura-orb-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.93);opacity:.8}}
@keyframes aura-orb-ring{0%{transform:scale(.85);opacity:.55}100%{transform:scale(1.5);opacity:0}}
@keyframes aura-wave{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes aura-mic-halo{0%,100%{box-shadow:0 2px 12px rgba(108,92,231,.4)}50%{box-shadow:0 2px 12px rgba(108,92,231,.4),0 0 0 8px rgba(108,92,231,.14)}}

`}</style>
      </div>
    </div>,
    document.body,
  );
}

/** Bouton d'entrée du compagnon, posé à côté d'un bloc de questions. */
export function CompagnonLauncher({ onClick, label }: { onClick: () => void; label?: string }) {
  const en = loadLang() === "en";
  return (
    <button type="button" onClick={onClick}
      title={en ? "Aura asks the questions, you answer out loud" : "Aura pose les questions, vous répondez à voix haute"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999,
        border: `1px solid ${ACCENT}`, background: "var(--v4-accent-bg, #F5F3FE)", color: "#4C3FBF",
        fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      }}>
      <Orb small />
      {label ?? (en ? "Answer with Aura" : "Répondre avec Aura")}
    </button>
  );
}

function Orb({ active = false, small = false }: { active?: boolean; small?: boolean }) {
  const size = small ? 16 : 48;
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-block" }}>
      {active && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: 999,
          border: `2px solid ${ACCENT}`, animation: "aura-orb-ring 1.6s ease-out infinite",
        }} />
      )}
      <span style={{
        position: "absolute", inset: 0, borderRadius: 999,
        background: `radial-gradient(circle at 34% 30%, #B9AEFF 0%, ${ACCENT} 46%, #3D2FA8 100%)`,
        boxShadow: `0 0 ${small ? 6 : 18}px rgba(108,92,231,.5)`,
        animation: active ? "aura-orb-pulse 1.8s ease-in-out infinite" : undefined,
      }} />
    </span>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [0.5, 0.9, 0.4, 1, 0.65, 0.35, 0.85, 0.55, 1, 0.45, 0.75, 0.4, 0.95, 0.6, 0.3];
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, height: 18, marginTop: 5 }}>
      {bars.map((h, i) => (
        <span key={i} style={{
          width: 3, borderRadius: 6, height: `${Math.round(h * 100)}%`,
          background: active ? ACCENT : "var(--v4-border)",
          animation: active ? `aura-wave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite` : undefined,
        }} />
      ))}
    </span>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff",
  fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const ghostBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 999, border: "1px solid var(--v4-border)", background: "var(--v4-surface)",
  color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
};

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
