-- Complete missing signal_rules, decision_criteria, and causal_rules for:
-- stock-availability, supplier-risk, cash-management, store-opening-closing

DO $$ BEGIN

-- ── 1. UPDATE decision_packs with decision_criteria & business_question ─────

UPDATE decision_packs SET
  business_question = 'Quels produits risquent la rupture et faut-il déclencher un réapprovisionnement d''urgence ?',
  decision_criteria = '[
    {"label":"Disponibilité immédiate","description":"Taux de disponibilité des SKUs critiques","weight":10},
    {"label":"Couverture de stock","description":"Nombre de jours de stock disponibles","weight":9},
    {"label":"Délai fournisseur","description":"Lead time moyen par fournisseur","weight":7},
    {"label":"Coût de rupture","description":"Manque à gagner estimé en cas de rupture","weight":8}
  ]'::jsonb,
  is_published = true,
  is_universal = true
WHERE slug = 'stock-availability';

UPDATE decision_packs SET
  business_question = 'Quels fournisseurs présentent un risque critique de défaillance dans les 30 prochains jours ?',
  decision_criteria = '[
    {"label":"Taux OTIF","description":"On Time In Full — livraisons conformes et à l''heure","weight":10},
    {"label":"Dépendance fournisseur","description":"Part du CA dépendant d''un seul fournisseur","weight":9},
    {"label":"Score financier","description":"Solidité financière du fournisseur","weight":8},
    {"label":"Délai moyen","description":"Lead time moyen observé vs contractuel","weight":7}
  ]'::jsonb,
  is_published = true,
  is_universal = true
WHERE slug = 'supplier-risk';

UPDATE decision_packs SET
  business_question = 'La trésorerie est-elle suffisante pour couvrir les engagements des 30 prochains jours ?',
  decision_criteria = '[
    {"label":"Position de trésorerie","description":"Cash disponible immédiat","weight":10},
    {"label":"Prévision cash 30j","description":"Estimation des flux nets sur 30 jours","weight":9},
    {"label":"DSO","description":"Days Sales Outstanding — retard de paiement clients","weight":8},
    {"label":"Encours en retard","description":"Montant des créances échues non recouvrées","weight":7}
  ]'::jsonb,
  is_published = true,
  is_universal = true
WHERE slug = 'cash-management';

UPDATE decision_packs SET
  business_question = 'Faut-il ouvrir ou fermer ce point de vente compte tenu de la rentabilité et du potentiel marché ?',
  decision_criteria = '[
    {"label":"EBITDA margin","description":"Rentabilité opérationnelle du point de vente","weight":10},
    {"label":"Fréquentation","description":"Nombre de visiteurs par jour","weight":8},
    {"label":"Taux de conversion","description":"Part des visiteurs qui achètent","weight":9},
    {"label":"Risque cannibalisation","description":"Impact sur les autres points de vente proches","weight":7},
    {"label":"Potentiel marché","description":"Taille estimée du bassin de clientèle","weight":8}
  ]'::jsonb,
  is_published = true,
  is_universal = true
WHERE slug = 'store-opening-closing';

-- ── 2. SIGNAL RULES ─────────────────────────────────────────────────────────

INSERT INTO signal_rules (rule_key, title, description, severity_default, config, pack_slug, contributors)
VALUES

('STOCK-S001', 'Rupture imminente (<5j couverture)',
  'La couverture de stock est inférieure à 5 jours sur un SKU stratégique.',
  'critical',
  '{"threshold_days": 5, "sku_tier": "A"}'::jsonb,
  'stock-availability',
  '[{"label":"Stock épuisement","pct":50,"direction":"negative"},{"label":"Sous-estimation demand","pct":30,"direction":"negative"},{"label":"Retard fournisseur","pct":20,"direction":"negative"}]'::jsonb),

('STOCK-S002', 'Surstock détecté (>90j couverture)',
  'La couverture de stock dépasse 90 jours — capital immobilisé excessif.',
  'high',
  '{"threshold_days": 90}'::jsonb,
  'stock-availability',
  '[{"label":"Sur-achat","pct":45,"direction":"negative"},{"label":"Ventes inférieures aux prévisions","pct":35,"direction":"negative"},{"label":"Retour promotions","pct":20,"direction":"negative"}]'::jsonb),

