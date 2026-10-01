// Questionnaire « Cartographie des sources Supply » : rempli hors d'Aura avec le
// client (Excel ou Word), puis importé dans le Studio. L'import crée les sources,
// les mappings attribut → source, le maître par attribut et les connecteurs à
// configurer ; il ne reste qu'à saisir les identifiants côté serveur et à tester.
import type { IntegrationTemplate, Binding } from "./templates";
import type { Acv, AttributeOwnership, Tolerance } from "./ownership";
import type { Domain } from "./crosswalk";
import { ACCESS_MODES, KIND_LABELS, type ConnectorKind, type SourceConfig } from "./types";
import { kindRealistic, nativeKind, toolOf } from "./tool-protocols";
import { SAP_TEMPLATES } from "./connectors/odata";

export const Q_COLUMNS = [
  "Objet métier", "Attribut", "Description", "Application(s) source(s)", "Application maître",
  "Mode d'accès (fichier, SQL, OData, REST)", "Table ou point d'accès", "Champ", "Clé d'identification (oui/non)",
  "Fréquence de mise à jour", "Contact", "Tolérance d'écart (exact, forme, ±N %, ±N j)",
] as const;

export const Q_NOTICE = [
  "Cartographie des sources Supply — questionnaire à remplir avec les équipes du client, hors d'Aura.",
  "Une ligne par objet métier, par attribut et par application source. Si un attribut existe dans plusieurs applications, dupliquez la ligne (une par application) et indiquez la même application maître sur chacune.",
  "Mode d'accès : fichier (dépôt, S3), SFTP, SQL (réplique, data lake) ou JDBC sur HTTP, OData (SAP, v2 ou v4), REST, GraphQL, SOAP, Salesforce, SAP IDoc, SAP RFC/BAPI, EDIFACT, X12, AS2, Kafka, AMQP (RabbitMQ), MQ, CloudEvents (webhooks), CDC (Debezium), gRPC-web, ESB (MuleSoft, Boomi) ou MCP. Le dépôt et la réplique sont préférés à l'API directe.",
  "Table ou point d'accès : URL complète de l'API, table SQL (schéma.table) ou chemin du fichier. Aucun mot de passe dans ce fichier : les identifiants se saisissent côté serveur.",
  "Tolérance : exact (toute différence est signalée), forme (casse et forme juridique ignorées), ±N % (valeurs numériques), ±N j (dates).",
];

/**
 * Attributs de l'ontologie Supply ; `binding` relie l'attribut au calcul de la
 * couche d'intégration, `model` à l'attribut du modèle objet Supply (résilience,
 * alertes calculées). Les attributs sans `binding` sont lus par le modèle objet.
 */
