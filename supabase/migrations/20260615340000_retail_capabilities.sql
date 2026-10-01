-- ─────────────────────────────────────────────────────────────────────────────
-- Retail Decision Capabilities — Operational + Tactical + Strategic
-- Semantic Contract = stable across clients (objects & attributes)
-- Extraction Contract = client-specific (where/how to pull data)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. DECISION CAPABILITIES ─────────────────────────────────────────────────

INSERT INTO decision_packs (slug, title, category, description, icon, tier, family,
  is_published, is_universal, capabilities, kpis, decision_question, owner_role,
  business_question, decision_criteria)
VALUES

-- OPERATIONAL
('demand-forecasting', 'Demand Forecasting', 'Supply Chain',
  'Anticiper la demande par SKU, canal et période pour optimiser les stocks et les achats.',
  '📈', 'operational', 'supply_chain', true, true,
  ARRAY['Prévision de vente', 'Gestion des stocks', 'Planification des achats'],
  ARRAY['Taux de couverture', 'Forecast accuracy', 'Rupture de stock %', 'Surstock %'],
  'Quelles quantités commander et quand pour éviter ruptures et surstocks ?',
  'Supply Chain Manager',
  'Comment aligner les volumes achetés avec la demande réelle par canal et par période ?',
  '[{"label":"Précision prévisionnelle","description":"Ecart entre prévision et vente réelle","weight":9},{"label":"Couverture de stock","description":"Nombre de jours de stock disponibles","weight":8},{"label":"Coût de détention","description":"Coût financier du stock immobilisé","weight":6}]'::jsonb),

('promotion-optimization', 'Optimisation Promotions', 'Commerce',
  'Décider quelles promotions lancer, sur quels produits, à quel moment et avec quelle profondeur de remise.',
  '🏷️', 'tactical', 'commerce', true, true,
  ARRAY['ROI promotionnel', 'Gestion des remises', 'Animation commerciale'],
  ARRAY['Uplift ventes %', 'ROI promo', 'Cannibalisation %', 'Marge nette après remise'],
  'Quelles promotions maximisent le chiffre d''affaires sans détruire la marge ?',
  'Directeur Commercial',
  'Comment choisir les bons produits, remises et timing pour maximiser l''impact sans cannibaler ?',
  '[{"label":"Uplift de ventes","description":"Hausse des ventes générée par la promo","weight":9},{"label":"Impact marge","description":"Marge nette après déduction de la remise","weight":10},{"label":"Cannibalisation","description":"Transfert de ventes depuis d''autres produits","weight":7}]'::jsonb),

('channel-performance', 'Performance des Canaux', 'Commerce',
  'Piloter la performance comparative entre canaux (physique, e-commerce, marketplace) et arbitrer les investissements.',
  '🏪', 'tactical', 'commerce', true, true,
  ARRAY['Omnicanal', 'Performance magasin', 'Performance e-commerce'],
  ARRAY['CA par canal', 'Taux de conversion', 'Panier moyen', 'Coût d''acquisition client'],
  'Quels canaux prioriser et où investir pour maximiser la croissance rentable ?',
  'Directeur Retail',
  'Comment comparer la rentabilité et le potentiel de chaque canal pour arbitrer les ressources ?',
  '[{"label":"Croissance CA","description":"Taux de croissance par canal","weight":9},{"label":"Rentabilité nette","description":"Marge après coûts opérationnels du canal","weight":10},{"label":"Satisfaction client","description":"NPS et taux de retour par canal","weight":7}]'::jsonb),

('supply-chain-performance', 'Performance Supply Chain', 'Supply Chain',
  'Surveiller la fiabilité de la chaîne logistique : délais, taux de service, coûts et risques de rupture.',
  '🚚', 'operational', 'supply_chain', true, true,
  ARRAY['Pilotage logistique', 'Taux de service', 'Gestion des délais'],
  ARRAY['Taux de service %', 'Lead time moyen', 'Coût logistique / CA', 'Taux de retour %'],
  'La supply chain est-elle fiable et compétitive pour les prochains 90 jours ?',
  'Supply Chain Manager',
  'Où sont les vulnérabilités logistiques et comment les réduire avant qu''elles impactent le client ?',
  '[{"label":"Taux de service","description":"% commandes livrées à temps et complet","weight":10},{"label":"Coût logistique","description":"Coût total logistique rapporté au CA","weight":8},{"label":"Fiabilité fournisseurs","description":"Respect des délais et qualité","weight":8}]'::jsonb),

