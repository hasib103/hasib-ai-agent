# Hasib AI Agent

A mobile-first, authenticated control panel for a personal AI assistant. The current release is a guarded MVP with grounded web answers and a bounded browser task; it is not an unrestricted autonomous agent.

## Current capabilities

- Supabase email/password sign-in and per-user data isolation through Row Level Security (RLS).
- Task inbox, task status/history, persistent memory notes, approvals, activity log, and notification preferences.
- Server-side Gemini AI plan generation with schema validation, bounded retry/fallback behavior, and language preservation.
- Browser-based voice input and spoken output with a large language/locale selector.
- A Supabase Edge Function Task Runner with JWT validation, per-user task ownership checks, bounded retries/timeouts, and an allowlist for `generate_plan` and `create_memory_note`.
- Gemini Google Search grounding and URL Context for current web research when supported.
- Optional Browserless-powered remote browser tasks (see below).
- GitHub Actions build/tests, secret scanning, CodeQL analysis, Dependabot updates, and an Android debug APK workflow.

## Remote Browser

The `/browser` page provides a server-side browser session for public HTTP/HTTPS pages. It can open a page, click a CSS selector, fill a text field, wait, and return visible text and links. Each run is limited to six explicit actions and a short timeout; the user must confirm before execution.

### Configure

Set `BROWSERLESS_API_TOKEN` as a server-only secret in the deployment platform. Obtain it from the Browserless dashboard. Never use a `VITE_*` variable or paste the token into chat or the app UI. Browserless is a metered remote browser service; review its pricing and data handling before enabling it.

The integration creates a fresh browser session for every task. It does **not** persist cookies or logged-in sessions. Do not enter passwords, OTPs, payment details, or other sensitive information. Persistent authenticated profiles and credential vault/OAuth integrations require a separate secure session-storage design and are not claimed by this implementation.

### Security limits

- Requires an authenticated Hasib AI session and consumes the existing AI request quota.
- Validates the starting URL and intercepts browser requests to reject local/private address patterns.
- Executes fixed server-owned browser code; users cannot submit arbitrary JavaScript.
- Maximum six bounded actions; no shell, downloads, file uploads, or arbitrary script execution.
- Website content is untrusted evidence, never instructions.
- Clicking/filling forms may change external sites. Only run actions you understand and are authorized to perform.
- Browserless processes page content remotely; do not use it with sensitive or regulated data unless your privacy requirements and provider terms permit it.

## Important limitations

- The Task Runner does not execute arbitrary shell commands or unrestricted code.
- GitHub, Vercel, Render API, email, and other external account integrations are not connected merely because an integration card appears.
- Device enrollment/biometric authorization has not been verified as server-side protection.
- Physical Android testing on the target device is still required.
- Google Search grounding is not the same as an interactive browser or a persistent authenticated browser session.

## Stack

React, TypeScript, TanStack Start/Router, Vite, Tailwind CSS, Supabase, and Capacitor.

## Development

Use Node.js 22 or newer.

    npm install
    npm run dev
    npm run build
    npm run test
    npm run lint

GitHub Actions uses Bun with the committed `bun.lock`. Render is configured to build using `npm install && npm run build` and start with `node .output/server/index.mjs`. The repository does not currently commit a `package-lock.json`, so npm dependency resolution is not as reproducible as the CI lockfile install.

## Environment variables

Configure values in the local environment or a platform's server-side secret store. Never commit secret values or expose them through `VITE_*` variables.

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and matching `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `GEMINI_API_KEY` (server-only; `GOOGLE_API_KEY` is a supported fallback).
- `GEMINI_MODEL` (optional).
- `BROWSERLESS_API_TOKEN` (optional; server-only, enables Remote Browser).
- `AI_PLANNER_TIMEOUT_MS` (optional; bounded to 10–120 seconds).
- `TASK_RUNNER_TIMEOUT_MS` (optional; bounded by the Task Runner).

A Supabase publishable key is designed to be exposed to the browser; it is not authorization by itself. Never expose a service-role/secret key, Gemini key, OAuth secret, or browser-provider token in a browser bundle.

## Deployed services

- Production: https://hasib-ai-agent.onrender.com
- Test: https://hasib-ai-agent-test.onrender.com
- Supabase project: `qmdxpvimryxwezqmjbge`
- GitHub repository: https://github.com/hasib103/hasib-ai-agent

Both Render services currently auto-deploy from `main`; the test service is not an isolated staging branch. Confirm deploy state/logs after merges before describing a commit as live. Render Free services can sleep while idle.

## Android debug APK

Open https://github.com/hasib103/hasib-ai-agent/actions/workflows/android-apk.yml, run “Build Android APK,” and download the debug artifact after a successful run. Install it on a phone and test voice input, planner responses, scrolling, safe areas, and navigation separately.

## Security reporting

See `SECURITY.md`. Do not put credentials or private user data in public issues. Revoke an exposed credential at its provider before reporting the affected commit or file.
