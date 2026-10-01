ALTER TABLE public.decision_scenarios ADD COLUMN IF NOT EXISTS published_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_decision_scenarios_published ON public.decision_scenarios (pack_id, published_at DESC);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='source_systems_slug_key') THEN
    EXECUTE 'CREATE UNIQUE INDEX source_systems_slug_key ON public.source_systems (slug) WHERE slug IS NOT NULL';
  END IF;
END $$;