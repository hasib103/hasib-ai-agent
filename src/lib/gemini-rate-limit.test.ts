import { describe, expect, it } from "vitest";
import { inspectGeminiRateLimit as inspectTaskRunnerGeminiRateLimit } from "../../supabase/functions/task-runner/gemini-rate-limit";
import {
  describeGeminiRateLimit,
  inspectGeminiRateLimit,
  shouldUseGoogleSearch,
} from "./gemini-rate-limit";

describe("Gemini quota diagnostics", () => {
  it("identifies Google Search grounding quota and retry delay", () => {
    const info = inspectGeminiRateLimit({
      error: {
        message: "Quota exceeded",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [{
              quotaMetric: "generativelanguage.googleapis.com/google_search_grounding_requests",
              quotaId: "GroundingSearchRequestsPerDay",
              quotaDimensions: { model: "gemini-3.8-flash" },
            }],
          },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "45s" },
        ],
      },
    });
    expect(info).toMatchObject({
      category: "search_grounding",
      model: "gemini-3.8-flash",
      retryAfterSeconds: 45,
    });
    expect(describeGeminiRateLimit(info, "bn-BD")).toContain("grounding quota");
  });

  it("distinguishes daily and per-minute model quotas", () => {
    const daily = inspectGeminiRateLimit({
      error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] },
    });
    const minute = inspectGeminiRateLimit({
      error: { details: [{ violations: [{ quotaMetric: "generate_content_input_tokens_per_minute" }] }] },
    });
    expect(daily.category).toBe("daily_quota");
    expect(minute.category).toBe("per_minute_quota");
  });

  it("uses Google Search only for explicit or time-sensitive requests", () => {
    expect(shouldUseGoogleSearch("Explain how photosynthesis works")).toBe(false);
    expect(shouldUseGoogleSearch("Find the latest Gemini API rate limits")).toBe(true);
    expect(shouldUseGoogleSearch("বাংলাদেশের আজকের খবর খুঁজে দাও")).toBe(true);
  });

  it("keeps Task Runner's Deno quota classifier aligned", () => {
    const info = inspectTaskRunnerGeminiRateLimit({
      error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] },
    });
    expect(info.category).toBe("daily_quota");
  });

  it("does not invent a retry delay when the provider gives none", () => {
    expect(inspectGeminiRateLimit({ error: { message: "Too many requests" } }).retryAfterSeconds).toBeNull();
  });
});
