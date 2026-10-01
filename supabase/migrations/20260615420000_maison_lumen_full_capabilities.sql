-- =============================================================================
-- Maison Lumen – Full Decision Capabilities Catalog
-- 9 nouvelles capabilities + semantic contracts + signal rules + recommendations
-- Idempotent: ON CONFLICT DO NOTHING partout
-- =============================================================================

DO $$ BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MARGIN MANAGEMENT
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'margin-management', 'Margin Management',
  'Identifier les causes d''érosion de marge et arbitrer les leviers de correction.',
  'Finance', 'cfo', 'tactical', 'Finance',
  'Pourquoi la marge baisse-t-elle et quels leviers actionner ?', '📉', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec son coût, prix de vente et marge nette.', 'sku'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Order', 'Commande client avec lignes et remises appliquées.', 'order_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Cost', 'Coût unitaire produit (achat, logistique, retours).', 'cost_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Price', 'Prix de vente par canal avec historique des variations.', 'price_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Attributes: Product
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sku', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'gross_margin_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'net_margin_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'purchase_cost_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'logistics_cost_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'return_rate_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Signal rules: Margin Management
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'MARGIN_EROSION', 'Margin Erosion',
  'gross_margin_pct < 30', 'high',
  'La marge brute de {{sku}} est tombée à {{gross_margin_pct}}% — en dessous du seuil critique de 30%.', true
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'COST_INFLATION', 'Cost Inflation',
  'logistics_cost_eur > purchase_cost_eur * 0.25', 'high',
  'Le coût logistique de {{sku}} dépasse 25% du coût d''achat — impact direct sur la marge.', true
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'MIX_DEGRADATION', 'Mix Degradation',
  'net_margin_pct < gross_margin_pct * 0.6', 'medium',
  'Le mix produit dégrade la marge nette — les produits à faible marge prennent de la place.', true
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (code) DO NOTHING;

-- Decision recommendations: Margin Management
INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'MARGIN_EROSION',
  'Renégocier les conditions fournisseurs',
  'Ouvrir une négociation sur le prix d''achat ou les conditions de paiement avec les fournisseurs des SKU à marge <30%.',
  8, 7, 'medium', '30-60 jours'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'MARGIN_EROSION',
  'Réviser le pricing à la hausse',
  'Identifier les produits avec élasticité faible où une hausse de prix de 5-10% n''impacte pas les volumes.',
  9, 5, 'medium', '15-30 jours'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'COST_INFLATION',
  'Optimiser le schéma logistique',
  'Analyser les flux logistiques des SKU concernés — regroupement commandes, entrepôt de proximité, transporteur alternatif.',
  7, 6, 'high', '60-90 jours'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PRICING STRATEGY
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'pricing-strategy', 'Pricing Strategy',
  'Optimiser le pricing par canal, segment et cycle de vie produit.',
  'Commerce', 'cco', 'tactical', 'Commerce',
  'Faut-il modifier les prix — et de combien, pour qui et sur quel canal ?', '🎯', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec son prix par canal et son historique d''élasticité.', 'sku'
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Competitor', 'Concurrent avec positionnement prix observé.', 'competitor_id'
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'PricePoint', 'Prix observé sur le marché par référence.', 'price_point_id'
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sku', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'pricing-strategy' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'current_price_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'pricing-strategy' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'price_elasticity', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'pricing-strategy' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'market_avg_price_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'pricing-strategy' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'price_gap_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'pricing-strategy' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'PRICE_GAP', 'Price Gap',
  'price_gap_pct > 15', 'high',
  '{{sku}} est vendu {{price_gap_pct}}% plus cher que la moyenne marché — risque de perte de volume.', true
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'MARGIN_OPPORTUNITY', 'Margin Opportunity',
  'price_gap_pct < -10 AND price_elasticity < -0.5', 'medium',
  '{{sku}} est sous-pricé de {{price_gap_pct}}% vs marché avec une élasticité favorable — opportunité de hausse.', true
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'COMPETITIVE_PRESSURE', 'Competitive Pressure',
  'price_gap_pct > 20', 'critical',
  'Pression concurrentielle critique sur {{sku}} — écart de prix de {{price_gap_pct}}% vs marché.', true
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'PRICE_GAP',
  'Alignement prix marché progressif',
  'Réduire l''écart de prix en 3 paliers sur 6 semaines pour ne pas choquer les clients fidèles.',
  8, 8, 'low', '6 semaines'
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'MARGIN_OPPORTUNITY',
  'Hausse de prix ciblée sur SKU inélastiques',
  'Tester une hausse de 8% sur les 20 SKU les plus inélastiques — impact marge estimé +1.2 point.',
  9, 7, 'low', '2 semaines'
