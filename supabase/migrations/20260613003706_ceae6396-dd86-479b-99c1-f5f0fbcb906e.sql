
DROP VIEW IF EXISTS public.attribute_source_of_truth;
CREATE VIEW public.attribute_source_of_truth
WITH (security_invoker = true) AS
SELECT DISTINCT ON (sm.semantic_attribute_id)
  sm.semantic_attribute_id,
  sa.attribute_name,
  so.object_name,
  sm.source_system_id,
  ss.name AS source_system_name,
  sm.confidence,
  sm.precedence
FROM public.source_mappings sm
JOIN public.semantic_attributes sa ON sa.id = sm.semantic_attribute_id
JOIN public.semantic_objects so ON so.id = sa.object_id
LEFT JOIN public.source_systems ss ON ss.id = sm.source_system_id
WHERE sm.semantic_attribute_id IS NOT NULL
ORDER BY sm.semantic_attribute_id,
         sm.is_source_of_truth DESC,
         sm.precedence ASC,
         sm.confidence DESC NULLS LAST;
GRANT SELECT ON public.attribute_source_of_truth TO authenticated;
