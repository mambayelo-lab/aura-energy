
-- ============================================================
-- AURA V1: Universal Decision Packs Library + Sector Overlays + Golden Facts
-- Two pack tables exist: `decision_packs` (ontology FK target) and `packs` (catalog).
-- We seed both with the same universal slugs.
-- ============================================================

-- 1. Add universal metadata to both pack tables
ALTER TABLE public.packs
  ADD COLUMN IF NOT EXISTS is_universal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kpis text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_question text;

ALTER TABLE public.decision_packs
  ADD COLUMN IF NOT EXISTS is_universal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kpis text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_question text,
  ADD COLUMN IF NOT EXISTS owner_role text;

-- 2. Sector overlays
CREATE TABLE IF NOT EXISTS public.sector_overlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_pack_id uuid NOT NULL REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  sector text NOT NULL CHECK (sector IN ('retail','food','manufacturing','ecommerce','energy','services')),
  universal_object text NOT NULL,
  sector_object text NOT NULL,
  attribute_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(decision_pack_id, sector, universal_object)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_overlays TO authenticated;
GRANT ALL ON public.sector_overlays TO service_role;
ALTER TABLE public.sector_overlays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read overlays" ON public.sector_overlays FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write overlays" ON public.sector_overlays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Golden Facts — source per attribute (not per object)
ALTER TABLE public.source_mappings
  ADD COLUMN IF NOT EXISTS semantic_attribute_id uuid REFERENCES public.semantic_attributes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_source_of_truth boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS precedence integer NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_source_mappings_attr ON public.source_mappings(semantic_attribute_id);

CREATE OR REPLACE VIEW public.attribute_source_of_truth AS
SELECT DISTINCT ON (sm.semantic_attribute_id)
  sm.semantic_attribute_id,
  sa.attribute_name,
  so.object_name,
  sm.source_system_id,
  ss.name AS source_system_name,
  sm.confidence,
  sm.precedence
FROM public.source_mappings sm
JOIN public.semantic_attributes sa ON sa.id = sm.semantic_attribute_id
JOIN public.semantic_objects so ON so.id = sa.object_id
LEFT JOIN public.source_systems ss ON ss.id = sm.source_system_id
WHERE sm.semantic_attribute_id IS NOT NULL
ORDER BY sm.semantic_attribute_id,
         sm.is_source_of_truth DESC,
         sm.precedence ASC,
         sm.confidence DESC NULLS LAST;
GRANT SELECT ON public.attribute_source_of_truth TO authenticated;

