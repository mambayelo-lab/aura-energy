// source-catalog.ts — catalogue des applications réellement présentes sur
// le banc de test aura-poc-paris-v2 (AWS Lightsail), reconstitué à partir de
// commandes lancées PAR L'UTILISATEUR sur la machine elle-même (docker
// inspect pour le host Traefik réel de chaque conteneur, grep sur les
// init_db.py réels pour les tables) — pas depuis un export théorique. Un
// host absent ici n'a simplement pas encore été confirmé (le conteneur
// existe peut-être quand même) ; il en va de même pour les tables. Ne rien
// inventer au-delà de ce qui a été vu sur la machine.
export type Secteur = "Retail" | "Agro" | "Industrie" | "Énergie" | "Banque" | "Assurance" | "Santé" | "Maritime" | "Public" | "Transverse";

// Thème de classement demandé pour le choix d'application : deux familles
// larges, pas un thème par secteur. "Industrie" regroupe la production
// physique et les flux industriels/énergie/maritime ; "Business" regroupe
// tout ce qui est fonction support/métier tertiaire (finance, vente,
// assurance, RH, conformité…). Dérivé du secteur plutôt que dupliqué sur
// chacune des 86 entrées — un seul endroit à ajuster si un secteur change de
// famille.
export type CatalogTheme = "Business" | "Industrie";

const SECTEUR_THEME: Record<Secteur, CatalogTheme> = {
  Retail: "Business",
  Agro: "Industrie",
  Industrie: "Industrie",
  Énergie: "Industrie",
  Banque: "Business",
  Assurance: "Business",
  Santé: "Business",
  Maritime: "Industrie",
  Public: "Business",
  Transverse: "Business",
};

export function themeForSecteur(secteur: Secteur): CatalogTheme {
  return SECTEUR_THEME[secteur];
}

export interface CatalogSource {
  id: string;           // slug du conteneur (ex. "sap-mfg-mock")
  label: string;
  secteur: Secteur;
  description: string;
  baseUrl?: string;      // confirmé via docker inspect (Traefik Host réel) — absent = non vérifié
  tables?: string[];      // confirmé via grep sur le vrai init_db.py — absent = non vérifié
  // Identifiants réellement vérifiés (login /login testé, JSON reçu) — jamais
  // inventés. Présents uniquement pour les quelques apps où l'utilisateur a
  // lui-même confirmé la connexion depuis aura-poc-paris-v2 ; absent partout
  // ailleurs, à renseigner via la pop-up d'identifiants.
  defaultCredentials?: { user: string; password: string };
}

// Une source est "confirmée" (candidate à un affichage par défaut) quand son
// host Traefik réel a été vu — jamais sur la base d'une supposition.
export function isConfirmed(s: CatalogSource): boolean {
  return !!s.baseUrl;
}

const H = "aura-mambaye.duckdns.org";

