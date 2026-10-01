CREATE TABLE IF NOT EXISTS public.business_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  description text,
  ord integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_capabilities TO authenticated;
GRANT ALL ON public.business_capabilities TO service_role;
ALTER TABLE public.business_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read caps" ON public.business_capabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write caps" ON public.business_capabilities TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_caps_updated BEFORE UPDATE ON public.business_capabilities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.capability_app_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id uuid NOT NULL REFERENCES public.business_capabilities(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.argus_applications(id) ON DELETE CASCADE,
  source_system_id uuid REFERENCES public.source_systems(id) ON DELETE SET NULL,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, application_id)
);
GRANT SELECT ON public.capability_app_links TO authenticated;
GRANT ALL ON public.capability_app_links TO service_role;
ALTER TABLE public.capability_app_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read links" ON public.capability_app_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write links" ON public.capability_app_links TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));