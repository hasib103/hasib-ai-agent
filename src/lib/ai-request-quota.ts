export type AiRequestKind = "chat" | "planner";

type QuotaRpcRow = { allowed: boolean; retry_after_seconds: number; daily_remaining: number };
type QuotaRpcResponse = { data: unknown; error: unknown | null };
type QuotaRpcCall = (kind: AiRequestKind) => PromiseLike<QuotaRpcResponse>;

export class AiRequestQuotaExceededError extends Error {
  readonly retryAfterSeconds: number;
  readonly dailyRemaining: number;
  constructor(retryAfterSeconds: number, dailyRemaining: number) {
    const seconds = Math.max(1, Math.floor(retryAfterSeconds));
    const wait = seconds < 60 ? seconds + " seconds" : seconds < 3600 ? Math.ceil(seconds / 60) + " minutes" : Math.ceil(seconds / 3600) + " hours";
    super("AI request limit reached. Please try again in " + wait + ".");
    this.name = "AiRequestQuotaExceededError";
    this.retryAfterSeconds = seconds;
    this.dailyRemaining = Math.max(0, Math.floor(dailyRemaining));
  }
}

export async function consumeAiRequestQuota(rpcCall: QuotaRpcCall, kind: AiRequestKind): Promise<QuotaRpcRow> {
  let response: QuotaRpcResponse;
  try { response = await rpcCall(kind); }
  catch { throw new Error("AI usage protection is temporarily unavailable. Please try again shortly."); }
  if (response.error) throw new Error("AI usage protection is temporarily unavailable. Please try again shortly.");
  const candidate = Array.isArray(response.data) ? response.data[0] : response.data;
  if (typeof candidate !== "object" || candidate === null) throw new Error("AI usage protection returned an invalid response. Please try again shortly.");
  const row = candidate as Record<string, unknown>;
  if (typeof row.allowed !== "boolean" || typeof row.retry_after_seconds !== "number" || !Number.isFinite(row.retry_after_seconds) || typeof row.daily_remaining !== "number" || !Number.isFinite(row.daily_remaining)) {
    throw new Error("AI usage protection returned an invalid response. Please try again shortly.");
  }
  const quota: QuotaRpcRow = { allowed: row.allowed, retry_after_seconds: Math.max(0, Math.floor(row.retry_after_seconds)), daily_remaining: Math.max(0, Math.floor(row.daily_remaining)) };
  if (!quota.allowed) throw new AiRequestQuotaExceededError(quota.retry_after_seconds, quota.daily_remaining);
  return quota;
}
