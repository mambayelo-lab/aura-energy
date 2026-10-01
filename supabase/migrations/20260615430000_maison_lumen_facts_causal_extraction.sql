-- =============================================================================
-- Maison Lumen – Facts, Causal Rules, Extraction Contracts, Contributors
-- Complète la migration 20260615420000 avec les 4 couches manquantes
-- Idempotent : ON CONFLICT DO NOTHING + guard IF EXISTS sur la mission
-- =============================================================================

DO $$ BEGIN

-- Fix signal_rules ON CONFLICT : les codes MARGIN_EROSION etc. peuvent avoir
-- été insérés sans pack_id dans la migration précédente. On les met à jour.
UPDATE signal_rules sr
SET pack_id = p.id
FROM decision_packs p
WHERE sr.pack_id IS NULL
  AND p.slug IN (
    'margin-management','pricing-strategy','promotion-effectiveness',
    'assortment-optimization','customer-profitability','omnichannel-optimization',
    'collection-investment','ma-opportunity','logistics-performance'
  )
  AND sr.code IN (
    'MARGIN_EROSION','COST_INFLATION','MIX_DEGRADATION',
    'PRICE_GAP','MARGIN_OPPORTUNITY','COMPETITIVE_PRESSURE',
    'LOW_PROMO_ROI','CANNIBALIZATION','INVENTORY_OPPORTUNITY',
    'LOW_ROTATION','LOW_PROFITABILITY','COLLECTION_OPPORTUNITY',
    'NEGATIVE_MARGIN_CUSTOMER','HIGH_CHURN_RISK',
    'ALLOCATION_MISMATCH','WEB_CONVERSION_GAP',
    'TREND_RISK',
    'ACQUISITION_OPPORTUNITY','INTEGRATION_RISK','VALUATION_RISK',
    'DELIVERY_DELAY','WAREHOUSE_SATURATION','TRANSPORT_COST_SPIKE'
  );

-- =============================================================================
-- CAUSAL RULES — 9 nouvelles capabilities
-- =============================================================================

-- ── Margin Management ────────────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'MARG-R001', 'Hausse coûts logistiques → érosion marge',
  'Product', 'logistics_cost_eur', '>', '0.25',
  'Product', 'net_margin_pct', 'decrease',
  0.88, 'seed', 'margin-management',
  'Chaque point de hausse des coûts logistiques réduit la marge nette d''environ 0.8 point.', true),
(gen_random_uuid(), 'MARG-R002', 'Taux de retour élevé → marge dégradée',
  'Product', 'return_rate_pct', '>', '15',
  'Product', 'gross_margin_pct', 'decrease',
  0.82, 'seed', 'margin-management',
  'Un taux de retour >15% génère des coûts de retraitement qui érode la marge brute.', true),
(gen_random_uuid(), 'MARG-R003', 'Mix défavorable → marge globale dégradée',
  'Product', 'net_margin_pct', '<', '20',
  'Product', 'gross_margin_pct', 'decrease',
  0.79, 'seed', 'margin-management',
  'Quand les produits à faible marge nette captent plus de 40% du CA, la marge globale se dégrade.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Pricing Strategy ─────────────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'PRIC-R001', 'Prix > marché → perte de volume',
  'Product', 'price_gap_pct', '>', '15',
  'Product', 'rotation_index', 'decrease',
  0.85, 'seed', 'pricing-strategy',
  'Un écart de prix >15% vs marché réduit significativement les volumes sur les produits élastiques.', true),
(gen_random_uuid(), 'PRIC-R002', 'Sous-pricing → manque à gagner marge',
  'Product', 'price_gap_pct', '<', '-10',
  'Product', 'gross_margin_pct', 'decrease',
  0.90, 'seed', 'pricing-strategy',
  'Être 10% sous le prix marché sans avantage élasticité représente un manque à gagner direct.', true),
(gen_random_uuid(), 'PRIC-R003', 'Pression concurrentielle → érosion prix',
  'Product', 'price_gap_pct', '>', '20',
  'Product', 'current_price_eur', 'decrease',
  0.75, 'seed', 'pricing-strategy',
  'Une pression concurrentielle forte force un alignement progressif des prix vers le bas.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Promotion Effectiveness ───────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'PROMO-R001', 'Cannibalisation → dilution ROI promo',
  'Campaign', 'cannibalization_index', '>', '0.35',
  'Campaign', 'promo_roi_pct', 'decrease',
  0.83, 'seed', 'promotion-effectiveness',
  'Une cannibalisation >35% signifie que la promo déplace des ventes déjà acquises au lieu d''en créer.', true),
