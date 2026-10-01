-- ── Seed: Retail Mode & Luxe — facts, signals, chart configs ─────────────────

-- 1. Facts réalistes (retail mode + luxe)
INSERT INTO facts (object_name, attribute_name, value_text, value_number, source_app, observed_at, confidence) VALUES
-- Stock & rotation
('Product',    'stock_disponible',          NULL, 4200,   'SAP',        now() - interval '2 hours',  0.97),
('Product',    'taux_rotation_stock',       NULL, 3.8,    'SAP',        now() - interval '2 hours',  0.95),
('Product',    'jours_couverture_stock',    NULL, 22,     'SAP',        now() - interval '3 hours',  0.94),
('Product',    'rupture_en_cours',          NULL, 47,     'SAP',        now() - interval '1 hour',   0.99),
-- Ventes
('Sales',      'ca_30j_keur',              NULL, 1240,   'ERP',        now() - interval '1 day',    0.98),
('Sales',      'ca_vs_n1_pct',             NULL, -4.2,   'ERP',        now() - interval '1 day',    0.96),
('Sales',      'panier_moyen_eur',         NULL, 312,    'POS',        now() - interval '4 hours',  0.93),
('Sales',      'taux_conversion_web_pct',  NULL, 2.1,    'Shopify',    now() - interval '2 hours',  0.91),
-- Marge
('Product',    'marge_brute_pct',          NULL, 58.4,   'ERP',        now() - interval '1 day',    0.97),
('Product',    'marge_nette_pct',          NULL, 31.2,   'ERP',        now() - interval '1 day',    0.95),
('Product',    'remise_moyenne_pct',       NULL, 18.7,   'POS',        now() - interval '4 hours',  0.92),
-- Fournisseurs
('Supplier',   'delai_livraison_jours',    NULL, 34,     'SAP',        now() - interval '6 hours',  0.88),
('Supplier',   'taux_service_fournisseur', NULL, 91.2,   'SAP',        now() - interval '6 hours',  0.90),
('Supplier',   'retard_commandes_pct',     NULL, 12.4,   'SAP',        now() - interval '6 hours',  0.85),
-- Prévisions
('Forecast',   'prevision_ventes_j7',      NULL, 89000,  'Anaplan',    now() - interval '1 hour',   0.82),
('Forecast',   'ecart_prev_reel_pct',      NULL, -7.3,   'Anaplan',    now() - interval '1 hour',   0.79),
-- Invendus
('Inventory',  'invendus_fin_saison_pct',  NULL, 23.6,   'SAP',        now() - interval '1 day',    0.94),
('Inventory',  'valeur_invendus_keur',     NULL, 890,    'SAP',        now() - interval '1 day',    0.92),
-- Luxe spécifique
('Product',    'taux_retour_luxe_pct',     NULL, 8.1,    'SAP',        now() - interval '12 hours', 0.96),
('Supplier',   'score_ethique_fournisseur',NULL, 72,     'ESG_Tool',   now() - interval '3 days',   0.78),
('Sales',      'ca_boutique_flagship_keur',NULL, 340,    'POS',        now() - interval '4 hours',  0.99),
('Sales',      'ventes_digital_pct',       NULL, 38.5,   'Shopify',    now() - interval '2 hours',  0.97),
-- Canaux
('Channel',    'perf_reseau_boutiques_pct',NULL, 84.2,   'BI',         now() - interval '1 day',    0.91),
('Channel',    'perf_marketplace_pct',     NULL, 61.3,   'BI',         now() - interval '1 day',    0.89),
('Channel',    'cout_acquisition_client',  NULL, 47,     'GA4',        now() - interval '2 hours',  0.85)
ON CONFLICT DO NOTHING;

-- 2. Signals retail/luxe ouverts
-- First get or create a pack_id — we use a subquery to find an existing pack
DO $$
DECLARE
  demand_pack_id uuid;
  promo_pack_id uuid;
  supply_pack_id uuid;
  unsold_pack_id uuid;
  esg_pack_id uuid;
