
DROP VIEW IF EXISTS public.decision_coverage;
CREATE VIEW public.decision_coverage
WITH (security_invoker = true) AS
SELECT
  d.id AS decision_id,
  d.pack_id,
  d.name,
  COUNT(c.id) AS criteria_count,
  COUNT(sm.id) FILTER (WHERE sm.source_system_id IS NOT NULL) AS criteria_with_source,
  CASE WHEN COUNT(c.id) = 0 THEN 0
       ELSE ROUND(COUNT(sm.id) FILTER (WHERE sm.source_system_id IS NOT NULL)::numeric / COUNT(c.id)::numeric, 2)
  END AS coverage,
  ROUND(COALESCE(AVG(sm.confidence) FILTER (WHERE sm.source_system_id IS NOT NULL), 0), 2) AS avg_confidence
FROM public.pack_decisions d
LEFT JOIN public.decision_criteria c ON c.decision_id = d.id
LEFT JOIN public.source_mappings sm ON sm.criterion_id = c.id
GROUP BY d.id;
GRANT SELECT ON public.decision_coverage TO anon, authenticated, service_role;
