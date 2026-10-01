// Catalogue de règles causales Énergie (SI … ALORS …).
// Principe Aura : AUCUN calcul. Chaque règle compare des valeurs LUES dans le SI
// (écarts, statuts, échéances, seuils fournis par l'outil source) et ouvre une
// alerte. Aucune règle n'émet de consigne : la sortie est une question de décision.
import type { HeliadeSnapshot } from "./heliade";

export type Gravite = "critique" | "majeure" | "mineure";

export type EnergyRule = {
  id: string;
  label: string;
  si: string;
  alors: string;
  donneesLues: string[]; // outil.objet.champ
  objets: string[]; // objets d'ontologie concernés
  gravite: Gravite;
  decisionQuestion: string;
  leviers: string[]; // leviers proposés à Décider (options, jamais des consignes)
  decideur: string;
  options?: string[]; // 2–4 options comparées qualitativement dans Décider
  indicateurs?: string[]; // 5–8 indicateurs lus pour suivre la décision
  reference?: string; // source réglementaire / retour d'expérience
};

export type EnergyAlert = {
  ruleId: string;
  label: string;
  gravite: Gravite;
  objet: string; // identifiant SI concerné
  valeursLues: Record<string, string | number | boolean | null>;
  source: string; // enregistrement SI cité
  decisionQuestion: string;
  leviers: string[];
};

