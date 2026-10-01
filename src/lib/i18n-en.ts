// Dictionnaire français → anglais de l'interface Supply et Décider : phrases
// exactes, vocabulaire (objets, attributs, indicateurs, règles, options, démos)
// et motifs pour les textes dynamiques. Les identifiants (SUP-001, WH-PAR…),
// les noms propres et les valeurs saisies restent inchangés.

// ── Vocabulaire métier (objets, attributs, indicateurs, règles, options) ──
export const EN_WORDS: Record<string, string> = {
  // Objets métier
  "Fournisseur": "Supplier", "Article": "Item", "Site": "Site", "Stock": "Stock", "Commande d'achat": "Purchase order", "Commande d’achat": "Purchase order",
  "Expédition": "Shipment", "Prévision de demande": "Demand forecast", "Perturbation": "Disruption", "Commande client": "Customer order",
  "Fournisseurs": "Suppliers", "Articles": "Items", "Sites": "Sites", "Stocks": "Stocks", "Expéditions": "Shipments",
  // Attributs
  "Risque de capacité": "Capacity risk", "Capacité confirmée": "Confirmed capacity", "Risque géopolitique": "Geopolitical risk",
  "Désignation": "Description", "Délai d'approvisionnement": "Lead time", "Nom du site": "Site name", "Type de site": "Site type",
  "Pays du site": "Site country", "Capacité du site": "Site capacity", "Stock réservé": "Reserved stock", "Stock de sécurité": "Safety stock",
  "Demande journalière": "Daily demand", "Quantité": "Quantity", "Site de destination": "Destination site", "Quantité confirmée": "Confirmed quantity",
  "Identifiant expédition": "Shipment ID", "Identifiant commande d'achat": "Purchase order ID", "Transporteur": "Carrier", "Origine": "Origin",
  "Destination": "Destination", "Arrivée prévue": "Expected arrival", "Heures de retard": "Delay hours", "Statut": "Status",
  "Quantité prévue": "Forecast quantity", "Identifiant de promotion": "Promotion ID", "Écart de prévision (%)": "Forecast gap (%)",
  "Confiance de prévision": "Forecast confidence", "Semaine": "Week", "Type de perturbation": "Disruption type", "Intitulé": "Title",
  "Gravité": "Severity", "Statut de la perturbation": "Disruption status", "Retard estimé": "Estimated delay", "Quantité commandée": "Ordered quantity",
  "Date demandée": "Requested date", "Couverture en jours": "Coverage in days", "Stock en transit": "Stock in transit", "leviers": "levers", "leviers ·": "levers ·", "levier": "lever", "indicateurs": "indicators", "indicateur": "indicator", "contrainte(s) ·": "constraint(s) ·", "risque(s)": "risk(s)", "risque →": "risk →", "potentiel ↑": "potential ↑", "Alerte": "Alert", "options ·": "options ·", "objectifs ·": "objectives ·", "critères ·": "criteria ·", "Identifiant fournisseur": "Supplier ID", "SKU": "SKU", "Baseline": "Baseline", "Identifiant commande": "Order ID", "Identifiant article": "Item ID", "Identifiant site": "Site ID", "Client": "Customer", "Site de livraison": "Delivery site", "Couverture": "Coverage",
  // Indicateurs
  "Risque de capacité fournisseur": "Supplier capacity risk", "Couverture de stock": "Stock coverage", "Retard transport": "Transport delay",
  "Écart de prévision hors promotion": "Forecast gap excluding promotion", "Écart de prévision": "Forecast gap", "Risque global fournisseur": "Overall supplier risk",
  "Risque géopolitique fournisseur": "Supplier geopolitical risk", "Capacité fournisseur": "Supplier capacity",
  // Règles et alertes
  "Risque de rupture fournisseur": "Supplier shortage risk", "Couverture de stock sous seuil": "Stock coverage below threshold",
  "Surstock ou obsolescence": "Overstock or obsolescence", "Dégradation OTIF/qualité fournisseur": "Supplier OTIF/quality degradation",
  "Prévision de demande en dérive": "Drifting demand forecast", "Capacité insuffisante": "Insufficient capacity", "Marge menacée par coûts supply": "Margin threatened by supply costs",
  "Risque géopolitique/pays": "Geopolitical/country risk", "Défaillance d'un nœud logistique": "Logistics node failure", "Allocation sous pénurie": "Allocation under shortage",
  "Changement produit/nomenclature à risque": "Risky product/BOM change", "Donnée supply incohérente": "Inconsistent supply data", "Configuration réseau sous-optimale": "Suboptimal network configuration",
  "Risque de transformation SI Supply": "Supply IS transformation risk", "Retard transport critique": "Critical transport delay",
  // Options des règles
  "Accélérer les commandes (expedite)": "Expedite orders", "Double sourcing": "Dual sourcing", "Stock tampon": "Buffer stock", "Substitution": "Substitution",
  "Allocation": "Allocation", "Reconception": "Redesign", "Soutien fournisseur": "Supplier support", "Réapprovisionnement": "Replenishment", "Transfert inter-site": "Inter-site transfer",
  "Allocation client": "Customer allocation", "Accélérer une livraison": "Expedite a delivery", "Ajustement du stock de sécurité": "Safety stock adjustment",
  "Air / rail / route": "Air / rail / road", "Reroutage": "Rerouting", "Split shipment": "Split shipment", "Transfert de stock": "Stock transfer", "Fournisseur alternatif": "Alternative supplier",
  "Replanification": "Replanning", "Modèle alternatif": "Alternative model", "Override documenté": "Documented override", "Scénario haut/bas": "High/low scenario", "Report achats": "Postpone purchases",
  "Capacité flexible": "Flexible capacity", "Stock stratégique": "Strategic stock", "Dual source": "Dual source", "Nearshore": "Nearshore", "Reroute": "Reroute", "Redesign": "Redesign",
  "Contrats optionnels": "Option contracts", "Attendre et surveiller": "Wait and monitor",
  // Données de démonstration Maison Lucie
  "Coffret cadeau premium gainé": "Premium covered gift box", "Sac Orion cuir grainé": "Orion grained-leather bag", "Fermoir Aurora laiton doré": "Aurora gilded brass clasp",
  "Carré Azur twill de soie 90": "Azur silk twill scarf 90", "Étole Mira mousseline de soie": "Mira silk chiffon stole", "Ceinture Vega réversible": "Vega reversible belt",
  "Portefeuille Céleste compact": "Céleste compact wallet", "Entrepôt Paris-Nord (Gonesse)": "Paris-North warehouse (Gonesse)", "Entrepôt Lille-Lesquin": "Lille-Lesquin warehouse",
  "Entrepôt Lyon-Saint-Priest": "Lyon-Saint-Priest warehouse", "Atelier de maroquinerie de Vendôme": "Vendôme leather workshop", "Atelier de Vendôme": "Vendôme workshop",
  "Accessoires métal": "Metal accessories", "Vente privée clients VIC": "VIC private sale", "Pré-collection des fêtes": "Holiday pre-collection",
  "Grève des dockers — port du Havre": "Dockers' strike — port of Le Havre", "Contrôle douanier renforcé — Marseille-Fos (origine métal)": "Tightened customs checks — Marseille-Fos (metal origin)",
  "Documents CITES incomplets — fret aérien cuir": "Incomplete CITES documents — leather air freight", "Défaut de placage — lot ZIP-ARGENT L4471": "Plating defect — batch ZIP-ARGENT L4471",
  "Déroutement mer Rouge via le Cap": "Red Sea diversion via the Cape", "Fermeture temporaire tunnel du Mont-Blanc (neige)": "Temporary closure of the Mont-Blanc tunnel (snow)",
  "Maintenance métiers à tisser — Tessitura Milano": "Loom maintenance — Tessitura Milano", "Hô Chi Minh-Ville": "Ho Chi Minh City", "Côme": "Como",
  "Entrepôt": "Warehouse", "Atelier": "Workshop", "Boutique": "Store", "Usine": "Plant", "France": "France", "Italie": "Italy", "Chine": "China", "Inde": "India", "Turquie": "Turkey", "Viêt Nam": "Vietnam", "Maroc": "Morocco", "Tunisie": "Tunisia", "Japon": "Japan", "États-Unis": "United States",
  "Grève": "Strike", "Douane": "Customs", "Météo": "Weather", "Qualité": "Quality", "Géopolitique": "Geopolitics", "En cours": "Ongoing", "Résolue": "Resolved", "Critique": "Critical", "Majeure": "Major", "Mineure": "Minor",
  "En transit": "In transit", "Livrée": "Delivered", "Retardée": "Delayed", "Confirmée": "Confirmed", "Ouverte": "Open", "Clôturée": "Closed", "Haute": "High", "Moyenne": "Medium", "Basse": "Low",
  // Échelles et niveaux
  "NUL": "NONE", "Nul": "None", "Faible": "Low", "Moyen": "Medium", "Élevé": "High", "Haut": "High", "Fort": "Strong", "nul": "none", "faible": "low", "moyen": "medium", "fort": "strong",
  "Essentiel": "Essential", "Important": "Important", "Secondaire": "Secondary", "Élevée": "High",
  "critique": "critical", "alerte": "alert", "majeure": "major", "jours": "days", "jour": "day", "semaines": "weeks", "mois": "months",
};

