create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'essai' check (plan in ('essai','decider','architecturer','plateforme')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','expired')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);
grant select, insert, update on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own subscription read" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own subscription insert" on public.subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own subscription update" on public.subscriptions for update to authenticated using (user_id = auth.uid());

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy "own usage read" on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy "own usage insert" on public.ai_usage for insert to authenticated with check (user_id = auth.uid());
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

create or replace function public.has_platform_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = _user_id
      and (s.status = 'active'
        or (s.status = 'trialing' and s.trial_ends_at > now()))
  )
$$;