export interface OntologyAttribute { objet: string; attribut: string; description: string; binding?: string; required?: boolean; key?: boolean; model?: string }
export const Q_ONTOLOGY: OntologyAttribute[] = [
  { objet: "Fournisseur", attribut: "Identifiant fournisseur", description: "Clé du fournisseur dans l'application (ex. LIFNR SAP).", binding: "suppliers.key", required: true, key: true, model: "sc-fournisseur.id" },
  { objet: "Fournisseur", attribut: "Nom fournisseur", description: "Raison sociale.", binding: "suppliers.name", required: true, model: "sc-fournisseur.nom" },
  { objet: "Fournisseur", attribut: "Pays", description: "Pays du fournisseur (ISO 2).", binding: "suppliers.country", model: "sc-fournisseur.pays" },
  { objet: "Fournisseur", attribut: "SIRET", description: "Fournisseurs français : 14 chiffres.", binding: "suppliers.siret" },
  { objet: "Fournisseur", attribut: "N° TVA intracommunautaire", description: "Fournisseurs européens.", binding: "suppliers.vat" },
  { objet: "Fournisseur", attribut: "DUNS", description: "Fournisseurs hors UE : 9 chiffres.", binding: "suppliers.duns" },
  { objet: "Fournisseur", attribut: "Ancien identifiant", description: "Identifiant historique, si les alertes existantes l'utilisent.", binding: "suppliers.legacy" },
  { objet: "Fournisseur", attribut: "Date de mise à jour", description: "Horodatage de modification (lecture incrémentale).", binding: "suppliers.updated" },
  { objet: "Fournisseur", attribut: "Score de risque", description: "Évaluation du risque fournisseur (SRM).", model: "sc-fournisseur.global" },
  { objet: "Fournisseur", attribut: "Certifications", description: "Certifications et leur échéance." },
  { objet: "Article", attribut: "Identifiant article", description: "Clé de l'article dans le référentiel produits.", binding: "products.key", required: true, key: true },
  { objet: "Article", attribut: "EAN / GTIN", description: "Code-barres EAN-13 ou GTIN-14.", binding: "products.ean", required: true, model: "sc-article.ean" },
  { objet: "Article", attribut: "SKU (référence interne)", description: "Référence interne ou fabricant.", binding: "products.ref", required: true, model: "sc-article.sku" },
  { objet: "Article", attribut: "Désignation", description: "Libellé de l'article.", binding: "products.name", model: "sc-article.designation" },
  { objet: "Article", attribut: "Fournisseur principal", description: "Identifiant fiscal (SIRET, TVA ou DUNS) du fournisseur de l'article.", binding: "products.supplierTaxId", required: true },
  { objet: "Article", attribut: "Pays du fournisseur", description: "Pays du fournisseur tel que saisi dans le référentiel produits.", binding: "products.supplierCountry" },
  { objet: "Article", attribut: "Famille", description: "Famille ou catégorie.", model: "sc-article.famille" },
  { objet: "Article", attribut: "Coût unitaire", description: "Prix d'achat unitaire.", model: "sc-article.cout" },
  { objet: "Article", attribut: "Date de mise à jour", description: "Horodatage de modification.", binding: "products.updated" },
  { objet: "Site", attribut: "Identifiant site", description: "Clé du site (entrepôt, atelier, boutique).", binding: "facilities.key", required: true, key: true, model: "sc-site.id" },
  { objet: "Site", attribut: "Code site", description: "Code site de référence.", binding: "facilities.code", required: true },
  { objet: "Site", attribut: "Type de site", description: "Entrepôt, usine, boutique.", binding: "facilities.type", model: "sc-site.type" },
  { objet: "Stock", attribut: "Article", description: "EAN ou SKU de l'article stocké.", binding: "stock.item", required: true, key: true, model: "sc-stock.sku" },
  { objet: "Stock", attribut: "Site", description: "Site de stockage.", binding: "stock.site", required: true, model: "sc-stock.site" },
  { objet: "Stock", attribut: "Stock physique", description: "Quantité en stock.", binding: "stock.onHand", required: true, model: "sc-stock.physique" },
  { objet: "Stock", attribut: "Stock réservé", description: "Quantité réservée ou allouée.", binding: "stock.allocated", required: true, model: "sc-stock.reserve" },
  { objet: "Stock", attribut: "Stock de sécurité", description: "Seuil de sécurité.", binding: "stock.safety", required: true, model: "sc-stock.securite" },
  { objet: "Stock", attribut: "Date de mise à jour", description: "Horodatage de modification.", binding: "stock.updated" },
  { objet: "Commande d'achat", attribut: "Identifiant commande d'achat", description: "Numéro de commande (EBELN).", key: true, model: "sc-commande.id" },
  { objet: "Commande d'achat", attribut: "Identifiant fournisseur", description: "Fournisseur de la commande.", model: "sc-commande.fournisseur" },
  { objet: "Commande d'achat", attribut: "SKU", description: "Article commandé.", model: "sc-commande.sku" },
  { objet: "Commande d'achat", attribut: "Quantité", description: "Quantité commandée.", model: "sc-commande.quantite" },
  { objet: "Commande d'achat", attribut: "Date demandée", description: "Date de livraison demandée.", model: "sc-commande.date" },
  { objet: "Expédition", attribut: "Identifiant expédition", description: "Clé de l'expédition.", binding: "shipments.key", required: true, key: true, model: "sc-expedition.id" },
  { objet: "Expédition", attribut: "Identifiant commande d'achat", description: "Commande acheminée.", binding: "shipments.po", model: "sc-expedition.commande" },
  { objet: "Expédition", attribut: "Article", description: "EAN ou SKU expédié.", binding: "shipments.item", model: "sc-expedition.article" },
  { objet: "Expédition", attribut: "Fournisseur", description: "Nom ou identifiant du fournisseur expéditeur.", binding: "shipments.supplierName", required: true, model: "sc-expedition.origine" },
  { objet: "Expédition", attribut: "Arrivée prévue", description: "Date prévue.", binding: "shipments.expected", required: true, model: "sc-expedition.eta" },
  { objet: "Expédition", attribut: "Arrivée réelle", description: "Date réelle (vide si en transit).", binding: "shipments.actual", required: true, model: "sc-expedition.reelle" },
  { objet: "Expédition", attribut: "Date de mise à jour", description: "Horodatage de modification.", binding: "shipments.updated" },
  { objet: "Commande client", attribut: "Identifiant ligne", description: "Ligne de commande client.", binding: "orders.key", key: true, model: "sc-commande-client.id" },
  { objet: "Commande client", attribut: "SKU", description: "Article commandé.", binding: "orders.product", required: true, model: "sc-commande-client.sku" },
  { objet: "Commande client", attribut: "Quantité commandée", description: "Quantité.", binding: "orders.qty", required: true, model: "sc-commande-client.quantite" },
  { objet: "Commande client", attribut: "Statut", description: "Statut (dont « en attente de stock »).", binding: "orders.status", required: true, model: "sc-commande-client.statut" },
  { objet: "Commande client", attribut: "Site de livraison", description: "Site qui sert la commande.", binding: "orders.site", model: "sc-commande-client.site" },
  { objet: "Commande client", attribut: "Date demandée", description: "Date de commande.", binding: "orders.date", model: "sc-commande-client.date" },
  { objet: "Commande client", attribut: "Client", description: "Jamais stocké par Aura : lu uniquement en agrégat.", model: "sc-commande-client.client" },
  { objet: "Commande client", attribut: "Date de mise à jour", description: "Horodatage de modification.", binding: "orders.updated" },
  { objet: "Vente", attribut: "Date de vente", description: "Jour de la vente.", binding: "sales.date", required: true },
  { objet: "Vente", attribut: "EAN", description: "Article vendu.", binding: "sales.ean", required: true },
  { objet: "Vente", attribut: "Magasin", description: "Code du point de vente.", binding: "sales.store", required: true },
  { objet: "Vente", attribut: "Quantité", description: "Unités vendues.", binding: "sales.qty", required: true },
  { objet: "Vente", attribut: "Montant net", description: "Chiffre d'affaires net.", binding: "sales.amount" },
  { objet: "Vente", attribut: "Ticket", description: "Identifiant du ticket.", binding: "sales.key", key: true },
  { objet: "Prévision de demande", attribut: "SKU", description: "Article prévu.", model: "sc-prevision.sku" },
  { objet: "Prévision de demande", attribut: "Semaine", description: "Semaine de la prévision.", model: "sc-prevision.semaine" },
  { objet: "Prévision de demande", attribut: "Quantité prévue", description: "Demande prévue.", model: "sc-prevision.quantite" },
  { objet: "Expédition", attribut: "Transporteur", description: "Transporteur de l'expédition.", model: "sc-expedition.transporteur" },
  { objet: "Non-conformité", attribut: "Identifiant non-conformité", description: "Clé de la non-conformité.", key: true },
  { objet: "Non-conformité", attribut: "EAN", description: "Article concerné." },
  { objet: "Non-conformité", attribut: "Gravité", description: "Mineure, majeure, critique." },
  { objet: "Non-conformité", attribut: "Quantité retournée", description: "Retours liés à la non-conformité." },
  // ── Données standard pour la résilience, la crise sanitaire, les détroits, la qualité et la vigilance ──
  { objet: "Article", attribut: "Délai d'approvisionnement (jours)", description: "Délai de livraison planifié de l'article (SAP MARC-PLIFZ).", model: "sc-article.delai" },
  { objet: "Article", attribut: "Stock de sécurité de l'article", description: "Stock de sécurité planifié (SAP MARC-EISBE).", model: "sc-article.securite" },
  { objet: "Article", attribut: "Prix de vente", description: "Condition de prix de vente (SAP PPR0) ou prix catalogue.", model: "sc-article.prix" },
  { objet: "Article", attribut: "Marge brute (%)", description: "Facultatif : calculée depuis le prix de vente et le coût standard si absente.", model: "sc-article.marge" },
  { objet: "Article", attribut: "Fournisseur alternatif", description: "Facultatif : sinon lu dans les sources approuvées.", model: "sc-article.alternatif" },
  { objet: "Source approuvée", attribut: "SKU", description: "Article de la liste de sources ou de la fiche info-achat (SAP EORD, EINA/EINE).", key: true, model: "sc-source.sku" },
  { objet: "Source approuvée", attribut: "Fournisseur", description: "Fournisseur autorisé pour l'article.", model: "sc-source.fournisseur" },
  { objet: "Source approuvée", attribut: "Source fixe", description: "Fournisseur fixe de la liste de sources (EORD-FLIFN).", model: "sc-source.fixe" },
  { objet: "Source approuvée", attribut: "Source bloquée", description: "Source bloquée (EORD-NOTKZ).", model: "sc-source.bloquee" },
  { objet: "Source approuvée", attribut: "Délai de livraison planifié (jours)", description: "Délai de la fiche info-achat (EINE-APLFZ).", model: "sc-source.delai" },
  { objet: "Source approuvée", attribut: "Prix net d'achat", description: "Prix net de la fiche info-achat (EINE-NETPR).", model: "sc-source.prix" },
  { objet: "Commande d'achat", attribut: "Date de commande", description: "Date du document de commande (SAP EKKO-BEDAT).", model: "sc-commande.dateCommande" },
  { objet: "Entrée de marchandises", attribut: "Identifiant réception", description: "Document article de réception (SAP MSEG).", key: true, model: "sc-reception.id" },
  { objet: "Entrée de marchandises", attribut: "Commande d'achat", description: "Commande réceptionnée.", model: "sc-reception.commande" },
  { objet: "Entrée de marchandises", attribut: "Date de réception", description: "Date comptable de la réception (BUDAT).", model: "sc-reception.date" },
  { objet: "Entrée de marchandises", attribut: "SKU", description: "Article reçu.", model: "sc-reception.sku" },
  { objet: "Entrée de marchandises", attribut: "Fournisseur", description: "Fournisseur livré.", model: "sc-reception.fournisseur" },
  { objet: "Entrée de marchandises", attribut: "Quantité reçue", description: "Quantité réceptionnée.", model: "sc-reception.quantite" },
  { objet: "Entrée de marchandises", attribut: "Lot", description: "Numéro de lot (CHARG).", model: "sc-reception.lot" },
  { objet: "Historique de demande", attribut: "Semaine", description: "Semaine ISO.", key: true, model: "sc-demande.semaine" },
  { objet: "Historique de demande", attribut: "SKU", description: "Article.", model: "sc-demande.sku" },
  { objet: "Historique de demande", attribut: "Quantité demandée", description: "Demande servie sur la semaine.", model: "sc-demande.quantite" },
  { objet: "Historique d'achats", attribut: "Semaine", description: "Semaine ISO.", key: true, model: "sc-achat.semaine" },
  { objet: "Historique d'achats", attribut: "SKU", description: "Article.", model: "sc-achat.sku" },
  { objet: "Historique d'achats", attribut: "Quantité commandée", description: "Quantité commandée aux fournisseurs sur la semaine.", model: "sc-achat.quantite" },
  { objet: "Évaluation de risque fournisseur", attribut: "Identifiant fournisseur", description: "Identifiant du fournisseur dans l'ERP.", key: true, model: "sc-evaluation.fournisseur" },
  { objet: "Évaluation de risque fournisseur", attribut: "Catégorie de risque", description: "Financier, opérationnel, ESG, géopolitique…", model: "sc-evaluation.categorie" },
  { objet: "Évaluation de risque fournisseur", attribut: "Score de risque", description: "Score de 0 à 100 (plus haut = plus risqué).", model: "sc-evaluation.score" },
  { objet: "Évaluation de risque fournisseur", attribut: "Date d'évaluation", description: "Date de l'évaluation.", model: "sc-evaluation.date" },
  { objet: "Certificat fournisseur", attribut: "Identifiant fournisseur", description: "Identifiant du fournisseur dans l'ERP.", key: true, model: "sc-certificat.fournisseur" },
  { objet: "Certificat fournisseur", attribut: "Type de certificat", description: "ISO 9001, ISO 14001, SA8000…", model: "sc-certificat.type" },
  { objet: "Certificat fournisseur", attribut: "Fin de validité", description: "Date de fin de validité.", model: "sc-certificat.fin" },
  { objet: "Certificat fournisseur", attribut: "Statut du certificat", description: "Valide, expiré.", model: "sc-certificat.statut" },
  { objet: "Lot de contrôle", attribut: "Identifiant lot de contrôle", description: "Lot de contrôle qualité (SAP QM).", key: true, model: "sc-controle.id" },
  { objet: "Lot de contrôle", attribut: "Fournisseur", description: "Fournisseur du lot.", model: "sc-controle.fournisseur" },
  { objet: "Lot de contrôle", attribut: "SKU", description: "Article contrôlé.", model: "sc-controle.sku" },
  { objet: "Lot de contrôle", attribut: "Lot", description: "Numéro de lot.", model: "sc-controle.lot" },
  { objet: "Lot de contrôle", attribut: "Décision d'emploi", description: "A accepté, R refusé.", model: "sc-controle.decision" },
  { objet: "Lot de contrôle", attribut: "Quantité contrôlée", description: "Quantité du lot.", model: "sc-controle.quantite" },
  { objet: "Signal de planification", attribut: "SKU", description: "Article.", key: true, model: "sc-signal.sku" },
  { objet: "Signal de planification", attribut: "Ratio coup de fouet", description: "Variance des commandes / variance de la demande, fournie par l'outil de planification.", model: "sc-signal.bullwhip" },
  { objet: "Signal de planification", attribut: "Pic de demande (%)", description: "Pic de demande rapporté à la médiane, fourni par l'outil de planification.", model: "sc-signal.pic" },
  { objet: "Qualité fournisseur", attribut: "Identifiant fournisseur", description: "Fournisseur.", key: true, model: "sc-qualite.fournisseur" },
  { objet: "Qualité fournisseur", attribut: "Lots refusés (%)", description: "Part de lots refusés, fournie par l'outil qualité.", model: "sc-qualite.tauxRefus" },
  { objet: "Expédition", attribut: "Émissions CO2e (kg)", description: "Émissions du transport par expédition, fournies par le TMS (ISO 14083).", model: "sc-expedition.co2" },
  { objet: "Position planifiée", attribut: "SKU", description: "Article de la position APS.", key: true, model: "sc-position.sku" },
  { objet: "Position planifiée", attribut: "Site", description: "Site de la position.", model: "sc-position.site" },
  { objet: "Position planifiée", attribut: "Couverture (jours)", description: "Couverture fournie par l'APS ou le MRP (jamais calculée par Aura).", model: "sc-position.couverture" },
  { objet: "Position planifiée", attribut: "Délai de survie TTS (jours)", description: "Time-to-Survive fourni par l'APS.", model: "sc-position.tts" },
  { objet: "Position planifiée", attribut: "Délai de reprise TTR (jours)", description: "Time-to-Recover fourni par l'APS.", model: "sc-position.ttr" },
  { objet: "Position planifiée", attribut: "CA à risque (€)", description: "CA à risque fourni par l'APS.", model: "sc-position.caRisque" },
  { objet: "Position planifiée", attribut: "Rupture projetée", description: "Date de rupture projetée (MD04, IBP).", model: "sc-position.rupture" },
  { objet: "Position planifiée", attribut: "Prochaine réception", description: "Date de la prochaine entrée planifiée.", model: "sc-position.reception" },
  { objet: "Confirmation fournisseur", attribut: "Commande d'achat", description: "Commande confirmée (EKES-EBELN).", key: true, model: "sc-confirmation.commande" },
  { objet: "Confirmation fournisseur", attribut: "SKU", description: "Article commandé.", model: "sc-confirmation.sku" },
  { objet: "Confirmation fournisseur", attribut: "Fournisseur", description: "Fournisseur.", model: "sc-confirmation.fournisseur" },
  { objet: "Confirmation fournisseur", attribut: "Date de besoin", description: "Date de livraison demandée (EKET-EINDT).", model: "sc-confirmation.besoin" },
  { objet: "Confirmation fournisseur", attribut: "Date confirmée", description: "Date confirmée par le fournisseur (EKES-EINDT), vide si non confirmée.", model: "sc-confirmation.confirmee" },
  { objet: "Promesse client", attribut: "Ligne de commande client", description: "Ligne contrôlée (ATP).", key: true, model: "sc-promesse.ligne" },
  { objet: "Promesse client", attribut: "SKU", description: "Article.", model: "sc-promesse.sku" },
  { objet: "Promesse client", attribut: "Site", description: "Site de livraison.", model: "sc-promesse.site" },
  { objet: "Promesse client", attribut: "Date promise", description: "Date promise au client.", model: "sc-promesse.promise" },
  { objet: "Promesse client", attribut: "Date de disponibilité confirmée", description: "Date de disponibilité confirmée par le contrôle ATP, vide si aucune.", model: "sc-promesse.dispo" },
  { objet: "Paramètre MRP", attribut: "SKU", description: "Article.", key: true, model: "sc-parametre.sku" },
  { objet: "Paramètre MRP", attribut: "Fournisseur", description: "Fournisseur principal.", model: "sc-parametre.fournisseur" },
  { objet: "Paramètre MRP", attribut: "Délai planifié (jours)", description: "Délai planifié (MARC-PLIFZ).", model: "sc-parametre.planifie" },
  { objet: "Paramètre MRP", attribut: "Délai réel médian (jours)", description: "Délai réel médian constaté, fourni par le SI (évaluation fournisseur, APS).", model: "sc-parametre.reel" },
  { objet: "Lot de contrôle", attribut: "Quantité non conforme", description: "Quantité défectueuse.", model: "sc-controle.defauts" },
  { objet: "Étape de transport", attribut: "Identifiant expédition", description: "Expédition de l'étape.", key: true, model: "sc-etape.expedition" },
  { objet: "Étape de transport", attribut: "Lieu d'arrivée de l'étape", description: "Port ou lieu (UN/LOCODE).", model: "sc-etape.lieu" },
  { objet: "Étape de transport", attribut: "Arrivée prévue de l'étape", description: "Date d'arrivée prévue.", model: "sc-etape.arrivee" },
  { objet: "Étape de transport", attribut: "Arrivée réelle de l'étape", description: "Date d'arrivée réelle.", model: "sc-etape.reelle" },
  { objet: "Perturbation", attribut: "Identifiant perturbation", description: "Évènement de transport (congestion, blocage, détour, grève).", key: true, model: "sc-perturbation.id" },
  { objet: "Perturbation", attribut: "Type de perturbation", description: "Code de l'évènement.", model: "sc-perturbation.type" },
  { objet: "Perturbation", attribut: "Lieu", description: "Port ou lieu (UN/LOCODE).", model: "sc-perturbation.lieu" },
  { objet: "Perturbation", attribut: "Début", description: "Date de début.", model: "sc-perturbation.debut" },
  { objet: "Perturbation", attribut: "Fin", description: "Date de fin (vide si en cours).", model: "sc-perturbation.fin" },
  { objet: "Perturbation", attribut: "Retard estimé (jours)", description: "Attente ou retard estimé.", model: "sc-perturbation.retard" },
  { objet: "Livraison client", attribut: "Identifiant livraison", description: "Ligne expédiée (WMS).", key: true, model: "sc-livraison.id" },
  { objet: "Livraison client", attribut: "Ligne de commande client", description: "Ligne de commande client servie.", model: "sc-livraison.ligne" },
  { objet: "Livraison client", attribut: "Lot", description: "Lot expédié.", model: "sc-livraison.lot" },
  { objet: "Livraison client", attribut: "SKU", description: "Article expédié.", model: "sc-livraison.sku" },
  { objet: "Livraison client", attribut: "Quantité livrée", description: "Quantité expédiée.", model: "sc-livraison.quantite" },
  { objet: "Absentéisme", attribut: "Site", description: "Site de travail.", key: true, model: "sc-absence.site" },
  { objet: "Absentéisme", attribut: "Semaine", description: "Semaine ISO.", model: "sc-absence.semaine" },
  { objet: "Absentéisme", attribut: "Taux d'absentéisme (%)", description: "Jours d'absence / jours planifiés.", model: "sc-absence.taux" },
  { objet: "Expédition", attribut: "Quantité expédiée", description: "Quantité en transit.", model: "sc-expedition.quantite" },
  { objet: "Article", attribut: "Classe ABC", description: "Classe ABC de l'article (SAP MARC-MAABC).", model: "sc-article.abc" },
  { objet: "Concentration pays", attribut: "Famille", description: "Famille d'achat.", key: true, model: "sc-concentration.famille" },
  { objet: "Concentration pays", attribut: "Pays d'origine", description: "Pays d'origine des achats (ISO 3166).", model: "sc-concentration.pays" },
  { objet: "Concentration pays", attribut: "Part des achats (%)", description: "Part des achats de la famille venant de ce pays (analyse des dépenses).", model: "sc-concentration.part" },
  { objet: "Concentration pays", attribut: "Sources actives dans le pays", description: "Nombre de fournisseurs actifs de la famille dans ce pays.", model: "sc-concentration.sources" },
  { objet: "Diligence raisonnable EUDR", attribut: "SKU", description: "Article contenant un produit de base visé.", key: true, model: "sc-eudr.sku" },
  { objet: "Diligence raisonnable EUDR", attribut: "Fournisseur", description: "Fournisseur de l'article.", model: "sc-eudr.fournisseur" },
  { objet: "Diligence raisonnable EUDR", attribut: "Produit de base visé", description: "Bovins, cacao, café, huile de palme, caoutchouc, soja ou bois.", model: "sc-eudr.matiere" },
  { objet: "Diligence raisonnable EUDR", attribut: "Référence DDS (TRACES)", description: "Numéro de la déclaration de diligence raisonnable, vide si absente.", model: "sc-eudr.dds" },
  { objet: "Diligence raisonnable EUDR", attribut: "Géolocalisation fournie", description: "Coordonnées des parcelles fournies.", model: "sc-eudr.geoloc" },
  { objet: "Importations CBAM", attribut: "Code NC", description: "Code de la nomenclature combinée du bien CBAM.", key: true, model: "sc-cbam.code" },
  { objet: "Importations CBAM", attribut: "Masse nette (t)", description: "Masse nette importée dans l'année.", model: "sc-cbam.masse" },
  { objet: "Importations CBAM", attribut: "Cumul annuel CBAM (t)", description: "Cumul annuel des biens CBAM fourni par l'outil douane.", model: "sc-cbam.cumul" },
  { objet: "Importations CBAM", attribut: "Seuil de minimis (t)", description: "50 t par an (règlement 2025/2083).", model: "sc-cbam.seuil" },
];

