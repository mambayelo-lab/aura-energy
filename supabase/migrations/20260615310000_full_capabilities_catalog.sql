-- Full Decision Capabilities Catalog — 3 tiers × 6 families — 20 capabilities
-- Tier 1 Operational: monitoring quotidien
-- Tier 2 Tactical:    optimisation & arbitrages
-- Tier 3 Strategic:   grandes décisions d'investissement

DO $$ DECLARE
  -- existing pack IDs
  pack_cash   UUID; pack_stock UUID; pack_supp  UUID;
  pack_marg   UUID; pack_transf UUID; pack_ai   UUID;
  -- new pack IDs
  pack_wc UUID; pack_pc UUID; pack_ar UUID;
  pack_cc UUID; pack_rl UUID; pack_ln UUID;
  pack_td UUID; pack_ao UUID; pack_df UUID;
  pack_wh UUID; pack_se UUID; pack_mb UUID;
  pack_ip UUID; pack_me UUID;
  -- recommendation IDs
  r1 UUID; r2 UUID; r3 UUID; r4 UUID;

BEGIN

-- ── Schema additions ──────────────────────────────────────────────────────────
ALTER TABLE decision_packs
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS family TEXT,
  ADD COLUMN IF NOT EXISTS business_question TEXT;

-- ── Update existing 6 capabilities ───────────────────────────────────────────
UPDATE decision_packs SET tier='operational', family='Finance',
  business_question='Aurons-nous un problème de trésorerie ?'
  WHERE slug='cash-management';
UPDATE decision_packs SET tier='operational', family='Supply Chain',
  business_question='Vais-je manquer de stock ?'
  WHERE slug='stock-availability';
UPDATE decision_packs SET tier='operational', family='Supply Chain',
  business_question='Quel fournisseur met l''activité en danger ?'
  WHERE slug='supplier-risk';
UPDATE decision_packs SET tier='operational', family='Finance',
  business_question='Pourquoi la marge baisse-t-elle ?'
  WHERE slug='margin-management';
UPDATE decision_packs SET tier='strategic', family='Transformation',
  business_question='Quelles initiatives financer en priorité ?'
  WHERE slug='transformation-portfolio';
UPDATE decision_packs SET tier='tactical', family='IA & Digital',
  business_question='Sommes-nous prêts pour l''IA ?'
  WHERE slug='ai-readiness';

-- ── Fetch existing pack IDs ───────────────────────────────────────────────────
SELECT id INTO pack_cash  FROM decision_packs WHERE slug='cash-management';
SELECT id INTO pack_stock FROM decision_packs WHERE slug='stock-availability';
SELECT id INTO pack_supp  FROM decision_packs WHERE slug='supplier-risk';
SELECT id INTO pack_marg  FROM decision_packs WHERE slug='margin-management';
SELECT id INTO pack_transf FROM decision_packs WHERE slug='transformation-portfolio';
SELECT id INTO pack_ai    FROM decision_packs WHERE slug='ai-readiness';

-- ══════════════════════════════════════════════════════════════════════════════
-- TIER 1 — OPERATIONAL  (pilotage quotidien)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Working Capital ───────────────────────────────────────────────────────────
pack_wc := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_wc,'working-capital','Working Capital','Réduire le BFR et optimiser le cycle cash','Finance','cfo','operational','Finance','Comment réduire le besoin en fonds de roulement ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_wc,'Facture Client','financial_document','Créances clients en cours'),
(gen_random_uuid(),pack_wc,'Stock','inventory','Niveaux de stock et rotation'),
(gen_random_uuid(),pack_wc,'Facture Fournisseur','financial_document','Dettes fournisseurs'),
(gen_random_uuid(),pack_wc,'Ligne de Crédit','credit_facility','Capacité de financement CT');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_wc,'WC-S001','BFR > seuil cible de l''entreprise','high','bfr_elevated','{"metric":"bfr_days","operator":">","threshold":60}'),
(pack_wc,'WC-S002','DSO client > 45 jours','warning','dso_high','{"metric":"dso_days","operator":">","threshold":45}'),
(pack_wc,'WC-S003','DIO > 60 jours — rotation stock lente','warning','dio_high','{"metric":"dio_days","operator":">","threshold":60}');

