-- Commercial plans catalog + 7-day free trial rules (no payments yet).

-- Plans: description, features, configurable limits and annual price
ALTER TABLE public.plans ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.plans ADD COLUMN features JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.plans ADD COLUMN limits JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.plans ADD COLUMN price_annual_cents INTEGER;

-- Subscriptions: billing interval chosen by the user + trial window
ALTER TABLE public.subscriptions ADD COLUMN billing_interval TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE public.subscriptions ADD COLUMN trial_start TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN trial_end TIMESTAMPTZ;

-- Allowed subscription states (static values, safe as CHECK)
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending','trialing','active','cancelled','past_due','expired'));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_interval_check
  CHECK (billing_interval IN ('monthly','annual'));

-- One trialing subscription per user at a time (the existing one_active_per_user index stays)
CREATE UNIQUE INDEX subscriptions_one_trialing_per_user ON public.subscriptions (user_id) WHERE status = 'trialing';
-- One free trial per user, ever (historical rows keep trial_start, so a new trial insert conflicts)
CREATE UNIQUE INDEX subscriptions_one_trial_per_user ON public.subscriptions (user_id) WHERE trial_start IS NOT NULL;

-- Plan catalog (prices in integer cents; limits configurable here, not hardcoded in code)
INSERT INTO public.plans (code, name, description, price_cents, price_annual_cents, billing_interval, features, limits) VALUES
  ('free', 'Gratuito', 'Para organizar o dia a dia sem custo.', 0, 0, 'monthly',
   '["Rotina, tarefas e metas","Finanças pessoais","Vendas básicas","Assistente de IA com limite diário"]'::jsonb,
   '{"aiPerMinute": 10, "aiPerDay": 200}'::jsonb),
  ('premium', 'Premium', 'Para quem quer mais IA e análises avançadas.', 1490, 11990, 'monthly',
   '["Tudo do plano Gratuito","Limites ampliados de IA","Relatórios e análises avançadas","Recursos extras de organização pessoal"]'::jsonb,
   '{"aiPerMinute": 50, "aiPerDay": 1000}'::jsonb),
  ('negocio', 'Negócio', 'Para gerenciar clientes, estoque e vendas.', 2990, 29990, 'monthly',
   '["Tudo do plano Premium","Cadastro e gestão de clientes","Produtos e controle de estoque","Vendas, custos e lucros","Contas a receber e pagamentos","Relatórios comerciais"]'::jsonb,
   '{"aiPerMinute": 50, "aiPerDay": 1000}'::jsonb);

-- Start a 7-day trial: server-side only, one per user, never on signup/login
CREATE OR REPLACE FUNCTION public.start_trial(_plan_code text, _interval text DEFAULT 'monthly')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plans%ROWTYPE;
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _interval NOT IN ('monthly','annual') THEN
    RAISE EXCEPTION 'invalid_interval';
  END IF;
  SELECT * INTO _plan FROM public.plans WHERE code = _plan_code AND active = true;
  IF NOT FOUND OR _plan.price_cents = 0 THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = auth.uid() AND trial_start IS NOT NULL) THEN
    RAISE EXCEPTION 'trial_already_used';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = auth.uid() AND status IN ('trialing','active')) THEN
    RAISE EXCEPTION 'subscription_exists';
  END IF;
  INSERT INTO public.subscriptions (user_id, plan_id, status, billing_interval, trial_start, trial_end, current_period_start, current_period_end)
  VALUES (auth.uid(), _plan.id, 'trialing', _interval, now(), now() + interval '7 days', now(), now() + interval '7 days')
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Cancel during trial: keeps access until trial_end, no future charge
CREATE OR REPLACE FUNCTION public.cancel_trial()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  UPDATE public.subscriptions SET status = 'cancelled', updated_at = now()
  WHERE user_id = auth.uid() AND status = 'trialing';
  RETURN FOUND;
END;
$$;

-- Effective commercial plan for the caller: active subscription, or trial/cancelled-trial still inside the granted window; otherwise free. Admin/VIP roles are separate and never touched here.
CREATE OR REPLACE FUNCTION public.my_current_plan()
RETURNS TABLE(plan_code text, plan_name text, status text, billing_interval text, trial_start timestamptz, trial_end timestamptz, price_cents integer, price_annual_cents integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.code, p.name, s.status, s.billing_interval, s.trial_start, s.trial_end, p.price_cents, p.price_annual_cents
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = auth.uid()
    AND (s.status = 'active'
         OR (s.status IN ('trialing','cancelled') AND s.trial_end > now()))
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- Expire finished trials (future cron/webhook calls this; cancelled trials keep access until trial_end)
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.subscriptions SET status = 'expired', updated_at = now()
  WHERE status IN ('trialing','cancelled') AND trial_end <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_trial(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_current_plan() TO authenticated;