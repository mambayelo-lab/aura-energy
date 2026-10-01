
-- source_systems: scope reads and writes to mission members / admins
DROP POLICY IF EXISTS "ss admin" ON public.source_systems;
DROP POLICY IF EXISTS "ss read admin only" ON public.source_systems;

CREATE POLICY "source_systems read mission" ON public.source_systems
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_mission_member(mission_id));

CREATE POLICY "source_systems write mission admin" ON public.source_systems
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_mission_member(mission_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_mission_member(mission_id));

-- argus_mapping_proposals: scope reads to mission members of the parent schema
DROP POLICY IF EXISTS "argus_mapping_proposals read auth" ON public.argus_mapping_proposals;

CREATE POLICY "argus_mapping_proposals read mission" ON public.argus_mapping_proposals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.argus_schemas s
      WHERE s.id = argus_mapping_proposals.schema_id
        AND is_mission_member(s.mission_id)
    )
  );

-- capability_chart_configs: split permissive ALL policy into open read + admin write
DROP POLICY IF EXISTS "auth_all_chart_configs" ON public.capability_chart_configs;

CREATE POLICY "capability_chart_configs read auth" ON public.capability_chart_configs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "capability_chart_configs write admin" ON public.capability_chart_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- decision_contracts: restrict reads to admins or the owner of the linked decision
DROP POLICY IF EXISTS "Read decision contracts (authenticated)" ON public.decision_contracts;

CREATE POLICY "decision_contracts read scoped" ON public.decision_contracts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_contracts.decision_id
        AND d.user_id = auth.uid()
    )
  );

-- extraction_contracts: restrict reads to admins or the owner of the underlying decision
DROP POLICY IF EXISTS "Read extraction contracts (authenticated)" ON public.extraction_contracts;

CREATE POLICY "extraction_contracts read scoped" ON public.extraction_contracts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.decision_contracts dc
      JOIN public.decisions d ON d.id = dc.decision_id
      WHERE dc.id = extraction_contracts.decision_contract_id
        AND d.user_id = auth.uid()
    )
  );

-- red_team_analyses: add read access for decision owner
CREATE POLICY "red_team_analyses read decision owner" ON public.red_team_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = red_team_analyses.decision_id
        AND d.user_id = auth.uid()
    )
  );

-- decision_recommendation_actions: keep owner-only writes, allow authenticated read
-- (recommendations themselves are readable by all authenticated users, so their
-- committed actions are shared context for decision workflows).
DROP POLICY IF EXISTS "users_own_act" ON public.decision_recommendation_actions;

CREATE POLICY "dra read auth" ON public.decision_recommendation_actions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dra insert own" ON public.decision_recommendation_actions
  FOR INSERT TO authenticated
  WITH CHECK (committed_by = auth.uid());

CREATE POLICY "dra update own" ON public.decision_recommendation_actions
  FOR UPDATE TO authenticated
  USING (committed_by = auth.uid())
  WITH CHECK (committed_by = auth.uid());

CREATE POLICY "dra delete own" ON public.decision_recommendation_actions
  FOR DELETE TO authenticated
  USING (committed_by = auth.uid());
