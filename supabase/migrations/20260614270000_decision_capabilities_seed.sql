-- =============================================================================
-- Migration: 20260614270000_decision_capabilities_seed.sql
-- Seeds 6 priority Decision Capabilities as Semantic Contracts
-- Idempotent: uses ON CONFLICT DO NOTHING throughout
-- =============================================================================

DO $$ BEGIN

-- =============================================================================
-- 1. CASH MANAGEMENT CAPABILITY
-- =============================================================================

INSERT INTO decision_packs (id, title, slug, category, description, status)
VALUES (
  gen_random_uuid(),
  'Cash Management',
  'cash-management',
  'finance',
  'Pilotage de la trésorerie, du DSO et des risques de liquidité à court terme.',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Semantic Objects: Cash Management
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Customer', 'Client avec conditions de paiement et limite de crédit.', 'customer_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Invoice', 'Facture client avec statut et retard éventuel.', 'invoice_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Payment', 'Paiement reçu avec réconciliation bancaire.', 'payment_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'CashPosition', 'Position de trésorerie disponible et prévisionnelle.', 'position_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Semantic Attributes: Customer (cash-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'customer_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'segment', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'country', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'credit_limit', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'payment_terms', 'integer', 'days', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Invoice (cash-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'invoice_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'customer_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'amount_ht', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'amount_ttc', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'due_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'status', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'days_overdue', 'integer', 'days', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Invoice'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Payment (cash-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'payment_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Payment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'invoice_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Payment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'amount', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Payment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'payment_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Payment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'method', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Payment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'reconciliation_status', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Payment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: CashPosition (cash-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'position_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'available_cash', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'forecasted_cash_7d', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'forecasted_cash_30d', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'bank_account', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Causal Rules: Cash Management
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'CASH-R001', 'Trésorerie critique', 'CashPosition', 'available_cash', '<', 50000, 'CashPosition', 'risk_level', 'up', 0.92, 'seed', 'Cash Management', 'Trésorerie disponible sous 50K€ indique un risque de rupture de financement à court terme', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'CASH-R002', 'DSO élevé', 'Invoice', 'days_overdue', '>', 30, 'Customer', 'payment_risk', 'up', 0.85, 'seed', 'Cash Management', 'Retard de paiement moyen supérieur à 30 jours signale un risque client élevé', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'CASH-R003', 'Prévision dégradée', 'CashPosition', 'forecasted_cash_30d', '<', 100000, 'CashPosition', 'liquidity_risk', 'up', 0.88, 'seed', 'Cash Management', 'Trésorerie prévisionnelle à 30j sous 100K€ nécessite une action immédiate', true)
ON CONFLICT (code) DO NOTHING;

-- Signal Rules: Cash Management
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'CASH-S001', 'Risque trésorerie court terme', 'available_cash < 50000 AND days_overdue_total > 100000', 'critical', 'Trésorerie disponible {available_cash}€ critique — créances échues > 100K€', true
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'CASH-S002', 'Client mauvais payeur', 'avg_days_overdue > 30 AND unpaid_invoice_count >= 3', 'warning', 'Client {customer_name} : retard moyen {avg_days_overdue}j sur {unpaid_invoice_count} factures', true
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'CASH-S003', 'Tension DSO critique', 'dso > 60', 'warning', 'DSO à {dso} jours — seuil secteur dépassé', true
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, code) DO NOTHING;


-- =============================================================================
-- 2. STOCK AVAILABILITY CAPABILITY
-- =============================================================================

INSERT INTO decision_packs (id, title, slug, category, description, status)
VALUES (
  gen_random_uuid(),
  'Stock Availability',
  'stock-availability',
  'supply',
  'Pilotage de la disponibilité des stocks, détection des ruptures et des tensions approvisionnement.',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Semantic Objects: Stock Availability
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec seuils de réapprovisionnement et stock de sécurité.', 'product_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Inventory', 'Niveau de stock par site avec réservations.', 'inventory_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Demand', 'Demande constatée et prévisionnelle par produit et site.', 'demand_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Supplier', 'Fournisseur avec score de fiabilité et délai moyen.', 'supplier_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'PurchaseOrder', 'Commande fournisseur avec statut et date de livraison attendue.', 'po_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Semantic Attributes: Product (stock-availability)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'category', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ean', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'unit', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'reorder_point', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'safety_stock', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Inventory (stock-availability)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'inventory_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'site_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'current_stock', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'reserved_stock', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'available_stock', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Demand (stock-availability)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'demand_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'site_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sales_last_7d', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'sales_last_30d', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'forecast_next_30d', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Supplier (stock-availability)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'country', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'reliability_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'avg_delay_days', 'numeric', 'days', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: PurchaseOrder (stock-availability)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'po_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'quantity', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'expected_delivery', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'status', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Causal Rules: Stock Availability
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'STOCK-R001', 'Rupture imminente', 'Inventory', 'current_stock', '<', 20, 'Product', 'stockout_risk', 'up', 0.91, 'seed', 'Stock Availability', 'Stock courant sous le seuil de réappro signale une rupture probable', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'STOCK-R002', 'Vélocité anormale', 'Demand', 'sales_last_7d', '>', 30, 'Product', 'demand_spike', 'up', 0.83, 'seed', 'Stock Availability', 'Ventes hebdomadaires élevées vs historique signalent une tension approvisionnement', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'STOCK-R003', 'Fournisseur défaillant', 'Supplier', 'avg_delay_days', '>', 14, 'Supplier', 'reliability_risk', 'up', 0.87, 'seed', 'Stock Availability', 'Délai fournisseur moyen supérieur à 14j augmente le risque rupture', true)
ON CONFLICT (code) DO NOTHING;

-- Signal Rules: Stock Availability
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'STOCK-S001', 'Rupture imminente', 'current_stock < reorder_point AND avg_delay_days > 14', 'critical', 'Produit {product_name} : stock {current_stock} sous seuil, délai fournisseur {avg_delay_days}j', true
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'STOCK-S002', 'Vélocité anormale', 'sales_last_7d > sales_last_30d / 4 * 2', 'warning', 'Produit {product_name} : ventes 7j ({sales_last_7d}) anormalement élevées', true
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'STOCK-S003', 'Fournisseur défaillant', 'reliability_score < 0.6 AND avg_delay_days > 21', 'warning', 'Fournisseur {supplier_name} : score {reliability_score} — délai moyen {avg_delay_days}j', true
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, code) DO NOTHING;


