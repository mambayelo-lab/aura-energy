-- Decision Support Layer: recommended actions per signal with bipolar impact model

CREATE TABLE IF NOT EXISTS decision_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES decision_packs(id) ON DELETE CASCADE,
  signal_code text NOT NULL,
  title text NOT NULL,
  description text,
  impact_score integer NOT NULL CHECK (impact_score BETWEEN 1 AND 10),
  feasibility_score integer NOT NULL CHECK (feasibility_score BETWEEN 1 AND 10),
  priority_score numeric GENERATED ALWAYS AS (ROUND((impact_score * feasibility_score / 10.0)::numeric, 1)) STORED,
  time_to_impact text DEFAULT 'weeks',
  effort_level text DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES decision_recommendations(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('positive', 'negative')),
  description text NOT NULL,
  magnitude integer DEFAULT 2 CHECK (magnitude BETWEEN 1 AND 3)
);

ALTER TABLE decision_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_recs" ON decision_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_recs" ON decision_recommendations FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_read_effects" ON recommendation_effects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_effects" ON recommendation_effects FOR ALL TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- SEED: Recommendations for 6 Decision Capabilities
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pack_stock uuid;
  pack_cash uuid;
  pack_supplier uuid;
  pack_margin uuid;
  pack_transfo uuid;
  pack_ai uuid;
  r1 uuid; r2 uuid; r3 uuid;
BEGIN

SELECT id INTO pack_stock FROM decision_packs WHERE slug = 'stock-availability';
SELECT id INTO pack_cash FROM decision_packs WHERE slug = 'cash-management';
SELECT id INTO pack_supplier FROM decision_packs WHERE slug = 'supplier-risk';
SELECT id INTO pack_margin FROM decision_packs WHERE slug = 'margin-management';
SELECT id INTO pack_transfo FROM decision_packs WHERE slug = 'transformation-portfolio';
SELECT id INTO pack_ai FROM decision_packs WHERE slug = 'ai-readiness';

-- ── STOCK AVAILABILITY ──────────────────────────────────────────────

-- STOCK-S001: Rupture imminente
IF pack_stock IS NOT NULL THEN
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_stock, 'STOCK-S001', 'Augmenter le stock de sécurité', 'Revoir le seuil de sécurité à la hausse pour absorber les aléas de délai et de demande', 8, 9, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'stock_availability', 'positive', 'Réduit immédiatement le risque de rupture', 3),
  (r1, 'resilience', 'positive', 'Absorbe les pics de demande imprévus', 2),
  (r1, 'cash_flow', 'negative', 'Immobilise du capital en stock dormant', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_stock, 'STOCK-S001', 'Activer un fournisseur de secours', 'Solliciter un fournisseur alternatif pré-qualifié pour couvrir la rupture', 9, 6, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'supply_continuity', 'positive', 'Garantit l''approvisionnement même en cas de défaillance fournisseur principal', 3),
  (r2, 'cost', 'negative', 'Coût unitaire généralement plus élevé chez le fournisseur de secours', 2);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_stock, 'STOCK-S001', 'Déclencher une commande urgente', 'Émettre un bon de commande en urgence auprès du fournisseur habituel', 7, 8, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'stock_availability', 'positive', 'Réapprovisionne rapidement le stock', 2),
  (r3, 'cost', 'negative', 'Surcoût transport express + frais urgence', 2);

-- STOCK-S002: Vélocité anormale
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_stock, 'STOCK-S002', 'Réviser les prévisions de demande', 'Mettre à jour les prévisions en intégrant le signal de vélocité anormale', 8, 8, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'forecast_accuracy', 'positive', 'Aligne l''appro sur la demande réelle observée', 3),
  (r1, 'stock_optimization', 'positive', 'Évite les sur-stocks sur les autres produits', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_stock, 'STOCK-S002', 'Alerter les équipes commerciales', 'Informer le commerce d''une tension produit pour piloter les engagements clients', 6, 9, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'demand_visibility', 'positive', 'Partage l''information sur la tension produit en temps réel', 2),
  (r2, 'customer_satisfaction', 'negative', 'Peut nécessiter de limiter ou reporter des commandes', 2);

