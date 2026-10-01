-- ============================================================================
-- Référentiel d'entreprise partagé + gouvernance + boucle valeur + catalogue
-- ============================================================================

CREATE TYPE public.ea_lifecycle AS ENUM ('propose', 'valide', 'obsolete');
CREATE TYPE public.ea_object_kind AS ENUM ('objet_metier', 'application', 'capacite', 'domaine_donnees', 'indicateur');
CREATE TYPE public.ea_approval_action AS ENUM ('soumis', 'approuve', 'rejete');
CREATE TYPE public.ea_criticality AS ENUM ('vitale', 'importante', 'secondaire');
CREATE TYPE public.ea_value_verdict AS ENUM ('en_attente', 'atteint', 'partiel', 'non_atteint');

-- ── 1. Le référentiel partagé ───────────────────────────────────────────────
CREATE TABLE public.ea_objects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL,
  kind public.ea_object_kind NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  owner_label TEXT,
  lifecycle public.ea_lifecycle NOT NULL DEFAULT 'propose',
  -- provenance : [{ space: 'studio'|'architecturer'|'decider', local_id, label }]
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT NOT NULL DEFAULT 1,
  validated_at TIMESTAMPTZ,
  validated_by TEXT,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, object_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ea_objects TO authenticated;
GRANT ALL ON public.ea_objects TO service_role;
ALTER TABLE public.ea_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_objects_own" ON public.ea_objects FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_ea_objects_updated BEFORE UPDATE ON public.ea_objects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ea_objects_user_kind ON public.ea_objects (user_id, kind);

-- ── 2. Historique immuable des objets ───────────────────────────────────────
CREATE TABLE public.ea_object_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  object_id UUID NOT NULL REFERENCES public.ea_objects(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  change_note TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (object_id, version)
);
GRANT SELECT, INSERT ON public.ea_object_versions TO authenticated;
GRANT ALL ON public.ea_object_versions TO service_role;
ALTER TABLE public.ea_object_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_object_versions_read" ON public.ea_object_versions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ea_object_versions_append" ON public.ea_object_versions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── 3. Registre d'approbation (append-only) ─────────────────────────────────
CREATE TABLE public.ea_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_label TEXT,
  subject_version INT,
  action public.ea_approval_action NOT NULL,
  actor_label TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ea_approvals TO authenticated;
GRANT ALL ON public.ea_approvals TO service_role;
ALTER TABLE public.ea_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_approvals_read" ON public.ea_approvals FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ea_approvals_append" ON public.ea_approvals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_ea_approvals_subject ON public.ea_approvals (user_id, subject_type, subject_id);

-- ── 4. Versions de l'architecture cible ─────────────────────────────────────
CREATE TABLE public.ea_arch_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  study_id TEXT NOT NULL,
  study_title TEXT,
  version INT NOT NULL,
  label TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  gap JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.ea_approval_action,
  submitted_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, study_id, version)
);
GRANT SELECT, INSERT, UPDATE ON public.ea_arch_versions TO authenticated;
GRANT ALL ON public.ea_arch_versions TO service_role;
ALTER TABLE public.ea_arch_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_arch_versions_own" ON public.ea_arch_versions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ea_arch_versions_insert" ON public.ea_arch_versions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ea_arch_versions_decide" ON public.ea_arch_versions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 5. Journal d'écart As-Is / Cible dans le temps ──────────────────────────
CREATE TABLE public.ea_gap_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  study_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  apps_as_is INT NOT NULL DEFAULT 0,
  apps_cible INT NOT NULL DEFAULT 0,
  apps_nouvelles INT NOT NULL DEFAULT 0,
  l4_nouvelles INT NOT NULL DEFAULT 0,
  capacites_non_rattachees INT NOT NULL DEFAULT 0,
  exigences_sans_besoin INT NOT NULL DEFAULT 0,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ea_gap_log TO authenticated;
GRANT ALL ON public.ea_gap_log TO service_role;
ALTER TABLE public.ea_gap_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_gap_log_read" ON public.ea_gap_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ea_gap_log_append" ON public.ea_gap_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_ea_gap_log_study ON public.ea_gap_log (user_id, study_id, observed_at DESC);

-- ── 6. Catalogue applicatif comme actif piloté ──────────────────────────────
CREATE TABLE public.ea_app_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  ea_object_id UUID REFERENCES public.ea_objects(id) ON DELETE SET NULL,
  study_id TEXT,
  app_local_id TEXT,
  app_label TEXT NOT NULL,
  owner_label TEXT,
  owner_email TEXT,
  criticality public.ea_criticality,
  annual_cost_eur NUMERIC,
  end_of_life_on DATE,
  hosting TEXT,
  tech_obsolescence_years NUMERIC,
  users_count INT,
  lifecycle public.ea_lifecycle NOT NULL DEFAULT 'propose',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ea_app_catalog TO authenticated;
GRANT ALL ON public.ea_app_catalog TO service_role;
ALTER TABLE public.ea_app_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_app_catalog_own" ON public.ea_app_catalog FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_ea_app_catalog_updated BEFORE UPDATE ON public.ea_app_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ea_app_catalog_user ON public.ea_app_catalog (user_id, app_label);

-- ── 7. Boucle valeur : story livrée → indicateur observé ────────────────────
CREATE TABLE public.ea_value_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  study_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  feature_label TEXT,
  story_id TEXT,
  story_text TEXT,
  besoin_ids TEXT[] NOT NULL DEFAULT '{}',
  exigence_ids TEXT[] NOT NULL DEFAULT '{}',
  kpi_key TEXT NOT NULL,
  kpi_label TEXT NOT NULL,
  kpi_unit TEXT,
  baseline_value NUMERIC,
  target_value NUMERIC,
  observed_value NUMERIC,
  observed_at TIMESTAMPTZ,
  observed_source TEXT,
  verdict public.ea_value_verdict NOT NULL DEFAULT 'en_attente',
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ea_value_links TO authenticated;
GRANT ALL ON public.ea_value_links TO service_role;
ALTER TABLE public.ea_value_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ea_value_links_own" ON public.ea_value_links FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_ea_value_links_updated BEFORE UPDATE ON public.ea_value_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ea_value_links_study ON public.ea_value_links (user_id, study_id);