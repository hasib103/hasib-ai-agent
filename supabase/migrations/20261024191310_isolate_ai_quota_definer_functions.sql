CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.consume_ai_request(text) SET SCHEMA private;
ALTER FUNCTION public.reserve_ai_token_budget(text, integer) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.consume_ai_request(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.reserve_ai_token_budget(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.consume_ai_request(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.reserve_ai_token_budget(text, integer) TO authenticated, service_role;

CREATE FUNCTION public.consume_ai_request(p_kind text)
RETURNS TABLE(allowed boolean, retry_after_seconds integer, daily_remaining integer)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT * FROM private.consume_ai_request(p_kind); $$;

CREATE FUNCTION public.reserve_ai_token_budget(p_kind text, p_reserved_tokens integer)
RETURNS TABLE(allowed boolean, reservation_id uuid, daily_remaining integer, retry_after_seconds integer)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT * FROM private.reserve_ai_token_budget(p_kind, p_reserved_tokens); $$;

REVOKE ALL ON FUNCTION public.consume_ai_request(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_ai_token_budget(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_request(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ai_token_budget(text, integer) TO authenticated, service_role;