export const SOURCE_CATALOG: CatalogSource[] = [
  // ── Retail (Maison Lucie) ──────────────────────────────────────────────
  { id: "sap-mfg-mock", label: "NexERP S/4HANA (Mfg)", secteur: "Retail", description: "ERP central — finance, achats, stocks", baseUrl: `https://nexerp-mfg.${H}`, tables: ["boms", "customers", "materials", "mrp", "purchase_orders", "routings", "sales_orders", "suppliers"], defaultCredentials: { user: "mfg_admin", password: "SapMfgAura2026!" } },
  { id: "sap-mock", label: "NexERP S/4HANA", secteur: "Retail", description: "ERP central — variante", baseUrl: `https://nexerp.${H}` },
  { id: "manh-mock", label: "Meridian Active Omni", secteur: "Retail", description: "OMS/WMS — disponibilité unifiée, allocation, ship-from-store", baseUrl: `https://meridian.${H}` },
  { id: "cegid-y2-mock", label: "CegX Retail Y2", secteur: "Retail", description: "POS & gestion magasins — ventes, stocks, fidélité", baseUrl: `https://cegx.${H}`, tables: ["caisse", "clients_fidelite", "stock_magasin", "tickets_vente", "z_caisse"] },
  { id: "shopify-mock", label: "WebStore Admin", secteur: "Retail", description: "E-commerce — commandes, produits, clients web", baseUrl: `https://webstore.${H}` },
  { id: "o9-mock", label: "NinePlan Demand Planning", secteur: "Retail", description: "APS — prévision demande SKU × canal × semaine", baseUrl: `https://nineplan.${H}`, tables: ["accuracy", "drivers", "forecasts"] },
  { id: "sf-mock", label: "SkyCRM Sales Cloud", secteur: "Retail", description: "CRM — comptes B2B, opportunités, service client VIP", baseUrl: `https://skycrm.${H}` },
  { id: "akeneo-mock", label: "Akeneo PIM", secteur: "Retail", description: "PIM — attributs produit, médias, canaux e-com et retail", baseUrl: `https://akeneo.${H}` },
  { id: "trustpilot-mock", label: "Trustpilot", secteur: "Retail", description: "Avis clients", baseUrl: `https://trustpilot.${H}` },
  { id: "adobe-mock", label: "Adobe Experience", secteur: "Retail", description: "Marketing digital", baseUrl: `https://adobe.${H}` },
  { id: "centric-mock", label: "Centric PLM", secteur: "Retail", description: "PLM mode/fashion", baseUrl: `https://centric.${H}` },
  { id: "revionics-mock", label: "Revionics", secteur: "Retail", description: "Pricing science", baseUrl: `https://revionics.${H}` },
  { id: "prisync-mock", label: "Prisync", secteur: "Retail", description: "Veille prix concurrents", baseUrl: `https://prisync.${H}` },
  { id: "cgcloud-mock", label: "CGCloud", secteur: "Retail", description: "Merchandising terrain", tables: ["kpis_field", "merchandising", "orders_field", "promotions", "retailers", "visits"] },
  { id: "lightspeed-rseries-mock", label: "Lightspeed R-Series", secteur: "Retail", description: "POS restauration/retail", tables: ["sales"] },

  // ── Agro (Fromagerie du Val) ─────────────────────────────────────────────
  { id: "sage-x3-agri-mock", label: "Saje ERP X3", secteur: "Agro", description: "ERP — OFs, lots, stocks, comptabilité, achats producteurs", baseUrl: `https://saje-erp.${H}`, tables: ["articles", "commandes", "comptabilite", "production", "stocks"] },
  { id: "agriware-mock", label: "AgroWare 365", secteur: "Agro", description: "Amont agricole — collecte lait, qualité, paie producteurs", baseUrl: `https://agroware.${H}`, tables: ["collectes", "contrats", "eleveurs", "paiements", "qualite_lait"] },
  { id: "qualipro-mock", label: "QualiPlus QHSE", secteur: "Agro", description: "QMS — non-conformités, HACCP, traçabilité lots AOP", baseUrl: `https://qualiplus.${H}`, tables: ["actions_correctives", "audits_ifs", "documents", "indicateurs", "non_conformites"] },
  { id: "traceone-mock", label: "TraceX Devex PLM", secteur: "Agro", description: "PLM food — recettes, spécifications, allergènes, ingrédients", baseUrl: `https://tracex.${H}`, tables: ["allergens", "audits", "formulas", "labels", "products", "suppliers_qual"] },
  { id: "divalto-mock", label: "Divento Infinity", secteur: "Agro", description: "ERP commerce — commandes GMS, EDI, tournées livraison froid", baseUrl: `https://divento.${H}`, tables: ["articles", "clients", "commandes", "statistiques", "tournees"] },
  { id: "databricks-agro-mock", label: "DataForge Agro", secteur: "Agro", description: "Lakehouse — ingestion, ML serving", baseUrl: `https://dataforge-agro.${H}`, tables: ["catalog", "clusters", "notebooks", "pipelines", "sql_editor"] },
  { id: "dynamics-agri-mock", label: "Dynamics Agri CRM", secteur: "Agro", description: "CRM producteurs/coopérative", tables: ["accounts", "activities", "cases", "contacts", "opportunities"] },
  { id: "sap-fnb-mock", label: "SAP F&B", secteur: "Agro", description: "ERP agroalimentaire — lots, recettes, fournisseurs", tables: ["batches", "customers", "inventory", "materials", "purchase_orders", "recipes", "sales_orders", "suppliers"] },
  { id: "starlims-mock", label: "StarLIMS", secteur: "Agro", description: "LIMS laboratoire — échantillons, stabilité, tests", tables: ["coa", "instruments", "results", "samples", "stability", "tests"] },
  { id: "optesi-mock", label: "Optesi Transport", secteur: "Agro", description: "Tournées lait/froid — chauffeurs, température", tables: ["bordereaux", "chauffeurs", "temperature_log", "tournees", "vehicules"] },

  // ── Industrie (Helvex) ──────────────────────────────────────────────────
  { id: "ifxcloud-mock", label: "IFX Cloud", secteur: "Industrie", description: "ERP/EAM — OFs aéro/médical, achats matières, projets industriels", baseUrl: `https://api.ifxcloud.aura` },
  { id: "delmia-mock", label: "Dasselys 3DX / DELMIA", secteur: "Industrie", description: "Simulation atelier — goulots, ergonomie, takt time", baseUrl: `https://factorysim.${H}`, tables: ["bottlenecks", "ergonomics", "scenarios", "shopfloor_layout", "simulations", "takt_times"] },
  { id: "opcenter-mock", label: "OpCentral MES", secteur: "Industrie", description: "MES capteurs — pilotage CNC, SPC, Cpk, programmes ISO", baseUrl: `https://opcentral.${H}`, tables: ["defects", "kpis", "operations", "serial_genealogy", "tooling", "work_orders"] },
  { id: "maximo-mfg-mock", label: "NexEAM GMAO", secteur: "Industrie", description: "GMAO — maintenance préventive/corrective, actifs, MTBF", baseUrl: `https://nexeam.${H}`, tables: ["assets", "inventory", "labor", "preventive_maintenance", "work_orders"] },
  { id: "maximo-mock", label: "Maximo (variante)", secteur: "Industrie", description: "GMAO — actifs, HSE, plans", tables: ["assets", "hse", "plans", "workorders"] },
  { id: "databricks-mfg-mock", label: "DataForge OEE (Mfg)", secteur: "Industrie", description: "Lakehouse — couche gold, ML serving, OEE", baseUrl: `https://dataforge-mfg.${H}`, tables: ["notebooks", "oee_dashboard", "pipelines", "predictive_maintenance", "sql_editor"] },
  { id: "teamcenter-mock", label: "Teamcenter PLM", secteur: "Industrie", description: "PLM — CAO, nomenclatures, ECR/ECO, cycle de vie", baseUrl: `https://nexplm.${H}`, tables: ["cad_files", "ebom", "ecr_eco", "lifecycle", "parts", "suppliers_qual"] },
  { id: "aveva-mes-mock", label: "AVEVA MES", secteur: "Industrie", description: "MES — généalogie de lots, downtime, OEE", tables: ["batch_genealogy", "downtime", "kpis", "oee", "production_orders", "shifts"] },
  { id: "dynamics-mfg-mock", label: "Dynamics Mfg CRM", secteur: "Industrie", description: "CRM industriel — SAV, pièces détachées", tables: ["accounts", "field_service", "opportunities", "service_orders", "spare_parts"] },
  { id: "ftview-mock", label: "FactoryTalk View", secteur: "Industrie", description: "SCADA — alarmes, HMI, sécurité", tables: ["alarms", "events", "hmi_screens", "operators", "security", "trends"] },
  { id: "kepware-mock", label: "Kepware", secteur: "Industrie", description: "Passerelle OPC — tags, diagnostics", tables: ["alerts", "channels", "data_logs", "devices", "diagnostics", "opc_tags"] },
  { id: "infinityqs-mock", label: "InfinityQS", secteur: "Industrie", description: "SPC qualité — HACCP, non-conformités", tables: ["capabilities", "ccp_haccp", "measurements", "non_conformances", "spc_charts"] },
  { id: "qad-mock", label: "QAD ERP", secteur: "Industrie", description: "ERP manufacturing — achats, qualité", tables: ["financials", "inventory", "manufacturing_orders", "purchasing", "quality"] },
  { id: "pi-mock", label: "OSIsoft PI", secteur: "Industrie", description: "Historian industriel — tags, tendances", tables: ["events", "tags", "trends"] },
  { id: "ehs-mock", label: "EHS / ICPE", secteur: "Industrie", description: "Environnement industriel — permis, incidents ICPE", tables: ["icpe", "incidents", "permits"] },

  // ── Énergie ───────────────────────────────────────────────────────────────
  { id: "wonderwave-mock", label: "Wonderwave SCADA", secteur: "Énergie", description: "SCADA — supervision ateliers temps réel, historian, alarmes", baseUrl: `https://historian.wonderwave.aura/v2` },
  { id: "enedis-mock", label: "Enedis", secteur: "Énergie", description: "Réseau distribution — interventions, points de livraison", tables: ["interventions", "pdl"] },
  { id: "isu-mock", label: "SAP ISU", secteur: "Énergie", description: "Facturation énergie — compteurs, relevés", tables: ["bills", "collection", "meters", "reads"] },
  { id: "eex-mock", label: "EEX", secteur: "Énergie", description: "Marché de gros — clearing, PPA", tables: ["clearing", "orders", "ppa"] },
  { id: "trayport-mock", label: "Trayport", secteur: "Énergie", description: "Trading énergie — positions, P&L", tables: ["bids", "pnl", "positions"] },
  { id: "meteo-mock", label: "Météo (prévision)", secteur: "Énergie", description: "Prévision — contraintes réseau, dispatch", tables: ["constraints", "dispatch", "forecast"] },
  { id: "cite-mock", label: "CITE Bâtiment", secteur: "Énergie", description: "Gestion bâtiment — énergie, éclairage, eau, déchets", tables: ["buildings", "energy", "lighting", "waste", "water"] },

  // ── Banque ────────────────────────────────────────────────────────────────
  { id: "temenos-mock", label: "Temenos Core Banking", secteur: "Banque", description: "Core banking — comptes, cartes, prêts, conformité", tables: ["accounts", "aml_alerts", "cards", "collateral", "customers", "loans", "regulatory_reports", "statements", "transactions"] },
  { id: "murex-mock", label: "Murex", secteur: "Banque", description: "Trading — exécutions, portefeuilles, positions", tables: ["executions", "orders", "portfolios", "positions"] },
  { id: "ncino-mock", label: "nCino", secteur: "Banque", description: "Crédit commercial — dossiers, garanties, prêts", tables: ["applications", "collaterals", "collections", "leads", "loans"] },
  { id: "moodys-mock", label: "Moody's Analytics", secteur: "Banque", description: "Risque réglementaire — COREP, limites, VaR", tables: ["corep", "limits", "var"] },
  { id: "djrc-mock", label: "Dow Jones Risk & Compliance", secteur: "Banque", description: "KYC/AML — sanctions, PEP, media adverse", tables: ["adverse_media", "batch_screening", "cases", "peps", "sanctions", "watchlist"] },
  { id: "fenergo-mock", label: "Fenergo", secteur: "Banque", description: "KYC onboarding", tables: ["kyc"] },

  // ── Assurance ─────────────────────────────────────────────────────────────
  { id: "gw-policy-mock", label: "Guidewire PolicyCenter", secteur: "Assurance", description: "Gestion contrats — polices, primes, tarification", tables: ["customers", "policies", "premiums", "quotes", "rating", "renewals"] },
  { id: "gw-claim-mock", label: "Guidewire ClaimCenter", secteur: "Assurance", description: "Gestion sinistres — experts, paiements, recours", tables: ["claims", "experts", "payments", "recoveries"] },
  { id: "sapiens-mock", label: "Sapiens", secteur: "Assurance", description: "Réassurance — réserves, traités", tables: ["reserves", "treaties"] },
  { id: "verisk-mock", label: "Verisk", secteur: "Assurance", description: "Modélisation risque — accumulation, exposition, stress", tables: ["accumulation", "exposure", "governance", "pricing", "reports", "stress"] },
  { id: "sf-ins-mock", label: "Salesforce Insurance Cloud", secteur: "Assurance", description: "Courtage — courtiers", tables: ["brokers"] },
  { id: "mar-eos-mock", label: "Marine EOS", secteur: "Assurance", description: "Assurance maritime — sinistres, réserves", tables: ["adjusters", "claims", "payments", "recoveries", "reserve_summary", "reserves"] },
  { id: "mar-iris-mock", label: "Marine IRIS", secteur: "Assurance", description: "Tarification risque maritime", tables: ["exposure", "portfolio", "pricing_support", "risk_scores", "scenarios"] },
  { id: "mar-lloyds-mock", label: "Lloyd's Market", secteur: "Assurance", description: "Marché Lloyd's — bordereaux, syndicats, traités", tables: ["bordereaux", "capacity", "compliance", "surveys", "syndicates", "treaties"] },
  { id: "mar-sequel-mock", label: "Sequel", secteur: "Assurance", description: "Réassurance — polices, primes, certificats", tables: ["certificates", "financials", "members", "policies", "premium_calls", "quotes", "reinsurance"] },

  // ── Santé ─────────────────────────────────────────────────────────────────
  { id: "epic-mock", label: "Epic DPI", secteur: "Santé", description: "Dossier patient — admissions, prescriptions, séjours", tables: ["acts", "admissions", "carepaths", "discharges", "patients", "prescriptions", "records", "stays"] },
  { id: "bedtrack-mock", label: "BedTrack", secteur: "Santé", description: "Gestion lits — occupation, soignants", tables: ["beds", "caregivers", "occupancy", "shifts"] },
  { id: "maincare-mock", label: "Maincare", secteur: "Santé", description: "Facturation hospitalière — PMSI", tables: ["has", "invoices", "pmsi"] },
  { id: "pharmait-mock", label: "PharmaIT", secteur: "Santé", description: "Pharmacovigilance — effets indésirables", tables: ["adverse", "devices", "drugs"] },

  // ── Maritime ──────────────────────────────────────────────────────────────
  { id: "mar-ihs-mock", label: "IHS Markit Maritime", secteur: "Maritime", description: "Registre navires — classe, avaries, escales", tables: ["casualties", "class_certs", "documents", "owners", "port_calls", "vessels"] },
  { id: "seaweb-mock", label: "SeaWeb", secteur: "Maritime", description: "Sanctions & registre navires", tables: ["casualties", "class_records", "owners", "port_calls", "sanctions", "vessels"] },
  { id: "mar-marinetraffic-mock", label: "MarineTraffic", secteur: "Maritime", description: "Suivi AIS — position, arrivées, historique voyage", tables: ["alerts", "expected_arrivals", "live_map", "port_activity", "vessel_finder", "voyage_history"] },
  { id: "windward-mock", label: "Windward", secteur: "Maritime", description: "Risque maritime — activités suspectes, sanctions", tables: ["ais_tracks", "alerts", "dark_activities", "port_calls", "risk_scores", "sanctions_proximity"] },
  { id: "ptv-mock", label: "PTV Traffic", secteur: "Maritime", description: "Trafic/lignes — incidents", tables: ["incidents", "lines", "traffic"] },

  // ── Secteur public ────────────────────────────────────────────────────────
  { id: "gru-mock", label: "GRU Citoyens", secteur: "Public", description: "Relation citoyen — participation, procédures", tables: ["citizens", "participation", "procedures"] },
  { id: "bl-mock", label: "Bibliothèque & Action Sociale", secteur: "Public", description: "Médiathèque, enfance, social", tables: ["enfance", "mediatheque", "social"] },
  { id: "ciril-mock", label: "Ciril GFI", secteur: "Public", description: "Finances publiques — budget, marchés", tables: ["budget", "iso", "procurement"] },
  { id: "genetec-mock", label: "Genetec Sécurité", secteur: "Public", description: "Vidéoprotection — accès, caméras", tables: ["access", "alerts", "cameras"] },

  // ── Transverse ────────────────────────────────────────────────────────────
  { id: "workday-mock", label: "Workday", secteur: "Transverse", description: "RH — collaborateurs, paie", baseUrl: `https://workday.${H}` },
  { id: "shippeo-mock", label: "Shippeo", secteur: "Transverse", description: "Visibilité transport temps réel", baseUrl: `https://shippeo.${H}` },
  { id: "dnb-mock", label: "Dun & Bradstreet", secteur: "Transverse", description: "Data & scoring tiers", baseUrl: `https://dnb.${H}` },
  { id: "sustainalytics-mock", label: "Sustainalytics", secteur: "Transverse", description: "Notation ESG", baseUrl: `https://sustainalytics.${H}` },
  { id: "hubspot-mock", label: "HubSpot", secteur: "Transverse", description: "CRM/marketing — contacts, deals", tables: ["contacts", "deals"] },
  { id: "zendesk-mock", label: "Zendesk", secteur: "Transverse", description: "Support client — tickets", tables: ["tickets"] },
  { id: "iam-mock", label: "IAM / SSO", secteur: "Transverse", description: "Identité — utilisateurs, sessions, consentements", tables: ["consents", "sessions", "users"] },
  { id: "snowflake-mock", label: "Snowflake", secteur: "Transverse", description: "Data warehouse — historique de requêtes", tables: ["query_history"] },
  { id: "nuxeo-mock", label: "Nuxeo GED", secteur: "Transverse", description: "Gestion documentaire", tables: ["assets"] },
  { id: "sf-eu-mock", label: "Salesforce EU Cloud", secteur: "Transverse", description: "CRM — cas, contrats, fidélité", tables: ["cases", "contracts", "leads", "loyalty"] },
  { id: "sf-mfg-mock", label: "Salesforce Manufacturing Cloud", secteur: "Transverse", description: "CRM industriel — SAV, pièces", tables: ["accounts", "forecasts", "opportunities", "service_agreements", "spare_parts"] },
];

export const CATALOG_SECTEURS: Secteur[] = ["Retail", "Agro", "Industrie", "Énergie", "Banque", "Assurance", "Santé", "Maritime", "Public", "Transverse"];
