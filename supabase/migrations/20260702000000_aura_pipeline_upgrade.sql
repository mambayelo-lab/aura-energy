-- =============================================================================
-- Migration: 20260702000000_aura_pipeline_upgrade.sql
-- Enrichit extraction_contracts avec access_level, pii_flag, privacy_classification
-- Ajoute facts supplémentaires couvrant les capabilities manquantes
-- Ajoute des signal_rules enrichies avec config JSON complet
-- Idempotent via IF NOT EXISTS et ON CONFLICT DO NOTHING
-- =============================================================================

-- ── 1. Enrichir extraction_contracts ─────────────────────────────────────────

ALTER TABLE extraction_contracts
  ADD COLUMN IF NOT EXISTS access_level       text NOT NULL DEFAULT 'GREEN',
  ADD COLUMN IF NOT EXISTS pii_flag           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_classification text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS cache_allowed      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS masking_required   boolean NOT NULL DEFAULT false;

-- Mettre à jour access_level selon le type de source (heuristique sur source_system)
UPDATE extraction_contracts
SET access_level = CASE
  WHEN lower(source_system) LIKE '%erp%'      OR lower(source_system) LIKE '%sap%'     THEN 'GREEN'
  WHEN lower(source_system) LIKE '%crm%'      OR lower(source_system) LIKE '%salesforce%' THEN 'GREEN'
  WHEN lower(source_system) LIKE '%wms%'      OR lower(source_system) LIKE '%manhattan%' THEN 'AMBER'
  WHEN lower(source_system) LIKE '%as400%'    OR lower(source_system) LIKE '%legacy%'   THEN 'RED'
  WHEN lower(source_system) LIKE '%hr%'       OR lower(source_system) LIKE '%rh%'       THEN 'AMBER'
  WHEN lower(source_system) LIKE '%finance%'  OR lower(source_system) LIKE '%cegx%'     THEN 'AMBER'
  WHEN lower(source_system) LIKE '%analytics%' OR lower(source_system) LIKE '%snowflake%' THEN 'GREEN'
  WHEN lower(source_system) LIKE '%external%' OR lower(source_system) LIKE '%dun%'      THEN 'AMBER'
  ELSE 'GREEN'
END
WHERE access_level = 'GREEN' AND source_system IS NOT NULL;

-- ── 2. Facts supplémentaires pour couvrir toutes les capabilities ─────────────

INSERT INTO facts (object_name, attribute_name, value_text, value_number, source_app, observed_at, confidence, semantic_role) VALUES

-- ── Supplier Risk ──
('Supplier', 'risk_score',            NULL, 0.68,   'NexERP',     now() - interval '6 hours',   0.89, 'indicator'),
('Supplier', 'financial_health',      NULL, 52,     'D&B',        now() - interval '1 day',      0.81, 'indicator'),
('Supplier', 'reliability_score',     NULL, 0.84,   'NexERP',     now() - interval '4 hours',    0.92, 'kpi'),
('Supplier', 'avg_delay_days',        NULL, 11.4,   'NexERP',     now() - interval '6 hours',    0.90, 'kpi'),
('Supplier', 'concentration_pct',     NULL, 38.2,   'NexERP',     now() - interval '12 hours',   0.87, 'indicator'),
('Supplier', 'otif',                  NULL, 88.4,   'NexERP',     now() - interval '4 hours',    0.93, 'kpi'),
('Supplier', 'quality_score',         NULL, 0.82,   'NexERP',     now() - interval '8 hours',    0.88, 'kpi'),
('Delivery', 'quality_score',         NULL, 0.79,   'NexERP',     now() - interval '8 hours',    0.85, 'kpi'),
('Contract', 'days_to_expiry',        NULL, 47,     'NexERP',     now() - interval '1 day',      0.99, 'indicator'),
('Contract', 'criticality',           'high', NULL, 'NexERP',     now() - interval '1 day',      0.99, 'attribute'),

-- ── Cash / Working Capital ──
('CashPosition', 'available_cash',    NULL, 1240000,'NexCash',    now() - interval '15 minutes', 0.99, 'kpi'),
('CashPosition', 'forecasted_cash_7d',NULL, 980000, 'NexCash',    now() - interval '1 hour',     0.91, 'forecast'),
('CashPosition', 'forecasted_cash_30d',NULL,520000, 'NexCash',    now() - interval '1 hour',     0.87, 'forecast'),
('Invoice',      'days_overdue',      NULL, 28,     'CEGX',       now() - interval '3 hours',    0.88, 'kpi'),
('Customer',     'payment_terms',     NULL, 45,     'SkyERP',     now() - interval '6 hours',    0.90, 'attribute'),
('Invoice',      'amount_ttc',        NULL, 340000, 'CEGX',       now() - interval '3 hours',    0.95, 'kpi'),
('CashPosition', 'credit_line_used_pct', NULL, 42, 'NexCash',    now() - interval '2 hours',    0.93, 'indicator'),