UPDATE signal_rules SET contributors='[
  {"label":"Recouvrement client lent","pct":40,"direction":"negative"},
  {"label":"Stock excédentaire immobilisé","pct":35,"direction":"negative"},
  {"label":"Délais fournisseurs courts non négociés","pct":25,"direction":"negative"}
]' WHERE pack_id=pack_wc AND code='WC-S001';

-- ── Production Continuity ─────────────────────────────────────────────────────
pack_pc := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_pc,'production-continuity','Production Continuity','Prévenir les arrêts de production','Opérations','coo','operational','Manufacturing','La production est-elle menacée ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_pc,'Machine','equipment','Équipement de production'),
(gen_random_uuid(),pack_pc,'Ordre de fabrication','work_order','Planning production'),
(gen_random_uuid(),pack_pc,'Composant','component','Matières premières critiques'),
(gen_random_uuid(),pack_pc,'Technicien','resource','Ressource humaine maintenance');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_pc,'PROD-S001','Machine critique en défaillance imminente','critical','machine_failure_risk','{"metric":"failure_probability","operator":">","threshold":0.7}'),
(pack_pc,'PROD-S002','Pénurie composant critique < 48h','critical','component_shortage','{"metric":"component_coverage_hours","operator":"<","threshold":48}'),
(pack_pc,'PROD-S003','Goulot bottleneck détecté','high','production_bottleneck','{"metric":"utilization_rate","operator":">","threshold":0.95}');

-- ── Asset Reliability ─────────────────────────────────────────────────────────
pack_ar := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_ar,'asset-reliability','Asset Reliability','Fiabilité des actifs industriels et maintenance prédictive','Opérations','coo','operational','Energy','Quels actifs sont à risque de défaillance ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_ar,'Actif','asset','Équipement industriel ou infrastructure'),
(gen_random_uuid(),pack_ar,'Intervention maintenance','maintenance_record','Historique et planning maintenance'),
(gen_random_uuid(),pack_ar,'Capteur IoT','sensor','Données temps réel équipement'),
(gen_random_uuid(),pack_ar,'Contrat maintenance','contract','SLA maintenance externalisée');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_ar,'ASSET-S001','Actif critique avec probabilité panne > 70%','critical','asset_failure_risk','{"metric":"failure_probability","operator":">","threshold":0.7}'),
(pack_ar,'ASSET-S002','Dépassement intervalle maintenance préventive','high','maintenance_overdue','{"metric":"days_since_maintenance","operator":">","threshold":90}'),
(pack_ar,'ASSET-S003','Coût maintenance en hausse de >20%','warning','maintenance_cost_inflation','{"metric":"maintenance_cost_delta_pct","operator":">","threshold":0.2}');

-- ══════════════════════════════════════════════════════════════════════════════
-- TIER 2 — TACTICAL  (optimisation & arbitrages opérationnels)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Customer Credit Risk ──────────────────────────────────────────────────────
pack_cc := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_cc,'customer-credit-risk','Customer Credit Risk','Gestion du risque de crédit client B2B','Finance','cfo','tactical','Finance','À quels clients accorder du crédit et à quelles conditions ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_cc,'Client B2B','customer','Client avec compte ouvert'),
(gen_random_uuid(),pack_cc,'Encours client','credit_exposure','Montant de crédit accordé'),
(gen_random_uuid(),pack_cc,'Historique paiement','payment_history','Comportement de paiement passé'),
(gen_random_uuid(),pack_cc,'Limite de crédit','credit_limit','Plafond autorisé');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_cc,'CREDIT-S001','Client dépasse sa limite de crédit','critical','credit_limit_breach','{"metric":"credit_utilization","operator":">","threshold":1.0}'),
(pack_cc,'CREDIT-S002','Client avec 2+ factures en retard','high','payment_delay_pattern','{"metric":"overdue_invoices_count","operator":">=","threshold":2}'),
(pack_cc,'CREDIT-S003','Score risque client en dégradation','warning','credit_score_drop','{"metric":"credit_score_delta","operator":"<","threshold":-10}');

