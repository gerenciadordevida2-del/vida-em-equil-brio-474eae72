REVOKE EXECUTE ON FUNCTION public.start_trial(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_trial() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_current_plan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_trial() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_current_plan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;