// ── Phrases de l'interface ──
import { EN_UI } from "./i18n-en-ui";
import { EN_DEMOS } from "./i18n-en-demos";
export const EN_PHRASES: Record<string, string> = {
  ...EN_UI, ...EN_DEMOS,
  // Navigation et coque
  "Cockpit": "Cockpit", "Studio": "Studio", "Décision": "Decision", "Compte": "Account", "Accueil": "Home", "Nouvelle décision": "New decision", "+ Nouvelle décision": "+ New decision",
  "Démonstrations": "Demos", "Réduire le menu": "Collapse menu", "Fermer le menu": "Close menu", "Ouvrir le menu": "Open menu", "Menu": "Menu",
  "Équipe & accès": "Team & access", "Abonnement": "Subscription", "Déconnexion": "Sign out", "Connexion": "Sign in", "Plus d'outils": "More tools",
  "Aura pose les questions, vous répondez à voix haute": "Aura asks the questions, you answer out loud", "Choisir une décision": "Choose a decision", "Choisir une autre décision": "Choose another decision",
  "SUPPLY CHAIN": "SUPPLY CHAIN", "Aura Supply Chain": "Aura Supply Chain", "Anticipe les risques. Éclaire les décisions.": "Anticipates risks. Informs decisions.", "Mode d'affichage": "Display mode",
  "DÉCIDER": "DECIDE", "Décider": "Decide", "Décider →": "Decide →",
  // Studio
  "Paramétrer avec Aura": "Set up with Aura", "source(s) connectée(s)": "connected source(s)", "métadonnée(s)": "metadata", "ontologie couverte": "ontology covered", "Persistance locale": "Local storage",
  "Persisté côté Studio": "Saved in Studio", "Synchronisation…": "Syncing…", "Chargement…": "Loading…", "Connecter": "Connect", "Modéliser": "Model", "Mapper": "Map", "Raisonner": "Reason", "Publier": "Publish",
  "Sources": "Sources", "Métadonnées & échantillons": "Metadata & samples", "Indicateurs & seuils": "Indicators & thresholds", "Objets métier": "Business objects", "Mapping": "Mapping",
  "Règles & alertes": "Rules & alerts", "Ontologie vivante": "Living ontology", "Vers le cockpit": "To the cockpit", "Phases du Studio": "Studio phases", "Pages de la phase": "Phase pages",
  "Terminé": "Done", "En cours": "In progress", "À faire": "To do", "Sections de la page": "Page sections",
  "Connecter une application": "Connect an application", "Repartir de zéro": "Start from scratch", "Démo en un clic": "One-click demo", "Recharger la démo Maison Lucie": "Reload the Maison Lucie demo",
  "Charger la démo Maison Lucie": "Load the Maison Lucie demo", "Réinitialiser la démo": "Reset the demo", "Données de démonstration — SI synthétique Maison Lucie": "Demo data — Maison Lucie synthetic IS",
  "Démo chargée": "Demo loaded", "Charger la démo": "Load the demo",
  "Données :": "Data:", "À fournir :": "To provide:", "Données": "Data", "À fournir": "To provide",
  "Commandes d'achat, stocks, fournisseurs, délais de livraison.": "Purchase orders, stocks, suppliers, delivery lead times.",
  "URL OData du service, utilisateur technique et mot de passe (ou OAuth).": "Service OData URL, technical user and password (or OAuth).",
  "Commandes clients, opportunités et prévisions de ventes.": "Customer orders, opportunities and sales forecasts.",
  "URL de l'instance, application connectée : identifiant client et secret (OAuth).": "Instance URL, connected app: client ID and secret (OAuth).",
  "Commandes, stocks et clients (Supply Chain Management).": "Orders, stocks and customers (Supply Chain Management).",
  "URL de l'environnement, application Entra ID : identifiant client et secret.": "Environment URL, Entra ID application: client ID and secret.",
  "Commandes d'achat, réceptions, fournisseurs.": "Purchase orders, receipts, suppliers.", "URL du service (REST ou SOAP), utilisateur et mot de passe.": "Service URL (REST or SOAP), user and password.",
  "bientôt disponible": "coming soon", "Historique et indicateurs consolidés (demande, service, stocks).": "History and consolidated indicators (demand, service, stocks).",
  "Bientôt disponible (authentification par paire de clés). En attendant : export CSV ci-dessous.": "Coming soon (key-pair authentication). Meanwhile: CSV export below.",
  "Importer un CSV": "Import a CSV", "Fichier CSV ou JSON": "CSV or JSON file", "Tout export tabulaire : stocks, commandes, prévisions.": "Any tabular export: stocks, orders, forecasts.",
  "L'URL du fichier (et une clé d'API si le lien est protégé).": "The file URL (and an API key if the link is protected).", "Autre API": "Other API", "REST, SOAP, GraphQL, MCP": "REST, SOAP, GraphQL, MCP",
  "Toute table exposée par une API de votre SI.": "Any table exposed by an API of your IS.", "URL de base, méthode d'authentification et une première table à lire.": "Base URL, authentication method and a first table to read.",
  "Entrepôt de données": "Data warehouse", "Fichier": "File", "démo": "demo", "Maison Lucie": "Maison Lucie",
  "un SI fictif complet (ERP, WMS, TMS, risques fournisseurs).": "a complete fictional IS (ERP, WMS, TMS, supplier risk).", "rien, identifiants de démonstration inclus.": "nothing, demo credentials included.",
  "Applications connectées": "Connected applications", "● Connectée": "● Connected", "○ Configurée": "○ Configured", "Identifiants": "Credentials", "Identifiants ✓": "Credentials ✓",
  "Configurer les identifiants": "Configure credentials", "Identifiants configurés": "Credentials configured", "Supprimer": "Delete",
  "Nom": "Name", "Accès": "Access", "Méthode d'authentification": "Authentication method", "URL": "URL", "Première table ou route": "First table or route", "Utilisateur": "User",
  "URL du jeton": "Token URL", "Identifiant client": "Client ID", "Mot de passe": "Password", "Clé API": "API key", "Secret client": "Client secret", "Jeton": "Token",
  "OAuth 2.0 (client credentials)": "OAuth 2.0 (client credentials)", "Utilisateur / mot de passe": "User / password", "Jeton (Bearer)": "Token (Bearer)", "Aucune": "None",
  "Variable Vercel (recommandé)": "Vercel variable (recommended)", "Saisir pour cette session": "Enter for this session", "Secret": "Secret",
  "Ajoutez dans Vercel (Settings → Environment Variables) :": "Add in Vercel (Settings → Environment Variables):", ", puis redéployez.": ", then redeploy.",
  "Le secret est lu côté serveur dans les variables d'environnement : il n'est jamais envoyé ni stocké dans le navigateur. Seule la référence est enregistrée.": "The secret is read server-side from environment variables: it is never sent to or stored in the browser. Only the reference is saved.",
  "Le secret saisi reste en mémoire le temps de la session et n'est jamais enregistré (ni navigateur, ni serveur). Pour une connexion durable, utilisez une variable Vercel.": "The secret you enter stays in memory for the session and is never saved (neither browser nor server). For a lasting connection, use a Vercel variable.",
  "Tester la connexion": "Test connection", "Connecter et lire les données": "Connect and read the data", "Connexion…": "Connecting…",
  "Renseignez le nom, l'URL et les identifiants de la méthode choisie.": "Enter the name, the URL and the credentials of the chosen method.", "Indiquez une première table ou route à lire.": "Enter a first table or route to read.",
  "Source connectée : métadonnées et échantillons lus.": "Source connected: metadata and samples read.",
  "Les règles Supply Chain Aura sont déjà disponibles. Connectez ici les sources qui fourniront leurs valeurs, sans créer de mapping automatique.": "Aura Supply Chain rules are already available. Connect here the sources that will provide their values, without creating any automatic mapping.",
  "Installe les sources Maison Lucie, lit leurs données, charge le modèle objet, valide les mappings proposés (≥ 75 %) et publie les alertes réelles vers le cockpit.": "Installs the Maison Lucie sources, reads their data, loads the object model, validates the proposed mappings (≥ 75%) and publishes the real alerts to the cockpit.",
  "Aucune application connectée. Commence par une source REST/OAuth2 ou MCP.": "No connected application. Start with a REST/OAuth2 or MCP source.",
  "MÉTADONNÉES & ÉCHANTILLONS": "METADATA & SAMPLES", "Observer ce que le SI expose réellement": "See what the IS really exposes",
  "Les colonnes découvertes deviennent des champs sources ; leurs valeurs d’échantillon alimentent ensuite le moteur de mapping.": "Discovered columns become source fields; their sample values then feed the mapping engine.",
  "Actualiser les données Maison Lucie": "Refresh the Maison Lucie data", "Actualisation…": "Refreshing…", "lignes · lu le": "rows · read on", "champ déclaré · non branché": "declared field · not connected",
  "Les grandeurs suivies par Aura Supply Chain": "The quantities tracked by Aura Supply Chain",
  "Chaque indicateur porte son sens (au-dessus ou en dessous = alerte) et ses seuils ; les règles causales s'appuient sur ces seuils.": "Each indicator has its direction (above or below = alert) and its thresholds; causal rules rely on these thresholds.",
  "✦ Suggérer un vocabulaire métier": "✦ Suggest a business vocabulary", "Annuler la dernière modification du modèle": "Undo the last model change", "Rétablir": "Redo", "↶ Annuler": "↶ Undo", "↷ Rétablir": "↷ Redo",
  "Rétablir la modification annulée": "Redo the undone change", "Versions": "Versions", "Domaine métier (ex. Retail, Énergie…)": "Business domain (e.g. Retail, Energy…)",
  "Déclenche (ou non) le flux Comprendre → Impacter → Arbitrer et les règles causales — reste visible dans tous les cas": "Triggers (or not) the Understand → Impact → Arbitrate flow and the causal rules — stays visible in all cases",
  "Propriétaire": "Owner", "Nom de l'indicateur (ex. Capacité fournisseur)": "Indicator name (e.g. Supplier capacity)", "Nom du nouvel indicateur": "Name of the new indicator", "Unité": "Unit",
  "Unité du nouvel indicateur": "Unit of the new indicator", "Seuil d'alerte du nouvel indicateur": "Alert threshold of the new indicator", "Seuil critique du nouvel indicateur": "Critical threshold of the new indicator",
  "Modèle de référence": "Reference model", "OBJETS MÉTIER": "BUSINESS OBJECTS", "Le modèle cible : objets, attributs, relations": "The target model: objects, attributes, relationships",
  "Le vocabulaire qui structure les mappings et l'ontologie vivante.": "The vocabulary that structures the mappings and the living ontology.", "Modèle objet de référence Aura Supply Chain": "Aura Supply Chain reference object model",
  "Fournisseur, Article, Stock, Commande d’achat, Expédition, Prévision de demande et leurs relations. Structure seulement : les valeurs viendront de vos sources, après mapping.": "Supplier, Item, Stock, Purchase order, Shipment, Demand forecast and their relationships. Structure only: the values will come from your sources, after mapping.",
  "Modèle chargé": "Model loaded", "Charger le modèle Supply Chain": "Load the Supply Chain model", "Graphe de l'ontologie": "Ontology graph", "relations · cliquer un objet pour le déplier": "relationships · click an object to expand it",
  "Tout déplier": "Expand all", "Tout replier": "Collapse all", "✦ Générer par IA": "✦ Generate with AI", "Réorganiser": "Rearrange", "dans les seuils": "within thresholds",
  "Cliquer pour changer la cardinalité (1-1 → 1-N → N-N)": "Click to change the cardinality (1-1 → 1-N → N-N)", "attributs sourcés": "sourced attributes", "Seuils et relations": "Thresholds and relationships",
  "Proposer des objets pour le domaine": "Propose objects for the domain", "Relancer la mise en page automatique": "Rerun the automatic layout", "Graphe de l'ontologie Supply Chain": "Supply Chain ontology graph",
  "Couverture du mapping": "Mapping coverage", "attributs branchés ·": "attributes connected ·", "Voir dans le Lignage": "View in the Lineage", "non branché": "not connected", "Tout est branché": "Everything is connected",
  "À compléter seulement": "Only what's missing", "branché(s) sur": "connected out of", "Lignage": "Lineage", "Vue du mapping": "Mapping view",
  "(toujours — pas de condition)": "(always — no condition)", "Ajouter un mapping — rapprochement sémantique": "Add a mapping — semantic matching", "✦ Affiner avec l'IA": "✦ Refine with AI",
  "Choisissez l'indicateur, puis la colonne source qui le mesure (ex. Capacité fournisseur ← supplierRiskAssessments.capacityRisk).": "Choose the indicator, then the source column that measures it (e.g. Supplier capacity ← supplierRiskAssessments.capacityRisk).",
  "Choisir un indicateur…": "Choose an indicator…", "Choisir une colonne source…": "Choose a source column…", "Ajouter le mapping": "Add the mapping",
  "Le moteur combine similarité sémantique, métadonnées et échantillons avec une analyse LLM ; le branchement et la source MASTER restent validés humainement.": "The engine combines semantic similarity, metadata and samples with an LLM analysis; the connection and the MASTER source remain validated by a human.",
  "Mapping hybride gouverné : le moteur mesure la similarité des métadonnées et la compatibilité des échantillons ; le LLM contextualise seulement les cinq meilleurs candidats. Aucun branchement n'est publié sans validation humaine.": "Governed hybrid mapping: the engine measures metadata similarity and sample compatibility; the LLM only puts the five best candidates in context. No connection is published without human validation.",
  "Supprimer ce mapping": "Delete this mapping", "Indicateur à mapper": "Indicator to map",
  "Double-run legacy/nouveau SI : ce mapping n'est actif que sous cette condition — un autre mapping du même indicateur peut prendre le relais selon l'état de la règle.": "Legacy/new IS double run: this mapping is only active under this condition — another mapping of the same indicator can take over depending on the rule state.",
  "RÈGLES & ALERTES": "RULES & ALERTS", "Alertes et règles causales éditables": "Editable alerts and causal rules",
  "Une alerte surveille un indicateur, une règle causale en croise plusieurs ; chacune ouvre une décision quand elle se déclenche. Seules les valeurs réellement mappées la font déclencher.": "An alert monitors one indicator, a causal rule combines several; each opens a decision when it triggers. Only really mapped values make it trigger.",
  "Une": "An", "surveille un seul indicateur ; une": "monitors a single indicator; a", "règle causale": "causal rule",
  "en relie au moins deux. Toutes se modifient, se dupliquent, se désactivent et se suppriment ici.": "links at least two. All can be edited, duplicated, disabled and deleted here.",
  "+ Nouvelle règle causale": "+ New causal rule", "✦ Suggérer selon le domaine": "✦ Suggest for the domain", "Règles causales (": "Causal rules (", "Désactivées (": "Disabled (", "À valider (": "To validate (",
  "règles ·": "rules ·", "active(s) en surbrillance · clic : éditer · glisser : déplacer": "active highlighted · click: edit · drag: move", "RÈGLES": "RULES", "CONCLUSION ET OPTIONS": "CONCLUSION AND OPTIONS",
  "Filtrer les règles": "Filter the rules", "Rechercher une règle": "Search a rule", "Présentation des règles": "Rules layout", "Graphe causal des règles": "Causal graph of the rules",
  "La capacité du fournisseur ne couvre plus les commandes engagées : risque de rupture d'approvisionnement.": "The supplier's capacity no longer covers the committed orders: risk of supply shortage.",
  "Le stock disponible ne couvre plus la demande jusqu'au prochain réapprovisionnement : risque de rupture sur le site.": "Available stock no longer covers demand until the next replenishment: risk of stockout at the site.",
  "Une expédition entrante accuse un retard critique : les besoins qu'elle devait couvrir sont menacés.": "An inbound shipment is critically late: the needs it was to cover are threatened.",
  "La prévision promue s'écarte de la baseline au-delà de l'effet promotionnel planifié : achats, stock et capacité reposent sur une demande incertaine.": "The promoted forecast deviates from the baseline beyond the planned promotional effect: purchasing, stock and capacity rely on uncertain demand.",
  "Un fournisseur est exposé à un risque géopolitique élevé : le flux qu'il alimente peut être interrompu.": "A supplier is exposed to high geopolitical risk: the flow it feeds may be interrupted.",
  "Préparation": "Preparation", "Objets, attributs, sources et couverture": "Objects, attributes, sources and coverage",
  "Vue consolidée du modèle cible et des mappings validés : provenance, source MASTER et couverture restent traçables avant publication.": "Consolidated view of the target model and the validated mappings: origin, MASTER source and coverage remain traceable before publication.",
  "Préparation du vocabulaire": "Vocabulary readiness", "Ce que Copilote Décideur peut réellement exploiter aujourd'hui.": "What the Decision Copilot can really use today.", "Couverture (mappés)": "Coverage (mapped)",
  "Fraîcheur (valeur dérivable)": "Freshness (derivable value)", "Confiance des mappings": "Mapping confidence", "Gouvernance (propriétaire)": "Governance (owner)", "Objets métier (modèle entités-relations)": "Business objects (entity-relationship model)",
  "rattaché": "attached", "Ce que Copilote Décideur voit réellement — un indicateur du vocabulaire minimal, sa golden source, et la valeur qui en résulte aujourd'hui.": "What the Decision Copilot really sees — an indicator of the minimal vocabulary, its golden source, and the resulting value today.",
  "Valeur dérivée": "Derived value", "non assigné": "unassigned", "échantillon": "sample", "Objets & valeurs observées": "Objects & observed values", "branché et alimenté ·": "connected and fed ·", "branché sans valeur lue ·": "connected with no value read ·",
  "Partenaire qui livre composants, matières ou produits finis.": "Partner delivering components, materials or finished goods.", "Référence produit ou composant (SKU).": "Product or component reference (SKU).",
  "Entrepôt, atelier ou boutique où le stock est tenu et livré.": "Warehouse, workshop or store where stock is held and delivered.", "Position de stock d'un article sur un site.": "Stock position of an item at a site.",
  "Engagement d'achat auprès d'un fournisseur (une ligne article dans le SI Maison Lucie).": "Purchase commitment with a supplier (one item line in the Maison Lucie IS).",
  "Flux physique en transit qui achemine une commande d'achat.": "Physical flow in transit carrying a purchase order.", "Demande attendue par article et par semaine.": "Expected demand per item and week.",
  "Événement externe (grève, douane, météo, défaut qualité) qui retarde des flux.": "External event (strike, customs, weather, quality defect) delaying flows.",
  "Demande ferme d'un client ou d'une boutique à servir depuis un site.": "Firm demand from a customer or store to be served from a site.",
  "Synthèse": "Summary", "Faits publiés": "Published facts", "Ce que le cockpit peut consommer maintenant": "What the cockpit can use now",
  "Le cockpit lit le même vocabulaire : seules les données connectées et mappées deviennent des faits de pilotage.": "The cockpit reads the same vocabulary: only connected and mapped data become steering facts.",
  "Voir le cockpit": "View the cockpit", "faits alimentés": "fed facts", "sources actives": "active sources", "faits publiables": "publishable facts", "couverture ontologique": "ontology coverage",
  "Les secrets saisis servent uniquement à la session de connexion et ne sont jamais enregistrés dans le navigateur ni dans le brouillon Studio.": "Entered secrets are only used for the connection session and are never saved in the browser or in the Studio draft.",
  "Validation humaine avant publication": "Human validation before publication", "Valider les": "Validate the", "propositions ≥ 75 %": "proposals ≥ 75%",
  "reçoit": "receives", "est commandé par": "is ordered by", "est stocké en": "is stored in", "est acheminée par": "is carried by", "fait l'objet de": "is subject to", "détient": "holds",
  "est destinataire de": "receives", "est demandé par": "is requested by", "fournit (source principale)": "supplies (main source)", "retarde": "delays", "affecte": "affects", "livre": "delivers",
  "changer la cardinalité": "change the cardinality", "modifier": "edit", "seuils": "thresholds", "Poser des candidats": "Propose candidates", "Fermer": "Close", "Voir": "View",
  "clé": "key", "Détail de": "Details of", "Objet": "Object", "Entités": "Entities", "Options": "Options", "Indicateur": "Indicator", "Condition de": "Condition of", "Règle": "Rule", "Conclusion de": "Conclusion of",
  "Libellé de": "Label of", "Unité de": "Unit of", "Seuil d'alerte de": "Alert threshold of", "Seuil critique de": "Critical threshold of", "Sens de": "Direction of", "Champ source de": "Source field of",
  "Supprimer le mapping": "Delete the mapping",
};

