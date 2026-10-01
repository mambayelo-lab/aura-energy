
ALTER TABLE public.decision_packs ADD COLUMN IF NOT EXISTS confidentiality public.confidentiality_level NOT NULL DEFAULT 'public';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS confidentiality public.confidentiality_level NOT NULL DEFAULT 'public';
ALTER TABLE public.decisions ADD COLUMN IF NOT EXISTS confidentiality public.confidentiality_level NOT NULL DEFAULT 'public';

CREATE OR REPLACE FUNCTION public.can_access_confidential(_uid uuid, _level public.confidentiality_level)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _level
    WHEN 'public' THEN true
    WHEN 'restricted' THEN (public.has_role(_uid,'admin') OR public.has_role(_uid,'comex') OR public.has_role(_uid,'rh') OR public.has_role(_uid,'decideur'))
    WHEN 'comex' THEN (public.has_role(_uid,'admin') OR public.has_role(_uid,'comex'))
    WHEN 'rh_only' THEN (public.has_role(_uid,'admin') OR public.has_role(_uid,'rh'))
  END
$$;

CREATE TABLE IF NOT EXISTS public.comex_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES public.decisions(id) ON DELETE SET NULL,
  pack_slug text, title text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', scheduled_at timestamptz,
  dissensus jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comex_sessions TO authenticated;
GRANT ALL ON public.comex_sessions TO service_role;
ALTER TABLE public.comex_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs r" ON public.comex_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));
CREATE POLICY "cs w" ON public.comex_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.red_team_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE,
  pack_slug text, question text NOT NULL,
  biases jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  blind_spots jsonb NOT NULL DEFAULT '[]'::jsonb,
  mitigations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric, created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.red_team_analyses TO authenticated;
GRANT ALL ON public.red_team_analyses TO service_role;
ALTER TABLE public.red_team_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt all" ON public.red_team_analyses FOR ALL TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE,
  pack_slug text,
  predicted jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  delta_summary text, lessons text, reviewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_outcomes TO authenticated;
GRANT ALL ON public.decision_outcomes TO service_role;
ALTER TABLE public.decision_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "do r" ON public.decision_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "do i" ON public.decision_outcomes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "do u" ON public.decision_outcomes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "do d" ON public.decision_outcomes FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.okrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  objective text NOT NULL,
  key_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner text, period text, progress numeric DEFAULT 0,
  confidentiality public.confidentiality_level NOT NULL DEFAULT 'public',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.okrs TO authenticated;
GRANT ALL ON public.okrs TO service_role;
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ok r" ON public.okrs FOR SELECT TO authenticated USING (public.can_access_confidential(auth.uid(), confidentiality));
CREATE POLICY "ok w" ON public.okrs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.okr_decision_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id uuid REFERENCES public.okrs(id) ON DELETE CASCADE,
  pack_slug text, decision_id uuid REFERENCES public.decisions(id) ON DELETE SET NULL,
  impact_weight numeric DEFAULT 1, created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.okr_decision_links TO authenticated;
GRANT ALL ON public.okr_decision_links TO service_role;
ALTER TABLE public.okr_decision_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "okl r" ON public.okr_decision_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "okl w" ON public.okr_decision_links FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.field_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug text, target_role text NOT NULL,
  title text NOT NULL, summary text,
  key_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_briefs TO authenticated;
GRANT ALL ON public.field_briefs TO service_role;
ALTER TABLE public.field_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb r" ON public.field_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fb w" ON public.field_briefs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.board_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  title text NOT NULL, meeting_date date,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  generated_at timestamptz, created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_packs TO authenticated;
GRANT ALL ON public.board_packs TO service_role;
ALTER TABLE public.board_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp r" ON public.board_packs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));
CREATE POLICY "bp w" ON public.board_packs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, jurisdiction text, source_url text,
  status text NOT NULL DEFAULT 'monitoring',
  effective_date date, summary text, severity text DEFAULT 'medium',
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulations TO authenticated;
GRANT ALL ON public.regulations TO service_role;
ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rg r" ON public.regulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "rg w" ON public.regulations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.regulation_pack_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id uuid REFERENCES public.regulations(id) ON DELETE CASCADE,
  pack_slug text NOT NULL, impact text, effort text,
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regulation_pack_impacts TO authenticated;
GRANT ALL ON public.regulation_pack_impacts TO service_role;
ALTER TABLE public.regulation_pack_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rgi r" ON public.regulation_pack_impacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "rgi w" ON public.regulation_pack_impacts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL, role text, organization text,
  influence integer DEFAULT 3, interest integer DEFAULT 3,
  posture text DEFAULT 'neutral', notes text,
  confidentiality public.confidentiality_level NOT NULL DEFAULT 'restricted',
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stakeholders TO authenticated;
GRANT ALL ON public.stakeholders TO service_role;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sh r" ON public.stakeholders FOR SELECT TO authenticated USING (public.can_access_confidential(auth.uid(), confidentiality));
CREATE POLICY "sh w" ON public.stakeholders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.stakeholder_decision_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id uuid REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  pack_slug text, decision_id uuid REFERENCES public.decisions(id) ON DELETE SET NULL,
  raci text NOT NULL DEFAULT 'I', created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stakeholder_decision_roles TO authenticated;
