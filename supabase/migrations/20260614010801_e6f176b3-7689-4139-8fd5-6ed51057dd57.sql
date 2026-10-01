
CREATE TABLE public.semantic_object_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  from_object_id uuid NOT NULL REFERENCES public.semantic_objects(id) ON DELETE CASCADE,
  to_object_id uuid NOT NULL REFERENCES public.semantic_objects(id) ON DELETE CASCADE,
  relation_name text NOT NULL,
  cardinality text DEFAULT 'many-to-one',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.semantic_object_relations TO authenticated;
GRANT ALL ON public.semantic_object_relations TO service_role;
ALTER TABLE public.semantic_object_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read relations" ON public.semantic_object_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage relations" ON public.semantic_object_relations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_relations_updated BEFORE UPDATE ON public.semantic_object_relations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.semantic_transformations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  object_id uuid REFERENCES public.semantic_objects(id) ON DELETE CASCADE,
  attribute_id uuid REFERENCES public.semantic_attributes(id) ON DELETE CASCADE,
  name text NOT NULL,
  formula text NOT NULL,
  inputs jsonb DEFAULT '[]'::jsonb,
  unit text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.semantic_transformations TO authenticated;
GRANT ALL ON public.semantic_transformations TO service_role;
ALTER TABLE public.semantic_transformations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read transformations" ON public.semantic_transformations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage transformations" ON public.semantic_transformations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_transformations_updated BEFORE UPDATE ON public.semantic_transformations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.semantic_objects
  ADD COLUMN IF NOT EXISTS owner_team text,
  ADD COLUMN IF NOT EXISTS is_kpi boolean NOT NULL DEFAULT false;

ALTER TABLE public.extraction_contracts
  ADD COLUMN IF NOT EXISTS access_method text,
  ADD COLUMN IF NOT EXISTS cache_ttl_minutes integer,
  ADD COLUMN IF NOT EXISTS retention_days integer,
  ADD COLUMN IF NOT EXISTS completeness_target numeric(4,2),
  ADD COLUMN IF NOT EXISTS freshness_target_minutes integer,
  ADD COLUMN IF NOT EXISTS suggested_argus_schema_id uuid REFERENCES public.argus_schemas(id) ON DELETE SET NULL;
