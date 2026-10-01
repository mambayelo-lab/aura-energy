-- Supply pack + semantic wiring for Hub extraction pipeline
-- Creates pack slug='supply' with objects/attributes matching runHubExtraction ATTRIBUTE_MAPPINGS
-- Adds causal rules that fire on real Hub fact attribute names

-- 1. Decision Pack "supply"
INSERT INTO public.decision_packs (slug, title, category, description, icon, is_published)
VALUES (
  'supply',
  'Pilotage Approvisionnement',
  'Supply Chain',
  'Décisions de réassort : anticipe les ruptures, pilote les délais fournisseurs et la vélocité SKU.',
  'package',
  true
) ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;

-- 2. Decision Contract
INSERT INTO public.decision_contracts (pack_id, title, business_question, expected_sources, freshness_sla_minutes, confidence_threshold, business_owner, decision_owner, status)
SELECT dp.id,
  'Contrat Supply Maison Lumen',
  'Quels SKUs sont en risque de rupture ou nécessitent un réassort urgent ?',
  ARRAY['NexERP S/4HANA', 'NinePlan Demand Plan', 'Meridian Active Omni'],
  60,
  0.75,
  'Directrice Supply Chain',
  'DAF / DSI',
  'active'
FROM public.decision_packs dp WHERE dp.slug = 'supply'
ON CONFLICT (pack_id, decision_id) DO NOTHING;

-- 3. Semantic Object: Product (object_name must match object_name written by runHubExtraction)
INSERT INTO public.semantic_objects (pack_id, object_name, description, business_key_attribute, is_required, position)
SELECT dp.id, 'Product', 'Référence produit / SKU Maison Lumen (clé : SAP Material ID)', 'product_id', true, 1
FROM public.decision_packs dp WHERE dp.slug = 'supply'
ON CONFLICT (pack_id, decision_id, object_name) DO NOTHING;

-- 4. Semantic Attributes for Product (must match attribute_name in ATTRIBUTE_MAPPINGS / push() calls)
INSERT INTO public.semantic_attributes (object_id, attribute_name, data_type, unit, description, is_required, is_business_key, position)
SELECT so.id, a.attr_name, a.dtype, a.unit, a.descr, true, a.is_bk, a.pos
FROM public.semantic_objects so
JOIN public.decision_packs dp ON dp.id = so.pack_id
CROSS JOIN (VALUES
  ('product_id',          'string',  null,    'Identifiant SAP Material (Business Key)',  true,  1),
  ('current_stock',       'number',  'units', 'Stock disponible (entrepôt + magasins)',   true,  2),
  ('sales_last_7d',       'number',  'units', 'Ventes des 7 derniers jours (forecast)',   true,  3),
  ('supplier_delay_days', 'integer', 'days',  'Délai moyen fournisseur (POs ouverts)',    true,  4),
  ('open_po_quantity',    'integer', 'units', 'Quantité totale des POs ouverts',          true,  5)
) AS a(attr_name, dtype, unit, descr, is_bk, pos)
WHERE dp.slug = 'supply' AND so.object_name = 'Product'
ON CONFLICT (object_id, attribute_name) DO NOTHING;

-- Mark product_id as business key on the object
UPDATE public.semantic_objects so
SET business_key_attribute = 'product_id'
FROM public.decision_packs dp
WHERE dp.id = so.pack_id AND dp.slug = 'supply' AND so.object_name = 'Product';

UPDATE public.semantic_attributes sa
SET is_business_key = true
FROM public.semantic_objects so
JOIN public.decision_packs dp ON dp.id = so.pack_id
WHERE sa.object_id = so.id AND dp.slug = 'supply' AND sa.attribute_name = 'product_id';

-- 5. Causal rules wired to real Hub fact attributes (cause_object=Product, cause_attribute=<real attr>)
INSERT INTO public.causal_rules (
  code, sector, mission_id, title, rationale, rule_type, domain,
  cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction,
  source, confidence, is_active
) VALUES
(
  'R-HUB-STOCKOUT', 'retail', '11111111-1111-1111-1111-111111111111',
  'Stock faible → Risque rupture imminente',
  'Un stock inférieur à 20 unités sur un SKU signale un risque de rupture dans les 7 prochains jours compte tenu de la vélocité moyenne.',
  'measurable', 'supply',
  'Product', 'current_stock', '<', '20',
  'Operations', 'stockout_risk', 'increase',
  'hub_extraction', 0.92, true
),
(
  'R-HUB-VELOCITY', 'retail', '11111111-1111-1111-1111-111111111111',
  'Forte vélocité → Réassort urgent requis',
  'Un SKU vendant plus de 30 unités sur 7 jours avec un stock faible nécessite un réassort immédiat.',
  'measurable', 'supply',
  'Product', 'sales_last_7d', '>', '30',
  'Supply', 'reorder_urgency', 'increase',
  'hub_extraction', 0.88, true
),
(
  'R-HUB-DELAY', 'retail', '11111111-1111-1111-1111-111111111111',
  'Délai fournisseur > 14j → Risque approvisionnement',
  'Un délai fournisseur moyen supérieur à 14 jours compromet les réassorts sur les SKUs en tension.',
  'measurable', 'supply',
  'Product', 'supplier_delay_days', '>', '14',
  'Procurement', 'supply_risk', 'increase',
  'hub_extraction', 0.85, true
),
(
  'R-HUB-NO-PO', 'retail', '11111111-1111-1111-1111-111111111111',
  'Aucun PO ouvert → Rupture non couverte',
  'Un SKU sans bon de commande ouvert et avec un stock faible est en risque de rupture non anticipée.',
  'measurable', 'supply',
  'Product', 'open_po_quantity', '<', '1',
  'Procurement', 'coverage_gap', 'increase',
  'hub_extraction', 0.80, true
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  rationale = EXCLUDED.rationale,
  is_active = EXCLUDED.is_active,
  threshold = EXCLUDED.threshold;

-- 6. Signal rules for the supply pack (rule_key format matches runSignalEngine legacy path)
INSERT INTO public.signal_rules (rule_key, signal_type, pack_slug, title, description, severity_default, is_enabled, config)
VALUES
  ('hub.stockout', 'stockout', 'supply', 'Rupture imminente (Hub)', 'Stock < 20 unités détecté via NexERP', 'critical', true,
   '{"attribute":"current_stock","operator":"<","threshold":20}'::jsonb),
  ('hub.velocity', 'reorder_alert', 'supply', 'Réassort urgent (vélocité)', 'Ventes 7j > 30 unités détectées via NinePlan', 'high', true,
   '{"attribute":"sales_last_7d","operator":">","threshold":30}'::jsonb),
  ('hub.supplier_delay', 'supplier_risk', 'supply', 'Délai fournisseur critique', 'Délai moyen > 14j détecté via NexERP POs', 'high', true,
   '{"attribute":"supplier_delay_days","operator":">","threshold":14}'::jsonb)
ON CONFLICT (rule_key) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, config = EXCLUDED.config;
