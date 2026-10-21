alter table public.tasks
  add column if not exists task_type text not null default 'generate_plan',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists run_after timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists last_error text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks add constraint tasks_task_type_check
  check (task_type in ('generate_plan', 'create_memory_note'));

alter table public.tasks drop constraint if exists tasks_attempt_count_check;
alter table public.tasks add constraint tasks_attempt_count_check
  check (attempt_count >= 0 and attempt_count <= 100);

alter table public.tasks drop constraint if exists tasks_max_attempts_check;
alter table public.tasks add constraint tasks_max_attempts_check
  check (max_attempts between 1 and 5);

create index if not exists tasks_runtime_queue_idx
  on public.tasks (status, run_after, created_at)
  where status in ('queued', 'running');