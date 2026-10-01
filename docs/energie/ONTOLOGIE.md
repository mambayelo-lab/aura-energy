# Ontologie Énergie

> SI et données fictifs (Héliade Énergies). Aucun lien avec un opérateur réel. Fichier généré par `npx tsx scripts/gen-energy-docs.ts`.

| Objet | Clé | Outil maître | Description |
|---|---|---|---|
| Actif | `assetId` | referentiel | Unité de production ou de stockage (éolien, solaire, hydro, thermique, BESS, hybride). |
| Site | `siteId` | referentiel | Emplacement physique et point de raccordement. |
| Pays | `pays` | referentiel | Pays d'exploitation, zone de prix et gestionnaire de réseau. |
| Marché | `marcheId` | planification | DA, ID, aFRR, mFRR. |
| Programme | `programmeId` | planification | Engagement de production, de charge ou de décharge sur une période. |
| Consigne | `consigneId` | orchestrateur | Ordre de puissance émis par le centre ; Aura le lit, ne l'émet jamais. |
| Télémesure | `assetId+horodatage` | temps-reel | Mesure temps réel, qualité, contrôlabilité, SoC. |
| Indisponibilité | `indispoId` | indisponibilites | Indisponibilité planifiée ou fortuite, capacité restante. |
| Engagement de services système | `engagementId` | planification | Réserve aFRR/mFRR contractualisée. |
| Message REMIT (UMM) | `ummId|indispoId` | remit | Publication d'information privilégiée et échéance. |
| Centre de conduite | `centreId` | scada-pays | Centre central ou pays. |
| Opérateur | `operateurId` | journal-quart | Opérateur ou dispatcher de quart. |
| Contrat | `contratId` | referentiel | PPA, services système, tolling. |
| Lien centre–pays | `lienId` | scada-pays | Liaison de téléconduite et son mode dégradé. |
| Ordre de travail | `otId` | gmao | Maintenance et contraintes locales. |
| État batterie | `assetId` | bms | SoC, SoH, températures, alarme gaz, énergie disponible d'un stockage. |
| Ouvrage hydraulique | `ouvrageId` | hydro | Retenue, cotes, débit restitué et débit réservé. |
| Périmètre d'équilibre | `perimetreId` | equilibre | Regroupement d'actifs responsable des écarts de programme. |
| Exigence de raccordement | `assetId` | conformite-reseau | Mode de réglage de tension et réglages de protection exigés. |
| Préqualification | `assetId+produit` | conformite-reseau | Aptitude aFRR/mFRR/FCR et échéance. |
| Événement de cybersécurité OT | `evenementId` | cyber-ot | Événement de sécurité OT, qualification et échéance de notification. |

## Relations

- Actif *est situé sur* Site
- Site *est dans* Pays
- Actif *est conduit par* CentreDeConduite
- CentreDeConduite *est rattaché à* CentreDeConduite
- Operateur *est de quart dans* CentreDeConduite
- Programme *porte sur* Actif
- Programme *est placé sur* Marche
- EngagementServicesSysteme *découle de* Programme
- Consigne *s'applique à* Actif
- Consigne *met en œuvre* Programme
- Telemesure *mesure* Actif
- Indisponibilite *affecte* Actif
- Indisponibilite *impacte* EngagementServicesSysteme
- MessageREMIT *publie* Indisponibilite
- LienCentrePays *relie* CentreDeConduite
- OrdreDeTravail *contraint* Actif
- Contrat *engage* Actif
- EtatBatterie *décrit* Actif
- OuvrageHydraulique *alimente* Actif
- PerimetreEquilibre *regroupe* Actif
- ExigenceRaccordement *s'impose à* Actif
- Prequalification *autorise* EngagementServicesSysteme
- EvenementCyber *touche* LienCentrePays
