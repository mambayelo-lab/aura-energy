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

## E9 — Activation de réserve reçue du GRT non acquittée

- **Gravité** : critique
- **Source** : Règlement (UE) 2017/2195 (EBGL) ; plateformes PICASSO / MARI
- **Options Décider** : Confirmer sur l'actif prévu / Reporter sur un autre actif qualifié / Signaler l'impossibilité au GRT
- **Indicateurs** : Âge du message lu, Délai max d'acquittement lu, Capacité disponible lue, Activations non acquittées du jour, État du lien GRT lu
- **SI** acquittement lu du message d'activation = EN_ATTENTE ET âge lu > délai max lu
- **ALORS** alerte E9 : l'activation aFRR/mFRR demandée par le gestionnaire de réseau n'est pas confirmée
- **Données lues** : `tso.messages.type`, `tso.messages.acquittement`, `tso.messages.ageS`, `tso.messages.delaiAcquittementMaxS`
- **Objets** : EngagementServicesSysteme, Actif
- **Décideur** : Dispatcher central
- **Question de décision** : Confirmer l'activation sur l'actif prévu, la reporter sur un autre actif qualifié ou signaler l'impossibilité au GRT ?
- **Leviers Décider** : Confirmation via le connecteur GRT ; Report sur un actif préqualifié du portefeuille ; Signalement d'indisponibilité au GRT ; Escalade astreinte télécom

## E10 — Énergie BESS insuffisante pour la durée de réserve engagée

- **Gravité** : critique
- **Source** : Règlement (UE) 2017/1485 (SOGL) art. 156 — réservoirs d'énergie limités
- **Options Décider** : Recharger avant la période / Réduire l'offre / Réaffecter la réserve
- **Indicateurs** : Énergie disponible lue, Énergie requise lue, SoC lu, Prix infrajournalier lu, Engagements actifs lus, Pénalités contractuelles lues
- **SI** énergie disponible lue (EMS) < énergie requise lue par l'engagement de réserve
- **ALORS** alerte E10 : la batterie ne pourra pas tenir la réserve sur la durée exigée (réservoir limité)
- **Données lues** : `bms.batteries.energieDisponibleLueMWh`, `bms.batteries.energieRequiseEngagementLueMWh`, `bms.batteries.engagement`
- **Objets** : EtatBatterie, EngagementServicesSysteme
- **Décideur** : Responsable optimisation stockage
- **Question de décision** : Recharger avant la période, réduire la puissance offerte ou réaffecter la réserve ?
- **Leviers Décider** : Recharge anticipée ; Réduction de la puissance offerte ; Réaffectation sur un autre stockage ; Rachat de la réserve

## E11 — Pré-alerte thermique ou gaz sur un stockage

- **Gravité** : critique
- **Source** : NFPA 855 ; base d'incidents BESS de l'EPRI
- **Options Décider** : Arrêt complet du stockage / Isolement du rack seul / Surveillance renforcée et intervention
- **Indicateurs** : Température cellule lue, Seuil d'alarme lu, Alarme gaz lue, SoC lu, Engagements actifs lus, Statut intervention lu
- **SI** alarme gaz lue = vrai OU température cellule max lue > seuil d'alarme lu (BMS)
- **ALORS** alerte E11 : signe précurseur possible d'emballement thermique ; question de sécurité ouverte
- **Données lues** : `bms.batteries.alarmeGaz`, `bms.batteries.tempCelluleMaxC`, `bms.batteries.seuilAlarmeTempC`, `bms.batteries.rack`
- **Objets** : EtatBatterie, Actif
- **Décideur** : Chef de quart
- **Question de décision** : Mettre le stockage à l'arrêt, isoler le rack concerné ou maintenir sous surveillance renforcée avec intervention terrain ?
- **Leviers Décider** : Mise à l'arrêt via le système de conduite local ; Isolement du rack ; Intervention terrain et pompiers informés ; Retrait des engagements de marché

## E12 — Santé batterie sous le seuil de garantie

