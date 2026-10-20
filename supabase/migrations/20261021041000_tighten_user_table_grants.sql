-- Tighten grants for the Hasib AI Agent user-data tables.
-- RLS remains the row-level boundary for authenticated users.
-- Anonymous access is not required; app_user_connections is server-only.
REVOKE ALL PRIVILEGES ON TABLE
  public.tasks,
  public.task_history,
  public.memory_notes,
  public.approvals,
  public.activity_log,
  public.settings,
  public.notification_preferences,
  public.app_user_connections
FROM anon;

REVOKE ALL PRIVILEGES ON TABLE public.app_user_connections FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tasks,
  public.task_history,
  public.memory_notes,
  public.approvals,
  public.activity_log,
  public.settings,
  public.notification_preferences
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.tasks,
  public.task_history,
  public.memory_notes,
  public.approvals,
  public.activity_log,
  public.settings,
  public.notification_preferences,
  public.app_user_connections
TO service_role;