(gen_random_uuid(), 'PROMO-R002', 'Uplift faible → ROI négatif',
  'Campaign', 'uplift_pct', '<', '10',
  'Campaign', 'margin_impact_keur', 'decrease',
  0.87, 'seed', 'promotion-effectiveness',
  'Un uplift promotionnel <10% ne compense généralement pas la démarque accordée.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Assortment Optimization ───────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'ASSO-R001', 'Faible rotation → immobilisation capital',
  'Product', 'rotation_index', '<', '2',
  'Product', 'sell_through_pct', 'decrease',
  0.91, 'seed', 'assortment-optimization',
  'Un indice de rotation <2 indique que le stock tourne moins de 2 fois par an — immobilisation de trésorerie.', true),
(gen_random_uuid(), 'ASSO-R002', 'Faible sell-through → déstockage nécessaire',
  'Product', 'sell_through_pct', '<', '40',
  'Product', 'gross_margin_pct', 'decrease',
  0.86, 'seed', 'assortment-optimization',
  'Un sell-through <40% en fin de saison force des démarques qui érodent la marge.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Customer Profitability ────────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'CUST-R001', 'Coût service élevé → marge client négative',
  'Customer', 'cost_to_serve_eur', '>', '0',
  'Customer', 'gross_margin_contribution_eur', 'decrease',
  0.88, 'seed', 'customer-profitability',
  'Quand le coût de service dépasse la contribution marge, le client détruit de la valeur.', true),
(gen_random_uuid(), 'CUST-R002', 'Score churn élevé → LTV menacée',
  'Customer', 'churn_risk_score', '>', '0.6',
  'Customer', 'ltv_eur', 'decrease',
  0.85, 'seed', 'customer-profitability',
  'Un score de risque churn >0.6 réduit la LTV attendue de 40-60% si aucune action n''est menée.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Omnichannel Optimization ──────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'OMNI-R001', 'Stock web désynchronisé → conversion dégradée',
  'Channel', 'stock_allocation_pct', '<', '0',
  'Channel', 'conversion_rate_pct', 'decrease',
  0.89, 'seed', 'omnichannel-optimization',
  'Un stock web sous-alimenté par rapport à la demande réduit le taux de conversion de façon directe.', true),
(gen_random_uuid(), 'OMNI-R002', 'Conversion web faible → budget acquisition gaspillé',
  'Channel', 'conversion_rate_pct', '<', '2',
  'Channel', 'ca_share_pct', 'decrease',
  0.84, 'seed', 'omnichannel-optimization',
  'Un taux de conversion <2% signifie qu''une grande partie du budget acquisition génère des visites sans achat.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Collection Investment ─────────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'COLL-R001', 'Tendance forte + sell-through élevé → opportunité investissement',
  'Collection', 'trend_score', '>', '7',
  'Collection', 'investment_budget_keur', 'increase',
  0.80, 'seed', 'collection-investment',
  'Quand une collection score >7/10 en tendance avec un sell-through >75%, l''investissement supplémentaire est rentable.', true),
(gen_random_uuid(), 'COLL-R002', 'Déclin tendance → sell-through dégradé',
  'Collection', 'trend_score', '<', '4',
  'Collection', 'sell_through_pct', 'decrease',
  0.82, 'seed', 'collection-investment',
  'Une collection avec score tendance <4/10 verra son sell-through se dégrader dans les 2-3 mois suivants.', true)
ON CONFLICT (code) DO NOTHING;

-- ── M&A Opportunity ──────────────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'MA-R001', 'Dette nette élevée → risque intégration',
  'Target', 'net_debt_keur', '>', '0',
  'Target', 'synergy_potential_keur', 'decrease',
  0.78, 'seed', 'ma-opportunity',
  'Une dette nette >4x EBITDA consomme les synergies et augmente le risque de défaut post-acquisition.', true),
(gen_random_uuid(), 'MA-R002', 'Multiple valorisation faible + synergies → valeur créée',
  'Target', 'ev_multiple', '<', '6',
  'Target', 'synergy_potential_keur', 'increase',
  0.75, 'seed', 'ma-opportunity',
  'Un multiple <6x avec synergies significatives offre un potentiel de création de valeur élevé.', true),
