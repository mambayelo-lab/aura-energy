-- =============================================================================
-- Semantic Contracts complets — toutes capabilities
-- Seed: semantic_objects + semantic_attributes + decision_contracts
-- pour les capabilities sans contrat sémantique complet.
-- Idempotent : ON CONFLICT DO NOTHING partout.
-- =============================================================================

DO $$ BEGIN

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. STOCK AVAILABILITY (supply)
-- Objets: Product, Inventory, Demand, Supplier, PurchaseOrder
-- ─────────────────────────────────────────────────────────────────────────────

-- decision_contract
INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Stock Availability',
  'Quel SKU risque une rupture et pourquoi ?',
  ARRAY['SAP','Shopify','Manhattan','NinePlan'],
  'active', 15, 0.80
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT DO NOTHING;

-- objects
INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Référence produit avec caractéristiques collection.', 'sku'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Inventory', 'Niveau de stock par SKU et localisation.', 'item_location_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Demand', 'Demande observée et prévue par SKU et période.', 'demand_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Supplier', 'Fournisseur avec délai et fiabilité livraison.', 'supplier_id'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'PurchaseOrder', 'Commande fournisseur ouverte avec date attendue.', 'po_number'
FROM decision_packs p WHERE p.slug = 'stock-availability'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Product attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'sku', 'text', NULL, true, 'Identifiant unique du produit (SKU)', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'product_name', 'text', NULL, false, 'Libellé commercial du produit', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'category', 'text', NULL, false, 'Famille produit (Robe, Blouse, Jean…)', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'collection', 'text', NULL, false, 'Collection (SS26, AH26…)', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Inventory attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'available_qty', 'numeric', 'pcs', false, 'Quantité disponible à la vente', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'reserved_qty', 'numeric', 'pcs', false, 'Quantité réservée commandes en cours', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'safety_stock', 'numeric', 'pcs', false, 'Stock de sécurité cible', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'coverage_days', 'numeric', 'jours', false, 'Jours de couverture = stock / vélocité', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'location', 'text', NULL, false, 'Entrepôt ou magasin', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Inventory'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Demand attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'sales_last_7d', 'numeric', 'pcs', false, 'Ventes réelles 7 derniers jours', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'daily_sales_velocity', 'numeric', 'pcs/jour', false, 'Vélocité quotidienne moyenne', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'forecast_qty', 'numeric', 'pcs', false, 'Prévision de demande prochaines 4 semaines', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Demand'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Supplier attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, true, 'Code fournisseur', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'lead_time_days', 'numeric', 'jours', false, 'Délai de livraison moyen', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'otif', 'numeric', '%', false, 'On Time In Full (taux de livraison)', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- PurchaseOrder attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'po_number', 'text', NULL, true, 'Numéro de commande fournisseur', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'open_qty', 'numeric', 'pcs', false, 'Quantité commandée non encore livrée', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'expected_delivery_date', 'date', NULL, false, 'Date de livraison prévue', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'stock-availability' AND o.object_name = 'PurchaseOrder'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SUPPLIER RISK
-- Objets: Supplier, Product, PurchaseOrder, Shipment, Contract
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Supplier Risk',
  'Quel fournisseur met la continuité d''activité en danger ?',
  ARRAY['SAP','SupplierPortal','Excel fournisseurs'],
  'active', 60, 0.80
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Supplier', 'Fournisseur avec ses indicateurs de performance.', 'supplier_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Référence produit avec son fournisseur principal.', 'sku'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Shipment', 'Expédition fournisseur avec statut et retard.', 'shipment_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Contract', 'Contrat fournisseur avec SLA et conditions.', 'contract_id'
FROM decision_packs p WHERE p.slug = 'supplier-risk'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Supplier attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, true, 'Code fournisseur unique', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'supplier_name', 'text', NULL, false, 'Nom du fournisseur', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'country', 'text', NULL, false, 'Pays d''origine/production', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'lead_time_days', 'numeric', 'jours', false, 'Délai de livraison contractuel moyen', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'otif', 'numeric', '%', false, 'On Time In Full — taux livraisons conformes', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'dependency_pct', 'numeric', '%', false, 'Part du CA approvisionnement chez ce fournisseur', 5
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'financial_score', 'numeric', NULL, false, 'Score de santé financière (0-100)', 6
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'reliability_score', 'numeric', NULL, false, 'Score de fiabilité global (0-100)', 7
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Shipment attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'shipment_id', 'text', NULL, true, 'Identifiant expédition', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Shipment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'delay_days', 'numeric', 'jours', false, 'Jours de retard vs date promise', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Shipment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'on_time', 'boolean', NULL, false, 'Livraison dans les délais', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supplier-risk' AND o.object_name = 'Shipment'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CASH MANAGEMENT
-- Objets: CashPosition, Receivable, Payable, CreditLine
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Cash Management',
  'Aurons-nous un problème de trésorerie dans les 30 prochains jours ?',
  ARRAY['SAP Finance','Banque','ERP'],
  'active', 240, 0.85
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'CashPosition', 'Position de trésorerie actuelle et prévisionnelle.', 'period_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Receivable', 'Créances clients avec DSO et aging.', 'invoice_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Payable', 'Dettes fournisseurs avec DPO et échéances.', 'payable_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'CreditLine', 'Ligne de crédit bancaire disponible.', 'credit_id'
FROM decision_packs p WHERE p.slug = 'cash-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- CashPosition attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'period_id', 'text', NULL, true, 'Période (AAAAMM)', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'cash_balance_eur', 'numeric', '€', false, 'Solde de trésorerie actuel', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'cash_forecast_30d_eur', 'numeric', '€', false, 'Prévision tréso à 30 jours', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'minimum_threshold_eur', 'numeric', '€', false, 'Seuil minimum de sécurité tréso', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'CashPosition'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Receivable attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'invoice_id', 'text', NULL, true, 'Numéro de facture', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Receivable'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'dso_days', 'numeric', 'jours', false, 'Days Sales Outstanding — délai moyen encaissement', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Receivable'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'overdue_amount_eur', 'numeric', '€', false, 'Montant en retard de paiement', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Receivable'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'aging_bucket', 'text', NULL, false, 'Tranche d''ancienneté (0-30j, 31-60j, >60j)', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'cash-management' AND o.object_name = 'Receivable'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STORE OPENING / CLOSING (store-opening-closing)
-- Objets: Location, Store, MarketZone, Project, Competitor
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Store Opening & Closing',
  'Faut-il ouvrir, fermer ou repositionner ce point de vente ?',
  ARRAY['Analytics','Finances','CRM','Géomarketing'],
  'active', 1440, 0.75