-- ── Revenue Leakage ───────────────────────────────────────────────────────────
pack_rl := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_rl,'revenue-leakage','Revenue Leakage','Identifier et colmater les fuites de chiffre d''affaires','Finance','cfo','tactical','Finance','Où perdons-nous du chiffre d''affaires sans le voir ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_rl,'Ligne de commande','order_line','Détail commande client'),
(gen_random_uuid(),pack_rl,'Remise commerciale','discount','Rabais accordé'),
(gen_random_uuid(),pack_rl,'Avoir client','credit_note','Corrections post-vente'),
(gen_random_uuid(),pack_rl,'Retour produit','return','Retour marchandise');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_rl,'LEAK-S001','Taux de remise commercial > seuil autorisé','high','discount_leakage','{"metric":"avg_discount_rate","operator":">","threshold":0.15}'),
(pack_rl,'LEAK-S002','Taux de retour produit anormal > 5%','warning','return_rate_high','{"metric":"return_rate","operator":">","threshold":0.05}'),
(pack_rl,'LEAK-S003','Avoirs non facturés en hausse','warning','credit_note_surge','{"metric":"credit_note_delta_pct","operator":">","threshold":0.3}');

-- ── Logistics Network ─────────────────────────────────────────────────────────
pack_ln := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_ln,'logistics-network','Logistics Network','Optimisation du réseau logistique et des flux','Supply Chain','coo','tactical','Supply Chain','Comment optimiser mon réseau logistique ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_ln,'Entrepôt','warehouse','Site de stockage et distribution'),
(gen_random_uuid(),pack_ln,'Transporteur','carrier','Prestataire transport'),
(gen_random_uuid(),pack_ln,'Flux logistique','shipment','Mouvement de marchandise'),
(gen_random_uuid(),pack_ln,'Zone de livraison','delivery_zone','Périmètre géographique client');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_ln,'LOG-S001','Taux de livraison en retard > 10%','high','delivery_delay_rate','{"metric":"late_delivery_rate","operator":">","threshold":0.1}'),
(pack_ln,'LOG-S002','Coût transport / CA > seuil','warning','transport_cost_ratio','{"metric":"transport_cost_revenue_ratio","operator":">","threshold":0.08}'),
(pack_ln,'LOG-S003','Entrepôt saturé > 90% capacité','warning','warehouse_saturation','{"metric":"warehouse_fill_rate","operator":">","threshold":0.9}');

-- ── Technical Debt Exposure ───────────────────────────────────────────────────
pack_td := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_td,'technical-debt-exposure','Technical Debt Exposure','Identifier et prioriser la dette technique','SI & Architecture','cio','tactical','Transformation','Quelle dette technique faut-il traiter en urgence ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_td,'Application','application','Système ou applicatif métier'),
(gen_random_uuid(),pack_td,'Technologie','technology','Stack technique utilisé'),
(gen_random_uuid(),pack_td,'Risque obsolescence','risk','Exposition à l''obsolescence'),
(gen_random_uuid(),pack_td,'Dépendance','dependency','Couplage entre systèmes');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_td,'TECH-S001','Application en fin de support éditeur','critical','end_of_life','{"metric":"months_to_eol","operator":"<","threshold":12}'),
(pack_td,'TECH-S002','Technologie non maintenue dans l''organisation','high','skill_gap','{"metric":"internal_skill_coverage","operator":"<","threshold":0.2}'),
(pack_td,'TECH-S003','Nombre de dépendances critiques non mises à jour','warning','dependency_drift','{"metric":"outdated_dependencies_count","operator":">","threshold":10}');

UPDATE signal_rules SET contributors='[
  {"label":"Fin de support éditeur imminente","pct":45,"direction":"negative"},
  {"label":"Compétences internes insuffisantes","pct":30,"direction":"negative"},
  {"label":"Dépendances non maintenues","pct":25,"direction":"negative"}
]' WHERE pack_id=pack_td AND code='TECH-S001';

