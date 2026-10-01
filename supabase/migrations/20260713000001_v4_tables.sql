-- ============================================================
-- AURA V4 — Tables dédiées V4
-- Isolation complète : aucune modification des tables V2/V3
-- Toutes les tables portent le préfixe v4_
-- ============================================================

-- ── v4_decision_patterns ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.v4_decision_patterns (
  id              TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  sector          TEXT        NOT NULL,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','review','published','archived')),
  schema_version  TEXT        NOT NULL DEFAULT 'v4',
  version         TEXT        NOT NULL DEFAULT '1.0.0',
  criteria        JSONB       NOT NULL DEFAULT '[]',
  questions       JSONB       NOT NULL DEFAULT '[]',
  alternatives    JSONB       NOT NULL DEFAULT '[]',
  org_id          UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_v4_patterns_sector   ON public.v4_decision_patterns(sector);
CREATE INDEX IF NOT EXISTS idx_v4_patterns_status   ON public.v4_decision_patterns(status);
CREATE INDEX IF NOT EXISTS idx_v4_patterns_org      ON public.v4_decision_patterns(org_id);

-- ── v4_pattern_versions ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.v4_pattern_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id  TEXT        NOT NULL REFERENCES public.v4_decision_patterns(id) ON DELETE CASCADE,
  version     TEXT        NOT NULL,
  snapshot    JSONB       NOT NULL,  -- snapshot complet du pattern à ce moment
  change_note TEXT,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v4_versions_pattern ON public.v4_pattern_versions(pattern_id);

-- ── v4_decision_sessions ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.v4_decision_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id      TEXT        NOT NULL REFERENCES public.v4_decision_patterns(id),
  pattern_version TEXT        NOT NULL,
  question        TEXT        NOT NULL,
  mode            TEXT        NOT NULL DEFAULT 'live'
                              CHECK (mode IN ('demo','live')),
  engine_version  TEXT        NOT NULL DEFAULT '4.0.0',
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  org_id          UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_v4_sessions_pattern ON public.v4_decision_sessions(pattern_id);
CREATE INDEX IF NOT EXISTS idx_v4_sessions_org     ON public.v4_decision_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_v4_sessions_user    ON public.v4_decision_sessions(user_id);

-- ── v4_session_inputs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.v4_session_inputs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.v4_decision_sessions(id) ON DELETE CASCADE,
  facts       JSONB       NOT NULL DEFAULT '[]',
  assumptions JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v4_inputs_session ON public.v4_session_inputs(session_id);

-- ── v4_scenario_results ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.v4_scenario_results (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID        NOT NULL REFERENCES public.v4_decision_sessions(id) ON DELETE CASCADE,
  recommendation     JSONB       NOT NULL,
  alternatives       JSONB       NOT NULL DEFAULT '[]',
  scenario_results   JSONB       NOT NULL DEFAULT '[]',
  value_score        NUMERIC(5,2),
  feasibility_score  NUMERIC(5,2),
  cap_score          NUMERIC(5,2),
  confidence_score   NUMERIC(5,2),
  pareto_ids         TEXT[]      NOT NULL DEFAULT '{}',
  consequences       JSONB       NOT NULL DEFAULT '[]',
  evidence           JSONB       NOT NULL DEFAULT '{}',
  coalition_analysis JSONB,
  engine_version     TEXT        NOT NULL DEFAULT '4.0.0',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v4_results_session ON public.v4_scenario_results(session_id);

-- ── v4_calculation_traces ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.v4_calculation_traces (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.v4_decision_sessions(id) ON DELETE CASCADE,
  result_id      UUID        REFERENCES public.v4_scenario_results(id) ON DELETE CASCADE,
  method         TEXT        NOT NULL,
  method_version TEXT        NOT NULL,
  inputs         JSONB       NOT NULL DEFAULT '{}',
  parameters     JSONB       NOT NULL DEFAULT '{}',
  output         JSONB,
  source_refs    TEXT[]      NOT NULL DEFAULT '{}',
  executed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  engine_version TEXT        NOT NULL DEFAULT '4.0.0'
);

CREATE INDEX IF NOT EXISTS idx_v4_traces_session ON public.v4_calculation_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_v4_traces_result  ON public.v4_calculation_traces(result_id);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.v4_decision_patterns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v4_pattern_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v4_decision_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v4_session_inputs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v4_scenario_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v4_calculation_traces ENABLE ROW LEVEL SECURITY;

-- Patterns : lisibles par les membres de l'org, modifiables par leur créateur
CREATE POLICY "v4_patterns_select" ON public.v4_decision_patterns
  FOR SELECT USING (
    org_id IS NULL OR
    org_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "v4_patterns_insert" ON public.v4_decision_patterns
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "v4_patterns_update" ON public.v4_decision_patterns
  FOR UPDATE USING (created_by = auth.uid());

-- Sessions : visibles par leur créateur et les membres de l'org
CREATE POLICY "v4_sessions_select" ON public.v4_decision_sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    org_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "v4_sessions_insert" ON public.v4_decision_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Inputs, résultats, traces : accessibles via la session
CREATE POLICY "v4_inputs_select" ON public.v4_session_inputs
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.v4_decision_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "v4_inputs_insert" ON public.v4_session_inputs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "v4_results_select" ON public.v4_scenario_results
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.v4_decision_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "v4_results_insert" ON public.v4_scenario_results
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "v4_traces_select" ON public.v4_calculation_traces
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.v4_decision_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "v4_traces_insert" ON public.v4_calculation_traces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Versions patterns : lisibles par membres de l'org
CREATE POLICY "v4_versions_select" ON public.v4_pattern_versions
  FOR SELECT USING (
    pattern_id IN (SELECT id FROM public.v4_decision_patterns WHERE
      org_id IS NULL OR
      org_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "v4_versions_insert" ON public.v4_pattern_versions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Trigger updated_at sur v4_decision_patterns ──────────────

CREATE OR REPLACE FUNCTION public.set_v4_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_v4_patterns_updated_at
  BEFORE UPDATE ON public.v4_decision_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_v4_updated_at();
