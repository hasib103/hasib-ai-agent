# Hasib AI Agent — Project Memory and Build Playbook

Last updated: 2026-10-19
Repository: hasib103/hasib-ai-agent
Default branch: main

## Product direction
- Hasib AI Agent is the internal/testing name. Public name and logo are deferred until launch.
- Long-term goal: a supervisor agent that plans tasks, coordinates specialist agents, verifies results, and maintains useful memory.
- Do not claim a feature, integration, deployment, or APK works unless there is test evidence.

## Collaboration rules
- Communicate in Bangla and preserve continuity; read this file before resuming project work.
- Ordinary project work is authorized; avoid repeated permission questions.
- Ask the user only for genuinely required phone-side actions, account approvals, or missing configuration.
- Never ask for secrets in chat or commit credentials. Store provider keys server-side.
- Clearly separate verified results, failures, and unknowns.

## Verified snapshot on 2026-10-19
- README describes a mobile-first React/TypeScript app using TanStack Start/Router, Vite, Tailwind, Supabase, and Capacitor.
- package.json contains AI SDK packages and Supabase JS. Dependency presence alone does not prove live AI or database connectivity.
- src/routes/integrations.tsx says no external services are connected and the Connect buttons are disabled.
- The user reported that an earlier debug APK installed on an Oppo A58 but displayed a UI without expected features working. Re-test before claiming functionality.
- README describes Render build/start configuration; inspect live service settings before changing them.
- A prior CI success is not proof that integrations, deployment, or APK functionality work.

## Roadmap
1. Inspect source routes, server handlers, environment variables, tests, and Android workflow.
2. Establish a repeatable build/test baseline and record commit SHA and exact results.
3. Implement one end-to-end slice: user prompt -> server-side model request -> visible response -> safe history/task persistence -> clear errors.
4. Configure database/auth only after schema and access rules are verified.
5. Add supervisor/worker orchestration with bounded retries, validation, audit trail, cancellation, timeouts, and cost limits.
6. Add agent creation only through controlled templates and resource limits; never unrestricted execution or unbounded spending.
7. Build a debug APK, verify the actual artifact, and test installation and key features on the Oppo A58.
8. Later handle production signing, privacy policy, Play Console, public branding, and monetization.

## Definition of done
- Inspect relevant current code before editing and make focused changes.
- Run relevant tests/build or GitHub Actions; record the actual result and commit SHA.
- For deployment, verify deployment status/logs. For APK, verify workflow success and actual artifact.
- A successful build does not by itself prove app features work.
- If a tool or permission prevents an action, state that limitation rather than implying it was completed.

## Repeatable APK process
1. Confirm the intended commit and branch.
2. Inspect .github/workflows and identify the exact Android workflow and trigger.
3. Dispatch the workflow and wait for a completed result.
4. Inspect failed job logs if needed.
5. Locate the actual artifact (README previously names hasib-ai-agent-android-debug), download/verify it, and report the commit SHA.
6. Treat phone installation and feature testing as separate verification steps.

## Progress log
Append entries after meaningful actions using: date; goal/change; files/commit; tests/workflow result; deployment or APK artifact; remaining blocker and next exact step.

## Security and cost guardrails
- Keep provider keys and OAuth secrets in server-side environment variables/secret storage, never browser code or APK.
- Prefer free tiers where practical, but verify quotas, sleep behavior, and limits.
- Apply timeouts, retry caps, task limits, per-user quotas, and budget limits to multi-agent execution.
- Require explicit confirmation for destructive actions, external messages, spending, publishing, and security-sensitive changes.