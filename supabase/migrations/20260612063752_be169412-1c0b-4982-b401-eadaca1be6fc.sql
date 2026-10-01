
-- ============ PACKS (objets de premier rang) ============
CREATE TABLE public.packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  owner_role TEXT,
  icon TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packs TO anon, authenticated;
GRANT ALL ON public.packs TO service_role;
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packs read all" ON public.packs FOR SELECT USING (true);
CREATE POLICY "packs admin write" ON public.packs FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pack_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pack_capabilities TO anon, authenticated;
GRANT ALL ON public.pack_capabilities TO service_role;
ALTER TABLE public.pack_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcap read" ON public.pack_capabilities FOR SELECT USING (true);
CREATE POLICY "pcap admin" ON public.pack_capabilities FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pack_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  capability_id UUID REFERENCES public.pack_capabilities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner_role TEXT,
  criticality TEXT NOT NULL DEFAULT 'medium',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pack_decisions TO anon, authenticated;
GRANT ALL ON public.pack_decisions TO service_role;
ALTER TABLE public.pack_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdec read" ON public.pack_decisions FOR SELECT USING (true);
CREATE POLICY "pdec admin" ON public.pack_decisions FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.decision_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.pack_decisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1,
  required_confidence NUMERIC NOT NULL DEFAULT 0.7,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decision_criteria TO anon, authenticated;
GRANT ALL ON public.decision_criteria TO service_role;
ALTER TABLE public.decision_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dcrit read" ON public.decision_criteria FOR SELECT USING (true);
CREATE POLICY "dcrit admin" ON public.decision_criteria FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ INFORMATION ASSETS / SOURCES / CONNECTORS ============
CREATE TABLE public.information_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'dashboard',
  owner TEXT,
  tool TEXT,
  known_source_status TEXT NOT NULL DEFAULT 'unknown',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.information_assets TO authenticated;
GRANT ALL ON public.information_assets TO service_role;
ALTER TABLE public.information_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia read" ON public.information_assets FOR SELECT USING (true);
CREATE POLICY "ia admin" ON public.information_assets FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.source_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_type TEXT,
  access_method TEXT,
  trust_tier TEXT NOT NULL DEFAULT 'medium',
  freshness_target TEXT,
  connector_slug TEXT,
  status TEXT NOT NULL DEFAULT 'identified',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_systems TO authenticated;
GRANT ALL ON public.source_systems TO service_role;
ALTER TABLE public.source_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss read" ON public.source_systems FOR SELECT USING (true);
CREATE POLICY "ss admin" ON public.source_systems FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id UUID NOT NULL REFERENCES public.decision_criteria(id) ON DELETE CASCADE,
  information_asset_id UUID REFERENCES public.information_assets(id) ON DELETE SET NULL,
  source_system_id UUID REFERENCES public.source_systems(id) ON DELETE SET NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'declared',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_mappings TO authenticated;
GRANT ALL ON public.source_mappings TO service_role;
ALTER TABLE public.source_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm read" ON public.source_mappings FOR SELECT USING (true);
CREATE POLICY "sm admin" ON public.source_mappings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.connectors_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier INT NOT NULL DEFAULT 1,
  access_technique TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  trust_tier TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'planned',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.connectors_catalog TO anon, authenticated;
GRANT ALL ON public.connectors_catalog TO service_role;
ALTER TABLE public.connectors_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc read" ON public.connectors_catalog FOR SELECT USING (true);
CREATE POLICY "cc admin" ON public.connectors_catalog FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ FACTS & SIGNALS ============
CREATE TABLE public.facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  source_system_id UUID REFERENCES public.source_systems(id) ON DELETE SET NULL,
  object_name TEXT NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facts TO authenticated;
GRANT ALL ON public.facts TO service_role;
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facts read" ON public.facts FOR SELECT USING (true);
CREATE POLICY "facts admin" ON public.facts FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES public.pack_decisions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cause TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  source_system_id UUID REFERENCES public.source_systems(id) ON DELETE SET NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.7,
  suggested_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sig read" ON public.signals FOR SELECT USING (true);
CREATE POLICY "sig admin" ON public.signals FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.rule_decision_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.causal_rules(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.pack_decisions(id) ON DELETE CASCADE,
  weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_decision_links TO authenticated;
GRANT ALL ON public.rule_decision_links TO service_role;
ALTER TABLE public.rule_decision_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rdl read" ON public.rule_decision_links FOR SELECT USING (true);
CREATE POLICY "rdl admin" ON public.rule_decision_links FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ARGUS 3 COUCHES ============
ALTER TABLE public.argus_applications
  ADD COLUMN IF NOT EXISTS trust_tier TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS freshness_target TEXT,
  ADD COLUMN IF NOT EXISTS layer_truth TEXT NOT NULL DEFAULT 'observed';

-- ============ VUE COUVERTURE ============
CREATE OR REPLACE VIEW public.decision_coverage AS
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

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER trg_packs_u BEFORE UPDATE ON public.packs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_pdec_u BEFORE UPDATE ON public.pack_decisions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ia_u BEFORE UPDATE ON public.information_assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ss_u BEFORE UPDATE ON public.source_systems FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cc_u BEFORE UPDATE ON public.connectors_catalog FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
