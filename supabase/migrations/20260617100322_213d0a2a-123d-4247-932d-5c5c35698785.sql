ALTER TABLE public.decision_packs
  ADD COLUMN IF NOT EXISTS decision_options jsonb NOT NULL DEFAULT '[]'::jsonb;