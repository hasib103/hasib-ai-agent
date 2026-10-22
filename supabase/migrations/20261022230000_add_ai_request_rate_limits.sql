-- Add database-backed per-user AI request quotas. Apply before deploying code that calls the RPC.
create table if not exists public.ai_request_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_kind text not null check (request_kind in ('chat', 'planner')),
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists ai_request_events_user_kind_time_idx on public.ai_request_events (user_id, request_kind, occurred_at desc);
alter table public.ai_request_events enable row level security;
revoke all on table public.ai_request_events from public, anon, authenticated;

create or replace function public.consume_ai_request(p_kind text)
returns table (allowed boolean, retry_after_seconds integer, daily_remaining integer)
language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_minute_count integer := 0;
  v_day_count integer := 0;
  v_oldest_minute timestamptz;
  v_oldest_day timestamptz;
  v_minute_limit integer;
  v_daily_limit integer;
  v_retry_after integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_kind is null or p_kind not in ('chat', 'planner') then raise exception 'Unsupported AI request kind' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  v_now := clock_timestamp();
  if p_kind = 'chat' then v_minute_limit := 10; v_daily_limit := 100; else v_minute_limit := 3; v_daily_limit := 30; end if;
  delete from public.ai_request_events where user_id = v_user_id and occurred_at <= v_now - interval '24 hours';
  select count(*) filter (where occurred_at > v_now - interval '1 minute')::integer, count(*)::integer,
         min(occurred_at) filter (where occurred_at > v_now - interval '1 minute'), min(occurred_at)
    into v_minute_count, v_day_count, v_oldest_minute, v_oldest_day
    from public.ai_request_events where user_id = v_user_id and request_kind = p_kind and occurred_at > v_now - interval '24 hours';
  if v_minute_count >= v_minute_limit then
    v_retry_after := greatest(v_retry_after, greatest(1, ceil(extract(epoch from (v_oldest_minute + interval '1 minute' - v_now)))::integer));
  end if;
  if v_day_count >= v_daily_limit then
    v_retry_after := greatest(v_retry_after, greatest(1, ceil(extract(epoch from (v_oldest_day + interval '24 hours' - v_now)))::integer));
  end if;
  if v_minute_count >= v_minute_limit or v_day_count >= v_daily_limit then
    return query select false, v_retry_after, greatest(0, v_daily_limit - v_day_count);
    return;
  end if;
  insert into public.ai_request_events (user_id, request_kind, occurred_at) values (v_user_id, p_kind, v_now);
  return query select true, 0, greatest(0, v_daily_limit - v_day_count - 1);
end;
$function$;
revoke all on function public.consume_ai_request(text) from public, anon;
grant execute on function public.consume_ai_request(text) to authenticated;
comment on function public.consume_ai_request(text) is 'Per-user AI request limits: chat 10/minute and 100/24h; planner 3/minute and 30/24h.';