GRANT ALL ON public.stakeholder_decision_roles TO service_role;
ALTER TABLE public.stakeholder_decision_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdr r" ON public.stakeholder_decision_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdr w" ON public.stakeholder_decision_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.crisis_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, severity text NOT NULL DEFAULT 'high',
  status text NOT NULL DEFAULT 'open',
  triggered_at timestamptz DEFAULT now(), resolved_at timestamptz,
  protocol jsonb NOT NULL DEFAULT '[]'::jsonb,
  communications jsonb NOT NULL DEFAULT '[]'::jsonb,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidentiality public.confidentiality_level NOT NULL DEFAULT 'comex',
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crisis_events TO authenticated;
GRANT ALL ON public.crisis_events TO service_role;
ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce r" ON public.crisis_events FOR SELECT TO authenticated USING (public.can_access_confidential(auth.uid(), confidentiality));
CREATE POLICY "ce w" ON public.crisis_events FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.esg_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, unit text,
  baseline numeric, current_value numeric, target numeric,
  category text NOT NULL DEFAULT 'carbon', period text,
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esg_metrics TO authenticated;
GRANT ALL ON public.esg_metrics TO service_role;
ALTER TABLE public.esg_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esg r" ON public.esg_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "esg w" ON public.esg_metrics FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.decision_esg_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug text, decision_id uuid REFERENCES public.decisions(id) ON DELETE SET NULL,
  metric_id uuid REFERENCES public.esg_metrics(id) ON DELETE CASCADE,
  delta numeric NOT NULL DEFAULT 0, rationale text,
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_esg_impacts TO authenticated;
GRANT ALL ON public.decision_esg_impacts TO service_role;
ALTER TABLE public.decision_esg_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ei r" ON public.decision_esg_impacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ei w" ON public.decision_esg_impacts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.ma_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  name text NOT NULL, sector text, country text,
  revenue numeric, ebitda numeric, ebitda_multiple numeric,
  stage text NOT NULL DEFAULT 'screening',
  fit_score numeric, notes text,
  confidentiality public.confidentiality_level NOT NULL DEFAULT 'comex',
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ma_targets TO authenticated;
GRANT ALL ON public.ma_targets TO service_role;
ALTER TABLE public.ma_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ma r" ON public.ma_targets FOR SELECT TO authenticated USING (public.can_access_confidential(auth.uid(), confidentiality));
CREATE POLICY "ma w" ON public.ma_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.ma_synergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid REFERENCES public.ma_targets(id) ON DELETE CASCADE,
  category text NOT NULL, value_eur numeric, realization_months integer,
  confidence numeric, notes text,
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ma_synergies TO authenticated;
GRANT ALL ON public.ma_synergies TO service_role;
ALTER TABLE public.ma_synergies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sy r" ON public.ma_synergies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ma_targets t WHERE t.id = ma_synergies.target_id AND public.can_access_confidential(auth.uid(), t.confidentiality)));
CREATE POLICY "sy w" ON public.ma_synergies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comex'));

CREATE TABLE IF NOT EXISTS public.talent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL, role text, level text,
  hire_date date, performance text, potential text,
  succession_for text, retention_risk text DEFAULT 'low',
  compensation_band text, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_profiles TO authenticated;
GRANT ALL ON public.talent_profiles TO service_role;
ALTER TABLE public.talent_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp r" ON public.talent_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'rh') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tp w" ON public.talent_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'rh') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'rh') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.talent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id uuid REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  decision_type text NOT NULL, rationale text,
  decided_at timestamptz DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_decisions TO authenticated;
GRANT ALL ON public.talent_decisions TO service_role;
ALTER TABLE public.talent_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "td r" ON public.talent_decisions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'rh') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "td w" ON public.talent_decisions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'rh') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'rh') OR public.has_role(auth.uid(),'admin'));

