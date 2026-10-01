create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  org_id uuid references public.organizations(id) on delete set null,
  kind text not null,
  space text,
  path text,
  session_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists app_events_created_idx on public.app_events(created_at desc);
create index if not exists app_events_user_idx on public.app_events(user_id, created_at desc);
create index if not exists app_events_kind_idx on public.app_events(kind);

create table if not exists public.decision_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  org_id uuid references public.organizations(id) on delete set null,
  title text not null,
  space text not null default 'decider',
  decision_ref text,
  chosen_option text,
  horizon_label text,
  due_at timestamptz not null,
  status text not null default 'pending',
  verdict text,
  verdict_comment text,
  answered_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists decision_reviews_due_idx on public.decision_reviews(due_at);
create index if not exists decision_reviews_user_idx on public.decision_reviews(user_id, status);

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  org_id uuid references public.organizations(id) on delete set null,
  space text,
  path text,
  rating int,
  category text,
  message text not null,
  status text not null default 'new',
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_feedback_created_idx on public.user_feedback(created_at desc);

grant select, insert on public.app_events to authenticated;
grant select, insert, update, delete on public.decision_reviews to authenticated;
grant select, insert, update on public.user_feedback to authenticated;
grant all on public.app_events to service_role;
grant all on public.decision_reviews to service_role;
grant all on public.user_feedback to service_role;

alter table public.app_events enable row level security;
alter table public.decision_reviews enable row level security;
alter table public.user_feedback enable row level security;

create policy "app_events_insert_self" on public.app_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "app_events_read_own_or_admin" on public.app_events
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "decision_reviews_read" on public.decision_reviews
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "decision_reviews_insert" on public.decision_reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "decision_reviews_update" on public.decision_reviews
  for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "decision_reviews_delete" on public.decision_reviews
  for delete to authenticated using (user_id = auth.uid());

create policy "user_feedback_read" on public.user_feedback
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "user_feedback_insert" on public.user_feedback
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_feedback_update_admin" on public.user_feedback
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create trigger decision_reviews_touch before update on public.decision_reviews
  for each row execute function public.touch_updated_at();
create trigger user_feedback_touch before update on public.user_feedback
  for each row execute function public.touch_updated_at();