export interface QRow {
  objet: string; attribut: string; description: string; sources: string; maitre: string; mode: string;
  acces: string; champ: string; cle: string; frequence: string; contact: string; tolerance: string; line?: number;
}
const toArray = (r: QRow) => [r.objet, r.attribut, r.description, r.sources, r.maitre, r.mode, r.acces, r.champ, r.cle, r.frequence, r.contact, r.tolerance];
const blank = (a: OntologyAttribute): QRow => ({ objet: a.objet, attribut: a.attribut, description: a.description, sources: "", maitre: "", mode: "", acces: "", champ: "", cle: a.key ? "oui" : "", frequence: "", contact: "", tolerance: "" });

/** Exemple rempli : Maison Lucie, 5 sources. */
export function maisonLucieExample(base = "https://maison-lucie-si.vercel.app"): QRow[] {
  const SAP = "SAP S/4HANA", PIM = "PIM", WMS = "Manhattan Active WM", TMS = "TMS", APS = "APS", SRM = "SRM", QMS = "QMS", OMS = "OMS", LAKE = "Data lake";
  const sup = `${base}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Supplier`, po = `${base}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem`;
  const pim = `${base}/api/sources/pim?resource=products`, inv = `${base}/api/sources/manhattan?resource=inventory`, shp = `${base}/api/sources/tms?resource=shipments`, aps = `${base}/api/sources/aps?resource=forecasts`, srm = `${base}/api/sources/srm?resource=suppliers`, qms = `${base}/api/sources/qms?resource=nonconformities`, fac = `${base}/api/sources/manhattan?resource=facilities`;
  const oms = `${base}/api/sources/oms?resource=order-lines`, lake = `${base}/api/sources/lake?resource=sales`;
  const X = standardUrls(base);
  const R = (objet: string, attribut: string, app: string, maitre: string, mode: string, acces: string, champ: string, frequence: string, tolerance = ""): QRow => {
    const o = Q_ONTOLOGY.find(a => a.objet === objet && a.attribut === attribut);
    return { objet, attribut, description: o?.description ?? "", sources: app, maitre, mode, acces, champ, cle: o?.key ? "oui" : "non", frequence, contact: ({ [SAP]: "Équipe SAP (achats, finance)", [WMS]: "Logistique entrepôts (WMS)", [TMS]: "Transport (TMS)", [APS]: "Planification (S&OP)", [SRM]: "Achats · performance fournisseurs", [QMS]: "Qualité", [PIM]: "Référentiel produits", [OMS]: "E-commerce" } as Record<string, string>)[app] ?? "Data office", tolerance };
  };
  return [
    R("Fournisseur", "Identifiant fournisseur", SAP, SAP, "OData", sup, "Supplier", "quotidienne"),
    R("Fournisseur", "Nom fournisseur", SAP, SAP, "OData", sup, "SupplierName", "quotidienne", "forme"),
    R("Fournisseur", "Nom fournisseur", TMS, SAP, "REST", shp, "OriginName", "horaire", "forme"),
    R("Fournisseur", "Nom fournisseur", SRM, SAP, "REST", srm, "Name", "quotidienne", "forme"),
    R("Fournisseur", "Pays", SRM, SAP, "REST", srm, "Country", "quotidienne", "exact"),
    R("Fournisseur", "Score de risque", SRM, SRM, "REST", srm, "RiskScore", "quotidienne"),
    R("Fournisseur", "Certifications", SRM, SRM, "REST", srm, "Certifications", "quotidienne"),
    R("Fournisseur", "Pays", SAP, SAP, "OData", sup, "Country", "quotidienne", "exact"),
    R("Fournisseur", "Pays", PIM, SAP, "REST", pim, "supplierCountry", "quotidienne", "exact"),
    R("Fournisseur", "SIRET", SAP, SAP, "OData", sup, "TaxNumber1", "quotidienne"),
    R("Fournisseur", "N° TVA intracommunautaire", SAP, SAP, "OData", sup, "VATRegistration", "quotidienne"),
    R("Fournisseur", "DUNS", SAP, SAP, "OData", sup, "DUNS", "quotidienne"),
    R("Fournisseur", "Ancien identifiant", SAP, SAP, "OData", sup, "LegacySupplierId", "quotidienne"),
    R("Fournisseur", "Date de mise à jour", SAP, SAP, "OData", sup, "LastChangeDateTime", "quotidienne"),
    R("Article", "Identifiant article", PIM, PIM, "REST", pim, "productId", "quotidienne"),
    R("Article", "EAN / GTIN", PIM, PIM, "REST", pim, "ean", "quotidienne", "exact"),
    R("Article", "EAN / GTIN", WMS, PIM, "REST", inv, "ItemId", "horaire", "exact"),
    R("Article", "EAN / GTIN", LAKE, PIM, "REST", lake, "Ean", "quotidienne", "exact"),
    R("Article", "SKU (référence interne)", PIM, PIM, "REST", pim, "internalRef", "quotidienne", "forme"),
    R("Article", "SKU (référence interne)", OMS, PIM, "REST", oms, "ProductRef", "temps réel", "forme"),
    R("Article", "Désignation", PIM, PIM, "REST", pim, "name", "quotidienne"),
    R("Article", "Fournisseur principal", PIM, PIM, "REST", pim, "supplierTaxId", "quotidienne"),
    R("Article", "Pays du fournisseur", PIM, PIM, "REST", pim, "supplierCountry", "quotidienne"),
    R("Article", "Date de mise à jour", PIM, PIM, "REST", pim, "updatedAt", "quotidienne"),
    R("Site", "Identifiant site", WMS, WMS, "REST", fac, "FacilityId", "mensuelle"),
    R("Site", "Code site", WMS, WMS, "REST", fac, "SiteCode", "mensuelle", "forme"),
    R("Site", "Code site", LAKE, WMS, "REST", lake, "StoreCode", "quotidienne", "forme"),
    R("Site", "Type de site", WMS, WMS, "REST", fac, "FacilityType", "mensuelle"),
    R("Stock", "Article", WMS, WMS, "REST", inv, "ItemId", "horaire"),
    R("Stock", "Site", WMS, WMS, "REST", inv, "FacilityId", "horaire"),
    R("Stock", "Stock physique", WMS, WMS, "REST", inv, "OnHand", "horaire", "±5 %"),
    R("Stock", "Stock réservé", WMS, WMS, "REST", inv, "Allocated", "horaire"),
    R("Stock", "Stock de sécurité", WMS, WMS, "REST", inv, "SafetyStock", "hebdomadaire"),
    R("Stock", "Date de mise à jour", WMS, WMS, "REST", inv, "UpdatedTimestamp", "horaire"),
    R("Commande d'achat", "Identifiant commande d'achat", SAP, SAP, "OData", po, "PurchaseOrder", "horaire"),
    R("Commande d'achat", "Identifiant fournisseur", SAP, SAP, "OData", po, "Supplier", "horaire"),
    R("Commande d'achat", "SKU", SAP, SAP, "OData", po, "Material", "horaire"),
    R("Commande d'achat", "Quantité", SAP, SAP, "OData", po, "OrderQuantity", "horaire"),
    R("Commande d'achat", "Date demandée", SAP, SAP, "OData", po, "ScheduleLineDeliveryDate", "horaire", "±2 j"),
    R("Expédition", "Identifiant expédition", TMS, TMS, "REST", shp, "ShipmentId", "horaire"),
    R("Expédition", "Identifiant commande d'achat", TMS, TMS, "REST", shp, "PurchaseOrderRef", "horaire"),
    R("Expédition", "Article", TMS, TMS, "REST", shp, "ItemId", "horaire"),
    R("Expédition", "Fournisseur", TMS, TMS, "REST", shp, "OriginName", "horaire"),
    R("Expédition", "Arrivée prévue", TMS, TMS, "REST", shp, "ExpectedDate", "horaire"),
    R("Expédition", "Arrivée réelle", TMS, TMS, "REST", shp, "ActualDate", "horaire"),
    R("Expédition", "Date de mise à jour", TMS, TMS, "REST", shp, "UpdatedTimestamp", "horaire"),
    R("Expédition", "Transporteur", TMS, TMS, "REST", shp, "Carrier", "horaire"),
    R("Prévision de demande", "SKU", APS, APS, "REST", aps, "Material", "hebdomadaire"),
    R("Prévision de demande", "Semaine", APS, APS, "REST", aps, "Week", "hebdomadaire"),
    R("Prévision de demande", "Quantité prévue", APS, APS, "REST", aps, "ForecastQty", "hebdomadaire"),
    R("Non-conformité", "Identifiant non-conformité", QMS, QMS, "REST", qms, "NcId", "quotidienne"),
    R("Non-conformité", "EAN", QMS, QMS, "REST", qms, "Ean", "quotidienne"),
    R("Non-conformité", "Gravité", QMS, QMS, "REST", qms, "Severity", "quotidienne"),
    R("Non-conformité", "Quantité retournée", QMS, QMS, "REST", qms, "ReturnedQty", "quotidienne"),
    R("Commande client", "Identifiant ligne", OMS, OMS, "REST", oms, "OrderLineId", "temps réel"),
    R("Commande client", "SKU", OMS, OMS, "REST", oms, "ProductRef", "temps réel"),
    R("Commande client", "Quantité commandée", OMS, OMS, "REST", oms, "Quantity", "temps réel"),
    R("Commande client", "Statut", OMS, OMS, "REST", oms, "Status", "temps réel"),
    R("Commande client", "Site de livraison", OMS, OMS, "REST", oms, "FulfillmentSite", "temps réel"),
    R("Commande client", "Date demandée", OMS, OMS, "REST", oms, "OrderDate", "temps réel"),
    R("Commande client", "Date de mise à jour", OMS, OMS, "REST", oms, "UpdatedAt", "temps réel"),
    R("Vente", "Date de vente", LAKE, LAKE, "REST", lake, "SaleDate", "quotidienne"),
    R("Vente", "EAN", LAKE, LAKE, "REST", lake, "Ean", "quotidienne"),
    R("Vente", "Magasin", LAKE, LAKE, "REST", lake, "StoreCode", "quotidienne"),
    R("Vente", "Quantité", LAKE, LAKE, "REST", lake, "Quantity", "quotidienne"),
    R("Vente", "Montant net", LAKE, LAKE, "REST", lake, "NetAmount", "quotidienne"),
    R("Vente", "Ticket", LAKE, LAKE, "REST", lake, "TicketId", "quotidienne"),
    // ── Données standard : résilience (EORD, EINA/EINE, MARC, MBEW, PPR0), achats (EKKO, MSEG) ──
    R("Article", "SKU (référence interne)", SAP, PIM, "OData", X.marc, "Product", "quotidienne", "forme"),
    R("Article", "Délai d'approvisionnement (jours)", SAP, SAP, "OData", X.marc, "PlannedDeliveryDurationInDays", "quotidienne"),
    R("Article", "Stock de sécurité de l'article", SAP, SAP, "OData", X.marc, "SafetyStockQuantity", "hebdomadaire"),
    R("Article", "SKU (référence interne)", SAP, PIM, "OData", X.mbew, "Product", "quotidienne", "forme"),
    R("Article", "Coût unitaire", SAP, SAP, "OData", X.mbew, "StandardPrice", "mensuelle", "±2 %"),
    R("Article", "SKU (référence interne)", SAP, PIM, "OData", X.ppr0, "Material", "quotidienne", "forme"),
    R("Article", "Prix de vente", SAP, SAP, "OData", X.ppr0, "ConditionRateValue", "mensuelle", "±2 %"),
    R("Source approuvée", "SKU", SAP, SAP, "OData", X.info, "Material", "quotidienne"),
    R("Source approuvée", "Fournisseur", SAP, SAP, "OData", X.info, "Supplier", "quotidienne"),
    R("Source approuvée", "Délai de livraison planifié (jours)", SAP, SAP, "OData", X.info, "MaterialPlannedDeliveryDurn", "quotidienne"),
    R("Source approuvée", "Prix net d'achat", SAP, SAP, "OData", X.info, "NetPriceAmount", "quotidienne"),
    R("Source approuvée", "SKU", SAP, SAP, "OData", X.eord, "Material", "quotidienne"),
    R("Source approuvée", "Fournisseur", SAP, SAP, "OData", X.eord, "Supplier", "quotidienne"),
    R("Source approuvée", "Source fixe", SAP, SAP, "OData", X.eord, "SupplierIsFixed", "quotidienne"),
    R("Source approuvée", "Source bloquée", SAP, SAP, "OData", X.eord, "SourceOfSupplyIsBlocked", "quotidienne"),
    R("Commande d'achat", "Identifiant commande d'achat", SAP, SAP, "OData", X.ekko, "PurchaseOrder", "horaire"),
    R("Commande d'achat", "Date de commande", SAP, SAP, "OData", X.ekko, "PurchaseOrderDate", "horaire"),
    R("Entrée de marchandises", "Identifiant réception", SAP, SAP, "OData", X.mseg, "MaterialDocument", "horaire"),
    R("Entrée de marchandises", "Commande d'achat", SAP, SAP, "OData", X.mseg, "PurchaseOrder", "horaire"),
    R("Entrée de marchandises", "Date de réception", SAP, SAP, "OData", X.mseg, "PostingDate", "horaire"),
    R("Entrée de marchandises", "SKU", SAP, SAP, "OData", X.mseg, "Material", "horaire"),
    R("Entrée de marchandises", "Fournisseur", SAP, SAP, "OData", X.mseg, "Supplier", "horaire"),
    R("Entrée de marchandises", "Quantité reçue", SAP, SAP, "OData", X.mseg, "QuantityInEntryUnit", "horaire"),
    R("Entrée de marchandises", "Lot", SAP, SAP, "OData", X.mseg, "Batch", "horaire"),
    // ── Crise sanitaire : historiques du lac, absentéisme (SIRH) ──
    R("Historique de demande", "Semaine", LAKE, LAKE, "REST", X.dem, "Week", "hebdomadaire"),
    R("Historique de demande", "SKU", LAKE, LAKE, "REST", X.dem, "ProductRef", "hebdomadaire", "forme"),
    R("Historique de demande", "Quantité demandée", LAKE, LAKE, "REST", X.dem, "Quantity", "hebdomadaire"),
    R("Historique d'achats", "Semaine", LAKE, LAKE, "REST", X.buy, "Week", "hebdomadaire"),
    R("Historique d'achats", "SKU", LAKE, LAKE, "REST", X.buy, "Material", "hebdomadaire", "forme"),
    R("Historique d'achats", "Quantité commandée", LAKE, LAKE, "REST", X.buy, "OrderedQty", "hebdomadaire"),
    R("Absentéisme", "Site", LAKE, LAKE, "REST", X.abs, "Site", "hebdomadaire", "forme"),
    R("Absentéisme", "Semaine", LAKE, LAKE, "REST", X.abs, "Week", "hebdomadaire"),
    R("Absentéisme", "Taux d'absentéisme (%)", LAKE, LAKE, "REST", X.abs, "AbsenteeismRate", "hebdomadaire"),
    // ── Détroits : étapes et évènements de transport ──
    R("Expédition", "Quantité expédiée", TMS, TMS, "REST", shp, "Quantity", "horaire"),
    R("Étape de transport", "Identifiant expédition", TMS, TMS, "REST", X.stages, "ShipmentId", "horaire"),
    R("Étape de transport", "Lieu d'arrivée de l'étape", TMS, TMS, "REST", X.stages, "DestinationLocation", "horaire"),
    R("Étape de transport", "Arrivée prévue de l'étape", TMS, TMS, "REST", X.stages, "PlannedArrival", "horaire"),
    R("Étape de transport", "Arrivée réelle de l'étape", TMS, TMS, "REST", X.stages, "ActualArrival", "horaire"),
    R("Perturbation", "Identifiant perturbation", TMS, TMS, "REST", X.events, "EventId", "horaire"),
    R("Perturbation", "Type de perturbation", TMS, TMS, "REST", X.events, "EventCode", "horaire"),
    R("Perturbation", "Lieu", TMS, TMS, "REST", X.events, "Location", "horaire"),
    R("Perturbation", "Début", TMS, TMS, "REST", X.events, "StartDate", "horaire"),
    R("Perturbation", "Fin", TMS, TMS, "REST", X.events, "EndDate", "horaire"),
    R("Perturbation", "Retard estimé (jours)", TMS, TMS, "REST", X.events, "EstimatedDelayDays", "horaire"),
    // ── Qualité, risque, certification, rappels ──
    R("Évaluation de risque fournisseur", "Identifiant fournisseur", SRM, SAP, "REST", X.risk, "ErpVendorId", "quotidienne"),
    R("Évaluation de risque fournisseur", "Catégorie de risque", SRM, SRM, "REST", X.risk, "RiskCategory", "quotidienne"),
    R("Évaluation de risque fournisseur", "Score de risque", SRM, SRM, "REST", X.risk, "Score", "quotidienne"),
    R("Évaluation de risque fournisseur", "Date d'évaluation", SRM, SRM, "REST", X.risk, "AssessedOn", "quotidienne"),
    R("Certificat fournisseur", "Identifiant fournisseur", SRM, SAP, "REST", X.cert, "ErpVendorId", "quotidienne"),
    R("Certificat fournisseur", "Type de certificat", SRM, SRM, "REST", X.cert, "CertificateType", "quotidienne"),
    R("Certificat fournisseur", "Fin de validité", SRM, SRM, "REST", X.cert, "ValidTo", "quotidienne"),
    R("Certificat fournisseur", "Statut du certificat", SRM, SRM, "REST", X.cert, "Status", "quotidienne"),
    R("Lot de contrôle", "Identifiant lot de contrôle", QMS, QMS, "REST", X.lots, "InspectionLot", "quotidienne"),
    R("Lot de contrôle", "Fournisseur", QMS, SAP, "REST", X.lots, "Supplier", "quotidienne"),
    R("Lot de contrôle", "SKU", QMS, PIM, "REST", X.lots, "Material", "quotidienne", "forme"),
    R("Lot de contrôle", "Lot", QMS, QMS, "REST", X.lots, "Batch", "quotidienne"),
    R("Lot de contrôle", "Décision d'emploi", QMS, QMS, "REST", X.lots, "InspectionLotUsageDecisionCode", "quotidienne"),
    R("Lot de contrôle", "Quantité contrôlée", QMS, QMS, "REST", X.lots, "InspectionLotQuantity", "quotidienne"),
    R("Lot de contrôle", "Quantité non conforme", QMS, QMS, "REST", X.lots, "InspectionLotDefectiveQuantity", "quotidienne"),
    R("Livraison client", "Identifiant livraison", WMS, WMS, "REST", X.obd, "DeliveryId", "horaire"),
    R("Livraison client", "Ligne de commande client", WMS, OMS, "REST", X.obd, "OrderLineId", "horaire"),
    R("Livraison client", "Lot", WMS, WMS, "REST", X.obd, "BatchNumber", "horaire"),
    R("Livraison client", "SKU", WMS, PIM, "REST", X.obd, "ItemId", "horaire", "forme"),
    R("Livraison client", "Quantité livrée", WMS, WMS, "REST", X.obd, "ShippedQuantity", "horaire"),
    R("Commande client", "Client", OMS, OMS, "REST", oms, "CustomerId", "temps réel"),
    // ── Valeurs de planification lues (Aura ne les calcule pas) : APS, confirmations SAP EKES, ATP ──
    R("Signal de planification", "SKU", APS, PIM, "REST", X.sig, "Material", "hebdomadaire", "forme"),
    R("Signal de planification", "Ratio coup de fouet", APS, APS, "REST", X.sig, "BullwhipRatio", "hebdomadaire"),
    R("Signal de planification", "Pic de demande (%)", APS, APS, "REST", X.sig, "DemandPeakPct", "hebdomadaire"),
    R("Qualité fournisseur", "Identifiant fournisseur", QMS, SAP, "REST", X.qual, "Supplier", "quotidienne"),
    R("Qualité fournisseur", "Lots refusés (%)", QMS, QMS, "REST", X.qual, "RejectedLotsPct", "quotidienne"),
    R("Expédition", "Identifiant expédition", TMS, TMS, "REST", X.co2, "ShipmentId", "horaire"),
    R("Expédition", "Émissions CO2e (kg)", TMS, TMS, "REST", X.co2, "Co2eKg", "horaire"),
    R("Position planifiée", "SKU", APS, PIM, "REST", X.pos, "Material", "quotidienne", "forme"),
    R("Position planifiée", "Site", APS, WMS, "REST", X.pos, "FacilityId", "quotidienne", "forme"),
    R("Position planifiée", "Couverture (jours)", APS, APS, "REST", X.pos, "CoverageDays", "quotidienne"),
    R("Position planifiée", "Délai de survie TTS (jours)", APS, APS, "REST", X.pos, "TimeToSurviveDays", "quotidienne"),
    R("Position planifiée", "Délai de reprise TTR (jours)", APS, APS, "REST", X.pos, "TimeToRecoverDays", "quotidienne"),
    R("Position planifiée", "CA à risque (€)", APS, APS, "REST", X.pos, "RevenueAtRiskEur", "quotidienne"),
    R("Position planifiée", "Rupture projetée", APS, APS, "REST", X.pos, "ProjectedStockoutDate", "quotidienne"),
    R("Position planifiée", "Prochaine réception", APS, APS, "REST", X.pos, "NextReceiptDate", "quotidienne"),
    R("Confirmation fournisseur", "Commande d'achat", SAP, SAP, "OData", X.ekes, "PurchaseOrder", "horaire"),
    R("Confirmation fournisseur", "SKU", SAP, PIM, "OData", X.ekes, "Material", "horaire", "forme"),
    R("Confirmation fournisseur", "Fournisseur", SAP, SAP, "OData", X.ekes, "Supplier", "horaire"),
    R("Confirmation fournisseur", "Date de besoin", SAP, SAP, "OData", X.ekes, "RequestedDeliveryDate", "horaire"),
    R("Confirmation fournisseur", "Date confirmée", SAP, SAP, "OData", X.ekes, "ConfirmedDeliveryDate", "horaire"),
    R("Promesse client", "Ligne de commande client", APS, OMS, "REST", X.atp, "OrderLineId", "horaire"),
    R("Promesse client", "SKU", APS, PIM, "REST", X.atp, "ProductRef", "horaire", "forme"),
    R("Promesse client", "Site", APS, WMS, "REST", X.atp, "FulfillmentSite", "horaire", "forme"),
    R("Promesse client", "Date promise", APS, OMS, "REST", X.atp, "PromisedDate", "horaire"),
    R("Promesse client", "Date de disponibilité confirmée", APS, APS, "REST", X.atp, "ConfirmedAvailabilityDate", "horaire"),
    R("Paramètre MRP", "SKU", APS, PIM, "REST", X.lt, "Material", "hebdomadaire", "forme"),
    R("Paramètre MRP", "Fournisseur", APS, SAP, "REST", X.lt, "Supplier", "hebdomadaire"),
    R("Paramètre MRP", "Délai planifié (jours)", APS, SAP, "REST", X.lt, "PlannedLeadTimeDays", "hebdomadaire"),
    R("Paramètre MRP", "Délai réel médian (jours)", APS, APS, "REST", X.lt, "ActualLeadTimeMedianDays", "hebdomadaire"),
    // ── Durabilité et autonomie stratégique : classe ABC (MARC), concentration pays (SRM), EUDR (SRM), CBAM (outil douane) ──
    R("Article", "Classe ABC", SAP, SAP, "OData", X.marc, "ABCIndicator", "hebdomadaire"),
    R("Concentration pays", "Famille", SRM, PIM, "REST", X.pays, "Family", "mensuelle"),
    R("Concentration pays", "Pays d'origine", SRM, SRM, "REST", X.pays, "Country", "mensuelle"),
    R("Concentration pays", "Part des achats (%)", SRM, SRM, "REST", X.pays, "SpendSharePct", "mensuelle"),
    R("Concentration pays", "Sources actives dans le pays", SRM, SRM, "REST", X.pays, "ActiveSourcesInCountry", "mensuelle"),
    R("Diligence raisonnable EUDR", "SKU", SRM, PIM, "REST", X.eudr, "Material", "quotidienne", "forme"),
    R("Diligence raisonnable EUDR", "Fournisseur", SRM, SAP, "REST", X.eudr, "Supplier", "quotidienne"),
    R("Diligence raisonnable EUDR", "Produit de base visé", SRM, SRM, "REST", X.eudr, "EudrCommodity", "quotidienne"),
    R("Diligence raisonnable EUDR", "Référence DDS (TRACES)", SRM, SRM, "REST", X.eudr, "DdsReferenceNumber", "quotidienne"),
    R("Diligence raisonnable EUDR", "Géolocalisation fournie", SRM, SRM, "REST", X.eudr, "GeolocationProvided", "quotidienne"),
    R("Importations CBAM", "Code NC", TMS, TMS, "REST", X.cbam, "CnCode", "quotidienne"),
    R("Importations CBAM", "Masse nette (t)", TMS, TMS, "REST", X.cbam, "NetMassTonnes", "quotidienne"),
    R("Importations CBAM", "Cumul annuel CBAM (t)", TMS, TMS, "REST", X.cbam, "CumulativeCbamNetMassTonnes", "quotidienne"),
    R("Importations CBAM", "Seuil de minimis (t)", TMS, TMS, "REST", X.cbam, "DeMinimisThresholdTonnes", "quotidienne"),
  ];
}
/** Points d'accès des données standard ajoutées (taille démo seulement). */
export function standardUrls(base = "https://maison-lucie-si.vercel.app") {
  const sap = (svc: string, e: string) => `${base}/sap/opu/odata/sap/${svc}/${e}`, rest = (src: string, r: string) => `${base}/api/sources/${src}?resource=${r}`;
  return {
    eord: sap("API_PURCHASING_SOURCE_SRV", "A_PurchasingSource"), info: sap("API_INFORECORD_PROCESS_SRV", "A_PurgInfoRecdOrgPlantData"),
    marc: sap("API_PRODUCT_SRV", "A_ProductSupplyPlanning"), mbew: sap("API_PRODUCT_SRV", "A_ProductValuation"), ppr0: sap("API_SLSPRICINGCONDITIONRECORD_SRV", "A_SlsPrcgConditionRecord"),
    ekko: sap("API_PURCHASEORDER_PROCESS_SRV", "A_PurchaseOrder"), mseg: sap("API_MATERIAL_DOCUMENT_SRV", "A_MaterialDocumentItem"),
    dem: rest("lake", "demand-history"), buy: rest("lake", "purchase-history"), abs: rest("lake", "absenteeism"),
    stages: rest("tms", "shipment-stages"), events: rest("tms", "events"), risk: rest("srm", "risk-assessments"), cert: rest("srm", "certificates"),
    lots: rest("qms", "inspection-lots"), obd: rest("manhattan", "outbound-deliveries"),
    pos: rest("aps", "supply-positions"), sig: rest("aps", "demand-signals"), qual: rest("qms", "supplier-quality"), co2: rest("tms", "shipment-emissions"), lt: rest("aps", "lead-time-review"), pays: rest("srm", "country-exposure"), eudr: rest("srm", "eudr-statements"), cbam: rest("tms", "customs-cbam"), atp: rest("aps", "atp-checks"), ekes: sap("API_PURCHASEORDER_PROCESS_SRV", "A_PurOrdSupplierConfirmation"),
  };
}
const isStandardExtension = (acces: string) => Object.values(standardUrls("")).some(u => acces.endsWith(u));

