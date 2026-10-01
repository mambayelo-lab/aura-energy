// cockpit.abonnement.tsx — NOUVEAU (Lot 5).
//
// Un seul écran pour trois questions du client :
//   1. Où en est mon essai, et que se passe-t-il à son terme ?
//   2. Que coûte la suite, et qu'est-ce que j'obtiens ?
//   3. Combien la plateforme consomme-t-elle d'IA, et pour quoi ?
//
// Le droit d'accès est lu côté serveur (saas.functions.ts) : il n'est jamais
// déduit du navigateur. À l'expiration, l'écran affiche la coupure et propose
// la bascule payante.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlan, getMyUsage, requestPlan, PLANS, type PlanState } from "@/lib/saas.functions";
import { createPortalSession, TARIFS } from "@/lib/payments.functions";
import { PaiementAura, BandeauPaiementTest } from "@/components/aura/PaiementAura";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/cockpit/abonnement")({
  component: AbonnementPage,
  head: () => ({
    meta: [
      { title: "Abonnement et consommation — Aura" },
      { name: "description", content: "État de l'essai, plans Aura et consommation d'IA par module." },
      { property: "og:title", content: "Abonnement et consommation — Aura" },
      { property: "og:description", content: "Essai, plans et consommation d'IA de la plateforme Aura." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCENT = "#6C5CE7";
const card: React.CSSProperties = {
  border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface)", padding: "18px 20px",
};
const eyebrow: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--v4-text3)",
};

type Usage = Awaited<ReturnType<typeof getMyUsage>>;
type PlanId = keyof typeof TARIFS;
type Cadence = "mois" | "an";


function AbonnementPage() {
  const plan = useServerFn(getMyPlan);
  const usage = useServerFn(getMyUsage);
  const ask = useServerFn(requestPlan);
  const portal = useServerFn(createPortalSession);

  const [state, setState] = useState<PlanState | null>(null);
  const [use, setUse] = useState<Usage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Offre et cadence en cours de règlement : ouvre le formulaire dans la page.
  const [paiement, setPaiement] = useState<{ plan: PlanId; cadence: Cadence } | null>(null);

  useEffect(() => {
    let dead = false;
    Promise.all([plan(), usage({ data: { days: 30 } })])
      .then(([p, u]) => { if (!dead) { setState(p); setUse(u); } })
      .catch(() => { if (!dead) setErr("Connectez-vous pour voir votre abonnement."); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(id: PlanId, cadence: Cadence) {
    // On enregistre l'intention côté serveur, puis on ouvre le règlement.
    const r = await ask({ data: { plan: id } });
    setNote(r.message);
    setState(await plan());
    try {
      getStripeEnvironment();
      setPaiement({ plan: id, cadence });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Règlement indisponible.");
    }
  }

  async function gererAbonnement() {
    try {
      const r = await portal({ data: { returnUrl: window.location.href, environment: getStripeEnvironment() } });
      if ("error" in r) { setErr(r.error); return; }
      window.open(r.url, "_blank");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Espace de gestion indisponible.");
    }
  }


  const expired = state && !state.access;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 28px 48px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v4-text)" }}>
        Abonnement et consommation
      </div>
      <div style={{ fontSize: 13.5, color: "var(--v4-text2)", marginTop: 4 }}>
        Essai gratuit, sans carte. À son terme, l'accès aux espaces se ferme jusqu'à la souscription.
      </div>

      {err && <div style={{ ...card, marginTop: 18, color: "#92400E", background: "#FEF3C7", borderColor: "#FDE68A" }}>{err}</div>}

      {/* ── État de l'essai ── */}
      {state && (
        <div style={{ ...card, marginTop: 18, borderLeft: `3px solid ${expired ? "#DC2626" : ACCENT}` }}>
          <div style={eyebrow}>Votre accès</div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--v4-text)", marginTop: 12 }}>
            {state.status === "trialing" && `Essai en cours — ${state.daysLeft} jour${(state.daysLeft ?? 0) > 1 ? "s" : ""} restant${(state.daysLeft ?? 0) > 1 ? "s" : ""}`}
            {state.status === "active" && `Abonnement actif — plan ${state.plan}`}
            {state.status === "past_due" && `Souscription en cours — plan ${state.plan}`}
            {state.status === "expired" && "Essai terminé — accès fermé"}
            {state.status === "canceled" && "Abonnement résilié — accès fermé"}
          </div>
          <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 6, lineHeight: 1.6 }}>
            {expired
              ? "Les espaces Décider et Copilote sont en lecture seule. Choisissez un plan ci-dessous pour rouvrir l'accès ; vos modèles et votre vocabulaire de critères sont conservés."
              : "Tous les espaces sont ouverts. Aucune donnée n'est supprimée à la fin de l'essai."}
          </div>
        </div>
      )}

      {note && (
        <div style={{ ...card, marginTop: 12, background: "#EEF2FF", borderColor: "#C7D2FE", fontSize: 13.5, color: "#3730A3" }}>{note}</div>
      )}

      {/* ── Plans ── */}
      <div style={{ ...eyebrow, marginTop: 28 }}>Plans</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14, marginTop: 10 }}>
        {PLANS.map(p => (
          <div key={p.id} style={{ ...card, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--v4-text)" }}>{p.nom}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT, marginTop: 12 }}>{p.prix}</div>
            <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{p.prixAnnuel}</div>
            <div style={{ ...eyebrow, marginTop: 12 }}>{p.pour}</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {p.inclus.map(i => (
                <div key={i} style={{ fontSize: 13, color: "var(--v4-text2)", display: "flex", gap: 12 }}>
                  <span style={{ color: ACCENT, fontWeight: 800 }}>—</span><span>{i}</span>
                </div>
              ))}
            </div>
            {/* Deux cadences : mensuelle ou annuelle. Le règlement s'ouvre
                dans la page, sans redirection. */}
            <div style={{ marginTop: "auto", marginBlockStart: 16, display: "flex", gap: 8 }}>
              {(["mois", "an"] as const).map(cad => (
                <button key={cad} onClick={() => choose(p.id as PlanId, cad)} style={{
                  flex: 1, padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1.5px solid ${ACCENT}`,
                  background: paiement?.plan === p.id && paiement?.cadence === cad ? ACCENT : "transparent",
                  color: paiement?.plan === p.id && paiement?.cadence === cad ? "#fff" : ACCENT,
                  fontSize: 13, fontWeight: 800, fontFamily: "inherit",
                }}>
                  {cad === "mois" ? "Mensuel" : "Annuel"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Règlement ── */}
      {paiement && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={eyebrow}>Règlement — {paiement.plan}, {paiement.cadence === "mois" ? "mensuel" : "annuel"}</div>
            <button onClick={() => setPaiement(null)} aria-label="Fermer le règlement" style={{
              marginLeft: "auto", width: 26, height: 26, borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontFamily: "inherit",
            }}>×</button>
          </div>
          <div style={{ marginTop: 10 }}><BandeauPaiementTest /></div>
          <div style={{ marginTop: 12 }}>
            <PaiementAura priceId={TARIFS[paiement.plan][paiement.cadence]} />
          </div>
        </div>
      )}

      {/* Gestion bancaire pour un abonnement déjà en place. */}
      <div style={{ marginTop: 12 }}>
        <button onClick={gererAbonnement} style={{
          padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--v4-border)",
          background: "transparent", color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
        }}>
          Gérer mon abonnement, mes factures et mon moyen de paiement
        </button>
      </div>


      {/* ── Consommation d'IA ── */}
      <div style={{ ...eyebrow, marginTop: 30 }}>Consommation d'IA — 30 derniers jours</div>
      <div style={{ ...card, marginTop: 10 }}>
        {!use && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Chargement…</div>}
        {use && use.calls === 0 && (
          <div style={{ fontSize: 13, color: "var(--v4-text2)" }}>
            Aucune consommation enregistrée sur la période. Le compteur se remplit dès le premier entretien guidé ou échange avec le copilote.
          </div>
        )}
        {use && use.calls > 0 && (
          <>
            <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
              <div>
                <div style={eyebrow}>Tokens</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--v4-text)" }}>{use.total.toLocaleString("fr-FR")}</div>
              </div>
              <div>
                <div style={eyebrow}>Appels</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--v4-text)" }}>{use.calls}</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              {use.byFeature.map(f => {
                const pct = use.total ? Math.round((f.tokens / use.total) * 100) : 0;
                return (
                  <div key={f.feature} style={{ padding: "8px 0", borderTop: "1px solid var(--v4-border)" }}>
                    <div style={{ display: "flex", fontSize: 13, color: "var(--v4-text2)" }}>
                      <span style={{ fontWeight: 700, color: "var(--v4-text)" }}>{f.feature}</span>
                      <span style={{ marginLeft: "auto" }}>{f.tokens.toLocaleString("fr-FR")} tokens · {f.calls} appels</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 6, background: "var(--v4-bg)", marginTop: 6 }}>
                      <div style={{ width: `${pct}%`, height: 5, borderRadius: 6, background: ACCENT }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