(gen_random_uuid(), 'MA-R003', 'Survalorisation → destruction de valeur',
  'Target', 'ev_multiple', '>', '10',
  'Target', 'ebitda_keur', 'decrease',
  0.86, 'seed', 'ma-opportunity',
  'Au-delà de 10x EBITDA, la prime payée dépasse généralement les synergies réalisables sur 5 ans.', true)
ON CONFLICT (code) DO NOTHING;

-- ── Logistics Performance ─────────────────────────────────────────────────────
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'LOGI-R001', 'Retard transporteur → insatisfaction client',
  'Carrier', 'on_time_delivery_pct', '<', '90',
  'Carrier', 'avg_cost_per_shipment_eur', 'increase',
  0.83, 'seed', 'logistics-performance',
  'Un taux de livraison à l''heure <90% génère des coûts de SAV et des avoirs clients.', true),
(gen_random_uuid(), 'LOGI-R002', 'Saturation entrepôt → délais préparation allongés',
  'Warehouse', 'saturation_pct', '>', '85',
  'Warehouse', 'preparation_time_hours', 'increase',
  0.91, 'seed', 'logistics-performance',
  'Au-delà de 85% de saturation, les délais de préparation augmentent de façon non linéaire.', true),
(gen_random_uuid(), 'LOGI-R003', 'Délais préparation longs → livraison retardée',
  'Warehouse', 'preparation_time_hours', '>', '24',
  'Carrier', 'on_time_delivery_pct', 'decrease',
  0.87, 'seed', 'logistics-performance',
  'Chaque heure de délai supplémentaire en préparation entrepôt dégrade le taux de livraison à temps.', true)
ON CONFLICT (code) DO NOTHING;


-- =============================================================================
-- SIGNAL CONTRIBUTORS — contexte "Pourquoi ce signal ?"
-- =============================================================================

UPDATE signal_rules SET contributors = '[
  {"label": "Hausse coûts logistiques", "pct": 38, "direction": "negative"},
  {"label": "Pression tarifaire fournisseurs", "pct": 32, "direction": "negative"},
  {"label": "Mix produit défavorable", "pct": 18, "direction": "negative"},
  {"label": "Taux de retour anormal", "pct": 12, "direction": "negative"}
]' WHERE code = 'MARGIN_EROSION';

UPDATE signal_rules SET contributors = '[
  {"label": "Coûts logistiques en hausse (+18% YoY)", "pct": 55, "direction": "negative"},
  {"label": "Fragmentation des commandes", "pct": 28, "direction": "negative"},
  {"label": "Transporteur non optimisé", "pct": 17, "direction": "negative"}
]' WHERE code = 'COST_INFLATION';

UPDATE signal_rules SET contributors = '[
  {"label": "Produits à faible marge sous-performants", "pct": 45, "direction": "negative"},
  {"label": "Collections en fin de vie", "pct": 33, "direction": "negative"},
  {"label": "Promotions excessives sur marges élevées", "pct": 22, "direction": "negative"}
]' WHERE code = 'MIX_DEGRADATION';

UPDATE signal_rules SET contributors = '[
  {"label": "Positionnement prix trop élevé vs concurrence", "pct": 50, "direction": "negative"},
  {"label": "Absence de veille concurrentielle systématique", "pct": 30, "direction": "negative"},
  {"label": "Manque de segmentation par canal", "pct": 20, "direction": "negative"}
]' WHERE code = 'PRICE_GAP';

UPDATE signal_rules SET contributors = '[
  {"label": "Sous-pricing historique non corrigé", "pct": 60, "direction": "negative"},
  {"label": "Élasticité prix favorable non exploitée", "pct": 25, "direction": "positive"},
  {"label": "Concurrents positionnés plus haut", "pct": 15, "direction": "positive"}
]' WHERE code = 'MARGIN_OPPORTUNITY';

UPDATE signal_rules SET contributors = '[
  {"label": "Concurrents agressifs sur les prix", "pct": 45, "direction": "negative"},
  {"label": "Différenciation insuffisante", "pct": 35, "direction": "negative"},
  {"label": "Sensibilité prix élevée du segment cible", "pct": 20, "direction": "negative"}
]' WHERE code = 'COMPETITIVE_PRESSURE';

UPDATE signal_rules SET contributors = '[
  {"label": "Démarque trop importante", "pct": 40, "direction": "negative"},
  {"label": "Cannibalisation des ventes à plein prix", "pct": 35, "direction": "negative"},
  {"label": "Uplift insuffisant pour justifier le coût", "pct": 25, "direction": "negative"}
]' WHERE code = 'LOW_PROMO_ROI';

