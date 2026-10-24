import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AiTokenBudgetKind = "chat" | "planner";
export const AI_TOKEN_BUDGET_PER_24_HOURS = 500_000;
export const MAX_AI_TOKEN_RESERVATION = 150_000;

type RpcResponse = { data: unknown; error: unknown | null };
type ReserveRpcArgs = { p_kind: AiTokenBudgetKind; p_reserved_tokens: number };
type SettleRpcArgs = { p_reservation_id: string; p_actual_tokens: number };
type ReserveRpcCall = (args: ReserveRpcArgs) => PromiseLike<RpcResponse>;
type SettleRpcCall = (args: SettleRpcArgs) => PromiseLike<RpcResponse>;

export type AiTokenReservation = {
  reservationId: string;
  reservedTokens: number;
  dailyRemaining: number;
};

export class AiTokenBudgetExceededError extends Error {
  readonly retryAfterSeconds: number;
  readonly dailyRemaining: number;

  constructor(retryAfterSeconds: number, dailyRemaining: number) {
    const seconds = Math.max(1, Math.floor(retryAfterSeconds));
    const wait = seconds < 60
      ? seconds + " seconds"
      : seconds < 3600
        ? Math.ceil(seconds / 60) + " minutes"
        : Math.ceil(seconds / 3600) + " hours";
    super("Daily AI token budget reached. Please try again in " + wait + ".");
    this.name = "AiTokenBudgetExceededError";
    this.retryAfterSeconds = seconds;
    this.dailyRemaining = Math.max(0, Math.floor(dailyRemaining));
  }
}

export function estimateReservedAiTokens(requestBodyCharacters: number, maxOutputTokens: number): number {
  if (!Number.isSafeInteger(requestBodyCharacters) || requestBodyCharacters < 0 ||
      !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 0) {
    throw new Error("Invalid AI token reservation estimate.");
  }
  // Two token units per UTF-16 code unit is deliberately conservative for multilingual prompts.
  const reserved = Math.max(1, Math.ceil(requestBodyCharacters * 2) + maxOutputTokens);
  if (reserved > MAX_AI_TOKEN_RESERVATION) {
    throw new Error("This AI request is too large for the per-request token budget. Shorten the prompt or conversation history.");
  }
  return reserved;
}

export async function reserveAiTokenBudgetWithRpc(
  rpcCall: ReserveRpcCall,
  kind: AiTokenBudgetKind,
  reservedTokens: number,
): Promise<AiTokenReservation> {
  let response: RpcResponse;
  try {
    response = await rpcCall({ p_kind: kind, p_reserved_tokens: reservedTokens });
  } catch {
    throw new Error("AI token-budget protection is temporarily unavailable. Please try again shortly.");
  }
  if (response.error) {
    throw new Error("AI token-budget protection is temporarily unavailable. Please try again shortly.");
  }
  const candidate = Array.isArray(response.data) ? response.data[0] : response.data;
  if (typeof candidate !== "object" || candidate === null) {
    throw new Error("AI token-budget protection returned an invalid response. Please try again shortly.");
  }
  const row = candidate as Record<string, unknown>;
  if (typeof row.allowed !== "boolean" ||
      typeof row.daily_remaining !== "number" || !Number.isFinite(row.daily_remaining) ||
      typeof row.retry_after_seconds !== "number" || !Number.isFinite(row.retry_after_seconds)) {
    throw new Error("AI token-budget protection returned an invalid response. Please try again shortly.");
  }
  if (!row.allowed) {
    throw new AiTokenBudgetExceededError(row.retry_after_seconds, row.daily_remaining);
  }
  if (typeof row.reservation_id !== "string" || row.reservation_id.length < 16) {
    throw new Error("AI token-budget protection returned an invalid reservation. Please try again shortly.");
  }
  return {
    reservationId: row.reservation_id,
    reservedTokens,
    dailyRemaining: Math.max(0, Math.floor(row.daily_remaining)),
  };
}

export async function settleAiTokenBudgetWithRpc(
  rpcCall: SettleRpcCall,
  reservationId: string,
  actualTokens: number,
): Promise<void> {
  if (!reservationId || !Number.isSafeInteger(actualTokens) || actualTokens < 0 || actualTokens > 300_000) {
    throw new Error("Invalid AI token settlement.");
  }
  let response: RpcResponse;
  try {
    response = await rpcCall({ p_reservation_id: reservationId, p_actual_tokens: actualTokens });
  } catch {
    throw new Error("AI token usage could not be settled; the conservative reservation remains charged.");
  }
  if (response.error || response.data !== true) {
    throw new Error("AI token usage could not be settled; the conservative reservation remains charged.");
  }
}

function authenticatedClient(accessToken: string) {
  return createClient(supabase.supabaseUrl, supabase.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });
}

export async function reserveAiTokenBudget(
  accessToken: string,
  kind: AiTokenBudgetKind,
  reservedTokens: number,
): Promise<AiTokenReservation> {
  const client = authenticatedClient(accessToken);
  return reserveAiTokenBudgetWithRpc(
    (args) => client.rpc("reserve_ai_token_budget", args),
    kind,
    reservedTokens,
  );
}

export async function settleAiTokenBudget(
  accessToken: string,
  reservationId: string,
  actualTokens: number,
): Promise<void> {
  const client = authenticatedClient(accessToken);
  await settleAiTokenBudgetWithRpc(
    (args) => client.rpc("settle_ai_token_budget", args),
    reservationId,
    actualTokens,
  );
}
