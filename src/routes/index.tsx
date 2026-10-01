import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/cockpit/home" });
  },
  head: () => ({
    meta: [
      { title: "Aura" },
      { name: "description", content: "Un seul point d'entrée pour construire une décision défendable puis concevoir la transformation qui en découle." },
    ],
  }),
});
