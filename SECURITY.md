# Security Policy — Hasib AI Agent

Last reviewed: 2026-10-23.

This project is a guarded MVP. Security controls are not a substitute for verification on the deployed app and target phone. Keep sensitive or production-critical workflows disabled until the complete path has been validated.

## Verified controls

- The dashboard has a Supabase email/password authentication gate. AI server functions validate the supplied access token with Supabase Auth.
- The deployed task-runner Edge Function is active with JWT verification enabled. Its code validates the user, scopes tasks to that user, claims queued work conditionally, enforces a task-type allowlist, bounds retries/timeouts, and stores task outcomes/history.
- Row Level Security is enabled on the public application tables. User-facing policies scope records to auth.uid() = user_id; the integration-credentials table denies direct anon and authenticated client access. The checked table grants did not show anon table grants.
- AI request quotas are enforced through a database-backed RPC: chat is limited to 10 requests/minute and 100 requests/24 hours; planner is limited to 3 requests/minute and 30 requests/24 hours. The RPC fails closed when unavailable, validates auth.uid(), rejects unsupported request kinds, uses a fixed search_path, and serializes quota checks per user.
- Direct client access to AI quota event rows is denied by table grants and RLS; the explicit deny-all policy is maintained as a migration-level defense-in-depth control. The SECURITY DEFINER warning for the authenticated-executable quota RPC is intentional: signed-in users need to call it, and the function only consumes quota for auth.uid(). Reassess this exception if the RPC's behavior or permissions change.
- Gemini credentials are read from server-side environment variables; the browser uses a Supabase publishable key, which is public by design and is not an access-control mechanism.
- GitHub build/test, CodeQL, secret scanning, and Android APK workflows passed for the reviewed main-branch commit. Continued scans do not guarantee that every historical secret has never been exposed.

## Known gaps — do not treat these as complete

- Supabase leaked-password protection is disabled. The Supabase Security Advisor reports auth_leaked_password_protection as a warning. Enable it in Supabase Auth password/security settings and re-run the advisor: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- No verified device enrollment or server-enforced device binding. The open/draft biometric work does not establish server-side authorization and has not been validated on the target Oppo A58.
- External integrations are not connected to the production app. The audited public.app_user_connections table has zero rows. The Task Runner currently supports only generate_plan and create_memory_note; it is not an arbitrary GitHub, email, browser, or shell executor.
- A database-backed rolling 24-hour AI token budget is implemented in the token-budget migration and server handlers: each request reserves a conservative token allowance before contacting Gemini, then settles against provider usage metadata when available. The default budget is 500,000 tokens per user per rolling 24 hours; if usage metadata or settlement is unavailable, the reservation remains charged conservatively. This is a token ceiling, not an exact USD spending ceiling; a provider-priced monetary cap remains unimplemented.
- Physical phone verification remains outstanding. CI and a successful Android build do not verify microphone permissions, speech-recognition support, notches, system navigation, or spoken playback on an actual device.
- Render production and test services both currently track main. The test service is therefore not isolated from production changes.

## Credential handling

- Put GEMINI_API_KEY, OAuth/provider secrets, SUPABASE_SERVICE_ROLE_KEY, and APP_USER_CONNECTION_KEY_SECRET only in the appropriate platform's server-side secret manager.
- Never use a VITE_ prefix for private credentials, and never place secrets in browser code, local storage, an APK, documentation, logs, issues, or chat.
- Do not read, copy, or publish a local or deployed .env file.
- If a genuine credential was committed or shared, rotate/revoke it at the provider. Removing it from the current file does not remove it from Git history.
- Do not log access tokens, raw provider responses containing sensitive content, or connection keys.

## Operational requirements before enabling new actions

1. Authenticate every private route and API; enforce per-user authorization on the server rather than trusting a client-supplied user/device ID.
2. Use an explicit action allowlist and obtain user confirmation for publishing, deleting data, spending money, external messages, or security-sensitive changes.
3. Apply rate limits, request-size bounds, timeouts, retry caps, idempotency/claiming, cancellation, and per-user cost budgets.
4. Test anonymous access, cross-user access, approval enforcement, failure persistence, and audit records.
5. Verify deployment logs and run real device tests after code changes; do not equate CI success with functional sign-off.

## Reporting

Do not post credentials or sensitive personal data in public issues. Revoke exposed credentials first, then report the affected path/commit privately to the repository owner.
