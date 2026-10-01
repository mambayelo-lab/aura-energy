// webhook.ts — NOUVEAU (lot paiement).
//
// Point d'entrée du prestataire de paiement. Il n'est pas protégé par
// l'authentification de la plateforme : la sécurité vient de la vérification
// de signature à chaque appel. Il met à jour la table des abonnements, seule
// source du droit d'accès aux espaces Aura.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
  }
  return _supabase;
}

/** Identifiant lisible de l'offre (stable entre test et réel). */
function priceRef(item: any): string | null {
  return item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? null;
}

/** Offre interne Aura déduite du tarif souscrit. */
function planFromPrice(ref: string | null): string {
  if (!ref) return "essai";
  if (ref.startsWith("aura_decider")) return "decider";
  if (ref.startsWith("aura_architecturer")) return "architecturer";
  if (ref.startsWith("aura_plateforme")) return "plateforme";
  return "essai";
}

const iso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

async function upsertSubscription(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) { console.error("Abonnement sans userId"); return; }

  const item = sub.items?.data?.[0];
  const ref = priceRef(item);
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      price_id: ref,
      plan: planFromPrice(ref),
      status: sub.status,
      current_period_end: iso(periodEnd),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function markCanceled(sub: any, env: StripeEnv) {
  await getSupabase().from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await markCanceled(event.data.object, env);
      break;
    default:
      console.log("Événement non traité:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("env invalide:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
