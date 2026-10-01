-- Completion: decision_recommendations + extraction contracts for
-- collection-investment, ma-opportunity, logistics-performance
-- Also adds missing extraction contracts for other 6 capabilities

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DECISION RECOMMENDATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Collection Investment
INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'LOW_SELL_THROUGH',
  'Soldes anticipés & déstockage ciblé',
  'Déclencher une action promotionnelle ciblée (–20 à –35%) sur les collections sell-through <40% avant fin de saison pour libérer trésorerie et éviter les fins de série en invendus.',
  8, 8, 'low', '4-6 semaines'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'LOW_SELL_THROUGH',
  'Réallocation inter-magasins ou canal web',
  'Transférer les pièces sous-performantes vers les points de vente à fort trafic ou les activer en exclusivité web pour maximiser la rotation sans démarquer.',
  7, 7, 'low', '2-3 semaines'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'OVERSTOCK_COLLECTION',
  'Réviser le brief collection saison suivante',
  'Réduire de 15-20% le budget achat des familles produits avec invendus >30% deux saisons consécutives. Réallouer vers les familles best-sellers.',
  9, 6, 'medium', '3-4 mois (saison N+1)'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'OVERSTOCK_COLLECTION',
  'Partenariat outlet / déstockeurs',
  'Négocier un accord cadre avec 2-3 partenaires outlet pour écouler les invendus de saison en N+1 à prix coûtant + 10%, préservant la marge et l''image prix.',
  6, 8, 'low', '6-8 semaines'
FROM decision_packs p WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

-- M&A Opportunity
INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'UNDERVALUED_TARGET',
  'Lancer due diligence accélérée',
  'Mandater un cabinet M&A pour une due diligence commerciale et financière sur la cible identifiée. Budget préliminaire : 150-250k€. Décision Go/No-Go en 8 semaines.',
  10, 5, 'high', '8-12 semaines'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'UNDERVALUED_TARGET',
  'Prise de contact exploratoire confidentielle',
  'Approcher les actionnaires via un intermédiaire (banquier d''affaires) pour sonder l''intention de cession avant d''engager une DD formelle. Moins coûteux, réduit le risque de fuite.',
  7, 8, 'low', '4-6 semaines'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'STRATEGIC_FIT',
  'Modéliser les synergies buy-and-build',
  'Construire un modèle financier consolidé intégrant les synergies coûts (achats, logistique, back-office) et revenus (cross-sell, géographie) pour justifier la prime d''acquisition.',
  8, 6, 'medium', '3-5 semaines'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'STRATEGIC_FIT',
  'Rester en veille — pas d''acquisition immédiate',
  'Si le multiple EV/EBITDA dépasse 6x ou que les synergies ne sont pas chiffrables, maintenir une veille passive (veille trimestrielle) et réallouer le cash sur l''organique.',
  5, 9, 'low', 'Décision trimestrielle'
FROM decision_packs p WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

-- Logistics Performance
INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'CARRIER_OTD_LOW',
  'Mise en concurrence des transporteurs défaillants',
  'Lancer un appel d''offres sur les lanes avec OTD <85%. Objectif : 3 transporteurs qualifiés par lane pour éviter la dépendance. Économies estimées 8-15% sur les lignes concernées.',
  8, 7, 'medium', '6-10 semaines'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'CARRIER_OTD_LOW',
  'Activer les pénalités contractuelles',
  'Appliquer les SLA contractuels (pénalités, crédits service) aux transporteurs sous les seuils convenus. Envoi de la notification formelle dans les 5 jours ouvrés.',
  6, 9, 'low', '5 jours ouvrés'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'WAREHOUSE_SATURATION',
  'Externaliser l''overflow en entrepôt partenaire',
  'Négocier un contrat spot avec un prestataire logistique 3PL pour absorber les pics de saturation >85%. Coût marginal : 0,12-0,18€/unité stockée. Délai de mise en œuvre : 3 semaines.',
  7, 8, 'low', '3-4 semaines'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (id, pack_id, signal_code, title, description, impact_score, feasibility_score, effort_level, time_horizon)
SELECT gen_random_uuid(), p.id, 'WAREHOUSE_SATURATION',
  'Accélérer les expéditions vers les magasins sous-stockés',
  'Utiliser la saturation comme signal de réallocation : déclencher des réapprovisionnements urgents vers les points de vente avec couverture stock <7 jours pour fluidifier le flux.',
  8, 8, 'low', '48-72 heures'
