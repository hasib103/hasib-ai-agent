-- Improve task-history lookups and avoid per-row auth.uid() evaluation in RLS.
CREATE INDEX IF NOT EXISTS task_history_task_id_idx
  ON public.task_history (task_id);

DO $$
DECLARE
  pol record;
  using_expr text;
  check_expr text;
  stmt text;
BEGIN
  FOR pol IN
    SELECT p.polname, n.nspname, c.relname,
           pg_get_expr(p.polqual, p.polrelid) AS using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'tasks', 'task_history', 'memory_notes', 'approvals',
        'activity_log', 'settings', 'notification_preferences'
      )
      AND (
        pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid%'
      )
  LOOP
    using_expr := CASE WHEN pol.using_expr IS NULL THEN NULL
                       ELSE replace(pol.using_expr, 'auth.uid()', '( SELECT auth.uid() )') END;
    check_expr := CASE WHEN pol.check_expr IS NULL THEN NULL
                       ELSE replace(pol.check_expr, 'auth.uid()', '( SELECT auth.uid() )') END;
    stmt := format('ALTER POLICY %I ON %I.%I', pol.polname, pol.nspname, pol.relname);
    IF using_expr IS NOT NULL THEN stmt := stmt || format(' USING (%s)', using_expr); END IF;
    IF check_expr IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', check_expr); END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