UPDATE signal_rules SET contributors = '[
  {"label": "Produits similaires en assortiment", "pct": 50, "direction": "negative"},
  {"label": "Mauvais ciblage client", "pct": 30, "direction": "negative"},
  {"label": "Timing promo inadapté", "pct": 20, "direction": "negative"}
]' WHERE code = 'CANNIBALIZATION';

UPDATE signal_rules SET contributors = '[
  {"label": "Faible vélocité de vente (rotation <2)", "pct": 45, "direction": "negative"},
  {"label": "Sell-through en dessous des objectifs saison", "pct": 35, "direction": "negative"},
  {"label": "Assortiment sur-représenté vs demande réelle", "pct": 20, "direction": "negative"}
]' WHERE code = 'LOW_ROTATION';

UPDATE signal_rules SET contributors = '[
  {"label": "Marge brute structurellement faible", "pct": 50, "direction": "negative"},
  {"label": "Coûts de distribution élevés sur ce SKU", "pct": 30, "direction": "negative"},
  {"label": "Peu de réachat (produit non récurrent)", "pct": 20, "direction": "negative"}
]' WHERE code = 'LOW_PROFITABILITY';

UPDATE signal_rules SET contributors = '[
  {"label": "Coût de service supérieur à la contribution marge", "pct": 55, "direction": "negative"},
  {"label": "Remises commerciales excessives", "pct": 25, "direction": "negative"},
  {"label": "Retours et SAV fréquents", "pct": 20, "direction": "negative"}
]' WHERE code = 'NEGATIVE_MARGIN_CUSTOMER';

UPDATE signal_rules SET contributors = '[
  {"label": "Inactivité récente (>60 jours)", "pct": 40, "direction": "negative"},
  {"label": "Baisse de la fréquence d''achat", "pct": 35, "direction": "negative"},
  {"label": "Absence d''engagement CRM récent", "pct": 25, "direction": "negative"}
]' WHERE code = 'HIGH_CHURN_RISK';

UPDATE signal_rules SET contributors = '[
  {"label": "Stock sur-alloué par rapport à la part de CA", "pct": 50, "direction": "negative"},
  {"label": "Prévision de demande par canal erronée", "pct": 30, "direction": "negative"},
  {"label": "Rigidité des processus de réallocation", "pct": 20, "direction": "negative"}
]' WHERE code = 'ALLOCATION_MISMATCH';

UPDATE signal_rules SET contributors = '[
  {"label": "Stock Shopify désynchronisé du stock réel", "pct": 45, "direction": "negative"},
  {"label": "Pages produit en rupture non retirées", "pct": 30, "direction": "negative"},
  {"label": "UX dégradée sur mobile", "pct": 25, "direction": "negative"}
]' WHERE code = 'WEB_CONVERSION_GAP';

UPDATE signal_rules SET contributors = '[
  {"label": "Score tendance en déclin sur les réseaux sociaux", "pct": 45, "direction": "negative"},
  {"label": "Ventes early-season sous les objectifs", "pct": 35, "direction": "negative"},
  {"label": "Concurrents en déstockage similaire", "pct": 20, "direction": "negative"}
]' WHERE code = 'TREND_RISK';

UPDATE signal_rules SET contributors = '[
  {"label": "Multiple valorisation attractif (<6x EBITDA)", "pct": 40, "direction": "positive"},
  {"label": "Synergies réseau boutiques identifiées", "pct": 35, "direction": "positive"},
  {"label": "Complémentarité géographique", "pct": 25, "direction": "positive"}
]' WHERE code = 'ACQUISITION_OPPORTUNITY';

UPDATE signal_rules SET contributors = '[
  {"label": "Levier financier élevé (dette >4x EBITDA)", "pct": 50, "direction": "negative"},
  {"label": "Cultures d''entreprise différentes", "pct": 30, "direction": "negative"},
  {"label": "Systèmes SI incompatibles", "pct": 20, "direction": "negative"}
]' WHERE code = 'INTEGRATION_RISK';

UPDATE signal_rules SET contributors = '[
  {"label": "Prime d''acquisition excessive (>10x EBITDA)", "pct": 60, "direction": "negative"},
  {"label": "Synergies surestimées dans le business plan", "pct": 25, "direction": "negative"},
  {"label": "Concurrence d''autres acquéreurs", "pct": 15, "direction": "negative"}
]' WHERE code = 'VALUATION_RISK';

