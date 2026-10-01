// Matrice « alerte × données » : pour chaque alerte du catalogue unique (les
// alertes historiques S1 à S13, les règles de résilience et les alertes de nœud
// critique et de crise sanitaire), les attributs du modèle objet Supply dont
// elle a besoin, et s'ils sont branchés. Un attribut non branché est « donnée
// à renseigner », avec la table et le champ que le questionnaire Maison Lucie
// déclare pour lui ; une donnée hors du modèle objet porte « source à
// confirmer avec le client ». Aucune valeur n'est inventée.
import type { ArgusVocab } from "./argus-vocab-store";
import { maisonLucieExample, Q_ONTOLOGY, type QRow } from "../integration/questionnaire";

/** Donnée hors du modèle objet actuel : libellé et source probable, à confirmer. */
export interface HorsModele { donnee: string; source: string }
export interface AlertNeeds { id: string; label: string; attributs: string[]; horsModele?: HorsModele[] }

const A = (...ids: string[]) => ids;
const FOURN_EVAL = A("sc-evaluation.fournisseur", "sc-evaluation.categorie", "sc-evaluation.score", "sc-evaluation.date");
const COUV = A("sc-position.sku", "sc-position.site", "sc-position.couverture");
const TTS = A("sc-position.sku", "sc-position.site", "sc-position.tts", "sc-position.ttr", "sc-position.caRisque");
const ACHATS = A("sc-commande.id", "sc-commande.fournisseur", "sc-commande.sku", "sc-commande.quantite");

export const ALERT_NEEDS: AlertNeeds[] = [
  { id: "S1", label: "Risque de rupture fournisseur", attributs: [...FOURN_EVAL, ...ACHATS] },
  { id: "S2", label: "Couverture de stock sous seuil", attributs: [...COUV, "sc-position.caRisque"] },
  { id: "S3", label: "Surstock ou obsolescence", attributs: COUV },
  { id: "S4", label: "Retard transport critique", attributs: A("sc-expedition.id", "sc-expedition.eta", "sc-expedition.reelle", "sc-expedition.transporteur") },
  { id: "S5", label: "Dégradation OTIF fournisseur", attributs: A("sc-reception.date", "sc-commande.date"), horsModele: [{ donnee: "OTIF fournisseur (livraison à temps et complète)", source: "ERP (EKET/MSEG) ou SRM, champ à confirmer avec le client" }] },
  { id: "S6", label: "Prévision de demande en dérive", attributs: A("sc-prevision.sku", "sc-prevision.semaine", "sc-prevision.quantite", "sc-demande.quantite"), horsModele: [{ donnee: "Prévision de base hors promotion", source: "SI historique : DemandForecast.baseline ; SI standard : APS · forecasts, champ à confirmer" }] },
  { id: "S7", label: "Capacité insuffisante", attributs: A("sc-site.id", "sc-site.type"), horsModele: [{ donnee: "Capacité et charge par site ou ligne", source: "APS ou WMS, table à confirmer avec le client" }] },
  { id: "S8", label: "Marge menacée par coûts supply", attributs: A("sc-article.prix", "sc-article.cout", "sc-source.prix"), horsModele: [{ donnee: "Historique des coûts (transport, matière, droits, change)", source: "ERP ou TMS, table à confirmer avec le client" }] },
  { id: "S9", label: "Risque géopolitique/pays", attributs: [...FOURN_EVAL, "sc-fournisseur.pays", ...ACHATS] },
  { id: "S10", label: "Défaillance d'un nœud logistique", attributs: A("sc-perturbation.lieu", "sc-perturbation.type", "sc-site.id"), horsModele: [{ donnee: "Disponibilité et capacité de repli des sites", source: "WMS, table à confirmer avec le client" }] },
  { id: "S11", label: "Allocation sous pénurie", attributs: A("sc-commande-client.sku", "sc-commande-client.quantite", "sc-commande-client.client", "sc-stock.physique"), horsModele: [{ donnee: "Priorité ou niveau de service par client", source: "OMS, champ à confirmer avec le client" }] },
  { id: "S12", label: "Changement produit/nomenclature à risque", attributs: A("sc-article.sku"), horsModele: [{ donnee: "Nomenclature et modifications techniques", source: "ERP (nomenclature), table à confirmer avec le client" }] },
  { id: "S13", label: "Donnée supply incohérente", attributs: A("sc-stock.physique", "sc-commande.quantite"), horsModele: [{ donnee: "Écarts entre sources d'un même attribut", source: "Studio · Vérifier · Écarts (couche d'intégration)" }] },
  { id: "RES-PROMESSE", label: "Promesse client menacée", attributs: A("sc-promesse.ligne", "sc-promesse.sku", "sc-promesse.promise", "sc-promesse.dispo") },
  { id: "RES-CONFIRM", label: "Commande fournisseur non confirmée ou en retard", attributs: A("sc-confirmation.commande", "sc-confirmation.besoin", "sc-confirmation.confirmee") },
  { id: "RES-RUPTURE", label: "Rupture projetée avant la prochaine réception", attributs: A("sc-position.sku", "sc-position.site", "sc-position.rupture", "sc-position.reception") },
  { id: "RES-MRP", label: "Paramètres MRP obsolètes", attributs: A("sc-parametre.sku", "sc-parametre.planifie", "sc-parametre.reel") },
  { id: "RES-UNIQUE", label: "Fournisseur unique (TTR > TTS)", attributs: A("sc-source.sku", "sc-source.fournisseur", "sc-source.bloquee", ...TTS) },
  { id: "RES-GEO", label: "Exposition géographique et détroit", attributs: [...TTS, "sc-fournisseur.pays", "sc-etape.expedition", "sc-etape.lieu", "sc-expedition.commande"] },
  { id: "RES-BULLWHIP", label: "Effet coup de fouet", attributs: A("sc-signal.sku", "sc-signal.bullwhip") },
  { id: "RES-FINANCE", label: "Défaillance financière", attributs: FOURN_EVAL },
  { id: "RES-QUALITE", label: "Qualité fournisseur (lots refusés)", attributs: A("sc-qualite.fournisseur", "sc-qualite.tauxRefus") },
  { id: "RES-CERTIF", label: "Certification échue", attributs: A("sc-certificat.fournisseur", "sc-certificat.type", "sc-certificat.fin") },
  { id: "RES-PORT", label: "Congestion portuaire ou grève", attributs: A("sc-position.tts", "sc-perturbation.lieu", "sc-perturbation.debut", "sc-perturbation.retard", "sc-expedition.id", "sc-etape.lieu", "sc-etape.arrivee") },
  { id: "RES-RAPPEL", label: "Rappel produit", attributs: A("sc-controle.lot", "sc-controle.decision", "sc-livraison.lot", "sc-livraison.ligne", "sc-commande-client.client") },
  { id: "RES-ESG", label: "Devoir de vigilance (loi 2017-399, CS3D)", attributs: [...FOURN_EVAL, "sc-certificat.type"] },
  { id: "RES-MONO-A", label: "Article A mono-source", attributs: A("sc-article.sku", "sc-article.abc", "sc-source.sku", "sc-source.fournisseur", "sc-source.bloquee") },
  { id: "RES-PAYS", label: "Concentration pays", attributs: A("sc-concentration.famille", "sc-concentration.pays", "sc-concentration.part", "sc-concentration.sources") },
  { id: "RES-EUDR", label: "EUDR sans déclaration de diligence raisonnable", attributs: A("sc-eudr.sku", "sc-eudr.matiere", "sc-eudr.dds", "sc-eudr.geoloc") },
  { id: "RES-CBAM", label: "Seuil CBAM 50 t", attributs: A("sc-cbam.code", "sc-cbam.masse", "sc-cbam.cumul") },
  { id: "RES-TTS", label: "Nœud critique (TTS/TTR lus, résilience)", attributs: A(...TTS, "sc-article.alternatif") },
  { id: "RES-PANDEMIE", label: "Crise sanitaire (pic de demande)", attributs: A("sc-signal.pic", "sc-signal.bullwhip", "sc-absence.taux") },
];