-- STRATEGIC (Mode / Retail fashion)
('store-opening-closing', 'Ouverture / Fermeture Points de Vente', 'Stratégie',
  'Décider d''ouvrir, transformer ou fermer un point de vente selon sa rentabilité et le potentiel de zone.',
  '🏬', 'strategic', 'retail_network', true, true,
  ARRAY['Réseau retail', 'Rentabilité magasin', 'Expansion géographique'],
  ARRAY['EBITDA magasin', 'CA / m²', 'Breakeven (mois)', 'Potentiel zone de chalandise'],
  'Faut-il ouvrir, transformer ou fermer ce point de vente ?',
  'COMEX / DG',
  'Comment évaluer la rentabilité prospective et le potentiel de zone pour une décision réseau éclairée ?',
  '[{"label":"Rentabilité projetée","description":"EBITDA attendu sur 3 ans","weight":10},{"label":"Potentiel marché local","description":"Taille et croissance de la zone de chalandise","weight":9},{"label":"Cohérence réseau","description":"Complémentarité avec les points de vente existants","weight":7},{"label":"Coût de sortie","description":"Indemnités, loyers résiduels, stocks","weight":8}]'::jsonb),

('collection-investment', 'Investissement Nouvelle Collection', 'Stratégie',
  'Décider du budget, du mix produit et des volumes à engager pour une nouvelle collection.',
  '👗', 'strategic', 'product', true, true,
  ARRAY['Pilotage collection', 'Gestion des achats mode', 'Sell-through'],
  ARRAY['Sell-through %', 'Marge brute collection', 'Taux d''invendus', 'CA collection / saison'],
  'Quels produits, volumes et budget engager pour cette collection ?',
  'Directeur Achat / Produit',
  'Comment construire un plan collection qui maximise le sell-through et minimise les invendus ?',
  '[{"label":"Sell-through attendu","description":"% de la collection vendue avant soldes","weight":10},{"label":"Marge brute","description":"Marge après coût d''achat et remises","weight":9},{"label":"Risque invendus","description":"Volume et valeur des invendus potentiels","weight":8},{"label":"Cohérence positionnement","description":"Alignement avec l''identité de marque","weight":7}]'::jsonb),

('pricing-strategy', 'Stratégie Prix', 'Commerce',
  'Positionner les prix face à la concurrence tout en préservant la marge et la perception de valeur.',
  '💰', 'strategic', 'commerce', true, true,
  ARRAY['Politique tarifaire', 'Veille concurrentielle', 'Élasticité prix'],
  ARRAY['Index prix vs concurrence', 'Élasticité prix', 'Marge nette %', 'Part de marché'],
  'Notre positionnement prix est-il compétitif et profitable sur ce segment ?',
  'Directeur Marketing / Pricing',
  'Comment ajuster les prix pour être compétitif sans sacrifier la marge ni la perception de valeur ?',
  '[{"label":"Compétitivité prix","description":"Ecart de prix vs concurrents directs","weight":9},{"label":"Impact marge","description":"Effet d''un ajustement sur la marge nette","weight":10},{"label":"Perception client","description":"Risque de dévaluation de la marque","weight":8}]'::jsonb),

('unsold-management', 'Gestion des Invendus', 'Commerce',
  'Décider comment écouler les invendus (soldes, déstockage, dons, destruction) en limitant l''impact marge.',
  '📦', 'tactical', 'commerce', true, true,
  ARRAY['Gestion des fins de série', 'Soldes et promotions', 'Valeur résiduelle'],
  ARRAY['Taux d''invendus %', 'Valeur stock résiduel', 'Marge récupérée après déstockage', 'Impact image'],
  'Quelle stratégie d''écoulement des invendus maximise la valeur récupérée ?',
  'Directeur Commercial',
  'Comment arbitrer entre vitesse d''écoulement et préservation de marge sur les invendus ?',
  '[{"label":"Valeur récupérée","description":"Montant récupéré vs coût d''achat","weight":9},{"label":"Impact image","description":"Risque de dévalorisation perçue de la marque","weight":8},{"label":"Vitesse d''écoulement","description":"Délai pour solder les stocks","weight":7}]'::jsonb),