-- STOCK-S003: Fournisseur défaillant
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_stock, 'STOCK-S003', 'Audit fournisseur immédiat', 'Déclencher un audit qualité et opérationnel pour identifier les causes racines', 7, 7, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'supplier_reliability', 'positive', 'Identifie et traite les causes racines de la défaillance', 3),
  (r1, 'relationship', 'positive', 'Montre l''engagement qualité et renforce le partenariat', 1);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_stock, 'STOCK-S003', 'Rechercher un fournisseur alternatif', 'Lancer une consultation pour qualifier un fournisseur de substitution', 9, 5, 'months', 'high');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'supply_security', 'positive', 'Élimine la dépendance à un fournisseur unique défaillant', 3),
  (r2, 'transition_cost', 'negative', 'Coût et délai de qualification d''un nouveau fournisseur', 3);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_stock, 'STOCK-S003', 'Renégocier les SLA contractuels', 'Réviser le contrat pour inclure des pénalités de retard et des engagements de délai', 6, 8, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'accountability', 'positive', 'Engage contractuellement le fournisseur sur ses délais', 2),
  (r3, 'visibility', 'positive', 'Meilleur suivi et reporting des livraisons', 2);
END IF;

-- ── CASH MANAGEMENT ─────────────────────────────────────────────────

IF pack_cash IS NOT NULL THEN
-- CASH-S001: Risque trésorerie court terme
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_cash, 'CASH-S001', 'Accélérer les relances clients', 'Intensifier les relances sur les créances échues pour rentrer du cash rapidement', 9, 9, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'cash_flow', 'positive', 'Rentre du cash immédiatement en encaissant les créances en retard', 3),
  (r1, 'dso', 'positive', 'Réduit le DSO et améliore le besoin en fonds de roulement', 3),
  (r1, 'customer_relationship', 'negative', 'Peut créer des tensions avec certains clients mauvais payeurs', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_cash, 'CASH-S001', 'Négocier une ligne de crédit court terme', 'Activer un découvert ou une ligne de crédit auprès de la banque', 7, 6, 'days', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'liquidity', 'positive', 'Sécurise la trésorerie disponible à court terme', 3),
  (r2, 'cost', 'negative', 'Coût des intérêts et frais bancaires', 1);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_cash, 'CASH-S001', 'Reporter les investissements non critiques', 'Suspendre temporairement les dépenses discrétionnaires pour préserver le cash', 6, 8, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'cash_preservation', 'positive', 'Préserve le cash disponible pour les dépenses opérationnelles critiques', 2),
  (r3, 'growth', 'negative', 'Retarde des projets de développement ou d''investissement', 2);

-- CASH-S002: Client mauvais payeur
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_cash, 'CASH-S002', 'Mettre le client sous conditions strictes', 'Exiger un paiement comptant ou une garantie bancaire pour les nouvelles commandes', 8, 7, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'cash_security', 'positive', 'Élimine le risque d''accumulation de nouvelles créances impayées', 3),
  (r1, 'sales', 'negative', 'Peut freiner les nouvelles commandes de ce client', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_cash, 'CASH-S002', 'Proposer un escompte pour paiement rapide', 'Offrir 1-2% de remise si paiement dans les 10 jours', 7, 8, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'cash_acceleration', 'positive', 'Accélère significativement l''encaissement', 2),
  (r2, 'margin', 'negative', 'Coût de l''escompte (1-2% du montant)', 1);
END IF;

-- ── SUPPLIER RISK ───────────────────────────────────────────────────

IF pack_supplier IS NOT NULL THEN
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_supplier, 'SUPP-S001', 'Plan de continuité d''approvisionnement', 'Définir et activer un plan B pour chaque fournisseur critique à risque', 9, 7, 'months', 'high');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'supply_security', 'positive', 'Élimine le risque de rupture par défaillance fournisseur', 3),
  (r1, 'resilience', 'positive', 'Prépare l''entreprise aux crises d''approvisionnement', 3),
  (r1, 'cost', 'negative', 'Investissement en qualification fournisseurs alternatifs', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_supplier, 'SUPP-S001', 'Monitoring financier renforcé', 'Mettre en place une veille sur la santé financière du fournisseur critique', 6, 9, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'early_warning', 'positive', 'Détecte les signaux faibles de défaillance avant qu''ils se matérialisent', 3),
  (r2, 'visibility', 'positive', 'Meilleure visibilité continue sur le risque fournisseur', 2);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_supplier, 'SUPP-S001', 'Réduire la concentration sur ce fournisseur', 'Fragmenter les volumes entre plusieurs fournisseurs pour réduire la dépendance', 8, 6, 'months', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'risk_diversification', 'positive', 'Réduit l''exposition en cas de défaillance du fournisseur', 3),
  (r3, 'negotiation_power', 'negative', 'Volumes fragmentés = moins bon prix unitaire', 2);
END IF;

-- ── MARGIN MANAGEMENT ───────────────────────────────────────────────

