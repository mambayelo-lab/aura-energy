import { createFileRoute } from "@tanstack/react-router";
import { VitrineSite } from "../components/vitrine/VitrineSite";

export const Route = createFileRoute("/aura/solutions")({
  component: () => <VitrineSite page="solutions" />,
  head: () => ({
    meta: [
      { title: "Solutions Aura — Énergie, Retail, Supply chain" },
      { name: "description", content: "Cas de décision par secteur : Énergie & Utilities, Retail & distribution, Supply chain — question posée, arbitrage tenu, livrable produit." },
      { property: "og:title", content: "Solutions Aura — Énergie, Retail, Supply chain" },
      { property: "og:description", content: "Cas de décision par secteur : Énergie & Utilities, Retail & distribution, Supply chain — question posée, arbitrage tenu, livrable produit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