('ethical-sourcing', 'Sourcing Éthique & Durabilité', 'Stratégie',
  'Évaluer et piloter la conformité RSE et la durabilité de la chaîne d''approvisionnement.',
  '🌿', 'strategic', 'supplier', true, true,
  ARRAY['RSE', 'Conformité fournisseurs', 'Durabilité'],
  ARRAY['Score RSE fournisseurs', 'Part sourcing certifié %', 'Empreinte carbone kg/pièce', 'Taux non-conformités'],
  'Notre base fournisseurs est-elle conforme aux engagements RSE et aux réglementations ?',
  'Directeur Achats / RSE',
  'Comment identifier et réduire les risques éthiques dans la chaîne d''approvisionnement ?',
  '[{"label":"Conformité RSE","description":"% fournisseurs certifiés standards éthiques","weight":10},{"label":"Risque réglementaire","description":"Exposition aux nouvelles réglementations (CSRD, devoir de vigilance)","weight":9},{"label":"Coût de transition","description":"Surcoût lié au changement de fournisseurs","weight":6}]'::jsonb)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  kpis = EXCLUDED.kpis,
  decision_question = EXCLUDED.decision_question,
  decision_criteria = EXCLUDED.decision_criteria,
  is_published = true,
  is_universal = true;

-- ── 2. SIGNAL RULES pour les nouvelles capabilities ──────────────────────────

INSERT INTO signal_rules (rule_key, title, description, severity_default, config, pack_slug, contributors)
VALUES

('DEMAND-S001', 'Écart prévisionnel critique (>20%)',
  'L''écart entre prévisions et ventes réelles dépasse 20% sur 3 semaines consécutives.',
  'high',
  '{"threshold": 20, "window_weeks": 3, "direction": "both"}'::jsonb,
  'demand-forecasting',
  '[{"label":"Volatilité demande non capturée","pct":40,"direction":"negative"},{"label":"Modèle prévisionnel obsolète","pct":35,"direction":"negative"},{"label":"Événements externes non intégrés","pct":25,"direction":"negative"}]'::jsonb),

('DEMAND-S002', 'Rupture de stock imminente (<7j couverture)',
  'La couverture de stock passe sous 7 jours sur un SKU top 20.',
  'critical',
  '{"threshold_days": 7, "scope": "top20_sku"}'::jsonb,
  'demand-forecasting',
  '[{"label":"Prévision sous-estimée","pct":45,"direction":"negative"},{"label":"Réapprovisionnement tardif","pct":35,"direction":"negative"},{"label":"Pic de demande inattendu","pct":20,"direction":"negative"}]'::jsonb),

('PROMO-S001', 'ROI promotionnel négatif',
  'La promotion en cours génère un uplift insuffisant pour couvrir le coût de la remise.',
  'high',
  '{"threshold_roi": 1.0}'::jsonb,
  'promotion-optimization',
  '[{"label":"Remise trop profonde","pct":40,"direction":"negative"},{"label":"Mauvais ciblage produit","pct":35,"direction":"negative"},{"label":"Cannibalisation non anticipée","pct":25,"direction":"negative"}]'::jsonb),

('CHANNEL-S001', 'Sous-performance canal e-commerce',
  'Le taux de conversion e-commerce est 30% sous le benchmark secteur.',
  'high',
  '{"threshold_gap_pct": 30}'::jsonb,
  'channel-performance',
  '[{"label":"UX / parcours d''achat dégradé","pct":35,"direction":"negative"},{"label":"Assortiment inadapté au canal","pct":30,"direction":"negative"},{"label":"Trafic qualifié insuffisant","pct":35,"direction":"negative"}]'::jsonb),

