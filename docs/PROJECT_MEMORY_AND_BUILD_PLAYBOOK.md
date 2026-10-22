# Hasib AI Agent — Project Memory and Build Playbook

Last updated: 2026-10-22  
Repository: hasib103/hasib-ai-agent  
Default branch: main  
Verified source checkpoint before this hardening PR: 49d26276c40df4183ceccd7f8f44f30c6a4985c8

## Product direction

Build a professional, mobile-first personal AI agent that understands requests, creates plans, performs explicitly authorized actions, verifies outcomes, maintains useful memory, and produces evidence-based reports. The current app is a guarded MVP—not yet a general autonomous operator with arbitrary access to external accounts.

## Working rules

- Communicate in Bangla when reporting to Hasib and preserve context from this file.
- Ordinary code and documentation work is authorized; do not repeatedly ask for minor decisions.
- Never ask for secrets in chat. Use platform secret managers and do not read or publish .env files.
- Distinguish verified, failed, blocked, and not-yet-tested items.
- Destructive data operations, paid-resource creation, irreversible external actions, and production-secret changes require explicit approval.
- Do not state that an integration, app, APK, or device behavior works without corresponding evidence.

## Current architecture

- Front end: React 19, TypeScript, TanStack Start/Router, Vite, Tailwind, Capacitor.
- Auth/data: Supabase email/password authentication, eight public user-data tables with RLS, owner-scoped policies, and a private app_user_connections table with direct client access denied.
- AI: Gemini requests are performed server-side; provider credentials must remain in server-side environment variables.
- Task runner: active Supabase Edge Function task-runner (JWT verification enabled). It currently permits only generate_plan and create_memory_note, with authenticated ownership checks and persisted result/history. It does not yet execute arbitrary GitHub/email/browser/shell actions.
- Voice: browser speech-recognition and speech-synthesis APIs with a central locale catalog. Support varies by browser/device; selecting a locale does not guarantee an installed speech voice.

## Verified repository/deployment facts from the audit

- Production Render URL: https://hasib-ai-agent.onrender.com
- Test Render URL: https://hasib-ai-agent-test.onrender.com
- Both Render services currently deploy from main using npm install && npm run build and node .output/server/index.mjs. Test deployments are therefore not isolated from production.
- Supabase project qmdxpvimryxwezqmjbge is ACTIVE_HEALTHY; task-runner version 6 is ACTIVE, with JWT verification enabled.
- RLS is enabled on eight public tables and reviewed policies scope user records by authenticated user ID. Table-grant review showed no anon table grants. app_user_connections is intentionally inaccessible directly to browser roles.
- Latest database audit found: tasks 12, task_history 21, memory_notes 0, approvals 0, activity_log 10, settings 1, notification_preferences 1, app_user_connections 0.
- Supabase Security Advisor has one warning: leaked-password protection disabled. Performance Advisor had no warnings.
- GitHub workflows are configured for build/test, Gitleaks, CodeQL, Dependabot updates, and Android debug APK builds.
- PR #22 (automated CodeQL/Dependabot) merged as 6a8e83b0c0070e295c043d7bb9a25317f4a2cc67; all seven PR checks passed.
- PR #16 (adaptive mobile layout) merged as c4bdb7f897182f9e3b0a67ac550a9fabe62f8ac6; CI verify and Gitleaks passed for its head. Physical-phone testing remains outstanding.
- PR #15 (planner language preservation) merged as 49d26276c40df4183ceccd7f8f44f30c6a4985c8; CI verify and Gitleaks passed for its head. Real Gemini prompt testing remains needed.
- Android debug APK workflow passed for earlier main commit 398c87fe1aff8f6e038a380fbd87469572371761. Rebuild after source changes and separately verify installation and behavior on Oppo A58.
- Lovable project “Task Mind Dashboard” (c2640768-96ae-4103-911a-59b4394ea1ff) is a separate editor project and is not published. Treat GitHub + Render as the primary runtime until code synchronization/ownership is deliberately reconciled.

## Current gaps and next milestones

1. Enable Supabase leaked-password protection in the dashboard and re-run the Security Advisor.
2. Isolate the Render test service on a dedicated staging branch/service. Both services currently deploy main; no branch change should be assumed until verified in Render.
3. Add server-side rate limits, per-user AI usage/cost budgets, and abuse monitoring.
4. Connect one provider at a time using verified OAuth or server-side connection flows; prove each connection with a live request before displaying Connected.
5. Extend the Task Runner only through an explicit safe allowlist, per-user authorization, confirmations for external/destructive actions, idempotency, cancellation, timeouts, and audit evidence.
6. Test voice input/output, language selection, responsive top safe area, bottom navigation, persistence, sign-in, and task failure paths on the target Android phone.
7. Reconcile the unpublished Lovable project with the primary GitHub source before editing/publishing it, to avoid divergent copies.

## Repeatable validation checklist

1. Read this playbook and inspect current main before changes.
2. Use a feature branch and PR. Run GitHub CI, Gitleaks and CodeQL where configured; resolve failures before merging.
3. After merge, verify Render build/deploy status and inspect recent service logs for each service.
4. For Supabase changes, check migrations, RLS, grants, and both security and performance advisors.
5. For an APK, verify the workflow run and artifact on the exact source commit; then test installation and behavior on the physical phone.
6. Record commit IDs and evidence. A green build does not establish that live AI requests, OAuth, speech playback, or phone layout work.

## Progress log

- 2026-10-22 — Merged PR #22: CodeQL and dependency scanning. CI, CodeQL JS/TS, CodeQL Actions, Gitleaks, and Dependabot configuration validation passed.
- 2026-10-22 — Merged PR #16: responsive wrapping, compact-phone sizing, and adaptive mobile layout. CI and Gitleaks passed; physical device verification pending.
- 2026-10-22 — Merged PR #15: planner replies in the request language. CI and Gitleaks passed; runtime locale test pending.
- 2026-10-22 — Security audit: RLS/policies/grants reviewed; one Supabase Auth password-protection warning remains; external user connections table empty.

## Security and cost guardrails

- Keep provider keys and OAuth secrets only in server-side environment/secret storage.
- Prefer free tiers where practical, but confirm limits, sleep behavior, and usage constraints.
- Apply timeouts, retry caps, per-user quotas, concurrency limits, and budget limits to multi-agent execution.
- Require explicit confirmation for destructive actions, external messages, spending, publishing, and security-sensitive changes.