UPDATE signal_rules SET contributors = '[
  {"label": "Taux de livraison à l''heure sous SLA", "pct": 45, "direction": "negative"},
  {"label": "Incidents récurrents sur certaines routes", "pct": 35, "direction": "negative"},
  {"label": "Capacité transporteur insuffisante en pic", "pct": 20, "direction": "negative"}
]' WHERE code = 'DELIVERY_DELAY';

UPDATE signal_rules SET contributors = '[
  {"label": "Flux entrants non maîtrisés", "pct": 40, "direction": "negative"},
  {"label": "Réassorts excessifs sans rotation", "pct": 35, "direction": "negative"},
  {"label": "Capacité physique sous-dimensionnée", "pct": 25, "direction": "negative"}
]' WHERE code = 'WAREHOUSE_SATURATION';

UPDATE signal_rules SET contributors = '[
  {"label": "Hausse des tarifs carburant/fret", "pct": 45, "direction": "negative"},
  {"label": "Rupture de capacité chez le transporteur principal", "pct": 30, "direction": "negative"},
  {"label": "Fragmentation des envois (petits colis)", "pct": 25, "direction": "negative"}
]' WHERE code = 'TRANSPORT_COST_SPIKE';


-- =============================================================================
-- EXTRACTION CONTRACTS — mappings source → attribut (si mission existe)
-- =============================================================================

-- Note: extraction_contracts nécessite decision_contract_id (NOT NULL FK)
-- On crée d'abord les decision_contracts pour chaque nouvelle capability, puis les extraction_contracts

-- Margin Management
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Marge Produit', 'Quelle est la marge réelle par SKU après coûts complets ?',
  ARRAY['SAP FI','ERP','Cegid POS'], 'active'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Pricing Strategy
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Pricing', 'Quel est l''écart de prix vs marché par référence ?',
  ARRAY['ERP','Shopify Plus','Veille concurrentielle'], 'active'
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Promotion Effectiveness
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Promotions', 'Quel est le ROI réel de chaque campagne promo ?',
  ARRAY['Shopify Plus','Cegid POS','Salesforce CRM'], 'active'
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Assortment Optimization
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Assortiment', 'Quels produits ont un sell-through et une rotation insuffisants ?',
  ARRAY['ERP','Cegid POS','Shopify Plus'], 'active'
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Customer Profitability
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Rentabilité Client', 'Quelle est la contribution nette de chaque client ?',
  ARRAY['Salesforce CRM','ERP','Cegid POS'], 'active'
FROM decision_packs p WHERE p.slug = 'customer-profitability'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Omnichannel Optimization
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Omnicanal', 'Comment se répartissent stock et CA entre les canaux ?',
  ARRAY['Shopify Plus','Cegid POS','Manhattan OMS'], 'active'
FROM decision_packs p WHERE p.slug = 'omnichannel-optimization'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Collection Investment
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Collections', 'Quelle est la performance vente + tendance par collection ?',
  ARRAY['ERP','Shopify Plus','o9/JDA'], 'active'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- M&A Opportunity
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat M&A', 'Quelle est la valorisation et les synergies de la cible ?',
  ARRAY['Infogreffe','Bases financières','Due diligence interne'], 'draft'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Logistics Performance
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat Performance Logistique', 'Quel est le taux de service réel par transporteur et entrepôt ?',
  ARRAY['Manhattan WMS','ERP','TMS'], 'active'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- Extraction contracts (liés aux objets sémantiques via object_id + attribute_id)
-- Margin Management: Product → gross_margin_pct depuis SAP/ERP
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(),
  dc.id,
  o.id,
  a.id,
  'SAP S/4HANA',
  'KALNR.PBXX (prix standard) / KALKZ (coût total)',
  60, 'active', 0.88
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'margin-management'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Product'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'gross_margin_pct'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'SAP S/4HANA', 'VBAP.KWMENG (coût logistique COPA)', 60, 'planned', 0.72
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'margin-management'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Product'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'logistics_cost_eur'
ON CONFLICT DO NOTHING;

-- Pricing: Product → current_price_eur depuis Shopify + SAP
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Shopify Plus', 'products.variants.price', 15, 'active', 0.95
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'pricing-strategy'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Product'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'current_price_eur'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Cegid POS', 'article.prixVente', 60, 'active', 0.90
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'pricing-strategy'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Product'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'current_price_eur'
ON CONFLICT DO NOTHING;

