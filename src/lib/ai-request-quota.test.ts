import { describe, expect, it, vi } from "vitest";
import {
  AiRequestQuotaExceededError,
  consumeAiRequestQuota,
  type AiRequestKind,
} from "./ai-request-quota";

function rpcResult(
  data: unknown,
  error: unknown | null = null,
): (kind: AiRequestKind) => Promise<{ data: unknown; error: unknown | null }> {
  return vi.fn(async () => ({ data, error }));
}

describe("consumeAiRequestQuota", () => {
  it("accepts a permitted request and returns remaining daily allowance", async () => {
    const rpc = rpcResult([{ allowed: true, retry_after_seconds: 0, daily_remaining: 99 }]);

    await expect(consumeAiRequestQuota(rpc, "chat")).resolves.toEqual({
      allowed: true,
      retry_after_seconds: 0,
      daily_remaining: 99,
    });
    expect(rpc).toHaveBeenCalledWith("chat");
  });

  it("rejects a request that exceeds the server-side quota", async () => {
    const rpc = rpcResult([{ allowed: false, retry_after_seconds: 90, daily_remaining: 0 }]);

    await expect(consumeAiRequestQuota(rpc, "planner")).rejects.toMatchObject({
      name: "AiRequestQuotaExceededError",
      retryAfterSeconds: 90,
      dailyRemaining: 0,
    });
  });

  it("fails closed when the quota RPC returns an error", async () => {
    const rpc = rpcResult(null, new Error("function unavailable"));

    await expect(consumeAiRequestQuota(rpc, "chat")).rejects.toThrow(
      "AI usage protection is temporarily unavailable",
    );
  });

  it("fails closed for a malformed quota response", async () => {
    await expect(consumeAiRequestQuota(rpcResult([{ allowed: "yes" }]), "chat"))
      .rejects.toThrow("AI usage protection returned an invalid response");
  });

  it("exposes a user-readable quota error", async () => {
    const rpc = rpcResult([{ allowed: false, retry_after_seconds: 65, daily_remaining: 2 }]);

    await expect(consumeAiRequestQuota(rpc, "chat")).rejects.toBeInstanceOf(
      AiRequestQuotaExceededError,
    );
    await expect(consumeAiRequestQuota(rpc, "chat")).rejects.toThrow("2 minutes");
  });
});