FROM decision_packs p WHERE p.slug = 'store-opening-closing'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Store', 'Magasin existant avec KPIs financiers et trafic.', 'store_id'
FROM decision_packs p WHERE p.slug = 'store-opening-closing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Location', 'Emplacement candidat à l''ouverture avec potentiel marché.', 'location_id'
FROM decision_packs p WHERE p.slug = 'store-opening-closing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'MarketZone', 'Zone de chalandise avec population et concurrence.', 'zone_id'
FROM decision_packs p WHERE p.slug = 'store-opening-closing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Project', 'Projet d''ouverture / rénovation avec budget et planning.', 'project_id'
FROM decision_packs p WHERE p.slug = 'store-opening-closing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Store attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'store_id', 'text', NULL, true, 'Code point de vente', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'revenue_eur', 'numeric', '€', false, 'Chiffre d''affaires annuel', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'ebitda_margin_pct', 'numeric', '%', false, 'Marge EBITDA magasin', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'footfall_per_day', 'numeric', 'visiteurs/j', false, 'Trafic quotidien moyen', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'conversion_rate_pct', 'numeric', '%', false, 'Taux de transformation visiteurs/acheteurs', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'rent_cost_eur_sqm', 'numeric', '€/m²', false, 'Loyer au m²', 5
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'cannibalization_risk_pct', 'numeric', '%', false, 'Risque de cannibalisation sur magasins proches', 6
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Store'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Location attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'location_id', 'text', NULL, true, 'Code emplacement', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Location'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'city', 'text', NULL, false, 'Ville d''implantation', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Location'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'market_potential_eur', 'numeric', '€', false, 'Potentiel de marché estimé sur la zone', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Location'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'break_even_months', 'numeric', 'mois', false, 'Délai estimé de retour sur investissement', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'store-opening-closing' AND o.object_name = 'Location'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DEMAND FORECASTING
-- Objets: Product, Forecast, Season, Promotion
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Demand Forecasting',
  'Quelle demande prévoir par SKU pour les 4 prochaines semaines ?',
  ARRAY['NinePlan','Shopify','CegX','SAP'],
  'active', 60, 0.78
