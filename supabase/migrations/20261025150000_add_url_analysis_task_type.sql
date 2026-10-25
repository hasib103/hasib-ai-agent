-- Expand the task allowlist for read-only public URL analysis.
-- Existing tasks and their history/results are preserved.
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_task_type_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type = ANY (ARRAY[
    'generate_plan'::text,
    'create_memory_note'::text,
    'analyze_url'::text
  ]));