/** Variante « volumétrie » : les mêmes points d'accès en taille scale (millions de lignes, générées à la volée). */
export function maisonLucieScaleExample(base = "https://maison-lucie-si.vercel.app"): QRow[] {
  // Les données standard ajoutées n'existent qu'en taille démo : elles restent hors de la variante volumétrie.
  return maisonLucieExample(base).filter(r => !isStandardExtension(r.acces)).map(r => ({ ...r, acces: `${r.acces}${r.acces.includes("?") ? "&" : "?"}volume=scale` }));
}

/**
 * Variante « canaux » : chaque application de Maison Lucie est lue par un autre
 * canal qu'elle expose réellement (protocoles réalistes par type d'outil, mêmes
 * données, vérifié côté Maison Lucie) : SAP en OData v4, PIM par fichier SFTP,
 * WMS en SOAP, TMS en AMQP (RabbitMQ), APS par fichier SFTP, SRM et QMS en SOAP,
 * OMS par l'API Salesforce, lac en SQL.
 */
export function maisonLucieChannelsExample(base = "https://maison-lucie-si.vercel.app"): QRow[] {
  const via: Record<string, { mode: string; url: (entity: string, resource: string) => string }> = {
    "SAP S/4HANA": { mode: "OData v4", url: e => `${base}/odata/v4/sap/${e}` },
    PIM: { mode: "SFTP", url: (_e, r) => `${base}/sftp/get?path=/outbound/pim/${r}.json` },
    "Manhattan Active WM": { mode: "SOAP", url: (_e, r) => `${base}/api/soap?source=manhattan&resource=${r}` },
    TMS: { mode: "AMQP (RabbitMQ)", url: (_e, r) => `${base}/api/queues/%2F/lucie.tms.${r}` },
    APS: { mode: "SFTP", url: (_e, r) => `${base}/sftp/get?path=/outbound/aps/${r}.json` },
    SRM: { mode: "SOAP", url: (_e, r) => `${base}/api/soap?source=srm&resource=${r}` },
    QMS: { mode: "SOAP", url: (_e, r) => `${base}/api/soap?source=qms&resource=${r}` },
    OMS: { mode: "Salesforce", url: (_e, r) => `${base}/services/data/v60.0/sobjects/Lucie_Oms_${r.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase())}__c` },
    "Data lake": { mode: "SQL / JDBC", url: (_e, r) => `${base}/sql#lake.${r.replace(/-/g, "_")}` },
  };
  return maisonLucieExample(base).map(r => {
    const v = via[r.sources];
    if (!v) return r;
    const u = new URL(r.acces), entity = u.pathname.split("/").pop() ?? "", resource = u.searchParams.get("resource") ?? entity;
    return { ...r, mode: v.mode, acces: v.url(entity, resource) };
  });
}
/** Variante « MCP » : les 9 applications lues par le serveur MCP de Maison Lucie (connecteur MCP générique). */
export function maisonLucieMcpExample(base = "https://maison-lucie-si.vercel.app"): QRow[] {
  return maisonLucieExample(base).map(r => {
    const u = new URL(r.acces), parts = u.pathname.split("/").filter(Boolean);
    const [source, resource] = u.pathname.startsWith("/sap/") ? ["sap", parts.pop()!] : [parts.pop()!, u.searchParams.get("resource")!];
    return { ...r, mode: "MCP", acces: `${base}/mcp#${source}/${resource}` };
  });
}

