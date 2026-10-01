create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'trial',
  max_missions int not null default 3,
  max_users int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  invited_at timestamptz not null default now(),
  joined_at timestamptz default now(),
  primary key (org_id, user_id)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token text not null unique,
  invited_by uuid,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists org_invitations_org_idx on public.organization_invitations(org_id);
create index if not exists org_invitations_email_idx on public.organization_invitations(lower(email));

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.missions add column if not exists org_id uuid references public.organizations(id);

grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.organization_invitations to authenticated;
grant select, insert on public.usage_events to authenticated;
grant all on public.organizations to service_role;
grant all on public.organization_members to service_role;
grant all on public.organization_invitations to service_role;
grant all on public.usage_events to service_role;

create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org and user_id = auth.uid())
$$;

create or replace function public.is_org_admin(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org and user_id = auth.uid() and role in ('owner','admin'))
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.usage_events enable row level security;

create policy "org_read" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "org_create" on public.organizations
  for insert to authenticated with check (true);
create policy "org_update" on public.organizations
  for update to authenticated using (public.is_org_admin(id));

create policy "org_members_read" on public.organization_members
  for select to authenticated using (user_id = auth.uid() or public.is_org_admin(org_id));
create policy "org_members_insert" on public.organization_members
  for insert to authenticated with check (user_id = auth.uid() or public.is_org_admin(org_id));
create policy "org_members_update" on public.organization_members
  for update to authenticated using (public.is_org_admin(org_id));
create policy "org_members_delete" on public.organization_members
  for delete to authenticated using (public.is_org_admin(org_id) or user_id = auth.uid());

create policy "org_invitations_read" on public.organization_invitations
  for select to authenticated using (public.is_org_admin(org_id));
create policy "org_invitations_insert" on public.organization_invitations
  for insert to authenticated with check (public.is_org_admin(org_id));
create policy "org_invitations_update" on public.organization_invitations
  for update to authenticated using (public.is_org_admin(org_id));

create policy "usage_events_read" on public.usage_events
  for select to authenticated using (public.is_org_admin(org_id));
create policy "usage_events_insert" on public.usage_events
  for insert to authenticated with check (user_id = auth.uid() and public.is_org_member(org_id));