-- Promo: Campaign → promo_roi_pct depuis Shopify + CRM
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Shopify Plus', 'price_rules.usage_count / discount_code.revenue', 60, 'active', 0.80
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'promotion-effectiveness'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Campaign'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'promo_roi_pct'
ON CONFLICT DO NOTHING;

-- Assortment: Product → sell_through_pct depuis ERP + POS
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'SAP S/4HANA', 'MKPF.BWART=261 (sorties stock) / quantité initiale', 240, 'active', 0.85
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'assortment-optimization'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Product'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'sell_through_pct'
ON CONFLICT DO NOTHING;

-- Customer Profitability: Customer → ltv_eur depuis CRM
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Salesforce CRM', 'Account.TotalRevenue / Account.AverageOrderValue', 1440, 'active', 0.82
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'customer-profitability'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Customer'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'ltv_eur'
ON CONFLICT DO NOTHING;

-- Omnichannel: Channel → conversion_rate_pct depuis Shopify
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Shopify Plus', 'analytics.sessions.conversion_rate', 60, 'active', 0.93
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'omnichannel-optimization'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Channel'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'conversion_rate_pct'
ON CONFLICT DO NOTHING;

-- Collection Investment: Collection → sell_through_pct depuis ERP + o9
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'o9/JDA', 'collection.sellThrough', 1440, 'active', 0.78
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'collection-investment'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Collection'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'sell_through_pct'
ON CONFLICT DO NOTHING;

-- Logistics Performance: Carrier → on_time_delivery_pct depuis WMS/TMS
INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Manhattan WMS', 'carrier.otd_rate', 60, 'active', 0.91
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'logistics-performance'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Carrier'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'on_time_delivery_pct'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (
  id, decision_contract_id, object_id, attribute_id,
  source_system, source_field, refresh_interval_minutes, status, mapping_confidence
)
SELECT
  gen_random_uuid(), dc.id, o.id, a.id,
  'Manhattan WMS', 'warehouse.capacityUsedPct', 15, 'active', 0.94
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id AND p.slug = 'logistics-performance'
JOIN semantic_objects o ON o.pack_id = p.id AND o.object_name = 'Warehouse'
JOIN semantic_attributes a ON a.object_id = o.id AND a.attribute_name = 'saturation_pct'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- FACTS — données démo Maison Lumen (guard sur mission)
-- Représentent l'état opérationnel actuel simulé
-- =============================================================================

DO $inner$ BEGIN
IF NOT EXISTS (SELECT 1 FROM missions WHERE id = '11111111-1111-1111-1111-111111111111') THEN
  RAISE NOTICE 'Mission Maison Lumen introuvable — facts non insérés.';
  RETURN;
END IF;

-- Margin Management facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'gross_margin_pct', 'SKU-ROBE-001', 28.5, NULL, 'SAP S/4HANA', 0.92, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'gross_margin_pct', 'SKU-MANTEAU-003', 41.2, NULL, 'SAP S/4HANA', 0.92, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'gross_margin_pct', 'SKU-JEAN-007', 19.8, NULL, 'SAP S/4HANA', 0.92, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'logistics_cost_eur', 'SKU-ROBE-001', 12.4, NULL, 'SAP S/4HANA', 0.85, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'logistics_cost_eur', 'SKU-JEAN-007', 18.9, NULL, 'SAP S/4HANA', 0.85, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'return_rate_pct', 'SKU-ROBE-001', 22.3, NULL, 'Shopify Plus', 0.88, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'net_margin_pct', 'SKU-JEAN-007', 8.2, NULL, 'SAP S/4HANA', 0.90, now() - interval '2h')
ON CONFLICT DO NOTHING;

-- Pricing Strategy facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'current_price_eur', 'SKU-ROBE-001', 129.0, NULL, 'Shopify Plus', 0.99, now() - interval '30m'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'market_avg_price_eur', 'SKU-ROBE-001', 108.0, NULL, 'Veille marché', 0.75, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'price_gap_pct', 'SKU-ROBE-001', 19.4, NULL, 'Calculé', 0.85, now() - interval '1h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'price_elasticity', 'SKU-ROBE-001', -1.2, NULL, 'o9/JDA', 0.70, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'current_price_eur', 'SKU-JEAN-007', 89.0, NULL, 'Shopify Plus', 0.99, now() - interval '30m'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'market_avg_price_eur', 'SKU-JEAN-007', 99.0, NULL, 'Veille marché', 0.75, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'price_gap_pct', 'SKU-JEAN-007', -10.1, NULL, 'Calculé', 0.85, now() - interval '1h')
ON CONFLICT DO NOTHING;

