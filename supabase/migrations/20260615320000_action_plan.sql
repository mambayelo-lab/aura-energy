-- Migration: Plan d'actions — table de suivi des recommandations engagées
-- Ferme la boucle : Signal → Recommandation → Engagement → Exécution → Outcome

CREATE TABLE IF NOT EXISTS decision_recommendation_actions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id    UUID REFERENCES decision_recommendations(id) ON DELETE CASCADE,
  signal_id            UUID REFERENCES signals(id)                  ON DELETE SET NULL,
  committed_by         UUID REFERENCES auth.users(id),

  -- Lifecycle
  status               TEXT NOT NULL DEFAULT 'committed'
    CHECK (status IN ('committed', 'in_progress', 'done', 'abandoned', 'on_hold')),

  -- Timing
  committed_at         TIMESTAMPTZ DEFAULT NOW(),
  target_date          DATE,
  completed_at         TIMESTAMPTZ,

  -- Outcome (filled when status = done/abandoned)
  outcome_notes        TEXT,
  actual_impact_label  TEXT,
  outcome_rating       INTEGER CHECK (outcome_rating BETWEEN 1 AND 5),

  -- Free notes
  notes                TEXT,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE decision_recommendation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own committed actions"
  ON decision_recommendation_actions FOR ALL
  USING  (committed_by = auth.uid())
  WITH CHECK (committed_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dra_by       ON decision_recommendation_actions(committed_by);
CREATE INDEX IF NOT EXISTS idx_dra_status   ON decision_recommendation_actions(status);
CREATE INDEX IF NOT EXISTS idx_dra_rec      ON decision_recommendation_actions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_dra_created  ON decision_recommendation_actions(committed_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dra_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dra_updated_at ON decision_recommendation_actions;
CREATE TRIGGER trg_dra_updated_at
  BEFORE UPDATE ON decision_recommendation_actions
  FOR EACH ROW EXECUTE FUNCTION update_dra_updated_at();
