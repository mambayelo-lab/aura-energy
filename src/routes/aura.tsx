import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Route de mise en page du site vitrine : chaque page enfant porte son
 *  propre chrome (barre, en-tête, clôture) via VitrineSite. */
export const Route = createFileRoute("/aura")({
  component: () => <Outlet />,
});
