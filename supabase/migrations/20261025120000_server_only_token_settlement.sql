-- Restrict token-budget settlement to trusted server-side callers.
-- Authenticated clients may reserve their own budget, but must not choose a lower
-- actual-token count to reduce the rolling usage ledger.
create or replace function public.settle_ai_token_budget_server(
  p_user_id uuid,
  p_reservation_id uuid,
  p_actual_tokens integer
)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_reserved_tokens integer;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Server role required' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_reservation_id is null
     or p_actual_tokens is null
     or p_actual_tokens < 0
     or p_actual_tokens > 150000 then
    raise exception 'Invalid token settlement' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));

  select reserved_tokens
    into v_reserved_tokens
    from public.ai_token_budget_events
   where id = p_reservation_id
     and user_id = p_user_id
     and status = 'reserved'
   for update;

  if not found then
    return false;
  end if;

  -- Never settle above the amount already reserved. If provider usage is higher,
  -- the caller keeps the original reservation as a conservative accounting value.
  if p_actual_tokens > v_reserved_tokens then
    return false;
  end if;

  update public.ai_token_budget_events
     set status = 'settled',
         actual_tokens = p_actual_tokens,
         settled_at = v_now
   where id = p_reservation_id
     and user_id = p_user_id
     and status = 'reserved';

  return found;
end;
$function$;

revoke all on function public.settle_ai_token_budget(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.settle_ai_token_budget_server(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.settle_ai_token_budget_server(uuid, uuid, integer)
  to service_role;
