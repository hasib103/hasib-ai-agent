-- Keep direct client access denied while making the policy explicit to security tooling.
-- The SECURITY DEFINER quota RPC remains the only supported path and scopes writes
-- to auth.uid(); direct anon/authenticated table access must remain impossible.
drop policy if exists "deny direct access to AI request events" on public.ai_request_events;

create policy "deny direct access to AI request events"
  on public.ai_request_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
