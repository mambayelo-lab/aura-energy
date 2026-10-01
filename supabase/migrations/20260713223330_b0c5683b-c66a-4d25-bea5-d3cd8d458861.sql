
-- 1) source_systems: hide secret columns from authenticated (service_role keeps ALL)
REVOKE SELECT (client_id, client_secret, token_url) ON public.source_systems FROM authenticated;
REVOKE INSERT (client_id, client_secret, token_url) ON public.source_systems FROM authenticated;
REVOKE UPDATE (client_id, client_secret, token_url) ON public.source_systems FROM authenticated;

-- 2) extraction_contracts: restrict SELECT to admins only
DROP POLICY IF EXISTS "extraction_contracts read scoped" ON public.extraction_contracts;
CREATE POLICY "extraction_contracts read admin"
  ON public.extraction_contracts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) project_* write policies: add mission membership scoping
DROP POLICY IF EXISTS "admin write pd" ON public.project_dependencies;
CREATE POLICY "admin write pd" ON public.project_dependencies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_dependencies.project_id AND is_mission_member(p.mission_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_dependencies.project_id AND is_mission_member(p.mission_id)));

DROP POLICY IF EXISTS "admin write pr" ON public.project_risks;
CREATE POLICY "admin write pr" ON public.project_risks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_risks.project_id AND is_mission_member(p.mission_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_risks.project_id AND is_mission_member(p.mission_id)));

DROP POLICY IF EXISTS "admin write pm" ON public.project_milestones;
CREATE POLICY "admin write pm" ON public.project_milestones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_milestones.project_id AND is_mission_member(p.mission_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_milestones.project_id AND is_mission_member(p.mission_id)));

DROP POLICY IF EXISTS "admin write pai" ON public.project_application_impacts;
CREATE POLICY "admin write pai" ON public.project_application_impacts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_application_impacts.project_id AND is_mission_member(p.mission_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_application_impacts.project_id AND is_mission_member(p.mission_id)));

DROP POLICY IF EXISTS "admin write pci" ON public.project_capability_impacts;
CREATE POLICY "admin write pci" ON public.project_capability_impacts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_capability_impacts.project_id AND is_mission_member(p.mission_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_capability_impacts.project_id AND is_mission_member(p.mission_id)));

DROP POLICY IF EXISTS "admin write ppi" ON public.project_pack_impacts;
CREATE POLICY "admin write ppi" ON public.project_pack_impacts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_pack_impacts.project_id AND is_mission_member(p.mission_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_pack_impacts.project_id AND is_mission_member(p.mission_id)));

-- 4) Recreate public-role read policies as authenticated-only
DROP POLICY IF EXISTS "ce r" ON public.crisis_events;
CREATE POLICY "ce r" ON public.crisis_events FOR SELECT TO authenticated
  USING (can_access_confidential(auth.uid(), confidentiality) AND is_mission_member(mission_id));

DROP POLICY IF EXISTS "fb r" ON public.field_briefs;
CREATE POLICY "fb r" ON public.field_briefs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role));

DROP POLICY IF EXISTS "ok r" ON public.okrs;
CREATE POLICY "ok r" ON public.okrs FOR SELECT TO authenticated
  USING (can_access_confidential(auth.uid(), confidentiality) AND is_mission_member(mission_id));

DROP POLICY IF EXISTS "td r" ON public.talent_decisions;
CREATE POLICY "td r" ON public.talent_decisions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'rh'::app_role) AND is_mission_member(mission_id)));

DROP POLICY IF EXISTS "tp r" ON public.talent_profiles;
CREATE POLICY "tp r" ON public.talent_profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'rh'::app_role) AND is_mission_member(mission_id)));
