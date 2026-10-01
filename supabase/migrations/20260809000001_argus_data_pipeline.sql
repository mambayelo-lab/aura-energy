-- Argus data pipeline tables: facts, extraction_contracts, mapping_proposals
-- Implements the Snapshot + Cache strategy (no CDC in v1)

-- ─── facts ───────────────────────────────────────────────────────────────────
-- Snapshot store: one row per connector × field × snapshot_at
CREATE TABLE IF NOT EXISTS public.facts (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id    text          NOT NULL,                   -- e.g. "as400-billing"
  field_id        text          NOT NULL,                   -- e.g. "billing_cycle_days"
  ontology_obj    text,                                     -- e.g. "facturation"
  attribute_id    text,                                     -- e.g. "billing_cycle_days"
  raw_value       text          NOT NULL,
  numeric_value   numeric,
  unit            text,
  data_type       text          NOT NULL DEFAULT 'string',  -- number|percent|days|string|date
  snapshot_at     timestamptz   NOT NULL DEFAULT now(),
  extracted_by    text,                                     -- "heuristic" | "ai" | "manual"
  confidence      numeric CHECK (confidence BETWEEN 0 AND 1),
  tenant_id       uuid,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX ON public.facts (connector_id, field_id, snapshot_at DESC);
CREATE INDEX ON public.facts (ontology_obj, attribute_id);
CREATE INDEX ON public.facts (tenant_id, snapshot_at DESC);

-- ─── extraction_contracts ────────────────────────────────────────────────────
-- Defines refresh policy & storage strategy per connector
CREATE TABLE IF NOT EXISTS public.extraction_contracts (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id         text        NOT NULL UNIQUE,
  connector_name       text        NOT NULL,
  tech                 text,
  protocol             text,
  auth_type            text,
  refresh_policy       text        NOT NULL DEFAULT 'hourly',   -- realtime|15min|hourly|daily|weekly|on-demand
  storage_strategy     text        NOT NULL DEFAULT 'snapshot', -- passthrough|cache|snapshot|cdc
  typical_latency_ms   integer,
  supports_cdc         boolean     NOT NULL DEFAULT false,
  volume_estimate      text,                                     -- low|medium|high|very-high
  last_pulled_at       timestamptz,
  next_pull_at         timestamptz,
  is_active            boolean     NOT NULL DEFAULT true,
  tenant_id            uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.extraction_contracts (connector_id);
CREATE INDEX ON public.extraction_contracts (next_pull_at) WHERE is_active;

-- ─── mapping_proposals ───────────────────────────────────────────────────────
-- Stores heuristic + AI-generated field→ontology mappings with confidence
CREATE TABLE IF NOT EXISTS public.mapping_proposals (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id          text        NOT NULL,
  field_id              text        NOT NULL,
  field_label           text,
  ontology_obj_id       text        NOT NULL,   -- e.g. "facturation"
  attribute_id          text        NOT NULL,   -- e.g. "billing_cycle_days"
  confidence            numeric     NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  mapping_method        text        NOT NULL,   -- "heuristic" | "ai"
  status                text        NOT NULL DEFAULT 'proposed', -- proposed|accepted|rejected
  reviewed_by           text,
  reviewed_at           timestamptz,
  rationale             text,                   -- explanation from AI
  tenant_id             uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, field_id, ontology_obj_id, attribute_id)
);

CREATE INDEX ON public.mapping_proposals (connector_id, field_id);
CREATE INDEX ON public.mapping_proposals (status, confidence DESC);

-- RLS (disabled in v1 — enable when multi-tenant is live)
ALTER TABLE public.facts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_contracts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_proposals     ENABLE ROW LEVEL SECURITY;

-- Permissive policies for single-tenant dev
CREATE POLICY "allow_all_facts"                ON public.facts                 FOR ALL USING (true);
CREATE POLICY "allow_all_extraction_contracts" ON public.extraction_contracts  FOR ALL USING (true);
CREATE POLICY "allow_all_mapping_proposals"    ON public.mapping_proposals     FOR ALL USING (true);