-- ── Agent Opportunity Discovery ───────────────────────────────────────────────
pack_ao := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_ao,'agent-opportunity','Agent Opportunity Discovery','Identifier les processus automatisables par des agents IA','IA & Digital','cio','tactical','IA & Digital','Où déployer des agents IA pour créer de la valeur rapidement ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_ao,'Processus','process','Processus métier candidat à l''automatisation'),
(gen_random_uuid(),pack_ao,'Tâche répétitive','task','Tâche manuelle à fort volume'),
(gen_random_uuid(),pack_ao,'Application','application','Système à connecter'),
(gen_random_uuid(),pack_ao,'Équipe','team','Équipe impactée');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_ao,'AGENT-S001','Processus manuel > 4h/semaine et faible complexité','high','automation_opportunity','{"metric":"manual_hours_per_week","operator":">","threshold":4}'),
(pack_ao,'AGENT-S002','Processus avec taux d''erreur humaine > 5%','warning','error_reduction_opportunity','{"metric":"human_error_rate","operator":">","threshold":0.05}');

-- ── Demand Forecasting ────────────────────────────────────────────────────────
pack_df := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_df,'demand-forecasting','Demand Forecasting','Fiabilité des prévisions de demande','Supply Chain','coo','tactical','Supply Chain','Les prévisions de demande sont-elles fiables ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_df,'Prévision','forecast','Prévision de ventes ou commandes'),
(gen_random_uuid(),pack_df,'Commande réelle','actual_order','Demande constatée'),
(gen_random_uuid(),pack_df,'Saisonnalité','seasonality','Pattern saisonnier'),
(gen_random_uuid(),pack_df,'Événement marché','market_event','Promotion ou événement impactant');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_df,'FORE-S001','Écart prévision/réel > 20%','high','forecast_gap','{"metric":"forecast_accuracy_gap","operator":">","threshold":0.2}'),
(pack_df,'FORE-S002','Saisonnalité non prise en compte','warning','seasonality_miss','{"metric":"seasonality_adjustment","operator":"=","value":false}');

-- ══════════════════════════════════════════════════════════════════════════════
-- TIER 3 — STRATEGIC  (grandes décisions d'investissement et d'orientation)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Warehouse Expansion ───────────────────────────────────────────────────────
pack_wh := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_wh,'warehouse-expansion','Warehouse Expansion','Arbitrage ouverture/extension entrepôt vs externalisation','Supply Chain','coo','strategic','Supply Chain','Dois-je ouvrir un nouvel entrepôt ou externaliser ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_wh,'Entrepôt','warehouse','Site logistique actuel ou projeté'),
(gen_random_uuid(),pack_wh,'Région','region','Zone géographique couverte'),
(gen_random_uuid(),pack_wh,'Prévision demande','demand_forecast','Volume attendu 3-5 ans'),
(gen_random_uuid(),pack_wh,'Investissement','investment','CAPEX + coûts opérationnels'),
(gen_random_uuid(),pack_wh,'Prestataire 3PL','provider','Logisticien tiers');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_wh,'WH-S001','Capacité entrepôt actuel > 88% — expansion nécessaire','critical','capacity_critical','{"metric":"warehouse_fill_rate","operator":">","threshold":0.88}'),
(pack_wh,'WH-S002','Délais livraison clients > SLA dans zone non couverte','high','delivery_gap','{"metric":"delivery_breach_rate","operator":">","threshold":0.15}'),
(pack_wh,'WH-S003','Coûts transport vers zone émergente en hausse','warning','transport_cost_rise','{"metric":"zone_transport_cost_delta","operator":">","threshold":0.25}');

UPDATE signal_rules SET contributors='[
  {"label":"Taux de remplissage entrepôt critique","pct":45,"direction":"negative"},
  {"label":"Délais livraison clients dégradés","pct":30,"direction":"negative"},
  {"label":"Croissance demande non absorbée","pct":25,"direction":"negative"}
]' WHERE pack_id=pack_wh AND code='WH-S001';

