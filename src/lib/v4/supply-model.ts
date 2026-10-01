import {
  semanticMatch, semanticMatchKpi,
  type AppField, type ArgusVocab, type BusinessEntity, type EntityMapping, type EntityRelationship, type MappingDef,
} from "./argus-vocab-store";

// Modèle objet de référence Aura Supply Chain : la structure (objets,
// attributs, relations), jamais les faits d'un client. Les valeurs arrivent
// uniquement par les sources connectées et les mappings validés.
const e = (id: string, name: string, description: string, attrs: [string, string, "text" | "number" | "date" | "boolean"][]): BusinessEntity => ({
  id, name, description, attributes: attrs.map(([aid, aname, type]) => ({ id: `${id}.${aid}`, name: aname, type })),
});

export const SUPPLY_CHAIN_ENTITIES: BusinessEntity[] = [
  e("sc-fournisseur", "Fournisseur", "Partenaire qui livre composants, matières ou produits finis.", [
    ["id", "Identifiant fournisseur", "text"], ["nom", "Nom fournisseur", "text"], ["pays", "Pays", "text"],
    ["capacite", "Risque de capacité", "number"], ["global", "Risque global", "number"],
    ["confirmee", "Capacité confirmée", "number"], ["geopolitique", "Risque géopolitique", "number"],
    ["delai", "Délai de livraison fournisseur (jours)", "number"],
  ]),
  e("sc-article", "Article", "Référence produit ou composant (SKU).", [
    ["sku", "SKU", "text"], ["famille", "Famille", "text"], ["cout", "Coût unitaire", "number"],
    ["designation", "Désignation", "text"], ["fournisseur", "Fournisseur principal", "text"],
    ["delai", "Délai d'approvisionnement", "number"],
    // Résilience (Time-to-Recover, Simchi-Levi) : source alternative, valeur et délai de remplacement déclaré.
    ["alternatif", "Fournisseur alternatif", "text"], ["prix", "Prix de vente", "number"],
    ["marge", "Marge brute (%)", "number"], ["ttr", "Délai de remplacement déclaré (jours)", "number"],
    // Champs standard (SAP MARC-EISBE, PIM EAN) : stock de sécurité de l'article et code EAN pour relier les stocks en GTIN.
    ["securite", "Stock de sécurité de l'article", "number"], ["ean", "EAN / GTIN", "text"],
    // Classe ABC de l'article (SAP MARC-MAABC), lue.
    ["abc", "Classe ABC", "text"],
  ]),
  e("sc-site", "Site", "Entrepôt, atelier ou boutique où le stock est tenu et livré.", [
    ["id", "Identifiant site", "text"], ["nom", "Nom du site", "text"], ["type", "Type de site", "text"],
    ["pays", "Pays du site", "text"], ["capacite", "Capacité du site", "number"],
  ]),
  e("sc-stock", "Stock", "Position de stock d'un article sur un site.", [
    ["site", "Site", "text"], ["physique", "Stock physique", "number"], ["reserve", "Stock réservé", "number"],
    ["dispo", "Stock disponible", "number"], ["securite", "Stock de sécurité", "number"],
    ["demande", "Demande journalière", "number"], ["couverture", "Couverture en jours", "number"],
    ["sku", "SKU", "text"], ["transit", "Stock en transit", "number"],
  ]),
  e("sc-commande", "Commande d'achat", "Engagement d'achat auprès d'un fournisseur (une ligne article dans le SI Maison Lucie).", [
    ["id", "Identifiant commande d'achat", "text"], ["quantite", "Quantité", "number"],
    ["date", "Date demandée", "date"], ["statut", "Statut", "text"],
    ["fournisseur", "Identifiant fournisseur", "text"], ["sku", "SKU", "text"],
    ["site", "Site de destination", "text"], ["confirmee", "Quantité confirmée", "number"],
    ["dateCommande", "Date de commande", "date"],
  ]),
  e("sc-expedition", "Expédition", "Flux physique en transit qui achemine une commande d'achat.", [
    ["id", "Identifiant expédition", "text"], ["eta", "Arrivée prévue", "date"],
    ["retard", "Heures de retard", "number"], ["statut", "Statut", "text"],
    ["commande", "Identifiant commande d'achat", "text"], ["transporteur", "Transporteur", "text"],
    ["origine", "Origine", "text"], ["destination", "Destination", "text"],
    ["article", "Article expédié", "text"], ["quantite", "Quantité expédiée", "number"], ["reelle", "Arrivée réelle", "date"],
    ["co2", "Émissions CO2e du transport (kg, lues dans le TMS)", "number"],
  ]),
  e("sc-prevision", "Prévision de demande", "Demande attendue par article et par semaine.", [
    ["quantite", "Quantité prévue", "number"], ["promo", "Identifiant de promotion", "text"],
    ["sku", "SKU", "text"], ["semaine", "Semaine", "text"], ["baseline", "Baseline", "number"],
    ["ecart", "Écart de prévision (%)", "number"], ["confiance", "Confiance de prévision", "number"],
  ]),
  e("sc-perturbation", "Perturbation", "Événement externe (grève, douane, météo, défaut qualité) qui retarde des flux.", [
    ["id", "Identifiant perturbation", "text"], ["type", "Type de perturbation", "text"], ["titre", "Intitulé", "text"],
    ["gravite", "Gravité", "text"], ["statut", "Statut de la perturbation", "text"], ["retard", "Retard estimé", "number"],
    ["lieu", "Lieu (port, UN/LOCODE)", "text"], ["debut", "Début", "date"], ["fin", "Fin", "date"],
  ]),
  e("sc-commande-client", "Commande client", "Demande ferme d'un client ou d'une boutique à servir depuis un site.", [
    ["id", "Identifiant commande client", "text"], ["client", "Client", "text"], ["sku", "SKU", "text"],
    ["quantite", "Quantité commandée", "number"], ["statut", "Statut", "text"], ["date", "Date demandée", "date"],
    ["site", "Site de livraison", "text"],
  ]),
  // ── Objets standard ajoutés (résilience, crise sanitaire, détroits, qualité, rappels, vigilance) ──
  e("sc-source", "Source approuvée", "Couple article-fournisseur autorisé : liste de sources et fiche info-achat (SAP EORD, EINA/EINE).", [
    ["sku", "SKU", "text"], ["fournisseur", "Fournisseur", "text"], ["fixe", "Source fixe", "boolean"],
    ["bloquee", "Source bloquée", "boolean"], ["delai", "Délai de livraison planifié (jours)", "number"], ["prix", "Prix net d'achat", "number"],
  ]),
  e("sc-reception", "Entrée de marchandises", "Réception d'une commande d'achat (SAP MSEG, mouvement 101), avec son lot.", [
    ["id", "Identifiant réception", "text"], ["commande", "Commande d'achat", "text"], ["date", "Date de réception", "date"],
    ["sku", "Article", "text"], ["fournisseur", "Fournisseur", "text"], ["quantite", "Quantité reçue", "number"], ["lot", "Lot", "text"],
  ]),
  e("sc-demande", "Historique de demande", "Demande servie par semaine et par article (OMS, data lake).", [
    ["semaine", "Semaine", "text"], ["sku", "SKU", "text"], ["quantite", "Quantité demandée", "number"],
  ]),
  e("sc-achat", "Historique d'achats", "Quantités commandées aux fournisseurs par semaine et par article (ERP, data lake).", [
    ["semaine", "Semaine", "text"], ["sku", "SKU", "text"], ["quantite", "Quantité commandée", "number"],
  ]),
  e("sc-evaluation", "Évaluation de risque fournisseur", "Évaluation datée par catégorie (financier, ESG…) dans le SRM.", [
    ["fournisseur", "Identifiant fournisseur", "text"], ["categorie", "Catégorie de risque", "text"], ["score", "Score de risque", "number"], ["date", "Date d'évaluation", "date"],
  ]),
  e("sc-certificat", "Certificat fournisseur", "Certification d'un fournisseur (qualité, environnement, social) et sa validité.", [
    ["fournisseur", "Identifiant fournisseur", "text"], ["type", "Type de certificat", "text"], ["fin", "Fin de validité", "date"], ["statut", "Statut du certificat", "text"],
  ]),
  e("sc-controle", "Lot de contrôle", "Contrôle qualité à la réception (SAP QM) et décision d'emploi.", [
    ["id", "Identifiant lot de contrôle", "text"], ["fournisseur", "Fournisseur", "text"], ["sku", "Article", "text"], ["lot", "Lot", "text"],
    ["decision", "Décision d'emploi", "text"], ["quantite", "Quantité contrôlée", "number"], ["defauts", "Quantité non conforme", "number"],
  ]),
  e("sc-etape", "Étape de transport", "Étape d'une expédition entre deux lieux (escales en UN/LOCODE).", [
    ["expedition", "Identifiant expédition", "text"], ["lieu", "Lieu d'arrivée de l'étape", "text"], ["arrivee", "Arrivée prévue de l'étape", "date"], ["reelle", "Arrivée réelle de l'étape", "date"],
  ]),
  e("sc-livraison", "Livraison client", "Ligne expédiée à un client, avec son lot (traçabilité descendante).", [
    ["id", "Identifiant livraison", "text"], ["ligne", "Ligne de commande client", "text"], ["lot", "Lot", "text"], ["sku", "Article", "text"], ["quantite", "Quantité livrée", "number"],
  ]),
  // ── Valeurs de planification fournies par le SI (APS, MRP, ATP, confirmations) : Aura les lit, ne les calcule pas ──
  e("sc-position", "Position planifiée", "Valeurs de l'APS par article et site : couverture, délai de survie (TTS), délai de reprise (TTR), CA à risque, rupture projetée, prochaine réception.", [
    ["sku", "SKU", "text"], ["site", "Site", "text"], ["couverture", "Couverture (jours)", "number"], ["tts", "Délai de survie TTS (jours)", "number"],
    ["ttr", "Délai de reprise TTR (jours)", "number"], ["caRisque", "CA à risque (€)", "number"], ["rupture", "Rupture projetée", "date"], ["reception", "Prochaine réception", "date"],
  ]),
  e("sc-confirmation", "Confirmation fournisseur", "Confirmation d'une commande d'achat par le fournisseur (SAP EKES).", [
    ["commande", "Commande d'achat", "text"], ["sku", "SKU", "text"], ["fournisseur", "Fournisseur", "text"], ["besoin", "Date de besoin", "date"], ["confirmee", "Date confirmée", "date"],
  ]),
  e("sc-promesse", "Promesse client", "Contrôle de disponibilité (ATP) d'une ligne de commande client ouverte.", [
    ["ligne", "Ligne de commande client", "text"], ["sku", "SKU", "text"], ["site", "Site", "text"], ["promise", "Date promise", "date"], ["dispo", "Date de disponibilité confirmée", "date"],
  ]),
  e("sc-parametre", "Paramètre MRP", "Délai planifié de l'article (MARC) et délai réel médian constaté, fournis par le SI.", [
    ["sku", "SKU", "text"], ["fournisseur", "Fournisseur", "text"], ["planifie", "Délai planifié (jours)", "number"], ["reel", "Délai réel médian (jours)", "number"],
  ]),
  e("sc-signal", "Signal de planification", "Indicateurs fournis par l'outil de planification : ratio coup de fouet et pic de demande par article.", [
    ["sku", "SKU", "text"], ["bullwhip", "Ratio coup de fouet (variance commandes / demande)", "number"], ["pic", "Pic de demande (%)", "number"],
  ]),
  e("sc-qualite", "Qualité fournisseur", "Part de lots refusés par fournisseur, fournie par l'outil qualité (QMS).", [
    ["fournisseur", "Identifiant fournisseur", "text"], ["tauxRefus", "Lots refusés (%)", "number"],
  ]),
  e("sc-absence", "Absentéisme", "Taux d'absence par site et par semaine (SIRH, WFM).", [
    ["site", "Site", "text"], ["semaine", "Semaine", "text"], ["taux", "Taux d'absentéisme (%)", "number"],
  ]),
  // ── Durabilité et autonomie stratégique : valeurs lues (SRM, outil douane), jamais calculées ──
  e("sc-concentration", "Concentration pays", "Part des achats d'une famille par pays d'origine et sources actives dans ce pays (analyse des dépenses du SRM).", [
    ["famille", "Identifiant famille", "text"], ["pays", "Pays d'origine", "text"], ["part", "Part des achats (%)", "number"], ["sources", "Sources actives dans le pays", "number"],
  ]),
  e("sc-eudr", "Diligence raisonnable EUDR", "Article contenant un produit de base visé par le règlement (UE) 2023/1115 et sa déclaration de diligence raisonnable (DDS).", [
    ["sku", "SKU", "text"], ["fournisseur", "Fournisseur", "text"], ["matiere", "Produit de base visé", "text"], ["dds", "Référence DDS (TRACES)", "text"], ["geoloc", "Géolocalisation fournie", "boolean"],
  ]),
  e("sc-cbam", "Importations CBAM", "Biens CBAM importés dans l'année (règlement (UE) 2023/956) : masse nette et cumul annuel fournis par l'outil douane.", [
    ["code", "Identifiant code NC", "text"], ["masse", "Masse nette (t)", "number"], ["cumul", "Cumul annuel CBAM (t)", "number"], ["seuil", "Seuil de minimis (t)", "number"],
  ]),
];

