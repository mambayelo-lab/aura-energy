// stripe.ts — NOUVEAU (lot paiement, côté navigateur).
//
// Un seul rôle : charger le formulaire de paiement et savoir si l'on est en
// environnement de test ou réel. L'environnement est déduit du préfixe du
// jeton public — jamais supposé.
import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith('pk_test_')) return 'sandbox';
  if (clientToken?.startsWith('pk_live_')) return 'live';
  throw new Error(
    "Le règlement par carte n'est pas encore configuré pour cette version. Terminez la mise en service des paiements.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}
