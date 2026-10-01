ALTER TABLE public.ia_readiness_dimensions
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS target_score integer,
  ADD COLUMN IF NOT EXISTS priority text;