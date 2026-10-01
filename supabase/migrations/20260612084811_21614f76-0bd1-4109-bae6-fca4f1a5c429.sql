
-- 1. Project typology (digital, industriel, M&A, RH, immobilier, R&D, ESG, autre)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'digital';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS non_digital_metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Scenario analysis attached to decisions (already exists as conversational packs)
CREATE TABLE IF NOT EXISTS public.decision_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  title text NOT NULL,
  question text NOT NULL,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_scenarios TO authenticated;
GRANT ALL ON public.decision_scenarios TO service_role;
ALTER TABLE public.decision_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scenarios" ON public.decision_scenarios FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER decision_scenarios_touch BEFORE UPDATE ON public.decision_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
