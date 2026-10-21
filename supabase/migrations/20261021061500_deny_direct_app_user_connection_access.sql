-- This table stores server-managed connector credentials and is intentionally not client-accessible.
-- Keep an explicit deny policy as defense in depth if table grants are changed accidentally.
CREATE POLICY "Deny direct client access to user connections"
ON public.app_user_connections
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