-- 4. Seed 10 universal packs into BOTH catalog tables
WITH universals(slug, title, category, descr, owner_role, icon, capabilities, kpis, question) AS (VALUES
  ('cash-flow-risk','Cash Flow Risk','Finance',
   'Détecte les tensions de trésorerie avant qu''elles n''impactent l''activité.','cfo','💰',
   ARRAY['Order To Cash','Treasury','Collection','Financial Planning'],
   ARRAY['DSO','Cash Position','Overdue %','WCR'],
   'Aurons-nous un problème de trésorerie dans les prochaines semaines ?'),
  ('stock-availability-risk','Stock Availability Risk','Supply Chain',
   'Anticipe les ruptures de stock en croisant inventaire, demande et lead time fournisseur.','coo','📦',
   ARRAY['Inventory','Procurement','Demand Planning'],
   ARRAY['Stock Cover Days','Stockout Rate','Forecast Accuracy'],
   'Vais-je manquer de stock dans les 14 prochains jours ?'),
  ('supplier-risk-universal','Supplier Risk','Supply Chain',
   'Évalue la fiabilité de chaque fournisseur (OTIF, lead time, performance contractuelle).','cpo','🏭',
   ARRAY['Supplier Management','Procurement','Logistics'],
   ARRAY['OTIF','Lead Time','Quality Score'],
   'Mes fournisseurs mettent-ils mon activité en risque ?'),
  ('margin-erosion','Margin Erosion','Finance',
   'Identifie les sources de dégradation de marge produit par produit.','cfo','📉',
   ARRAY['Pricing','Procurement','Sales Operations'],
   ARRAY['Gross Margin %','COGS Variance','Price Realization'],
   'Pourquoi ma marge se dégrade-t-elle ?'),
  ('delivery-risk','Delivery Risk','Operations',
   'Mesure le respect des engagements clients (SLA, OTD, capacité).','coo','🚚',
   ARRAY['Order Management','Logistics','Customer Service'],
   ARRAY['OTD','SLA Compliance','Capacity Utilization'],
   'Respectons-nous nos engagements de livraison clients ?'),
  ('forecast-accuracy','Forecast Accuracy','Supply Chain',
   'Surveille la fiabilité des prévisions de demande et détecte les dérives.','coo','🎯',
   ARRAY['Demand Planning','S&OP','Analytics'],
   ARRAY['MAPE','Bias','Tracking Signal'],
   'Mes prévisions sont-elles fiables ?'),
  ('project-risk','Project Risk','Transformation',
   'Détecte les dérapages projet (délai, budget, dépendances).','cto','🛠️',
   ARRAY['Portfolio Management','Delivery','PMO'],
   ARRAY['On-Time Delivery','Budget Variance','Dependency Slip'],
   'Mes projets vont-ils déraper ?'),
  ('application-risk','Application Risk','Technology',
   'Cartographie les risques applicatifs (obsolescence, criticité, dette).','cio','💻',
   ARRAY['Architecture','Operations','Security'],
   ARRAY['Tech Debt Index','Obsolescence %','Critical Apps Coverage'],
   'Mon SI met-il l''entreprise en risque ?'),
  ('data-quality-risk','Data Quality Risk','Data',
   'Évalue la confiance dans les données qui nourrissent les décisions.','cdo','📊',
   ARRAY['Data Governance','Data Engineering','Analytics'],
   ARRAY['Completeness','Freshness','Accuracy'],
   'Puis-je faire confiance à mes données pour décider ?'),
  ('ai-readiness-universal','AI Readiness','Transformation',
   'Diagnostique la capacité à industrialiser l''IA et les agents.','cto','🤖',
   ARRAY['Architecture','Data','Governance','Engineering','Business'],
   ARRAY['API Coverage','Data Product Maturity','Agent Readiness'],
   'Sommes-nous prêts à industrialiser l''IA ?')
)
INSERT INTO public.decision_packs (slug, title, category, description, icon, is_published, is_universal, capabilities, kpis, decision_question, owner_role)
SELECT slug, title, category, descr, icon, true, true, capabilities, kpis, question, owner_role FROM universals
ON CONFLICT (slug) DO UPDATE SET
  is_universal=true, capabilities=EXCLUDED.capabilities, kpis=EXCLUDED.kpis,
  decision_question=EXCLUDED.decision_question, description=EXCLUDED.description,
  owner_role=EXCLUDED.owner_role, category=EXCLUDED.category;

WITH universals(slug, title, category, descr, owner_role, icon, capabilities, kpis, question) AS (VALUES
  ('cash-flow-risk','Cash Flow Risk','Finance','Détecte les tensions de trésorerie avant qu''elles n''impactent l''activité.','cfo','💰',ARRAY['Order To Cash','Treasury'],ARRAY['DSO','Cash Position'],'Aurons-nous un problème de trésorerie ?'),
  ('stock-availability-risk','Stock Availability Risk','Supply Chain','Anticipe les ruptures de stock.','coo','📦',ARRAY['Inventory','Procurement'],ARRAY['Stock Cover Days'],'Vais-je manquer de stock ?'),
  ('supplier-risk-universal','Supplier Risk','Supply Chain','Évalue la fiabilité fournisseurs.','cpo','🏭',ARRAY['Supplier Management'],ARRAY['OTIF'],'Mes fournisseurs sont-ils fiables ?'),
  ('margin-erosion','Margin Erosion','Finance','Identifie les sources de dégradation de marge.','cfo','📉',ARRAY['Pricing'],ARRAY['Gross Margin %'],'Pourquoi ma marge baisse ?'),
  ('delivery-risk','Delivery Risk','Operations','Respect des engagements clients.','coo','🚚',ARRAY['Logistics'],ARRAY['OTD'],'Respectons-nous nos engagements ?'),
  ('forecast-accuracy','Forecast Accuracy','Supply Chain','Fiabilité des prévisions.','coo','🎯',ARRAY['Demand Planning'],ARRAY['MAPE'],'Mes prévisions sont-elles fiables ?'),
  ('project-risk','Project Risk','Transformation','Détecte les dérapages projet.','cto','🛠️',ARRAY['PMO'],ARRAY['Budget Variance'],'Mes projets vont-ils déraper ?'),
  ('application-risk','Application Risk','Technology','Risques applicatifs.','cio','💻',ARRAY['Architecture'],ARRAY['Tech Debt'],'Mon SI est-il à risque ?'),
  ('data-quality-risk','Data Quality Risk','Data','Confiance dans les données.','cdo','📊',ARRAY['Data Governance'],ARRAY['Freshness'],'Puis-je faire confiance aux données ?'),
  ('ai-readiness-universal','AI Readiness','Transformation','Industrialiser l''IA.','cto','🤖',ARRAY['Data','Architecture'],ARRAY['Agent Readiness'],'Sommes-nous prêts pour l''IA ?')
)
INSERT INTO public.packs (slug, title, category, description, owner_role, icon, is_published, is_universal, capabilities, kpis, decision_question)
SELECT slug, title, category, descr, owner_role, icon, true, true, capabilities, kpis, question FROM universals
ON CONFLICT (slug) DO UPDATE SET
  is_universal=true, capabilities=EXCLUDED.capabilities, kpis=EXCLUDED.kpis,
  decision_question=EXCLUDED.decision_question, description=EXCLUDED.description;

