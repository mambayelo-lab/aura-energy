-- Add action_steps JSONB column to decision_recommendations
-- Format: [{"order": 1, "label": "...", "duration": "...", "owner": "..."}]

ALTER TABLE decision_recommendations
  ADD COLUMN IF NOT EXISTS action_steps JSONB;