-- ── Margin Management ──
('Product',  'margin_target',         NULL, 22.4,   'NexERP',     now() - interval '1 day',      0.97, 'kpi'),
('Product',  'cost_price',            NULL, 148,    'NexERP',     now() - interval '1 day',      0.99, 'attribute'),
('Product',  'list_price',            NULL, 390,    'NexERP',     now() - interval '1 day',      0.99, 'attribute'),
('Revenue',  'revenue_ht',            NULL, 895000, 'CEGX',       now() - interval '4 hours',    0.96, 'kpi'),
('Cost',     'cogs',                  NULL, 234000, 'NexERP',     now() - interval '4 hours',    0.95, 'kpi'),
('Cost',     'logistics_cost',        NULL, 48000,  'Meridian',   now() - interval '6 hours',    0.89, 'kpi'),
('Promotion','discount_pct',          NULL, 18.7,   'SkyERP',     now() - interval '4 hours',    0.92, 'attribute'),
('Customer', 'margin_contribution',   NULL, 8200,   'CEGX',       now() - interval '1 day',      0.88, 'kpi'),

-- ── Stock Availability ──
('Inventory', 'current_stock',        NULL, 4200,   'Meridian',   now() - interval '30 minutes', 0.98, 'kpi'),
('Inventory', 'available_stock',      NULL, 3800,   'Meridian',   now() - interval '30 minutes', 0.98, 'kpi'),
('Inventory', 'reserved_stock',       NULL, 400,    'Meridian',   now() - interval '30 minutes', 0.96, 'kpi'),
('Demand',    'sales_last_7d',        NULL, 620,    'WebStore',   now() - interval '2 hours',    0.94, 'kpi'),
('Demand',    'forecast_next_30d',    NULL, 2800,   'NinePlan',   now() - interval '3 hours',    0.82, 'forecast'),
('PurchaseOrder', 'delay_days',       NULL, 3,      'NexERP',     now() - interval '6 hours',    0.87, 'indicator'),
('PurchaseOrder', 'status',           'confirmed', NULL, 'NexERP', now() - interval '6 hours',   0.99, 'attribute'),

-- ── Transformation Portfolio ──
('Initiative', 'expected_benefit',    NULL, 2800000,'SharePoint', now() - interval '1 day',      0.75, 'forecast'),
('Project',   'budget',               NULL, 480000, 'SharePoint', now() - interval '1 day',      0.88, 'attribute'),
('Milestone', 'completion_pct',       NULL, 67,     'SharePoint', now() - interval '1 day',      0.80, 'kpi'),
('Risk',      'probability',          NULL, 0.35,   'SharePoint', now() - interval '1 day',      0.72, 'indicator'),
('Benefit',   'realized_pct',         NULL, 41,     'SharePoint', now() - interval '2 days',     0.78, 'kpi'),

-- ── AI Readiness ──
('Application', 'api_availability',   NULL, 0.94,   'Argus',      now() - interval '1 hour',     0.91, 'kpi'),
('Application', 'data_quality_score', NULL, 62,     'Argus',      now() - interval '2 hours',    0.85, 'kpi'),
('Application', 'sso_available',      'true', NULL, 'Argus',      now() - interval '1 hour',     0.99, 'attribute'),
('SemanticObject', 'coverage_pct',    NULL, 71,     'Argus',      now() - interval '3 hours',    0.88, 'kpi'),
('DataAsset', 'pii_exposure',         'low', NULL,  'Argus',      now() - interval '4 hours',    0.83, 'attribute'),
('DecisionCapability', 'owner_defined', 'true', NULL, 'Aura',     now() - interval '12 hours',   0.99, 'attribute')

ON CONFLICT DO NOTHING;

-- ── 3. Enrichir signal_rules avec config JSON complet ─────────────────────────
-- Les signal_rules existantes ont probablement un config JSON vide ou basique
-- On les enrichit avec des contributeurs détaillés

-- Supplier Risk signal
UPDATE signal_rules SET
  contributors = '[
    {"label":"Fragilité financière","desc":"Score financier et probabilité défaillance","weight":45,"iconColor":"text-red-500"},
    {"label":"Retards livraison","desc":"Performance livraison et délais","weight":30,"iconColor":"text-amber-500"},
    {"label":"Concentration","desc":"Taux de dépendance fournisseur","weight":15,"iconColor":"text-orange-500"},
    {"label":"Qualité","desc":"Score qualité et réclamations","weight":10,"iconColor":"text-blue-500"}
  ]'::jsonb,
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{logic_formula}',
    '"RISK_SCORE = 0.45 × financial_risk + 0.30 × delivery_delay + 0.15 × dependency + 0.10 × quality"'
  )
WHERE rule_key LIKE 'SUPP-%' AND (contributors IS NULL OR contributors = 'null'::jsonb);

-- Cash signal
UPDATE signal_rules SET
  contributors = '[
    {"label":"Trésorerie disponible","desc":"Niveau de cash et prévisions","weight":50,"iconColor":"text-red-500"},
    {"label":"DSO","desc":"Délai moyen de recouvrement","weight":30,"iconColor":"text-amber-500"},
    {"label":"Échéances","desc":"Paiements fournisseurs court terme","weight":20,"iconColor":"text-orange-500"}
  ]'::jsonb,
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{logic_formula}',
    '"CASH_RISK = 0.50 × cash_runway + 0.30 × dso_score + 0.20 × payment_pressure"'
  )
