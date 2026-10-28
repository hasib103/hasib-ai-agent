-- Record actual provider usage even when it exceeds the pre-call reservation.
-- This function remains callable only by service_role; browser roles cannot forge settlements.
CREATE OR REPLACE FUNCTION public.settle_ai_token_budget_server(
  p_user_id uuid,
  p_reservation_id uuid,
  p_actual_tokens integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server role required' USING errcode = '42501';
  END IF;

  IF p_user_id IS NULL
     OR p_reservation_id IS NULL
     OR p_actual_tokens IS NULL
     OR p_actual_tokens < 0
     OR p_actual_tokens > 300000 THEN
    RAISE EXCEPTION 'Invalid token settlement' USING errcode = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));

  UPDATE public.ai_token_budget_events
     SET status = 'settled',
         actual_tokens = p_actual_tokens,
         settled_at = v_now
   WHERE id = p_reservation_id
     AND user_id = p_user_id
     AND status = 'reserved';

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_ai_token_budget_server(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_token_budget_server(uuid, uuid, integer)
  TO service_role;

-- Retire the legacy browser-callable settlement path. It trusted caller-supplied
-- usage and could let an authenticated client under-report its own token usage.
ALTER FUNCTION public.settle_ai_token_budget(uuid, integer) SET search_path TO '';
REVOKE ALL ON FUNCTION public.settle_ai_token_budget(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
