
-- 1) Backfill facts to Lumen mission
UPDATE public.facts SET mission_id = '11111111-1111-1111-1111-111111111111' WHERE mission_id IS NULL;

-- 2) Tighten is_mission_member: remove NULL bypass
CREATE OR REPLACE FUNCTION public.is_mission_member(_mission_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _mission_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'comex')
      OR EXISTS (SELECT 1 FROM public.missions m WHERE m.id = _mission_id AND m.owner_id = auth.uid())
    )
$$;

-- 3) argus_schemas — restrict SELECT to mission members
DROP POLICY IF EXISTS argus_schemas_read ON public.argus_schemas;
CREATE POLICY argus_schemas_read ON public.argus_schemas FOR SELECT TO authenticated
  USING (public.is_mission_member(mission_id));

-- 4) argus_field_samples — restrict via parent argus_schemas mission
DROP POLICY IF EXISTS argus_field_samples_read ON public.argus_field_samples;
CREATE POLICY argus_field_samples_read ON public.argus_field_samples FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.argus_schemas s
    WHERE s.id = argus_field_samples.schema_id AND public.is_mission_member(s.mission_id)
  ));

-- 5) argus_external_probes — add mission_id, restrict to mission members
ALTER TABLE public.argus_external_probes ADD COLUMN IF NOT EXISTS mission_id uuid;
UPDATE public.argus_external_probes SET mission_id = '11111111-1111-1111-1111-111111111111' WHERE mission_id IS NULL;
DROP POLICY IF EXISTS argus_external_probes_read ON public.argus_external_probes;
DROP POLICY IF EXISTS aep_read ON public.argus_external_probes;
DROP POLICY IF EXISTS "aep read" ON public.argus_external_probes;
CREATE POLICY argus_external_probes_read ON public.argus_external_probes FOR SELECT TO authenticated
  USING (public.is_mission_member(mission_id));

-- 6) business_capabilities — restrict to mission members
DROP POLICY IF EXISTS business_capabilities_read ON public.business_capabilities;
DROP POLICY IF EXISTS bc_read ON public.business_capabilities;
DROP POLICY IF EXISTS "bc read" ON public.business_capabilities;
CREATE POLICY business_capabilities_read ON public.business_capabilities FOR SELECT TO authenticated
  USING (public.is_mission_member(mission_id));

-- 7) project sub-tables — restrict to mission members via projects
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_comments','project_votes','project_risks','project_milestones','project_dependencies','project_pack_impacts','project_application_impacts','project_capability_impacts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON public.%I', t, t);
    EXECUTE format($f$DROP POLICY IF EXISTS "%s read" ON public.%I$f$, t, t);
    EXECUTE format($f$CREATE POLICY %I_read ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = %I.project_id AND public.is_mission_member(p.mission_id)))$f$, t, t, t);
  END LOOP;
END $$;

-- 8) rule_interview_links — restrict via mission_interviews
DROP POLICY IF EXISTS rule_interview_links_read ON public.rule_interview_links;
DROP POLICY IF EXISTS ril_read ON public.rule_interview_links;
DROP POLICY IF EXISTS "ril read" ON public.rule_interview_links;
CREATE POLICY rule_interview_links_read ON public.rule_interview_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mission_interviews mi
    WHERE mi.id = rule_interview_links.interview_id AND public.is_mission_member(mi.mission_id)
  ));

-- 9) stakeholder_decision_roles — restrict to admin/comex
DROP POLICY IF EXISTS "sdr r" ON public.stakeholder_decision_roles;
DROP POLICY IF EXISTS sdr_read ON public.stakeholder_decision_roles;
CREATE POLICY stakeholder_decision_roles_read ON public.stakeholder_decision_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

-- 10) signal_engine_runs + rule_decision_links admin-write policies target authenticated
DROP POLICY IF EXISTS engine_runs_admin_write ON public.signal_engine_runs;
CREATE POLICY engine_runs_admin_write ON public.signal_engine_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "rdl admin" ON public.rule_decision_links;
DROP POLICY IF EXISTS rdl_admin ON public.rule_decision_links;
CREATE POLICY rdl_admin ON public.rule_decision_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 11) Revoke EXECUTE on SECURITY DEFINER helpers from anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_mission_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_confidential(uuid, public.confidentiality_level) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_mission_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_confidential(uuid, public.confidentiality_level) TO authenticated, service_role;
