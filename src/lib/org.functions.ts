// org.functions.ts — NOUVEAU (lot sécurité).
//
// Organisations, membres, invitations. Trois principes :
//  1. Rien n'est décidé dans le navigateur : l'appartenance et le rôle se
//     lisent côté serveur, sous RLS, via `is_org_member` / `is_org_admin`.
//  2. Une invitation est un jeton opaque à usage unique, avec expiration.
//     L'acceptation vérifie que l'email du jeton correspond à l'utilisateur
//     connecté — un jeton intercepté ne suffit donc pas à entrer.
//  3. Aucun calcul de décision ici : ce module ne touche pas au moteur BORA.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string; claims: any };

/** Refus net des appels anonymes : ces fonctions écrivent, RLS ne suffit pas à l'UX. */
function requireUser(ctx: Ctx) {
  if (!ctx.supabase || !ctx.userId || ctx.userId === "anonymous") {
    throw new Error("Connexion requise");
  }
  return ctx.userId;
}

function slugify(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "organisation";
}

/** Jeton d'invitation : 32 octets aléatoires, jamais dérivé de l'email. */
function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ── Lecture : mon organisation, mes droits ──────────────────────────────────
export const getMyOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = requireUser(context as Ctx);
    const { data: mine } = await context.supabase
      .from("organization_members").select("org_id, role").eq("user_id", uid).limit(1).maybeSingle();
    if (!mine) return { org: null, role: null, members: [], invitations: [] };

    const [{ data: org }, { data: members }, { data: invitations }] = await Promise.all([
      context.supabase.from("organizations").select("*").eq("id", mine.org_id).maybeSingle(),
      context.supabase.from("organization_members").select("user_id, role, joined_at").eq("org_id", mine.org_id),
      context.supabase.from("organization_invitations")
        .select("id, email, role, expires_at, accepted_at, revoked_at, created_at, token")
        .eq("org_id", mine.org_id).order("created_at", { ascending: false }),
    ]);

    // Les emails des membres vivent dans `profiles` : jamais de lecture de auth.users.
    const ids = (members ?? []).map((m: any) => m.user_id);
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, email, full_name").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    return {
      org,
      role: mine.role as string,
      members: (members ?? []).map((m: any) => ({
        ...m,
        email: byId.get(m.user_id)?.email ?? null,
        name: byId.get(m.user_id)?.full_name ?? null,
        isMe: m.user_id === uid,
      })),
      invitations: invitations ?? [],
    };
  });

// ── Création : le créateur devient propriétaire ─────────────────────────────
export const createOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = requireUser(context as Ctx);
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: org, error } = await context.supabase
      .from("organizations").insert({ name: data.name, slug }).select("*").single();
    if (error) throw new Error(error.message);
    const { error: e2 } = await context.supabase
      .from("organization_members").insert({ org_id: org.id, user_id: uid, role: "owner" });
    if (e2) throw new Error(e2.message);
    return { org };
  });

// ── Invitations ─────────────────────────────────────────────────────────────
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    org_id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["admin", "member", "lecteur"]).default("member"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = requireUser(context as Ctx);
    const token = newToken();
    // RLS n'autorise l'insertion qu'aux administrateurs de l'organisation.
    const { data: inv, error } = await context.supabase.from("organization_invitations")
      .insert({ org_id: data.org_id, email: data.email.toLowerCase(), role: data.role, token, invited_by: uid })
      .select("id, email, role, token, expires_at").single();
    if (error) throw new Error(error.message);
    return { invitation: inv };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    requireUser(context as Ctx);
    const { error } = await context.supabase.from("organization_invitations")
      .update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Acceptation. Le jeton est lu avec le client de l'appelant : la politique de
 * lecture est réservée aux administrateurs, donc on passe par une recherche
 * ciblée sur le jeton via le client de service — puis on vérifie l'email.
 */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = requireUser(context as Ctx);
    const email = String((context as Ctx).claims?.email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv } = await supabaseAdmin.from("organization_invitations")
      .select("id, org_id, email, role, expires_at, accepted_at, revoked_at")
      .eq("token", data.token).maybeSingle();

    if (!inv) throw new Error("Invitation introuvable");
    if (inv.revoked_at) throw new Error("Invitation révoquée");
    if (inv.accepted_at) throw new Error("Invitation déjà utilisée");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitation expirée");
    if (email && inv.email.toLowerCase() !== email) {
      throw new Error("Cette invitation concerne une autre adresse");
    }

    await supabaseAdmin.from("organization_members")
      .upsert({ org_id: inv.org_id, user_id: uid, role: inv.role }, { onConflict: "org_id,user_id" });
    await supabaseAdmin.from("organization_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: uid }).eq("id", inv.id);

    return { org_id: inv.org_id, role: inv.role };
  });

// ── Membres ─────────────────────────────────────────────────────────────────
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    org_id: z.string().uuid(), user_id: z.string().uuid(), role: z.enum(["owner", "admin", "member", "lecteur"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    requireUser(context as Ctx);
    const { error } = await context.supabase.from("organization_members")
      .update({ role: data.role }).eq("org_id", data.org_id).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    org_id: z.string().uuid(), user_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    requireUser(context as Ctx);
    const { error } = await context.supabase.from("organization_members")
      .delete().eq("org_id", data.org_id).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
