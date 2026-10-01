// Fonctions serveur d'envoi d'e-mail (le client ne voit jamais les clés).
import { createServerFn } from "@tanstack/react-start";
import type { Attachment, EmailMode } from "./email-core";

export const getEmailMode = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ mode: EmailMode }> => {
    const { currentEmailMode } = await import("../email.server");
    return { mode: currentEmailMode() };
  });

export const sendEmail = createServerFn({ method: "POST" })
  .validator((d: { to: string[]; subject: string; text: string; attachment?: Attachment }) => {
    if (!Array.isArray(d.to) || !d.to.length || d.to.length > 20) throw new Error("Destinataires invalides");
    if (d.attachment && d.attachment.base64.length > 8_000_000) throw new Error("Pièce jointe trop lourde");
    return d;
  })
  .handler(async ({ data }) => {
    const { sendEmailServer } = await import("../email.server");
    return sendEmailServer(data);
  });