/** Objets de détail (données standard des applications) : lus par les règles, hors du schéma principal de l'ontologie. */
export const DETAIL_OBJECTS = new Set(["sc-source", "sc-reception", "sc-demande", "sc-achat", "sc-evaluation", "sc-certificat", "sc-controle", "sc-etape", "sc-livraison", "sc-absence", "sc-position", "sc-confirmation", "sc-promesse", "sc-parametre", "sc-signal", "sc-qualite", "sc-concentration", "sc-eudr", "sc-cbam"]);

// Cardinalités lues « de → vers » : 1-N = un « de » pour plusieurs « vers ».
// Dans le SI Maison Lucie une commande d'achat porte sur un seul article
// (PurchaseOrder.sku) et une expédition sur une seule commande
// (Shipment.purchaseOrderId) : d'où Article 1-N Commande et Commande 1-N
// Expédition, plutôt qu'un N-N sans table de lignes.
export const SUPPLY_CHAIN_RELATIONSHIPS: EntityRelationship[] = [
  { id: "sc-r1", fromEntityId: "sc-fournisseur", toEntityId: "sc-commande", label: "reçoit", cardinality: "1-N" },
  { id: "sc-r2", fromEntityId: "sc-article", toEntityId: "sc-commande", label: "est commandé par", cardinality: "1-N" },
  { id: "sc-r3", fromEntityId: "sc-article", toEntityId: "sc-stock", label: "est stocké en", cardinality: "1-N" },
  { id: "sc-r4", fromEntityId: "sc-commande", toEntityId: "sc-expedition", label: "est acheminée par", cardinality: "1-N" },
  { id: "sc-r5", fromEntityId: "sc-article", toEntityId: "sc-prevision", label: "fait l'objet de", cardinality: "1-N" },
  { id: "sc-r6", fromEntityId: "sc-site", toEntityId: "sc-stock", label: "détient", cardinality: "1-N" },
  { id: "sc-r7", fromEntityId: "sc-site", toEntityId: "sc-commande", label: "est destinataire de", cardinality: "1-N" },
  { id: "sc-r8", fromEntityId: "sc-fournisseur", toEntityId: "sc-article", label: "fournit (source principale)", cardinality: "1-N" },
  { id: "sc-r9", fromEntityId: "sc-perturbation", toEntityId: "sc-expedition", label: "retarde", cardinality: "N-N" },
  { id: "sc-r10", fromEntityId: "sc-perturbation", toEntityId: "sc-fournisseur", label: "affecte", cardinality: "N-N" },
  { id: "sc-r11", fromEntityId: "sc-article", toEntityId: "sc-commande-client", label: "est demandé par", cardinality: "1-N" },
  { id: "sc-r12", fromEntityId: "sc-site", toEntityId: "sc-commande-client", label: "livre", cardinality: "1-N" },
];