- **Gravité** : majeure
- **Source** : Contrats de garantie BESS (bonnes pratiques O&M)
- **Options Décider** : Recours garantie / Réduire le cyclage / Augmenter la capacité
- **Indicateurs** : SoH lu, Seuil garanti lu, Cycles lus, Énergie disponible lue, Échéance de garantie lue
- **SI** SoH lu < seuil SoH garanti lu au contrat
- **ALORS** alerte E12 : dégradation au-delà de la garantie ; recours et usage à décider
- **Données lues** : `bms.batteries.sohPct`, `bms.batteries.sohSeuilGarantiePct`
- **Objets** : EtatBatterie, Contrat
- **Décideur** : Responsable actifs stockage
- **Question de décision** : Activer la garantie, réduire l'usage cyclé ou planifier une augmentation de capacité ?
- **Leviers Décider** : Recours garantie fournisseur ; Réduction du cyclage ; Augmentation de capacité (modules) ; Révision des offres de réserve

## E13 — Débit restitué sous le débit réservé

- **Gravité** : critique
- **Source** : Code de l'environnement, art. L214-18
- **Options Décider** : Rétablir le débit réservé / Vérifier la mesure d'abord / Informer l'administration
- **Indicateurs** : Débit restitué lu, Débit réservé lu, Cote lue, Programme de turbinage lu, Historique des écarts lus
- **SI** débit restitué lu < débit réservé lu (ouvrage hydraulique)
- **ALORS** alerte E13 : non-respect possible du débit minimal réglementaire
- **Données lues** : `hydro.ouvrages.debitRestitueLuM3s`, `hydro.ouvrages.debitReserveLuM3s`, `hydro.ouvrages.source`
- **Objets** : OuvrageHydraulique, Actif
- **Décideur** : Exploitant hydraulique
- **Question de décision** : Augmenter le débit restitué, vérifier la mesure ou informer le service de police de l'eau ?
- **Leviers Décider** : Ouverture de la vanne de débit réservé (local) ; Vérification de la station de mesure ; Information du service de police de l'eau ; Révision du programme de production

## E14 — Cote de retenue hors plage d'exploitation

- **Gravité** : majeure
- **Source** : Règlements d'eau et consignes d'exploitation des ouvrages
- **Options Décider** : Réduire le turbinage / Retirer l'offre / Décaler le programme
- **Indicateurs** : Cote lue, Cote min lue, Apports lus, Engagements lus, Débit restitué lu
- **SI** cote lue < cote minimale d'exploitation lue OU cote lue > cote maximale lue
- **ALORS** alerte E14 : programme hydraulique incompatible avec la retenue
- **Données lues** : `hydro.ouvrages.coteLueM`, `hydro.ouvrages.coteMinExploitationM`, `hydro.ouvrages.coteMaxM`
- **Objets** : OuvrageHydraulique, Programme
- **Décideur** : Exploitant hydraulique
- **Question de décision** : Réduire le turbinage, renoncer à l'engagement mFRR ou décaler le programme ?
- **Leviers Décider** : Réduction du turbinage ; Retrait de l'offre mFRR ; Décalage du programme ; Coordination avec l'aval

## E15 — Démarrages restants insuffisants pour le programme

- **Gravité** : majeure
- **Source** : Contrats de maintenance constructeur (heures équivalentes / démarrages)
- **Options Décider** : Regrouper les fonctionnements / Céder des périodes / Négocier l'extension
- **Indicateurs** : Démarrages lus, Quota lu, Démarrages planifiés lus, Heures équivalentes lues, Prix spot lus
- **SI** démarrages planifiés lus > démarrages restants lus (quota)
- **ALORS** alerte E15 : le programme thermique consomme plus de démarrages que le quota disponible
- **Données lues** : `thermique.unites.demarragesPlanifiesLus`, `thermique.unites.demarragesRestantsLus`, `thermique.unites.quotaDemarragesLu`
- **Objets** : Actif, Programme
- **Décideur** : Responsable exploitation thermique
- **Question de décision** : Regrouper les fonctionnements, céder des périodes ou négocier une extension du quota ?
- **Leviers Décider** : Regroupement des fonctionnements ; Cession de périodes au marché ; Négociation avec le constructeur ; Report de maintenance

## E16 — Émissions au-dessus de la valeur limite du permis

