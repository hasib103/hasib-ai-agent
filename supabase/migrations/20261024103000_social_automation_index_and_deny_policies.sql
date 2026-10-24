-- Explicitly document that browser roles must never access OAuth states or provider tokens.
create policy "No direct client access to social connections"
  on public.social_connections for all to anon, authenticated
  using (false) with check (false);
create policy "No direct client access to social OAuth states"
  on public.social_oauth_states for all to anon, authenticated
  using (false) with check (false);

-- Cover foreign-key lookups used by the owner-scoped automation workflows.
create index if not exists social_oauth_states_user_idx on public.social_oauth_states(user_id);
create index if not exists social_post_metrics_connection_idx on public.social_post_metrics(connection_id);
create index if not exists social_post_metrics_job_idx on public.social_post_metrics(job_id) where job_id is not null;
create index if not exists social_publish_jobs_connection_idx on public.social_publish_jobs(connection_id);