// Première version du modèle (avant l'audit de cohérence) : un vocabulaire
// enregistré qui porte encore exactement ces définitions reçoit la version
// corrigée ; toute personnalisation de l'utilisateur est conservée.
const LEGACY_RELATIONSHIPS: Record<string, Omit<EntityRelationship, "id">> = {
  "sc-r2": { fromEntityId: "sc-commande", toEntityId: "sc-article", label: "porte sur", cardinality: "N-N" },
  "sc-r4": { fromEntityId: "sc-expedition", toEntityId: "sc-stock", label: "réapprovisionne", cardinality: "N-N" },
  "sc-r5": { fromEntityId: "sc-prevision", toEntityId: "sc-article", label: "concerne", cardinality: "N-N" },
};
const LEGACY_ATTRIBUTES: Record<string, { name: string; type: string }> = {
  "sc-prevision.promo": { name: "Promotion", type: "boolean" },
};
const LEGACY_DESCRIPTIONS: Record<string, string> = {
  "sc-expedition": "Flux physique en transit entre deux sites.",
  "sc-prevision": "Demande attendue par article et période.",
  "sc-commande": "Engagement d'achat auprès d'un fournisseur.",
};

function migrateEntity(current: BusinessEntity, standard: BusinessEntity): BusinessEntity {
  const attributes = current.attributes.map(attr => {
    const legacy = LEGACY_ATTRIBUTES[attr.id];
    const target = standard.attributes.find(a => a.id === attr.id);
    return legacy && target && attr.name === legacy.name && attr.type === legacy.type ? target : attr;
  });
  const have = new Set(attributes.map(a => a.id));
  return {
    ...current,
    description: current.description === LEGACY_DESCRIPTIONS[current.id] ? standard.description : current.description,
    attributes: [...attributes, ...standard.attributes.filter(a => !have.has(a.id))],
  };
}

