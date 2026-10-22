# Hasib AI Agent — Work Continuity Notes

Updated: 2026-10-22

## Product goal
Launch Hasib AI Agent as a professional, reliable, affordable AI agent for everyday users. Preserve the existing working application and improve it incrementally; do not rebuild blindly.

## Known deployments
- Production: https://hasib-ai-agent.onrender.com
- Test: https://hasib-ai-agent-test.onrender.com

## Repository and current work
- Repository: https://github.com/hasib103/hasib-ai-agent
- Existing PR #39: https://github.com/hasib103/hasib-ai-agent/pull/39
- PR #39 branch: fix/integrations-setup-cards; intended to restore actionable integration setup cards and reduce chat latency. Not confirmed merged or deployed.
- New branch: feat/open-source-agent-core, based on fix/integrations-setup-cards. No agent-core implementation committed yet at note creation time.
- Do not overwrite production/main or claim deployment without evidence.

## User's stated context
The app was already running. User was switching between test and final app modes, testing workflows and adding/removing features. They cleared ChatGPT conversation history due to long-chat issues; continue from repo/deployment state rather than asking them to explain everything again.
- User wants an open-source-based strong AI agent core, integrated with existing Gemini/Supabase and deployed service setup.
- User explicitly wants short progress notices during each step and continuity notes saved after each step.
- Do not repeatedly say auditing without a concrete deliverable.
- Notify only when work is actually complete and verified.
- User prefers Bengali, warm and direct.

## Important technical facts previously observed
- supabase/functions/task-runner/index.ts currently allowlists only generate_plan and create_memory_note; other task types return Task type is not allowlisted.
- Existing code has Gemini calls and fallback logic. Do not assume every provider is connected merely because environment settings/code exist.
- The earlier Integrations screenshot showed GitHub and Supabase cards with status Not connected and Connect — not available yet; user says this was an earlier page and expects restoration of existing app capability.
- PR #39 CI runs were reported successful in the previous session for Build and test, CodeQL Security Analysis, and Secret Scan, but this does not prove live app correctness.
- No Render workspace/log/deployment inspection without user permission; user did not yet confirm permission to use Render My Workspace.
- Never ask user to paste secrets into chat.

## Planned implementation sequence
1. Inspect repository architecture and open-source licenses; select reusable agent framework/components compatible with existing stack.
2. Implement agent core on feature branch with safe tool registry, policy/allowlist, task state, structured errors, retries/timeouts and audit trail.
3. Restore functional integrations status/setup; use existing configuration where present, implement provider APIs only where credentials/permissions and code support them.
4. Test unit/build/CI; document required environment variables and migrations without exposing secrets.
5. Verify test deployment (requires authorized access/tooling); only then propose production rollout.
6. Keep this file updated after each meaningful work step.

## Safety/accuracy rules
- No blind full-repo copy from another project. Respect open-source license, attribution and security.
- Do not falsely mark providers connected or claim end-to-end tests/deployment without evidence.
- Preserve working features and keep changes on feature branches until tested.
- Ask for credentials only through secure provider environment settings, never chat.