r1 := gen_random_uuid(); r2 := gen_random_uuid(); r3 := gen_random_uuid();
INSERT INTO decision_recommendations(id,pack_id,signal_code,title,description,impact_score,feasibility_score,time_to_impact,effort_level,confidence_pct,impact_estimate_label,explanation) VALUES
(r1,pack_wh,'WH-S001','Construire un nouvel entrepôt propre','Investissement CAPEX propriétaire — contrôle total, amortissement long terme',8,4,'months','high',72,'-40% coûts logistiques à 3 ans','Impact maximal (8/10) mais faisabilité faible (4/10). Score CAP min(8,4)=4. À privilégier si le volume est certain et l''horizon > 3 ans. Décision irréversible : nécessite une étude de marché approfondie.'),
(r2,pack_wh,'WH-S001','Externaliser vers un prestataire 3PL','Sous-traiter la logistique à un acteur spécialisé — flexibilité maximale, coûts variables',7,9,'weeks','low',88,'+35% flexibilité · délai 4 semaines','Faisabilité maximale (9/10). Score CAP min(7,9)=7. Recommandé si la croissance est incertaine ou si les ressources internes sont limitées. Permet de tester la zone sans engagement CAPEX.'),
(r3,pack_wh,'WH-S001','Étendre l''entrepôt existant','Ajouter de la surface au site actuel par extension ou mezzanine',6,7,'months','medium',78,'+30% capacité · CAPEX modéré','Compromis entre contrôle et flexibilité. Score CAP min(6,7)=6. Adapté si le site a du foncier disponible et si la croissance est concentrée dans la zone actuelle.');

INSERT INTO recommendation_effects(recommendation_id,dimension,direction,description,magnitude) VALUES
(r1,'cost_logistics','positive','Réduit structurellement les coûts logistiques à 3-5 ans',3),
(r1,'capex','negative','Mobilise 2-8 M€ de CAPEX selon la taille',3),
(r1,'flexibility','negative','Engagement irréversible si la demande ne se matérialise pas',2),
(r2,'flexibility','positive','Capacité ajustable immédiatement selon les volumes réels',3),
(r2,'cost_control','negative','Marges 3PL réduisent le contrôle des coûts à long terme',2),
(r3,'capacity','positive','Augmente rapidement la capacité sans changer d''organisation',2),
(r3,'capex','negative','Nécessite des travaux et une période d''indisponibilité partielle',1);

-- ── Store Expansion ───────────────────────────────────────────────────────────
pack_se := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_se,'store-expansion','Store Expansion','Arbitrage ouverture de nouveau point de vente','Retail','coo','strategic','Retail','Dois-je ouvrir ce nouveau point de vente ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_se,'Point de vente','store','Magasin actuel ou projeté'),
(gen_random_uuid(),pack_se,'Emplacement','location','Zone de chalandise et caractéristiques'),
(gen_random_uuid(),pack_se,'Investissement ouverture','investment','CAPEX + coûts de lancement'),
(gen_random_uuid(),pack_se,'Zone de concurrence','competition','Présence concurrents directs'),
(gen_random_uuid(),pack_se,'Potentiel client','catchment','Population et pouvoir d''achat zone');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_se,'STORE-S001','ROI projeté < seuil d''acceptation','high','store_roi_risk','{"metric":"projected_roi","operator":"<","threshold":0.15}'),
(pack_se,'STORE-S002','Risque de cannibalisation magasin existant > 15%','warning','cannibalization_risk','{"metric":"cannibalization_rate","operator":">","threshold":0.15}'),
(pack_se,'STORE-S003','Opportunité de chiffre d''affaires dans zone non couverte','info','revenue_opportunity','{"metric":"untapped_market_size","operator":">","threshold":500000}');