// Ajoute le modèle de référence sans écraser les objets déjà définis :
// attributs et relations manquants ajoutés, définitions d'origine
// inchangées par l'utilisateur mises à jour (jamais d'identifiant renommé).
export function withSupplyChainModel(vocab: ArgusVocab): ArgusVocab {
  const standardById = new Map(SUPPLY_CHAIN_ENTITIES.map(x => [x.id, x]));
  const current = (vocab.entities ?? []).map(x => standardById.has(x.id) ? migrateEntity(x, standardById.get(x.id)!) : x);
  const have = new Set(current.map(x => x.id));
  const relById = new Map(SUPPLY_CHAIN_RELATIONSHIPS.map(r => [r.id, r]));
  const relationships = (vocab.relationships ?? []).map(r => {
    const legacy = LEGACY_RELATIONSHIPS[r.id];
    return legacy && r.fromEntityId === legacy.fromEntityId && r.toEntityId === legacy.toEntityId && r.label === legacy.label && r.cardinality === legacy.cardinality
      ? relById.get(r.id)! : r;
  });
  const haveRel = new Set(relationships.map(x => x.id));
  // Un branchement « Promotion (booléen) ← quantité promue » n'a pas de sens :
  // retiré pour que l'attribut « Promotion associée » soit reproposé.
  const entityMappings = (vocab.entityMappings ?? []).filter(m => !(m.entityId === "sc-prevision" && m.attributeId === "sc-prevision.promo"
    && /^DemandForecast\.promoted\b/.test(vocab.fields.find(f => f.id === m.fieldId)?.name ?? "")));
  return {
    ...vocab,
    entities: [...current, ...SUPPLY_CHAIN_ENTITIES.filter(x => !have.has(x.id))],
    relationships: [...relationships, ...SUPPLY_CHAIN_RELATIONSHIPS.filter(x => !haveRel.has(x.id))],
    ...(vocab.entityMappings ? { entityMappings } : {}),
  };
}

