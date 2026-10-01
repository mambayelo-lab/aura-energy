
DO $$
DECLARE
  v_mission uuid := '11111111-1111-1111-1111-111111111111';
  v_user uuid := 'b257b5eb-dafd-485c-a490-a4f03ea2de9a';
  d_reassort uuid; d_aurora uuid; d_maison uuid; d_textile uuid;
  d_hebergement uuid; d_clienteling uuid; d_forecast uuid; d_tannerie uuid;
BEGIN
  SELECT id INTO d_reassort   FROM decisions WHERE title ILIKE 'Réassort express Lumen%' LIMIT 1;
  SELECT id INTO d_aurora     FROM decisions WHERE title ILIKE 'Repositionner le sac Aurora%' LIMIT 1;
  SELECT id INTO d_maison     FROM decisions WHERE title ILIKE 'Plan de redressement marge%' LIMIT 1;
  SELECT id INTO d_textile    FROM decisions WHERE title ILIKE 'Activation fournisseur de secours%' LIMIT 1;
  SELECT id INTO d_hebergement FROM decisions WHERE title ILIKE 'Hébergement données VIP%' LIMIT 1;
  SELECT id INTO d_clienteling FROM decisions WHERE title ILIKE 'Business case clienteling%' LIMIT 1;
  SELECT id INTO d_forecast   FROM decisions WHERE title ILIKE 'Recalibrer forecast%' LIMIT 1;
  SELECT id INTO d_tannerie   FROM decisions WHERE title ILIKE 'Sélection tannerie%' LIMIT 1;

  INSERT INTO signals (id, mission_id, title, cause, severity, confidence, suggested_action, status, signal_type, entity_key, evaluated_at, payload)
  VALUES
    ('a0000001-0000-0000-0000-000000000001', v_mission, 'Rupture imminente — Lumen Derby Cuir Naturel (Milan)', 'Stock < 5j de couverture, vélocité +38% vs S-1', 'high', 0.92, 'Réassort express depuis hub Bologne', 'open', 'stock', 'SKU-LUM-DERBY-42', now() - interval '6 hours', '{"coverage_days":4.1,"velocity_w":12.4}'::jsonb),
    ('a0000001-0000-0000-0000-000000000002', v_mission, 'Marge catégorie Maison — recul -2,1 pts (T4)', 'Mix promo + coût matière +4,3%', 'high', 0.88, 'Revoir grille promo + renégocier 3 fournisseurs', 'open', 'kpi', 'CAT-MAISON', now() - interval '1 day', '{"delta_pts":-2.1}'::jsonb),
    ('a0000001-0000-0000-0000-000000000003', v_mission, 'TextilePro — incident qualité lot #2841 (12% retours)', 'Coutures défectueuses détectées par QC Roubaix', 'high', 0.95, 'Activer fournisseur de secours', 'open', 'incident', 'SUP-TEXTILEPRO', now() - interval '3 hours', '{"returns_pct":12,"lot":"2841"}'::jsonb),
    ('a0000001-0000-0000-0000-000000000004', v_mission, 'Sac Aurora — élasticité prix favorable (+3 pts conv @ 2 950 €)', 'A/B test boutiques EU 6 semaines', 'medium', 0.81, 'Valider repositionnement permanent', 'open', 'opportunity', 'SKU-AURORA', now() - interval '2 days', '{"conv_delta":3.1,"price_test":2950}'::jsonb),
    ('a0000001-0000-0000-0000-000000000005', v_mission, 'Souveraineté données VIP — alerte conformité', 'Audit : 4% des profils hébergés hors UE', 'high', 0.90, 'Migrer cluster VIP vers OVH Roubaix', 'open', 'compliance', 'DATA-VIP', now() - interval '12 hours', '{"non_compliant_pct":4.0}'::jsonb),
    ('a0000001-0000-0000-0000-000000000006', v_mission, 'NPS VIP en baisse — -7 pts sur 90 jours', 'Verbatims : manque de personnalisation', 'medium', 0.84, 'Accélérer pilote clienteling IA top-200', 'open', 'kpi', 'NPS-VIP', now() - interval '4 days', '{"delta":-7}'::jsonb),
    ('a0000001-0000-0000-0000-000000000007', v_mission, 'Forecast o9 — biais +18% drops capsule novembre', 'Modèle ne capte pas effet drop limité', 'medium', 0.79, 'Recalibrer features capsule', 'open', 'kpi', 'FORECAST-CAPSULE', now() - interval '5 days', '{"bias_pct":18}'::jsonb),
    ('a0000001-0000-0000-0000-000000000008', v_mission, 'Tannerie Toscana — capacité 2027 saturée à 92%', 'Demande concurrence luxe italienne', 'medium', 0.76, 'Sécuriser allocation via contrat cadre 3 ans', 'open', 'supply', 'SUP-TOSCANA', now() - interval '8 days', '{"capacity_pct":92}'::jsonb),
    ('a0000001-0000-0000-0000-000000000009', v_mission, 'Trafic web aurora.lumen.com — pic +47% (semaine drop)', 'Campagne influence Asie au-delà du plan', 'low', 0.72, 'Renforcer stock e-commerce APAC', 'open', 'opportunity', 'WEB-AURORA', now() - interval '1 day', '{"traffic_delta":47}'::jsonb),
    ('a0000001-0000-0000-0000-000000000010', v_mission, 'CAC paid social — dérive +22% (Meta IT/ES)', 'Coût enchères + audience saturée', 'medium', 0.80, 'Réallouer 30% vers TikTok & influence', 'open', 'kpi', 'CAC-PAID', now() - interval '7 days', '{"cac_delta_pct":22}'::jsonb),
    ('a0000001-0000-0000-0000-000000000011', v_mission, 'OTIF entrepôt Bologne — 91,2% (cible 96%)', 'Goulot préparation cuirs exotiques', 'medium', 0.83, 'Ajouter shift préparation 14h-22h', 'open', 'kpi', 'OTIF-BOL', now() - interval '2 days', '{"otif":91.2,"target":96}'::jsonb),
    ('a0000001-0000-0000-0000-000000000012', v_mission, 'Cash conversion cycle — +6j T4', 'DSO retail +4j, DPO -2j', 'low', 0.74, 'Revue conditions paiement top-20 wholesale', 'open', 'kpi', 'CCC', now() - interval '10 days', '{"delta_days":6}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO facts (id, mission_id, object_name, value_number, observed_at, confidence, entity_key, value_jsonb, source_app, attribute_name, source_endpoint)
  VALUES
    ('f0000001-0000-0000-0000-000000000001', v_mission, 'sku.coverage_days', 4.1, now() - interval '6 hours', 0.95, 'SKU-LUM-DERBY-42', '{"warehouse":"BOL","velocity_w":12.4}'::jsonb, 'SAP-S4', 'coverage_days', '/inventory/coverage'),
    ('f0000001-0000-0000-0000-000000000002', v_mission, 'category.margin_pct', 38.4, now() - interval '1 day', 0.92, 'CAT-MAISON', '{"baseline":40.5,"delta":-2.1}'::jsonb, 'Cegid', 'margin_pct', '/finance/margin'),
    ('f0000001-0000-0000-0000-000000000003', v_mission, 'supplier.returns_pct', 12.0, now() - interval '3 hours', 0.97, 'SUP-TEXTILEPRO', '{"lot":"2841","sku_count":8}'::jsonb, 'QualityQMS', 'returns_pct', '/quality/lots/2841'),
    ('f0000001-0000-0000-0000-000000000004', v_mission, 'sku.price_test', 2950, now() - interval '2 days', 0.88, 'SKU-AURORA', '{"baseline":2700,"conv_delta_pct":3.1,"stores":["MIL","PAR","ROM"]}'::jsonb, 'Shopify+', 'price_eur', '/ab-tests/aurora'),
    ('f0000001-0000-0000-0000-000000000005', v_mission, 'vip.non_compliant_pct', 4.0, now() - interval '12 hours', 0.94, 'DATA-VIP', '{"region_breakdown":{"US":3.1,"APAC":0.9}}'::jsonb, 'Salesforce', 'non_compliant_pct', '/governance/data-residency'),
    ('f0000001-0000-0000-0000-000000000006', v_mission, 'kpi.nps_vip', 55, now() - interval '4 days', 0.86, 'NPS-VIP', '{"prev_90d":62,"sample":412}'::jsonb, 'Qualtrics', 'nps', '/surveys/vip'),
    ('f0000001-0000-0000-0000-000000000007', v_mission, 'forecast.bias_pct', 18, now() - interval '5 days', 0.82, 'FORECAST-CAPSULE', '{"family":"capsule","horizon_w":6}'::jsonb, 'o9', 'bias_pct', '/forecast/bias'),
    ('f0000001-0000-0000-0000-000000000008', v_mission, 'supplier.capacity_pct', 92, now() - interval '8 days', 0.79, 'SUP-TOSCANA', '{"year":2027,"family":"exotic_leather"}'::jsonb, 'SupplyHub', 'capacity_pct', '/suppliers/toscana/capacity'),
    ('f0000001-0000-0000-0000-000000000009', v_mission, 'web.traffic_delta_pct', 47, now() - interval '1 day', 0.91, 'WEB-AURORA', '{"channel":"organic+influence","region":"APAC"}'::jsonb, 'GA4', 'traffic_delta', '/analytics/aurora'),
    ('f0000001-0000-0000-0000-000000000010', v_mission, 'paid.cac_delta_pct', 22, now() - interval '7 days', 0.85, 'CAC-PAID', '{"platforms":["meta"],"geos":["IT","ES"]}'::jsonb, 'Meta Ads', 'cac_delta', '/ads/cac'),
    ('f0000001-0000-0000-0000-000000000011', v_mission, 'logistics.otif_pct', 91.2, now() - interval '2 days', 0.93, 'OTIF-BOL', '{"target":96,"shifts":2}'::jsonb, 'Manhattan WMS', 'otif', '/ops/otif'),
    ('f0000001-0000-0000-0000-000000000012', v_mission, 'finance.ccc_days', 78, now() - interval '10 days', 0.87, 'CCC', '{"prev":72,"dso":54,"dio":36,"dpo":12}'::jsonb, 'Cegid', 'ccc_days', '/finance/working-capital'),
    ('f0000001-0000-0000-0000-000000000013', v_mission, 'sales.revenue_eur', 18420000, now() - interval '1 day', 0.96, 'REV-T4', '{"period":"T4-2025","yoy_pct":7.2}'::jsonb, 'Cegid', 'revenue_eur', '/finance/revenue'),
    ('f0000001-0000-0000-0000-000000000014', v_mission, 'esg.scope3_intensity', 0.84, now() - interval '15 days', 0.78, 'ESG-SCOPE3', '{"unit":"tCO2e/k€","target_2027":0.65}'::jsonb, 'Sweep', 'co2_intensity', '/esg/scope3')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO decision_scenarios (id, user_id, decision_id, title, question, assumptions, options, criteria, scoring, recommendation, confidence)
  VALUES
    ('11111110-0000-0000-0000-000000000001', v_user, d_reassort,
      'Réassort express Lumen Derby — arbitrage coût/rupture',
      'Faut-il déclencher un réassort express depuis Bologne sur les Derby Cuir Naturel ?',
      '[{"k":"coverage_days","v":4.1},{"k":"lead_time_express_days","v":3},{"k":"lost_sale_eur_per_day","v":18000}]'::jsonb,
      '[{"id":"express","label":"Express Bologne (J+3, +12k€)","cost":12000},{"id":"standard","label":"Standard (J+9)","cost":3500},{"id":"none","label":"Ne rien faire","cost":0}]'::jsonb,
      '[{"id":"rupture","label":"Risque rupture","weight":0.5},{"id":"cost","label":"Coût","weight":0.2},{"id":"customer","label":"Expérience client","weight":0.3}]'::jsonb,
      '{"express":0.88,"standard":0.52,"none":0.18}'::jsonb,
      'express', 0.88),
    ('11111110-0000-0000-0000-000000000002', v_user, d_aurora,
      'Repositionnement Aurora — 2 700 € vs 2 950 €',
      'Faut-il acter le repositionnement permanent à 2 950 € sur la zone EU ?',
      '[{"k":"conv_delta_pct","v":3.1},{"k":"volume_y","v":4200},{"k":"margin_pct","v":62}]'::jsonb,
      '[{"id":"hold","label":"Maintenir 2 950 €","rev_uplift":1100000},{"id":"revert","label":"Revenir à 2 700 €","rev_uplift":0},{"id":"premium","label":"Pousser à 3 100 € (test)","rev_uplift":650000}]'::jsonb,
      '[{"id":"rev","label":"Revenu","weight":0.4},{"id":"brand","label":"Brand equity","weight":0.4},{"id":"risk","label":"Risque churn VIP","weight":0.2}]'::jsonb,
      '{"hold":0.84,"revert":0.41,"premium":0.58}'::jsonb,
      'hold', 0.84),
    ('11111110-0000-0000-0000-000000000003', v_user, d_textile,
      'TextilePro — activation fournisseur de secours',
      'Quel fournisseur activer pour absorber la rupture TextilePro ?',
      '[{"k":"defect_rate_textilepro","v":0.12},{"k":"backup_capacity_pct","v":70}]'::jsonb,
      '[{"id":"trentino","label":"Trentino (70%, J+10)","capacity":0.7},{"id":"porto","label":"Porto Têxtil (90%, J+18)","capacity":0.9},{"id":"hybrid","label":"Mix Trentino + Porto","capacity":1.0}]'::jsonb,
      '[{"id":"speed","label":"Délai","weight":0.4},{"id":"quality","label":"Qualité","weight":0.4},{"id":"cost","label":"Coût","weight":0.2}]'::jsonb,
      '{"trentino":0.71,"porto":0.62,"hybrid":0.86}'::jsonb,
      'hybrid', 0.86),
    ('11111110-0000-0000-0000-000000000004', v_user, d_hebergement,
      'Hébergement données VIP — choix souverain',
      'Quel hébergeur UE retenir pour les données VIP ?',
      '[{"k":"non_compliant_pct","v":4.0},{"k":"migration_window_days","v":45}]'::jsonb,
      '[{"id":"ovh","label":"OVH Roubaix (SecNumCloud)","tco_y":420000},{"id":"scaleway","label":"Scaleway Paris","tco_y":380000},{"id":"outscale","label":"3DS Outscale","tco_y":510000}]'::jsonb,
      '[{"id":"sov","label":"Souveraineté","weight":0.4},{"id":"perf","label":"Performance","weight":0.3},{"id":"cost","label":"TCO","weight":0.3}]'::jsonb,
      '{"ovh":0.89,"scaleway":0.74,"outscale":0.68}'::jsonb,
      'ovh', 0.89),
    ('11111110-0000-0000-0000-000000000005', v_user, d_clienteling,
      'Clienteling IA VIP — phasage du business case',
      'Quel phasage retenir pour le clienteling IA sur 12 M€ ?',
      '[{"k":"vip_count","v":1850},{"k":"nps_target_delta","v":8}]'::jsonb,
      '[{"id":"pilot","label":"Pilote 200 VIP (3 M€, 6 mois)","cost":3000000},{"id":"full","label":"Roll-out 12 M€ direct","cost":12000000},{"id":"phased","label":"Pilote puis vague 1 (7 M€)","cost":7000000}]'::jsonb,
      '[{"id":"impact","label":"Impact NPS","weight":0.35},{"id":"risk","label":"Risque exécution","weight":0.35},{"id":"cost","label":"Coût","weight":0.3}]'::jsonb,
      '{"pilot":0.72,"full":0.48,"phased":0.83}'::jsonb,
      'phased', 0.83),
    ('11111110-0000-0000-0000-000000000006', v_user, d_tannerie,
      'Tannerie cuirs exotiques 2027 — allocation',
      'Comment sécuriser l''allocation cuirs exotiques 2027 ?',
      '[{"k":"toscana_capacity_pct","v":92},{"k":"horizon_y","v":3}]'::jsonb,
      '[{"id":"frame3y","label":"Contrat cadre 3 ans Toscana","commit_eur":8400000},{"id":"dual","label":"Dual-source Toscana + Bridge of Weir","commit_eur":11200000},{"id":"spot","label":"Spot annuel","commit_eur":0}]'::jsonb,
      '[{"id":"secure","label":"Sécurisation","weight":0.45},{"id":"flex","label":"Flexibilité","weight":0.25},{"id":"cost","label":"Engagement","weight":0.3}]'::jsonb,
      '{"frame3y":0.78,"dual":0.85,"spot":0.31}'::jsonb,
      'dual', 0.85)
  ON CONFLICT (id) DO NOTHING;
END $$;