type Tr = (s: string) => string;
const W = (s: string, t: Tr) => EN_WORDS[s.trim()] ?? t(s.trim());

// ── Motifs pour les textes dynamiques ──
export const EN_PATTERNS: [RegExp, (m: RegExpMatchArray, t: Tr) => string | null][] = [
  [/^(\d+) identifiant\(s\) démo$/, m => `${m[1]} demo credential(s)`],
  [/^(Libellé|Unité|Sens|Seuil d'alerte|Seuil critique|Champ source) de (.+)$/, (m, t) => `${({ "Libellé": "Label", "Unité": "Unit", "Sens": "Direction", "Seuil d'alerte": "Alert threshold", "Seuil critique": "Critical threshold", "Champ source": "Source field" } as Record<string, string>)[m[1]]} of ${W(m[2], t)}`],
  [/^Supprimer le mapping (.+) ← (.+)$/, (m, t) => `Delete the mapping ${W(m[1], t)} ← ${m[2]}`],
  [/^Supprimer (.+)$/, (m, t) => `Delete ${W(m[1], t)}`],
  [/^Détail de (.+)$/, (m, t) => `Details of ${W(m[1], t)}`],
  [/^Objet (.+)$/, (m, t) => `Object ${W(m[1], t)}`],
  [/^([A-ZÀ-Ý][^.]{1,40})\.([A-ZÀ-Ý][^.]{1,50})$/, m => { const a = EN_WORDS[m[1]] ?? EN_PHRASES[m[1]], b = EN_WORDS[m[2]] ?? EN_PHRASES[m[2]]; return a && b ? `${a}.${b}` : null; }],
  [/^(.+) — clé (.+?) — (.+)$/, (m, t) => `${W(m[1], t)} — key ${m[2]} — ${t(m[3])}`],
  [/^(.+) \((\d+-N|N-N|1-1)\) : changer la cardinalité$/, (m, t) => `${relation(m[1], t)} (${m[2]}): change the cardinality`],
  [/^(.+) : ([\d ,.]+) (.+?) \((critique|alerte|ok)\) — alerte ([≥≤]) ([\d ,.]+), critique ([\d ,.]+)$/, (m, t) => `${W(m[1], t)}: ${m[2]} ${W(m[3], t)} (${({ critique: "critical", alerte: "alert", ok: "ok" } as Record<string, string>)[m[4]]}) — alert ${m[5]} ${m[6]}, critical ${m[7]}`],
  [/^Indicateur (.+) : ([\d ,.]+) (.+), seuils$/, (m, t) => `Indicator ${W(m[1], t)}: ${m[2]} ${W(m[3], t)}, thresholds`],
  [/^Condition de (.+) : (alerte|critique) ([≥≤]) (.+)$/, (m, t) => `Condition of ${W(m[1], t)}: ${m[2] === "alerte" ? "alert" : "critical"} ${m[3]} ${m[4].replace("jours", "days")}`],
  [/^Règle (.+) \(déclenchée · (\d+) (.+)\) : modifier$/, (m, t) => `Rule ${W(m[1], t)} (triggered · ${m[2]} ${plural(m[3], t)}): edit`],
  [/^Conclusion de (.+) : modifier$/, (m, t) => `Conclusion of ${W(m[1], t)}: edit`],
  [/^déclenchée · (\d+) (.+)$/, (m, t) => `triggered · ${m[1]} ${plural(m[2], t)}`],
  [/^Entités : (.+)$/, m => `Entities: ${m[1]}`],
  [/^Options : (.+)$/, (m, t) => `Options: ${t(m[1])}`],
  [/^(\d+) attribut\(s\) à compléter$/, m => `${m[1]} attribute(s) to complete`],
  [/^Voir les (\d+)$/, m => `View all ${m[1]}`],
  [/^Poser des candidats \((\d+)\)$/, m => `Propose candidates (${m[1]})`],
  [/^(.+) \(\+(\d+)\)$/, (m, t) => `${W(m[1], t)} (+${m[2]})`],
  [/^· dernière lecture (.+)$/, m => `· last read ${m[1]}`],
  [/^(.+)…$/, (m) => truncated(m[1])],
];

function plural(s: string, t: Tr): string {
  const map: Record<string, string> = { fournisseurs: "suppliers", fournisseur: "supplier", stocks: "stocks", stock: "stock", "expéditions": "shipments", "expédition": "shipment", "prévision de demande": "demand forecast", "prévisions de demande": "demand forecasts" };
  if (map[s]) return map[s];
  if (s.endsWith("…")) { const pre = s.slice(0, -1); const k = Object.keys(map).find(x => x.startsWith(pre)); return k ? `${map[k].slice(0, Math.max(pre.length, 8))}…` : truncated(pre) ?? s; }
  return t(s);
}
function relation(s: string, t: Tr): string {
  for (const verb of Object.keys(EN_PHRASES).filter(k => /^[a-zé]/.test(k) && s.includes(` ${k} `)).sort((a, b) => b.length - a.length)) {
    const [a, b] = s.split(` ${verb} `);
    return `${W(a, t)} ${EN_PHRASES[verb]} ${W(b, t)}`;
  }
  return t(s);
}
/** Libellé tronqué « Risque de capacit… » : traduit la clé complète puis tronque. */
function truncated(prefix: string): string | null {
  const all = { ...EN_WORDS, ...EN_PHRASES };
  // « Dual source ·… » : un libellé complet suivi d'un séparateur tronqué.
  const m = prefix.match(/^(.*?)(\s*[·,;:—-]\s*)$/);
  if (m && all[m[1]]) return `${all[m[1]]}${m[2]}…`;
  const key = prefix.length >= 3 ? Object.keys(all).find(k => k.startsWith(prefix) && k.length > prefix.length) : undefined;
  if (!key) return null;
  const en = all[key];
  return `${en.slice(0, Math.max(prefix.length, 8))}…`;
}

// ── Motifs des textes générés par Aura (Décider, dialogue, arbres) ──
const Q = "« (.+?) »";
const REASON_EN: Record<string, string> = {
  "réduit l'exposition au risque": "reduces risk exposure", "ajoute un risque": "adds a risk", "allège la dépense": "lowers spending", "demande une dépense supplémentaire": "requires extra spending",
  "agit vite": "acts fast", "demande du temps de mise en place": "takes time to set up", "apporte du volume ou des revenus": "brings volume or revenue", "freine le développement": "slows growth",
  "améliore le service rendu": "improves the service delivered", "dégrade le service rendu": "degrades the service delivered", "est simple à mettre en œuvre": "is simple to implement",
  "est complexe à mettre en œuvre": "is complex to implement", "garde de la marge de manœuvre": "keeps room for manoeuvre", "réduit la marge de manœuvre": "reduces room for manoeuvre",
  "réduit les émissions": "reduces emissions", "augmente les émissions": "increases emissions",
};
const LEVEL_EN: Record<string, string> = { "faible": "low", "moyen": "medium", "fort": "strong", "élevé": "high", "nul": "none", "sans effet": "no effect" };
const SENSE_EN: Record<string, string> = { "favorable": "favourable", "défavorable": "unfavourable" };
const q = (s: string, t: Tr) => `“${W(s, t)}”`;
EN_PATTERNS.unshift(
  [/^Raison : (.+)$/, (m, t) => `Reason: ${t(m[1])}`],
  [/^Attendu : (.+)$/, (m, t) => `Expected: ${t(m[1])}`],
  [/^potentiel (\S+) · risque (\S+)$/, (m, t) => `potential ${W(m[1], t)} · risk ${W(m[2], t)}`],
  [/^alerte ([≥≤]) ([^·]+?)(?: · critique ([≥≤]) (.+))?$/, m => `alert ${m[1]} ${m[2].replace("jours", "days")}${m[3] ? ` · critical ${m[3]} ${m[4].replace("jours", "days")}` : ""}`],
  [/^"(.+)"$/, (m, t) => { const x = t(m[1]); return x === m[1] ? null : `"${x}"`; }],
  [/^(\d+) leviers?$/, m => `${m[1]} lever${m[1] === "1" ? "" : "s"}`],
  [/^(\d+) contrainte\(s\) · (\d+) risque\(s\)$/, m => `${m[1]} constraint(s) · ${m[2]} risk(s)`],
  [/^(Alerte|Critique) ([≥≤]) (.+)$/, m => `${m[1] === "Alerte" ? "Alert" : "Critical"} ${m[2]} ${m[3].replace("jours", "days")}`],
  [/^(\d+) (indicateurs|leviers|options|objectifs|critères)$/, m => `${m[1]} ${({ indicateurs: "indicators", leviers: "levers", options: "options", objectifs: "objectives", "critères": "criteria" } as Record<string, string>)[m[2]]}`],
  [/^Rapport de décision — (.+)$/, (m, t) => `Decision report — ${t(m[1])}`],
  [/^Comité — (.+)$/, (m, t) => `Committee — ${W(m[1], t)}`],
  [/^Origine : (.+)$/, (m, t) => `Origin: ${t(m[1])}`],
  [/^Attitude face au risque : (\S+) · classement ordinal Aura Décider$/, m => `Risk attitude: ${m[1] === "pessimiste" || m[1] === "Pessimiste" ? "cautious" : "bold"} · Aura Decide ordinal ranking`],
  [/^le (.+)$/, m => `on ${m[1]}`],
  [/^Justification : (.+)$/, (m, t) => `Rationale: ${t(m[1])}`],
  [/^Revue de la décision : (.+)$/, m => `Decision review: ${m[1]}`],
  [/^Source : (.+)$/, m => `Source: ${m[1]}`],
  [/^Entité concernée : (.+?)( \(aussi : (.+)\))?$/, (m, t) => `Entity concerned: ${t(m[1])}${m[2] ? ` (also: ${m[3]})` : ""}`],
  [/^(.+) · seuil (.+)$/, (m, t) => `${W(m[1], t)} · threshold ${m[2]}`],
  [/^Objet métier — Famille (.+)$/, (m, t) => `Business object — ${W(m[1], t)} family`],
  [/^(\d+) règle\(s\) déclenchée\(s\)$/, m => `${m[1]} rule(s) triggered`],
  [/^Configuration de l'ontologie — objet « (.+) »$/, (m, t) => `Ontology configuration — object “${W(m[1], t)}”`],
  [/^(.+) ; (.+)$/, (m, t) => { const parts = m[0].split(" ; "); const tr = parts.map(p => translatePhraseLocal(p, t)); return tr.every(x => x !== null) ? tr.join("; ") : null; }],
  [/^([^\p{L}]+)(\p{L}.*)$/u, (m, t) => { const x = t(m[2]); return x === m[2] ? null : `${m[1]}${x}`; }],
  [/^(.+?)( Importance : | Besoin tracé : )(.+)$/, (m, t) => `${t(m[1])}${m[2].includes("Importance") ? " Importance: " : " Traced need: "}${W(m[3], t)}`],
  [/^(potentiel|risque) (\S+) → (\S+)$/, (m, t) => `${m[1] === "potentiel" ? "potential" : "risk"} ${W(m[2], t)} → ${W(m[3], t)}`],
  [/^([\d  ]+) combinaison\(s\) de leviers aboutissent à ce résultat, mais avec au moins un point bloquant — aucune n'est propre$/, m => `${m[1]} lever combination(s) lead to this result, but with at least one blocking point — none is clean`],
  [/^(\d+) options? non dominées? : le potentiel prime, puis le risque\.$/, m => `${m[1]} non-dominated option(s): potential first, then risk.`],
  [/^Aucune dominance : les (\d+) options s'échangent des avantages critère par critère — l'arbitrage est politique, pas technique\.$/, m => `No dominance: the ${m[1]} options trade advantages criterion by criterion — the trade-off is political, not technical.`],
  [/^En attitude (Pessimiste|Optimiste), le scénario "(.+)" présente le meilleur profil gain-risque parmi les alternatives analysées\.$/, (m, t) => `With a ${m[1] === "Pessimiste" ? "cautious" : "bold"} attitude, the scenario "${W(m[2], t)}" has the best gain-risk profile among the alternatives analysed.`],
  [/^▸ Comparer (.+) vs (.+) en détail$/, (m, t) => `▸ Compare ${W(m[1], t)} vs ${W(m[2], t)} in detail`],
  [/^(\d+) options restent en lice \((.+)\) ; les autres sont dominées et peuvent être écartées\.$/, (m, t) => `${m[1]} options remain in contention (${m[2].split(", ").map(x => W(x, t)).join(", ")}); the others are dominated and can be discarded.`],
  [/^Depuis l'alerte « (.+)$/, (m, t) => `From the alert “${m[1]}`],
  [/^(.+) · (.+…) · (.+) · (.+)$/, (m, t) => [m[1], m[2], m[3], m[4]].map(x => translate1(x, t) ?? x).join(" · ")],
  [/^(.+) Hypothèse d'Aura, à confirmer$/, (m, t) => `${t(m[1])} Aura's assumption, to be confirmed`],
  [/^(.+) \(à confirmer\)\.?$/, (m, t) => { const x = t(m[1]); return x === m[1] ? null : `${x} (to be confirmed).`; }],
  [/^: (.+)$/, (m, t) => `: ${t(m[1])}`],
  [new RegExp(`^${Q} n'agit pas directement sur ${Q}$`), (m, t) => `${q(m[1], t)} has no direct effect on ${q(m[2], t)}`],
  [new RegExp(`^${Q} (fortement : |un peu : )?(.+)\\.$`), (m, t) => { const r = REASON_EN[m[3]]; return r ? `${q(m[1], t)} ${m[2] ? (m[2].startsWith("fortement") ? "strongly: " : "slightly: ") : ""}${r}.` : null; }],
  [/^Elle (.+)$/, (m) => { const body = m[1].replace(/\.$/, ""); const parts = body.split(/, (?:mais )?| mais /); const tr = parts.map(p => REASON_EN[p.trim()]); return tr.every(Boolean) ? `It ${tr.join(", ")}.` : null; }],
  [new RegExp(`^Qu'est-ce qui compte le plus : ${Q} ou ${Q} \\?$`), (m, t) => `What matters most: ${q(m[1], t)} or ${q(m[2], t)}?`],
  [new RegExp(`^${Q} devient essentiel, ${Q} secondaire\\.$`), (m, t) => `${q(m[1], t)} becomes essential, ${q(m[2], t)} secondary.`],
  [new RegExp(`^${Q} passerait devant ${Q} avec (un seul changement|(\\d+) changements)(?: \\((\\d+) façons ; voici la plus proche\\))?\\.$`), (m, t) => `${q(m[1], t)} would move ahead of ${q(m[2], t)} with ${m[4] ? `${m[4]} changes` : "a single change"}${m[5] ? ` (${m[5]} ways; here is the closest)` : ""}.`],
  [new RegExp(`^Si l'effet de ${Q} sur ${Q} devient (faible|moyen|élevé|fort) et (favorable|défavorable) \\(au lieu de (?:(faible|moyen|élevé|fort) et (favorable|défavorable)|sans effet)\\)$`), (m, t) => `If the effect of ${q(m[1], t)} on ${q(m[2], t)} becomes ${LEVEL_EN[m[3]]} and ${SENSE_EN[m[4]]} (instead of ${m[5] ? `${LEVEL_EN[m[5]]} and ${SENSE_EN[m[6]]}` : "no effect"})`],
  [new RegExp(`^Si l'importance de ${Q} passe de (.+) à (.+)$`), (m, t) => `If the importance of ${q(m[1], t)} goes from ${W(m[2], t)} to ${W(m[3], t)}`],
  [/^De (.+) à (.+)$/, (m, t) => `From ${W(m[1], t)} to ${W(m[2], t)}`],
  [new RegExp(`^À égalité avec ${Q} : le modèle ne les départage pas\\.$`), (m, t) => `Tied with ${q(m[1], t)}: the model does not separate them.`],
  [new RegExp(`^Devance ${Q} : (.+)\\.$`), (m, t) => `Ahead of ${q(m[1], t)}: ${m[2].replace(/risque (\w+) contre (\w+)/, (_, a, b) => `risk ${LEVEL_EN[a] ?? a} vs ${LEVEL_EN[b] ?? b}`).replace(/potentiel (\w+) contre (\w+)/, (_, a, b) => `potential ${LEVEL_EN[a] ?? a} vs ${LEVEL_EN[b] ?? b}`).replace("même profil, départagé par l'ordre du moteur", "same profile, separated by the engine order")}.`],
  [/^(?:(Alerte .+?) : )?choisir entre ((?:« [^»]+ »(?:, | et )?)+)(?: pour (.+?))?(?: \((.+?)\))?(?:, (.+))?\.$/, (m, t) => `${m[1] ? `${t(m[1])}: ` : ""}choose between ${m[2].replace(/« (.+?) »/g, (_, x) => q(x, t)).replace(/ et /g, " and ")}${m[3] ? ` to ${lower(t(cap(m[3])))}` : ""}${m[4] ? ` (${t(m[4])})` : ""}${m[5] ? `, ${t(m[5])}` : ""}.`],
  [new RegExp(`^Alerte ${Q}(.*)$`), (m, t) => `Alert ${q(m[1], t)}${m[2]}`],
  [/^Objectif : (.+), mesuré par (.+)\.$/, (m, t) => `Objective: ${lower(t(cap(m[1])))}, measured by ${m[2].split(" et ").map(x => lower(t(cap(x)))).join(" and ")}.`],
  [/^Critère : (.+), lu sur (.+)\.$/, (m, t) => `Criterion: ${lower(t(cap(m[1])))}, read on ${m[2].split(", ").map(x => lower(t(cap(x)))).join(", ")}.`],
  [/^Réduire : (.+)$/, (m, t) => `Reduce: ${W(m[1], t)}`],
  [/^(.+) \((\d+)\)$/, (m, t) => { const x = translate1(m[1], t); return x === null ? null : `${x} (${m[2]})`; }],
  [/^Importance de (.+)$/, (m, t) => `Importance of ${W(m[1], t)}`],
  [/^(Levier|Option|Indicateur) (.+)$/, (m, t) => `${({ Levier: "Lever", Option: "Option", Indicateur: "Indicator" } as Record<string, string>)[m[1]]} ${W(m[2], t)}`],
  [/^(.+) — (impact évalué|lien suggéré)$/, (m, t) => `${W(m[1], t)} — ${m[2] === "impact évalué" ? "assessed impact" : "suggested link"}`],
  [/^(.+) → (.+) : ([LMH]) (favorable|défavorable)( \(hypothèse Aura, à confirmer\))?$/, (m, t) => `${W(m[1], t)} → ${W(m[2], t)}: ${m[3]} ${SENSE_EN[m[4]]}${m[5] ? " (Aura assumption, to be confirmed)" : ""}`],
  [/^Potentiel (\S+) · risque (\S+) — (.+)$/, (m, t) => `Potential ${W(m[1], t)} · risk ${W(m[2], t)} — ${m[3].replace("profil possible qu'aucune combinaison n'atteint", "possible profile that no combination reaches").replace(/(\d+) combinaison\(s\) y aboutissent/, "$1 combination(s) land here").replace(/(\d+) de vos options/, "$1 of your options")}`],
  [/^(\d+) combinaison\(s\) de leviers aboutissent à ce résultat$/, m => `${m[1]} lever combination(s) lead to this result`],
  [/^Valeur (.+) ; seuil d'alerte ([≥≤]) (.+), seuil critique ([≥≤]) (.+)$/, (m, t) => `Value ${m[1].replace("jours", "days")} ; alert threshold ${m[2]} ${m[3]}, critical threshold ${m[4]} ${m[5]}`],
  [/^(\d+) sur (\d+) concernés$/, m => `${m[1]} of ${m[2]} affected`],
  [/^il y a (\d+)\s?(s|min|h|j)$/, m => `${m[1]}${m[2] === "j" ? "d" : m[2]} ago`],
  [/^Agrandir l'alerte (.+)$/, (m, t) => `Expand the alert ${W(m[1], t)}`],
  [/^Alerte (.+)$/, (m, t) => `Alert ${W(m[1], t)}`],
  [/^Chaîne de causalité de (.+)$/, (m, t) => `Causal chain of ${W(m[1], t)}`],
  [/^Tendance précédente (.+), actuelle (.+)$/, m => `Previous trend ${m[1]}, current ${m[2]}`],
  [/^Retirer (\S+) du graphe$/, m => `Remove ${m[1]} from the graph`],
  [/^Créée le (.+)$/, m => `Created on ${m[1]}`],
  [/^Décision requise : (\d+) alertes? au seuil critique$/, m => `Decision required: ${m[1]} alert${m[1] === "1" ? "" : "s"} at critical threshold`],
  [/^et (\d+) signaux? à surveiller$/, m => `and ${m[1]} signal${m[1] === "1" ? "" : "s"} to watch`],
  [/^Fraîcheur : (.+?) · Source : (.+?)( · Démonstration)?$/, (m, t) => `Freshness: ${t(m[1])} · Source: ${m[2]}${m[3] ? " · Demo" : ""}`],
  [/^(.+) \? — source : (.+)$/, (m, t) => `${t(m[1] + " ?")} — source: ${m[2]}`],
  [/^(\d+) objet\(s\) sélectionné\(s\)$/, m => `${m[1]} object(s) selected`],
  [/^Contexte : (.+)$/, (m, t) => `Context: ${t(m[1])}`],
  [/^Démarrez le suivi de « (.+) » : 1 à 3 résultats clés, une date de revue\.$/, (m, t) => `Start tracking ${q(m[1], t)}: 1 to 3 key results, a review date.`],
  [/^(.+) \+ (.+)$/, (m, t) => { const parts = m[0].split(" + "); const tr = parts.map(p => translate1(p, t)); return tr.every(x => x !== null) ? tr.join(" + ") : null; }],
  [/^(\d+) hypothèses? · (\d+) inconnues?$/, m => `${m[1]} assumption(s) · ${m[2]} unknown(s)`],
  [/^(\d+) solutions? — détail chiffré par critère$/, m => `${m[1]} solution(s) — detail by criterion`],
  [/^Cas démo enregistrés · (\d+) indicateurs · (\d+) leviers · (\d+) options$/, m => `Saved demo cases · ${m[1]} indicators · ${m[2]} levers · ${m[3]} options`],
  [/^(Pack .+?|Investissement) · (\d+) indicateurs · (\d+) leviers · (\d+) options$/, (m, t) => `${t(m[1])} · ${m[2]} indicators · ${m[3]} levers · ${m[4]} options`],
  [/^(.+) est plus favorable$/, (m, t) => `${W(m[1], t)} is more favourable`],
  [/^Concession face à (.+)$/, (m, t) => `Concession to ${W(m[1], t)}`],
  [/^Pourquoi (.+)$/, (m, t) => `Why ${W(m[1], t)}`],
  [/^· scénario « (.+) »$/, (m, t) => `· scenario ${q(m[1], t)}`],
  [/^(.+) : (.+) → (.+)$/, (m, t) => { const a = translate1(m[1], t), b = translate1(m[2], t), c = translate1(m[3], t); return a && b && c ? `${a}: ${b} → ${c}` : null; }],
);
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function lower(s: string) { return s.charAt(0).toLowerCase() + s.slice(1); }
function translate1(s: string, t: Tr): string | null {
  const tr = s.trim();
  if (tr.endsWith("…")) return truncated(tr.slice(0, -1));
  if (tr.length >= 15 && !EN_WORDS[tr] && !EN_PHRASES[tr]) { const k = Object.keys(EN_PHRASES).find(x => x.startsWith(tr) && x.length > tr.length); if (k) return EN_PHRASES[k].slice(0, Math.max(tr.length, 15)); } const x = EN_WORDS[s.trim()] ?? EN_PHRASES[s.trim()]; if (x) return x; const y = t(s.trim()); return y !== s.trim() ? y : /^[A-Z0-9\-_. ]+$/.test(s.trim()) ? s.trim() : null; }

function translatePhraseLocal(p: string, t: Tr): string | null { const x = t(p.trim()); return x !== p.trim() ? x : (EN_WORDS[p.trim()] ?? EN_PHRASES[p.trim()] ?? null); }

// Alertes calculées sur les sources (couche d'intégration).
EN_PATTERNS.unshift(
  [/^Ruptures de stock : (\d+) positions? sous le stock de sécurité$/, m => `Stockouts: ${m[1]} position(s) below safety stock`],
  [/^Retards sur la route Asie → Europe : (.+) \((\d+) % des expéditions\)$/, m => `Delays on the Asia → Europe route: ${m[1].replace(" (à rapprocher)", " (to reconcile)")} (${m[2]}% of shipments)`],
  [/^Retards fournisseur : (.+) \((\d+) % des expéditions\)$/, m => `Supplier delays: ${m[1].replace(" (à rapprocher)", " (to reconcile)")} (${m[2]}% of shipments)`],
  [/^Risque fournisseur : (.+) — (\d+) articles? en rupture, (\d+) % de retards$/, m => `Supplier risk: ${m[1]} — ${m[2]} item(s) out of stock, ${m[3]}% late`],
  [/^Comment couvrir la rupture de (.+) \((\d+) sites?\) \?$/, m => `How to cover the stockout of ${m[1]} (${m[2]} site(s))?`],
  [/^Que faire face aux retards de (.+) \?$/, m => `What to do about ${m[1]}'s delays?`],
  [/^Faut-il sécuriser l'approvisionnement auprès de (.+) \?$/, m => `Should supply from ${m[1]} be secured?`],
  [/^(\d+) alerte\(s\) publiée\(s\)\.$/, m => `${m[1]} alert(s) published.`],
  [/^(\d+) à valider$/, m => `${m[1]} to validate`],
  [/^Ligne (\d+) · (.+)$/, (m, t) => `Row ${m[1]} · ${t(m[2])}`],
);
EN_PATTERNS.unshift(
  [/^Journal des décisions \((\d+)\)$/, m => `Decision log (${m[1]})`],
  [/^(\d+) en amélioration · (\d+) en dégradation(?: · (\d+) revenue\(s\) sous le seuil)?$/, m => `${m[1]} improving · ${m[2]} deteriorating${m[3] ? ` · ${m[3]} back under the threshold` : ""}`],
  [/^Décidé dans Décider \((.+)\)$/, m => `Decided in Decide (${m[1]})`],
);
EN_PATTERNS.unshift(
  [/^Écarts entre sources : (\d+) valeurs? différentes? du maître$/, m => `Gaps between sources: ${m[1]} value(s) differing from the master`],
);
EN_PATTERNS.unshift(
  [/^D'après vos documents \((\d+) extraits? cités?\)$/, m => `From your documents (${m[1]} quoted excerpt${m[1] === "1" ? "" : "s"})`],
  [/^Joindre un document · glisser-déposer dans le fil · plusieurs fichiers ou une archive \.zip · .+$/, () => "Attach documents · drag and drop into the thread · several files or a .zip archive · PDF, Word, PowerPoint, Excel, CSV, image, SVG, draw.io, BPMN, ArchiMate, Visio, JSON, Markdown, text, zip archive"],
  [/^(.+) : synthèse (\d+)\/(\d+)$/, m => `${m[1]}: summary ${m[2]}/${m[3]}`],
  [/^(.+) : (page|vision page) (\d+)(?:\/(\d+))?$/, m => `${m[1]}: ${m[2] === "page" ? "page" : "vision page"} ${m[3]}${m[4] ? `/${m[4]}` : ""}`],
  [/^(.+) : (lecture par vision|décompression|dépôt dans le stockage)$/, m => `${m[1]}: ${({ "lecture par vision": "reading with vision", "décompression": "unzipping", "dépôt dans le stockage": "uploading to storage" } as Record<string, string>)[m[2]]}`],
  [/^(\d+) applications · (\d+) flux · déduits (du schéma|du texte|par Aura \(modèle de langage\))\. Ce qui est marqué « à confirmer » est déduit, pas lu\.$/, m => `${m[1]} applications · ${m[2]} flows · deduced ${({ "du schéma": "from the diagram", "du texte": "from the text", "par Aura (modèle de langage)": "by Aura (language model)" } as Record<string, string>)[m[3]]}. What is marked "to confirm" is deduced, not read.`],
  [/^Document joint : (.+)$/, m => `Attached document: ${m[1]}`],
  [/^J'ai repris (\d+) extrait\(s\), cités ci-dessous\. Corrigez d'une phrase si l'un d'eux change le modèle\.$/, m => `I used ${m[1]} excerpt(s), quoted below. Correct in one sentence if one of them changes the model.`],
  [/^(.+) : plus de 10 Mo, fichier refusé\.$/, m => `${m[1]}: over 10 MB, file rejected.`],
  [/^(.+) : aucun texte exploitable\.$/, m => `${m[1]}: no usable text.`],
  [/^Voici ce que j'en déduis, avec (\d+) extrait\(s\) de vos documents\. Corrigez d'une phrase si besoin\.$/, m => `Here is what I deduce, with ${m[1]} excerpt(s) from your documents. Correct in one sentence if needed.`],
  [/^Retirer (.+)$/, m => `Remove ${m[1]}`],
  [/^rejoint la question \((.+)\)$/, m => `matches the question (${m[1]})`],
  [/^PESTEL \((\d+) facteurs, repris dans les risques\)$/, m => `PESTEL (${m[1]} factors, carried into the risks)`],
  [/^([0-9 /]+) options$/, m => `${m[1]} options`],
  [/^(\d+) options$/, m => `${m[1]} options`],
  [/^(Politique|Économique|Social|Technologique|Environnemental|Légal) : (.+)$/, (m, t) => `${({ Politique: "Political", Économique: "Economic", Social: "Social", Technologique: "Technological", Environnemental: "Environmental", Légal: "Legal" } as Record<string, string>)[m[1]]}: ${t(m[2])}`],
);

// Supply : maîtres manquants, nœuds critiques, complétude des impacts.
EN_PATTERNS.unshift(
  [/^(.+) · (.+) : le maître « (.+) » n'a pas de ligne propre ; ajoutez son point d'accès\.$/, (m, t) => `${t(m[1])} · ${t(m[2])}: the master “${m[3]}” has no row of its own; add its endpoint.`],
  [/^Nœud critique : .+ \(([^()]+)\) tient ([\d.,]+) j, il en faut ([\d.,]+) pour le remplacer$/, m => `Critical node: ${m[1]} holds ${m[2]} d, ${m[3]} d are needed to replace it`],
  [/^Aucune des (\d+) référence\(s\) touchée\(s\) ne tombe en rupture en (\d+) j : la première, (.+), tient ([\d\s,.]+) j sur son stock disponible\. Le chiffre d'affaires perdu est nul sur cette durée, pas faute de données\.$/, m => `None of the ${m[1]} affected item(s) runs out within ${m[2]} d: the first one, ${m[3]}, holds ${m[4]} d on its available stock. Lost revenue is zero over this duration, not for lack of data.`],
  [/^Complétez (\d+) impacts? pour une recommandation fiable$/, m => `Complete ${m[1]} impact${m[1] === "1" ? "" : "s"} for a reliable recommendation`],
  [/^(\d+) sur (\d+) impacts renseignés \((\d+) %\) : il en faut au moins (\d+) % pour afficher un gagnant\.$/, m => `${m[1]} of ${m[2]} impacts filled in (${m[3]}%): at least ${m[4]}% are needed to show a winner.`],
  [/^« (.+) » améliore-t-elle ou dégrade-t-elle « (.+) » \?$/, (m, t) => `Does “${t(m[1])}” improve or worsen “${t(m[2])}”?`],
  [/^« (.+) » sur « (.+) »$/, (m, t) => `“${t(m[1])}” on “${t(m[2])}”`],
);