('SC-S001', 'Taux de service sous 95%',
  'Le taux de service logistique passe sous 95% sur 2 semaines consécutives.',
  'critical',
  '{"threshold": 95, "window_weeks": 2}'::jsonb,
  'supply-chain-performance',
  '[{"label":"Fiabilité transporteurs","pct":40,"direction":"negative"},{"label":"Ruptures entrepôt","pct":35,"direction":"negative"},{"label":"Pics de commandes non anticipés","pct":25,"direction":"negative"}]'::jsonb),

('UNSOLD-S001', 'Taux d''invendus > 25% en fin de saison',
  'Le stock résiduel en fin de saison dépasse 25% des volumes achetés.',
  'high',
  '{"threshold_pct": 25}'::jsonb,
  'unsold-management',
  '[{"label":"Prévisions de vente surestimées","pct":45,"direction":"negative"},{"label":"Mauvais mix produit","pct":30,"direction":"negative"},{"label":"Animation commerciale insuffisante","pct":25,"direction":"negative"}]'::jsonb),

('ESG-S001', 'Fournisseur non certifié RSE',
  'Un fournisseur représentant >15% des achats n''a pas de certification éthique valide.',
  'high',
  '{"threshold_share_pct": 15}'::jsonb,
  'ethical-sourcing',
  '[{"label":"Absence de certification (LWG/GOTS/SA8000)","pct":50,"direction":"negative"},{"label":"Concentration achats sur fournisseur à risque","pct":30,"direction":"negative"},{"label":"Manque de traçabilité tier 2","pct":20,"direction":"negative"}]'::jsonb)

