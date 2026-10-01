
CREATE TABLE IF NOT EXISTS public.argus_mapping_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_attribute_id uuid NOT NULL REFERENCES public.semantic_attributes(id) ON DELETE CASCADE,
  schema_id uuid NOT NULL REFERENCES public.argus_schemas(id) ON DELETE CASCADE,
  source_system_id uuid REFERENCES public.source_systems(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  field_type text,
  sample_values jsonb DEFAULT '[]'::jsonb,
  jaccard_score numeric NOT NULL DEFAULT 0,
  semantic_score numeric NOT NULL DEFAULT 0,
  llm_score numeric NOT NULL DEFAULT 0,
  combined_score numeric NOT NULL DEFAULT 0,
  llm_rationale text,
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semantic_attribute_id, schema_id, field_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.argus_mapping_proposals TO authenticated;
GRANT ALL ON public.argus_mapping_proposals TO service_role;

ALTER TABLE public.argus_mapping_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "argus_mapping_proposals read auth" ON public.argus_mapping_proposals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "argus_mapping_proposals write admin" ON public.argus_mapping_proposals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER argus_mapping_proposals_touch
  BEFORE UPDATE ON public.argus_mapping_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS argus_mapping_proposals_attr_idx ON public.argus_mapping_proposals(semantic_attribute_id, combined_score DESC);
CREATE INDEX IF NOT EXISTS argus_mapping_proposals_schema_idx ON public.argus_mapping_proposals(schema_id);