FROM decision_packs p WHERE p.slug = 'pricing-strategy'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROMOTION EFFECTIVENESS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'promotion-effectiveness', 'Promotion Effectiveness',
  'Mesurer le ROI des promotions et détecter cannibalisation et effets pervers.',
  'Commerce', 'cco', 'tactical', 'Commerce',
  'Les promotions créent-elles de la valeur ou détruisent-elles la marge ?', '🎪', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Campaign', 'Campagne promotionnelle avec objectifs et résultats observés.', 'campaign_id'
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit promu avec uplift de ventes mesuré.', 'sku'
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Channel', 'Canal de distribution avec performance pendant la promo.', 'channel_id'
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'campaign_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-effectiveness' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'promo_roi_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-effectiveness' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'uplift_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-effectiveness' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'cannibalization_index', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-effectiveness' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'margin_impact_keur', 'numeric', 'k€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-effectiveness' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'LOW_PROMO_ROI', 'Low Promo ROI',
  'promo_roi_pct < 0', 'critical',
  'La campagne {{campaign_id}} a un ROI négatif de {{promo_roi_pct}}% — elle détruit de la valeur.', true
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'CANNIBALIZATION', 'Cannibalization',
  'cannibalization_index > 0.4', 'high',
  'La promo {{campaign_id}} cannibalise {{cannibalization_index|pct}} du volume d''autres produits.', true
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'INVENTORY_OPPORTUNITY', 'Inventory Opportunity',
  'promo_roi_pct > 50 AND uplift_pct > 30', 'medium',
  'La campagne {{campaign_id}} surperforme — opportunité de renforcer les stocks et prolonger la promo.', true
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'LOW_PROMO_ROI',
  'Arrêter la campagne et analyser post-mortem',
  'Couper immédiatement le budget promo négatif et planifier une analyse des causes racines.',
  9, 9, 'low', 'Immédiat'
FROM decision_packs p WHERE p.slug = 'promotion-effectiveness'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ASSORTMENT OPTIMIZATION
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'assortment-optimization', 'Assortment Optimization',
  'Décider quels produits référencer, maintenir ou sortir de l''assortiment.',
  'Commerce', 'cco', 'tactical', 'Commerce',
  'Quels produits garder, renforcer ou supprimer de l''assortiment ?', '🗂️', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec ses métriques de performance assortiment.', 'sku'
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Collection', 'Collection mode avec indicateurs de vente et tendance.', 'collection_id'
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sku', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'assortment-optimization' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sell_through_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'assortment-optimization' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'rotation_index', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'assortment-optimization' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'gross_margin_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'assortment-optimization' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'LOW_ROTATION', 'Low Rotation',
  'rotation_index < 2 AND sell_through_pct < 40', 'high',
  '{{sku}} : rotation faible ({{rotation_index}}) et sell-through à {{sell_through_pct}}% — candidat à la sortie d''assortiment.', true
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'LOW_PROFITABILITY', 'Low Profitability',
  'gross_margin_pct < 20 AND sell_through_pct < 60', 'medium',
  '{{sku}} : marge brute {{gross_margin_pct}}% avec sell-through limité — profitabilité insuffisante.', true
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'COLLECTION_OPPORTUNITY', 'Collection Opportunity',
  'sell_through_pct > 80 AND rotation_index > 8', 'medium',
  '{{sku}} : best-seller avec sell-through {{sell_through_pct}}% — renforcer en assortiment et explorer l''extension de gamme.', true
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'LOW_ROTATION',
  'Marquer en déstockage et préparer la sortie',
  'Planifier une démarque progressive sur les produits à faible rotation pour libérer le capital immobilisé.',
  7, 8, 'low', '30 jours'
