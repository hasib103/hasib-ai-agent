-- Authorized device registry for Hasib AI Agent.
-- Apply only after confirming Supabase Auth is enabled for the target project.
-- RLS protects records, but this table alone does not enforce authorization on app routes.

create table if not exists public.authorized_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null check (char_length(device_label) between 1 and 80),
  credential_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  constraint authorized_devices_hash_length check (char_length(credential_hash) = 64)
);

create index if not exists authorized_devices_user_active_idx
  on public.authorized_devices (user_id, created_at desc)
  where revoked_at is null;

alter table public.authorized_devices enable row level security;
alter table public.authorized_devices force row level security;

-- Users may view their own device metadata, but cannot create credentials or change
-- authorization state from the client. Enrollment/revocation must be server-side.
drop policy if exists "Users can view own authorized devices" on public.authorized_devices;
create policy "Users can view own authorized devices"
  on public.authorized_devices for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.authorized_devices from anon, authenticated;
grant select on public.authorized_devices to authenticated;
