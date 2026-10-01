-- Partage d'analyses V2 : analyses publiées, invitations, propositions, notifications.

CREATE TABLE public.v2_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  thread_id text NOT NULL,
  titre text NOT NULL DEFAULT '',
  contenu jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, thread_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_analyses TO authenticated;
GRANT ALL ON public.v2_analyses TO service_role;
ALTER TABLE public.v2_analyses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.v2_partages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analyse_id uuid NOT NULL REFERENCES public.v2_analyses(id) ON DELETE CASCADE,
  invite_email text NOT NULL,
  invite_user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  droit text NOT NULL DEFAULT 'contribution',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analyse_id, invite_email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_partages TO authenticated;
GRANT ALL ON public.v2_partages TO service_role;
ALTER TABLE public.v2_partages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.v2_propositions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analyse_id uuid NOT NULL REFERENCES public.v2_analyses(id) ON DELETE CASCADE,
  auteur_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  auteur_nom text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'levier',
  label text NOT NULL,
  detail text NOT NULL DEFAULT '',
  statut text NOT NULL DEFAULT 'en_attente',
  motif text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_propositions TO authenticated;
GRANT ALL ON public.v2_propositions TO service_role;
ALTER TABLE public.v2_propositions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.v2_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destinataire_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  analyse_id uuid REFERENCES public.v2_analyses(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'proposition',
  titre text NOT NULL,
  corps text NOT NULL DEFAULT '',
  lu boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_notifications TO authenticated;
GRANT ALL ON public.v2_notifications TO service_role;
ALTER TABLE public.v2_notifications ENABLE ROW LEVEL SECURITY;

-- Accès partagé : évalué sans récursion via une fonction security definer.
CREATE OR REPLACE FUNCTION public.v2_est_invite(_analyse uuid, _droit text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.v2_partages p
    WHERE p.analyse_id = _analyse
      AND (p.invite_user_id = auth.uid()
           OR lower(p.invite_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      AND (_droit IS NULL OR p.droit = _droit)
  )
$$;

CREATE OR REPLACE FUNCTION public.v2_est_proprietaire(_analyse uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.v2_analyses a
    WHERE a.id = _analyse AND a.owner_id = auth.uid()
  )
$$;

CREATE POLICY "Proprietaire gere ses analyses" ON public.v2_analyses
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Invite lit l analyse partagee" ON public.v2_analyses
  FOR SELECT TO authenticated USING (public.v2_est_invite(id));

CREATE POLICY "Proprietaire gere les partages" ON public.v2_partages
  FOR ALL TO authenticated
  USING (public.v2_est_proprietaire(analyse_id))
  WITH CHECK (public.v2_est_proprietaire(analyse_id));
CREATE POLICY "Invite voit son partage" ON public.v2_partages
  FOR SELECT TO authenticated
  USING (invite_user_id = auth.uid() OR lower(invite_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Proprietaire lit les propositions" ON public.v2_propositions
  FOR SELECT TO authenticated USING (public.v2_est_proprietaire(analyse_id));
CREATE POLICY "Proprietaire arbitre les propositions" ON public.v2_propositions
  FOR UPDATE TO authenticated
  USING (public.v2_est_proprietaire(analyse_id))
  WITH CHECK (public.v2_est_proprietaire(analyse_id));
CREATE POLICY "Auteur lit ses propositions" ON public.v2_propositions
  FOR SELECT TO authenticated USING (auteur_id = auth.uid());
CREATE POLICY "Contributeur depose une proposition" ON public.v2_propositions
  FOR INSERT TO authenticated
  WITH CHECK (auteur_id = auth.uid() AND public.v2_est_invite(analyse_id, 'contribution'));

CREATE POLICY "Chacun lit ses notifications" ON public.v2_notifications
  FOR SELECT TO authenticated USING (destinataire_id = auth.uid());
CREATE POLICY "Chacun marque ses notifications" ON public.v2_notifications
  FOR UPDATE TO authenticated
  USING (destinataire_id = auth.uid()) WITH CHECK (destinataire_id = auth.uid());

CREATE TRIGGER trg_v2_analyses_updated BEFORE UPDATE ON public.v2_analyses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_v2_propositions_updated BEFORE UPDATE ON public.v2_propositions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_v2_partages_email ON public.v2_partages (lower(invite_email));
CREATE INDEX idx_v2_propositions_analyse ON public.v2_propositions (analyse_id, statut);
CREATE INDEX idx_v2_notifications_dest ON public.v2_notifications (destinataire_id, lu);