('STOCK-S003', 'OTIF fournisseur dégradé (<85%)',
  'Le taux OTIF d''un fournisseur clé passe sous 85% sur les 4 dernières semaines.',
  'high',
  '{"threshold_pct": 85, "window_weeks": 4}'::jsonb,
  'stock-availability',
  '[{"label":"Défaillance fournisseur","pct":60,"direction":"negative"},{"label":"Congestion logistique","pct":25,"direction":"negative"},{"label":"Erreur commande","pct":15,"direction":"negative"}]'::jsonb),

('SUPP-S001', 'Dépendance critique (>60% mono-fournisseur)',
  'Plus de 60% des achats d''une catégorie proviennent d''un seul fournisseur.',
  'critical',
  '{"threshold_pct": 60}'::jsonb,
  'supplier-risk',
  '[{"label":"Concentration fournisseurs","pct":70,"direction":"negative"},{"label":"Absence alternative","pct":30,"direction":"negative"}]'::jsonb),

('SUPP-S002', 'Score financier fournisseur dégradé (<40)',
  'Le score de solidité financière d''un fournisseur stratégique passe sous 40/100.',
  'high',
  '{"threshold_score": 40}'::jsonb,
  'supplier-risk',
  '[{"label":"Risque défaut fournisseur","pct":60,"direction":"negative"},{"label":"Délai paiement fournisseur","pct":25,"direction":"negative"},{"label":"Conjoncture sectorielle","pct":15,"direction":"negative"}]'::jsonb),

('SUPP-S003', 'Retard livraison chronique (>5j)',
  'Un fournisseur accumule plus de 5 jours de retard moyen sur les 3 derniers mois.',
  'high',
  '{"threshold_days": 5, "window_months": 3}'::jsonb,
  'supplier-risk',
  '[{"label":"Capacité production insuffisante","pct":40,"direction":"negative"},{"label":"Problème qualité","pct":35,"direction":"negative"},{"label":"Transport","pct":25,"direction":"negative"}]'::jsonb),

('CASH-S001', 'Position de trésorerie critique (<500k€)',
  'Le solde de trésorerie disponible passe sous 500 000 €.',
  'critical',
  '{"threshold_eur": 500000}'::jsonb,
  'cash-management',
  '[{"label":"Retards encaissements","pct":45,"direction":"negative"},{"label":"Décaissements imprévus","pct":35,"direction":"negative"},{"label":"Saisonnalité","pct":20,"direction":"negative"}]'::jsonb),

('CASH-S002', 'DSO en hausse (>45j)',
  'Le délai moyen de paiement client dépasse 45 jours.',
  'high',
  '{"threshold_days": 45}'::jsonb,
  'cash-management',
  '[{"label":"Clients mauvais payeurs","pct":50,"direction":"negative"},{"label":"Processus recouvrement","pct":30,"direction":"negative"},{"label":"Litiges factures","pct":20,"direction":"negative"}]'::jsonb),

('CASH-S003', 'Impasse trésorerie prévisionnelle 30j',
  'La projection cash à 30 jours montre un solde négatif.',
  'critical',
  '{"horizon_days": 30}'::jsonb,
  'cash-management',
  '[{"label":"Déséquilibre flux","pct":55,"direction":"negative"},{"label":"Délais fournisseurs courts","pct":30,"direction":"negative"},{"label":"Investissements non financés","pct":15,"direction":"negative"}]'::jsonb),

('STORE-S001', 'EBITDA margin négatif (magasin)',
  'Un point de vente affiche un EBITDA margin négatif sur 2 trimestres consécutifs.',
  'critical',
  '{"quarters": 2}'::jsonb,
  'store-opening-closing',
  '[{"label":"Sous-fréquentation","pct":40,"direction":"negative"},{"label":"Charges fixes élevées","pct":35,"direction":"negative"},{"label":"Ticket moyen faible","pct":25,"direction":"negative"}]'::jsonb),

('STORE-S002', 'Fréquentation en baisse (-20% vs N-1)',
  'Le trafic d''un point de vente baisse de plus de 20% par rapport à l''année précédente.',
  'high',
  '{"threshold_pct": -20, "reference": "YoY"}'::jsonb,
  'store-opening-closing',
  '[{"label":"Concurrence locale","pct":40,"direction":"negative"},{"label":"Évolution zone chalandise","pct":35,"direction":"negative"},{"label":"Problème attractivité","pct":25,"direction":"negative"}]'::jsonb),

