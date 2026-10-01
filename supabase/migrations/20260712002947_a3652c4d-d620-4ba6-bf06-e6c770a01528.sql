
-- field_briefs: restrict reads to admin/comex (was public to all authenticated)
DROP POLICY IF EXISTS "fb r" ON public.field_briefs;
CREATE POLICY "fb r" ON public.field_briefs FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

-- okrs: add mission membership scope
DROP POLICY IF EXISTS "ok r" ON public.okrs;
CREATE POLICY "ok r" ON public.okrs FOR SELECT
  USING (public.can_access_confidential(auth.uid(), confidentiality) AND public.is_mission_member(mission_id));

-- crisis_events: add mission_id, scope by mission
ALTER TABLE public.crisis_events ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "ce r" ON public.crisis_events;
CREATE POLICY "ce r" ON public.crisis_events FOR SELECT
  USING (public.can_access_confidential(auth.uid(), confidentiality) AND public.is_mission_member(mission_id));

-- talent_profiles: add mission_id, restrict reads
ALTER TABLE public.talent_profiles ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "tp r" ON public.talent_profiles;
CREATE POLICY "tp r" ON public.talent_profiles FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'rh') AND public.is_mission_member(mission_id)));

-- talent_decisions: add mission_id, restrict reads
ALTER TABLE public.talent_decisions ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE;
DROP POLICY IF EXISTS "td r" ON public.talent_decisions;
CREATE POLICY "td r" ON public.talent_decisions FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'rh') AND public.is_mission_member(mission_id)));

-- project_comments: enforce mission membership on insert
DROP POLICY IF EXISTS "own write comments" ON public.project_comments;
CREATE POLICY "own write comments" ON public.project_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_mission_member(p.mission_id))
  );