- **Gravité** : critique
- **Source** : Directive 2010/75/UE (émissions industrielles)
- **Options Décider** : Réduire la charge / Arrêter l'unité / Déclarer et poursuivre
- **Indicateurs** : NOx lu, VLE lue, Durée de dépassement lue, Charge lue, État de l'analyseur lu, Engagements lus
- **SI** émission NOx lue > valeur limite lue (permis)
- **ALORS** alerte E16 : dépassement de VLE ; conformité environnementale en jeu
- **Données lues** : `thermique.unites.noxLuMgNm3`, `thermique.unites.vleNoxMgNm3`, `thermique.unites.depassementDepuisMin`
- **Objets** : Actif
- **Décideur** : Responsable environnement
- **Question de décision** : Réduire la charge, arrêter l'unité ou déclarer l'incident à l'inspection ?
- **Leviers Décider** : Réduction de charge ; Arrêt de l'unité ; Déclaration à l'inspection ; Vérification de l'analyseur

## E17 — Écart de périmètre d'équilibre au-delà du seuil

- **Gravité** : majeure
- **Source** : Règlement (UE) 2017/2195 (EBGL), règlement des écarts
- **Options Décider** : Rééquilibrer en infrajournalier / Mobiliser la flexibilité interne / Accepter l'écart
- **Indicateurs** : Écart lu, Seuil lu, Prix de déséquilibre lu, Prix infrajournalier lu, Flexibilité disponible lue
- **SI** |écart lu| > seuil interne lu sur la période (signe fourni par l'outil)
- **ALORS** alerte E17 : exposition au prix de déséquilibre
- **Données lues** : `equilibre.perimetres.ecartLuMWh`, `equilibre.perimetres.seuilInterneMWh`, `equilibre.perimetres.prixDesequilibreLuEurMWh`
- **Objets** : PerimetreEquilibre, Programme
- **Décideur** : Responsable trading
- **Question de décision** : Rééquilibrer en infrajournalier, mobiliser la flexibilité interne ou accepter l'écart ?
- **Leviers Décider** : Achat/vente infrajournalier ; Mobilisation d'un stockage ; Modulation d'un actif pilotable ; Acceptation documentée

## E18 — Production sous le productible attendu

- **Gravité** : majeure
- **Source** : Bonnes pratiques O&M (pertes, curtailment, qualité SCADA)
- **Options Décider** : Intervenir en priorité / Réviser le programme / Réclamer au prestataire
- **Indicateurs** : Écart lu, Tolérance lue, Cause probable lue, Disponibilité lue, Ordres de travail lus, Programme lu
- **SI** écart lu production/productible < −tolérance lue (outil de performance)
- **ALORS** alerte E18 : perte de production à expliquer (pannes, écrêtement, salissure)
- **Données lues** : `performance.actifs.ecartLuPct`, `performance.actifs.tolerancePct`, `performance.actifs.causeProbableLue`
- **Objets** : Actif
- **Décideur** : Responsable performance O&M
- **Question de décision** : Dépêcher une intervention, réviser le programme ou ouvrir une réclamation fournisseur ?
- **Leviers Décider** : Intervention corrective ; Révision du programme ; Réclamation O&M ; Analyse SCADA approfondie

## E19 — Disponibilité contractuelle sous le niveau garanti

- **Gravité** : majeure
- **Source** : IEC 61400-26-1 (disponibilité)
- **Options Décider** : Pénalités / Plan d'action / Renégociation
- **Indicateurs** : Disponibilité lue, Garantie lue, Indisponibilités lues, Ordres de travail lus, Pertes lues
- **SI** disponibilité lue (IEC 61400-26, fournie par l'outil) < disponibilité garantie lue
- **ALORS** alerte E19 : garantie de disponibilité du contrat O&M en défaut
- **Données lues** : `performance.actifs.disponibiliteLuePct`, `performance.actifs.disponibiliteGarantiePct`
- **Objets** : Actif, Contrat
- **Décideur** : Responsable contrats O&M
- **Question de décision** : Appliquer les pénalités, exiger un plan d'action ou renégocier le contrat ?
- **Leviers Décider** : Application des pénalités ; Plan d'action prestataire ; Renégociation ; Internalisation partielle

## E20 — Mode de réglage de tension non conforme à l'exigence

- **Gravité** : critique
- **Source** : Règlement (UE) 2016/631 (NC RfG) ; rapport ENTSO-E sur l'incident du 28 avril 2025
- **Options Décider** : Basculer maintenant / Planifier la mise à jour / Demander une dérogation
- **Indicateurs** : Mode lu, Mode exigé lu, Tension lue au point de livraison, Réactif lu, Échéance GRT lue
- **SI** mode de tension lu ≠ mode exigé lu (ex. facteur de puissance fixe au lieu de régulation de tension)
- **ALORS** alerte E20 : contribution à la tenue de tension absente (retour d'expérience black-out ibérique)
- **Données lues** : `conformite-reseau.raccordements.modeTensionLu`, `conformite-reseau.raccordements.modeTensionExigeLu`
- **Objets** : ExigenceRaccordement, Actif
- **Décideur** : Responsable conformité raccordement
- **Question de décision** : Basculer en régulation de tension, demander une dérogation ou planifier la mise à jour du contrôleur ?
- **Leviers Décider** : Paramétrage du contrôleur de centrale ; Demande au GRT ; Mise à jour planifiée ; Essais de conformité

## E21 — Protection de surtension réglée sous le seuil du code de réseau

- **Gravité** : critique
- **Source** : Règlement (UE) 2016/631 (NC RfG) ; rapport ENTSO-E sur l'incident du 28 avril 2025
- **Options Décider** : Corriger le réglage / Vérifier d'abord / Campagne parc
- **Indicateurs** : Réglage lu, Seuil lu, Déclenchements lus, Date dernier essai lue, Actifs de même modèle lus
- **SI** réglage de protection lu < seuil lu du code de réseau
- **ALORS** alerte E21 : risque de déclenchement prématuré lors d'une surtension
- **Données lues** : `conformite-reseau.raccordements.protectionSurtensionLuePu`, `conformite-reseau.raccordements.seuilCodeReseauPu`
- **Objets** : ExigenceRaccordement, Actif
- **Décideur** : Responsable conformité raccordement
- **Question de décision** : Corriger le réglage, faire valider par le GRT ou vérifier la donnée de réglage ?
- **Leviers Décider** : Correction du réglage (intervention qualifiée) ; Validation GRT ; Vérification du plan de protection ; Campagne sur le parc

## E22 — Événement de cybersécurité OT non qualifié

- **Gravité** : critique
- **Source** : Directive (UE) 2022/2555 (NIS2) art. 23 ; IEC 62443
- **Options Décider** : Isoler et notifier / Qualifier d'abord / Notifier sans isoler
- **Indicateurs** : Gravité lue, Statut lu, Échéance lue, Actifs derrière la passerelle lus, Comptes actifs lus, Mode dégradé lu
- **SI** événement OT lu de gravité HAUTE ET statut lu = NON_QUALIFIE (échéance de notification lue)
- **ALORS** alerte E22 : incident potentiellement significatif ; échéance NIS2 d'alerte précoce à tenir
- **Données lues** : `cyber-ot.evenements.gravite`, `cyber-ot.evenements.statut`, `cyber-ot.evenements.echeanceAlertePrecoce`, `cyber-ot.evenements.alertePrecoceEnvoyee`
- **Objets** : EvenementCyber, LienCentrePays
- **Décideur** : Responsable cybersécurité OT
- **Question de décision** : Isoler la passerelle, qualifier l'événement d'abord ou notifier à titre préventif ?
- **Leviers Décider** : Isolement de la passerelle (bascule secours) ; Qualification par l'équipe SOC ; Alerte précoce à l'autorité ; Révocation du compte

## E23 — Préqualification expirée avec engagement actif

- **Gravité** : majeure
- **Source** : Règlement (UE) 2017/1485 (SOGL) art. 158–159 (préqualification FRR)
- **Options Décider** : Retirer / Requalifier / Réaffecter
- **Indicateurs** : Statut lu, Échéance lue, Engagements lus, Actifs préqualifiés lus, Pénalités lues
- **SI** statut de préqualification lu = EXPIREE ET engagement actif lu sur le même produit
- **ALORS** alerte E23 : réserve fournie hors préqualification valide
- **Données lues** : `conformite-reseau.prequalifications.statut`, `conformite-reseau.prequalifications.echeanceDepassee`, `conformite-reseau.prequalifications.engagementActif`
- **Objets** : Prequalification, EngagementServicesSysteme
- **Décideur** : Responsable trading / services système
- **Question de décision** : Retirer l'engagement, demander une requalification express ou réaffecter ?
- **Leviers Décider** : Retrait de l'engagement ; Requalification express ; Réaffectation ; Information du GRT