FROM decision_packs p WHERE p.slug = 'assortment-optimization'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CUSTOMER PROFITABILITY
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'customer-profitability', 'Customer Profitability',
  'Identifier les clients qui créent ou détruisent de la valeur et décider des actions CRM.',
  'Commerce', 'cco', 'tactical', 'Commerce',
  'Quels clients sont réellement profitables et comment traiter les autres ?', '👤', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Customer', 'Client avec son CA, sa marge et son coût de service.', 'customer_id'
FROM decision_packs p WHERE p.slug = 'customer-profitability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Segment', 'Segment client avec profil de valeur agrégé.', 'segment_id'
FROM decision_packs p WHERE p.slug = 'customer-profitability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'customer_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'customer-profitability' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ltv_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'customer-profitability' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'gross_margin_contribution_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'customer-profitability' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'cost_to_serve_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'customer-profitability' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'churn_risk_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'customer-profitability' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'NEGATIVE_MARGIN_CUSTOMER', 'Negative Margin Customer',
  'gross_margin_contribution_eur < cost_to_serve_eur', 'high',
  'Le client {{customer_id}} détruit de la valeur : coût de service ({{cost_to_serve_eur}}€) > contribution marge.', true
FROM decision_packs p WHERE p.slug = 'customer-profitability'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'HIGH_CHURN_RISK', 'High Churn Risk',
  'churn_risk_score > 0.7 AND ltv_eur > 5000', 'critical',
  'Client à haute valeur (LTV {{ltv_eur}}€) avec risque de churn élevé ({{churn_risk_score}}) — action CRM urgente.', true
FROM decision_packs p WHERE p.slug = 'customer-profitability'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'HIGH_CHURN_RISK',
  'Activer un programme de rétention personnalisé',
  'Déclencher une offre de fidélisation ciblée (remise exclusive, accès VIP) sur les clients LTV >5k€ à risque de churn.',
  9, 8, 'medium', '7 jours'
FROM decision_packs p WHERE p.slug = 'customer-profitability'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. OMNICHANNEL OPTIMIZATION
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'omnichannel-optimization', 'Omnichannel Optimization',
  'Optimiser la répartition du stock et des ventes entre boutiques, web et marketplace.',
  'Commerce', 'cco', 'tactical', 'Commerce',
  'Comment répartir le stock et les efforts commerciaux entre les canaux pour maximiser le CA ?', '🔄', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Store', 'Point de vente physique avec performance par canal.', 'store_id'
FROM decision_packs p WHERE p.slug = 'omnichannel-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec sa demande et son stock par canal.', 'sku'
FROM decision_packs p WHERE p.slug = 'omnichannel-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Channel', 'Canal de distribution (boutique, web, marketplace).', 'channel_code'
FROM decision_packs p WHERE p.slug = 'omnichannel-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'channel_code', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'omnichannel-optimization' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'conversion_rate_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'omnichannel-optimization' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'stock_allocation_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'omnichannel-optimization' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ca_share_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'omnichannel-optimization' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'ALLOCATION_MISMATCH', 'Allocation Risk',
  'stock_allocation_pct > ca_share_pct * 1.4', 'high',
  'Canal {{channel_code}} : sur-allocation stock ({{stock_allocation_pct}}% stock vs {{ca_share_pct}}% CA) — rééquilibrer.', true
