// Traitement des gros documents sans jamais dépasser la limite des fonctions (~4,5 Mo par requête) :
// synthèse progressive morceau par morceau, et dépôt direct dans le stockage par URL signée.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DOCS_BUCKET = "aura-documents";

const SYNTH_PROMPT = `Tu lis un long document morceau par morceau. On te donne la synthèse déjà établie et le morceau suivant.
Rends la synthèse mise à jour (au plus 1 500 mots), en français, en texte brut : faits, chiffres tels qu'écrits, applications, flux, objets métier, contraintes, risques, options.
Recopie les chiffres et les noms exactement, entre guillemets quand c'est une citation. N'invente rien ; ce qui est ambigu est marqué « à confirmer ».`;

async function synthesize(name: string, index: number, total: number, summary: string, chunk: string) {
  const { mistralChat } = await import("../mistral.server");
  const r = await mistralChat({
    temperature: 0.1, maxTokens: 2200,
    messages: [{ role: "system", content: SYNTH_PROMPT }, { role: "user", content: `Document : ${name} — morceau ${index + 1}/${total}\n\nSynthèse actuelle :\n${summary || "(vide)"}\n\nMorceau :\n${chunk}` }],
  });
  return r.ok && r.content.trim() ? { summary: r.content.trim(), ok: true } : { summary, ok: false };
}

/** Synthèse progressive : un morceau de texte (≤ 20 000 caractères) à la fois. */
export const synthesizeChunk = createServerFn({ method: "POST" })
  .validator((d: { name: string; index: number; total: number; summary: string; chunk: string }) => ({ ...d, name: String(d.name).slice(0, 200), summary: String(d.summary ?? "").slice(0, 16_000), chunk: String(d.chunk).slice(0, 20_000) }))
  .handler(async ({ data }) => synthesize(data.name, data.index, data.total, data.summary, data.chunk));

const needUser = (c: { supabase: unknown; userId: string }) => { if (!c.supabase || c.userId === "anonymous") throw new Error("Connexion requise pour déposer un gros fichier."); };
const safePath = (userId: string, name: string) => `${userId}/${Date.now()}-${name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-120)}`;

/** URL signée de dépôt : le navigateur envoie le fichier directement au stockage, sans passer par la fonction. */
export const createDocUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { name: string }) => d)
  .handler(async ({ data, context }) => {
    needUser(context);
    const path = safePath(context.userId, data.name);
    const { data: up, error } = await context.supabase.storage.from(DOCS_BUCKET).createSignedUploadUrl(path);
    if (error || !up) throw new Error(`Dépôt impossible : ${error?.message ?? "stockage indisponible"}`);
    return { path, token: up.token };
  });

/** Lit une plage d'octets du fichier déposé et l'ajoute à la synthèse (texte brut : txt, md, csv, json, XML). */
export const synthesizeStoredChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { path: string; start: number; end: number; index: number; total: number; summary: string }) => d)
  .handler(async ({ data, context }) => {
    needUser(context);
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Fichier hors de votre espace.");
    const { data: signed, error } = await context.supabase.storage.from(DOCS_BUCKET).createSignedUrl(data.path, 120);
    if (error || !signed) throw new Error("Lecture du fichier déposé impossible.");
    const res = await fetch(signed.signedUrl, { headers: { Range: `bytes=${data.start}-${data.end - 1}` } });
    if (!res.ok) throw new Error(`Lecture du fichier déposé : HTTP ${res.status}`);
    const chunk = new TextDecoder().decode(await res.arrayBuffer());
    return synthesize(data.path.split("/").pop() ?? "document", data.index, data.total, String(data.summary ?? "").slice(0, 16_000), chunk.slice(0, 1_200_000));
  });