UPDATE signal_rules SET contributors='[
  {"label":"Chiffre d''affaires zone de chalandise potentiel","pct":40,"direction":"positive"},
  {"label":"Densité concurrentielle de la zone","pct":30,"direction":"negative"},
  {"label":"Coût de l''emplacement vs benchmark","pct":30,"direction":"negative"}
]' WHERE pack_id=pack_se AND code='STORE-S001';

r1 := gen_random_uuid(); r2 := gen_random_uuid(); r3 := gen_random_uuid(); r4 := gen_random_uuid();
INSERT INTO decision_recommendations(id,pack_id,signal_code,title,description,impact_score,feasibility_score,time_to_impact,effort_level,confidence_pct,impact_estimate_label,explanation) VALUES
(r1,pack_se,'STORE-S001','Ouvrir en format complet','Ouverture standard selon concept actuel',9,4,'months','high',65,'+1,2 à 2,5 M€ CA/an','Impact potentiel maximal mais faisabilité modérée (4/10). Score CAP min(9,4)=4. À valider par une étude terrain et une modélisation financière à 3 ans avant de décider.'),
(r2,pack_se,'STORE-S001','Reporter et réétudier la zone','Différer l''ouverture de 6-12 mois pour affiner l''analyse',4,9,'weeks','low',88,'Réduction risque · Pas de coût irrécupérable','Faisabilité maximale (9/10). Score CAP min(4,9)=4. Recommandé si les données de zone sont insuffisantes ou si le ROI est inférieur au seuil. Permet de retravailler l''emplacement ou le format.'),
(r3,pack_se,'STORE-S001','Ouvrir en format réduit','Tester la zone avec un format plus petit (pop-up, corner, format réduit)',7,7,'months','medium',78,'+600K€ à 1,2 M€ CA/an · risque réduit','Équilibre optimal. Score CAP min(7,7)=7 — recommandé si la zone est prometteuse mais incertaine. Permet de valider l''hypothèse avant d''investir davantage.'),
(r4,pack_se,'STORE-S002','Changer d''emplacement','Identifier un emplacement alternatif dans la zone de chalandise',6,5,'months','high',60,'Évite la cannibalisation','À envisager si le risque de cannibalisation dépasse 20%. Score CAP min(6,5)=5.');

INSERT INTO recommendation_effects(recommendation_id,dimension,direction,description,magnitude) VALUES
(r1,'revenue','positive','Ouvre un nouveau bassin de clientèle — CA additionnel significatif',3),
(r1,'capex','negative','Engage 800K€ à 2M€ selon emplacement et travaux',3),
(r1,'brand','positive','Renforce la présence de marque dans la zone',2),
(r2,'risk','positive','Élimine le risque d''un mauvais investissement',3),
(r2,'opportunity','negative','Perd un avantage first-mover si un concurrent ouvre dans l''intervalle',1),
(r3,'revenue','positive','Génère un CA de test avec investissement limité',2),
(r3,'learnings','positive','Produit des données réelles pour calibrer un format complet',3),
(r3,'capex','negative','CAPEX plus faible mais rentabilité par m² réduite',1);

-- ── Make vs Buy ───────────────────────────────────────────────────────────────
pack_mb := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_mb,'make-vs-buy','Make vs Buy','Arbitrage internalisation vs sous-traitance','Manufacturing','coo','strategic','Manufacturing','Vaut-il mieux produire en interne ou sous-traiter ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_mb,'Capacité interne','internal_capacity','Ressources et compétences disponibles en interne'),
(gen_random_uuid(),pack_mb,'Fournisseur potentiel','supplier','Sous-traitant évalué'),
(gen_random_uuid(),pack_mb,'Coût de revient','cost_model','Structure de coûts interne vs externe'),
(gen_random_uuid(),pack_mb,'Savoir-faire','know_how','Compétences et IP à protéger'),
(gen_random_uuid(),pack_mb,'Qualité cible','quality_standard','Exigences qualité produit');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_mb,'MB-S001','Coût interne > coût externe + 15%','high','cost_gap','{"metric":"make_vs_buy_cost_delta","operator":">","threshold":0.15}'),
(pack_mb,'MB-S002','Capacité interne saturée — impossible d''absorber la croissance','critical','capacity_saturation','{"metric":"internal_capacity_utilization","operator":">","threshold":0.9}'),
(pack_mb,'MB-S003','Dépendance fournisseur unique > 60% du composant','high','supplier_dependency','{"metric":"single_supplier_share","operator":">","threshold":0.6}');