FROM decision_packs p WHERE p.slug = 'omnichannel-optimization'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'WEB_CONVERSION_GAP', 'Web Conversion Gap',
  'conversion_rate_pct < 1.5', 'high',
  'Taux de conversion web {{conversion_rate_pct}}% — bien sous le benchmark secteur (3.4%). Causes probables : stock ou UX.', true
FROM decision_packs p WHERE p.slug = 'omnichannel-optimization'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. COLLECTION INVESTMENT
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'collection-investment', 'Collection Investment',
  'Arbitrer l''investissement entre collections selon performances, tendances et marge.',
  'Commerce', 'cco', 'strategic', 'Commerce',
  'Dans quelles collections investir, lesquelles réduire, lesquelles abandonner ?', '👗', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Collection', 'Collection mode avec indicateurs clés de performance.', 'collection_id'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Trend', 'Signal de tendance mode (score externe + données ventes).', 'trend_id'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'collection_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'collection-investment' AND o.object_name = 'Collection'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sell_through_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'collection-investment' AND o.object_name = 'Collection'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'gross_margin_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'collection-investment' AND o.object_name = 'Collection'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'trend_score', 'numeric', '/10', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'collection-investment' AND o.object_name = 'Collection'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'investment_budget_keur', 'numeric', 'k€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'collection-investment' AND o.object_name = 'Collection'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'COLLECTION_OPPORTUNITY', 'Collection Opportunity',
  'sell_through_pct > 75 AND trend_score > 7', 'medium',
  'Collection {{collection_id}} : sell-through {{sell_through_pct}}% avec tendance forte ({{trend_score}}/10) — renforcer l''investissement.', true
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'TREND_RISK', 'Trend Risk',
  'trend_score < 4 AND investment_budget_keur > 500', 'high',
  'Collection {{collection_id}} : tendance en déclin ({{trend_score}}/10) avec budget d''investissement {{investment_budget_keur}}k€ — reconsidérer.', true
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'COLLECTION_OPPORTUNITY',
  'Augmenter la profondeur de gamme sur la collection',
  'Élargir le nombre de coloris et tailles disponibles sur les collections en tendance forte pour capter la demande.',
  8, 7, 'medium', '60-90 jours'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'TREND_RISK',
  'Réduire l''investissement et activer le déstockage',
  'Transférer 40% du budget collection en déclin vers les collections en tendance. Planifier déstockage progressif.',
  9, 8, 'low', '30 jours'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. M&A OPPORTUNITY
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'ma-opportunity', 'M&A Opportunity',
  'Évaluer une opportunité d''acquisition ou de fusion et modéliser les synergies.',
  'Stratégie', 'ceo', 'strategic', 'Strategy',
  'Faut-il acquérir cette enseigne — à quel prix, avec quels risques, quelles synergies ?', '🤝', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Target', 'Cible d''acquisition avec ses métriques financières clés.', 'target_id'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Synergy', 'Synergie estimée post-acquisition (coûts ou revenus).', 'synergy_id'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Store', 'Point de vente de la cible avec localisation et CA.', 'store_id'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'target_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ma-opportunity' AND o.object_name = 'Target'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ebitda_keur', 'numeric', 'k€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ma-opportunity' AND o.object_name = 'Target'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'revenue_keur', 'numeric', 'k€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ma-opportunity' AND o.object_name = 'Target'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ev_multiple', 'numeric', 'x', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ma-opportunity' AND o.object_name = 'Target'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'net_debt_keur', 'numeric', 'k€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ma-opportunity' AND o.object_name = 'Target'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'synergy_potential_keur', 'numeric', 'k€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ma-opportunity' AND o.object_name = 'Target'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'ACQUISITION_OPPORTUNITY', 'Acquisition Opportunity',
  'ev_multiple < 6 AND synergy_potential_keur > ebitda_keur * 0.3', 'medium',
  'Cible {{target_id}} : multiple valorisation attractif ({{ev_multiple}}x) avec synergies estimées à {{synergy_potential_keur}}k€.', true
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'INTEGRATION_RISK', 'Integration Risk',
  'net_debt_keur > ebitda_keur * 4', 'high',
  'Cible {{target_id}} : dette nette ({{net_debt_keur}}k€) > 4x EBITDA — risque d''intégration financier élevé.', true
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'VALUATION_RISK', 'Valuation Risk',
  'ev_multiple > 10', 'critical',
  'Cible {{target_id}} valorisée à {{ev_multiple}}x EBITDA — prime excessive, risque de destruction de valeur.', true
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'ACQUISITION_OPPORTUNITY',
  'Engager une due diligence approfondie',
  'Mandater un conseiller M&A pour valider les synergies, auditer la qualité du bilan et négocier le prix d''entrée.',
  9, 6, 'high', '90-120 jours'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'ACQUISITION_OPPORTUNITY',
  'Explorer un partenariat capitalistique minoritaire',
  'En alternative à l''acquisition totale, prendre une participation minoritaire pour tester les synergies avant de monter au capital.',
  7, 8, 'medium', '60 jours'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'VALUATION_RISK',
  'Suspendre les négociations et réévaluer',
  'La valorisation demandée dépasse les seuils de création de valeur. Mettre en pause et surveiller une évolution du prix.',
  8, 9, 'low', 'Immédiat'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. LOGISTICS PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_packs (id, slug, title, description, category, owner_role, tier, family, business_question, icon, is_published)
