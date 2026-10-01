
-- Helper: is the current user allowed to access this mission?
CREATE OR REPLACE FUNCTION public.is_mission_member(_mission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _mission_id IS NULL
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comex')
    OR EXISTS (SELECT 1 FROM public.missions m WHERE m.id = _mission_id AND m.owner_id = auth.uid())
$$;

-- ============ Anon → authenticated only (catalog-like tables) ============
DROP POLICY IF EXISTS "packs read all" ON public.packs;
CREATE POLICY "packs read all" ON public.packs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pdec read" ON public.pack_decisions;
CREATE POLICY "pdec read" ON public.pack_decisions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pcap read" ON public.pack_capabilities;
CREATE POLICY "pcap read" ON public.pack_capabilities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dcrit read" ON public.decision_criteria;
CREATE POLICY "dcrit read" ON public.decision_criteria FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cc read" ON public.connectors_catalog;
CREATE POLICY "cc read" ON public.connectors_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "signal_rules_read_all" ON public.signal_rules;
CREATE POLICY "signal_rules_read_all" ON public.signal_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "qb_read_all" ON public.interview_question_bank;
CREATE POLICY "qb_read_all" ON public.interview_question_bank FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "argus_schemas_read" ON public.argus_schemas;
CREATE POLICY "argus_schemas_read" ON public.argus_schemas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "argus_field_samples_read" ON public.argus_field_samples;
CREATE POLICY "argus_field_samples_read" ON public.argus_field_samples FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "anyone reads published packs" ON public.decision_packs;
CREATE POLICY "authenticated reads published packs" ON public.decision_packs FOR SELECT TO authenticated USING (is_published);

-- ============ Switch public-scoped ALL policies to authenticated ============
DROP POLICY IF EXISTS "facts admin" ON public.facts;
CREATE POLICY "facts admin" ON public.facts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "sig admin" ON public.signals;
CREATE POLICY "sig admin" ON public.signals FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "sm admin" ON public.source_mappings;
CREATE POLICY "sm admin" ON public.source_mappings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "ss admin" ON public.source_systems;
CREATE POLICY "ss admin" ON public.source_systems FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "ia admin" ON public.information_assets;
CREATE POLICY "ia admin" ON public.information_assets FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "argus_schemas_admin" ON public.argus_schemas;
CREATE POLICY "argus_schemas_admin" ON public.argus_schemas FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "argus_field_samples_admin" ON public.argus_field_samples;
CREATE POLICY "argus_field_samples_admin" ON public.argus_field_samples FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "pcap admin" ON public.pack_capabilities;
CREATE POLICY "pcap admin" ON public.pack_capabilities FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "pdec admin" ON public.pack_decisions;
CREATE POLICY "pdec admin" ON public.pack_decisions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "dcrit admin" ON public.decision_criteria;
CREATE POLICY "dcrit admin" ON public.decision_criteria FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cc admin" ON public.connectors_catalog;
CREATE POLICY "cc admin" ON public.connectors_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "signal_rules_admin_write" ON public.signal_rules;
CREATE POLICY "signal_rules_admin_write" ON public.signal_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "packs admin write" ON public.packs;
CREATE POLICY "packs admin write" ON public.packs FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ source_systems: hide credentials from non-admins ============
DROP POLICY IF EXISTS "auth read" ON public.source_systems;
CREATE POLICY "ss read admin only" ON public.source_systems FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- ============ Mission-scoped SELECT policies ============
DROP POLICY IF EXISTS "auth read" ON public.missions;
CREATE POLICY "missions read members" ON public.missions FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

DROP POLICY IF EXISTS "auth read" ON public.mission_interviews;
CREATE POLICY "mission_interviews read members" ON public.mission_interviews FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.mission_sections;
CREATE POLICY "mission_sections read members" ON public.mission_sections FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read projects" ON public.projects;
CREATE POLICY "projects read members" ON public.projects FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.argus_applications;
CREATE POLICY "argus_apps read members" ON public.argus_applications FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.argus_flows;
CREATE POLICY "argus_flows read members" ON public.argus_flows FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.causal_rules;
CREATE POLICY "causal_rules read members" ON public.causal_rules FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.ia_readiness_dimensions;
CREATE POLICY "iar_dim read members" ON public.ia_readiness_dimensions FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.ia_readiness_roadmap;
CREATE POLICY "iar_road read members" ON public.ia_readiness_roadmap FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.information_assets;
CREATE POLICY "info_assets read members" ON public.information_assets FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.source_mappings;
CREATE POLICY "sm read admin" ON public.source_mappings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "auth read" ON public.signals;
CREATE POLICY "signals read members" ON public.signals FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));

DROP POLICY IF EXISTS "auth read" ON public.facts;
CREATE POLICY "facts read members" ON public.facts FOR SELECT TO authenticated
USING (public.is_mission_member(mission_id));