/** Classeur : notice + questionnaire vierge pré-rempli (ontologie) + exemple Maison Lucie. */
export function questionnaireSheets(base?: string) {
  const header = [...Q_COLUMNS];
  const notice = Q_NOTICE.map(t => [t]);
  return [
    { name: "Questionnaire", headerRow: notice.length + 1, rows: [...notice, [], header, ...Q_ONTOLOGY.map(a => toArray(blank(a)))], widths: [18, 26, 40, 24, 20, 16, 48, 22, 12, 16, 22, 18] },
    { name: "Exemple Maison Lucie", headerRow: 0, rows: [header, ...maisonLucieExample(base).map(toArray)], widths: [18, 26, 40, 24, 20, 16, 60, 22, 12, 16, 22, 18] },
  ];
}

// ── Lecture ─────────────────────────────────────────────────────────────────
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export function rowsFromSheet(rows: string[][]): QRow[] {
  const h = rows.findIndex(r => norm(r[0] ?? "") === "objet metier");
  if (h < 0) return [];
  const idx = (label: string) => rows[h].findIndex(c => norm(c ?? "").startsWith(norm(label)));
  const I = { objet: idx("Objet"), attribut: idx("Attribut"), description: idx("Description"), sources: idx("Application(s) source"), maitre: idx("Application maître"), mode: idx("Mode d'acc"), acces: idx("Table ou point"), champ: idx("Champ"), cle: idx("Clé"), frequence: idx("Fréquence"), contact: idx("Contact"), tolerance: idx("Tolérance") };
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  return rows.slice(h + 1).map((r, k) => ({
    objet: get(r, I.objet), attribut: get(r, I.attribut), description: get(r, I.description), sources: get(r, I.sources), maitre: get(r, I.maitre),
    mode: get(r, I.mode), acces: get(r, I.acces), champ: get(r, I.champ), cle: get(r, I.cle), frequence: get(r, I.frequence), contact: get(r, I.contact), tolerance: get(r, I.tolerance), line: h + k + 2,
  })).filter(r => r.objet || r.attribut);
}

