# Security Policy — Hasib AI Agent

Last reviewed: 2026-10-22.

This project is a guarded MVP. Security controls are not a substitute for verification on the deployed app and target phone. Keep sensitive or production-critical workflows disabled until the complete path has been validated.

## Verified controls

- The dashboard has a Supabase email/password authentication gate. AI server functions validate the supplied access token with Supabase Auth.
- The deployed task-runner Edge Function is active with JWT verification enabled. Its code validates the user, scopes tasks to that user, claims queued work conditionally, enforces a task-type allowlist, bounds retries/timeouts, and stores task outcomes/history.
- Row Level Security is enabled on the eight public application tables. Audited policies scope user-facing records to auth.uid() = user_id; the integration-credentials table explicitly denies direct anon and authenticated client access. The checked table grants did not show anon table grants.
- Gemini credentials are read from server-side environment variables; the browser uses a Supabase publishable key, which is public by design and is not an access-control mechanism.
- GitHub secret scanning (Gitleaks) and CodeQL checks passed for the reviewed automation changes. Continued scans do not guarantee that every historical secret has never been exposed.

## Known gaps — do not treat these as complete

- Supabase leaked-password protection is disabled. The Supabase Security Advisor reports auth_leaked_password_protection as a warning. Enable it in Supabase Auth password/security settings and re-run the advisor: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- No verified device enrollment or server-enforced device binding. The open/draft biometric work does not establish server-side authorization and has not been validated on the target Oppo A58.
- External integrations are not connected to the production app. The audited public.app_user_connections table has zero rows. The Task Runner currently supports only generate_plan and create_memory_note; it is not an arbitrary GitHub, email, browser, or shell executor.
- Rate limiting and per-user AI budget enforcement have not been verified. Add and test these before opening broad public access.
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
