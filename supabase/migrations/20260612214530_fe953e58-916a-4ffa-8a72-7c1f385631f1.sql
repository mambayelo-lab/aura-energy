
-- Semantic Contract layer for Decision Packs
-- A Decision Pack contains Decisions; each Decision declares the business
-- objects/attributes it needs, with freshness SLA, confidence threshold,
-- expected sources, and owners. This drives Argus discovery and Extraction
-- Contracts downstream — Aura ne commence jamais par les données.

-- 1) Business Objects required by a pack/decision (Semantic Contract – objects)
CREATE TABLE public.semantic_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.pack_decisions(id) ON DELETE CASCADE,
  object_name text NOT NULL,                -- ex: Product, StockLevel, SalesVelocity
  description text,
  is_required boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, decision_id, object_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semantic_objects TO authenticated;
GRANT ALL ON public.semantic_objects TO service_role;
ALTER TABLE public.semantic_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read semantic objects (authenticated)" ON public.semantic_objects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage semantic objects" ON public.semantic_objects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tg_semantic_objects_updated
  BEFORE UPDATE ON public.semantic_objects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Attributes for each business object
CREATE TABLE public.semantic_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES public.semantic_objects(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,             -- ex: current_stock, sales_last_7d
  data_type text,                            -- number, string, date, boolean, json
  unit text,                                 -- ex: units, days, EUR, %
  description text,
  is_required boolean NOT NULL DEFAULT true,
  example_value text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_id, attribute_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semantic_attributes TO authenticated;
GRANT ALL ON public.semantic_attributes TO service_role;
ALTER TABLE public.semantic_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read semantic attributes (authenticated)" ON public.semantic_attributes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage semantic attributes" ON public.semantic_attributes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tg_semantic_attributes_updated
  BEFORE UPDATE ON public.semantic_attributes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Decision-level contract metadata: SLA, threshold, owners, expected sources
CREATE TABLE public.decision_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.pack_decisions(id) ON DELETE CASCADE,
  title text NOT NULL,                              -- ex: "Stockout Risk"
  business_question text,
  expected_sources text[] NOT NULL DEFAULT '{}',    -- ex: {SAP, WMS, Shopify}
  freshness_sla_minutes int,                        -- ex: 15 (max staleness)
  confidence_threshold numeric(4,2),                -- 0..1, ex: 0.80
  business_owner text,                              -- role/personne métier
  decision_owner text,                              -- role/personne décisionnel
  notes text,
  status text NOT NULL DEFAULT 'draft',             -- draft | active | retired
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, decision_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_contracts TO authenticated;
GRANT ALL ON public.decision_contracts TO service_role;
ALTER TABLE public.decision_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read decision contracts (authenticated)" ON public.decision_contracts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage decision contracts" ON public.decision_contracts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tg_decision_contracts_updated
  BEFORE UPDATE ON public.decision_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Extraction Contract scaffolding (per attribute, no real connector yet)
CREATE TABLE public.extraction_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_contract_id uuid NOT NULL REFERENCES public.decision_contracts(id) ON DELETE CASCADE,
  object_id uuid NOT NULL REFERENCES public.semantic_objects(id) ON DELETE CASCADE,
  attribute_id uuid REFERENCES public.semantic_attributes(id) ON DELETE CASCADE,
  source_system text,                       -- ex: "WMS", "SAP", "Shopify"
  source_field text,                        -- ex: "inventory.qty"
  refresh_interval_minutes int,             -- ex: 15
  status text NOT NULL DEFAULT 'planned',   -- planned | mapped | active | failing
  last_run_at timestamptz,
  last_value_sample jsonb,
  mapping_confidence numeric(4,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_contracts TO authenticated;
GRANT ALL ON public.extraction_contracts TO service_role;
ALTER TABLE public.extraction_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read extraction contracts (authenticated)" ON public.extraction_contracts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage extraction contracts" ON public.extraction_contracts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER tg_extraction_contracts_updated
  BEFORE UPDATE ON public.extraction_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_semantic_attributes_object ON public.semantic_attributes(object_id);
CREATE INDEX idx_semantic_objects_pack ON public.semantic_objects(pack_id);
CREATE INDEX idx_decision_contracts_pack ON public.decision_contracts(pack_id);
CREATE INDEX idx_extraction_contracts_decision ON public.extraction_contracts(decision_contract_id);
