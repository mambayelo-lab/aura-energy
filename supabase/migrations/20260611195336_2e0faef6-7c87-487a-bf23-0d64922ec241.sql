
-- ========== ARGUS APPLICATIONS ==========
CREATE TABLE public.argus_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  vendor TEXT,
  layer TEXT NOT NULL, -- 'core'|'data'|'integration'|'edge'
  category TEXT, -- ERP, POS, CRM, PIM, OMS, WMS, BI, TMS, SRM, e-commerce, S&OP
  criticality TEXT NOT NULL DEFAULT 'medium', -- low|medium|high|critical
  has_api BOOLEAN DEFAULT true,
  score INT, -- 0-100 readiness IA
  owner TEXT,
  notes TEXT,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mission_id, slug)
);
GRANT SELECT ON public.argus_applications TO anon, authenticated;
GRANT ALL ON public.argus_applications TO service_role;
ALTER TABLE public.argus_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "argus_apps_read_all" ON public.argus_applications FOR SELECT USING (true);
CREATE POLICY "argus_apps_admin_write" ON public.argus_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_argus_apps_updated BEFORE UPDATE ON public.argus_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== ARGUS FLOWS ==========
CREATE TABLE public.argus_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  source_app_id UUID REFERENCES public.argus_applications(id) ON DELETE CASCADE,
  target_app_id UUID REFERENCES public.argus_applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  flow_type TEXT, -- 'api'|'sftp'|'excel'|'manual'|'event'|'etl'
  frequency TEXT, -- 'realtime'|'hourly'|'daily'|'weekly'|'monthly'|'on-demand'
  format TEXT, -- 'json'|'csv'|'xml'|'idoc'|...
  volume TEXT,
  quality_score INT, -- 0-100
  notes TEXT,
  detected_by TEXT, -- 'interview'|'api-scan'|'lineage-auto'|'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.argus_flows TO anon, authenticated;
GRANT ALL ON public.argus_flows TO service_role;
ALTER TABLE public.argus_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "argus_flows_read_all" ON public.argus_flows FOR SELECT USING (true);
CREATE POLICY "argus_flows_admin_write" ON public.argus_flows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_argus_flows_updated BEFORE UPDATE ON public.argus_flows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== MISSION INTERVIEWS ==========
CREATE TABLE public.mission_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  interviewee_name TEXT NOT NULL,
  interviewee_role TEXT NOT NULL,
  interviewee_department TEXT,
  interview_date DATE,
  duration_min INT,
  channel TEXT, -- 'visio'|'onsite'|'phone'
  summary TEXT,
  transcript TEXT,
  key_verbatims JSONB DEFAULT '[]'::jsonb,
  pain_points JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  apps_mentioned TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mission_interviews TO anon, authenticated;
GRANT ALL ON public.mission_interviews TO service_role;
ALTER TABLE public.mission_interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interviews_read_all" ON public.mission_interviews FOR SELECT USING (true);
CREATE POLICY "interviews_admin_write" ON public.mission_interviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON public.mission_interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== IA READINESS DIMENSIONS ==========
CREATE TABLE public.ia_readiness_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  dimension TEXT NOT NULL, -- 'strategy'|'data'|'tech'|'people'|'governance'|'use_cases'|'ethics'|'operations'
  label TEXT NOT NULL,
  score INT NOT NULL, -- 0-100
  maturity_level TEXT, -- 'initial'|'managed'|'defined'|'advanced'|'leader'
  observations TEXT,
  evidences JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  ord INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mission_id, dimension)
);
GRANT SELECT ON public.ia_readiness_dimensions TO anon, authenticated;
GRANT ALL ON public.ia_readiness_dimensions TO service_role;
ALTER TABLE public.ia_readiness_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iar_dim_read_all" ON public.ia_readiness_dimensions FOR SELECT USING (true);
CREATE POLICY "iar_dim_admin_write" ON public.ia_readiness_dimensions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_iar_dim_updated BEFORE UPDATE ON public.ia_readiness_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== IA READINESS ROADMAP ==========
CREATE TABLE public.ia_readiness_roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  wave INT NOT NULL, -- 1, 2, 3
  title TEXT NOT NULL,
  description TEXT,
  start_month INT, -- 1..12
  duration_months INT,
  effort TEXT, -- 'S'|'M'|'L'|'XL'
  expected_gains TEXT,
  dependencies TEXT[] DEFAULT '{}',
  kpis JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'planned',
  ord INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ia_readiness_roadmap TO anon, authenticated;
GRANT ALL ON public.ia_readiness_roadmap TO service_role;
ALTER TABLE public.ia_readiness_roadmap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iar_road_read_all" ON public.ia_readiness_roadmap FOR SELECT USING (true);
CREATE POLICY "iar_road_admin_write" ON public.ia_readiness_roadmap FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_iar_road_updated BEFORE UPDATE ON public.ia_readiness_roadmap
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== CAUSAL RULES ==========
CREATE TABLE public.causal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  sector TEXT NOT NULL DEFAULT 'retail',
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'measurable', -- measurable|narrative
  domain TEXT NOT NULL, -- supply, sales, customer, finance, operations, hr, marketing
  cause_object TEXT,
  cause_attribute TEXT,
  operator TEXT,
  threshold TEXT,
  effect_object TEXT,
  effect_attribute TEXT,
  direction TEXT, -- increase|decrease|change
  source TEXT, -- external study or 'interview'
  confidence NUMERIC(3,2) DEFAULT 0.80,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.causal_rules TO anon, authenticated;
GRANT ALL ON public.causal_rules TO service_role;
ALTER TABLE public.causal_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_read_all" ON public.causal_rules FOR SELECT USING (true);
CREATE POLICY "rules_admin_write" ON public.causal_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rules_updated BEFORE UPDATE ON public.causal_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== RULE <-> INTERVIEW LINK (traceability) ==========
CREATE TABLE public.rule_interview_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.causal_rules(id) ON DELETE CASCADE NOT NULL,
  interview_id UUID REFERENCES public.mission_interviews(id) ON DELETE CASCADE NOT NULL,
  quote TEXT, -- verbatim that supports the rule
  weight NUMERIC(3,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id, interview_id)
);
GRANT SELECT ON public.rule_interview_links TO anon, authenticated;
GRANT ALL ON public.rule_interview_links TO service_role;
ALTER TABLE public.rule_interview_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rule_int_read_all" ON public.rule_interview_links FOR SELECT USING (true);
CREATE POLICY "rule_int_admin_write" ON public.rule_interview_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_argus_apps_mission ON public.argus_applications(mission_id);
CREATE INDEX idx_argus_flows_mission ON public.argus_flows(mission_id);
CREATE INDEX idx_interviews_mission ON public.mission_interviews(mission_id);
CREATE INDEX idx_iar_dim_mission ON public.ia_readiness_dimensions(mission_id);
CREATE INDEX idx_iar_road_mission ON public.ia_readiness_roadmap(mission_id);
CREATE INDEX idx_rules_domain ON public.causal_rules(domain);
CREATE INDEX idx_rule_links_rule ON public.rule_interview_links(rule_id);
