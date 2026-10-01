
-- 1. Credentials OAuth2 sur source_systems (jamais en dur dans le code)
ALTER TABLE public.source_systems
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS token_url text,
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS client_secret text,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS last_discovery_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_extraction_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS source_systems_mission_slug_idx
  ON public.source_systems(mission_id, slug);

-- 2. Schémas découverts par Argus
CREATE TABLE IF NOT EXISTS public.argus_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  source_system_id uuid REFERENCES public.source_systems(id) ON DELETE CASCADE,
  endpoint_path text NOT NULL,
  http_method text NOT NULL DEFAULT 'GET',
  entity_label text,
  summary text,
  record_count integer,
  sample_record jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_system_id, endpoint_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.argus_schemas TO authenticated;
GRANT ALL ON public.argus_schemas TO service_role;
ALTER TABLE public.argus_schemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY argus_schemas_read ON public.argus_schemas FOR SELECT USING (true);
CREATE POLICY argus_schemas_admin ON public.argus_schemas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Échantillons de champs (alimente le mapping assisté)
CREATE TABLE IF NOT EXISTS public.argus_field_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id uuid NOT NULL REFERENCES public.argus_schemas(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text,
  sample_values jsonb,
  observed_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.argus_field_samples TO authenticated;
GRANT ALL ON public.argus_field_samples TO service_role;
ALTER TABLE public.argus_field_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY argus_field_samples_read ON public.argus_field_samples FOR SELECT USING (true);
CREATE POLICY argus_field_samples_admin ON public.argus_field_samples FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Traçabilité endpoint sur facts
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS source_endpoint text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- 5. Interviews Maison Lumen (5) — décision « Rupture de stock »
DO $$
DECLARE
  v_mission uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.missions WHERE id = v_mission) THEN
    INSERT INTO public.missions(id, client_name, status) VALUES (v_mission, 'Maison Lumen', 'active');
  END IF;

  DELETE FROM public.mission_interviews WHERE mission_id = v_mission;

  INSERT INTO public.mission_interviews(mission_id, interviewee_name, interviewee_role, interviewee_department, interview_date, duration_min, channel, summary, key_verbatims, pain_points, apps_mentioned, transcript) VALUES
  (v_mission, 'Claire Vasseur', 'Directrice Supply Chain', 'Supply', '2026-05-14', 55, 'visio',
    'Décisions de réassort hebdomadaires. Travaille à partir d''exports CSV SAP + tableur. Découvre les ruptures avec 3 à 5 jours de retard.',
    '[{"quote":"Je découvre les ruptures quand les vendeurs m''appellent, pas dans SAP."},{"quote":"On a 6 outils, aucun ne donne le même chiffre de stock."},{"quote":"Le forecast NinePlan, je le regarde tous les lundis, mais je ne le croise jamais avec le stock Meridian en temps réel."}]'::jsonb,
    '[{"label":"Pas de vision unifiée du stock entrepôt + magasin"},{"label":"Latence de 3-5j entre rupture réelle et alerte"},{"label":"Décision d''accélérer un PO prise sans visibilité sur le délai fournisseur"}]'::jsonb,
    ARRAY['NexERP','Meridian','NinePlan','WebStore'],
    'Q: Comment décidez-vous d''accélérer un réassort ? R: À l''instinct, sur la base d''un export hebdo et des appels magasin. Q: Quelles données vous manquent ? R: Le délai réel du fournisseur, le stock magasin temps réel, et la vélocité par SKU.'),
  (v_mission, 'Marc Ottinger', 'Acheteur senior cuir', 'Achats', '2026-05-16', 40, 'présentiel',
    'Pilote 12 fournisseurs cuir Italie/Portugal. Pas d''alerte automatique sur les dérives de délai.',
    '[{"quote":"SUP-007 livre systématiquement en retard depuis 3 mois, personne ne s''en est rendu compte."},{"quote":"Je ne sais pas combien de POs ouverts j''ai sur un fournisseur sans ouvrir SAP manuellement."}]'::jsonb,
    '[{"label":"Dérive SLA fournisseur invisible"},{"label":"Vue agrégée par fournisseur absente"}]'::jsonb,
    ARRAY['NexERP'],
    'Q: Quels signaux vous aideraient ? R: Un alerte dès qu''un fournisseur dépasse son SLA de plus de 5 jours sur 2 commandes consécutives.'),
  (v_mission, 'Léa Bonnard', 'Responsable e-commerce', 'Digital', '2026-05-19', 45, 'visio',
    'Trafic e-shop en hausse. Doit promouvoir les bons produits sans risquer la rupture.',
    '[{"quote":"On a lancé une promo sur les Derby la semaine dernière. Le lendemain, 0 stock. Personne ne m''avait alertée."},{"quote":"Shopify dit qu''il reste 80 unités, Meridian dit 12. Je crois lequel ?"}]'::jsonb,
    '[{"label":"Désynchro stock e-shop vs OMS"},{"label":"Pas de signal pré-promo"}]'::jsonb,
    ARRAY['WebStore','Meridian'],
    'Q: Quel serait le signal idéal avant promo ? R: Un score de disponibilité à 7 jours par SKU, calculé sur le stock réel et la vélocité.'),
  (v_mission, 'Sofiane Mehdaoui', 'Responsable magasin Lyon Part-Dieu', 'Retail', '2026-05-21', 30, 'téléphone',
    'Sur le terrain, voit les ruptures avant tout le monde mais n''a pas d''outil pour faire remonter.',
    '[{"quote":"On vend la dernière paire, on appelle Paris, on attend une semaine."},{"quote":"Si Aura nous disait que la centrale a 200 unités, on irait les chercher."}]'::jsonb,
    '[{"label":"Pas de signal magasin → siège"},{"label":"Pas de visibilité inter-magasins"}]'::jsonb,
    ARRAY['CegX','Meridian'],
    'Q: Que feriez-vous d''un signal Aura ? R: Si je vois rouge sur un SKU, je commande tout de suite, sans demander.'),
  (v_mission, 'Hugo Tremblay', 'DSI', 'IT', '2026-05-23', 60, 'visio',
    'Cartographie SI claire mais aucun référentiel d''attributs métier. Chaque outil a sa propre clé produit.',
    '[{"quote":"SAP parle de Material, Shopify de SKU, Meridian d''itemId. Personne ne sait laquelle est la vérité."},{"quote":"On a 4 sources de stock, aucune n''est canonique."}]'::jsonb,
    '[{"label":"Pas de master data produit unifiée"},{"label":"Mapping cross-systèmes inexistant"}]'::jsonb,
    ARRAY['NexERP','WebStore','Meridian','CegX','SkyCRM','NinePlan'],
    'Q: Que serait un succès ? R: Un contrat sémantique partagé, un mapping versionné, et la possibilité de tracer chaque chiffre jusqu''à l''API source.');
END $$;
