import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { settleAiTokenBudgetWithRpc } from "./ai-token-budget";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261027223000_allow_actual_ai_token_settlement.sql"),
  "utf8",
);
const budgetSource = readFileSync(resolve(process.cwd(), "src/lib/ai-token-budget.ts"), "utf8");
const plannerSource = readFileSync(resolve(process.cwd(), "src/lib/ai-plan.functions.ts"), "utf8");
const voiceSource = readFileSync(resolve(process.cwd(), "src/lib/voice-chat.functions.ts"), "utf8");

const userId = "00000000-0000-0000-0000-000000000001";
const reservationId = "00000000-0000-0000-0000-000000000002";

describe("server-side AI token settlement", () => {
  it("passes user identity and actual usage to the server-only RPC", async () => {
    const rpc = vi.fn(async (_args: {
      p_user_id: string;
      p_reservation_id: string;
      p_actual_tokens: number;
    }) => ({ data: true, error: null }));

    await settleAiTokenBudgetWithRpc(rpc, userId, reservationId, 2_400);

    expect(rpc).toHaveBeenCalledWith({
      p_user_id: userId,
      p_reservation_id: reservationId,
      p_actual_tokens: 2_400,
    });
  });

  it("allows settlement to record actual usage above the original reservation", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await expect(
      settleAiTokenBudgetWithRpc(rpc, userId, reservationId, 180_000),
    ).resolves.toBeUndefined();
  });

  it("keeps the reservation charged when server settlement fails", async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    await expect(
      settleAiTokenBudgetWithRpc(rpc, userId, reservationId, 1_000),
    ).rejects.toThrow("conservative reservation remains charged");
  });

  it("rejects invalid identity, reservation, and out-of-range usage before RPC", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    await expect(settleAiTokenBudgetWithRpc(rpc, "", reservationId, 0)).rejects.toThrow("Invalid AI token settlement");
    await expect(settleAiTokenBudgetWithRpc(rpc, userId, "short", 0)).rejects.toThrow("Invalid AI token settlement");
    await expect(settleAiTokenBudgetWithRpc(rpc, userId, reservationId, 300_001)).rejects.toThrow("Invalid AI token settlement");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the server-role key and never calls the revoked browser settlement RPC", () => {
    expect(budgetSource).toContain('process.env["SUPABASE_SERVICE_ROLE_KEY"]');
    expect(budgetSource).toContain('client.rpc("settle_ai_token_budget_server", args)');
    expect(budgetSource).not.toContain('client.rpc("settle_ai_token_budget", args)');
    expect(plannerSource).toContain("settleAiTokenBudget(authData.user.id, tokenReservation.reservationId, actualTokens)");
    expect(voiceSource).toContain("settleAiTokenBudget(authData.user.id, tokenReservation.reservationId, actualTokens)");
    expect(voiceSource).toContain("google_search");
    expect(voiceSource).not.toContain("url_context");
    expect(voiceSource).toContain("Task Inbox > Analyze a public URL");
  });

  it("allows actual usage up to 300,000 tokens while keeping execution service-role-only", () => {
    expect(migration).toContain("p_actual_tokens > 300000");
    expect(migration).not.toContain("p_actual_tokens > v_reserved_tokens");
    expect(migration).toContain("SET search_path TO ''");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.settle_ai_token_budget_server");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.settle_ai_token_budget_server");
  });
});
