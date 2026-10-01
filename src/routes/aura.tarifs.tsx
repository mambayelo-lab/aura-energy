import { createFileRoute } from "@tanstack/react-router";
import { VitrineSite } from "../components/vitrine/VitrineSite";

export const Route = createFileRoute("/aura/tarifs")({
  component: () => <VitrineSite page="tarifs" />,
  head: () => ({
    meta: [
      { title: "Tarifs Aura — abonnement et prestations outillées" },
      { name: "description", content: "Abonnement par décideur et prestations outillées pour conduire la première décision avec vous." },
      { property: "og:title", content: "Tarifs Aura — abonnement et prestations outillées" },
      { property: "og:description", content: "Abonnement par décideur et prestations outillées pour conduire la première décision avec vous." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