export const ENERGY_RULES: EnergyRule[] = [
  { id: "E1", label: "Consigne émise non confirmée ou non exécutée", gravite: "critique",
    si: "acquittement lu = ABSENT au-delà du délai max lu, OU écart consigne–télémesure lu > tolérance lue",
    alors: "alerte E1 : la consigne n'est pas suivie d'effet ; question de conduite ouverte au centre",
    donneesLues: ["orchestrateur.setpoints.acquittement", "orchestrateur.setpoints.ageS", "orchestrateur.setpoints.delaiAcquittementMaxS", "orchestrateur.setpoints.ecartConsigneTelemesureLuMW", "orchestrateur.setpoints.toleranceMW"],
    objets: ["Consigne", "Telemesure", "Actif"], decideur: "Dispatcher central",
    decisionQuestion: "Relancer par le centre pays, basculer sur un autre actif ou déclarer l'écart au programme ?",
    leviers: ["Relance via le centre pays", "Report sur un autre actif du portefeuille", "Déclaration d'écart au programme", "Vérification terrain (astreinte)"] },
  { id: "E2", label: "Indisponibilité en conflit avec un engagement aFRR/mFRR", gravite: "critique",
    si: "puissance engagée lue > capacité disponible lue sur la période, OU conflit d'indisponibilité signalé par la planification",
    alors: "alerte E2 : l'engagement de services système n'est plus tenable en l'état",
    donneesLues: ["planification.schedules.marche", "planification.schedules.puissanceMW", "planification.schedules.capaciteDisponibleLueMW", "planification.schedules.conflitIndisponibilite", "indisponibilites.unavailabilities.engagementsImpactes"],
    objets: ["EngagementServicesSysteme", "Indisponibilite", "Actif"], decideur: "Responsable trading / services système",
    decisionQuestion: "Réaffecter l'engagement, l'acheter sur le marché secondaire ou notifier le gestionnaire de réseau ?",
    leviers: ["Réaffectation sur un autre actif qualifié", "Rachat de capacité (marché secondaire)", "Notification au gestionnaire de réseau", "Accélération de la remise en service"] },
  { id: "E3", label: "État de charge BESS incompatible avec le programme", gravite: "majeure",
    si: "SoC lu < SoC requis lu par le programme de décharge, OU SoC lu > SoC requis lu par le programme de charge",
    alors: "alerte E3 : le programme de stockage ne pourra pas être réalisé tel quel",
    donneesLues: ["temps-reel.telemetry.socPct", "planification.schedules.socRequisPct", "planification.schedules.type"],
    objets: ["Actif", "Programme", "Telemesure"], decideur: "Responsable optimisation stockage",
    decisionQuestion: "Recharger avant la fenêtre, réduire le programme ou le revendre en infrajournalier ?",
    leviers: ["Recharge anticipée", "Réduction du programme", "Revente en infrajournalier", "Report sur un autre stockage"] },
  { id: "E4", label: "Publication UMM/REMIT en retard après indisponibilité", gravite: "critique",
    si: "statut UMM lu = NON_PUBLIEE ET échéance de publication lue dépassée",
    alors: "alerte E4 : risque de non-conformité REMIT",
    donneesLues: ["remit.umm.statut", "remit.umm.echeanceDepassee", "remit.umm.retardLuMin", "indisponibilites.unavailabilities.indispoId"],
    objets: ["MessageREMIT", "Indisponibilite"], decideur: "Responsable conformité REMIT",
    decisionQuestion: "Publier immédiatement avec l'information disponible ou valider d'abord la durée estimée ?",
    leviers: ["Publication immédiate puis mise à jour", "Validation express de la durée", "Escalade conformité"] },
  { id: "E5", label: "Télémesure figée", gravite: "majeure",
    si: "qualité lue = FIGEE ET durée sans variation lue > seuil de gel lu",
    alors: "alerte E5 : la production affichée n'est plus fiable pour la conduite",
    donneesLues: ["temps-reel.telemetry.qualite", "temps-reel.telemetry.dureeSansVariationMin", "temps-reel.telemetry.seuilGelMin", "historian.tags.qualite"],
    objets: ["Telemesure", "Actif"], decideur: "Chef de quart",
    decisionQuestion: "Basculer sur une mesure de secours, considérer l'actif non contrôlable ou envoyer une astreinte ?",
    leviers: ["Mesure de secours (compteur)", "Actif déclaré non contrôlable", "Intervention astreinte télécom", "Ajustement prudent du programme"] },
  { id: "E6", label: "Perte de lien centre–pays : mode dégradé", gravite: "critique",
    si: "état du lien lu = DOWN OU mode dégradé lu = vrai",
    alors: "alerte E6 : les actifs du pays ne sont plus pilotables depuis le centre",
    donneesLues: ["scada-pays.links.etat", "scada-pays.links.modeDegrade", "scada-pays.links.actifsConcernes", "monitoring-reseau.equipment.etat"],
    objets: ["LienCentrePays", "CentreDeConduite", "Actif"], decideur: "Responsable du centre de conduite",
    decisionQuestion: "Transférer la conduite au centre pays, geler les programmes concernés ou activer la redondance ?",
    leviers: ["Transfert de conduite au centre pays", "Gel des programmes des actifs concernés", "Activation lien de secours", "Information du gestionnaire de réseau"] },
  { id: "E7", label: "Consigne centrale contraire à une contrainte locale", gravite: "majeure",
    si: "valeur de consigne lue > limite locale lue (GMAO, journal de quart)",
    alors: "alerte E7 : la consigne centrale ne peut pas être exécutée intégralement",
    donneesLues: ["orchestrateur.setpoints.valeurMW", "orchestrateur.setpoints.limiteLocaleLueMW", "gmao.workOrders.limiteMW", "journal-quart.entries.texte"],
    objets: ["Consigne", "OrdreDeTravail", "Actif"], decideur: "Dispatcher central",
    decisionQuestion: "Aligner le programme sur la contrainte locale, lever la contrainte ou répartir sur d'autres actifs ?",
    leviers: ["Alignement du programme sur la limite locale", "Levée anticipée de la contrainte (maintenance)", "Répartition sur d'autres actifs"] },
  { id: "E8", label: "Écart d'identifiants d'actifs entre référentiels", gravite: "mineure",
    si: "statut de rapprochement lu = ECART dans le référentiel d'actifs",
    alors: "alerte E8 : données d'actif incohérentes entre outils (ordres de travail, télémesures, codes réseau)",
    donneesLues: ["referentiel.crosswalk.statutRapprochement", "referentiel.crosswalk.gmaoFunctionalLocation", "gmao.workOrders.emplacement"],
    objets: ["Actif", "OrdreDeTravail"], decideur: "Responsable données d'actifs",
    decisionQuestion: "Corriger la source, maintenir une correspondance ou imposer le référentiel maître ?",
    leviers: ["Correction dans la GMAO", "Table de correspondance temporaire", "Gouvernance du référentiel maître"] },
];


const R = (id: string, label: string, gravite: Gravite, si: string, alors: string, donneesLues: string[], objets: string[], decideur: string, decisionQuestion: string, leviers: string[], options: string[], indicateurs: string[], reference: string): EnergyRule =>
  ({ id, label, gravite, si, alors, donneesLues, objets, decideur, decisionQuestion, leviers, options, indicateurs, reference });

