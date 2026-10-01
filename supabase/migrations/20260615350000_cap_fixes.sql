-- Fix priority_score to be consistent with CAP score definition: min(impact_score, feasibility_score)
-- Scores are stored on a 1-100 scale in decision_recommendations
UPDATE decision_recommendations
SET priority_score = LEAST(impact_score, feasibility_score)
WHERE impact_score IS NOT NULL AND feasibility_score IS NOT NULL;
