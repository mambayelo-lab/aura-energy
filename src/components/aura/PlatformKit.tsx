// PlatformKit.tsx — NOUVEAU (lot pilotage de plateforme).
//
// Briques réutilisables, volontairement discrètes :
//   • useTelemetrie  : trace l'usage d'un écran (adoption, connexions).
//   • RappelsRevue   : rappelle les décisions à revoir et recueille le verdict.
//
// Règle Aura respectée : les fenêtres ne se ferment que par la croix.
// Règle Aura respectée : sur Décider, aucun chiffre — les verdicts sont
// qualitatifs (bonne / nuancée / mauvaise / trop tôt).
import { useDismiss } from "@/lib/ui/use-dismiss";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logEvent, myReviews, answerReview, createReview } from "@/lib/platform.functions";

const ACCENT = "#6C5CE7";

const card: React.CSSProperties = {
  border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface)", padding: "16px 18px",
};
const eyebrow: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--v4-text3)",
};
const btn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
  background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700,
};
const btnGhost: React.CSSProperties = {
  padding: "7px 11px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
  border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", whiteSpace: "nowrap", fontFamily: "inherit",
};
const field: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8, fontSize: 13, width: "100%",
  border: "1px solid var(--v4-border)", background: "var(--v4-bg)", color: "var(--v4-text1)",
};

/** Identifiant de session, purement technique : sert à distinguer les visites. */
function sessionId() {
  if (typeof window === "undefined") return "ssr";
  let s = sessionStorage.getItem("aura_sid");
  if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("aura_sid", s); }
  return s;
}

/**
 * Trace une vue d'écran une seule fois par montage. Silencieux en cas d'échec
 * (un visiteur non connecté ne doit pas voir d'erreur pour une mesure).
 */
export function useTelemetrie(space: string, kind = "view") {
  const log = useServerFn(logEvent);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    log({ data: { kind, space, path: window.location.pathname, session_id: sessionId() } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, kind]);
}

// ── Fenêtre standard (formulaire) : fermeture par la croix ou Échap ; pas de clic extérieur, pour ne pas perdre une saisie ──
function Fenetre({ titre, sous, onClose, children }: {
  titre: string; sous?: string; onClose: () => void; children: React.ReactNode;
}) {
  useDismiss(true, onClose);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900, background: "rgba(18,18,40,.45)",
      display: "grid", placeItems: "center", padding: 20,
    }}>
      <div style={{ ...card, width: "100%", maxWidth: 520, padding: "20px 22px", boxShadow: "0 18px 50px rgba(20,20,50,.22)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={eyebrow}>Aura</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{titre}</div>
            {sous && <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 3 }}>{sous}</div>}
          </div>
          {/* Croix ou Échap ; aucun clic extérieur ne ferme (formulaire). */}
          <button aria-label="Fermer" onClick={onClose} style={{
            border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)",
            width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Rappels de revue de décision ────────────────────────────────────────────
const VERDICTS: { id: "bonne" | "nuancee" | "mauvaise" | "trop_tot"; label: string }[] = [
  { id: "bonne", label: "C'était la bonne décision" },
  { id: "nuancee", label: "Bonne, avec réserves" },
  { id: "mauvaise", label: "Ce n'était pas la bonne" },
  { id: "trop_tot", label: "Trop tôt pour juger" },
];

/**
 * Bandeau de rappel. Affiché sur Décider et le Copilote : dès qu'une décision
 * arrive à son horizon de revue, l'utilisateur est invité à dire si c'était la
 * bonne décision. Le résultat remonte à l'administrateur.
 */
export function RappelsRevue({ space }: { space: "decider" | "copilote" | "architecturer" }) {
  const list = useServerFn(myReviews);
  const answer = useServerFn(answerReview);
  const [due, setDue] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    list().then((r: any) => setDue(r.due ?? [])).catch(() => setDue([]));
  }, [list]);
  useEffect(refresh, [refresh]);

  if (due.length === 0) return null;

  async function repondre(verdict: any) {
    if (!open) return;
    setBusy(true);
    try {
      await answer({ data: { id: open.id, verdict, verdict_comment: comment || undefined } });
      setOpen(null); setComment(""); refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div style={{ ...card, borderColor: ACCENT, marginBottom: 16 }}>
        <div style={eyebrow}>Retour d'expérience</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5 }}>
          {due.length === 1 ? "Une décision arrive à son horizon de revue." : `${due.length} décisions arrivent à leur horizon de revue.`}
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {due.slice(0, 3).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{r.title}{r.chosen_option ? ` — ${r.chosen_option}` : ""}</span>
              <button style={btn} onClick={() => { setOpen(r); setComment(""); }}>Donner le verdict</button>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <Fenetre titre="C'était la bonne décision ?" sous={open.title} onClose={() => setOpen(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {VERDICTS.map((v) => (
              <button key={v.id} disabled={busy} onClick={() => repondre(v.id)} style={{ ...btnGhost, textAlign: "left" }}>
                {v.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <textarea style={{ ...field, minHeight: 70 }} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Ce que vous retenez (facultatif)" />
          </div>
        </Fenetre>
      )}
    </>
  );
}

/** Programme une revue : intitulé, option retenue, horizon. */
export function PlanifierRevue({ space, titreDefaut, optionRetenue, reference, ouvert, onOuvertChange, sansBouton }: {
  space: "decider" | "copilote" | "architecturer";
  titreDefaut?: string; optionRetenue?: string; reference?: string;
  /** Mode contrôlé (optionnel) : ouverture pilotée par le parent, ex. menu « ⋯ ». */
  ouvert?: boolean; onOuvertChange?: (v: boolean) => void; sansBouton?: boolean;
}) {
  const create = useServerFn(createReview);
  const [openLocal, setOpenLocal] = useState(false);
  const open = ouvert ?? openLocal;
  const setOpen = (v: boolean) => { if (onOuvertChange) onOuvertChange(v); else setOpenLocal(v); };
  useEffect(() => { if (ouvert) setMsg(null); }, [ouvert]);
  const [title, setTitle] = useState(titreDefaut ?? "");
  const [days, setDays] = useState(90);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (titreDefaut) setTitle(titreDefaut); }, [titreDefaut]);

  return (
    <>
      {!sansBouton && <button style={btnGhost} onClick={() => { setOpen(true); setMsg(null); }}>Programmer la revue</button>}
      {open && (
        <Fenetre titre="Programmer la revue de décision"
          sous="Aura vous rappellera de dire si c'était la bonne décision." onClose={() => setOpen(false)}>
          <label style={{ ...eyebrow, display: "block", marginBottom: 5 }}>Décision</label>
          <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Intitulé de la décision" />
          <label style={{ ...eyebrow, display: "block", margin: "12px 0 5px" }}>Horizon</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[30, 90, 180, 365].map((d) => (
              <button key={d} onClick={() => setDays(d)} style={{
                ...btnGhost, borderColor: days === d ? ACCENT : "var(--v4-border)",
                color: days === d ? ACCENT : "var(--v4-text2)", fontWeight: days === d ? 800 : 600,
              }}>{d === 365 ? "1 an" : `${d} j`}</button>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <button style={btn} disabled={title.trim().length < 3} onClick={async () => {
              await create({ data: { title: title.trim(), space, chosen_option: optionRetenue, decision_ref: reference, horizon_days: days } });
              setMsg("Revue programmée.");
            }}>Programmer</button>
            {msg && <span style={{ fontSize: 13, color: ACCENT }}>{msg}</span>}
          </div>
        </Fenetre>
      )}
    </>
  );
}
