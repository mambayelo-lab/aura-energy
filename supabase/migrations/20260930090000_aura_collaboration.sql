-- Collaboration dans Supply : l'espace partagé est l'organisation (invitations
-- existantes, Compte → Équipe & accès). Commentaires sur une alerte ou une
-- décision (avec mentions @), assignation d'une alerte à une personne avec
-- statut, fil d'activité. Droits : rôles existants (aura_has_role) :
--   lecteur  : lit commentaires, assignations et activité ;
--   analyste : commente, assigne, change le statut (action « comment.write ») ;
--   administrateur : idem, et supprime un commentaire.
-- Le fil d'activité est en ajout seul, comme le journal d'audit.

-- 1. Commentaires (alerte ou décision).
create table if not exists public.aura_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('alerte', 'decision')),
  target_id text not null check (char_length(target_id) between 1 and 200),
  user_id uuid not null default auth.uid() references auth.users(id) on delete set null,
  user_email text,
  body text not null check (char_length(body) between 1 and 4000),
  mentions text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists aura_comments_target on public.aura_comments (org_id, target_type, target_id, created_at);
alter table public.aura_comments enable row level security;

create policy "aura_comments_read" on public.aura_comments for select
  using (public.aura_has_role(org_id, 'lecteur'));
create policy "aura_comments_insert" on public.aura_comments for insert
  with check (user_id = auth.uid() and public.aura_has_role(org_id, 'analyste'));
create policy "aura_comments_delete_admin" on public.aura_comments for delete
  using (public.aura_has_role(org_id, 'administrateur'));
revoke update on public.aura_comments from anon, authenticated;

-- 2. Assignation d'une alerte (une par alerte et par organisation).
create table if not exists public.aura_assignments (
  org_id uuid not null references public.organizations(id) on delete cascade,
  alert_id text not null check (char_length(alert_id) between 1 and 200),
  assignee_email text,
  status text not null default 'a_traiter' check (status in ('a_traiter', 'en_cours', 'traite')),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by_email text,
  updated_at timestamptz not null default now(),
  primary key (org_id, alert_id)
);
alter table public.aura_assignments enable row level security;

create policy "aura_assignments_read" on public.aura_assignments for select
  using (public.aura_has_role(org_id, 'lecteur'));
create policy "aura_assignments_insert" on public.aura_assignments for insert
  with check (updated_by = auth.uid() and public.aura_has_role(org_id, 'analyste'));
create policy "aura_assignments_update" on public.aura_assignments for update
  using (public.aura_has_role(org_id, 'analyste'))
  with check (updated_by = auth.uid() and public.aura_has_role(org_id, 'analyste'));

-- 3. Fil d'activité (ajout seul).
create table if not exists public.aura_activity (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_email text,
  kind text not null check (kind in ('commentaire', 'mention', 'assignation', 'statut')),
  target_type text not null check (target_type in ('alerte', 'decision')),
  target_id text not null,
  summary text not null check (char_length(summary) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists aura_activity_org_time on public.aura_activity (org_id, created_at desc);
alter table public.aura_activity enable row level security;

create policy "aura_activity_read" on public.aura_activity for select
  using (public.aura_has_role(org_id, 'lecteur'));
create policy "aura_activity_insert" on public.aura_activity for insert
  with check (user_id = auth.uid() and public.aura_has_role(org_id, 'analyste'));

create or replace function public.aura_activity_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Fil d''activité en ajout seul : modification interdite';
end $$;
drop trigger if exists aura_activity_no_update on public.aura_activity;
-- Mise à jour interdite ; la suppression reste réservée à la cascade d'une organisation supprimée
-- (droit delete retiré aux clients ci-dessous).
create trigger aura_activity_no_update before update on public.aura_activity
  for each row execute function public.aura_activity_immutable();
revoke update, delete, truncate on public.aura_activity from anon, authenticated;
