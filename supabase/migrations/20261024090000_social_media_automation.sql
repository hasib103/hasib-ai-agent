-- Social account connections, publish jobs, and analytics snapshots.
-- OAuth credentials are encrypted by the Edge Function and never exposed to browser roles.
create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('facebook','instagram','youtube','tiktok','linkedin','x','pinterest','threads','whatsapp')),
  external_account_id text not null,
  account_name text not null default '',
  token_ciphertext text not null,
  token_iv text not null,
  refresh_ciphertext text,
  refresh_iv text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'connected' check (status in ('connected','needs_reauth','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, external_account_id)
);
create index if not exists social_connections_user_provider_idx on public.social_connections(user_id, provider) where status = 'connected';
alter table public.social_connections enable row level security;
revoke all on public.social_connections from anon, authenticated;

create table if not exists public.social_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  code_verifier text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.social_oauth_states enable row level security;
revoke all on public.social_oauth_states from anon, authenticated;

create table if not exists public.social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  content_type text not null default 'text' check (content_type in ('text','image','video','link')),
  content jsonb not null,
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','scheduled','publishing','published','failed','cancelled')),
  approved_at timestamptz,
  published_at timestamptz,
  provider_post_id text,
  provider_post_url text,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_publish_jobs_due_idx on public.social_publish_jobs(scheduled_at) where status = 'scheduled';
create index if not exists social_publish_jobs_user_idx on public.social_publish_jobs(user_id, created_at desc);
alter table public.social_publish_jobs enable row level security;
create policy "Users can read their own social publish jobs" on public.social_publish_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own social publish drafts" on public.social_publish_jobs for insert to authenticated with check ((select auth.uid()) = user_id and status in ('draft','pending_approval'));
create policy "Users can update their own unsubmitted social publish drafts" on public.social_publish_jobs for update to authenticated using ((select auth.uid()) = user_id and status in ('draft','pending_approval')) with check ((select auth.uid()) = user_id and status in ('draft','pending_approval'));
create policy "Users can delete their own social publish drafts" on public.social_publish_jobs for delete to authenticated using ((select auth.uid()) = user_id and status in ('draft','pending_approval'));

create table if not exists public.social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.social_connections(id) on delete cascade,
  job_id uuid references public.social_publish_jobs(id) on delete set null,
  provider_post_id text not null,
  captured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb
);
create index if not exists social_post_metrics_user_time_idx on public.social_post_metrics(user_id, captured_at desc);
alter table public.social_post_metrics enable row level security;
create policy "Users can read their own social post metrics" on public.social_post_metrics for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.social_post_metrics from anon, authenticated;