ON CONFLICT (rule_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  contributors = EXCLUDED.contributors,
  pack_slug = EXCLUDED.pack_slug;

-- ── 3. OPTIONS DÉCISIONNELLES pour les nouvelles capabilities ─────────────────

-- demand-forecasting
INSERT INTO decision_recommendations (pack_id, signal_code, title, description, impact_score, feasibility_score, priority_score, effort_level, time_to_impact, action_steps)
SELECT p.id, 'DEMAND-S001',
  'Réviser le modèle prévisionnel avec données récentes',
  'Recalibrer le modèle de prévision en intégrant les dernières tendances, saisonnalité et événements planifiés.',
  75, 70, 72, 'medium', '2-4 weeks',
  '[{"order":1,"label":"Analyser les écarts prévision vs réel par SKU et canal","duration":"2 jours"},{"order":2,"label":"Identifier les facteurs non capturés (promo, météo, tendance)","duration":"3 jours"},{"order":3,"label":"Recalibrer le modèle ou passer à un modèle ML","duration":"2 semaines"},{"order":4,"label":"Valider sur données historiques (backtesting)","duration":"1 semaine"},{"order":5,"label":"Déployer et monitorer la précision hebdomadairement","owner":"Supply Chain"}]'::jsonb
FROM decision_packs p WHERE p.slug = 'demand-forecasting'
ON CONFLICT DO NOTHING;

INSERT INTO decision_recommendations (pack_id, signal_code, title, description, impact_score, feasibility_score, priority_score, effort_level, time_to_impact, action_steps)
SELECT p.id, 'DEMAND-S002',
  'Réapprovisionnement d''urgence sur SKUs critiques',
  'Déclencher un réapprovisionnement accéléré pour les SKUs top 20 sous le seuil de couverture.',
  85, 75, 80, 'low', '1-2 weeks',
  '[{"order":1,"label":"Identifier les SKUs critiques (<7j de couverture)","duration":"1 jour"},{"order":2,"label":"Contacter les fournisseurs pour commande express","duration":"2 jours"},{"order":3,"label":"Prioriser l''allocation entrepôt vers les magasins clés","duration":"1 jour"},{"order":4,"label":"Alerter les équipes commerciales sur disponibilité réduite","duration":"1 jour"},{"order":5,"label":"Ajuster le paramètre de réapprovisionnement automatique","duration":"3 jours"}]'::jsonb
FROM decision_packs p WHERE p.slug = 'demand-forecasting'
ON CONFLICT DO NOTHING;

-- promotion-optimization
INSERT INTO decision_recommendations (pack_id, signal_code, title, description, impact_score, feasibility_score, priority_score, effort_level, time_to_impact, action_steps)
SELECT p.id, 'PROMO-S001',
  'Revoir la mécanique promotionnelle (remise + ciblage)',
  'Ajuster la profondeur de remise et cibler les produits à meilleure élasticité prix.',
  70, 80, 75, 'low', '1 week',
  '[{"order":1,"label":"Analyser l''élasticité prix par famille de produits","duration":"2 jours"},{"order":2,"label":"Identifier les produits à forte élasticité (uplift > 2x remise)","duration":"1 jour"},{"order":3,"label":"Réduire la remise sur les produits à faible élasticité","duration":"1 jour"},{"order":4,"label":"Concentrer la promo sur top SKUs avec marge suffisante","duration":"1 jour"},{"order":5,"label":"Mesurer le ROI à J+7 et ajuster si nécessaire","owner":"Trade Marketing"}]'::jsonb
FROM decision_packs p WHERE p.slug = 'promotion-optimization'
ON CONFLICT DO NOTHING;

-- channel-performance
INSERT INTO decision_recommendations (pack_id, signal_code, title, description, impact_score, feasibility_score, priority_score, effort_level, time_to_impact, action_steps)
SELECT p.id, 'CHANNEL-S001',
  'Plan de redressement e-commerce',
  'Audit UX + optimisation parcours achat + révision assortiment en ligne.',
  80, 65, 72, 'high', '4-8 weeks',
  '[{"order":1,"label":"Audit UX complet du funnel (session recordings + analytics)","duration":"1 semaine"},{"order":2,"label":"Identifier les points de friction (abandon panier, tunnel paiement)","duration":"3 jours"},{"order":3,"label":"Réviser l''assortiment : retirer les références sans ventes en ligne","duration":"1 semaine"},{"order":4,"label":"Lancer des tests A/B sur les pages produits clés","duration":"2 semaines"},{"order":5,"label":"Renforcer le SEO et les campagnes d''acquisition ciblées","duration":"4 semaines"}]'::jsonb
FROM decision_packs p WHERE p.slug = 'channel-performance'
ON CONFLICT DO NOTHING;

-- unsold-management
INSERT INTO decision_recommendations (pack_id, signal_code, title, description, impact_score, feasibility_score, priority_score, effort_level, time_to_impact, action_steps)
SELECT p.id, 'UNSOLD-S001',
  'Plan d''écoulement des invendus en 3 temps',
  'Soldes privées B2B + déstockage canal outlet + don / recyclage pour le résiduel.',
  65, 85, 75, 'medium', '4-6 weeks',
  '[{"order":1,"label":"Segmenter les invendus : valeur, ancienneté, potentiel outlet","duration":"2 jours"},{"order":2,"label":"Lancer une vente privée B2B (coopératives, associations)","duration":"1 semaine"},{"order":3,"label":"Proposer les invendus aux canaux outlet et marketplace","duration":"2 semaines"},{"order":4,"label":"Négocier un rachat partiel avec les fournisseurs","duration":"1 semaine"},{"order":5,"label":"Solder le résiduel : don à des associations ou recyclage","duration":"2 semaines"}]'::jsonb
FROM decision_packs p WHERE p.slug = 'unsold-management'
ON CONFLICT DO NOTHING;

-- ethical-sourcing
INSERT INTO decision_recommendations (pack_id, signal_code, title, description, impact_score, feasibility_score, priority_score, effort_level, time_to_impact, action_steps)
SELECT p.id, 'ESG-S001',
  'Plan de mise en conformité RSE fournisseurs',
  'Audit + plan de certification + diversification sourcing éthique.',
  70, 60, 65, 'high', '3-6 months',
  '[{"order":1,"label":"Cartographier les fournisseurs sans certification RSE valide","duration":"1 semaine"},{"order":2,"label":"Envoyer un questionnaire RSE et demander plan de remédiation","duration":"2 semaines"},{"order":3,"label":"Accompagner les fournisseurs stratégiques vers la certification","duration":"3 mois"},{"order":4,"label":"Identifier des fournisseurs alternatifs certifiés en backup","duration":"4 semaines"},{"order":5,"label":"Publier un rapport de transparence fournisseurs annuel","owner":"Direction RSE"}]'::jsonb
FROM decision_packs p WHERE p.slug = 'ethical-sourcing'
ON CONFLICT DO NOTHING;
