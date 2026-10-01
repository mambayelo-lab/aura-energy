-- Couche d'intégration de données : configuration versionnée, état léger, journal des relevés, cache L2.
-- Aucun secret : la configuration ne contient que des références {{env:NOM}} résolues côté serveur.

create table if not exists public.aura_int_configs (
  id bigserial primary key,
  workspace text not null,
  version integer not null,
  setup jsonb not null,
  saved_by text,
  created_at timestamptz not null default now(),
  unique (workspace, version)
);

create table if not exists public.aura_int_state (
  workspace text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_int_runs (
  id bigserial primary key,
  workspace text not null,
  run jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists aura_int_runs_ws_idx on public.aura_int_runs (workspace, created_at desc);

-- Cache L2 partagé (1 h) : résultats agrégés, jamais de lignes brutes.
create table if not exists public.aura_int_cache (
  key text primary key,
  value jsonb not null,
  stored_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists aura_int_cache_exp_idx on public.aura_int_cache (expires_at);

-- Accès réservé au serveur (service role) : RLS activée, aucune politique publique.
alter table public.aura_int_configs enable row level security;
alter table public.aura_int_state enable row level security;
alter table public.aura_int_runs enable row level security;
alter table public.aura_int_cache enable row level security;

-- Planification alternative à Vercel Cron (extension pg_cron + pg_net), à activer si besoin :
-- select cron.schedule('aura-integration-jour', '0 7-19/3 * * *', $$ select net.http_get('https://<domaine>/api/integration/cron', headers => jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))) $$);
-- select cron.schedule('aura-integration-nuit', '15 2 * * *', $$ select net.http_get('https://<domaine>/api/integration/cron?mode=full', headers => jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))) $$);