FROM decision_packs p WHERE p.slug = 'demand-forecasting'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Référence avec historique de ventes et forecast.', 'sku'
FROM decision_packs p WHERE p.slug = 'demand-forecasting'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Forecast', 'Prévision de demande par SKU et période.', 'forecast_id'
FROM decision_packs p WHERE p.slug = 'demand-forecasting'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Season', 'Saison de vente avec fenêtre et tendances.', 'season_id'
FROM decision_packs p WHERE p.slug = 'demand-forecasting'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Product attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'sku', 'text', NULL, true, 'Code produit', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'sales_last_30d', 'numeric', 'pcs', false, 'Ventes réelles 30 derniers jours', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'seasonality_index', 'numeric', NULL, false, 'Indice de saisonnalité (1 = neutre)', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Forecast attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'forecast_id', 'text', NULL, true, 'Identifiant prévision (sku+période)', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Forecast'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'forecast_qty', 'numeric', 'pcs', false, 'Quantité prévisionnelle', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Forecast'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'actual_qty', 'numeric', 'pcs', false, 'Quantité réellement vendue', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Forecast'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'accuracy_pct', 'numeric', '%', false, 'Précision du forecast (Actual/Forecast × 100)', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Forecast'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'bias', 'numeric', '%', false, 'Biais du modèle (sur/sous-estimation)', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'demand-forecasting' AND o.object_name = 'Forecast'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CHANNEL PERFORMANCE
-- Objets: Channel, Store, Product, Order, Campaign
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Channel Performance',
  'Quel canal génère la meilleure rentabilité et comment réallouer les ressources ?',
  ARRAY['Shopify','CegX','SkyCRM','SAP'],
  'active', 60, 0.80
FROM decision_packs p WHERE p.slug = 'channel-performance'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Channel', 'Canal de distribution (boutique, e-commerce, wholesale…).', 'channel_id'
FROM decision_packs p WHERE p.slug = 'channel-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Order', 'Commande client avec canal et marge.', 'order_id'
FROM decision_packs p WHERE p.slug = 'channel-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Customer', 'Client avec segment et valeur vie.', 'customer_id'
FROM decision_packs p WHERE p.slug = 'channel-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Channel attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'channel_id', 'text', NULL, true, 'Identifiant canal', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'channel-performance' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'revenue_eur', 'numeric', '€', false, 'CA réalisé sur le canal', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'channel-performance' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'margin_pct', 'numeric', '%', false, 'Marge nette par canal', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'channel-performance' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'return_rate_pct', 'numeric', '%', false, 'Taux de retours par canal', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'channel-performance' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'acquisition_cost_eur', 'numeric', '€', false, 'Coût d''acquisition client sur ce canal', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'channel-performance' AND o.object_name = 'Channel'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. UNSOLD MANAGEMENT (invendus / soldes)
-- Objets: Product, Stock, MarkdownAction, Season
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Unsold Management',
  'Quels produits risquent de ne pas s''écouler et quelle action de déstockage prioriser ?',
  ARRAY['CegX','Manhattan','SAP','Shopify'],
  'active', 120, 0.78
FROM decision_packs p WHERE p.slug = 'unsold-management'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Référence avec rotation, stock et taux d''écoulement.', 'sku'
FROM decision_packs p WHERE p.slug = 'unsold-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'MarkdownAction', 'Action de démarque avec profondeur et volume visé.', 'action_id'
FROM decision_packs p WHERE p.slug = 'unsold-management'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Product attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'sku', 'text', NULL, true, 'Code produit', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'unsold-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'sell_through_pct', 'numeric', '%', false, 'Taux d''écoulement = vendus / entrés', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'unsold-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'weeks_on_shelf', 'numeric', 'semaines', false, 'Ancienneté en magasin', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'unsold-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'end_of_season_date', 'date', NULL, false, 'Date fin de saison / collection', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'unsold-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'markdown_exposure_eur', 'numeric', '€', false, 'Valeur stock × risque d''invendu', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'unsold-management' AND o.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SUPPLY CHAIN PERFORMANCE
-- Objets: Warehouse, Carrier, Order, Replenishment
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Supply Chain Performance',
  'La supply chain tient-elle ses SLA et où sont les goulets ?',
  ARRAY['Manhattan','SAP','Transporteurs'],
  'active', 60, 0.80