IF pack_margin IS NOT NULL THEN
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_margin, 'MARG-S001', 'Réviser la politique tarifaire', 'Analyser la sensibilité prix et ajuster les tarifs pour restaurer la marge', 9, 6, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'margin', 'positive', 'Améliore directement la marge unitaire sur les produits sous seuil', 3),
  (r1, 'volume', 'negative', 'Risque de perte de volume si les clients sont sensibles au prix', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_margin, 'MARG-S001', 'Optimiser les coûts logistiques', 'Renégocier les contrats de transport et mutualiser les livraisons', 7, 7, 'months', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'margin', 'positive', 'Réduit les coûts directs et améliore la marge nette', 2),
  (r2, 'efficiency', 'positive', 'Améliore l''efficacité opérationnelle de la supply chain', 2);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_margin, 'MARG-S001', 'Déréférencer les SKUs non rentables', 'Identifier et supprimer les références dont la marge est structurellement négative', 8, 5, 'months', 'high');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'portfolio_margin', 'positive', 'Concentre les ressources sur les produits rentables', 3),
  (r3, 'revenue', 'negative', 'Perte de chiffre d''affaires sur les références supprimées', 2);
END IF;

-- ── TRANSFORMATION PORTFOLIO ─────────────────────────────────────────

IF pack_transfo IS NOT NULL THEN
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_transfo, 'TRANSFO-S001', 'Revue de projet d''urgence', 'Organiser un comité de pilotage extraordinaire pour analyser la dérive', 8, 9, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'control', 'positive', 'Reprend la maîtrise du projet et clarifie la situation réelle', 3),
  (r1, 'visibility', 'positive', 'Identifie les causes de dérive et les responsabilités', 2);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_transfo, 'TRANSFO-S001', 'Redéfinir le scope du projet', 'Réduire le périmètre pour livrer l''essentiel dans les contraintes budget', 7, 7, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'deliverability', 'positive', 'Rend le projet atteignable dans les contraintes actuelles', 3),
  (r2, 'scope', 'negative', 'Certaines fonctionnalités ou livrables sont reportés ou supprimés', 2);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_transfo, 'TRANSFO-S001', 'Renforcer la gouvernance projet', 'Mettre en place des checkpoints hebdomadaires et un tableau de bord temps réel', 6, 8, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'accountability', 'positive', 'Clarifie les responsabilités et accélère la prise de décision', 2),
  (r3, 'early_warning', 'positive', 'Détecte les nouvelles dérives avant qu''elles s''aggravent', 2);
END IF;

-- ── AI READINESS ─────────────────────────────────────────────────────

IF pack_ai IS NOT NULL THEN
  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_ai, 'AIREADY-S001', 'Développer une API wrapper', 'Créer une couche API sur l''application critique pour exposer ses données', 9, 6, 'months', 'high');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'integration', 'positive', 'Permet l''intégration des données dans la chaîne analytics', 3),
  (r1, 'ai_readiness', 'positive', 'Ouvre la voie aux cas d''usage IA sur ce domaine', 3);

  r2 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r2, pack_ai, 'AIREADY-S001', 'Extraction ETL en attendant', 'Mettre en place des extractions batch pour accéder aux données à court terme', 6, 8, 'weeks', 'medium');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r2, 'data_access', 'positive', 'Accès aux données sans attendre la refonte API', 2),
  (r2, 'real_time', 'negative', 'Pas de temps réel — données en batch uniquement', 2);

  r3 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r3, pack_ai, 'AIREADY-S002', 'Programme qualité données', 'Lancer un chantier qualité données avec ownership défini par domaine', 8, 7, 'months', 'high');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r3, 'data_quality', 'positive', 'Améliore la fiabilité et la complétude des données', 3),
  (r3, 'ai_readiness', 'positive', 'Prérequis fondamental pour entraîner des modèles IA fiables', 3);

  r1 := gen_random_uuid();
  INSERT INTO decision_recommendations(id, pack_id, signal_code, title, description, impact_score, feasibility_score, time_to_impact, effort_level)
  VALUES(r1, pack_ai, 'AIREADY-S002', 'Nommer un Data Owner par domaine', 'Désigner des responsables données pour chaque domaine métier clé', 6, 9, 'days', 'low');
  INSERT INTO recommendation_effects(recommendation_id, dimension, direction, description, magnitude) VALUES
  (r1, 'accountability', 'positive', 'Responsabilise sur la qualité et crée une culture données', 2),
  (r1, 'governance', 'positive', 'Structure la gouvernance des données dans toute l''organisation', 2);
END IF;

END $$;
