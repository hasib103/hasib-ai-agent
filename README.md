# Hasib AI Agent

A mobile-first, authenticated control panel for a personal AI assistant. The current release is a guarded MVP: it can generate plans and run a small allowlisted set of server-side tasks, but it is not yet a general-purpose autonomous agent with arbitrary access to external accounts.

## Current capabilities

- Supabase email/password sign-in and per-user data isolation through Row Level Security (RLS).
- Task inbox, task status/history, persistent memory notes, approvals, activity log, and notification preferences.
- Server-side Gemini AI plan generation with schema validation, bounded retry/fallback behavior, and language preservation for Bengali, English, and mixed-language requests.
- Browser-based voice input and spoken output with a large language/locale selector. Speech support varies by device and browser.
- A Supabase Edge Function Task Runner with JWT validation, per-user task ownership checks, a conditional task claim, bounded retries/timeouts, and an allowlist for generate_plan and create_memory_note.
- GitHub Actions build/tests, Gitleaks secret scanning, CodeQL analysis, weekly Dependabot updates, and an Android debug APK workflow.

## Important limitations

- The Task Runner does not execute arbitrary shell commands, unrestricted code, or general GitHub/email/browser actions.
- GitHub, Vercel, Render API, email, and other external account integrations are not connected to the production app yet. The presence of an integration card is not proof of a connection; the app_user_connections table had zero rows in the latest database audit.
- Device enrollment/biometric authorization has not been merged and verified as server-side protection.
- Physical Android testing on the target Oppo A58 is still required. A successful build or APK artifact alone does not prove on-device behavior.
- The Lovable project “Task Mind Dashboard” is a separate, older, unpublished editor project. The GitHub repository and Render deployment are the primary current source of truth.

## Stack

React, TypeScript, TanStack Start/Router, Vite, Tailwind CSS, Supabase, and Capacitor.

## Development

Use Node.js 22 or newer.

    npm install
    npm run dev
    npm run build
    npm run test
    npm run lint

GitHub Actions currently uses Bun with the committed bun.lock and bun install --frozen-lockfile. Render is configured to build using npm install && npm run build and start with node .output/server/index.mjs. The repository does not currently commit a package-lock.json, so npm dependency resolution is not as reproducible as the CI lockfile install.

## Environment variables

Configure values in the local environment or a platform's server-side secret store. Never commit secret values or paste credentials into chat.

- SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and matching VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY for the browser integration.
- GEMINI_API_KEY (server-only; GOOGLE_API_KEY is a supported fallback).
- GEMINI_MODEL (optional).
- AI_PLANNER_TIMEOUT_MS (optional; bounded to 10–120 seconds, defaults to 60 seconds for the planner).
- TASK_RUNNER_TIMEOUT_MS (optional; the server-side Task Runner applies its own safe cap).

A Supabase publishable key is designed to be exposed to the browser; it is not authorization by itself. Never expose a service-role/secret key, Gemini key, OAuth secret, or encryption key in any VITE_* variable or browser bundle.

## Deployed services

- Production: https://hasib-ai-agent.onrender.com
- Test: https://hasib-ai-agent-test.onrender.com
- Supabase project: qmdxpvimryxwezqmjbge
- GitHub repository: https://github.com/hasib103/hasib-ai-agent

Deployment caveat: both Render services currently auto-deploy from main; the test service is not an isolated staging branch. Render Free services can sleep while idle. Confirm current deploy state/logs after merges before describing a new commit as live.

## Android debug APK

Open GitHub Actions at https://github.com/hasib103/hasib-ai-agent/actions/workflows/android-apk.yml, run “Build Android APK,” and download the hasib-ai-agent-android-debug artifact after a successful run. The artifact expires according to the workflow retention policy. Install it on a phone and test voice input, planner responses, scrolling, top safe area, and bottom navigation separately.

## Security reporting

See SECURITY.md. Do not put credentials or private user data in public issues. Revoke an exposed credential at its provider before reporting the affected commit or file.
