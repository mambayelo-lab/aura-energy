
-- 1) Replace permissive public-read SELECT policies with authenticated-only
DO $$
DECLARE
  r record;
  tables text[] := ARRAY[
    'argus_applications','argus_flows','causal_rules','ia_readiness_dimensions',
    'ia_readiness_roadmap','information_assets','mission_interviews','missions',
    'mission_sections','rule_interview_links','signals','source_mappings',
    'source_systems','facts','rule_decision_links','report_shares'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN
      SELECT polname FROM pg_policy
      WHERE polrelid = ('public.'||t)::regclass
        AND polcmd = 'r'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, t);
    END LOOP;
    -- Revoke anon SELECT grants where applicable
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Recreate SELECT policies scoped to authenticated
CREATE POLICY "auth read" ON public.argus_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.argus_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.causal_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.ia_readiness_dimensions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.ia_readiness_roadmap FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.information_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.mission_interviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.missions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.mission_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.rule_interview_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.source_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.source_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.facts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read" ON public.rule_decision_links FOR SELECT TO authenticated USING (true);

-- report_shares: only admins; public token lookup uses supabaseAdmin via server fn (RLS bypassed)
CREATE POLICY "admins read shares" ON public.report_shares FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) decision_outcomes: scope SELECT to owner or admin
DROP POLICY IF EXISTS "do r" ON public.decision_outcomes;
CREATE POLICY "do r" ON public.decision_outcomes FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3) Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_confidential(uuid, confidentiality_level) FROM PUBLIC, anon;
-- has_role and can_access_confidential remain callable by authenticated for RLS-side use
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_confidential(uuid, confidentiality_level) TO authenticated;
