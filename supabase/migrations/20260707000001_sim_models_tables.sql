-- =============================================================================
-- Simulation model tables: hypotheses + alternatives per decision_pack
-- Replaces hardcoded MODEL_HYPOTHESIS_MAP + MODEL_ALTERNATIVES in cockpit.functions
-- =============================================================================

-- ── Hypothesis sliders ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sim_hypotheses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug   text NOT NULL,
  hyp_id      text NOT NULL,          -- matches vals Record<string,number> key
  label       text NOT NULL,
  icon        text NOT NULL DEFAULT '',
  unit        text NOT NULL DEFAULT '',
  min_val     numeric NOT NULL,
  max_val     numeric NOT NULL,
  baseline    numeric NOT NULL,
  fact_name   text,                   -- Supabase facts.attribute_name to resolve current value
  sort_order  smallint NOT NULL DEFAULT 0,
  UNIQUE (pack_slug, hyp_id)
);

-- ── Simulation alternatives ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sim_alternatives (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug   text NOT NULL,
  alt_id      text NOT NULL,          -- stable id used in influence references
  name        text NOT NULL,
  base_score  smallint NOT NULL CHECK (base_score BETWEEN 0 AND 100),
  margin      numeric NOT NULL DEFAULT 0,
  cash12      numeric NOT NULL DEFAULT 0,
  risk        text NOT NULL CHECK (risk IN ('Faible', 'Moyen', 'Élevé')),
  delay       text NOT NULL DEFAULT '—',
  -- Influences: [{criterionId, s, d, intensity, contextRules:[{factName,condition,threshold,multiplier,reason}]}]
  influences  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Preconditions: [{factName, condition, threshold, feasibilityPenalty, reason}]
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order  smallint NOT NULL DEFAULT 0,
  UNIQUE (pack_slug, alt_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS sim_hyp_pack_idx ON public.sim_hypotheses(pack_slug);
CREATE INDEX IF NOT EXISTS sim_alt_pack_idx ON public.sim_alternatives(pack_slug);

-- ── RLS: authenticated reads, no public access ────────────────────────────────
ALTER TABLE public.sim_hypotheses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_sim_hyp"  ON public.sim_hypotheses  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_sim_hyp" ON public.sim_hypotheses  FOR ALL    TO authenticated USING (true);
CREATE POLICY "auth_read_sim_alt"  ON public.sim_alternatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_sim_alt" ON public.sim_alternatives FOR ALL    TO authenticated USING (true);

-- =============================================================================
-- SEED: Maison Lumen decision model data
-- Idempotent via ON CONFLICT DO NOTHING
-- =============================================================================

-- ── supplier-resilience ───────────────────────────────────────────────────────

INSERT INTO public.sim_hypotheses (pack_slug, hyp_id, label, icon, unit, min_val, max_val, baseline, fact_name, sort_order) VALUES
  ('supplier-resilience', 'supplier_quality', 'Qualité fournisseur',    '🏭', '',     0,   100, 75,  'min_supplier_risk_score',    0),
  ('supplier-resilience', 'import_cost',      'Hausse coûts import',    '📦', '%',    0,   40,  0,   'supplier_alerts_high_count', 1),
  ('supplier-resilience', 'lead_time',        'Délai livraison',         '⏱️',' j',  7,   90,  21,  'dso_days',                   2)
ON CONFLICT (pack_slug, hyp_id) DO NOTHING;

INSERT INTO public.sim_alternatives (pack_slug, alt_id, name, base_score, margin, cash12, risk, delay, influences, preconditions, sort_order) VALUES
(
  'supplier-resilience', 'a1', 'Dual-sourcing FabricPlus Maroc', 82, -0.8, 0.2, 'Faible', '3 sem.', 0,
  '[{"criterionId":"supplier_quality","s":0.85,"d":0.05,"intensity":1.0,"contextRules":[{"factName":"import_cost","condition":"gt","threshold":20,"multiplier":1.3,"reason":"Coûts import élevés renforcent l''intérêt du dual-sourcing"}]},{"criterionId":"import_cost","s":0.30,"d":0.50,"intensity":0.8},{"criterionId":"lead_time","s":0.60,"d":0.10,"intensity":0.9,"contextRules":[{"factName":"lead_time","condition":"gt","threshold":60,"multiplier":1.2,"reason":"Délais actuels très longs amplifient le gain de cette option"}]}]'::jsonb,
  '[{"factName":"import_cost","condition":"lt","threshold":35,"feasibilityPenalty":0.2,"reason":"Hausse import >35% rend la négociation Maroc plus difficile"}]'::jsonb,
  0
),
(
  'supplier-resilience', 'a2', 'Buffer stock 45j', 74, -1.2, -0.5, 'Faible', 'Immédiat', 0,
  '[{"criterionId":"supplier_quality","s":0.40,"d":0.10,"intensity":0.7},{"criterionId":"import_cost","s":0.10,"d":0.80,"intensity":1.0,"contextRules":[{"factName":"import_cost","condition":"gt","threshold":15,"multiplier":1.4,"reason":"Plus les coûts import augmentent, plus le stock tampon pèse"}]},{"criterionId":"lead_time","s":0.75,"d":0.05,"intensity":1.0}]'::jsonb,
  '[]'::jsonb,
  1
),
(
  'supplier-resilience', 'a3', 'SLA renforcé + pénalités', 71, -0.3, 0.1, 'Moyen', '2 sem.', 0,
  '[{"criterionId":"supplier_quality","s":0.70,"d":0.15,"intensity":0.9},{"criterionId":"import_cost","s":0.20,"d":0.20,"intensity":0.6},{"criterionId":"lead_time","s":0.50,"d":0.20,"intensity":0.8}]'::jsonb,
  '[]'::jsonb,
  2
),
(
  'supplier-resilience', 'a4', 'Intégration verticale', 55, -2.4, -1.8, 'Élevé', '12 mois', 0,
  '[{"criterionId":"supplier_quality","s":0.90,"d":0.05,"intensity":1.0},{"criterionId":"import_cost","s":0.60,"d":0.30,"intensity":0.9},{"criterionId":"lead_time","s":0.40,"d":0.50,"intensity":0.7}]'::jsonb,
  '[{"factName":"lead_time","condition":"gt","threshold":45,"feasibilityPenalty":0.15,"reason":"Délais actuels trop courts pour justifier l''intégration verticale maintenant"}]'::jsonb,
  3
)
ON CONFLICT (pack_slug, alt_id) DO NOTHING;

-- ── margin-defense ────────────────────────────────────────────────────────────

INSERT INTO public.sim_hypotheses (pack_slug, hyp_id, label, icon, unit, min_val, max_val, baseline, fact_name, sort_order) VALUES
  ('margin-defense', 'price_increase', 'Hausse prix vente',       '💰', '%',  -10, 20, 0,  'avg_absenteeism_rate',    0),
  ('margin-defense', 'material_cost',  'Hausse coût matières',    '📦', '%',    0, 30, 12, 'min_supplier_risk_score', 1),
  ('margin-defense', 'volume_delta',   'Variation volume ventes', '📈', '%',  -20, 20, 0,  'dso_days',                2)
ON CONFLICT (pack_slug, hyp_id) DO NOTHING;

INSERT INTO public.sim_alternatives (pack_slug, alt_id, name, base_score, margin, cash12, risk, delay, influences, preconditions, sort_order) VALUES
(
  'margin-defense', 'a1', 'Hausse tarifaire héros SKU +8%', 83, 2.8, 1.2, 'Faible', '1 mois', 0,
  '[{"criterionId":"price_increase","s":0.90,"d":0.10,"intensity":1.0,"contextRules":[{"factName":"material_cost","condition":"gt","threshold":15,"multiplier":1.2,"reason":"Hausse matières >15% renforce la légitimité d''une hausse tarifaire"}]},{"criterionId":"material_cost","s":0.10,"d":0.05,"intensity":0.4},{"criterionId":"volume_delta","s":0.20,"d":0.40,"intensity":0.9,"contextRules":[{"factName":"volume_delta","condition":"lt","threshold":-10,"multiplier":1.3,"reason":"Volumes déjà en recul amplifient le risque prix sur les volumes"}]}]'::jsonb,
  '[]'::jsonb, 0
),
(
  'margin-defense', 'a2', 'Mix upgrade ASP élevé', 77, 1.6, 0.8, 'Moyen', '3 mois', 0,
  '[{"criterionId":"price_increase","s":0.60,"d":0.05,"intensity":0.9},{"criterionId":"material_cost","s":0.10,"d":0.20,"intensity":0.6},{"criterionId":"volume_delta","s":0.55,"d":0.15,"intensity":1.0}]'::jsonb,
  '[]'::jsonb, 1
),
(
  'margin-defense', 'a3', 'Réduction discount 14%→8%', 72, 1.1, 0.5, 'Moyen', '2 mois', 0,
  '[{"criterionId":"price_increase","s":0.50,"d":0.05,"intensity":0.9,"contextRules":[{"factName":"price_increase","condition":"lt","threshold":5,"multiplier":1.2,"reason":"Faible marge de hausse prix rend la réduction discount plus efficace"}]},{"criterionId":"material_cost","s":0.05,"d":0.05,"intensity":0.3},{"criterionId":"volume_delta","s":0.30,"d":0.30,"intensity":0.7}]'::jsonb,
  '[]'::jsonb, 2
),
(
  'margin-defense', 'a4', 'Renégociation fournisseurs', 67, 0.8, 0.2, 'Élevé', '6 mois', 0,
  '[{"criterionId":"price_increase","s":0.10,"d":0.05,"intensity":0.3},{"criterionId":"material_cost","s":0.70,"d":0.15,"intensity":1.0,"contextRules":[{"factName":"material_cost","condition":"gt","threshold":20,"multiplier":1.3,"reason":"Coûts matières élevés renforcent le levier de renégociation"}]},{"criterionId":"volume_delta","s":0.10,"d":0.10,"intensity":0.4}]'::jsonb,
  '[{"factName":"material_cost","condition":"gt","threshold":8,"feasibilityPenalty":0.0,"reason":""},{"factName":"price_increase","condition":"lt","threshold":-5,"feasibilityPenalty":0.25,"reason":"Baisse prix vente simultanée réduit le pouvoir de renégociation"}]'::jsonb,
  3
)
ON CONFLICT (pack_slug, alt_id) DO NOTHING;

-- ── dso-recovery ──────────────────────────────────────────────────────────────

INSERT INTO public.sim_hypotheses (pack_slug, hyp_id, label, icon, unit, min_val, max_val, baseline, fact_name, sort_order) VALUES
  ('dso-recovery', 'dso_current',   'DSO actuel',            '📅', ' j',   30,  120, 45, 'dso_days',           0),
  ('dso-recovery', 'overdue_rate',  'Créances en retard',    '⚠️', ' k€',  0, 2000,  0, 'ar_overdue_90d_eur', 1),
  ('dso-recovery', 'recovery_rate', 'Taux de recouvrement',  '✅', '%',    50,  100, 80, 'cash_projection_j30', 2)
ON CONFLICT (pack_slug, hyp_id) DO NOTHING;

INSERT INTO public.sim_alternatives (pack_slug, alt_id, name, base_score, margin, cash12, risk, delay, influences, preconditions, sort_order) VALUES
(
  'dso-recovery', 'a1', 'Plan recouvrement 3 vagues', 85, 0.2, 1.8, 'Faible', '30 j', 0,
  '[{"criterionId":"dso_current","s":0.75,"d":0.05,"intensity":1.0,"contextRules":[{"factName":"dso_current","condition":"gt","threshold":60,"multiplier":1.3,"reason":"DSO >60j amplifie fortement l''impact d''un plan de recouvrement"}]},{"criterionId":"overdue_rate","s":0.85,"d":0.10,"intensity":1.0,"contextRules":[{"factName":"overdue_rate","condition":"gt","threshold":500,"multiplier":1.2,"reason":"Volume de créances en retard élevé renforce l''efficacité du plan"}]},{"criterionId":"recovery_rate","s":0.80,"d":0.05,"intensity":1.0}]'::jsonb,
  '[]'::jsonb, 0
),
(
  'dso-recovery', 'a2', 'Affacturage créances >60j', 76, -0.4, 1.2, 'Faible', '15 j', 0,
  '[{"criterionId":"dso_current","s":0.60,"d":0.10,"intensity":0.9},{"criterionId":"overdue_rate","s":0.70,"d":0.10,"intensity":1.0,"contextRules":[{"factName":"overdue_rate","condition":"gt","threshold":800,"multiplier":1.3,"reason":"Créances élevées rendent l''affacturage plus attractif"}]},{"criterionId":"recovery_rate","s":0.40,"d":0.30,"intensity":0.7}]'::jsonb,
  '[{"factName":"recovery_rate","condition":"gt","threshold":90,"feasibilityPenalty":0.2,"reason":"Taux recouvrement déjà excellent réduit l''intérêt de l''affacturage"}]'::jsonb,
  1
),
(
  'dso-recovery', 'a3', 'Supply Chain Finance BNP', 68, -0.3, 0.9, 'Moyen', '45 j', 0,
  '[{"criterionId":"dso_current","s":0.50,"d":0.15,"intensity":0.8},{"criterionId":"overdue_rate","s":0.40,"d":0.20,"intensity":0.7},{"criterionId":"recovery_rate","s":0.50,"d":0.15,"intensity":0.8}]'::jsonb,
  '[]'::jsonb, 2
),
(
  'dso-recovery', 'a4', 'Escompte 1% paiement 15j', 61, -0.5, 0.4, 'Faible', 'Immédiat', 0,
  '[{"criterionId":"dso_current","s":0.65,"d":0.05,"intensity":0.9},{"criterionId":"overdue_rate","s":0.30,"d":0.10,"intensity":0.6},{"criterionId":"recovery_rate","s":0.25,"d":0.50,"intensity":0.8,"contextRules":[{"factName":"recovery_rate","condition":"lt","threshold":65,"multiplier":1.3,"reason":"Taux recouvrement faible rend l''escompte plus nécessaire"}]}]'::jsonb,
  '[]'::jsonb, 3
)
ON CONFLICT (pack_slug, alt_id) DO NOTHING;

-- ── investment-prioritization ─────────────────────────────────────────────────

INSERT INTO public.sim_hypotheses (pack_slug, hyp_id, label, icon, unit, min_val, max_val, baseline, fact_name, sort_order) VALUES
  ('investment-prioritization', 'capex_budget',  'Budget CAPEX disponible', '💼', ' M€',   1, 30, 15, 'capex_budget_meur',         0),
  ('investment-prioritization', 'horizon',        'Horizon de retour',       '📆', ' mois', 12, 60, 24, 'investment_horizon_months', 1),
  ('investment-prioritization', 'risk_appetite',  'Tolérance au risque',     '🎯', '%',      0, 100, 50, 'min_supplier_risk_score',  2)
ON CONFLICT (pack_slug, hyp_id) DO NOTHING;

INSERT INTO public.sim_alternatives (pack_slug, alt_id, name, base_score, margin, cash12, risk, delay, influences, preconditions, sort_order) VALUES
(
  'investment-prioritization', 'a1', 'IA Service Client (4,5 M€)', 84, 1.2, 2.1, 'Moyen', '9 mois', 0,
  '[{"criterionId":"capex_budget","s":0.30,"d":0.60,"intensity":1.0,"contextRules":[{"factName":"capex_budget","condition":"lt","threshold":6,"multiplier":0.6,"reason":"Budget CAPEX insuffisant réduit la faisabilité de ce projet"}]},{"criterionId":"horizon","s":0.50,"d":0.30,"intensity":0.9},{"criterionId":"risk_appetite","s":0.70,"d":0.20,"intensity":1.0}]'::jsonb,
  '[{"factName":"capex_budget","condition":"gt","threshold":4,"feasibilityPenalty":0.35,"reason":"Budget disponible inférieur au coût du projet (4,5 M€)"}]'::jsonb,
  0
),
(
  'investment-prioritization', 'a2', 'Automatisation logistique', 78, 1.8, 3.2, 'Faible', '12 mois', 0,
  '[{"criterionId":"capex_budget","s":0.40,"d":0.55,"intensity":1.0,"contextRules":[{"factName":"capex_budget","condition":"lt","threshold":8,"multiplier":0.7,"reason":"Budget serré réduit l''impact opérationnel du projet logistique"}]},{"criterionId":"horizon","s":0.35,"d":0.40,"intensity":0.8,"contextRules":[{"factName":"horizon","condition":"lt","threshold":18,"multiplier":0.7,"reason":"Horizon court défavorise ce projet à ROI long terme"}]},{"criterionId":"risk_appetite","s":0.80,"d":0.10,"intensity":1.0}]'::jsonb,
  '[]'::jsonb, 1
),
(
  'investment-prioritization', 'a3', 'Modernisation ERP (5,8 M€)', 69, 0.9, -0.6, 'Élevé', '18 mois', 0,
  '[{"criterionId":"capex_budget","s":0.20,"d":0.80,"intensity":1.0,"contextRules":[{"factName":"capex_budget","condition":"lt","threshold":8,"multiplier":1.5,"reason":"Budget contraint aggrave fortement la pression sur ce projet lourd"}]},{"criterionId":"horizon","s":0.20,"d":0.70,"intensity":1.0},{"criterionId":"risk_appetite","s":0.40,"d":0.50,"intensity":0.9}]'::jsonb,
  '[{"factName":"capex_budget","condition":"gt","threshold":5,"feasibilityPenalty":0.40,"reason":"Budget disponible inférieur au coût du projet (5,8 M€)"},{"factName":"horizon","condition":"gt","threshold":24,"feasibilityPenalty":0.20,"reason":"Horizon retour trop court pour un ERP (18 mois de déploiement)"}]'::jsonb,
  2
),
(
  'investment-prioritization', 'a4', 'Ne pas investir', 22, -0.4, 0.4, 'Faible', '—', 0,
  '[{"criterionId":"capex_budget","s":0.90,"d":0.05,"intensity":1.0},{"criterionId":"horizon","s":0.80,"d":0.05,"intensity":1.0},{"criterionId":"risk_appetite","s":0.10,"d":0.85,"intensity":1.0,"contextRules":[{"factName":"risk_appetite","condition":"gt","threshold":60,"multiplier":1.4,"reason":"Appétit risque élevé rend le statu quo encore moins attractif"}]}]'::jsonb,
  '[]'::jsonb, 3
)
ON CONFLICT (pack_slug, alt_id) DO NOTHING;

-- ── pricing-strategy ──────────────────────────────────────────────────────────

INSERT INTO public.sim_hypotheses (pack_slug, hyp_id, label, icon, unit, min_val, max_val, baseline, fact_name, sort_order) VALUES
  ('pricing-strategy', 'price_hike',    'Hausse prix ciblée',     '📊', '%',  0,  20, 8,  'avg_absenteeism_rate',    0),
  ('pricing-strategy', 'premium_share', 'Part segment premium',   '⭐', '%',  10, 60, 35, 'dso_days',                1),
  ('pricing-strategy', 'discount_rate', 'Taux de remise réseau',  '🏷️','%',  0,  30, 14, 'min_supplier_risk_score', 2)
ON CONFLICT (pack_slug, hyp_id) DO NOTHING;

INSERT INTO public.sim_alternatives (pack_slug, alt_id, name, base_score, margin, cash12, risk, delay, influences, preconditions, sort_order) VALUES
(
  'pricing-strategy', 'a1', 'Hausse ciblée + différenciation', 80, 2.1, 0.8, 'Faible', '1 mois', 0,
  '[{"criterionId":"price_hike","s":0.85,"d":0.10,"intensity":1.0,"contextRules":[{"factName":"discount_rate","condition":"gt","threshold":12,"multiplier":1.2,"reason":"Discount élevé actuel donne plus de marge pour une hausse ciblée"}]},{"criterionId":"premium_share","s":0.70,"d":0.10,"intensity":1.0},{"criterionId":"discount_rate","s":0.20,"d":0.60,"intensity":0.9}]'::jsonb,
  '[]'::jsonb, 0
),
(
  'pricing-strategy', 'a2', 'Bundle valeur capsule', 73, 1.3, 0.5, 'Moyen', '2 mois', 0,
  '[{"criterionId":"price_hike","s":0.40,"d":0.10,"intensity":0.8},{"criterionId":"premium_share","s":0.80,"d":0.10,"intensity":1.0,"contextRules":[{"factName":"premium_share","condition":"lt","threshold":25,"multiplier":1.3,"reason":"Part premium faible renforce l''intérêt d''une stratégie bundle"}]},{"criterionId":"discount_rate","s":0.30,"d":0.30,"intensity":0.7}]'::jsonb,
  '[]'::jsonb, 1
),
(
  'pricing-strategy', 'a3', 'Promo chirurgicale saison basse', 68, 0.7, 0.3, 'Faible', 'Immédiat', 0,
  '[{"criterionId":"price_hike","s":0.10,"d":0.50,"intensity":0.9},{"criterionId":"premium_share","s":0.20,"d":0.40,"intensity":0.7},{"criterionId":"discount_rate","s":0.75,"d":0.10,"intensity":1.0,"contextRules":[{"factName":"discount_rate","condition":"gt","threshold":18,"multiplier":0.8,"reason":"Discount déjà très élevé réduit l''effet d''une promo supplémentaire"}]}]'::jsonb,
  '[]'::jsonb, 2
),
(
  'pricing-strategy', 'a4', 'Maintien prix + mix premium', 65, 0.5, 0.1, 'Faible', '—', 0,
  '[{"criterionId":"price_hike","s":0.05,"d":0.05,"intensity":0.2},{"criterionId":"premium_share","s":0.60,"d":0.20,"intensity":1.0,"contextRules":[{"factName":"premium_share","condition":"gt","threshold":45,"multiplier":0.7,"reason":"Segment premium déjà dominant réduit le gain marginal"}]},{"criterionId":"discount_rate","s":0.10,"d":0.10,"intensity":0.3}]'::jsonb,
  '[]'::jsonb, 3
)
ON CONFLICT (pack_slug, alt_id) DO NOTHING;

-- ── Ensure decision_packs slugs exist for all sim models ──────────────────────

INSERT INTO public.decision_packs (slug, title, category, description, is_published) VALUES
  ('supplier-resilience',      'Résilience fournisseurs',         'supply',   'Gestion des risques fournisseurs et des coûts d''approvisionnement.',  true),
  ('margin-defense',           'Défense des marges',              'finance',  'Maintien et optimisation des marges face aux pressions de coûts.',    true),
  ('dso-recovery',             'Recouvrement créances',           'finance',  'Réduction du DSO et optimisation du cycle de recouvrement client.',   true),
  ('investment-prioritization','Priorisation des investissements','strategy', 'Arbitrage entre projets d''investissement sur un horizon 12-36 mois.',true),
  ('pricing-strategy',         'Stratégie tarifaire',             'commerce', 'Optimisation du pricing mix entre segments et canaux de distribution.',true)
ON CONFLICT (slug) DO UPDATE SET
  title       = EXCLUDED.title,
  category    = EXCLUDED.category,
  description = EXCLUDED.description,
  is_published = true;
