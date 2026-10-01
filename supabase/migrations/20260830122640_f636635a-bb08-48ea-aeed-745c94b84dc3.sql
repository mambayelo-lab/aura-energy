ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS price_id TEXT,
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_platform_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = _user_id
      and (
        s.status = 'active'
        or s.status = 'trialing' and s.trial_ends_at > now()
        or s.status in ('past_due','canceled') and s.current_period_end > now()
      )
  )
$$;