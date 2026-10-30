import { describe, expect, it, vi } from "vitest";
import {
  AiTokenBudgetExceededError,
  estimateReservedAiTokens,
  reserveAiTokenBudgetWithRpc,
  settleAiTokenBudgetWithRpc,
  type AiTokenBudgetKind,
} from "./ai-token-budget";

type RpcResponse = { data: unknown; error: unknown | null };

function reserveRpc(data: unknown, error: unknown | null = null) {
  return vi.fn(async (_args: { p_kind: AiTokenBudgetKind; p_reserved_tokens: number }): Promise<RpcResponse> => ({
    data,
    error,
  }));
}

function settleRpc(data: unknown, error: unknown | null = null) {
  return vi.fn(async (_args: { p_user_id: string; p_reservation_id: string; p_actual_tokens: number }): Promise<RpcResponse> => ({
    data,
    error,
  }));
}

describe("AI token budget", () => {
  it("reserves UTF-8 request bytes plus the maximum generated tokens", () => {
    expect(estimateReservedAiTokens(100, 1400)).toBe(1500);
    const bengaliBytes = new TextEncoder().encode("বাংলা ভাষা").length;
    expect(estimateReservedAiTokens(bengaliBytes, 100)).toBe(bengaliBytes + 100);
  });

  it("rejects an oversized reservation before contacting the provider", () => {
    expect(() => estimateReservedAiTokens(148_601, 1400)).toThrow("too large for the per-request token budget");
  });

  it("accepts an atomic server-side reservation", async () => {
    const rpc = reserveRpc([{
      allowed: true,
      reservation_id: "9c41da87-0231-4abf-9c41-da8702314abf",
      daily_remaining: 498_400,
      retry_after_seconds: 0,
    }]);
    await expect(reserveAiTokenBudgetWithRpc(rpc, "chat", 1600)).resolves.toEqual({
      reservationId: "9c41da87-0231-4abf-9c41-da8702314abf",
      reservedTokens: 1600,
      dailyRemaining: 498_400,
    });
    expect(rpc).toHaveBeenCalledWith({ p_kind: "chat", p_reserved_tokens: 1600 });
  });

  it("rejects requests when the rolling daily token budget is exhausted", async () => {
    const rpc = reserveRpc([{
      allowed: false,
      reservation_id: null,
      daily_remaining: 0,
      retry_after_seconds: 3600,
    }]);
    await expect(reserveAiTokenBudgetWithRpc(rpc, "planner", 5000)).rejects.toBeInstanceOf(AiTokenBudgetExceededError);
    await expect(reserveAiTokenBudgetWithRpc(rpc, "planner", 5000)).rejects.toThrow("1 hour");
  });

  it("fails closed when reservation accounting is unavailable", async () => {
    await expect(reserveAiTokenBudgetWithRpc(reserveRpc(null, new Error("offline")), "chat", 1000))
      .rejects.toThrow("AI token-budget protection is temporarily unavailable");
  });

  it("settles actual provider token usage", async () => {
    const rpc = settleRpc(true);
    await expect(settleAiTokenBudgetWithRpc(rpc, "00000000-0000-0000-0000-000000000001", "9c41da87-0231-4abf-9c41-da8702314abf", 1200)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith({
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_reservation_id: "9c41da87-0231-4abf-9c41-da8702314abf",
      p_actual_tokens: 1200,
    });
  });

  it("retains the conservative reservation when settlement fails", async () => {
    await expect(settleAiTokenBudgetWithRpc(settleRpc(false), "00000000-0000-0000-0000-000000000001", "9c41da87-0231-4abf-9c41-da8702314abf", 1200))
      .rejects.toThrow("conservative reservation remains charged");
  });
});