FROM decision_packs p WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EXTRACTION CONTRACTS — completing the 3 missing capabilities
-- ─────────────────────────────────────────────────────────────────────────────

-- Collection Investment — SAP/Cegid sell-through + Shopify
INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'cegx', 'VENTES.COLLECTION', 'SELL_THROUGH_PCT',
  'collection.sell_through_pct', 0.88, 'active',
  'Cegid Retail — taux d''écoulement par collection/saison. Table VENTES.COLLECTION, champ SELL_THROUGH_PCT.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'nexerp', 'ZSTOCK', 'MENGE',
  'collection.stock_units', 0.85, 'active',
  'SAP — stock disponible par référence collection. Table ZSTOCK champ MENGE (quantité).'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'webstore', 'products.variants', 'inventory_quantity',
  'collection.web_stock_units', 0.92, 'active',
  'Shopify — stock web par variante. Endpoint GET /products.json > variants[].inventory_quantity.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'collection-investment'
ON CONFLICT DO NOTHING;

-- M&A Opportunity — données financières SAP + CRM
INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'nexerp', 'ZFIN_REPORT', 'EBITDA_EUR',
  'target.ebitda_eur', 0.80, 'draft',
  'SAP — EBITDA de la cible (si accès data room). Table ZFIN_REPORT, champ EBITDA_EUR. Nécessite accès data room ou estimation externe.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'skycrm', 'Account', 'AnnualRevenue',
  'target.revenue_eur', 0.72, 'draft',
  'Salesforce — CA annuel des comptes cibles potentiels. Champ Account.AnnualRevenue. Données partielles, compléter avec sources externes.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'nineplan', 'financial_plan', 'synergy_estimate_eur',
  'target.synergy_estimate_eur', 0.65, 'draft',
  'o9 — estimation des synergies dans le plan financier. Alimenté manuellement par la DAF lors des scénarios M&A.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'ma-opportunity'
ON CONFLICT DO NOTHING;

-- Logistics Performance — Manhattan WMS + SAP
INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'meridian', 'warehouse_utilization', 'occupancy_rate_pct',
  'warehouse.saturation_pct', 0.93, 'active',
  'Manhattan WMS — taux d''occupation entrepôt en temps réel. Endpoint /warehouse_utilization, champ occupancy_rate_pct.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'meridian', 'carrier_performance', 'on_time_delivery_pct',
  'carrier.otd_pct', 0.90, 'active',
  'Manhattan TMS — OTD (On Time Delivery) par transporteur. Champ on_time_delivery_pct, agrégé sur rolling 30 jours.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

INSERT INTO extraction_contracts (id, decision_contract_id, source_system, source_object, source_field, target_attribute_path, mapping_confidence, status, notes)
SELECT gen_random_uuid(), dc.id,
  'nexerp', 'VBAK', 'NETWR',
  'carrier.cost_per_unit_eur', 0.82, 'active',
  'SAP SD — coût transport par commande. Table VBAK + VBAP, NETWR / quantité expédiée = coût unitaire transport.'
