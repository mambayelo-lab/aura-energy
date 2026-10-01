// CommentCaMarche.tsx — lecteur « Comment ça marche » : l'onboarding par
// application, disponible depuis la barre latérale de chaque application Aura.
//
// Trois partis pris, cohérents avec le reste d'Aura :
//  · le contenu est le script pédagogique de l'application (onboarding-scripts),
//    le même texte que la voix off du rendu vidéo FR/EN — jamais deux versions ;
//  · la voix lit le chapitre courant (langue d'échange Aura : fr / en), et
//    l'avance se fait chapitre par chapitre, avec retour arrière ;
//  · la pop-up ne se ferme QUE par la croix : un clic à côté ne renvoie jamais
//    l'utilisateur à l'écran nominal au milieu d'une explication.
import { useDismiss } from "@/lib/ui/use-dismiss";
import { Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getOnboardingScript, type OnboardingApp } from "../../lib/v4/onboarding-scripts";
import { loadLang, onLangChange, speak, stopSpeaking, voiceEnabled } from "../../lib/v4/speech-client";
import { onboardingVideoUrl } from "./onboarding-videos";

const ACCENT = "#6C5CE7";

/** Lien d'ouverture, à poser dans la barre latérale d'une application. */
export function CommentCaMarcheLink({ app, collapsed }: { app: OnboardingApp; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"fr" | "en">(loadLang());
  useEffect(() => onLangChange(() => setLang(loadLang())), []);
  return (
    <>
      <button onClick={() => setOpen(true)}
        title={lang === "en" ? "How it works — guided tour" : "Comment ça marche — visite guidée"}
        aria-label={lang === "en" ? "Help: how it works" : "Aide : comment ça marche"}
        style={{
          display: "flex", alignItems: "center", gap: collapsed ? 0 : 8, justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "9px 0" : "8px 10px", borderRadius: 8, border: `1.5px solid ${ACCENT}33`,
          background: `${ACCENT}0d`, color: ACCENT, fontSize: 13, fontWeight: 800, cursor: "pointer",
          fontFamily: "inherit", textAlign: "left", width: "100%",
        }}>
        <Lightbulb size={15} aria-hidden="true" />
        {!collapsed && <span>{lang === "en" ? "How it works" : "Comment ça marche"}</span>}
      </button>
      {open && <CommentCaMarcheModal app={app} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CommentCaMarcheModal({ app, onClose }: { app: OnboardingApp; onClose: () => void }) {
  const [lang, setLang] = useState<"fr" | "en">(loadLang());
  useEffect(() => onLangChange(() => setLang(loadLang())), []);
  const script = getOnboardingScript(app, lang);
  const [i, setI] = useState(0);
  const [reading, setReading] = useState(false);
  // Deux supports pour le même script : la vidéo montée (voix off enregistrée)
  // quand elle est publiée, ou la lecture par chapitres, à son rythme.
  const videoUrl = onboardingVideoUrl(app, lang);
  const [mode, setMode] = useState<"video" | "chapitres">(videoUrl ? "video" : "chapitres");
  const [videoKo, setVideoKo] = useState(false);
  const enVideo = mode === "video" && !!videoUrl && !videoKo;
  const [auto, setAuto] = useState(voiceEnabled());
  const chapter = script.chapters[i];
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; stopSpeaking(); }, []);
  const cardRef = useRef<HTMLDivElement>(null);
  useDismiss(true, () => { stopSpeaking(); onClose(); }, cardRef);


  // Lecture du chapitre courant. L'enchaînement automatique n'avance qu'après
  // la fin réelle de la lecture — jamais sur une minuterie approximative.
  useEffect(() => {
    if (!auto || enVideo) return;
    let cancelled = false;
    setReading(true);
    speak(`${chapter.title}. ${chapter.body}`, lang).then(() => {
      setReading(false);
      if (cancelled || !alive.current) return;
      setI(prev => (prev === i && prev < script.chapters.length - 1 ? prev + 1 : prev));
    });
    return () => { cancelled = true; stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, auto, lang, enVideo]);

  const T = lang === "en"
    ? { prev: "Previous", next: "Next", done: "Got it", voiceOn: "Voice-over on", voiceOff: "Voice-over off", chapter: "Chapter", of: "of", where: "Where to look" }
    : { prev: "Précédent", next: "Suivant", done: "C'est compris", voiceOn: "Voix off active", voiceOff: "Voix off coupée", chapter: "Chapitre", of: "sur", where: "Où regarder" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,12,40,.55)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {/* Fermeture : croix, Échap ou clic à l'extérieur. */}
      <div ref={cardRef} style={{ width: "min(760px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "#fff", borderRadius: 8, boxShadow: "0 30px 80px rgba(15,12,40,.35)", fontFamily: "var(--font-sans)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #ECE9FB", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: ACCENT }}>Aura · {lang === "en" ? "How it works" : "Comment ça marche"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#14121F", marginTop: 4 }}>{script.title}</div>
            <div style={{ fontSize: 13.5, color: "#57536B", marginTop: 3 }}>{script.pitch}</div>
          </div>
          <button onClick={() => { stopSpeaking(); onClose(); }} aria-label={lang === "en" ? "Close" : "Fermer"}
            style={{ border: "1px solid #ECE9FB", background: "#fff", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#57536B", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {videoUrl && !videoKo && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {([["video", lang === "en" ? "▶ Watch the video" : "▶ Voir la vidéo"], ["chapitres", lang === "en" ? "Read chapter by chapter" : "Lire chapitre par chapitre"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => { stopSpeaking(); setMode(m); }}
                  style={{ padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${mode === m ? ACCENT : "#ECE9FB"}`, background: mode === m ? `${ACCENT}12` : "#fff", color: mode === m ? ACCENT : "#8B87A3", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {enVideo ? (
            <>
              <video key={videoUrl} src={videoUrl!} controls autoPlay playsInline
                onError={() => setVideoKo(true)}
                style={{ width: "100%", borderRadius: 8, background: "#0F0C28", display: "block" }} />
              <div style={{ marginTop: 12, fontSize: 13, color: "#8B87A3" }}>
                {lang === "en"
                  ? "Same script, recorded voice-over. Switch to chapter reading to go at your own pace."
                  : "Même script, voix off enregistrée. Passez en lecture par chapitres pour avancer à votre rythme."}
              </div>
            </>
          ) : (
            <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: "#8B87A3" }}>{T.chapter} {i + 1} {T.of} {script.chapters.length}</span>
            <div style={{ flex: 1, height: 4, background: "#F1EFFB", borderRadius: 999, minWidth: 120 }}>
              <div style={{ width: `${((i + 1) / script.chapters.length) * 100}%`, height: 4, background: ACCENT, borderRadius: 999, transition: "width .25s" }} />
            </div>
            <button onClick={() => { setAuto(a => { if (a) stopSpeaking(); return !a; }); }}
              style={{ padding: "4px 10px", borderRadius: 999, border: `1.5px solid ${auto ? ACCENT : "#ECE9FB"}`, background: auto ? `${ACCENT}12` : "#fff", color: auto ? ACCENT : "#8B87A3", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {auto ? `🔊 ${T.voiceOn}` : `🔇 ${T.voiceOff}`}
            </button>
          </div>

          <div style={{ border: "1px solid #ECE9FB", borderRadius: 8, padding: "16px 18px", background: reading ? `${ACCENT}06` : "#FBFAFF" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: "#14121F" }}>{chapter.title}</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#39364B", margin: "8px 0 0" }}>{chapter.body}</p>
            {chapter.where && (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: ACCENT }}>{T.where} : {chapter.where}</div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={() => { stopSpeaking(); setI(p => Math.max(0, p - 1)); }} disabled={i === 0}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ECE9FB", background: "#fff", color: i === 0 ? "#C8C4DC" : "#57536B", fontSize: 13, fontWeight: 700, cursor: i === 0 ? "default" : "pointer", fontFamily: "inherit" }}>
              ← {T.prev}
            </button>
            {i < script.chapters.length - 1 ? (
              <button onClick={() => { stopSpeaking(); setI(p => p + 1); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {T.next} →
              </button>
            ) : (
              <button onClick={() => { stopSpeaking(); onClose(); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                ✓ {T.done}
              </button>
            )}
          </div>

          {/* Sommaire — on peut sauter directement au chapitre utile. */}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {script.chapters.map((c, idx) => (
              <button key={c.title} onClick={() => { stopSpeaking(); setI(idx); }}
                style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${idx === i ? ACCENT : "#ECE9FB"}`, background: idx === i ? `${ACCENT}12` : "#fff", color: idx === i ? ACCENT : "#8B87A3", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {idx + 1}. {c.title}
              </button>
            ))}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
