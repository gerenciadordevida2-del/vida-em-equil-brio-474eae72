-- Future subscription architecture (no payments implemented yet).
-- Identity stays in auth, authorization in user_roles; this adds the commercial layer.

-- Plan catalog (prices/benefits defined later by the owner; readable by any signed-in user)
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read_active ON public.plans FOR SELECT TO authenticated USING (active = true);

-- Subscriptions: one active per user, written only by the server (webhook), read by the owner
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_one_active_per_user ON public.subscriptions (user_id) WHERE status = 'active';
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_read_own ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Payment events: idempotency log for the future webhook; server-only, never exposed to clients
CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  amount_cents INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- VIP audit trail: who granted/revoked VIP and when
CREATE TABLE public.vip_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vip_grants TO authenticated;
GRANT ALL ON public.vip_grants TO service_role;
ALTER TABLE public.vip_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY vip_grants_admin_read ON public.vip_grants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- admin_set_vip now also records the audit trail (same behavior, plus logging)
CREATE OR REPLACE FUNCTION public.admin_set_vip(_target uuid, _grant boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'vip')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'vip';
  END IF;
  INSERT INTO public.vip_grants (user_id, granted_by, action)
  VALUES (_target, auth.uid(), CASE WHEN _grant THEN 'grant' ELSE 'revoke' END);
  RETURN true;
END;
$$;