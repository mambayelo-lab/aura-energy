// Rapport PDF de Décider et envoi par e-mail (Resend, SMTP ou repli mailto).
import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession } from "../atelier-store";
import { decisionReport, decisionReportPdf } from "../decision-report";
import { buildMime, emailModeFrom, mailtoLink, markdownToText, parseRecipients } from "../email-core";

const sendMock = vi.fn(async () => ({ data: { id: "em_1" }, error: null }));
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } }));

describe("e-mail", () => {
  afterEach(() => { vi.unstubAllEnvs(); sendMock.mockClear(); });

  it("mode actif selon les variables, sans jamais lire la clé", () => {
    expect(emailModeFrom({})).toBe("mailto");
    expect(emailModeFrom({ SMTP_HOST: "smtp.x", SMTP_USER: "u" })).toBe("mailto");
    expect(emailModeFrom({ SMTP_HOST: "smtp.x", SMTP_USER: "u", SMTP_PASS: "p" })).toBe("smtp");
    expect(emailModeFrom({ RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.x", SMTP_USER: "u", SMTP_PASS: "p" })).toBe("resend");
  });

  it("destinataires, lien mailto et texte lisible", () => {
    expect(parseRecipients("a@b.fr, c@d.com; pas-une-adresse a@b.fr")).toEqual({ valid: ["a@b.fr", "c@d.com"], invalid: ["pas-une-adresse"] });
    const link = mailtoLink(["a@b.fr"], "Décision S1", "Ligne 1\nLigne 2");
    expect(link).toBe("mailto:a%40b.fr?subject=D%C3%A9cision%20S1&body=Ligne%201%0ALigne%202");
    expect(markdownToText("**Titre**\n\n```chart\n{}\n```\n- point")).toBe("Titre\n\n- point");
  });

  it("message MIME : objet UTF-8 encodé, texte et pièce jointe PDF", () => {
    const mime = buildMime({ from: "Aura <a@b.fr>", to: ["c@d.fr"], subject: "Décision", text: "Bonjour", attachment: { filename: "rapport.pdf", contentType: "application/pdf", base64: "JVBERi0=" }, boundary: "B", date: new Date("2026-09-28T10:00:00Z") });
    expect(mime).toContain("Subject: =?UTF-8?B?RMOpY2lzaW9u?=");
    expect(mime).toContain('Content-Type: multipart/mixed; boundary="B"');
    expect(mime).toContain('Content-Disposition: attachment; filename="rapport.pdf"');
    expect(mime).toContain("JVBERi0=");
    expect(mime.trimEnd().endsWith("--B--")).toBe(true);
  });

  it("serveur : repli mailto sans configuration, envoi Resend avec la pièce jointe sinon", async () => {
    const { sendEmailServer, currentEmailMode } = await import("../../email.server");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_HOST", "");
    expect(currentEmailMode()).toBe("mailto");
    expect(await sendEmailServer({ to: ["a@b.fr"], subject: "S", text: "T" })).toMatchObject({ ok: false, mode: "mailto" });
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const r = await sendEmailServer({ to: ["a@b.fr"], subject: "S", text: "T", attachment: { filename: "r.pdf", contentType: "application/pdf", base64: "JVBERi0=" } });
    expect(r).toEqual({ ok: true, mode: "resend", id: "em_1" });
    const arg = (sendMock.mock.calls as unknown as [{ to: string[]; attachments: { filename: string; content: Buffer }[] }][])[0][0];
    expect(arg.to).toEqual(["a@b.fr"]);
    expect(arg.attachments[0].filename).toBe("r.pdf");
    expect(arg.attachments[0].content.toString("base64")).toBe("JVBERi0=");
  });
});

describe("rapport PDF de décision", () => {
  it("question, classement Bora, plus petit changement, arbre, décision et résultats clés", async () => {
    const s = DEMO_FACTORIES["telereleve"](newSession({ contextRaw: "" }));
    const retained = s.scenarios[0].id;
    const withFollow = { ...s, retainedScenarioId: retained, followUp: { scenarioId: retained, label: s.scenarios[0].label, decidedAt: "2026-09-01T00:00:00Z", reviewDate: "2026-10-01", keyResults: [{ id: "k", label: "Taux de relève", unit: "%", start: 80, target: 98, current: 89, deadline: "2026-12-31", owner: "Exploitation" }] } };
    const r = decisionReport(withFollow, null, new Date("2026-09-28T10:00:00Z"));
    expect(r.title).toBe(s.title);
    expect(r.ranking.length).toBe(s.scenarios.length);
    expect(r.space).toMatch(/exhaustif/);
    expect(r.move).toBeDefined();
    expect(r.levers.length).toBe(s.leviersDef.length);
    expect(r.decision?.label).toBe(s.scenarios[0].label);
    expect(r.keyResults[0]).toMatchObject({ label: "Taux de relève", progress: 0.5 });
    const pdf = await PDFDocument.load(await decisionReportPdf(r));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toMatch(/Rapport de décision/);
  });
});