/** Règles E9–E23 (catalogue docs/energie/CATALOGUE-REGLES-ENERGIE.md). */
export const ENERGY_RULES_EXT: EnergyRule[] = [
  R("E9", "Activation de réserve reçue du GRT non acquittée", "critique",
    "acquittement lu du message d'activation = EN_ATTENTE ET âge lu > délai max lu",
    "alerte E9 : l'activation aFRR/mFRR demandée par le gestionnaire de réseau n'est pas confirmée",
    ["tso.messages.type", "tso.messages.acquittement", "tso.messages.ageS", "tso.messages.delaiAcquittementMaxS"], ["EngagementServicesSysteme", "Actif"], "Dispatcher central",
    "Confirmer l'activation sur l'actif prévu, la reporter sur un autre actif qualifié ou signaler l'impossibilité au GRT ?",
    ["Confirmation via le connecteur GRT", "Report sur un actif préqualifié du portefeuille", "Signalement d'indisponibilité au GRT", "Escalade astreinte télécom"],
    ["Confirmer sur l'actif prévu", "Reporter sur un autre actif qualifié", "Signaler l'impossibilité au GRT"],
    ["Âge du message lu", "Délai max d'acquittement lu", "Capacité disponible lue", "Activations non acquittées du jour", "État du lien GRT lu"],
    "Règlement (UE) 2017/2195 (EBGL) ; plateformes PICASSO / MARI"),
  R("E10", "Énergie BESS insuffisante pour la durée de réserve engagée", "critique",
    "énergie disponible lue (EMS) < énergie requise lue par l'engagement de réserve",
    "alerte E10 : la batterie ne pourra pas tenir la réserve sur la durée exigée (réservoir limité)",
    ["bms.batteries.energieDisponibleLueMWh", "bms.batteries.energieRequiseEngagementLueMWh", "bms.batteries.engagement"], ["EtatBatterie", "EngagementServicesSysteme"], "Responsable optimisation stockage",
    "Recharger avant la période, réduire la puissance offerte ou réaffecter la réserve ?",
    ["Recharge anticipée", "Réduction de la puissance offerte", "Réaffectation sur un autre stockage", "Rachat de la réserve"],
    ["Recharger avant la période", "Réduire l'offre", "Réaffecter la réserve"],
    ["Énergie disponible lue", "Énergie requise lue", "SoC lu", "Prix infrajournalier lu", "Engagements actifs lus", "Pénalités contractuelles lues"],
    "Règlement (UE) 2017/1485 (SOGL) art. 156 — réservoirs d'énergie limités"),
  R("E11", "Pré-alerte thermique ou gaz sur un stockage", "critique",
    "alarme gaz lue = vrai OU température cellule max lue > seuil d'alarme lu (BMS)",
    "alerte E11 : signe précurseur possible d'emballement thermique ; question de sécurité ouverte",
    ["bms.batteries.alarmeGaz", "bms.batteries.tempCelluleMaxC", "bms.batteries.seuilAlarmeTempC", "bms.batteries.rack"], ["EtatBatterie", "Actif"], "Chef de quart",
    "Mettre le stockage à l'arrêt, isoler le rack concerné ou maintenir sous surveillance renforcée avec intervention terrain ?",
    ["Mise à l'arrêt via le système de conduite local", "Isolement du rack", "Intervention terrain et pompiers informés", "Retrait des engagements de marché"],
    ["Arrêt complet du stockage", "Isolement du rack seul", "Surveillance renforcée et intervention"],
    ["Température cellule lue", "Seuil d'alarme lu", "Alarme gaz lue", "SoC lu", "Engagements actifs lus", "Statut intervention lu"],
    "NFPA 855 ; base d'incidents BESS de l'EPRI"),
  R("E12", "Santé batterie sous le seuil de garantie", "majeure",
    "SoH lu < seuil SoH garanti lu au contrat",
    "alerte E12 : dégradation au-delà de la garantie ; recours et usage à décider",
    ["bms.batteries.sohPct", "bms.batteries.sohSeuilGarantiePct"], ["EtatBatterie", "Contrat"], "Responsable actifs stockage",
    "Activer la garantie, réduire l'usage cyclé ou planifier une augmentation de capacité ?",
    ["Recours garantie fournisseur", "Réduction du cyclage", "Augmentation de capacité (modules)", "Révision des offres de réserve"],
    ["Recours garantie", "Réduire le cyclage", "Augmenter la capacité"],
    ["SoH lu", "Seuil garanti lu", "Cycles lus", "Énergie disponible lue", "Échéance de garantie lue"],
    "Contrats de garantie BESS (bonnes pratiques O&M)"),
  R("E13", "Débit restitué sous le débit réservé", "critique",
    "débit restitué lu < débit réservé lu (ouvrage hydraulique)",
    "alerte E13 : non-respect possible du débit minimal réglementaire",
    ["hydro.ouvrages.debitRestitueLuM3s", "hydro.ouvrages.debitReserveLuM3s", "hydro.ouvrages.source"], ["OuvrageHydraulique", "Actif"], "Exploitant hydraulique",
    "Augmenter le débit restitué, vérifier la mesure ou informer le service de police de l'eau ?",
    ["Ouverture de la vanne de débit réservé (local)", "Vérification de la station de mesure", "Information du service de police de l'eau", "Révision du programme de production"],
    ["Rétablir le débit réservé", "Vérifier la mesure d'abord", "Informer l'administration"],
    ["Débit restitué lu", "Débit réservé lu", "Cote lue", "Programme de turbinage lu", "Historique des écarts lus"],
    "Code de l'environnement, art. L214-18"),
  R("E14", "Cote de retenue hors plage d'exploitation", "majeure",
    "cote lue < cote minimale d'exploitation lue OU cote lue > cote maximale lue",
    "alerte E14 : programme hydraulique incompatible avec la retenue",
    ["hydro.ouvrages.coteLueM", "hydro.ouvrages.coteMinExploitationM", "hydro.ouvrages.coteMaxM"], ["OuvrageHydraulique", "Programme"], "Exploitant hydraulique",
    "Réduire le turbinage, renoncer à l'engagement mFRR ou décaler le programme ?",
    ["Réduction du turbinage", "Retrait de l'offre mFRR", "Décalage du programme", "Coordination avec l'aval"],
    ["Réduire le turbinage", "Retirer l'offre", "Décaler le programme"],
    ["Cote lue", "Cote min lue", "Apports lus", "Engagements lus", "Débit restitué lu"],
    "Règlements d'eau et consignes d'exploitation des ouvrages"),
  R("E15", "Démarrages restants insuffisants pour le programme", "majeure",
    "démarrages planifiés lus > démarrages restants lus (quota)",
    "alerte E15 : le programme thermique consomme plus de démarrages que le quota disponible",
    ["thermique.unites.demarragesPlanifiesLus", "thermique.unites.demarragesRestantsLus", "thermique.unites.quotaDemarragesLu"], ["Actif", "Programme"], "Responsable exploitation thermique",
    "Regrouper les fonctionnements, céder des périodes ou négocier une extension du quota ?",
    ["Regroupement des fonctionnements", "Cession de périodes au marché", "Négociation avec le constructeur", "Report de maintenance"],
    ["Regrouper les fonctionnements", "Céder des périodes", "Négocier l'extension"],
    ["Démarrages lus", "Quota lu", "Démarrages planifiés lus", "Heures équivalentes lues", "Prix spot lus"],
    "Contrats de maintenance constructeur (heures équivalentes / démarrages)"),
  R("E16", "Émissions au-dessus de la valeur limite du permis", "critique",
    "émission NOx lue > valeur limite lue (permis)",
    "alerte E16 : dépassement de VLE ; conformité environnementale en jeu",
    ["thermique.unites.noxLuMgNm3", "thermique.unites.vleNoxMgNm3", "thermique.unites.depassementDepuisMin"], ["Actif"], "Responsable environnement",
    "Réduire la charge, arrêter l'unité ou déclarer l'incident à l'inspection ?",
    ["Réduction de charge", "Arrêt de l'unité", "Déclaration à l'inspection", "Vérification de l'analyseur"],
    ["Réduire la charge", "Arrêter l'unité", "Déclarer et poursuivre"],
    ["NOx lu", "VLE lue", "Durée de dépassement lue", "Charge lue", "État de l'analyseur lu", "Engagements lus"],
    "Directive 2010/75/UE (émissions industrielles)"),
  R("E17", "Écart de périmètre d'équilibre au-delà du seuil", "majeure",
    "|écart lu| > seuil interne lu sur la période (signe fourni par l'outil)",
    "alerte E17 : exposition au prix de déséquilibre",
    ["equilibre.perimetres.ecartLuMWh", "equilibre.perimetres.seuilInterneMWh", "equilibre.perimetres.prixDesequilibreLuEurMWh"], ["PerimetreEquilibre", "Programme"], "Responsable trading",
    "Rééquilibrer en infrajournalier, mobiliser la flexibilité interne ou accepter l'écart ?",
    ["Achat/vente infrajournalier", "Mobilisation d'un stockage", "Modulation d'un actif pilotable", "Acceptation documentée"],
    ["Rééquilibrer en infrajournalier", "Mobiliser la flexibilité interne", "Accepter l'écart"],
    ["Écart lu", "Seuil lu", "Prix de déséquilibre lu", "Prix infrajournalier lu", "Flexibilité disponible lue"],
    "Règlement (UE) 2017/2195 (EBGL), règlement des écarts"),
  R("E18", "Production sous le productible attendu", "majeure",
    "écart lu production/productible < −tolérance lue (outil de performance)",
    "alerte E18 : perte de production à expliquer (pannes, écrêtement, salissure)",
    ["performance.actifs.ecartLuPct", "performance.actifs.tolerancePct", "performance.actifs.causeProbableLue"], ["Actif"], "Responsable performance O&M",
    "Dépêcher une intervention, réviser le programme ou ouvrir une réclamation fournisseur ?",
    ["Intervention corrective", "Révision du programme", "Réclamation O&M", "Analyse SCADA approfondie"],
    ["Intervenir en priorité", "Réviser le programme", "Réclamer au prestataire"],
    ["Écart lu", "Tolérance lue", "Cause probable lue", "Disponibilité lue", "Ordres de travail lus", "Programme lu"],
    "Bonnes pratiques O&M (pertes, curtailment, qualité SCADA)"),
  R("E19", "Disponibilité contractuelle sous le niveau garanti", "majeure",
    "disponibilité lue (IEC 61400-26, fournie par l'outil) < disponibilité garantie lue",
    "alerte E19 : garantie de disponibilité du contrat O&M en défaut",
    ["performance.actifs.disponibiliteLuePct", "performance.actifs.disponibiliteGarantiePct"], ["Actif", "Contrat"], "Responsable contrats O&M",
    "Appliquer les pénalités, exiger un plan d'action ou renégocier le contrat ?",
    ["Application des pénalités", "Plan d'action prestataire", "Renégociation", "Internalisation partielle"],
    ["Pénalités", "Plan d'action", "Renégociation"],
    ["Disponibilité lue", "Garantie lue", "Indisponibilités lues", "Ordres de travail lus", "Pertes lues"],
    "IEC 61400-26-1 (disponibilité)"),
  R("E20", "Mode de réglage de tension non conforme à l'exigence", "critique",
    "mode de tension lu ≠ mode exigé lu (ex. facteur de puissance fixe au lieu de régulation de tension)",
    "alerte E20 : contribution à la tenue de tension absente (retour d'expérience black-out ibérique)",
    ["conformite-reseau.raccordements.modeTensionLu", "conformite-reseau.raccordements.modeTensionExigeLu"], ["ExigenceRaccordement", "Actif"], "Responsable conformité raccordement",
    "Basculer en régulation de tension, demander une dérogation ou planifier la mise à jour du contrôleur ?",
    ["Paramétrage du contrôleur de centrale", "Demande au GRT", "Mise à jour planifiée", "Essais de conformité"],
    ["Basculer maintenant", "Planifier la mise à jour", "Demander une dérogation"],
    ["Mode lu", "Mode exigé lu", "Tension lue au point de livraison", "Réactif lu", "Échéance GRT lue"],
    "Règlement (UE) 2016/631 (NC RfG) ; rapport ENTSO-E sur l'incident du 28 avril 2025"),
  R("E21", "Protection de surtension réglée sous le seuil du code de réseau", "critique",
    "réglage de protection lu < seuil lu du code de réseau",
    "alerte E21 : risque de déclenchement prématuré lors d'une surtension",
    ["conformite-reseau.raccordements.protectionSurtensionLuePu", "conformite-reseau.raccordements.seuilCodeReseauPu"], ["ExigenceRaccordement", "Actif"], "Responsable conformité raccordement",
    "Corriger le réglage, faire valider par le GRT ou vérifier la donnée de réglage ?",
    ["Correction du réglage (intervention qualifiée)", "Validation GRT", "Vérification du plan de protection", "Campagne sur le parc"],
    ["Corriger le réglage", "Vérifier d'abord", "Campagne parc"],
    ["Réglage lu", "Seuil lu", "Déclenchements lus", "Date dernier essai lue", "Actifs de même modèle lus"],
    "Règlement (UE) 2016/631 (NC RfG) ; rapport ENTSO-E sur l'incident du 28 avril 2025"),
  R("E22", "Événement de cybersécurité OT non qualifié", "critique",
    "événement OT lu de gravité HAUTE ET statut lu = NON_QUALIFIE (échéance de notification lue)",
    "alerte E22 : incident potentiellement significatif ; échéance NIS2 d'alerte précoce à tenir",
    ["cyber-ot.evenements.gravite", "cyber-ot.evenements.statut", "cyber-ot.evenements.echeanceAlertePrecoce", "cyber-ot.evenements.alertePrecoceEnvoyee"], ["EvenementCyber", "LienCentrePays"], "Responsable cybersécurité OT",
    "Isoler la passerelle, qualifier l'événement d'abord ou notifier à titre préventif ?",
    ["Isolement de la passerelle (bascule secours)", "Qualification par l'équipe SOC", "Alerte précoce à l'autorité", "Révocation du compte"],
    ["Isoler et notifier", "Qualifier d'abord", "Notifier sans isoler"],
    ["Gravité lue", "Statut lu", "Échéance lue", "Actifs derrière la passerelle lus", "Comptes actifs lus", "Mode dégradé lu"],
    "Directive (UE) 2022/2555 (NIS2) art. 23 ; IEC 62443"),
  R("E23", "Préqualification expirée avec engagement actif", "majeure",
    "statut de préqualification lu = EXPIREE ET engagement actif lu sur le même produit",
    "alerte E23 : réserve fournie hors préqualification valide",
    ["conformite-reseau.prequalifications.statut", "conformite-reseau.prequalifications.echeanceDepassee", "conformite-reseau.prequalifications.engagementActif"], ["Prequalification", "EngagementServicesSysteme"], "Responsable trading / services système",
    "Retirer l'engagement, demander une requalification express ou réaffecter ?",
    ["Retrait de l'engagement", "Requalification express", "Réaffectation", "Information du GRT"],
    ["Retirer", "Requalifier", "Réaffecter"],
    ["Statut lu", "Échéance lue", "Engagements lus", "Actifs préqualifiés lus", "Pénalités lues"],
    "Règlement (UE) 2017/1485 (SOGL) art. 158–159 (préqualification FRR)"),
];
ENERGY_RULES.push(...ENERGY_RULES_EXT);

