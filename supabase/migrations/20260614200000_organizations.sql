-- Organizations: top-level tenant model for SaaS multi-tenancy
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'starter',
  max_missions int not null default 3,
  max_users int not null default 5,
  ai_calls_used int not null default 0,
  ai_calls_limit int not null default 1000,
  exports_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (org_id, user_id)
);

alter table missions add column if not exists org_id uuid references organizations(id);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  mission_id uuid references missions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table usage_events enable row level security;

create policy "org_members_read" on organizations
  for select using (
    id in (select org_id from organization_members where user_id = auth.uid())
  );

create policy "org_member_list" on organization_members
  for select using (user_id = auth.uid() or org_id in (
    select org_id from organization_members where user_id = auth.uid() and role in ('owner','admin')
  ));

create policy "usage_events_org_read" on usage_events
  for select using (org_id in (
    select org_id from organization_members where user_id = auth.uid() and role in ('owner','admin')
  ));

create policy "usage_events_insert" on usage_events
  for insert with check (true);