-- =============================================================================
-- 3. SUPPLIER RISK CAPABILITY
-- =============================================================================

INSERT INTO decision_packs (id, title, slug, category, description, status)
VALUES (
  gen_random_uuid(),
  'Supplier Risk',
  'supplier-risk',
  'supply',
  'Évaluation et surveillance des risques fournisseurs : financier, qualité, délai et concentration.',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Semantic Objects: Supplier Risk
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Supplier', 'Fournisseur avec score de risque et santé financière.', 'supplier_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Contract', 'Contrat fournisseur avec criticité et date d''expiration.', 'contract_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'PurchaseOrder', 'Commande avec suivi des délais réels vs attendus.', 'po_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Delivery', 'Livraison avec contrôle qualité et conformité quantité.', 'delivery_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Semantic Attributes: Supplier (supplier-risk)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'country', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'siren', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'risk_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'financial_health', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Contract (supplier-risk)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'contract_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Contract'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Contract'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'start_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Contract'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'end_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Contract'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'value', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Contract'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'criticality', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Contract'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: PurchaseOrder (supplier-risk)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'po_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'amount', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'expected_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'actual_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'delay_days', 'integer', 'days', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Delivery (supplier-risk)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'delivery_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Delivery'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'po_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Delivery'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'received_qty', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Delivery'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'expected_qty', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Delivery'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'quality_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Delivery'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Delivery'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Causal Rules: Supplier Risk
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'SUPP-R001', 'Fournisseur critique à risque', 'Supplier', 'risk_score', '>', 0.7, 'Supplier', 'action_required', 'up', 0.89, 'seed', 'Supplier Risk', 'Score de risque fournisseur élevé nécessite une action préventive', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'SUPP-R002', 'Qualité livraisons dégradée', 'Delivery', 'quality_score', '<', 0.8, 'Supplier', 'quality_risk', 'up', 0.86, 'seed', 'Supplier Risk', 'Score qualité livraisons sous 0.8 signale une dégradation fournisseur', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'SUPP-R003', 'Délai livraison critique', 'PurchaseOrder', 'delay_days', '>', 7, 'Supplier', 'delay_risk', 'up', 0.84, 'seed', 'Supplier Risk', 'Délai de livraison supérieur à 7 jours impacte la chaîne de production', true)
ON CONFLICT (code) DO NOTHING;

