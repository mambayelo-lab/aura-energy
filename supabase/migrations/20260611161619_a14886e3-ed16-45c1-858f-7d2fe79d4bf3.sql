
-- ============ Roles ============
CREATE TYPE public.app_role AS ENUM ('admin', 'decideur');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  org_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + assign decideur role on signup; first user becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'decideur')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Decision Packs ============
CREATE TABLE public.decision_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'compass',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decision_packs TO authenticated, anon;
GRANT ALL ON public.decision_packs TO service_role;
ALTER TABLE public.decision_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads published packs" ON public.decision_packs FOR SELECT USING (is_published);
CREATE POLICY "admins manage packs" ON public.decision_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_pack_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES public.decision_packs(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pack_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_pack_activations TO authenticated;
GRANT ALL ON public.user_pack_activations TO service_role;
ALTER TABLE public.user_pack_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own activations" ON public.user_pack_activations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ Missions IA Readiness ============
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  sector TEXT,
  status TEXT NOT NULL DEFAULT 'cadrage',
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage missions" ON public.missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.mission_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_sections TO authenticated;
GRANT ALL ON public.mission_sections TO service_role;
ALTER TABLE public.mission_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage sections" ON public.mission_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
GRANT SELECT ON public.report_shares TO anon, authenticated;
GRANT ALL ON public.report_shares TO service_role;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads share by token" ON public.report_shares FOR SELECT USING (true);
CREATE POLICY "admins manage shares" ON public.report_shares FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER missions_touch BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sections_touch BEFORE UPDATE ON public.mission_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed catalog
INSERT INTO public.decision_packs (slug, title, description, category, icon) VALUES
  ('ia-strategy', 'Stratégie IA', 'Cadrer la trajectoire IA de votre organisation : vision, ambition, portefeuille.', 'Stratégie', 'sparkles'),
  ('ia-readiness', 'IA Readiness', 'Évaluer la maturité IA : données, plateforme, talents, gouvernance.', 'Diagnostic', 'gauge'),
  ('build-vs-buy', 'Build vs Buy', 'Trancher entre solution interne, éditeur ou hybride pour un cas d''usage.', 'Architecture', 'split'),
  ('vendor-selection', 'Choix Fournisseur', 'Comparer et sélectionner un fournisseur IA/SaaS selon critères pondérés.', 'Sourcing', 'list-checks'),
  ('roi-business-case', 'Business Case', 'Construire un business case IA avec hypothèses, gains, risques et TCO.', 'Finance', 'trending-up'),
  ('risk-compliance', 'Risque & Conformité', 'Évaluer risques IA (AI Act, RGPD, biais, sécurité) et plan de mitigation.', 'Risque', 'shield')
ON CONFLICT (slug) DO NOTHING;