/** Évalue les règles sur les valeurs lues. Comparaisons uniquement. */
export function evaluateEnergyRules(s: HeliadeSnapshot): EnergyAlert[] {
  const out: EnergyAlert[] = [];
  const rule = (id: string) => ENERGY_RULES.find(r => r.id === id)!;
  const push = (id: string, objet: string, valeursLues: EnergyAlert["valeursLues"], source: string) => {
    const r = rule(id);
    out.push({ ruleId: id, label: r.label, gravite: r.gravite, objet, valeursLues, source, decisionQuestion: r.decisionQuestion, leviers: r.leviers });
  };

  for (const c of s.orchestrateur.setpoints) {
    const sansAck = c.acquittement === "ABSENT" && c.ageS > c.delaiAcquittementMaxS;
    const horsTol = c.ecartConsigneTelemesureLuMW > c.toleranceMW;
    if (sansAck || (horsTol && c.limiteLocaleLueMW == null)) push("E1", c.consigneId, { actif: c.assetId, acquittement: c.acquittement, ecartLuMW: c.ecartConsigneTelemesureLuMW, toleranceMW: c.toleranceMW }, `orchestrateur — ${c.consigneId}`);
    if (c.limiteLocaleLueMW != null && c.valeurMW > c.limiteLocaleLueMW) push("E7", c.consigneId, { actif: c.assetId, consigneMW: c.valeurMW, limiteLocaleMW: c.limiteLocaleLueMW, source: c.sourceLimiteLocale ?? null }, `orchestrateur — ${c.consigneId}`);
  }
  for (const p of s.planification.schedules) {
    if ((p.marche === "aFRR" || p.marche === "mFRR") && (p.conflitIndisponibilite || (p.capaciteDisponibleLueMW != null && p.puissanceMW > p.capaciteDisponibleLueMW)))
      push("E2", p.programmeId, { actif: p.assetId, marche: p.marche, engageMW: p.puissanceMW, disponibleLueMW: p.capaciteDisponibleLueMW ?? null, indisponibilite: p.conflitIndisponibilite ?? null }, `planification — ${p.programmeId}`);
    if (p.socRequisPct != null) {
      const t = s["temps-reel"].telemetry.find(x => x.assetId === p.assetId);
      if (t?.socPct != null && ((p.type === "decharge" && t.socPct < p.socRequisPct) || (p.type === "charge" && t.socPct > p.socRequisPct)))
        push("E3", p.programmeId, { actif: p.assetId, type: p.type ?? null, socLuPct: t.socPct, socRequisPct: p.socRequisPct }, `planification — ${p.programmeId} ; temps-reel — ${p.assetId}`);
    }
  }
  for (const u of s.remit.umm) if (u.statut === "NON_PUBLIEE" && u.echeanceDepassee)
    push("E4", u.indispoId, { actif: u.assetId, statut: u.statut, retardLuMin: u.retardLuMin, echeance: u.echeancePublication }, `remit — UMM de ${u.indispoId}`);
  for (const t of s["temps-reel"].telemetry) if (t.qualite === "FIGEE" && t.seuilGelMin != null && (t.dureeSansVariationMin ?? 0) > t.seuilGelMin)
    push("E5", t.assetId, { qualite: t.qualite, dureeSansVariationMin: t.dureeSansVariationMin ?? null, seuilGelMin: t.seuilGelMin ?? null }, `temps-reel — ${t.assetId}`);
  for (const l of s["scada-pays"].links) if (l.etat === "DOWN" || l.modeDegrade)
    push("E6", l.lienId, { pays: l.pays, etat: l.etat, modeDegrade: l.modeDegrade, actifs: (l.actifsConcernes ?? []).join(", ") }, `scada-pays — ${l.lienId}`);
  for (const x of s.referentiel.crosswalk) if (x.statutRapprochement === "ECART")
    push("E8", x.assetId, { gmao: x.gmaoFunctionalLocation, statut: x.statutRapprochement }, `referentiel — correspondance ${x.assetId}`);

  const x = s as unknown as Record<string, Record<string, Record<string, unknown>[] | undefined> | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (tool: string, key: string) => (x[tool]?.[key] ?? []) as Record<string, any>[];
  for (const m of list("tso", "messages")) if (m.acquittement === "EN_ATTENTE" && m.delaiAcquittementMaxS != null && m.ageS > m.delaiAcquittementMaxS)
    push("E9", m.messageId, { type: m.type, ressource: m.resourceCode, acquittement: m.acquittement, ageS: m.ageS, delaiMaxS: m.delaiAcquittementMaxS }, `tso — ${m.messageId}`);
  for (const b of list("bms", "batteries")) {
    if (b.energieRequiseEngagementLueMWh != null && b.energieDisponibleLueMWh < b.energieRequiseEngagementLueMWh)
      push("E10", b.assetId, { disponibleLueMWh: b.energieDisponibleLueMWh, requiseLueMWh: b.energieRequiseEngagementLueMWh, engagement: b.engagement ?? null }, `bms — ${b.assetId}`);
    if (b.alarmeGaz === true || b.tempCelluleMaxC > b.seuilAlarmeTempC)
      push("E11", b.assetId, { alarmeGaz: b.alarmeGaz, tempCelluleMaxC: b.tempCelluleMaxC, seuilC: b.seuilAlarmeTempC, rack: b.rack ?? null }, `bms — ${b.assetId}`);
    if (b.sohPct < b.sohSeuilGarantiePct) push("E12", b.assetId, { sohLuPct: b.sohPct, seuilGarantiePct: b.sohSeuilGarantiePct }, `bms — ${b.assetId}`);
  }
  for (const o of list("hydro", "ouvrages")) {
    if (o.debitRestitueLuM3s < o.debitReserveLuM3s) push("E13", o.ouvrageId, { actif: o.assetId, debitRestitueLuM3s: o.debitRestitueLuM3s, debitReserveLuM3s: o.debitReserveLuM3s }, `hydro — ${o.ouvrageId}`);
    if (o.coteLueM < o.coteMinExploitationM || o.coteLueM > o.coteMaxM) push("E14", o.ouvrageId, { actif: o.assetId, coteLueM: o.coteLueM, coteMinM: o.coteMinExploitationM, coteMaxM: o.coteMaxM }, `hydro — ${o.ouvrageId}`);
  }
  for (const u of list("thermique", "unites")) {
    if (u.demarragesPlanifiesLus > u.demarragesRestantsLus) push("E15", u.assetId, { planifiesLus: u.demarragesPlanifiesLus, restantsLus: u.demarragesRestantsLus, quotaLu: u.quotaDemarragesLu }, `thermique — ${u.assetId}`);
    if (u.noxLuMgNm3 > u.vleNoxMgNm3) push("E16", u.assetId, { noxLu: u.noxLuMgNm3, vle: u.vleNoxMgNm3, depuisMin: u.depassementDepuisMin ?? null }, `thermique — ${u.assetId}`);
  }
  for (const p of list("equilibre", "perimetres")) if (p.ecartLuMWh > p.seuilInterneMWh || p.ecartLuMWh < -p.seuilInterneMWh)
    push("E17", p.perimetreId, { pays: p.pays, ecartLuMWh: p.ecartLuMWh, seuilMWh: p.seuilInterneMWh, prixDesequilibreLu: p.prixDesequilibreLuEurMWh }, `equilibre — ${p.perimetreId}`);
  for (const a of list("performance", "actifs")) {
    if (a.ecartLuPct < -a.tolerancePct) push("E18", a.assetId, { ecartLuPct: a.ecartLuPct, tolerancePct: a.tolerancePct, cause: a.causeProbableLue ?? null }, `performance — ${a.assetId}`);
    if (a.disponibiliteLuePct < a.disponibiliteGarantiePct) push("E19", a.assetId, { disponibiliteLuePct: a.disponibiliteLuePct, garantiePct: a.disponibiliteGarantiePct }, `performance — ${a.assetId}`);
  }
  for (const c of list("conformite-reseau", "raccordements")) {
    if (c.modeTensionLu !== c.modeTensionExigeLu) push("E20", c.assetId, { modeLu: c.modeTensionLu, modeExige: c.modeTensionExigeLu }, `conformite-reseau — ${c.assetId}`);
    if (c.protectionSurtensionLuePu < c.seuilCodeReseauPu) push("E21", c.assetId, { reglageLuPu: c.protectionSurtensionLuePu, seuilPu: c.seuilCodeReseauPu }, `conformite-reseau — ${c.assetId}`);
  }
  for (const e of list("cyber-ot", "evenements")) if (e.gravite === "HAUTE" && e.statut === "NON_QUALIFIE")
    push("E22", e.evenementId, { equipement: e.equipementId, type: e.type, echeanceAlertePrecoce: e.echeanceAlertePrecoce, alerteEnvoyee: e.alertePrecoceEnvoyee }, `cyber-ot — ${e.evenementId}`);
  for (const q of list("conformite-reseau", "prequalifications")) if (q.statut === "EXPIREE" && q.engagementActif)
    push("E23", q.assetId, { produit: q.produit, statut: q.statut, echeance: q.echeance, engagement: q.engagementActif }, `conformite-reseau — ${q.assetId}`);

  const order: Record<Gravite, number> = { critique: 0, majeure: 1, mineure: 2 };
  return out.sort((a, b) => order[a.gravite] - order[b.gravite]);
}

/** Matrice alerte × données lues (outil → règles qui en dépendent). */
export function alertDataMatrix(): { outil: string; regles: string[] }[] {
  const m = new Map<string, Set<string>>();
  for (const r of ENERGY_RULES) for (const d of r.donneesLues) { const o = d.split(".")[0]; if (!m.has(o)) m.set(o, new Set()); m.get(o)!.add(r.id); }
  return [...m].map(([outil, s]) => ({ outil, regles: [...s] }));
}

/** Texte de contexte pour ouvrir Décider depuis une alerte (aucun fait ajouté). */
export function alertDecisionContext(a: EnergyAlert): string {
  const r = ENERGY_RULES.find(x => x.id === a.ruleId);
  const vals = Object.entries(a.valeursLues).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k} = ${v}`).join(", ");
  return `${a.label} (${a.ruleId}, ${a.objet}). Valeurs lues dans le SI Héliade (fictif) : ${vals}. Source : ${a.source}. ${a.decisionQuestion} Leviers envisagés : ${a.leviers.join(" ; ")}.${r?.options ? ` Options à comparer : ${r.options.join(" / ")}. Indicateurs à suivre : ${r.indicateurs?.join(", ")}.` : ""}`;
}