-- Promotion Effectiveness facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Campaign', 'promo_roi_pct', 'PROMO-SOLDES-ETE-2026', -8.3, NULL, 'Shopify Plus', 0.82, now() - interval '6h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Campaign', 'uplift_pct', 'PROMO-SOLDES-ETE-2026', 7.2, NULL, 'Shopify Plus', 0.80, now() - interval '6h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Campaign', 'cannibalization_index', 'PROMO-SOLDES-ETE-2026', 0.48, NULL, 'Calculé', 0.75, now() - interval '6h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Campaign', 'margin_impact_keur', 'PROMO-SOLDES-ETE-2026', -42.0, NULL, 'SAP S/4HANA', 0.88, now() - interval '6h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Campaign', 'promo_roi_pct', 'PROMO-FIDELITE-Q2', 34.7, NULL, 'Salesforce CRM', 0.85, now() - interval '6h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Campaign', 'uplift_pct', 'PROMO-FIDELITE-Q2', 42.3, NULL, 'Salesforce CRM', 0.83, now() - interval '6h')
ON CONFLICT DO NOTHING;

-- Assortment Optimization facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'sell_through_pct', 'SKU-ROBE-001', 82.0, NULL, 'SAP S/4HANA', 0.90, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'sell_through_pct', 'SKU-JEAN-007', 31.0, NULL, 'SAP S/4HANA', 0.90, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'rotation_index', 'SKU-ROBE-001', 9.2, NULL, 'Calculé', 0.88, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Product', 'rotation_index', 'SKU-JEAN-007', 1.4, NULL, 'Calculé', 0.88, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'sell_through_pct', 'COLL-ETE-2026', 71.0, NULL, 'SAP S/4HANA', 0.89, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'sell_through_pct', 'COLL-HIVER-2025', 38.0, NULL, 'SAP S/4HANA', 0.89, now() - interval '4h')
ON CONFLICT DO NOTHING;

-- Customer Profitability facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Customer', 'ltv_eur', 'CUST-VIP-001', 12400.0, NULL, 'Salesforce CRM', 0.85, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Customer', 'churn_risk_score', 'CUST-VIP-001', 0.74, NULL, 'Salesforce CRM', 0.78, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Customer', 'gross_margin_contribution_eur', 'CUST-B2B-042', 890.0, NULL, 'SAP S/4HANA', 0.88, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Customer', 'cost_to_serve_eur', 'CUST-B2B-042', 1240.0, NULL, 'Calculé', 0.72, now() - interval '24h')
ON CONFLICT DO NOTHING;

-- Omnichannel facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Channel', 'conversion_rate_pct', 'WEB', 2.1, NULL, 'Shopify Plus', 0.98, now() - interval '1h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Channel', 'ca_share_pct', 'WEB', 38.0, NULL, 'Shopify Plus', 0.95, now() - interval '1h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Channel', 'stock_allocation_pct', 'WEB', 22.0, NULL, 'Manhattan OMS', 0.88, now() - interval '1h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Channel', 'ca_share_pct', 'BOUTIQUES', 55.0, NULL, 'Cegid POS', 0.95, now() - interval '1h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Channel', 'stock_allocation_pct', 'BOUTIQUES', 68.0, NULL, 'Manhattan OMS', 0.88, now() - interval '1h')
ON CONFLICT DO NOTHING;

-- Collection Investment facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'trend_score', 'COLL-ETE-2026', 8.2, NULL, 'Analyse tendances', 0.72, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'trend_score', 'COLL-HIVER-2025', 3.1, NULL, 'Analyse tendances', 0.72, now() - interval '24h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'gross_margin_pct', 'COLL-ETE-2026', 44.0, NULL, 'SAP S/4HANA', 0.91, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'gross_margin_pct', 'COLL-HIVER-2025', 29.0, NULL, 'SAP S/4HANA', 0.91, now() - interval '4h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Collection', 'investment_budget_keur', 'COLL-HIVER-2025', 680.0, NULL, 'SAP Finance', 0.96, now() - interval '8h')
ON CONFLICT DO NOTHING;