r1 := gen_random_uuid(); r2 := gen_random_uuid(); r3 := gen_random_uuid();
INSERT INTO decision_recommendations(id,pack_id,signal_code,title,description,impact_score,feasibility_score,time_to_impact,effort_level,confidence_pct,impact_estimate_label,explanation) VALUES
(r1,pack_mb,'MB-S001','Sous-traiter à un partenaire qualifié','Externaliser la production vers un fournisseur sélectionné',7,8,'months','medium',80,'-15 à 25% coût de revient','Faisabilité forte (8/10). Score CAP min(7,8)=7 — recommandé si le delta coût est avéré et si le savoir-faire n''est pas stratégique.'),
(r2,pack_mb,'MB-S001','Internaliser et investir en capacité','Augmenter la capacité interne par investissement CAPEX',9,4,'months','high',65,'Maîtrise totale · ROI 3-5 ans','Impact maximal sur le contrôle qualité et les marges long terme. Score CAP min(9,4)=4. Pertinent si le composant est au cœur du différenciant produit.'),
(r3,pack_mb,'MB-S001','Modèle hybride — cœur interne + overflow externe','Conserver le cœur en interne et sous-traiter les volumes de pointe',8,7,'months','medium',78,'-10% coût · Résilience +50%','Meilleur équilibre. Score CAP min(8,7)=7. Préserve le savoir-faire tout en absorbant la croissance sans CAPEX massif.');

INSERT INTO recommendation_effects(recommendation_id,dimension,direction,description,magnitude) VALUES
(r1,'cost','positive','Réduit le coût de revient de 15-25% selon le volume',3),
(r1,'control','negative','Réduit la maîtrise qualité et les délais de réaction',2),
(r1,'dependency','negative','Crée une dépendance à un fournisseur externe',2),
(r2,'quality','positive','Contrôle total de la qualité et des délais',3),
(r2,'capex','negative','Engage 1-5 M€ de CAPEX selon la capacité cible',3),
(r3,'resilience','positive','Résilience face aux pics de demande',3),
(r3,'cost','positive','Réduit les coûts variables sans CAPEX majeur',2);

-- ── Investment Portfolio ──────────────────────────────────────────────────────
pack_ip := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_ip,'investment-portfolio','Investment Portfolio','Allocation optimale du capital entre projets concurrents','Finance','cfo','strategic','Finance','Où allouer le capital disponible pour maximiser la valeur créée ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_ip,'Projet d''investissement','project','Initiative nécessitant un financement'),
(gen_random_uuid(),pack_ip,'Budget disponible','budget','Enveloppe d''investissement allouable'),
(gen_random_uuid(),pack_ip,'ROI attendu','roi_model','Retour sur investissement projeté'),
(gen_random_uuid(),pack_ip,'Risque projet','project_risk','Probabilité d''échec ou de dérive'),
(gen_random_uuid(),pack_ip,'Dépendance stratégique','strategic_dependency','Liens avec la stratégie d''entreprise');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_ip,'INV-S001','Projet à faible ROI consomme plus de 20% du budget','high','capital_misallocation','{"metric":"low_roi_budget_share","operator":">","threshold":0.2}'),
(pack_ip,'INV-S002','Concentration budget > 50% sur un seul projet','high','concentration_risk','{"metric":"top_project_budget_share","operator":">","threshold":0.5}'),
(pack_ip,'INV-S003','Opportunité à ROI élevé sans financement alloué','warning','missed_opportunity','{"metric":"unfunded_high_roi_projects","operator":">","threshold":0}');

UPDATE signal_rules SET contributors='[
  {"label":"Mauvaise allocation entre projets concurrents","pct":40,"direction":"negative"},
  {"label":"Projets historiques chronophages consommant le budget","pct":35,"direction":"negative"},
  {"label":"Nouvelles opportunités non intégrées au plan","pct":25,"direction":"negative"}
]' WHERE pack_id=pack_ip AND code='INV-S001';

