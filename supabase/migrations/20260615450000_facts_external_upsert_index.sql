-- Unique index on facts for external probe ingestion upsert
-- Allows ON CONFLICT (source_app, entity_key, attribute_name) DO UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS facts_external_upsert_idx
  ON public.facts(source_app, entity_key, attribute_name)
  WHERE source_app = 'argus_external';
