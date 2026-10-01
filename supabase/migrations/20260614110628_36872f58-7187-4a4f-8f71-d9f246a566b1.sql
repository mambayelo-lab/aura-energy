
CREATE TABLE public.argus_external_probes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('firecrawl','macro_worldbank','market_quote','news_rss')),
  target TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 720,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_value JSONB,
  last_error TEXT,
  attribute_id UUID REFERENCES public.semantic_attributes(id) ON DELETE SET NULL,
  pack_slug TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.argus_external_probes TO authenticated;
GRANT ALL ON public.argus_external_probes TO service_role;
ALTER TABLE public.argus_external_probes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "probes admin" ON public.argus_external_probes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "probes read" ON public.argus_external_probes FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_probes_updated BEFORE UPDATE ON public.argus_external_probes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a few useful probes (no auth needed for these public sources)
INSERT INTO public.argus_external_probes(name, kind, target, params, refresh_interval_minutes, pack_slug, notes) VALUES
('Inflation France (World Bank)', 'macro_worldbank', 'FP.CPI.TOTL.ZG', '{"country":"FR","label":"Inflation France IPC %"}', 1440, NULL, 'IPC annuel France'),
('Croissance PIB France (World Bank)', 'macro_worldbank', 'NY.GDP.MKTP.KD.ZG', '{"country":"FR","label":"PIB France %"}', 1440, NULL, 'Croissance PIB annuelle'),
('LVMH cotation (Yahoo)', 'market_quote', 'MC.PA', '{}', 360, 'default', 'Cotation Yahoo Finance'),
('Hermès cotation (Yahoo)', 'market_quote', 'RMS.PA', '{}', 360, 'default', 'Cotation Yahoo Finance'),
('EUR/USD (Yahoo)', 'market_quote', 'EURUSD=X', '{}', 360, NULL, 'Taux EUR/USD'),
('News Luxe & Retail FR', 'news_rss', 'luxe retail strategie France', '{}', 720, 'default', 'Signaux faibles sectoriels');
