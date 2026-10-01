-- Studio Aura et AURA Connect : registre partagé, mappings par attribut et alertes.
-- Aucun secret brut n'est stocké : aura_connect_sources.secret_ref référence le coffre du déploiement.

create table if not exists public.aura_studio_contexts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Contexte Aura',
  sector text not null default 'General',
  client_name text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  draft jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_studio_members (
  context_id uuid not null references public.aura_studio_contexts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'reader' check (role in ('owner','admin','architect','data_owner','reader')),
  created_at timestamptz not null default now(),
  primary key (context_id, user_id)
);

create table if not exists public.aura_studio_elements (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.aura_studio_contexts(id) on delete cascade,
  kind text not null check (kind in ('capability','application','business_object','attribute','signal_rule')),
  external_key text,
  label text not null,
  parent_id uuid references public.aura_studio_elements(id) on delete cascade,
  level smallint check (level between 1 and 3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (context_id, kind, external_key)
);

create table if not exists public.aura_studio_relations (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.aura_studio_contexts(id) on delete cascade,
  from_element_id uuid not null references public.aura_studio_elements(id) on delete cascade,
  to_element_id uuid not null references public.aura_studio_elements(id) on delete cascade,
  relation text not null check (relation in ('contains','covers','requires','master','contributor','consumer','uses')),
  metadata jsonb not null default '{}'::jsonb,
  unique (context_id, from_element_id, to_element_id, relation)
);

create table if not exists public.aura_connect_sources (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.aura_studio_contexts(id) on delete cascade,
  application_element_id uuid references public.aura_studio_elements(id) on delete set null,
  label text not null,
  source_type text not null,
  environment text,
  endpoint text,
  auth_mode text,
  secret_ref text,
  enabled boolean not null default true,
  status text not null default 'configured' check (status in ('configured','connected','error','paused')),
  sync_minutes integer check (sync_minutes is null or sync_minutes between 1 and 10080),
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_connect_fields (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.aura_connect_sources(id) on delete cascade,
  path text not null,
  data_type text,
  sample_masked jsonb not null default '[]'::jsonb,
  discovered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (source_id, path)
);

create table if not exists public.aura_attribute_mappings (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.aura_studio_contexts(id) on delete cascade,
  attribute_element_id uuid not null references public.aura_studio_elements(id) on delete cascade,
  source_field_id uuid not null references public.aura_connect_fields(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  method text not null default 'manual' check (method in ('deterministic','semantic','llm','manual')),
  confidence numeric(5,4) check (confidence is null or (confidence between 0 and 1)),
  is_master boolean not null default false,
  rationale text,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (context_id, attribute_element_id, source_field_id)
);
create unique index if not exists aura_one_master_per_attribute
  on public.aura_attribute_mappings(context_id, attribute_element_id)
  where is_master and status = 'accepted';

create table if not exists public.aura_alert_events (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.aura_studio_contexts(id) on delete cascade,
  rule_element_id uuid references public.aura_studio_elements(id) on delete set null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  facts jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','decision_opened','closed')),
  occurred_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  decision_ref text
);

create or replace function public.aura_can_access_context(_context_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.aura_studio_contexts c
    where c.id = _context_id and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.aura_studio_members m
    where m.context_id = _context_id and m.user_id = auth.uid()
  );
$$;

alter table public.aura_studio_contexts enable row level security;
alter table public.aura_studio_members enable row level security;
alter table public.aura_studio_elements enable row level security;
alter table public.aura_studio_relations enable row level security;
alter table public.aura_connect_sources enable row level security;
alter table public.aura_connect_fields enable row level security;
alter table public.aura_attribute_mappings enable row level security;
alter table public.aura_alert_events enable row level security;

create policy "studio contexts read" on public.aura_studio_contexts for select using (public.aura_can_access_context(id));
create policy "studio contexts create" on public.aura_studio_contexts for insert with check (owner_id = auth.uid());
create policy "studio contexts update" on public.aura_studio_contexts for update using (public.aura_can_access_context(id));
create policy "studio contexts delete" on public.aura_studio_contexts for delete using (owner_id = auth.uid());

create policy "studio members read" on public.aura_studio_members for select using (public.aura_can_access_context(context_id));
create policy "studio members manage" on public.aura_studio_members for all using (
  exists (select 1 from public.aura_studio_contexts c where c.id = context_id and c.owner_id = auth.uid())
) with check (
  exists (select 1 from public.aura_studio_contexts c where c.id = context_id and c.owner_id = auth.uid())
);

create policy "studio elements access" on public.aura_studio_elements for all using (public.aura_can_access_context(context_id)) with check (public.aura_can_access_context(context_id));
create policy "studio relations access" on public.aura_studio_relations for all using (public.aura_can_access_context(context_id)) with check (public.aura_can_access_context(context_id));
create policy "connect sources access" on public.aura_connect_sources for all using (public.aura_can_access_context(context_id)) with check (public.aura_can_access_context(context_id));
create policy "connect fields access" on public.aura_connect_fields for all using (
  exists (select 1 from public.aura_connect_sources s where s.id = source_id and public.aura_can_access_context(s.context_id))
) with check (
  exists (select 1 from public.aura_connect_sources s where s.id = source_id and public.aura_can_access_context(s.context_id))
);
create policy "attribute mappings access" on public.aura_attribute_mappings for all using (public.aura_can_access_context(context_id)) with check (public.aura_can_access_context(context_id));
create policy "alert events access" on public.aura_alert_events for all using (public.aura_can_access_context(context_id)) with check (public.aura_can_access_context(context_id));

create index if not exists aura_elements_context_kind_idx on public.aura_studio_elements(context_id, kind);
create index if not exists aura_sources_context_idx on public.aura_connect_sources(context_id);
create index if not exists aura_alerts_context_status_idx on public.aura_alert_events(context_id, status, occurred_at desc);