VALUES (gen_random_uuid(), 'logistics-performance', 'Logistics Performance',
  'Mesurer et piloter la performance logistique : délais, coûts, taux de service.',
  'Supply Chain', 'coo', 'operational', 'Supply Chain',
  'Où perdons-nous en performance logistique et quel est l''impact sur le service client ?', '🚚', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Shipment', 'Expédition avec délai réel vs promis et coût réel.', 'shipment_id'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Carrier', 'Transporteur avec ses KPIs de performance.', 'carrier_id'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Warehouse', 'Entrepôt avec taux de saturation et délai de préparation.', 'warehouse_id'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'carrier_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'logistics-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'on_time_delivery_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'logistics-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'avg_cost_per_shipment_eur', 'numeric', '€', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'logistics-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'saturation_pct', 'numeric', '%', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'logistics-performance' AND o.object_name = 'Warehouse'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'preparation_time_hours', 'numeric', 'h', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'logistics-performance' AND o.object_name = 'Warehouse'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'DELIVERY_DELAY', 'Delivery Delay',
  'on_time_delivery_pct < 90', 'high',
  'Transporteur {{carrier_id}} : taux de livraison à l''heure {{on_time_delivery_pct}}% — sous le SLA contractuel de 95%.', true
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'WAREHOUSE_SATURATION', 'Warehouse Saturation',
  'saturation_pct > 85', 'critical',
  'Entrepôt saturé à {{saturation_pct}}% — risque de blocage des flux entrants et allongement des délais de préparation.', true
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id,
  'TRANSPORT_COST_SPIKE', 'Transport Cost Spike',
  'avg_cost_per_shipment_eur > 0', 'medium',
  'Pic de coût transport détecté — réviser les contrats transporteurs ou activer des alternatives.', true
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT (code) DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'DELIVERY_DELAY',
  'Mettre en demeure le transporteur et activer l''alternatif',
  'Émettre une mise en demeure formelle sur les SLA non respectés et activer immédiatement le transporteur de backup.',
  8, 8, 'low', '48h'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'WAREHOUSE_SATURATION',
  'Activer un stockage externe d''urgence',
  'Contacter des opérateurs 3PL pour externaliser 20% des volumes entrants jusqu''à retour à la normale.',
  7, 7, 'medium', '72h'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

END $$;