r1 := gen_random_uuid(); r2 := gen_random_uuid(); r3 := gen_random_uuid();
INSERT INTO decision_recommendations(id,pack_id,signal_code,title,description,impact_score,feasibility_score,time_to_impact,effort_level,confidence_pct,impact_estimate_label,explanation) VALUES
(r1,pack_ip,'INV-S001','Réallouer vers les projets à ROI maximal','Arbitrer le portfolio en faveur des projets à plus fort retour',9,6,'months','medium',75,'+15 à 30% ROI portfolio','Impact fort (9/10) si les projets cibles sont bien identifiés. Score CAP min(9,6)=6. Nécessite un arbitrage politique — recommandé si le processus de gouvernance est mature.'),
(r2,pack_ip,'INV-S001','Stopper les projets à faible valeur','Arrêter les projets sous le seuil de ROI minimum et réallouer',8,8,'weeks','medium',82,'+20% budget disponible libéré','Faisabilité forte (8/10). Score CAP min(8,8)=8 — recommandé en priorité. Libère du budget sans nouvel investissement. Nécessite un courage managérial.'),
(r3,pack_ip,'INV-S001','Diversifier pour réduire la concentration','Fractionner les gros projets en phases et financer les projets émergents',7,7,'months','medium',78,'Réduction risque · Meilleure couverture stratégique','Score CAP min(7,7)=7. Recommandé si l''entreprise supporte mal l''échec d''un grand projet.');

INSERT INTO recommendation_effects(recommendation_id,dimension,direction,description,magnitude) VALUES
(r1,'roi','positive','Améliore significativement le ROI moyen du portfolio',3),
(r1,'morale','negative','Peut démotiver les équipes des projets dépriorisés',2),
(r2,'budget','positive','Libère immédiatement du capital pour de meilleures opportunités',3),
(r2,'sunk_cost','negative','Accepter la perte des investissements passés sur les projets arrêtés',2),
(r3,'risk','positive','Réduit l''exposition à l''échec d''un seul projet majeur',3),
(r3,'complexity','negative','Augmente la complexité de gestion du portfolio',1);

-- ── Market Expansion ──────────────────────────────────────────────────────────
pack_me := gen_random_uuid();
INSERT INTO decision_packs(id,slug,title,description,category,owner_role,tier,family,business_question)
VALUES(pack_me,'market-expansion','Market Expansion','Arbitrage d''entrée dans un nouveau marché géographique','Stratégie','ceo','strategic','Strategy','Dans quel nouveau marché ou territoire dois-je me développer ?');

INSERT INTO semantic_objects(id,pack_id,object_name,object_type,description) VALUES
(gen_random_uuid(),pack_me,'Marché cible','market','Nouveau territoire ou segment visé'),
(gen_random_uuid(),pack_me,'Concurrent local','competitor','Acteurs déjà présents sur le marché'),
(gen_random_uuid(),pack_me,'Potentiel de revenus','revenue_potential','CA adressable estimé'),
(gen_random_uuid(),pack_me,'Investissement d''entrée','market_entry_cost','Coût d''entrée et de développement'),
(gen_random_uuid(),pack_me,'Barrière réglementaire','regulatory','Contraintes légales et réglementaires');

INSERT INTO signal_rules(pack_id,code,description,severity,rule_key,condition_json) VALUES
(pack_me,'MKT-S001','Opportunité de marché non adressée > seuil','info','market_opportunity','{"metric":"addressable_market_size","operator":">","threshold":5000000}'),
(pack_me,'MKT-S002','Part de marché existante en saturation','warning','market_saturation','{"metric":"market_share_growth","operator":"<","threshold":0.02}'),
(pack_me,'MKT-S003','Concurrent entrant sur marché actuel — menace','high','competitive_threat','{"metric":"new_competitor_threat_score","operator":">","threshold":0.6}');

END $$;
