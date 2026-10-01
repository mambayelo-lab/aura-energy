// Chaque déploiement ne sert qu'UN produit, selon l'adresse :
//   aura-decision-zen…  → Aura Supply Chain
//   aura-decider…       → Aura Décider
// Aura Architect a son propre dépôt et son propre déploiement
// (aura-architect-seven.vercel.app). Si une adresse aura-architect… arrive
// encore ici, elle retombe sur Aura Supply Chain plutôt que sur une erreur.
// En local (ou sur une adresse inconnue), tout reste accessible pour le développement.
export type HostProduct = "supply" | "decide";


export function productForHost(hostname: string): HostProduct | null {
  const h = hostname.toLowerCase();
  if (h.startsWith("aura-decision-zen")) return "supply";
  if (h.startsWith("aura-decider")) return "decide";
  if (h.startsWith("aura-architect")) return "supply";
  return null;
}

// Mode produit d'un onglet : l'adresse décide, sauf si l'onglet a été ouvert
// avec ?app=supply ou ?app=decide, mémorisé pour l'onglet.
export function resolveTabProduct(location: Location, storage: Storage | undefined): HostProduct | null {
  // Produit imposé par le déploiement (variable Vercel VITE_AURA_PRODUCT) : prioritaire.
  const forced = (import.meta.env?.VITE_AURA_PRODUCT as string | undefined)?.trim();
  if (forced === "supply" || forced === "decide") return forced;
  const asked = new URLSearchParams(location.search).get("app");
  if (asked === "supply" || asked === "decide") {
    try { storage?.setItem("aura.tabProduct", asked); } catch { /* stockage indisponible */ }
    return asked;
  }
  let remembered: string | null = null;
  try { remembered = storage?.getItem("aura.tabProduct") ?? null; } catch { remembered = null; }
  if (remembered === "supply" || remembered === "decide") return remembered;
  return productForHost(location.hostname);
}

export const PRODUCT_HOME: Record<HostProduct, string> = {
  supply: "/cockpit/resilience",
  decide: "/cockpit/home",
};

const OWN: Record<HostProduct, string[]> = {
  supply: ["/cockpit/resilience", "/cockpit/studio"],
  decide: ["/cockpit/home", "/cockpit/atelier", "/cockpit/demos"],
};
// Pages communes (compte, administration, authentification, partages).
const SHARED = ["/auth", "/cockpit/admin-plateforme", "/cockpit/abonnement", "/cockpit/comptes", "/avis/", "/analyses-partagees", "/api/"];

export function isAllowedPath(product: HostProduct, path: string): boolean {
  if (SHARED.some(p => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}?`))) return true;
  return OWN[product].some(p => path === p || path.startsWith(`${p}/`) || (p === "/cockpit/demos" && path === "/cockpit/demos"));
}
