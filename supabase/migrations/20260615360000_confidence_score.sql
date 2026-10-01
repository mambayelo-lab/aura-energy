ALTER TABLE decision_recommendations
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 100);
