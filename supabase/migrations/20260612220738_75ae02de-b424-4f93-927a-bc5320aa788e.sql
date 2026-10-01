
-- 1. Extend facts table to become a true Fact Graph
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS object_id uuid REFERENCES public.semantic_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribute_id uuid REFERENCES public.semantic_attributes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_key text,
  ADD COLUMN IF NOT EXISTS value_jsonb jsonb,
  ADD COLUMN IF NOT EXISTS source_app text,
  ADD COLUMN IF NOT EXISTS extraction_contract_id uuid REFERENCES public.extraction_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stale_at timestamptz,
  ADD COLUMN IF NOT EXISTS attribute_name text;

CREATE INDEX IF NOT EXISTS facts_entity_attr_idx
  ON public.facts(entity_key, attribute_id);
CREATE INDEX IF NOT EXISTS facts_object_idx
  ON public.facts(object_id);

-- 2. Extend signals table to support traceable rule-based signals
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS signal_type text,
  ADD COLUMN IF NOT EXISTS entity_key text,
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.decision_packs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_contract_id uuid REFERENCES public.decision_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_fact_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rule_key text,
  ADD COLUMN IF NOT EXISTS evaluated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS signals_type_entity_idx
  ON public.signals(signal_type, entity_key);

-- 3. Signal rules registry (declarative rules used by the engine)
CREATE TABLE IF NOT EXISTS public.signal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  signal_type text NOT NULL,
  pack_slug text,
  title text NOT NULL,
  description text,
  severity_default text NOT NULL DEFAULT 'medium',
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.signal_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_rules TO authenticated;
GRANT ALL ON public.signal_rules TO service_role;

ALTER TABLE public.signal_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signal_rules_read_all" ON public.signal_rules
  FOR SELECT USING (true);
CREATE POLICY "signal_rules_admin_write" ON public.signal_rules
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_signal_rules_touch
  BEFORE UPDATE ON public.signal_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Engine runs log (traceability)
CREATE TABLE IF NOT EXISTS public.signal_engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rules_evaluated int NOT NULL DEFAULT 0,
  signals_emitted int NOT NULL DEFAULT 0,
  facts_considered int NOT NULL DEFAULT 0,
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signal_engine_runs TO authenticated;
GRANT ALL ON public.signal_engine_runs TO service_role;

ALTER TABLE public.signal_engine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engine_runs_read_auth" ON public.signal_engine_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "engine_runs_admin_write" ON public.signal_engine_runs
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. Seed declarative rules (Stockout / Supplier / Margin / Cash) for Maison Lumen
INSERT INTO public.signal_rules (rule_key, signal_type, pack_slug, title, description, severity_default, config)
VALUES
  ('stockout.basic', 'StockoutRisk', 'supply',
    'Rupture probable',
    'Si jours_de_stock = stock / vélocité_jour < seuil ET un PO ouvert n''arrive pas à temps.',
    'high',
    '{"days_cover_threshold": 7, "lead_time_days_attr": "supplier_delay_days"}'::jsonb),
  ('supplier.delay', 'SupplierRisk', 'supply',
    'Fournisseur en dérive',
    'Si délai moyen fournisseur dépasse le seuil contractuel.',
    'high',
    '{"max_delay_days": 7}'::jsonb),
  ('margin.drop', 'MarginRisk', 'pricing',
    'Érosion de marge',
    'Si la marge réelle est inférieure à la marge cible de plus de X points.',
    'critical',
    '{"min_gap_points": 1.5}'::jsonb),
  ('cash.runway', 'CashRisk', 'business-case',
    'Tension de trésorerie',
    'Si runway prévisionnel < seuil mois.',
    'high',
    '{"min_runway_months": 6}'::jsonb)
ON CONFLICT (rule_key) DO NOTHING;
