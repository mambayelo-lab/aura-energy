// ontology-catalogue.ts — lot "Control Tower" — Supply Chain.
//
// Transcription fidèle du tableau d'ontologie Supply Chain du catalogue
// fourni (AURA_Catalogue_Alertes_Energy_Supply_Decisions.pdf, page 8) :
// pour chaque famille, les Objets minimaux à modéliser, et les Alertes
// qu'elle alimente. Contenu non fabriqué — lecture seule, aucun connecteur
// réel derrière ces tables à ce stade.
//
// Périmètre volontairement restreint à Supply Chain (le lot "Control
// Tower" couvrait aussi Énergie ; ce périmètre a été retiré).
export type AlertSector = "supply-chain";

export type OntologyFamily = {
  famille: string;
  objetsMinimaux: string[];
  alertesAlimentees: string[];
};

export const ONTOLOGY_CATALOGUE: Record<AlertSector, OntologyFamily[]> = {
  "supply-chain": [
    {
      famille: "Réseau",
      objetsMinimaux: ["Site", "Usine", "Entrepôt", "Fournisseur", "Client", "Route"],
      alertesAlimentees: ["S1", "S9", "S10", "S14"],
    },
    {
      famille: "Produit",
      objetsMinimaux: ["Produit", "Composant", "Nomenclature", "Substitution", "Cycle de vie"],
      alertesAlimentees: ["S3", "S12"],
    },
    {
      famille: "Flux",
      objetsMinimaux: ["Commande", "Expédition", "Stock", "Capacité", "Demande", "Délai"],
      alertesAlimentees: ["S2", "S4", "S6", "S7"],
    },
    {
      famille: "Performance",
      objetsMinimaux: ["OTIF", "Qualité", "Coût", "Marge", "Service", "Carbone"],
      alertesAlimentees: ["S5", "S8", "S11"],
    },
    {
      famille: "Systèmes",
      objetsMinimaux: ["Application", "Objet/champ", "Source", "Fraîcheur", "Qualité"],
      alertesAlimentees: ["S13", "S15"],
    },
    {
      famille: "Décision",
      objetsMinimaux: ["Alerte", "Scénario", "Contrainte", "Preuve", "Recommandation", "Action"],
      alertesAlimentees: ["toutes — traçabilité bout en bout"],
    },
  ],
};