WHERE rule_key LIKE 'CASH-%' AND (contributors IS NULL OR contributors = 'null'::jsonb);

-- Stock signal
UPDATE signal_rules SET
  contributors = '[
    {"label":"Niveau de stock","desc":"Jours de couverture disponibles","weight":55,"iconColor":"text-red-500"},
    {"label":"Vélocité vente","desc":"Cadence de sortie des références","weight":30,"iconColor":"text-amber-500"},
    {"label":"Délai réappro","desc":"Lead time fournisseur pour réassort","weight":15,"iconColor":"text-orange-500"}
  ]'::jsonb,
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{logic_formula}',
    '"STOCK_RISK = 0.55 × (1/coverage_days) + 0.30 × velocity + 0.15 × reorder_delay"'
  )
WHERE rule_key LIKE 'STOCK-%' AND (contributors IS NULL OR contributors = 'null'::jsonb);

-- Margin signal
UPDATE signal_rules SET
  contributors = '[
    {"label":"Marge brute","desc":"Marge réelle vs objectif","weight":50,"iconColor":"text-red-500"},
    {"label":"Remises","desc":"Taux de discount vs seuil","weight":30,"iconColor":"text-amber-500"},
    {"label":"Coûts logistiques","desc":"Impact des coûts sur la marge nette","weight":20,"iconColor":"text-orange-500"}
  ]'::jsonb,
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{logic_formula}',
    '"MARGIN_RISK = 0.50 × (target_margin - actual_margin) + 0.30 × discount_excess + 0.20 × logistics_pressure"'
  )
WHERE rule_key LIKE 'MARG-%' AND (contributors IS NULL OR contributors = 'null'::jsonb);

-- ── 4. Table decision_capabilities (vue simplifiée ancrée sur decision_packs) ─

CREATE TABLE IF NOT EXISTS decision_capabilities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug       text UNIQUE NOT NULL,
  title           text NOT NULL,
  business_owner  text,
  owner_role      text,
  target_persona  text DEFAULT 'CEO, COO',
  business_question text,
  status          text NOT NULL DEFAULT 'active',
  linked_apps     text[] DEFAULT '{}',
  linked_objects  text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

INSERT INTO decision_capabilities (pack_slug, title, business_owner, owner_role, target_persona, business_question, status, linked_apps, linked_objects)
VALUES
  ('supplier-risk',           'Supplier Risk',            'Marie Leconte',      'Supply Chain Director', 'COO, CPO',          'Quels fournisseurs menacent la continuité de la supply chain ?', 'active', ARRAY['NexERP','D&B','Sustainalytics'], ARRAY['Supplier','Contract','Delivery','PurchaseOrder']),
  ('cash-management',         'Cash / Working Capital',   'Éric Fontaine',      'CFO',                   'CEO, CFO',          'La trésorerie est-elle suffisante pour les 30 prochains jours ?', 'active', ARRAY['NexCash','CEGX','SkyERP'],        ARRAY['CashPosition','Invoice','Payment','Customer']),
  ('margin-management',       'Margin Protection',        'Camille Vidal',      'Commercial Director',   'CEO, CMO',          'Où et pourquoi la marge est-elle en danger ?',                 'active', ARRAY['NexERP','CEGX','SkyERP','WebStore'],ARRAY['Product','Revenue','Cost','Promotion']),
  ('stock-availability',      'Stock Availability',       'François Renard',    'Operations Director',   'COO, Supply Chain', 'Quels produits risquent une rupture de stock dans 14 jours ?',  'active', ARRAY['Meridian','NexERP','WebStore'],    ARRAY['Inventory','Product','Demand','PurchaseOrder']),
  ('transformation-portfolio','Transformation Portfolio', 'Isabelle Morin',     'Strategy Director',     'CEO, Board',        'Le portefeuille de transformation délivre-t-il ses bénéfices ?','draft',  ARRAY['SharePoint','ProjectApp'],          ARRAY['Initiative','Project','Milestone','Benefit','Risk']),
  ('ai-readiness',            'AI / Decision Readiness',  NULL,                 'CTO',                   'CTO, CDO',          'Les capabilities décisionnelles sont-elles prêtes pour l''IA ?', 'draft',  ARRAY['Argus','Aura'],                     ARRAY['Application','DataAsset','SemanticObject','DecisionCapability'])
ON CONFLICT (pack_slug) DO UPDATE SET
  title           = EXCLUDED.title,
  business_owner  = EXCLUDED.business_owner,
  owner_role      = EXCLUDED.owner_role,
  status          = EXCLUDED.status;

-- ── 5. Index pour performance ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_facts_object_observed ON facts (object_name, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_contracts_access_level ON extraction_contracts (access_level);
CREATE INDEX IF NOT EXISTS idx_signal_rules_enabled ON signal_rules (is_enabled) WHERE is_enabled = true;
