// Familles de signaux du cockpit Supply — déduites du libellé de l'alerte et
// de l'indicateur qui la porte (aucune donnée ajoutée) ; servent au filtre.
// L'ordre compte : le premier motif reconnu l'emporte (« Risque de rupture
// fournisseur » est une alerte fournisseur, pas une alerte stock).
export const SUPPLY_FAMILIES: { id: string; label: string; pattern: RegExp }[] = [
  { id: "fournisseur", label: "Fournisseur", pattern: /fournisseur|supplier|sourcing|achat/i },
  { id: "stock", label: "Stock", pattern: /stock|couverture|inventaire|rupture|entrep/i },
  { id: "transport", label: "Transport", pattern: /transport|livraison|expédition|shipment|logisti|retard/i },
  { id: "demande", label: "Demande", pattern: /demande|prévision|promo|vente/i },
  { id: "autre", label: "Autre", pattern: /$^/ },
];

export function supplyFamilyOf(alertLabel: string, kpiLabel = ""): string {
  const text = `${alertLabel} ${kpiLabel}`;
  return SUPPLY_FAMILIES.find(f => f.pattern.test(text))?.id ?? "autre";
}