/** Choisit la feuille remplie : « Questionnaire » si elle contient des sources, sinon la première feuille renseignée. */
export function pickFilledSheet(sheets: { name: string; rows: string[][] }[]): { name: string; rows: QRow[] } | null {
  const parsed = sheets.map(s => ({ name: s.name, rows: rowsFromSheet(s.rows) })).filter(s => s.rows.length);
  return parsed.find(s => s.rows.some(r => r.sources)) ?? parsed[0] ?? null;
}

// ── Import ──────────────────────────────────────────────────────────────────
// Le questionnaire dit QUELS systèmes appeler et COMMENT y accéder. La colonne
// « Champ » n'est qu'un indice : le mapping des champs est proposé par Aura après
// lecture des métadonnées et d'un échantillon (voir discovery.ts), puis validé.
export type BindingGroup = "suppliers" | "products" | "facilities" | "stock" | "shipments" | "orders" | "sales";
export const GROUP_OF_OBJECT: Record<string, BindingGroup> = { Fournisseur: "suppliers", Article: "products", Site: "facilities", Stock: "stock", "Expédition": "shipments", "Commande client": "orders", Vente: "sales" };
export const OBJECT_OF_GROUP = Object.fromEntries(Object.entries(GROUP_OF_OBJECT).map(([o, g]) => [g, o])) as Record<BindingGroup, string>;

