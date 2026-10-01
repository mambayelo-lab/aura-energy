import { createFileRoute } from "@tanstack/react-router";
import { VitrineSite } from "../components/vitrine/VitrineSite";

export const Route = createFileRoute("/aura/plateforme")({
  component: () => <VitrineSite page="plateforme" />,
  head: () => ({
    meta: [
      { title: "Plateforme Aura — Décider puis architecturer" },
      { name: "description", content: "Décider, Architecturer, Copilote décisionnel : trois espaces d'une même plateforme de Decision Intelligence & Augmented Architecture." },
      { property: "og:title", content: "Plateforme Aura — Décider puis architecturer" },
      { property: "og:description", content: "Décider, Architecturer, Copilote décisionnel : trois espaces d'une même plateforme de Decision Intelligence & Augmented Architecture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
