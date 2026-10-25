import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "supabase/functions/task-runner/index.ts"),
  "utf8",
);

describe("Task Runner AI quota enforcement", () => {
  it("consumes the planner request quota before calling Gemini", () => {
    const quotaIndex = source.indexOf('supabase.rpc("consume_ai_request"');
    const providerIndex = source.indexOf("const response = await fetchGeminiWithFallback(apiKey, model, requestBody, timeoutMs)");
    expect(quotaIndex).toBeGreaterThan(-1);
    expect(providerIndex).toBeGreaterThan(-1);
    expect(quotaIndex).toBeLessThan(providerIndex);
  });

  it("reserves token budget before provider use and settles only through the server role", () => {
    expect(source).toContain('supabase.rpc("reserve_ai_token_budget"');
    expect(source).toContain('serviceSupabase.rpc("settle_ai_token_budget_server"');
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("p_user_id: auth.user.id");
    expect(source).toContain("usageMetadata?.totalTokenCount");
    expect(source).toContain("actualTokens > 300_000");
    expect(source).toContain("conservative AI token reservation retained");
    expect(source).toContain("Provider usage exceeded the settlement maximum");
    expect(source).not.toContain('supabase.rpc("settle_ai_token_budget"');
  });

  it("requeues quota-blocked tasks without consuming a retry attempt", () => {
    expect(source).toContain('status: "queued"');
    expect(source).toContain("attempt_count: queuedTask.attempt_count");
    expect(source).toContain("AI planner request limit reached");
    expect(source).toContain("Daily AI token budget reached");
  });
});