FROM decision_packs p WHERE p.slug = 'supply-chain-performance'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Warehouse', 'Entrepôt avec taux de service et saturation.', 'warehouse_id'
FROM decision_packs p WHERE p.slug = 'supply-chain-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Carrier', 'Transporteur avec OTD et coût.', 'carrier_id'
FROM decision_packs p WHERE p.slug = 'supply-chain-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Replenishment', 'Cycle de réapprovisionnement par SKU et entrepôt.', 'replenishment_id'
FROM decision_packs p WHERE p.slug = 'supply-chain-performance'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Warehouse attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'warehouse_id', 'text', NULL, true, 'Code entrepôt', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Warehouse'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'saturation_pct', 'numeric', '%', false, 'Taux de remplissage capacité', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Warehouse'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'service_level_pct', 'numeric', '%', false, 'SLA picking & expédition', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Warehouse'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'cost_per_order_eur', 'numeric', '€', false, 'Coût de traitement par commande', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Warehouse'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Carrier attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'carrier_id', 'text', NULL, true, 'Code transporteur', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'otd_pct', 'numeric', '%', false, 'On Time Delivery', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'avg_delay_days', 'numeric', 'jours', false, 'Retard moyen en jours', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'cost_eur_per_parcel', 'numeric', '€', false, 'Coût moyen par colis', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'supply-chain-performance' AND o.object_name = 'Carrier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ETHICAL SOURCING
-- Objets: Supplier, Factory, Material, Certification
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Ethical Sourcing',
  'Nos fournisseurs respectent-ils nos standards RSE et quels risques existent ?',
  ARRAY['SAP','Portail fournisseurs','Audit tiers','Certifications'],
  'active', 1440, 0.75
FROM decision_packs p WHERE p.slug = 'ethical-sourcing'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Supplier', 'Fournisseur avec score RSE et pays d''origine.', 'supplier_id'
FROM decision_packs p WHERE p.slug = 'ethical-sourcing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Factory', 'Site de production avec audit et risques sociaux.', 'factory_id'
FROM decision_packs p WHERE p.slug = 'ethical-sourcing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Certification', 'Certification RSE/environnementale avec validité.', 'cert_id'
FROM decision_packs p WHERE p.slug = 'ethical-sourcing'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Supplier attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'supplier_id', 'text', NULL, true, 'Code fournisseur', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ethical-sourcing' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'esg_score', 'numeric', NULL, false, 'Score ESG global (0-100)', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ethical-sourcing' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'audit_date', 'date', NULL, false, 'Date du dernier audit RSE', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ethical-sourcing' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'country_risk_level', 'text', NULL, false, 'Niveau de risque pays (low/medium/high/critical)', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ethical-sourcing' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'carbon_footprint_kgco2', 'numeric', 'kgCO₂', false, 'Empreinte carbone par unité produite', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'ethical-sourcing' AND o.object_name = 'Supplier'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PROMOTION OPTIMIZATION (promotion-optimization — différent de promotion-effectiveness)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO decision_contracts (id, pack_id, title, business_question, expected_sources, status, freshness_sla_minutes, confidence_threshold)
SELECT gen_random_uuid(), p.id,
  'Contrat — Promotion Optimization',
  'Quelle mécanique promotionnelle maximise le volume sans détruire la marge ?',
  ARRAY['Shopify','CegX','SkyCRM'],
  'active', 60, 0.78
FROM decision_packs p WHERE p.slug = 'promotion-optimization'
ON CONFLICT DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Campaign', 'Campagne promotionnelle avec mécanique et résultats.', 'campaign_id'
FROM decision_packs p WHERE p.slug = 'promotion-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

INSERT INTO semantic_objects (id, pack_id, object_name, description, business_key_attribute)
SELECT gen_random_uuid(), p.id, 'Product', 'Produit avec élasticité et comportement promo.', 'sku'
FROM decision_packs p WHERE p.slug = 'promotion-optimization'
ON CONFLICT (pack_id, object_name) DO NOTHING;

-- Campaign attributes
INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'campaign_id', 'text', NULL, true, 'Identifiant campagne', 0
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-optimization' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'discount_pct', 'numeric', '%', false, 'Profondeur de remise', 1
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-optimization' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'volume_lift_pct', 'numeric', '%', false, 'Uplift volume vs période comparable', 2
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-optimization' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'roi_pct', 'numeric', '%', false, 'Retour sur investissement promotion', 3
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-optimization' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

INSERT INTO semantic_attributes (id, object_id, attribute_name, data_type, unit, is_business_key, description, position)
SELECT gen_random_uuid(), o.id, 'margin_impact_eur', 'numeric', '€', false, 'Impact marge absolu de la promo', 4
FROM semantic_objects o JOIN decision_packs p ON o.pack_id = p.id
WHERE p.slug = 'promotion-optimization' AND o.object_name = 'Campaign'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ENSURE ALL PACKS HAVE A DECISION CONTRACT
-- Pour tous les packs sans contrat existant
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO decision_contracts (id, pack_id, title, expected_sources, status)
SELECT gen_random_uuid(), p.id,
  'Contrat — ' || p.title,
  ARRAY[]::text[],
  'draft'
FROM decision_packs p
WHERE NOT EXISTS (
  SELECT 1 FROM decision_contracts dc WHERE dc.pack_id = p.id
);

END $$;
