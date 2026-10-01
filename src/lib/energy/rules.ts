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
  const vals = Object.entries(a.valeursLues).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k} = ${v}`).join(", ");
  return `${a.label} (${a.ruleId}, ${a.objet}). Valeurs lues dans le SI Héliade (fictif) : ${vals}. Source : ${a.source}. ${a.decisionQuestion} Leviers envisagés : ${a.leviers.join(" ; ")}.`;
}