DO $$ BEGIN CREATE TRIGGER t_cs_u BEFORE UPDATE ON public.comex_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER t_ok_u BEFORE UPDATE ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER t_fb_u BEFORE UPDATE ON public.field_briefs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER t_bp_u BEFORE UPDATE ON public.board_packs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER t_rg_u BEFORE UPDATE ON public.regulations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER t_tp_u BEFORE UPDATE ON public.talent_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE mid uuid;
BEGIN
  SELECT id INTO mid FROM public.missions WHERE client_name ILIKE '%lumen%' LIMIT 1;
  IF mid IS NULL THEN RETURN; END IF;

  INSERT INTO public.regulations (name, jurisdiction, status, effective_date, summary, severity, tags) VALUES
    ('CSRD - Corporate Sustainability Reporting','EU','active','2024-01-01','Reporting ESG obligatoire','high','["ESG"]'::jsonb),
    ('EU AI Act','EU','imminent','2026-08-01','Classification IA à risque','high','["IA"]'::jsonb),
    ('DSA - Digital Services Act','EU','active','2024-02-17','Modération contenus DTC','medium','["digital"]'::jsonb);

  INSERT INTO public.esg_metrics (name, unit, baseline, current_value, target, category, period) VALUES
    ('Émissions Scope 1+2','tCO2e',12500,11200,8000,'carbon','2026'),
    ('Émissions Scope 3','tCO2e',58000,55300,40000,'carbon','2026'),
    ('Eau tannerie','m3',180000,162000,120000,'water','2026'),
    ('% femmes COMEX','%',33,40,50,'social','2026');

  INSERT INTO public.okrs (mission_id, objective, key_results, owner, period, progress, confidentiality) VALUES
    (mid,'Doubler la marge DTC US','[{"kr":"+18% revenue","target":18,"current":7},{"kr":"NPS > 65","target":65,"current":58}]'::jsonb,'CEO','H1 2026',38,'restricted'),
    (mid,'Décarboner la chaîne -30%','[{"kr":"Top 50 fournisseurs scorés","target":50,"current":34}]'::jsonb,'COO','2026',45,'public'),
    (mid,'Préparer acquisition Rousseau','[{"kr":"Due diligence finalisée","target":1,"current":0.7}]'::jsonb,'CEO','Q2 2026',50,'comex');

  INSERT INTO public.ma_targets (name, sector, country, revenue, ebitda, ebitda_multiple, stage, fit_score, notes) VALUES
    ('Maison Rousseau','Parfumerie de niche','France',42000000,8400000,11.5,'due_diligence',8.5,'Synergies DTC + cross-sell VIP'),
    ('Atelier Pellame','Maroquinerie','Italie',18000000,3200000,9,'screening',7.2,'Capacité cuir additionnelle'),
    ('Lumière Hospitality','Hôtellerie luxe','France',95000000,19000000,10.5,'monitoring',6.0,'Diversification, hors cœur');

  INSERT INTO public.field_briefs (pack_slug, target_role, title, summary, key_actions, kpis) VALUES
    ('pricing-strategy','Directeur Boutique','Brief Pricing Q2','Nouvelles grilles + storytelling','["Former équipe","Suivre conversion Top 20"]'::jsonb,'[{"name":"Panier moyen","target":"+8%"}]'::jsonb),
    ('supply-chain','Responsable Atelier','Brief Supply','Planning aligné o9','["Valider charge hebdo"]'::jsonb,'[{"name":"OTIF","target":"97%"}]'::jsonb);

  INSERT INTO public.stakeholders (full_name, role, organization, influence, interest, posture, confidentiality) VALUES
    ('Famille Lumen','Actionnaire familial','Lumen Holding',5,5,'champion','restricted'),
    ('Comité bienveillance ESG','Comité externe','Maison Lumen',3,5,'critic','public'),
    ('BNP Paribas','Banque conseil','BNP CIB',4,3,'neutral','restricted');

  INSERT INTO public.crisis_events (title, severity, status, protocol, confidentiality) VALUES
    ('Simulation : rappel produit cuir L7','critical','closed','[{"step":"Stopper production","done":true},{"step":"Communication VIP","done":true}]'::jsonb,'comex');

  INSERT INTO public.talent_profiles (full_name, role, level, performance, potential, succession_for, retention_risk, compensation_band) VALUES
    ('Camille D.','Directrice Pricing','C-1','exceeds','high','VP Pricing','medium','C1-A'),
    ('Julien M.','Head of DTC US','C-2','meets','high','Directeur DTC Monde','high','C2-B'),
    ('Sophia R.','Maître artisan cuir','C-3','exceeds','medium','Chef atelier','low','C3-A');
END $$;