export interface ImportIssue { level: "erreur" | "attention"; line?: number; message: string }
export interface ImportedSetup {
  sources: SourceConfig[];
  /** Objet métier → source et entité de l'application maître (clé de l'objet). */
  objects: { group: BindingGroup; objet: string; sourceId: string; entity: string }[];
  /** Indices de champ (colonne « Champ ») par attribut Aura, pour la source maître. */
  hints: Record<string, string>;
  /** Lignes déclarées (maître et consommatrices), pour le lignage et la cohérence. */
  declared: { objet: string; attribut: string; attributeId?: string; sourceId: string; application: string; entity: string; hint: string; master: boolean; tolerance: Tolerance }[];
  acv: Acv;
  issues: ImportIssue[];
  summary: { lignes: number; renseignees: number; applications: number; attributsMultiSources: number };
  /** Correspondances de champs proposées par Aura puis validées, corrigées ou refusées. */
  proposals?: import("./discovery").FieldProposal[];
  /** Réglages des alertes (étape 4). */
  alertSettings?: AlertSettings;
}

export interface AlertSettings { lateRatePct: number; minShipments: number; backorderStatuses: string[]; velocityDays: number; options?: Partial<Record<"rupture" | "retard" | "retard-asie" | "risque-fournisseur" | "ecart-sources", string[]>> }
export const DEFAULT_OPTIONS = { "retard-asie": ["Reroutage par le cap de Bonne-Espérance", "Bascule mer-air sur les références critiques", "Attendre la réouverture de la route Suez"], rupture: ["Transfert inter-sites", "Commande express au fournisseur", "Réallocation des commandes clients"], retard: ["Relancer et appliquer les pénalités", "Basculer vers un fournisseur secondaire", "Relever le stock de sécurité"], "risque-fournisseur": ["Double sourcing", "Stock de sécurité renforcé", "Plan de progrès fournisseur"], "ecart-sources": ["Corriger dans la source", "Aligner sur le maître dans Aura", "Faire trancher par un référent"] };
export const DEFAULT_ALERT_SETTINGS: AlertSettings = { lateRatePct: 30, minShipments: 5, backorderStatuses: ["BACKORDERED", "BACKORDER", "EN ATTENTE", "EN_ATTENTE", "RUPTURE", "ON HOLD"], velocityDays: 90 };

const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function kindOf(mode: string, app: string, acces = ""): ConnectorKind | null {
  const m = norm(mode), http = /^https?:\/\//i.test(acces.trim());
  if (/\bmcp\b|model context/.test(m)) return "mcp";
  if (/odata\s*v?4/.test(m)) return "odata4";
  if (/odata/.test(m)) return "odata";
  if (/graphql/.test(m)) return "graphql";
  if (/soap/.test(m)) return "soap";
  if (/salesforce|soql|bulk api/.test(m)) return "salesforce";
  if (/idoc/.test(m)) return "idoc";
  if (/\brfc\b|bapi/.test(m)) return "rfc";
  if (/edifact/.test(m)) return "edifact";
  if (/x12|ansi/.test(m)) return "x12";
  if (/\bas2\b/.test(m)) return "as2";
  if (/amqp|rabbit/.test(m)) return "amqp";
  if (/\bmq\b|ibm mq|websphere/.test(m)) return "mq";
  if (/cloudevents?|webhook/.test(m)) return "cloudevents";
  if (/\bcdc\b|debezium|capture/.test(m)) return "cdc";
  if (/grpc/.test(m)) return "grpcweb";
  if (/\besb\b|ipaas|mulesoft|boomi/.test(m)) return "esb";
  if (/sftp/.test(m) && http) return "sftp";
  if (/jdbc/.test(m) || (/sql/.test(m) && http)) return "sqlhttp";
  if (/sql/.test(m)) return "sql";
  if (/fichier|file|csv|parquet|depot|s3|sftp/.test(m)) return "file";
  if (/kafka|evenement/.test(m)) return "kafka";
  if (/rest|api/.test(m)) return /manhattan/i.test(app) ? "manhattan" : "rest";
  return null;
}
/** Types de connecteurs « canal » : une URL par ressource, déclarée telle quelle. */
const CHANNEL_KINDS: ConnectorKind[] = ["odata4", "graphql", "soap", "salesforce", "amqp", "mq", "cloudevents", "cdc", "sftp", "sqlhttp", "grpcweb", "esb", "idoc", "rfc", "edifact", "x12", "as2", "mcp"];
export function parseTolerance(t: string): Tolerance {
  const s = norm(t);
  let m;
  if ((m = s.match(/±?\s*(\d+(?:[.,]\d+)?)\s*%/))) return { kind: "pct", value: Number(m[1].replace(",", ".")) };
  if ((m = s.match(/±?\s*(\d+)\s*j/))) return { kind: "days", value: Number(m[1]) };
  if (/forme|casse/.test(s)) return { kind: "forme" };
  return { kind: "exact" };
}

interface Endpoint { baseUrl: string; entity: string; path: string; servicePath?: string; query?: string }
function endpointOf(kind: ConnectorKind, acces: string): Endpoint | null {
  if (kind === "sql") return { baseUrl: "", entity: acces.split(".").pop() || acces, path: acces };
  if (kind === "file") {
    // Nom d'entité : fichier sans extension ni joker, ou dossier parent pour un jeu partitionné (lake_sales/*/*.parquet).
    const parts = acces.split("/").filter(Boolean);
    const named = [...parts].reverse().map(p => p.replace(/\.(parquet|csv)$/i, "").replace(/\*/g, "").replace(/[^A-Za-z0-9_]/g, "_")).find(p => p && !/^_+$/.test(p));
    return { baseUrl: "", entity: named ?? "fichier", path: acces };
  }
  let u: URL;
  try { u = new URL(acces); } catch { return null; }
  if (CHANNEL_KINDS.includes(kind)) {
    const segs = u.pathname.split("/").filter(Boolean).map(decodeURIComponent), hash = decodeURIComponent(u.hash.slice(1));
    const entity = kind === "mq" ? segs[segs.length - 2] ?? "queue"
      : kind === "soap" ? u.searchParams.get("resource") ?? "records"
      : kind === "sftp" ? (u.searchParams.get("path") ?? "").split("/").pop()!.replace(/\.\w+$/, "")
      : kind === "mcp" ? hash || "mcp"
      : kind === "grpcweb" ? hash.split("/").pop() || "rows"
      : hash || segs[segs.length - 1] || "data";
    return { baseUrl: u.origin, entity, path: acces };
  }
  if (kind === "odata") {
    const parts = u.pathname.split("/").filter(Boolean);
    const entity = parts.pop() ?? "";
    return { baseUrl: u.origin, entity, path: u.pathname, servicePath: `/${parts.join("/")}`, query: u.search.slice(1) };
  }
  const entity = u.searchParams.get("resource") ?? u.pathname.split("/").filter(Boolean).pop() ?? "data";
  return { baseUrl: u.origin, entity, path: `${u.pathname}${u.search}` };
}
const apps = (r: QRow) => r.sources.split(/[;,]/).map(x => x.trim()).filter(Boolean);
const attributeIdOf = (objet: string, attribut: string) => Q_ONTOLOGY.find(o => o.objet === objet && o.attribut === attribut)?.binding;

