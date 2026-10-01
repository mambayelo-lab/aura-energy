create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.decision_packs(id) on delete cascade,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decisions_user_idx on public.decisions(user_id, updated_at desc);
grant select, insert, update, delete on public.decisions to authenticated;
grant all on public.decisions to service_role;
alter table public.decisions enable row level security;
create policy "owner select" on public.decisions for select to authenticated using (user_id = auth.uid());
create policy "owner insert" on public.decisions for insert to authenticated with check (user_id = auth.uid());
create policy "owner update" on public.decisions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner delete" on public.decisions for delete to authenticated using (user_id = auth.uid());