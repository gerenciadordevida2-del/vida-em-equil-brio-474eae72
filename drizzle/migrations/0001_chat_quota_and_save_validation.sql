CREATE TABLE public.chat_usage (user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, window_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 0, PRIMARY KEY (user_id, window_start));
GRANT SELECT ON public.chat_usage TO authenticated;
GRANT ALL ON public.chat_usage TO service_role;
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_chat_usage_read ON public.chat_usage FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.consume_chat_quota(max_per_minute integer DEFAULT 10, max_per_day integer DEFAULT 200) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); minute_count integer; day_count integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.profiles(id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT COALESCE(SUM(count),0) INTO day_count FROM public.chat_usage WHERE user_id = uid AND window_start > now() - interval '1 day';
  SELECT COALESCE(SUM(count),0) INTO minute_count FROM public.chat_usage WHERE user_id = uid AND window_start = date_trunc('minute', now());
  IF minute_count >= max_per_minute OR day_count >= max_per_day THEN RETURN false; END IF;
  INSERT INTO public.chat_usage(user_id, window_start, count) VALUES (uid, date_trunc('minute', now()), 1)
    ON CONFLICT (user_id, window_start) DO UPDATE SET count = public.chat_usage.count + 1;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.consume_chat_quota(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_chat_quota(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_app_data(payload jsonb, expected_revision bigint) RETURNS bigint LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF expected_revision IS NULL OR expected_revision < 0 THEN RAISE EXCEPTION 'Invalid revision'; END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object'
     OR payload->>'version' IS DISTINCT FROM '1'
     OR jsonb_typeof(payload->'transactions') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'business') IS DISTINCT FROM 'object'
     OR pg_column_size(payload) > 5 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Invalid payload';
  END IF;
  INSERT INTO public.profiles(id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  IF expected_revision = 0 THEN
    INSERT INTO public.app_data(user_id,data) VALUES(auth.uid(),payload) ON CONFLICT DO NOTHING RETURNING revision INTO result;
  ELSE
    UPDATE public.app_data SET data=payload, revision=revision+1, updated_at=now() WHERE user_id=auth.uid() AND revision=expected_revision RETURNING revision INTO result;
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'REVISION_CONFLICT: Dados alterados em outro aparelho.'; END IF;
  RETURN result;
END $$;