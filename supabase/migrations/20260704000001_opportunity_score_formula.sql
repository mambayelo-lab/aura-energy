-- Remplace la formule produit par min(impact, faisabilité)
-- Avant : ROUND((impact_score * feasibility_score / 10.0)::numeric, 1)
-- Après : LEAST(impact_score, feasibility_score) — le min des deux axes
ALTER TABLE decision_recommendations
  DROP COLUMN IF EXISTS priority_score;

ALTER TABLE decision_recommendations
  ADD COLUMN priority_score numeric GENERATED ALWAYS AS (
    ROUND(LEAST(impact_score, feasibility_score)::numeric, 1)
  ) STORED;

COMMENT ON COLUMN decision_recommendations.priority_score
  IS 'Score d opportunité = min(gain potentiel, facilité exécution). Formule min au lieu du produit.';
