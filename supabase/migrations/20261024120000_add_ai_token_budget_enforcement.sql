-- Reserve a conservative per-user token allowance before provider calls, then settle
-- against Gemini usage metadata. Unsettled reservations count for 24 hours by design.
create table if not exists public.ai_token_budget_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_kind text not null check (request_kind in ('chat', 'planner')),
  reserved_tokens integer not null check (reserved_tokens between 1 and 150000),
  actual_tokens integer,
  status text not null default 'reserved' check (status in ('reserved', 'settled')),
  created_at timestamptz not null default clock_timestamp(),
  settled_at timestamptz,
  constraint ai_token_budget_events_state_check check (
    (status = 'reserved' and actual_tokens is null and settled_at is null)
    or
    (status = 'settled' and actual_tokens between 0 and 300000 and settled_at is not null)
  )
);

create index if not exists ai_token_budget_events_user_status_created_idx
  on public.ai_token_budget_events (user_id, status, created_at desc);
create index if not exists ai_token_budget_events_user_settled_idx
  on public.ai_token_budget_events (user_id, settled_at desc)
  where status = 'settled';

alter table public.ai_token_budget_events enable row level security;
revoke all on table public.ai_token_budget_events from public, anon, authenticated;
drop policy if exists "deny direct access to AI token budget events" on public.ai_token_budget_events;
create policy "deny direct access to AI token budget events"
  on public.ai_token_budget_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.reserve_ai_token_budget(p_kind text, p_reserved_tokens integer)
returns table (allowed boolean, reservation_id uuid, daily_remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_used bigint := 0;
  v_oldest timestamptz;
  v_retry_after integer := 86400;
  v_budget_limit constant bigint := 500000;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('chat', 'planner') then
    raise exception 'Unsupported AI request kind' using errcode = '22023';
  end if;
  if p_reserved_tokens is null or p_reserved_tokens < 1 or p_reserved_tokens > 150000 then
    raise exception 'Invalid token reservation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 1));
  v_now := clock_timestamp();

  delete from public.ai_token_budget_events
  where user_id = v_user_id
    and (
      (status = 'settled' and settled_at <= v_now - interval '24 hours')
      or (status = 'reserved' and created_at <= v_now - interval '24 hours')
    );

  select
    coalesce(sum(case when status = 'settled' then actual_tokens else reserved_tokens end), 0)::bigint,
    min(case when status = 'settled' then settled_at else created_at end)
  into v_used, v_oldest
  from public.ai_token_budget_events
  where user_id = v_user_id
    and (
      (status = 'settled' and settled_at > v_now - interval '24 hours')
      or (status = 'reserved' and created_at > v_now - interval '24 hours')
    );

  if v_used + p_reserved_tokens > v_budget_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (coalesce(v_oldest, v_now) + interval '24 hours' - v_now)))::integer
    );
    return query
      select false, null::uuid, greatest(0, (v_budget_limit - v_used)::integer), v_retry_after;
    return;
  end if;

  insert into public.ai_token_budget_events (user_id, request_kind, reserved_tokens)
  values (v_user_id, p_kind, p_reserved_tokens)
  returning id into v_reservation_id;

  return query
    select true, v_reservation_id, greatest(0, (v_budget_limit - v_used - p_reserved_tokens)::integer), 0;
end;
$function$;

create or replace function public.settle_ai_token_budget(p_reservation_id uuid, p_actual_tokens integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_reservation_id is null or p_actual_tokens is null or p_actual_tokens < 0 or p_actual_tokens > 300000 then
    raise exception 'Invalid token settlement' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 1));
  update public.ai_token_budget_events
  set status = 'settled',
      actual_tokens = p_actual_tokens,
      settled_at = v_now
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

revoke all on function public.reserve_ai_token_budget(text, integer) from public, anon;
revoke all on function public.settle_ai_token_budget(uuid, integer) from public, anon;
grant execute on function public.reserve_ai_token_budget(text, integer) to authenticated;
grant execute on function public.settle_ai_token_budget(uuid, integer) to authenticated;

comment on table public.ai_token_budget_events is
  'Private per-user AI token budget ledger. Direct browser access is denied; only authenticated RPCs may reserve and settle usage.';
comment on function public.reserve_ai_token_budget(text, integer) is
  'Atomically reserves against a 500000-token rolling 24-hour per-user budget before AI provider calls.';
comment on function public.settle_ai_token_budget(uuid, integer) is
  'Settles a token reservation using provider-reported usage; an unsettled reservation remains charged conservatively for 24 hours.';
