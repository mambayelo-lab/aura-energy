import { createFileRoute } from "@tanstack/react-router";
import { VitrineSite } from "../components/vitrine/VitrineSite";

export const Route = createFileRoute("/aura/methode")({
  component: () => <VitrineSite page="methode" />,
  head: () => ({
    meta: [
      { title: "Méthode Aura — comprendre, arbitrer, architecturer, suivre" },
      { name: "description", content: "La méthode outillée d'Aura en quatre temps, et son parti pris non compensatoire face aux IA généralistes." },
      { property: "og:title", content: "Méthode Aura — comprendre, arbitrer, architecturer, suivre" },
      { property: "og:description", content: "La méthode outillée d'Aura en quatre temps, et son parti pris non compensatoire face aux IA généralistes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
