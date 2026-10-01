import { createFileRoute } from "@tanstack/react-router";
import { VitrineCommerciale } from "../components/vitrine/VitrineCommerciale";

export const Route = createFileRoute("/aura/")({
  component: () => <VitrineCommerciale page="home" />,
  head: () => ({
    meta: [
      { title: "Aura — De l’alerte à la décision" },
      { name: "description", content: "Aura rassemble les bonnes données, explique les alertes Supply Chain et guide les équipes jusqu’à une décision claire et traçable." },
      { property: "og:title", content: "Aura — De l’alerte à la décision" },
      { property: "og:description", content: "Comprendre ce qui se passe, choisir quoi faire et suivre la décision — sans remplacer vos logiciels ni déplacer toutes vos données." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