-- Signal Rules: Supplier Risk
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'SUPP-S001', 'Fournisseur critique à risque élevé', 'risk_score > 0.7 AND concentration_pct > 30', 'critical', 'Fournisseur {supplier_name} : risque {risk_score} — concentration {concentration_pct}%', true
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'SUPP-S002', 'Contrat critique à échéance', 'days_to_expiry < 60 AND criticality = ''high''', 'warning', 'Contrat {contract_id} expire dans {days_to_expiry}j — renouvellement non initié', true
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'SUPP-S003', 'Qualité livraisons dégradée', 'avg_quality_last_3 < 0.8', 'warning', 'Fournisseur {supplier_name} : qualité moyenne {avg_quality_last_3} sur 3 dernières livraisons', true
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, code) DO NOTHING;


-- =============================================================================
-- 4. MARGIN MANAGEMENT CAPABILITY
-- =============================================================================

INSERT INTO decision_packs (id, title, slug, category, description, status)
VALUES (
  gen_random_uuid(),
  'Margin Management',
  'margin-management',
  'finance',
  'Pilotage de la rentabilité produit, client et campagne promotionnelle.',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Semantic Objects: Margin Management
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec prix de revient et marge cible.', 'product_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Revenue', 'Chiffre d''affaires par produit, client et période.', 'revenue_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Cost', 'Coûts de production, logistique et remises commerciales.', 'cost_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Promotion', 'Opération promotionnelle avec taux de remise et type.', 'promo_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Customer', 'Client avec contribution marginale mesurée.', 'customer_id'
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Semantic Attributes: Product (margin-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'category', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'cost_price', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'list_price', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'margin_target', 'numeric', 'pct', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Revenue (margin-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'revenue_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Revenue'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Revenue'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'customer_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Revenue'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'period', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Revenue'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'revenue_ht', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Revenue'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'quantity_sold', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Revenue'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Cost (margin-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'cost_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Cost'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Cost'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'period', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Cost'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'cogs', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Cost'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'logistics_cost', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Cost'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'commercial_discount', 'numeric', 'pct', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Cost'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Promotion (margin-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'promo_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Promotion'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'product_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Promotion'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'start_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Promotion'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'end_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Promotion'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'discount_pct', 'numeric', 'pct', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Promotion'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'promo_type', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Promotion'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Customer (margin-management)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'customer_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'segment', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'margin_contribution', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'margin-management' AND o.object_name = 'Customer'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Causal Rules: Margin Management
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'MARG-R001', 'Marge produit sous seuil', 'Product', 'margin_target', '<', 15, 'Product', 'margin_alert', 'up', 0.90, 'seed', 'Margin Management', 'Marge réelle inférieure à 15% indique une dégradation de la rentabilité', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'MARG-R002', 'Promotion destructrice valeur', 'Promotion', 'discount_pct', '>', 30, 'Product', 'promo_risk', 'up', 0.82, 'seed', 'Margin Management', 'Remise promotionnelle supérieure à 30% peut annuler la marge', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'MARG-R003', 'Client à marge négative', 'Customer', 'margin_contribution', '<', 0, 'Customer', 'client_profitability_risk', 'up', 0.88, 'seed', 'Margin Management', 'Contribution client négative signale une relation non rentable', true)
ON CONFLICT (code) DO NOTHING;

-- Signal Rules: Margin Management
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'MARG-S001', 'Marge produit sous seuil', 'actual_margin_pct < 15 AND period = current_month', 'warning', 'Produit {product_name} : marge {actual_margin_pct}% sous seuil sur 30j', true
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'MARG-S002', 'Promotion destructrice valeur', 'margin_during_promo < logistics_cost', 'warning', 'Promo {promo_id} sur {product_name} : marge ({margin_during_promo}€) < coût logistique', true
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'MARG-S003', 'Client à marge négative', 'margin_contribution < 0 AND period_count >= 3', 'critical', 'Client {customer_name} : contribution négative {margin_contribution}€ sur 3 mois', true
FROM decision_packs p WHERE p.slug = 'margin-management'
ON CONFLICT (pack_id, code) DO NOTHING;


-- =============================================================================
-- 5. TRANSFORMATION PORTFOLIO CAPABILITY
-- =============================================================================

INSERT INTO decision_packs (id, title, slug, category, description, status)
VALUES (
  gen_random_uuid(),
  'Transformation Portfolio',
  'transformation-portfolio',
  'strategy',
  'Suivi des initiatives de transformation, réalisation des bénéfices et gestion des risques projets.',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Semantic Objects: Transformation Portfolio
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Initiative', 'Initiative stratégique avec bénéfices attendus et priorité.', 'initiative_id'
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Project', 'Projet rattaché à une initiative avec budget et phases.', 'project_id'
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Milestone', 'Jalon de projet avec taux d''avancement et criticité.', 'milestone_id'
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Benefit', 'Bénéfice attendu et réalisé par initiative.', 'benefit_id'
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Risk', 'Risque projet avec probabilité, impact et statut de mitigation.', 'risk_id'
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Budget', 'Budget projet avec consommation et prévision à fin.', 'budget_id'
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Semantic Attributes: Initiative (transformation-portfolio)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'initiative_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Initiative'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Initiative'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'owner', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Initiative'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'strategic_priority', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Initiative'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'expected_benefit', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Initiative'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'status', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Initiative'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Project (transformation-portfolio)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'project_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'initiative_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'start_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'end_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'budget', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'phase', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Project'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Milestone (transformation-portfolio)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'milestone_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Milestone'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'project_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Milestone'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Milestone'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'due_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Milestone'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'completion_pct', 'numeric', 'pct', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Milestone'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'is_critical', 'boolean', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Milestone'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Benefit (transformation-portfolio)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'benefit_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Benefit'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'initiative_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Benefit'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'type', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Benefit'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'expected_value', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Benefit'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'realized_value', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Benefit'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'measure_date', 'date', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Benefit'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Risk (transformation-portfolio)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'risk_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Risk'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'project_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Risk'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'description', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Risk'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'probability', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Risk'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'impact', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Risk'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'mitigation_status', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Risk'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Budget (transformation-portfolio)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'budget_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Budget'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'project_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Budget'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'allocated', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Budget'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'consumed', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Budget'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'forecast_at_completion', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'transformation-portfolio' AND o.object_name = 'Budget'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Causal Rules: Transformation Portfolio
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'TRANSFO-R001', 'Dérive budget projet', 'Budget', 'consumed', '>', 80, 'Project', 'budget_overrun_risk', 'up', 0.88, 'seed', 'Transformation Portfolio', 'Consommation budget > 80% avec avancement insuffisant signale une dérive', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'TRANSFO-R002', 'Bénéfice non réalisé', 'Benefit', 'realized_value', '<', 30, 'Initiative', 'benefit_delivery_risk', 'up', 0.85, 'seed', 'Transformation Portfolio', 'Réalisation bénéfices < 30% de l''attendu à mi-parcours signale un échec probable', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'TRANSFO-R003', 'Risque critique non mitigé', 'Risk', 'probability', '>', 0.7, 'Project', 'critical_risk', 'up', 0.91, 'seed', 'Transformation Portfolio', 'Probabilité de risque élevée sans mitigation active menace le projet', true)
ON CONFLICT (code) DO NOTHING;

-- Signal Rules: Transformation Portfolio
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'TRANSFO-S001', 'Projet en dérive budget', 'consumed > allocated * 0.8 AND completion_pct < 60', 'critical', 'Projet {project_name} : {consumed}€ consommés ({pct_consumed}%) — avancement {completion_pct}%', true
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'TRANSFO-S002', 'Bénéfice non réalisé', 'realized_value < expected_value * 0.3 AND elapsed_pct > 50', 'warning', 'Initiative {initiative_name} : {realized_value}€ réalisés sur {expected_value}€ attendus', true
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'TRANSFO-S003', 'Risque critique non mitigé', 'probability * impact > 0.5 AND mitigation_status = ''inactive''', 'critical', 'Risque ''{description}'' : score {risk_score} — aucune mitigation active', true
FROM decision_packs p WHERE p.slug = 'transformation-portfolio'
ON CONFLICT (pack_id, code) DO NOTHING;


-- =============================================================================
-- 6. AI READINESS CAPABILITY
-- =============================================================================

INSERT INTO decision_packs (id, title, slug, category, description, status)
VALUES (
  gen_random_uuid(),
  'AI Readiness',
  'ai-readiness',
  'technology',
  'Évaluation de la maturité data, applicative et humaine pour l''adoption de l''IA.',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Semantic Objects: AI Readiness
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Application', 'Application SI avec score qualité données et disponibilité API.', 'app_id'
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'API', 'API exposée par une application avec métriques de disponibilité.', 'api_id'
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'DataDomain', 'Domaine de données avec scores de complétude et fraîcheur.', 'domain_id'
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Process', 'Processus métier avec niveau d''automatisation et score IA.', 'process_id'
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Team', 'Équipe avec scores de maturité IA et disposition au changement.', 'team_id'
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'UseCase', 'Cas d''usage IA avec ROI potentiel et score de faisabilité.', 'usecase_id'
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Semantic Attributes: Application (ai-readiness)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'app_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Application'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Application'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'vendor', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Application'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'criticality', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Application'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'data_quality_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Application'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'api_available', 'boolean', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Application'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: API (ai-readiness)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'api_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'app_id', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'endpoint', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'protocol', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'auth_type', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'availability_pct', 'numeric', 'pct', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'response_time', 'numeric', 'ms', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'API'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: DataDomain (ai-readiness)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'domain_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'DataDomain'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'DataDomain'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'owner', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'DataDomain'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'completeness_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'DataDomain'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'freshness_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'DataDomain'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'volume', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'DataDomain'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Process (ai-readiness)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'process_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Process'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Process'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'domain', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Process'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'automation_level', 'numeric', 'pct', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Process'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ai_candidate_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Process'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: Team (ai-readiness)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'team_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Team'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Team'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'ai_literacy_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Team'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'data_skills', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Team'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'change_readiness', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'Team'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Semantic Attributes: UseCase (ai-readiness)
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'usecase_id', 'text', NULL, true
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'UseCase'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'name', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'UseCase'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'domain', 'text', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'UseCase'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'roi_potential', 'numeric', 'EUR', false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'UseCase'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'feasibility_score', 'numeric', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'UseCase'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key)
SELECT gen_random_uuid(), o.id, 'priority', 'integer', NULL, false
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ai-readiness' AND o.object_name = 'UseCase'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Causal Rules: AI Readiness
INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'AIREADY-R001', 'Application critique sans API', 'Application', 'api_available', '<', 1, 'Application', 'integration_blocker', 'up', 0.94, 'seed', 'AI Readiness', 'Application critique sans API disponible bloque l''intégration des données', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'AIREADY-R002', 'Domaine données immature', 'DataDomain', 'completeness_score', '<', 0.6, 'DataDomain', 'data_maturity_risk', 'up', 0.87, 'seed', 'AI Readiness', 'Score complétude données sous 0.6 rend le domaine inexploitable pour l''IA', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold, effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES (gen_random_uuid(), 'AIREADY-R003', 'Use case IA prioritaire', 'UseCase', 'roi_potential', '>', 500000, 'UseCase', 'high_priority_usecase', 'up', 0.89, 'seed', 'AI Readiness', 'ROI potentiel supérieur à 500K€ avec faisabilité élevée — à prioriser', true)
ON CONFLICT (code) DO NOTHING;

-- Signal Rules: AI Readiness
INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'AIREADY-S001', 'Application critique sans API', 'criticality = ''high'' AND api_available = false', 'critical', 'Application {app_name} critique sans API — intégration données impossible', true
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'AIREADY-S002', 'Domaine données immature', 'completeness_score < 0.6 AND freshness_score < 0.7', 'warning', 'Domaine {domain_name} : complétude {completeness_score} + fraîcheur {freshness_score} insuffisantes', true
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, code) DO NOTHING;

INSERT INTO signal_rules (id, pack_id, code, title, condition_sql, severity, message_template, enabled)
SELECT gen_random_uuid(), p.id, 'AIREADY-S003', 'Use case IA prioritaire identifié', 'roi_potential > 500000 AND feasibility_score > 0.75', 'info', 'Use case ''{usecase_name}'' : ROI {roi_potential}€ — faisabilité {feasibility_score}', true
FROM decision_packs p WHERE p.slug = 'ai-readiness'
ON CONFLICT (pack_id, code) DO NOTHING;

END $$;