export type Proposal =
  | { kind: "kpi"; targetLabel: string; fieldName: string; appLabel: string; score: number; mapping: MappingDef }
  | { kind: "attribute"; targetLabel: string; fieldName: string; appLabel: string; score: number; mapping: EntityMapping };

const clean = (name: string) => name.replace(/\s*\(.*\)$/, "");
const NUMERIC = /^-?\d+(?:[.,]\d+)?$/;

// Colonne numérique : toutes les valeurs lues (ou d'exemple) sont des nombres.
export function isNumericField(field: AppField): boolean {
  const values = field.sampleValues.map(v => String(v).trim()).filter(Boolean);
  return values.length > 0 && values.every(v => NUMERIC.test(v));
}

// Meilleure proposition par indicateur et par attribut encore non branchés,
// au-dessus du seuil. Rien n'est appliqué ici : l'utilisateur valide.
export function proposeMappings(vocab: ArgusVocab, threshold = 0.75): Proposal[] {
  const enabled = new Set(vocab.apps.filter(a => a.enabled !== false).map(a => a.id));
  const fields = vocab.fields.filter(f => enabled.has(f.appId) && !/\(.*\)$/.test(f.name));
  const appLabel = (id: string) => vocab.apps.find(a => a.id === id)?.label ?? id;
  const out: Proposal[] = [];
  // Un indicateur ne se branche que sur une colonne numérique : un
  // identifiant (« SUP-001 ») ou un statut ne donne jamais une valeur.
  const numericFields = fields.filter(isNumericField);
  // À score égal, le nom le plus court (table la plus spécifique) l'emporte.
  const rank = (a: { f: AppField; s: number }, b: { f: AppField; s: number }) => b.s - a.s || a.f.name.length - b.f.name.length;
  for (const kpi of vocab.kpis) {
    if (vocab.mappings.some(m => m.kpiId === kpi.id)) continue;
    const best = numericFields.map(f => ({ f, s: semanticMatchKpi(kpi, clean(f.name)).score })).sort(rank)[0];
    if (best && best.s >= threshold) out.push({
      kind: "kpi", targetLabel: kpi.label, fieldName: best.f.name, appLabel: appLabel(best.f.appId), score: best.s,
      mapping: { id: crypto.randomUUID(), kpiId: kpi.id, appId: best.f.appId, fieldId: best.f.id, confidence: best.s, method: "semantique", rationale: "Proposition du moteur sémantique validée par l'utilisateur." },
    });
  }
  const links = vocab.entityMappings ?? [];
  for (const entity of vocab.entities ?? []) {
    for (const attr of entity.attributes) {
      if (links.some(l => l.entityId === entity.id && l.attributeId === attr.id)) continue;
      const candidates = attr.type === "number" ? numericFields : fields;
      // À score égal, la table qui porte le nom de l'objet l'emporte
      // (PurchaseOrder.purchaseOrderId plutôt que Shipment.purchaseOrderId).
      const affinity = (f: AppField) => semanticMatch(entity.name, clean(f.name).split(".").slice(0, -1).join(".")).score;
      const best = candidates.map(f => ({ f, s: semanticMatch(`${entity.name} ${attr.name}`, clean(f.name)).score, a: affinity(f) }))
        .sort((x, y) => y.s - x.s || y.a - x.a || x.f.name.length - y.f.name.length)[0];
      if (best && best.s >= threshold) out.push({
        kind: "attribute", targetLabel: `${entity.name} · ${attr.name}`, fieldName: best.f.name, appLabel: appLabel(best.f.appId), score: best.s,
        mapping: { id: crypto.randomUUID(), entityId: entity.id, attributeId: attr.id, appId: best.f.appId, fieldId: best.f.id, isMaster: true, confidence: best.s, method: "semantique", rationale: "Proposition du moteur sémantique validée par l'utilisateur." },
      });
    }
  }
  return out;
}

