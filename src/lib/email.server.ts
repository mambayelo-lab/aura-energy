// Envoi d'e-mails côté serveur. Resend si RESEND_API_KEY est défini, sinon SMTP
// si SMTP_HOST, SMTP_USER et SMTP_PASS le sont (port SMTP_PORT, 465 = TLS
// direct, sinon STARTTLS). Aucune clé n'est écrite dans le code. Expéditeur :
// EMAIL_FROM (ou SMTP_USER).
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { connect as netConnect, type Socket } from "node:net";
import { buildMime, emailModeFrom, type Attachment, type EmailMode } from "./v4/email-core";

export function currentEmailMode(): EmailMode { return emailModeFrom(process.env); }

export async function sendEmailServer(msg: { to: string[]; subject: string; text: string; html?: string; attachment?: Attachment }): Promise<{ ok: true; mode: EmailMode; id?: string } | { ok: false; mode: EmailMode; error: string }> {
  const mode = currentEmailMode();
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "Aura <onboarding@resend.dev>";
  try {
    if (mode === "resend") {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const r = await resend.emails.send({
        from, to: msg.to, subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}),
        attachments: msg.attachment ? [{ filename: msg.attachment.filename, content: Buffer.from(msg.attachment.base64, "base64") }] : undefined,
      });
      if (r.error) return { ok: false, mode, error: r.error.message };
      return { ok: true, mode, id: r.data?.id };
    }
    if (mode === "smtp") {
      await smtpSend({ host: process.env.SMTP_HOST!, port: Number(process.env.SMTP_PORT ?? 587), user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!, from, to: msg.to, mime: buildMime({ from, to: msg.to, subject: msg.subject, text: msg.text, attachment: msg.attachment }) });
      return { ok: true, mode };
    }
    return { ok: false, mode, error: "Aucun service d'envoi configuré (RESEND_API_KEY ou SMTP_HOST / SMTP_USER / SMTP_PASS)." };
  } catch (e) {
    return { ok: false, mode, error: e instanceof Error ? e.message : "Envoi impossible" };
  }
}

// Client SMTP minimal : EHLO, STARTTLS (ou TLS direct sur 465), AUTH LOGIN, MAIL, RCPT, DATA.
async function smtpSend(o: { host: string; port: number; user: string; pass: string; from: string; to: string[]; mime: string }): Promise<void> {
  let sock: Socket | TLSSocket = o.port === 465 ? tlsConnect({ host: o.host, port: o.port, servername: o.host }) : netConnect({ host: o.host, port: o.port });
  let buf = "";
  const waiters: ((line: string) => void)[] = [];
  const attach = (s: Socket | TLSSocket) => s.on("data", (d: Buffer) => {
    buf += d.toString("utf8");
    let i: number;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^\d{3} /.test(line)) waiters.shift()?.(line); // dernière ligne d'une réponse
    }
  });
  attach(sock);
  const reply = () => new Promise<string>((res, rej) => { waiters.push(res); sock.once("error", rej); setTimeout(() => rej(new Error("SMTP : délai dépassé")), 20000); });
  const cmd = async (line: string, ok: RegExp) => { sock.write(`${line}\r\n`); const r = await reply(); if (!ok.test(r)) throw new Error(`SMTP : ${r}`); return r; };
  const from = (o.from.match(/<([^>]+)>/)?.[1] ?? o.from).trim();
  if (!/^220/.test(await reply())) throw new Error("SMTP : accueil inattendu");
  await cmd("EHLO aura", /^250/);
  if (o.port !== 465) {
    await cmd("STARTTLS", /^220/);
    sock.removeAllListeners("data");
    sock = tlsConnect({ socket: sock as Socket, servername: o.host });
    attach(sock);
    await new Promise<void>((res, rej) => { (sock as TLSSocket).once("secureConnect", () => res()); sock.once("error", rej); });
    await cmd("EHLO aura", /^250/);
  }
  await cmd("AUTH LOGIN", /^334/);
  await cmd(Buffer.from(o.user).toString("base64"), /^334/);
  await cmd(Buffer.from(o.pass).toString("base64"), /^235/);
  await cmd(`MAIL FROM:<${from}>`, /^250/);
  for (const t of o.to) await cmd(`RCPT TO:<${t}>`, /^25[01]/);
  await cmd("DATA", /^354/);
  await cmd(`${o.mime.replace(/^\./gm, "..")}\r\n.`, /^250/);
  sock.write("QUIT\r\n");
  sock.end();
}
