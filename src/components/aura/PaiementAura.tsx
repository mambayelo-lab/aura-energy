// PaiementAura.tsx — NOUVEAU (lot paiement).
//
// Formulaire de règlement intégré à la page : pas de redirection, pas de
// saisie de carte maison. Le prestataire affiche son propre formulaire dans
// un cadre sécurisé ; Aura ne voit jamais les données bancaires.
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";

const jetonPaiement = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

/** Bandeau d'information : mode test, ou mise en service inachevée. */
export function BandeauPaiementTest() {
  if (!jetonPaiement) {
    return (
      <div style={{
        borderRadius: 8, padding: "8px 12px", fontSize: 13, textAlign: "center",
        background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B",
      }}>
        Le règlement par carte n'est pas encore activé sur cette version.
      </div>
    );
  }
  if (jetonPaiement.startsWith("pk_test_")) {
    return (
      <div style={{
        borderRadius: 8, padding: "8px 12px", fontSize: 13, textAlign: "center",
        background: "#FFF7ED", border: "1px solid #FDBA74", color: "#9A3412",
      }}>
        Environnement de test : aucun paiement réel n'est encaissé.
      </div>
    );
  }
  return null;
}

export function PaiementAura({ priceId, returnUrl }: { priceId: string; returnUrl?: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const r = await createCheckoutSession({
      data: {
        priceId,
        returnUrl: returnUrl ?? `${window.location.origin}/cockpit/abonnement?paiement=retour`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in r) throw new Error(r.error);
    if (!r.clientSecret) throw new Error("Le prestataire n'a pas renvoyé de session de paiement.");
    return r.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