-- Mark existing sector packs as non-universal
UPDATE public.packs SET is_universal=false WHERE slug IN ('demand-forecast','margin-decline','pricing-arbitrage','supplier-risk');

-- 5. Seed ontology objects per universal pack (uses decision_packs)
WITH ontology(pack_slug, objects) AS (VALUES
  ('cash-flow-risk',          ARRAY['Customer','Invoice','Payment','CashPosition','Receivable','BankAccount']),
  ('stock-availability-risk', ARRAY['Item','Inventory','Demand','Supplier','PurchaseOrder','Delivery','Location']),
  ('supplier-risk-universal', ARRAY['Supplier','Contract','PurchaseOrder','Delivery','Invoice']),
  ('margin-erosion',          ARRAY['Product','Revenue','Cost','Price','Supplier']),
  ('delivery-risk',           ARRAY['Order','Shipment','Delivery','Customer','Carrier']),
  ('forecast-accuracy',       ARRAY['Forecast','Demand','Sales','Inventory']),
  ('project-risk',            ARRAY['Project','Milestone','Dependency','Resource','Budget']),
  ('application-risk',        ARRAY['Application','Interface','Technology','Incident']),
  ('data-quality-risk',       ARRAY['Dataset','Attribute','Source','Fact']),
  ('ai-readiness-universal',  ARRAY['Application','API','DataProduct','Model','Agent','Team','Process'])
)
INSERT INTO public.semantic_objects (pack_id, object_name, description, is_required, position)
SELECT dp.id, t.obj_name, 'Universal ontology object', true, t.ord
FROM ontology o
JOIN public.decision_packs dp ON dp.slug = o.pack_slug
CROSS JOIN LATERAL unnest(o.objects) WITH ORDINALITY AS t(obj_name, ord)
ON CONFLICT DO NOTHING;

-- 6. Seed semantic attributes for key objects
WITH attrs(pack_slug, object_name, attr_name, dtype, unit, descr) AS (VALUES
  ('cash-flow-risk','Invoice','amount','number','EUR','Montant facture'),
  ('cash-flow-risk','Invoice','days_overdue','integer','days','Jours de retard'),
  ('cash-flow-risk','Customer','credit_limit','number','EUR','Encours autorisé'),
  ('cash-flow-risk','CashPosition','balance','number','EUR','Solde de trésorerie'),
  ('stock-availability-risk','Inventory','quantity','number','units','Stock disponible'),
  ('stock-availability-risk','Demand','rate_per_day','number','units/day','Consommation moyenne'),
  ('stock-availability-risk','Supplier','lead_time_days','integer','days','Délai fournisseur'),
  ('stock-availability-risk','PurchaseOrder','open_qty','number','units','Commande en cours'),
  ('supplier-risk-universal','Supplier','otif_rate','number','%','Taux OTIF'),
  ('supplier-risk-universal','Supplier','lead_time_days','integer','days','Lead time moyen'),
  ('margin-erosion','Product','revenue','number','EUR','CA'),
  ('margin-erosion','Product','cost','number','EUR','COGS'),
  ('delivery-risk','Order','promised_date','date',null,'Date promise'),
  ('delivery-risk','Delivery','actual_date','date',null,'Date réelle'),
  ('forecast-accuracy','Forecast','predicted','number','units','Quantité prévue'),
  ('forecast-accuracy','Sales','actual','number','units','Quantité réalisée')
)
INSERT INTO public.semantic_attributes (object_id, attribute_name, data_type, unit, description, is_required, position)
SELECT so.id, a.attr_name, a.dtype, a.unit, a.descr, true,
       row_number() OVER (PARTITION BY so.id ORDER BY a.attr_name)
