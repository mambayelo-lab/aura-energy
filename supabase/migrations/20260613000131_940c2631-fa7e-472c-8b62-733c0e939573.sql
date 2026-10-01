
-- Add phase to missions
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'cadrage';

-- Interview templates (question bank per role/sector)
CREATE TABLE IF NOT EXISTS public.interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'cadrage', -- cadrage | standardisation
  sector TEXT,
  role_target TEXT NOT NULL,
  duration_min INT DEFAULT 60,
  description TEXT,
  question_bank JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{section:"...", questions:["..."]}]
  expected_outputs JSONB DEFAULT '[]'::jsonb,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_templates TO authenticated;
GRANT ALL ON public.interview_templates TO service_role;
ALTER TABLE public.interview_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmpl_itw_read" ON public.interview_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tmpl_itw_admin_write" ON public.interview_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tmpl_itw_touch BEFORE UPDATE ON public.interview_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Section templates (pre-filled report sections per phase)
CREATE TABLE IF NOT EXISTS public.section_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'cadrage',
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.section_templates TO authenticated;
GRANT ALL ON public.section_templates TO service_role;
ALTER TABLE public.section_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmpl_sec_read" ON public.section_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tmpl_sec_admin_write" ON public.section_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tmpl_sec_touch BEFORE UPDATE ON public.section_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pack of standardization deliverables (suggestions to seed semantic objects/attributes)
CREATE TABLE IF NOT EXISTS public.standardization_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  decision_pack_target TEXT,
  description TEXT,
  semantic_objects JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{code,label,attributes:[{code,label,unit,role}]}]
  source_hints JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{system_type,attribute,sample_field}]
  signal_rules JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{code,title,formula,threshold}]
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.standardization_templates TO authenticated;
GRANT ALL ON public.standardization_templates TO service_role;
ALTER TABLE public.standardization_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmpl_std_read" ON public.standardization_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tmpl_std_admin_write" ON public.standardization_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tmpl_std_touch BEFORE UPDATE ON public.standardization_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