export function importQuestionnaire(rows: QRow[], opts: { tokenRef?: (app: string, baseUrl: string) => string } = {}): ImportedSetup {
  const issues: ImportIssue[] = [];
  // Mode d'accès absent : le Studio propose le protocole natif le plus courant du type d'outil.
  const NATIVE_MODE: Partial<Record<ConnectorKind, string>> = { odata: "OData", odata4: "OData v4", rest: "REST", manhattan: "REST", soap: "SOAP", sqlhttp: "JDBC", sql: "SQL", graphql: "GraphQL" };
  const filled = rows.filter(r => r.sources).map(r => {
    if (r.mode || apps(r).length !== 1) return r;
    const tool = toolOf(apps(r)[0]), k = nativeKind(tool), mode = k && NATIVE_MODE[k];
    if (!tool || !mode) return r;
    issues.push({ level: "attention", line: r.line, message: `${r.objet} · ${r.attribut} (${r.sources}) : mode d'accès non renseigné, protocole natif proposé pour un ${tool.label} : ${mode}.` });
    return { ...r, mode };
  });
  if (!filled.length) issues.push({ level: "erreur", message: "Aucune ligne renseignée : indiquez au moins les applications sources." });

  // Contrôle d'import : lignes incomplètes, maître manquant (le champ est facultatif).
  for (const r of filled) {
    const missing = [["mode d'accès", r.mode], ["table ou point d'accès", r.acces]].filter(([, v]) => !v).map(([k]) => k);
    if (!r.maitre) issues.push({ level: "erreur", line: r.line, message: `${r.objet} · ${r.attribut} : maître manquant.` });
    if (missing.length) issues.push({ level: "erreur", line: r.line, message: `${r.objet} · ${r.attribut} (${r.sources}) : ligne incomplète (${missing.join(", ")}).` });
    { const k = r.mode ? kindOf(r.mode, r.sources, r.acces) : null, tool = apps(r).length === 1 ? toolOf(apps(r)[0]) : undefined;
      if (k && tool && !kindRealistic(k, tool)) issues.push({ level: "attention", line: r.line, message: `${r.objet} · ${r.attribut} : « ${r.mode} » n'est pas un protocole qu'un ${tool.label} (${tool.examples}) expose en standard ; protocoles usuels : ${tool.kinds.map(x => KIND_LABELS[x]).join(", ")}. À confirmer avec le client.` }); }
    if (r.mode && !kindOf(r.mode, r.sources, r.acces)) issues.push({ level: "erreur", line: r.line, message: `${r.objet} · ${r.attribut} : mode d'accès « ${r.mode} » inconnu (fichier, SQL, OData, REST, GraphQL, SOAP, Salesforce, IDoc, RFC, EDIFACT, X12, AS2, AMQP, MQ, CloudEvents, CDC, SFTP, JDBC, gRPC, ESB, MCP).` });
  }
  const byAttr = new Map<string, QRow[]>();
  for (const r of filled) byAttr.set(`${r.objet}|${r.attribut}`, [...(byAttr.get(`${r.objet}|${r.attribut}`) ?? []), r]);
  for (const [k, list] of byAttr) {
    const masters = new Set(list.map(r => r.maitre).filter(Boolean));
    const [objet, attribut] = k.split("|");
    if (masters.size > 1) issues.push({ level: "erreur", line: list[0].line, message: `${objet} · ${attribut} : plusieurs maîtres déclarés (${[...masters].join(", ")}) ; un seul par attribut.` });
    const m = [...masters][0];
    if (m && !list.some(r => apps(r).includes(m))) issues.push({ level: "attention", line: list[0].line, message: `${objet} · ${attribut} : le maître « ${m} » n'a pas de ligne propre ; ajoutez son point d'accès.` });
  }

  // Applications → sources (connecteurs à configurer : identifiants côté serveur, puis test).
  const appInfo = new Map<string, { kind: ConnectorKind; endpoints: Map<string, Endpoint>; baseUrl: string; contact: string; frequence: string }>();
  const declared: ImportedSetup["declared"] = [];
  for (const r of filled) {
    for (const app of apps(r)) {
      const kind = kindOf(r.mode, app, r.acces);
      if (!kind || !r.acces) continue;
      const ep = endpointOf(kind, r.acces);
      if (!ep) { issues.push({ level: "erreur", line: r.line, message: `${r.objet} · ${r.attribut} : point d'accès « ${r.acces} » illisible (URL complète attendue pour ${r.mode}).` }); continue; }
      const a = appInfo.get(app) ?? { kind, endpoints: new Map(), baseUrl: ep.baseUrl, contact: r.contact, frequence: r.frequence };
      a.endpoints.set(ep.entity, ep);
      appInfo.set(app, a);
      declared.push({ objet: r.objet, attribut: r.attribut, attributeId: attributeIdOf(r.objet, r.attribut), sourceId: `q-${slug(app)}`, application: app, entity: ep.entity, hint: r.champ, master: app === r.maitre, tolerance: parseTolerance(r.tolerance) });
    }
  }
  const sources: SourceConfig[] = [...appInfo.entries()].map(([app, a]) => {
    const id = `q-${slug(app)}`;
    const token = opts.tokenRef?.(app, a.baseUrl) ?? `{{env:AURA_${slug(app).replace(/-/g, "_").toUpperCase()}_TOKEN}}`;
    const entities: Record<string, Record<string, unknown>> = {};
    for (const [name, ep] of a.endpoints) {
      if (a.kind === "odata") entities[name] = { ...(SAP_TEMPLATES[name] ?? { fields: [], objectClass: "master", key: "" }), entitySet: name, servicePath: ep.servicePath, ...(ep.query ? { extraQuery: ep.query } : {}) };
      else if (a.kind === "sql") entities[name] = { table: ep.path };
      else if (a.kind === "file") entities[name] = { path: ep.path, format: /\.csv$/i.test(ep.path) ? "csv" : "parquet", hive: /\*\//.test(ep.path) };
      else if (CHANNEL_KINDS.includes(a.kind)) entities[name] = { url: ep.path };
      else entities[name] = { path: ep.path };
    }
    const accessMode = ACCESS_MODES.find(m => m.kinds.includes(a.kind))?.id ?? "api";
    const auth = a.kind === "sql" ? { dsn: token } : a.kind === "file" ? {} : { bearer: token };
    // MCP et GraphQL : le point d'accès unique est découvert (outils, introspection) ; les entités restent nommées par le questionnaire.
    const first = [...a.endpoints.values()][0]?.path ?? "";
    const extra = a.kind === "mcp" ? { serverUrl: first.split("#")[0] } : a.kind === "graphql" ? { url: first.split("#")[0] } : {};
    const params = { ...(a.baseUrl ? { baseUrl: a.baseUrl } : {}), ...auth, ...extra, ...(a.kind === "mcp" ? {} : { entities }) };
    return { id, label: app, kind: a.kind, accessMode, params, schedule: { everyMinutes: /temps r|horaire|heure/i.test(a.frequence) ? 180 : 1440 } } as SourceConfig;
  });

  // Objet → source et entité maîtres (ligne de la clé de l'objet, sinon première ligne maître).
  const objects: ImportedSetup["objects"] = [];
  for (const [objet, group] of Object.entries(GROUP_OF_OBJECT)) {
    const rowsO = declared.filter(d => d.objet === objet && d.master);
    const keyRow = rowsO.find(d => Q_ONTOLOGY.find(o => o.objet === objet && o.attribut === d.attribut)?.key) ?? rowsO[0];
    if (keyRow) objects.push({ group, objet, sourceId: keyRow.sourceId, entity: keyRow.entity });
    else if (Q_ONTOLOGY.some(o => o.objet === objet && o.required)) issues.push({ level: "attention", message: `Objet « ${objet} » sans source maître : les alertes qui en dépendent ne seront pas calculées.` });
  }
  const hints: Record<string, string> = {};
  for (const d of declared) if (d.master && d.attributeId && d.hint) hints[d.attributeId] = d.hint;

  // ACV : maître par attribut (déclaré), consommatrices, tolérance.
  const domainOf: Record<string, Domain> = { Fournisseur: "supplier", Article: "product", Site: "site" };
  const attributes: AttributeOwnership[] = [];
  for (const [k, list] of byAttr) {
    const [objet, attribut] = k.split("|");
    const domain = domainOf[objet];
    if (!domain) continue;
    const master = list[0].maitre ? `q-${slug(list[0].maitre)}` : undefined;
    const consumers = [...new Set(list.flatMap(r => apps(r).map(s => `q-${slug(s)}`)).filter(s => s !== master))];
    attributes.push({ domain, attribute: attribut, master, consumers, validated: false, tolerance: parseTolerance(list.find(r => r.tolerance)?.tolerance ?? "") });
  }
  const src = (g: BindingGroup) => objects.find(o => o.group === g)?.sourceId ?? "";
  const acv: Acv = { domainMasters: { supplier: src("suppliers"), product: src("products"), site: src("facilities") }, attributes };
  const multi = [...byAttr.values()].filter(l => new Set(l.flatMap(apps)).size > 1).length;
  return { sources, objects, hints, declared, acv, issues, summary: { lignes: rows.length, renseignees: filled.length, applications: appInfo.size, attributsMultiSources: multi }, alertSettings: DEFAULT_ALERT_SETTINGS };
}

/** Modèle d'exécution construit à partir des correspondances validées (ou corrigées). */
export const isActive = (s: SourceConfig | undefined) => !!s && (s.status ?? "active") === "active" && s.enabled !== false;

/**
 * ACV effective : si le maître d'un attribut est désactivé, la première source
 * consommatrice active prend le relais ; sans elle, l'attribut n'est plus couvert.
 */
export function effectiveAcv(setup: ImportedSetup): { acv: Acv; fallbacks: { attribute: string; from: string; to: string | null }[] } {
  const active = new Set(setup.sources.filter(isActive).map(s => s.id));
  const fallbacks: { attribute: string; from: string; to: string | null }[] = [];
  const attributes = setup.acv.attributes.map(a => {
    const m = a.master ?? setup.acv.domainMasters[a.domain];
    if (!m || active.has(m)) return { ...a, consumers: a.consumers.filter(c => active.has(c)) };
    const next = a.consumers.find(c => active.has(c)) ?? null;
    fallbacks.push({ attribute: `${a.domain}.${a.attribute}`, from: m, to: next });
    return { ...a, master: next ?? undefined, consumers: a.consumers.filter(c => active.has(c) && c !== next) };
  });
  const dm = { ...setup.acv.domainMasters };
  for (const k of Object.keys(dm) as (keyof typeof dm)[]) if (dm[k] && !active.has(dm[k])) dm[k] = "";
  return { acv: { domainMasters: dm, attributes }, fallbacks };
}

export function buildTemplate(setup: ImportedSetup): { template: IntegrationTemplate; missing: string[] } {
  // Sources désactivées : plus sollicitées, leurs correspondances sont suspendues (conservées).
  const active = new Set(setup.sources.filter(isActive).map(s => s.id));
  const accepted = (setup.proposals ?? []).filter(p => active.has(p.sourceId) && p.column && (p.status === "validée" || p.status === "corrigée"));
  const missing: string[] = [];
  const bindings = {} as IntegrationTemplate["bindings"];
  for (const g of ["suppliers", "products", "facilities", "stock", "shipments", "orders", "sales"] as BindingGroup[]) {
    const o0 = setup.objects.find(x => x.group === g);
    const o = o0 && active.has(o0.sourceId) ? o0 : undefined;
    const fields: Record<string, string> = {};
    let watermark: string | undefined;
    for (const p of accepted.filter(x => x.attributeId.startsWith(`${g}.`))) {
      const f = p.attributeId.split(".")[1];
      if (f === "updated") watermark = p.column!; else fields[f] = p.column!;
    }
    if (g === "sales" && fields.date) watermark = fields.date;
    if (o) for (const a of Q_ONTOLOGY.filter(x => x.required && x.binding?.startsWith(`${g}.`))) if (!fields[a.binding!.split(".")[1]]) missing.push(`${a.objet} · ${a.attribut}`);
    bindings[g] = { source: o?.sourceId ?? "", entity: o?.entity ?? "", fields, watermark };
  }
  // Clé et watermark des entités connus : utiles à la lecture incrémentale des connecteurs.
  const sources = setup.sources.filter(isActive).map(s => {
    const entities = { ...(s.params.entities as Record<string, Record<string, unknown>>) };
    for (const b of Object.values(bindings)) if (b.source === s.id && entities[b.entity]) entities[b.entity] = { ...entities[b.entity], key: b.fields.key ?? b.fields.item ?? entities[b.entity].key, watermark: b.watermark };
    return { ...s, params: { ...s.params, entities } };
  });
  return { template: { id: "questionnaire", label: "Cartographie importée", sources, masters: effectiveAcv(setup).acv.domainMasters, bindings }, missing };
}