('STORE-S003', 'Opportunité d''ouverture détectée',
  'Une zone à fort potentiel marché sans présence Lumen est identifiée.',
  'info',
  '{"min_market_potential_eur": 2000000}'::jsonb,
  'store-opening-closing',
  '[{"label":"Potentiel marché non capturé","pct":60,"direction":"positive"},{"label":"Faible risque cannibalisation","pct":40,"direction":"positive"}]'::jsonb)

ON CONFLICT (rule_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  pack_slug = EXCLUDED.pack_slug;

-- ── 3. Wire pack_id on new signal_rules ─────────────────────────────────────

UPDATE signal_rules sr
SET pack_id = p.id
FROM decision_packs p
WHERE sr.pack_id IS NULL
  AND p.slug IN ('stock-availability','supplier-risk','cash-management','store-opening-closing')
  AND sr.pack_slug = p.slug;

-- ── 4. CAUSAL RULES ─────────────────────────────────────────────────────────

INSERT INTO causal_rules (id, code, title, cause_object, cause_attribute, operator, threshold,
  effect_object, effect_attribute, direction, confidence, source, domain, rationale, is_active)
VALUES
(gen_random_uuid(), 'STOCK-R001', 'Couverture <5j → risque rupture critique',
  'Inventory', 'coverage_days', '<', '5',
  'Product', 'availability_risk', 'increase',
  0.92, 'operational', 'supply_chain',
  'En dessous de 5 jours de couverture, le risque de rupture augmente exponentiellement selon les modèles EOQ.',
  true),

(gen_random_uuid(), 'STOCK-R002', 'OTIF <85% → allongement délai réappro',
  'Supplier', 'otif', '<', '0.85',
  'Inventory', 'coverage_days', 'decrease',
  0.88, 'operational', 'supply_chain',
  'Un OTIF dégradé se traduit directement par des délais de réapprovisionnement plus longs.',
  true),

(gen_random_uuid(), 'STOCK-R003', 'Surstock → coût immobilisation capital',
  'Inventory', 'coverage_days', '>', '90',
  'Product', 'holding_cost_eur', 'increase',
  0.85, 'financial', 'supply_chain',
  'Au-delà de 90 jours de stock, le coût de détention (stockage, obsolescence) devient significatif.',
  true),

(gen_random_uuid(), 'SUPP-R001', 'Dépendance >60% → risque rupture supply',
  'Supplier', 'dependency_pct', '>', '60',
  'Inventory', 'coverage_days', 'decrease',
  0.90, 'strategic', 'supplier',
  'Une dépendance mono-fournisseur élevée amplifie l''impact de toute défaillance sur la chaîne.',
  true),

(gen_random_uuid(), 'SUPP-R002', 'Score financier <40 → probabilité défaut',
  'Supplier', 'financial_score', '<', '40',
  'Supplier', 'reliability_score', 'decrease',
  0.87, 'financial', 'supplier',
  'Les indicateurs financiers précèdent généralement les défaillances opérationnelles de 3-6 mois.',
  true),

(gen_random_uuid(), 'CASH-R001', 'DSO >45j → tension trésorerie',
  'Receivable', 'dso_days', '>', '45',
  'CashPosition', 'cash_balance_eur', 'decrease',
  0.93, 'financial', 'treasury',
  'Chaque jour de DSO supplémentaire immobilise en moyenne 1/365e du CA annuel en besoin de fonds.',
  true),

(gen_random_uuid(), 'CASH-R002', 'Encours en retard → risque crédit',
  'Receivable', 'overdue_amount_eur', '>', '100000',
  'CashPosition', 'cash_forecast_30d_eur', 'decrease',
  0.88, 'financial', 'treasury',
  'Les créances en retard significatives réduisent directement la prévision de trésorerie court terme.',
  true),

(gen_random_uuid(), 'STORE-R001', 'Fréquentation -20% → EBITDA dégradé',
  'Store', 'footfall_per_day', '<', '100',
  'Store', 'ebitda_margin_pct', 'decrease',
  0.89, 'operational', 'retail',
  'La fréquentation est le premier driver du CA en retail physique — une baisse se répercute mécaniquement sur la marge.',
  true),

(gen_random_uuid(), 'STORE-R002', 'Taux conversion bas → sous-exploitation',
  'Store', 'conversion_rate_pct', '<', '15',
  'Store', 'ebitda_margin_pct', 'decrease',
  0.82, 'operational', 'retail',
  'Un faible taux de conversion signale un problème d''offre, merchandising ou service client.',
  true)

ON CONFLICT (code) DO NOTHING;

END $$;
