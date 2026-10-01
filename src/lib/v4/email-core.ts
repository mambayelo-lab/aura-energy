// Envoi d'une réponse par e-mail : fonctions pures partagées entre le client
// (formulaire, repli mailto) et le serveur (message MIME pour SMTP).
export type EmailMode = "resend" | "smtp" | "mailto";

export const EMAIL_MODE_LABEL: Record<EmailMode, string> = {
  resend: "Envoi réel par Resend",
  smtp: "Envoi réel par SMTP",
  mailto: "Messagerie de l'ordinateur (mailto) : joignez le PDF téléchargé",
};

// Mode actif selon les variables présentes (jamais leur valeur).
export function emailModeFrom(env: Record<string, string | undefined>): EmailMode {
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return "smtp";
  return "mailto";
}

const EMAIL = /^[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[^\s@<>(),;:]+$/;
export function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  return { valid: [...new Set(parts.filter(p => EMAIL.test(p)))], invalid: parts.filter(p => !EMAIL.test(p)) };
}

export function mailtoLink(to: string[], subject: string, body: string): string {
  const q = new URLSearchParams();
  q.set("subject", subject);
  q.set("body", body);
  return `mailto:${to.map(encodeURIComponent).join(",")}?${q.toString().replace(/\+/g, "%20")}`;
}

// Texte d'e-mail lisible depuis une réponse markdown du copilote.
export function markdownToText(md: string): string {
  return md.replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

const b64 = (s: string) => typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s)));
const encWord = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n");

export interface Attachment { filename: string; contentType: string; base64: string }

// Message MIME (texte UTF-8 + pièce jointe éventuelle) pour l'envoi SMTP.
export function buildMime(opts: { from: string; to: string[]; subject: string; text: string; attachment?: Attachment; boundary?: string; date?: Date }): string {
  const boundary = opts.boundary ?? `aura-${Math.random().toString(36).slice(2)}`;
  const head = [
    `From: ${opts.from}`, `To: ${opts.to.join(", ")}`, `Subject: ${encWord(opts.subject)}`,
    `Date: ${(opts.date ?? new Date()).toUTCString()}`, "MIME-Version: 1.0",
  ];
  const textPart = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(b64(opts.text))].join("\r\n");
  if (!opts.attachment) return [...head, textPart].join("\r\n") + "\r\n";
  const a = opts.attachment;
  return [
    ...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, textPart,
    `--${boundary}`, `Content-Type: ${a.contentType}; name="${encWord(a.filename)}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${encWord(a.filename)}"`, "", wrap76(a.base64),
    `--${boundary}--`, "",
  ].join("\r\n");
}
