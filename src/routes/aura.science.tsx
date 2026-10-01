import { createFileRoute } from "@tanstack/react-router";
import { VitrineSite } from "../components/vitrine/VitrineSite";

export const Route = createFileRoute("/aura/science")({
  component: () => <VitrineSite page="science" />,
  head: () => ({
    meta: [
      { title: "Science d'Aura — raisonnement ordinal bipolaire" },
      { name: "description", content: "Fondement scientifique d'Aura : thèse, publications, moteur BORA et ontologie minimale pour cadrer les modèles de langage." },
      { property: "og:title", content: "Science d'Aura — raisonnement ordinal bipolaire" },
      { property: "og:description", content: "Fondement scientifique d'Aura : thèse, publications, moteur BORA et ontologie minimale pour cadrer les modèles de langage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
