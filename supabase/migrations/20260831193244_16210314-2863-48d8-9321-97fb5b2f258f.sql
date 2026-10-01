CREATE TABLE public.tracked_combos (
  id uuid primary key default gen_random_uuid(),
  local_id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  session_id text not null,
  session_title text not null default '',
  name text not null,
  statut text not null default 'candidate',
  version integer not null default 1,
  leviers jsonb not null default '[]'::jsonb,
  verdict_initial jsonb not null default '{}'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  preuves jsonb not null default '[]'::jsonb,
  signature jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, local_id)
);

CREATE TABLE public.combo_avis (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.tracked_combos(id) on delete cascade,
  nom text not null,
  role text,
  position text not null check (position in ('pour','reserve','contre')),
  reserve text,
  levee boolean not null default false,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_combos TO authenticated;
GRANT ALL ON public.tracked_combos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.combo_avis TO authenticated;
GRANT ALL ON public.combo_avis TO service_role;

ALTER TABLE public.tracked_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_avis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their tracked combos" ON public.tracked_combos
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners read avis on their combos" ON public.combo_avis
  FOR SELECT TO authenticated USING (exists (select 1 from public.tracked_combos t where t.id = combo_avis.combo_id and t.owner_id = auth.uid()));
CREATE POLICY "Owners update avis on their combos" ON public.combo_avis
  FOR UPDATE TO authenticated USING (exists (select 1 from public.tracked_combos t where t.id = combo_avis.combo_id and t.owner_id = auth.uid()));
CREATE POLICY "Owners delete avis on their combos" ON public.combo_avis
  FOR DELETE TO authenticated USING (exists (select 1 from public.tracked_combos t where t.id = combo_avis.combo_id and t.owner_id = auth.uid()));

CREATE INDEX combo_avis_combo_idx ON public.combo_avis(combo_id);
CREATE INDEX tracked_combos_session_idx ON public.tracked_combos(owner_id, session_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_tracked_combos_updated_at BEFORE UPDATE ON public.tracked_combos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();