
-- =========== PROJECTS =============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sponsor text,
  owner_role text,
  category text,
  phase text NOT NULL DEFAULT 'idea',
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  budget_eur numeric,
  expected_roi_eur numeric,
  value_score int CHECK (value_score BETWEEN 1 AND 5),
  effort_score int CHECK (effort_score BETWEEN 1 AND 5),
  strategic_alignment text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write projects" ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== CAPABILITY IMPACTS =============
CREATE TABLE public.project_capability_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.pack_capabilities(id) ON DELETE CASCADE,
  impact_type text NOT NULL DEFAULT 'improves',
  impact_level int NOT NULL DEFAULT 3 CHECK (impact_level BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, capability_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_capability_impacts TO authenticated;
GRANT ALL ON public.project_capability_impacts TO service_role;
ALTER TABLE public.project_capability_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pci" ON public.project_capability_impacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pci" ON public.project_capability_impacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== APPLICATION IMPACTS =============
CREATE TABLE public.project_application_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.argus_applications(id) ON DELETE CASCADE,
  impact_type text NOT NULL DEFAULT 'improves',
  impact_level int NOT NULL DEFAULT 3 CHECK (impact_level BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, application_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_application_impacts TO authenticated;
GRANT ALL ON public.project_application_impacts TO service_role;
ALTER TABLE public.project_application_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pai" ON public.project_application_impacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pai" ON public.project_application_impacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== PACK / DECISION IMPACTS =============
CREATE TABLE public.project_pack_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  decision_lift int NOT NULL DEFAULT 0,
  confidence_lift numeric NOT NULL DEFAULT 0,
  business_value_eur numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, pack_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_pack_impacts TO authenticated;
GRANT ALL ON public.project_pack_impacts TO service_role;
ALTER TABLE public.project_pack_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ppi" ON public.project_pack_impacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write ppi" ON public.project_pack_impacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== MILESTONES =============
CREATE TABLE public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'planned',
  position int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT ALL ON public.project_milestones TO service_role;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pm" ON public.project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pm" ON public.project_milestones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== RISKS =============
CREATE TABLE public.project_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  severity int NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),
  likelihood int NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  mitigation text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_risks TO authenticated;
GRANT ALL ON public.project_risks TO service_role;
ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pr" ON public.project_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pr" ON public.project_risks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== DEPENDENCIES =============
CREATE TABLE public.project_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  depends_on_project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dep_type text NOT NULL DEFAULT 'blocks',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, depends_on_project_id),
  CHECK (project_id <> depends_on_project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_dependencies TO authenticated;
GRANT ALL ON public.project_dependencies TO service_role;
ALTER TABLE public.project_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pd" ON public.project_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pd" ON public.project_dependencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========== VOTES =============
CREATE TABLE public.project_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  support int NOT NULL DEFAULT 1 CHECK (support BETWEEN -1 AND 1),
  priority int NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_votes TO authenticated;
GRANT ALL ON public.project_votes TO service_role;
ALTER TABLE public.project_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read votes" ON public.project_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own write votes" ON public.project_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER project_votes_touch BEFORE UPDATE ON public.project_votes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== COMMENTS =============
CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read comments" ON public.project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "own write comments" ON public.project_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete comments" ON public.project_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- =========== AGGREGATED VIEW =============
CREATE OR REPLACE VIEW public.project_portfolio_summary AS
SELECT
  p.id,
  p.mission_id,
  p.slug,
  p.name,
  p.phase,
  p.status,
  p.value_score,
  p.effort_score,
  p.budget_eur,
  p.expected_roi_eur,
  COALESCE((SELECT count(*) FROM public.project_capability_impacts x WHERE x.project_id = p.id), 0) AS capabilities_count,
  COALESCE((SELECT count(*) FROM public.project_application_impacts x WHERE x.project_id = p.id), 0) AS applications_count,
  COALESCE((SELECT count(*) FROM public.project_pack_impacts x WHERE x.project_id = p.id), 0) AS packs_count,
  COALESCE((SELECT sum(decision_lift) FROM public.project_pack_impacts x WHERE x.project_id = p.id), 0) AS total_decision_lift,
  COALESCE((SELECT avg(support)::numeric(10,2) FROM public.project_votes v WHERE v.project_id = p.id), 0) AS avg_support,
  COALESCE((SELECT avg(priority)::numeric(10,2) FROM public.project_votes v WHERE v.project_id = p.id), 0) AS avg_priority
FROM public.projects p;
GRANT SELECT ON public.project_portfolio_summary TO authenticated;