-- Logistics Performance facts
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Carrier', 'on_time_delivery_pct', 'CARRIER-CHRONOPOST', 87.3, NULL, 'Manhattan WMS', 0.94, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Carrier', 'on_time_delivery_pct', 'CARRIER-GLS', 93.1, NULL, 'Manhattan WMS', 0.94, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Carrier', 'avg_cost_per_shipment_eur', 'CARRIER-CHRONOPOST', 8.4, NULL, 'Manhattan WMS', 0.90, now() - interval '2h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Warehouse', 'saturation_pct', 'ENTREPOT-LYON', 91.0, NULL, 'Manhattan WMS', 0.97, now() - interval '30m'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Warehouse', 'saturation_pct', 'ENTREPOT-PARIS', 74.0, NULL, 'Manhattan WMS', 0.97, now() - interval '30m'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Warehouse', 'preparation_time_hours', 'ENTREPOT-LYON', 31.0, NULL, 'Manhattan WMS', 0.93, now() - interval '2h')
ON CONFLICT DO NOTHING;

-- M&A facts (données simulées due diligence)
INSERT INTO facts (id, mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Target', 'ebitda_keur', 'TARGET-MODEUSE-SA', 2800.0, NULL, 'Due diligence', 0.70, now() - interval '48h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Target', 'revenue_keur', 'TARGET-MODEUSE-SA', 18400.0, NULL, 'Due diligence', 0.75, now() - interval '48h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Target', 'ev_multiple', 'TARGET-MODEUSE-SA', 5.2, NULL, 'Banque conseil', 0.65, now() - interval '48h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Target', 'net_debt_keur', 'TARGET-MODEUSE-SA', 4200.0, NULL, 'Due diligence', 0.78, now() - interval '48h'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Target', 'synergy_potential_keur', 'TARGET-MODEUSE-SA', 1100.0, NULL, 'Analyse interne', 0.60, now() - interval '48h')
ON CONFLICT DO NOTHING;

END $inner$;

-- =============================================================================
-- CRITERIA INTERACTIONS — pour les nouveaux packs
-- =============================================================================

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["gross_margin_pct", "logistics_cost_eur"], "relation": "antagoniste", "note": "Réduire les coûts logistiques améliore directement la marge"},
  {"criteria": ["gross_margin_pct", "return_rate_pct"], "relation": "antagoniste", "note": "Un taux de retour élevé génère des coûts qui érodent la marge"},
  {"criteria": ["net_margin_pct", "mix_produit"], "relation": "complementaire", "note": "Un mix favorable vers les produits premium améliore la marge nette"}
]' WHERE slug = 'margin-management';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["current_price_eur", "rotation_index"], "relation": "antagoniste", "note": "Hausser le prix réduit la rotation sur les produits élastiques"},
  {"criteria": ["price_gap_pct", "gross_margin_pct"], "relation": "complementaire", "note": "Combler l''écart de sous-pricing améliore directement la marge"}
]' WHERE slug = 'pricing-strategy';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["promo_roi_pct", "cannibalization_index"], "relation": "antagoniste", "note": "Plus la cannibalisation est élevée, plus le ROI réel est dégradé"},
  {"criteria": ["uplift_pct", "margin_impact_keur"], "relation": "complementaire", "note": "Un uplift fort avec démarque limitée maximise l''impact marge"}
]' WHERE slug = 'promotion-effectiveness';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["sell_through_pct", "gross_margin_pct"], "relation": "complementaire", "note": "Un sell-through élevé évite les démarques et préserve la marge"},
  {"criteria": ["rotation_index", "capital_immobilise"], "relation": "antagoniste", "note": "Faible rotation = capital immobilisé dans le stock"}
]' WHERE slug = 'assortment-optimization';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["on_time_delivery_pct", "avg_cost_per_shipment_eur"], "relation": "antagoniste", "note": "Améliorer la ponctualité peut nécessiter des transporteurs plus coûteux"},
  {"criteria": ["saturation_pct", "preparation_time_hours"], "relation": "antagoniste", "note": "La saturation entrepôt allonge mécaniquement les délais de préparation"}
]' WHERE slug = 'logistics-performance';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["ev_multiple", "synergy_potential_keur"], "relation": "complementaire", "note": "Un faible multiple avec synergies élevées est le scénario idéal"},
  {"criteria": ["net_debt_keur", "integration_risk"], "relation": "antagoniste", "note": "Une dette élevée augmente le risque d''intégration et réduit la flexibilité post-acquisition"}
]' WHERE slug = 'ma-opportunity';

END $$;