FROM attrs a
JOIN public.decision_packs dp ON dp.slug = a.pack_slug
JOIN public.semantic_objects so ON so.pack_id = dp.id AND so.object_name = a.object_name
ON CONFLICT DO NOTHING;

-- 7. Seed signal_rules
INSERT INTO public.signal_rules (rule_key, signal_type, pack_slug, title, description, severity_default, is_enabled, config)
VALUES
  ('cash.pressure','cash_pressure','cash-flow-risk','Cash Pressure','Tension de trésorerie détectée sur 30j','critical',true,'{"window_days":30}'::jsonb),
  ('cash.customer_default','customer_default','cash-flow-risk','Customer Default Risk','Client à risque d''impayé','high',true,'{"min_overdue_days":45}'::jsonb),
  ('stock.stockout','stockout','stock-availability-risk','Stockout Risk','Rupture probable < 7 jours','critical',true,'{"cover_days_threshold":7}'::jsonb),
  ('stock.supplier_delay','supplier_delay_impact','stock-availability-risk','Supplier Delay Impact','Retard fournisseur impacte stock','high',true,'{"delay_threshold_days":3}'::jsonb),
  ('supplier.failure','supplier_failure','supplier-risk-universal','Supplier Failure','OTIF dégradé + lead time en hausse','critical',true,'{"otif_threshold":0.75}'::jsonb),
  ('supplier.drift','supplier_drift','supplier-risk-universal','Performance Drift','Dégradation tendancielle','medium',true,'{"window_days":90}'::jsonb),
  ('margin.erosion','margin_erosion','margin-erosion','Margin Erosion','Marge en baisse > 2pts','high',true,'{"drop_points":2}'::jsonb),
  ('margin.cost_inflation','cost_inflation','margin-erosion','Cost Inflation','Coût matière en hausse','medium',true,'{}'::jsonb),
  ('delivery.risk','delivery_risk','delivery-risk','Delivery Risk','Risque de retard livraison','high',true,'{}'::jsonb),
  ('delivery.sla_breach','sla_breach','delivery-risk','SLA Breach','Engagement SLA dépassé','critical',true,'{}'::jsonb),
  ('forecast.drift','forecast_drift','forecast-accuracy','Forecast Drift','MAPE > 25%','high',true,'{"mape_threshold":0.25}'::jsonb),
  ('forecast.demand_spike','demand_spike','forecast-accuracy','Demand Spike','Pic de demande non prévu','medium',true,'{}'::jsonb),
  ('project.delivery','project_delivery','project-risk','Delivery Risk','Retard projet > 15j','high',true,'{}'::jsonb),
  ('project.dependency','dependency_risk','project-risk','Dependency Risk','Dépendance bloquante','critical',true,'{}'::jsonb),
  ('application.obsolescence','obsolescence','application-risk','Obsolescence Risk','Application obsolète','high',true,'{}'::jsonb),
  ('application.criticality','app_criticality','application-risk','Application Criticality','App critique sans redondance','critical',true,'{}'::jsonb),
  ('data.quality','data_quality','data-quality-risk','Data Quality Risk','Qualité dégradée','high',true,'{}'::jsonb),
  ('data.freshness','freshness','data-quality-risk','Freshness Risk','Données obsolètes','medium',true,'{"max_age_hours":24}'::jsonb),
  ('ai.adoption','ai_adoption','ai-readiness-universal','AI Adoption Risk','Adoption IA insuffisante','medium',true,'{}'::jsonb),
  ('ai.data_foundation','data_foundation','ai-readiness-universal','Data Foundation Gap','Socle data insuffisant pour agents','high',true,'{}'::jsonb)
ON CONFLICT (rule_key) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description,
  pack_slug=EXCLUDED.pack_slug, config=EXCLUDED.config;

-- 8. Seed Retail overlay for Maison Lumen (Stock + Margin)
INSERT INTO public.sector_overlays (decision_pack_id, sector, universal_object, sector_object, attribute_overrides, notes)
SELECT dp.id, 'retail', ov.uo, ov.so, ov.oa::jsonb, ov.n
FROM decision_packs dp
JOIN (VALUES
  ('stock-availability-risk','Item','SKU','{"sku_code":"item_id"}','SKU = unité de stock magasin'),
  ('stock-availability-risk','Location','Store','{"store_id":"location_id"}','Point de vente'),
  ('stock-availability-risk','Demand','Sales','{"sales_qty":"demand_qty"}','Ventes magasin = demande'),
  ('margin-erosion','Product','SKU','{}','Produit = référence SKU')
) ov(slug, uo, so, oa, n) ON dp.slug = ov.slug
ON CONFLICT DO NOTHING;
