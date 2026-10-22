# AI usage guardrails

Add database-backed per-user request quotas before broad public launch. Limits should be enforced server-side, fail closed when quota checks are unavailable, and be tested before rollout. Do not deploy code that calls a quota RPC until the matching migration is applied. Request-count limits are not a token-accurate monetary budget.