BEGIN
  SELECT id INTO demand_pack_id FROM packs WHERE slug = 'demand-forecasting' LIMIT 1;
  SELECT id INTO promo_pack_id  FROM packs WHERE slug = 'promotion-optimization' LIMIT 1;
  SELECT id INTO supply_pack_id FROM packs WHERE slug = 'supply-chain-performance' LIMIT 1;
  SELECT id INTO unsold_pack_id FROM packs WHERE slug = 'unsold-management' LIMIT 1;
  SELECT id INTO esg_pack_id    FROM packs WHERE slug = 'ethical-sourcing' LIMIT 1;

  -- Signal 1 : Rupture stock critique
  IF demand_pack_id IS NOT NULL THEN
    INSERT INTO signals (title, severity, status, signal_type, cause, entity_key, pack_id, triggered_at)
    VALUES (
      'Risque de rupture stock — Sacs Cuir Automne',
      'critical', 'open', 'threshold_breach',
      'Couverture stock < 15 jours sur 47 références. Prévisions S+2 non couvertes.',
      'PROD-SACS-AUT-2024',
      demand_pack_id,
      now() - interval '2 hours'
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Signal 2 : Érosion marge
  IF promo_pack_id IS NOT NULL THEN
    INSERT INTO signals (title, severity, status, signal_type, cause, entity_key, pack_id, triggered_at)
    VALUES (
      'Érosion marge — Prêt-à-Porter Femme',
      'high', 'open', 'threshold_breach',
      'Remise moyenne à 18.7% contre objectif 12%. Marge brute en baisse de 4.2 pts vs N-1.',
      'CATEG-PAP-F',
      promo_pack_id,
      now() - interval '6 hours'
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Signal 3 : Délai fournisseur
  IF supply_pack_id IS NOT NULL THEN
    INSERT INTO signals (title, severity, status, signal_type, cause, entity_key, pack_id, triggered_at)
    VALUES (
      'Délai fournisseur critique — Accessoires Cuir',
      'high', 'open', 'causal_alert',
      'Délai moyen à 34 jours (+11j vs contrat). 3 fournisseurs stratégiques impactés.',
      'FOURNISSEUR-CUIR',
      supply_pack_id,
      now() - interval '1 day'
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Signal 4 : Invendus fin de saison
  IF unsold_pack_id IS NOT NULL THEN
    INSERT INTO signals (title, severity, status, signal_type, cause, entity_key, pack_id, triggered_at)
    VALUES (
      'Invendus fin de saison à 23.6% — action requise',
      'medium', 'open', 'threshold_breach',
      '890K€ d''invendus identifiés. Seuil d''alerte dépassé (objectif < 18%). Soldes J-45.',
      'SAISON-ETE-2024',
      unsold_pack_id,
      now() - interval '12 hours'
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Signal 5 : Score RSE fournisseur
  IF esg_pack_id IS NOT NULL THEN
    INSERT INTO signals (title, severity, status, signal_type, cause, entity_key, pack_id, triggered_at)
    VALUES (
      'Score RSE fournisseur sous seuil — revue requise',
      'medium', 'open', 'threshold_breach',
      'Score éthique moyen à 72/100. 2 fournisseurs sous le seuil contractuel de 75.',
      'FOURNISSEUR-RSE',
      esg_pack_id,
      now() - interval '2 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 3. Chart configs par capability (retail/luxe)
INSERT INTO capability_chart_configs (pack_slug, chart_type, enabled, label, display_order) VALUES
('demand-forecasting',       'signals_severity',         true, 'Alertes stock & prévisions',        0),
('demand-forecasting',       'facts_table',              true, 'Indicateurs stock & rotation',      1),
('promotion-optimization',   'recommendations_scatter',  true, 'Options promotionnelles',            0),
('promotion-optimization',   'kpi_bar',                  true, 'KPIs marge & remise',               1),
('channel-performance',      'kpi_bar',                  true, 'Performance canaux',                 0),
('channel-performance',      'signals_severity',         true, 'Alertes canaux',                    1),
('supply-chain-performance', 'signals_severity',         true, 'Alertes fournisseurs & délais',     0),
('supply-chain-performance', 'facts_table',              true, 'Métriques supply chain',            1),
('unsold-management',        'kpi_bar',                  true, 'Invendus par catégorie',             0),
('unsold-management',        'recommendations_scatter',  true, 'Options de déstockage',              1),
('pricing-strategy',         'recommendations_scatter',  true, 'Scénarios de pricing',               0),
('pricing-strategy',         'kpi_bar',                  true, 'Élasticité & marges',               1),
('ethical-sourcing',         'facts_table',              true, 'Scores RSE fournisseurs',            0),
('ethical-sourcing',         'signals_severity',         true, 'Alertes conformité',                1)
ON CONFLICT (pack_slug, chart_type) DO UPDATE SET enabled = EXCLUDED.enabled, label = EXCLUDED.label;
