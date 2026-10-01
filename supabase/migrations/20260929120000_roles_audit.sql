-- Rôles (lecteur, analyste, administrateur), rattachement à une organisation et journal d'audit.
-- Le journal est en ajout seul : aucune mise à jour ni suppression, même par le service.

-- 1. Rôles : « admin » (et « owner ») = administrateur, « member » = analyste (valeurs
--    historiques conservées pour les policies existantes) ; « lecteur » est ajouté.
alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'member', 'analyste', 'lecteur'));

create or replace function public.aura_role(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when role in ('owner', 'admin') then 'administrateur' when role in ('member', 'analyste') then 'analyste' else 'lecteur' end
  from organization_members where org_id = p_org and user_id = auth.uid() limit 1
$$;

create or replace function public.aura_has_role(p_org uuid, p_min text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case public.aura_role(p_org)
      when 'administrateur' then 3 when 'analyste' then 2 when 'lecteur' then 1 else 0 end
  ) >= case p_min when 'administrateur' then 3 when 'analyste' then 2 else 1 end, false)
$$;

-- Les administrateurs gèrent les rôles des membres de leur organisation.
drop policy if exists "aura_members_admin_update" on public.organization_members;
create policy "aura_members_admin_update" on public.organization_members
  for update using (public.aura_has_role(org_id, 'administrateur'))
  with check (public.aura_has_role(org_id, 'administrateur'));

-- 2. Intégration de données : l'espace de travail est l'organisation.
alter table public.aura_int_configs add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.aura_int_state add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.aura_int_runs add column if not exists org_id uuid references public.organizations(id) on delete cascade;

create policy "aura_int_configs_read" on public.aura_int_configs for select using (public.aura_has_role(org_id, 'lecteur'));
create policy "aura_int_configs_write" on public.aura_int_configs for insert with check (public.aura_has_role(org_id, 'administrateur'));
create policy "aura_int_state_read" on public.aura_int_state for select using (public.aura_has_role(org_id, 'lecteur'));
create policy "aura_int_state_write" on public.aura_int_state for all using (public.aura_has_role(org_id, 'administrateur')) with check (public.aura_has_role(org_id, 'administrateur'));
create policy "aura_int_runs_read" on public.aura_int_runs for select using (public.aura_has_role(org_id, 'lecteur'));

-- 3. Journal d'audit : qui a fait quoi et quand.
create table if not exists public.aura_audit_log (
  id bigserial primary key,
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists aura_audit_org_time on public.aura_audit_log (org_id, created_at desc);
alter table public.aura_audit_log enable row level security;

create policy "aura_audit_insert_self" on public.aura_audit_log for insert
  with check (user_id = auth.uid() and (org_id is null or public.aura_has_role(org_id, 'lecteur')));
create policy "aura_audit_read_admin" on public.aura_audit_log for select
  using (org_id is not null and public.aura_has_role(org_id, 'administrateur'));

create or replace function public.aura_audit_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'Journal d''audit en ajout seul : modification et suppression interdites';
end $$;
drop trigger if exists aura_audit_no_update on public.aura_audit_log;
create trigger aura_audit_no_update before update or delete on public.aura_audit_log
  for each row execute function public.aura_audit_immutable();
revoke update, delete, truncate on public.aura_audit_log from anon, authenticated;
