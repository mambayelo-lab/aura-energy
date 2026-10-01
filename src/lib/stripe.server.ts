// stripe.server.ts — NOUVEAU (lot paiement).
//
// Accès unique au prestataire de paiement. Toutes les demandes passent par la
// passerelle Lovable, qui détient seule la vraie clé secrète : les variables
// d'environnement lues ici ne sont que des identifiants de connexion.
//
// Aucun lien avec le moteur de décision : ce module ne fait que de la
// facturation.
import Stripe from 'stripe';
import { timingSafeEqual } from 'node:crypto';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

const GATEWAY_STRIPE_BASE = 'https://connector-gateway.lovable.dev/stripe';

export function getConnectionApiKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SANDBOX_API_KEY')
    : getEnv('STRIPE_LIVE_API_KEY');
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');

  return new Stripe(connectionApiKey, {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace('https://api.stripe.com', GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).entries(),
          ),
          'X-Connection-Api-Key': connectionApiKey,
          'Lovable-API-Key': lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as {
      message?: string; type?: string; code?: string; decline_code?: string; param?: string; requestId?: string;
      raw?: { message?: string; type?: string; code?: string; decline_code?: string; param?: string; requestId?: string };
    };
    const message = e.raw?.message ?? e.message;
    if (message) {
      const details = [
        e.raw?.type ?? e.type, e.raw?.code ?? e.code, e.raw?.decline_code ?? e.decline_code,
        e.raw?.param ?? e.param, e.raw?.requestId ?? e.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(', ')})` : message;
    }
  }
  return 'Stripe request failed';
}

/** Vérifie la signature d'un appel entrant du prestataire (HMAC-SHA256). */
export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === 'sandbox'
    ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = Buffer.from(new Uint8Array(signed)).toString('hex');
  // Comparaison à temps constant : évite qu'un attaquant déduise la signature
  // attendue en mesurant le temps de réponse.
  const expectedBytes = Buffer.from(expected, "hex");
  const matches = v1Signatures.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expectedBytes.length && timingSafeEqual(got, expectedBytes);
  });
  if (!matches) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
