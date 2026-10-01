
-- rule_interview_links: remove permissive open SELECT
DROP POLICY IF EXISTS "auth read" ON public.rule_interview_links;

-- project_votes: split writes and add mission-scope guard
DROP POLICY IF EXISTS "own write votes" ON public.project_votes;

CREATE POLICY "project_votes insert own mission" ON public.project_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_votes.project_id
        AND is_mission_member(p.mission_id)
    )
  );

CREATE POLICY "project_votes update own mission" ON public.project_votes
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_votes.project_id
        AND is_mission_member(p.mission_id)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_votes.project_id
        AND is_mission_member(p.mission_id)
    )
  );

CREATE POLICY "project_votes delete own mission" ON public.project_votes
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_votes.project_id
        AND is_mission_member(p.mission_id)
    )
  );

-- board_packs: mission-scope the comex/admin policies
DROP POLICY IF EXISTS "bp r" ON public.board_packs;
DROP POLICY IF EXISTS "bp w" ON public.board_packs;

CREATE POLICY "board_packs read mission" ON public.board_packs
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  );

CREATE POLICY "board_packs write mission" ON public.board_packs
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  );

-- comex_sessions: mission-scope the comex/admin policies
DROP POLICY IF EXISTS "cs r" ON public.comex_sessions;
DROP POLICY IF EXISTS "cs w" ON public.comex_sessions;

CREATE POLICY "comex_sessions read mission" ON public.comex_sessions
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  );

CREATE POLICY "comex_sessions write mission" ON public.comex_sessions
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  );

-- ma_targets: add mission_id, backfill from projects, then scope policies
ALTER TABLE public.ma_targets
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE;

UPDATE public.ma_targets t
   SET mission_id = p.mission_id
  FROM public.projects p
 WHERE t.project_id = p.id
   AND t.mission_id IS NULL;

CREATE INDEX IF NOT EXISTS ma_targets_mission_idx ON public.ma_targets(mission_id);

DROP POLICY IF EXISTS "ma r" ON public.ma_targets;
DROP POLICY IF EXISTS "ma w" ON public.ma_targets;

CREATE POLICY "ma_targets read mission" ON public.ma_targets
  FOR SELECT TO authenticated
  USING (
    can_access_confidential(auth.uid(), confidentiality)
    AND is_mission_member(mission_id)
  );

CREATE POLICY "ma_targets write mission" ON public.ma_targets
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  );

-- ma_synergies: reuse parent target's mission scoping (target policy already enforces it)
DROP POLICY IF EXISTS "sy r" ON public.ma_synergies;
DROP POLICY IF EXISTS "sy w" ON public.ma_synergies;

CREATE POLICY "ma_synergies read mission" ON public.ma_synergies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ma_targets t
      WHERE t.id = ma_synergies.target_id
        AND can_access_confidential(auth.uid(), t.confidentiality)
        AND is_mission_member(t.mission_id)
    )
  );

CREATE POLICY "ma_synergies write mission" ON public.ma_synergies
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.ma_targets t
      WHERE t.id = ma_synergies.target_id
        AND is_mission_member(t.mission_id)
    )
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.ma_targets t
      WHERE t.id = ma_synergies.target_id
        AND is_mission_member(t.mission_id)
    )
  );

-- stakeholders: add mission_id and scope policies to mission membership
ALTER TABLE public.stakeholders
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS stakeholders_mission_idx ON public.stakeholders(mission_id);

DROP POLICY IF EXISTS "sh r" ON public.stakeholders;
DROP POLICY IF EXISTS "sh w" ON public.stakeholders;

CREATE POLICY "stakeholders read mission" ON public.stakeholders
  FOR SELECT TO authenticated
  USING (
    can_access_confidential(auth.uid(), confidentiality)
    AND is_mission_member(mission_id)
  );

CREATE POLICY "stakeholders write mission" ON public.stakeholders
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comex'::app_role))
    AND is_mission_member(mission_id)
  );
