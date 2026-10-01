// Ontologie Énergie (miroir de GET /api/ontology du SI fictif Héliade).
export type EnergyObject = { id: string; libelle: string; cle: string; maitre: string; description: string };
export const ENERGY_OBJECTS: EnergyObject[] = [
  { id: "Actif", libelle: "Actif", cle: "assetId", maitre: "referentiel", description: "Unité de production ou de stockage (éolien, solaire, hydro, thermique, BESS, hybride)." },
  { id: "Site", libelle: "Site", cle: "siteId", maitre: "referentiel", description: "Emplacement physique et point de raccordement." },
  { id: "Pays", libelle: "Pays", cle: "pays", maitre: "referentiel", description: "Pays d'exploitation, zone de prix et gestionnaire de réseau." },
  { id: "Marche", libelle: "Marché", cle: "marcheId", maitre: "planification", description: "DA, ID, aFRR, mFRR." },
  { id: "Programme", libelle: "Programme", cle: "programmeId", maitre: "planification", description: "Engagement de production, de charge ou de décharge sur une période." },
  { id: "Consigne", libelle: "Consigne", cle: "consigneId", maitre: "orchestrateur", description: "Ordre de puissance émis par le centre ; Aura le lit, ne l'émet jamais." },
  { id: "Telemesure", libelle: "Télémesure", cle: "assetId+horodatage", maitre: "temps-reel", description: "Mesure temps réel, qualité, contrôlabilité, SoC." },
  { id: "Indisponibilite", libelle: "Indisponibilité", cle: "indispoId", maitre: "indisponibilites", description: "Indisponibilité planifiée ou fortuite, capacité restante." },
  { id: "EngagementServicesSysteme", libelle: "Engagement de services système", cle: "engagementId", maitre: "planification", description: "Réserve aFRR/mFRR contractualisée." },
  { id: "MessageREMIT", libelle: "Message REMIT (UMM)", cle: "ummId|indispoId", maitre: "remit", description: "Publication d'information privilégiée et échéance." },
  { id: "CentreDeConduite", libelle: "Centre de conduite", cle: "centreId", maitre: "scada-pays", description: "Centre central ou pays." },
  { id: "Operateur", libelle: "Opérateur", cle: "operateurId", maitre: "journal-quart", description: "Opérateur ou dispatcher de quart." },
  { id: "Contrat", libelle: "Contrat", cle: "contratId", maitre: "referentiel", description: "PPA, services système, tolling." },
  { id: "LienCentrePays", libelle: "Lien centre–pays", cle: "lienId", maitre: "scada-pays", description: "Liaison de téléconduite et son mode dégradé." },
  { id: "OrdreDeTravail", libelle: "Ordre de travail", cle: "otId", maitre: "gmao", description: "Maintenance et contraintes locales." },
];
export const ENERGY_RELATIONS: [string, string, string][] = [
  ["Actif", "est situé sur", "Site"], ["Site", "est dans", "Pays"], ["Actif", "est conduit par", "CentreDeConduite"],
  ["CentreDeConduite", "est rattaché à", "CentreDeConduite"], ["Operateur", "est de quart dans", "CentreDeConduite"],
  ["Programme", "porte sur", "Actif"], ["Programme", "est placé sur", "Marche"], ["EngagementServicesSysteme", "découle de", "Programme"],
  ["Consigne", "s'applique à", "Actif"], ["Consigne", "met en œuvre", "Programme"], ["Telemesure", "mesure", "Actif"],
  ["Indisponibilite", "affecte", "Actif"], ["Indisponibilite", "impacte", "EngagementServicesSysteme"], ["MessageREMIT", "publie", "Indisponibilite"],
  ["LienCentrePays", "relie", "CentreDeConduite"], ["OrdreDeTravail", "contraint", "Actif"], ["Contrat", "engage", "Actif"],
];
