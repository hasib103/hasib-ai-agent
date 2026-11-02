-- Remove anonymous privileges from social automation tables.
-- RLS does not protect TRUNCATE, so row policies alone are not sufficient here.
-- Authenticated users retain their existing grants and user-scoped RLS policies.
REVOKE ALL PRIVILEGES ON TABLE
  public.social_publish_jobs,
  public.social_post_metrics
FROM anon;