FROM decision_contracts dc
JOIN decision_packs p ON dc.pack_id = p.id
WHERE p.slug = 'logistics-performance'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FACTS COMPLEMENT — Maison Lumen demo data for 3 missing capabilities
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM missions WHERE id = '11111111-1111-1111-1111-111111111111') THEN

    -- Collection Investment facts
    INSERT INTO facts (mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'sell_through_pct',    'COLL-SS26-ROBES',   38.0, 'Robes SS26 : sell-through 38% à 8 semaines de la fin de saison', 'cegx', 0.90, now() - interval '2 days'),
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'sell_through_pct',    'COLL-SS26-JEANS',   71.5, 'Jeans SS26 : sell-through 71.5% — en ligne avec objectif 75%', 'cegx', 0.90, now() - interval '2 days'),
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'sell_through_pct',    'COLL-SS26-BLOUSONS',18.2, 'Blousons SS26 : sell-through 18.2% — alerte invendus sévère', 'cegx', 0.88, now() - interval '2 days'),
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'stock_units',         'COLL-SS26-BLOUSONS', 2840, 'Stock résiduel blousons SS26 : 2 840 pièces à déstocker', 'nexerp', 0.92, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'stock_units',         'COLL-SS26-ROBES',   1620, 'Stock résiduel robes SS26 : 1 620 pièces', 'nexerp', 0.92, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'web_stock_units',     'COLL-SS26-ROBES',    340, 'Stock web robes SS26 (Shopify) : 340 unités', 'webstore', 0.95, now() - interval '6 hours'),
      ('11111111-1111-1111-1111-111111111111', 'Collection', 'rotation_index',      'COLL-SS26-JEANS',    8.7, 'Rotation jeans SS26 : 8.7 — best-seller de la saison', 'cegx', 0.88, now() - interval '2 days')
    ON CONFLICT DO NOTHING;

    -- M&A Opportunity facts
    INSERT INTO facts (mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Target', 'ebitda_eur',             'TARGET-MODEUSE-SA',  2800000, 'La Modeuse SA : EBITDA 2,8M€ (exercice 2025, source data room préliminaire)', 'nexerp', 0.75, now() - interval '5 days'),
      ('11111111-1111-1111-1111-111111111111', 'Target', 'revenue_eur',            'TARGET-MODEUSE-SA', 18400000, 'La Modeuse SA : CA 18,4M€ — CAGR 3 ans : +12%', 'skycrm', 0.72, now() - interval '5 days'),
      ('11111111-1111-1111-1111-111111111111', 'Target', 'ev_ebitda_multiple',     'TARGET-MODEUSE-SA',    5.2, 'Multiple EV/EBITDA estimé : 5,2x — valorisation attractive vs. secteur (6,5-8x)', 'nineplan', 0.68, now() - interval '4 days'),
      ('11111111-1111-1111-1111-111111111111', 'Target', 'synergy_estimate_eur',   'TARGET-MODEUSE-SA',  1200000, 'Synergies estimées : 1,2M€/an (achats groupés 400k, logistique 500k, back-office 300k)', 'nineplan', 0.65, now() - interval '4 days'),
      ('11111111-1111-1111-1111-111111111111', 'Target', 'revenue_eur',            'TARGET-IZIPIZI-MODE', 7200000, 'Cible secondaire Izipizi Mode : CA 7,2M€, forte notoriété accessoires', 'skycrm', 0.60, now() - interval '7 days')
    ON CONFLICT DO NOTHING;

    -- Logistics Performance facts
    INSERT INTO facts (mission_id, object_name, attribute_name, entity_key, value_number, value_text, source_app, confidence, observed_at)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'Warehouse', 'saturation_pct',       'ENTREPOT-LYON',       91.0, 'Entrepôt Lyon : saturation 91% — seuil critique 85% dépassé, risque blocage réception', 'meridian', 0.93, now() - interval '3 hours'),
      ('11111111-1111-1111-1111-111111111111', 'Warehouse', 'saturation_pct',       'ENTREPOT-MARSEILLE',  67.5, 'Entrepôt Marseille : saturation 67.5% — situation confortable', 'meridian', 0.93, now() - interval '3 hours'),
      ('11111111-1111-1111-1111-111111111111', 'Warehouse', 'saturation_pct',       'ENTREPOT-PARIS-EST',  78.2, 'Entrepôt Paris Est : saturation 78.2% — vigilance requis', 'meridian', 0.93, now() - interval '3 hours'),
      ('11111111-1111-1111-1111-111111111111', 'Carrier',   'otd_pct',              'CARRIER-CHRONOPOST',  87.3, 'Chronopost : OTD 87.3% sur 30j — en dessous du SLA contractuel (92%)', 'meridian', 0.91, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Carrier',   'otd_pct',              'CARRIER-DHL',         94.1, 'DHL : OTD 94.1% — au-dessus du SLA, référencer comme transporteur principal', 'meridian', 0.91, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Carrier',   'otd_pct',              'CARRIER-COLISSIMO',   79.8, 'Colissimo : OTD 79.8% — dégradation sévère depuis 3 semaines, action requise', 'meridian', 0.90, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Carrier',   'cost_per_unit_eur',    'CARRIER-CHRONOPOST',   4.82, 'Chronopost : coût moyen 4.82€/unité expédiée', 'nexerp', 0.87, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Carrier',   'cost_per_unit_eur',    'CARRIER-DHL',          5.21, 'DHL : coût moyen 5.21€/unité — prime de 8% vs Chronopost mais meilleur OTD', 'nexerp', 0.87, now() - interval '1 day'),
      ('11111111-1111-1111-1111-111111111111', 'Carrier',   'cost_per_unit_eur',    'CARRIER-COLISSIMO',    3.94, 'Colissimo : coût 3.94€/unité — moins cher mais OTD défaillant', 'nexerp', 0.87, now() - interval '1 day')
    ON CONFLICT DO NOTHING;

  END IF;
END $$;
