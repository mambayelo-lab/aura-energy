-- Mémoire persistante d'Aura (générique : architect, supply, decider).
-- Projets, versions de modèles, décisions et préférences, par utilisateur.
create table if not exists public.aura_memoire (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product text not null check (product in ('architect', 'supply', 'decider')),
  kind text not null check (kind in ('projet', 'version', 'decision', 'preference')),
  project_id uuid,
  key text,
  label text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aura_memoire_user_product_idx on public.aura_memoire (user_id, product, created_at);
create index if not exists aura_memoire_project_idx on public.aura_memoire (project_id) where project_id is not null;

alter table public.aura_memoire enable row level security;

drop policy if exists "aura_memoire_select_own" on public.aura_memoire;
create policy "aura_memoire_select_own" on public.aura_memoire for select using (auth.uid() = user_id);
drop policy if exists "aura_memoire_insert_own" on public.aura_memoire;
create policy "aura_memoire_insert_own" on public.aura_memoire for insert with check (auth.uid() = user_id);
drop policy if exists "aura_memoire_update_own" on public.aura_memoire;
create policy "aura_memoire_update_own" on public.aura_memoire for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "aura_memoire_delete_own" on public.aura_memoire;
create policy "aura_memoire_delete_own" on public.aura_memoire for delete using (auth.uid() = user_id);
