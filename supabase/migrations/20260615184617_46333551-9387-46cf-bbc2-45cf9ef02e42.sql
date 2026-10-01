
-- Remove overly-permissive policies and tighten access

-- argus_external_probes
DROP POLICY IF EXISTS "probes read" ON public.argus_external_probes;

-- business_capabilities
DROP POLICY IF EXISTS "auth read caps" ON public.business_capabilities;

-- project sub-tables: drop open read
DROP POLICY IF EXISTS "auth read comments" ON public.project_comments;
DROP POLICY IF EXISTS "auth read pr" ON public.project_risks;
DROP POLICY IF EXISTS "auth read pm" ON public.project_milestones;
DROP POLICY IF EXISTS "auth read pd" ON public.project_dependencies;
DROP POLICY IF EXISTS "auth read pci" ON public.project_capability_impacts;
DROP POLICY IF EXISTS "auth read pai" ON public.project_application_impacts;
DROP POLICY IF EXISTS "auth read ppi" ON public.project_pack_impacts;
DROP POLICY IF EXISTS "auth read votes" ON public.project_votes;

-- decision_recommendation_actions: change role to authenticated
DROP POLICY IF EXISTS "users_own_act" ON public.decision_recommendation_actions;
CREATE POLICY "users_own_act" ON public.decision_recommendation_actions
  FOR ALL TO authenticated
  USING (committed_by = auth.uid())
  WITH CHECK (committed_by = auth.uid());

-- decision_recommendations: restrict writes to admin
DROP POLICY IF EXISTS "auth_write_recs" ON public.decision_recommendations;
CREATE POLICY "admin_write_recs" ON public.decision_recommendations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- recommendation_effects: restrict writes to admin
DROP POLICY IF EXISTS "auth_write_fx" ON public.recommendation_effects;
CREATE POLICY "admin_write_fx" ON public.recommendation_effects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- signal_engine_runs: replace open read with mission-scoped
DROP POLICY IF EXISTS "engine_runs_read_auth" ON public.signal_engine_runs;
CREATE POLICY "engine_runs_read" ON public.signal_engine_runs
  FOR SELECT TO authenticated
  USING (is_mission_member(mission_id));

-- Fix function search_path
CREATE OR REPLACE FUNCTION public.update_dra_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;