export function applyProposals(vocab: ArgusVocab, proposals: Proposal[]): ArgusVocab {
  return {
    ...vocab,
    mappings: [...vocab.mappings, ...proposals.flatMap(p => p.kind === "kpi" ? [p.mapping] : [])],
    entityMappings: [...(vocab.entityMappings ?? []), ...proposals.flatMap(p => p.kind === "attribute" ? [p.mapping] : [])],
  };
}

// Valeurs observées d'un attribut branché : lues dans l'instantané de la
// table source (jamais générées).
export function attributeValues(vocab: ArgusVocab, entityId: string, attributeId: string): { values: string[]; count: number; source?: string; fetchedAt?: string } {
  const link = (vocab.entityMappings ?? []).find(l => l.entityId === entityId && l.attributeId === attributeId && l.isMaster)
    ?? (vocab.entityMappings ?? []).find(l => l.entityId === entityId && l.attributeId === attributeId);
  if (!link) return { values: [], count: 0 };
  const field = vocab.fields.find(f => f.id === link.fieldId);
  if (!field) return { values: [], count: 0 };
  const column = clean(field.name).split(".").pop() ?? field.name;
  const table = field.liveTable ?? clean(field.name).split(".").slice(0, -1).join(".");
  const snap = (vocab.siTables ?? []).find(t => t.appId === field.appId && t.table === table && t.columns.includes(column));
  const values = snap ? snap.rows.map(r => r[column]).filter(v => v !== undefined && v !== "") : field.sampleValues;
  const source = `${vocab.apps.find(a => a.id === field.appId)?.label ?? field.appId} · ${clean(field.name)}`;
  return { values, count: values.length, source, fetchedAt: snap?.fetchedAt };
}