export type DataStatus = "disponible" | "à renseigner";
export interface MatrixCell { attribut: string; statut: DataStatus; source: string }
export interface MatrixRow { id: string; label: string; donnees: MatrixCell[]; horsModele: HorsModele[]; complet: boolean }

/** Nom lisible de l'attribut (questionnaire), sinon son identifiant. */
const attrLabel = (id: string) => { const q = Q_ONTOLOGY.find(x => x.model === id); return q ? `${q.objet} · ${q.attribut}` : id; };

/** Matrice calculée sur le vocabulaire : un attribut est disponible s'il a une correspondance acceptée. */
export function alertDataMatrix(v: ArgusVocab | undefined, declared: QRow[] = maisonLucieExample()): MatrixRow[] {
  const maps = v?.entityMappings ?? [];
  const tableOf = (acces: string) => { try { const u = new URL(acces); return u.searchParams.get("resource") ?? u.pathname.split("/").filter(Boolean).pop() ?? ""; } catch { return acces; } };
  return ALERT_NEEDS.map(n => {
    const donnees = n.attributs.map<MatrixCell>(id => {
      const m = maps.find(x => x.attributeId === id);
      if (m) return { attribut: attrLabel(id), statut: "disponible", source: v?.fields.find(f => f.id === m.fieldId)?.name ?? m.fieldId };
      const q = Q_ONTOLOGY.find(x => x.model === id);
      const row = q && declared.find(r => r.objet === q.objet && r.attribut === q.attribut);
      return { attribut: attrLabel(id), statut: "à renseigner", source: row ? `${row.sources} · ${tableOf(row.acces)}.${row.champ}` : "table et champ à confirmer avec le client" };
    });
    const horsModele = n.horsModele ?? [];
    return { id: n.id, label: n.label, donnees, horsModele, complet: donnees.every(d => d.statut === "disponible") && !horsModele.length };
  });
}
