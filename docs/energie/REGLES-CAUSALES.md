# Catalogue des règles causales Énergie

> SI et données fictifs (Héliade Énergies). Aucun lien avec un opérateur réel. Fichier généré par `npx tsx scripts/gen-energy-docs.ts`.

Chaque règle compare des valeurs **lues** dans le SI ; Aura ne recalcule rien et n'émet aucune consigne. Les leviers sont des options soumises à Décider.

## E1 — Consigne émise non confirmée ou non exécutée

- **Gravité** : critique
- **SI** acquittement lu = ABSENT au-delà du délai max lu, OU écart consigne–télémesure lu > tolérance lue
- **ALORS** alerte E1 : la consigne n'est pas suivie d'effet ; question de conduite ouverte au centre
- **Données lues** : `orchestrateur.setpoints.acquittement`, `orchestrateur.setpoints.ageS`, `orchestrateur.setpoints.delaiAcquittementMaxS`, `orchestrateur.setpoints.ecartConsigneTelemesureLuMW`, `orchestrateur.setpoints.toleranceMW`
- **Objets** : Consigne, Telemesure, Actif
- **Décideur** : Dispatcher central
- **Question de décision** : Relancer par le centre pays, basculer sur un autre actif ou déclarer l'écart au programme ?
- **Leviers Décider** : Relance via le centre pays ; Report sur un autre actif du portefeuille ; Déclaration d'écart au programme ; Vérification terrain (astreinte)

## E2 — Indisponibilité en conflit avec un engagement aFRR/mFRR

- **Gravité** : critique
- **SI** puissance engagée lue > capacité disponible lue sur la période, OU conflit d'indisponibilité signalé par la planification
- **ALORS** alerte E2 : l'engagement de services système n'est plus tenable en l'état
- **Données lues** : `planification.schedules.marche`, `planification.schedules.puissanceMW`, `planification.schedules.capaciteDisponibleLueMW`, `planification.schedules.conflitIndisponibilite`, `indisponibilites.unavailabilities.engagementsImpactes`
- **Objets** : EngagementServicesSysteme, Indisponibilite, Actif
- **Décideur** : Responsable trading / services système
- **Question de décision** : Réaffecter l'engagement, l'acheter sur le marché secondaire ou notifier le gestionnaire de réseau ?
- **Leviers Décider** : Réaffectation sur un autre actif qualifié ; Rachat de capacité (marché secondaire) ; Notification au gestionnaire de réseau ; Accélération de la remise en service

## E3 — État de charge BESS incompatible avec le programme

- **Gravité** : majeure
- **SI** SoC lu < SoC requis lu par le programme de décharge, OU SoC lu > SoC requis lu par le programme de charge
- **ALORS** alerte E3 : le programme de stockage ne pourra pas être réalisé tel quel
- **Données lues** : `temps-reel.telemetry.socPct`, `planification.schedules.socRequisPct`, `planification.schedules.type`
- **Objets** : Actif, Programme, Telemesure
- **Décideur** : Responsable optimisation stockage
- **Question de décision** : Recharger avant la fenêtre, réduire le programme ou le revendre en infrajournalier ?
- **Leviers Décider** : Recharge anticipée ; Réduction du programme ; Revente en infrajournalier ; Report sur un autre stockage

## E4 — Publication UMM/REMIT en retard après indisponibilité

- **Gravité** : critique
- **SI** statut UMM lu = NON_PUBLIEE ET échéance de publication lue dépassée
- **ALORS** alerte E4 : risque de non-conformité REMIT
- **Données lues** : `remit.umm.statut`, `remit.umm.echeanceDepassee`, `remit.umm.retardLuMin`, `indisponibilites.unavailabilities.indispoId`
- **Objets** : MessageREMIT, Indisponibilite
- **Décideur** : Responsable conformité REMIT
- **Question de décision** : Publier immédiatement avec l'information disponible ou valider d'abord la durée estimée ?
- **Leviers Décider** : Publication immédiate puis mise à jour ; Validation express de la durée ; Escalade conformité

## E5 — Télémesure figée

- **Gravité** : majeure
- **SI** qualité lue = FIGEE ET durée sans variation lue > seuil de gel lu
- **ALORS** alerte E5 : la production affichée n'est plus fiable pour la conduite
- **Données lues** : `temps-reel.telemetry.qualite`, `temps-reel.telemetry.dureeSansVariationMin`, `temps-reel.telemetry.seuilGelMin`, `historian.tags.qualite`
- **Objets** : Telemesure, Actif
- **Décideur** : Chef de quart
- **Question de décision** : Basculer sur une mesure de secours, considérer l'actif non contrôlable ou envoyer une astreinte ?
- **Leviers Décider** : Mesure de secours (compteur) ; Actif déclaré non contrôlable ; Intervention astreinte télécom ; Ajustement prudent du programme

## E6 — Perte de lien centre–pays : mode dégradé

- **Gravité** : critique
- **SI** état du lien lu = DOWN OU mode dégradé lu = vrai
- **ALORS** alerte E6 : les actifs du pays ne sont plus pilotables depuis le centre
- **Données lues** : `scada-pays.links.etat`, `scada-pays.links.modeDegrade`, `scada-pays.links.actifsConcernes`, `monitoring-reseau.equipment.etat`
- **Objets** : LienCentrePays, CentreDeConduite, Actif
- **Décideur** : Responsable du centre de conduite
- **Question de décision** : Transférer la conduite au centre pays, geler les programmes concernés ou activer la redondance ?
- **Leviers Décider** : Transfert de conduite au centre pays ; Gel des programmes des actifs concernés ; Activation lien de secours ; Information du gestionnaire de réseau

## E7 — Consigne centrale contraire à une contrainte locale

- **Gravité** : majeure
- **SI** valeur de consigne lue > limite locale lue (GMAO, journal de quart)
- **ALORS** alerte E7 : la consigne centrale ne peut pas être exécutée intégralement
- **Données lues** : `orchestrateur.setpoints.valeurMW`, `orchestrateur.setpoints.limiteLocaleLueMW`, `gmao.workOrders.limiteMW`, `journal-quart.entries.texte`
- **Objets** : Consigne, OrdreDeTravail, Actif
- **Décideur** : Dispatcher central
- **Question de décision** : Aligner le programme sur la contrainte locale, lever la contrainte ou répartir sur d'autres actifs ?
- **Leviers Décider** : Alignement du programme sur la limite locale ; Levée anticipée de la contrainte (maintenance) ; Répartition sur d'autres actifs

## E8 — Écart d'identifiants d'actifs entre référentiels

- **Gravité** : mineure
- **SI** statut de rapprochement lu = ECART dans le référentiel d'actifs
- **ALORS** alerte E8 : données d'actif incohérentes entre outils (ordres de travail, télémesures, codes réseau)
- **Données lues** : `referentiel.crosswalk.statutRapprochement`, `referentiel.crosswalk.gmaoFunctionalLocation`, `gmao.workOrders.emplacement`
- **Objets** : Actif, OrdreDeTravail
- **Décideur** : Responsable données d'actifs
- **Question de décision** : Corriger la source, maintenir une correspondance ou imposer le référentiel maître ?
- **Leviers Décider** : Correction dans la GMAO ; Table de correspondance temporaire ; Gouvernance du référentiel maître
