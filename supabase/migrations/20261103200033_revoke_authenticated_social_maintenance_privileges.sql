-- Social automation browser roles need only owner-scoped CRUD on publish drafts/jobs
-- and read-only access to metrics. RLS does not protect TRUNCATE, REFERENCES or TRIGGER.
REVOKE ALL PRIVILEGES ON TABLE
  public.social_publish_jobs,
  public.social_post_metrics
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.social_publish_jobs
TO authenticated;

GRANT SELECT
ON TABLE public.social_post_metrics
TO authenticated;
