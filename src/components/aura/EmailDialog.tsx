import { useDismiss } from "@/lib/ui/use-dismiss";
import { tr } from "../../lib/i18n-dom";
import { audit } from "@/lib/security/use-access";
// « Envoyer par e-mail » une réponse du copilote (Supply ou Décider) :
// destinataires, objet pré-rempli, corps modifiable, rapport PDF en pièce
// jointe en option. Envoi côté serveur (Resend ou SMTP) ; sinon repli
// mailto avec le PDF téléchargé à joindre. Le mode actif est affiché.
import { useEffect, useState } from "react";
import { EMAIL_MODE_LABEL, markdownToText, mailtoLink, parseRecipients, type EmailMode } from "../../lib/v4/email-core";
import { getEmailMode, sendEmail } from "../../lib/v4/email.functions";

export type PdfMaker = () => Promise<{ filename: string; bytes: Uint8Array }>;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function downloadBytes(bytes: Uint8Array, filename: string, type = "application/pdf") {
  audit("export", filename);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const CSS = `
.em-btn{border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-surface,#fff);color:var(--v4-accent2,#6d28d9);border-radius:7px;padding:3px 9px;font:700 12px var(--font-sans,system-ui);cursor:pointer}
.em-back{position:fixed;inset:0;background:rgba(21,29,82,.35);z-index:300;display:grid;place-items:center;padding:16px}
.em-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#57536b}.em-card{position:relative;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(21,29,82,.25);width:min(560px,100%);padding:18px 20px;display:flex;flex-direction:column;gap:10px;font-family:var(--font-body,system-ui);color:#151D52}
.em-card h3{margin:0;font:700 17px var(--font-display,system-ui)}
.em-card label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:700;color:#4c3d7a}
.em-card input,.em-card textarea{font:500 13.5px var(--font-body,system-ui);border:1px solid #d8d6f5;border-radius:8px;padding:7px 9px;color:#151D52;resize:vertical}
.em-mode{font-size:12.5px;font-weight:700;border-radius:8px;padding:6px 10px}
.em-mode.real{background:#ecfdf5;color:#0d7a54}
.em-mode.mailto{background:#fff8ed;color:#a85d0f}
.em-actions{display:flex;justify-content:flex-end;gap:8px;align-items:center}
.em-actions button{border-radius:9px;padding:8px 14px;font:700 13.5px var(--font-body,system-ui);cursor:pointer}
.em-primary{border:0;background:#4743E6;color:#fff}
.em-primary:disabled{opacity:.5;cursor:not-allowed}
.em-ghost{border:1px solid #d8d6f5;background:#fff;color:#151D52}
`;

export function EmailButton({ subject, body, pdf }: { subject: string; body: string; pdf?: PdfMaker }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="em-btn" onClick={() => setOpen(true)} data-testid="email-open">✉ Envoyer par e-mail</button>
      {open && <EmailDialog subject={tr(subject)} body={tr(markdownToText(body))} pdf={pdf} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EmailDialog({ subject, body, pdf, onClose }: { subject: string; body: string; pdf?: PdfMaker; onClose: () => void }) {
  const [mode, setMode] = useState<EmailMode | null>(null);
  const [to, setTo] = useState("");
  const [subj, setSubj] = useState(subject);
  const [text, setText] = useState(body);
  const [attach, setAttach] = useState(!!pdf);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "ok" | "error"; msg?: string }>({ kind: "idle" });
  useEffect(() => { getEmailMode().then(r => setMode(r.mode)).catch(() => setMode("mailto")); }, []);
  const rec = parseRecipients(to);
  const send = async () => {
    if (!rec.valid.length || !mode) return;
    setState({ kind: "sending" });
    try {
      const file = attach && pdf ? await pdf() : undefined;
      if (mode === "mailto") {
        if (file) downloadBytes(file.bytes, file.filename);
        window.location.href = mailtoLink(rec.valid, subj, text + (file ? `\n\n(Pièce jointe à ajouter : ${file.filename}, téléchargé à l'instant.)` : ""));
        setState({ kind: "ok", msg: file ? "Messagerie ouverte ; le PDF a été téléchargé : joignez-le avant d'envoyer." : "Messagerie ouverte." });
        return;
      }
      const r = await sendEmail({ data: { to: rec.valid, subject: subj, text, attachment: file ? { filename: file.filename, contentType: "application/pdf", base64: toBase64(file.bytes) } : undefined } });
      setState(r.ok ? { kind: "ok", msg: `Envoyé à ${rec.valid.join(", ")}.` } : { kind: "error", msg: r.error });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Envoi impossible" });
    }
  };
  useDismiss(true, onClose);
  return (
    <div className="em-back" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{CSS}</style>
      <div className="em-card" role="dialog" aria-label="Envoyer par e-mail">
        <button type="button" className="em-x" aria-label="Fermer" onClick={onClose}>×</button>
        <h3>Envoyer par e-mail</h3>
        <div className={`em-mode ${mode === "mailto" ? "mailto" : "real"}`} data-testid="email-mode">{mode ? `Mode : ${EMAIL_MODE_LABEL[mode]}` : "Mode : vérification…"}</div>
        <label>Destinataires<input aria-label="Destinataires" value={to} onChange={e => setTo(e.target.value)} placeholder="nom@entreprise.fr, autre@entreprise.fr" /></label>
        {rec.invalid.length > 0 && <small style={{ color: "#c0392b" }}>Adresse(s) invalide(s) : {rec.invalid.join(", ")}</small>}
        <label>Objet<input aria-label="Objet" value={subj} onChange={e => setSubj(e.target.value)} /></label>
        <label>Message<textarea aria-label="Message" rows={9} value={text} onChange={e => setText(e.target.value)} /></label>
        {pdf && <label style={{ flexDirection: "row", alignItems: "center", gap: 8, fontWeight: 600 }}><input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} /> Joindre le rapport PDF</label>}
        {state.msg && <div role="status" style={{ fontSize: 13, fontWeight: 700, color: state.kind === "error" ? "#c0392b" : "#0d7a54" }}>{state.msg}</div>}
        <div className="em-actions">
          <button type="button" className="em-ghost" onClick={onClose}>Fermer</button>
          <button type="button" className="em-primary" disabled={!rec.valid.length || !mode || state.kind === "sending"} onClick={() => void send()}>{state.kind === "sending" ? "Envoi…" : mode === "mailto" ? "Ouvrir la messagerie" : "Envoyer"}</button>
        </div>
      </div>
    </div>
  );
}
