export type GeminiQuotaCategory =
  | "search_grounding"
  | "daily_quota"
  | "per_minute_quota"
  | "spend_cap"
  | "provider_capacity"
  | "unknown";

export type GeminiRateLimitInfo = {
  category: GeminiQuotaCategory;
  quotaIds: string[];
  quotaMetrics: string[];
  model: string | null;
  retryAfterSeconds: number | null;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function parseRetryDelay(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.ceil(value);
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)s$/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds)) : null;
}

function parseRetryAfterHeader(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.max(1, Math.ceil(seconds));
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(1, Math.ceil((timestamp - Date.now()) / 1000)) : null;
}

export function inspectGeminiRateLimit(
  payload: unknown,
  retryAfterHeader?: string | null,
): GeminiRateLimitInfo {
  const error = asRecord(asRecord(payload)?.error);
  const message = typeof error?.message === "string" ? error.message : "";
  const details = Array.isArray(error?.details) ? error.details : [];
  const violations = details.flatMap((detail) => {
    const record = asRecord(detail);
    return Array.isArray(record?.violations)
      ? record.violations.map(asRecord).filter((item): item is JsonRecord => item !== null)
      : [];
  });
  const quotaIds = [...new Set(violations.map((item) => item.quotaId)
    .filter((value): value is string => typeof value === "string" && value.length > 0))].slice(0, 8);
  const quotaMetrics = [...new Set(violations.map((item) => item.quotaMetric)
    .filter((value): value is string => typeof value === "string" && value.length > 0))].slice(0, 8);
  const model = violations
    .map((item) => asRecord(item.quotaDimensions)?.model)
    .find((value): value is string => typeof value === "string") ?? null;
  const source = [message, ...quotaIds, ...quotaMetrics].join(" ").toLowerCase();
  const retryInfo = details.map(asRecord)
    .find((item) => typeof item?.["@type"] === "string" && item["@type"].endsWith("RetryInfo"));
  const retryAfterSeconds = parseRetryDelay(retryInfo?.retryDelay) ?? parseRetryAfterHeader(retryAfterHeader);

  let category: GeminiQuotaCategory = "unknown";
  if (/grounding|google[_-]?search|search.*(?:request|quota)/i.test(source)) {
    category = "search_grounding";
  } else if (/per[_-]?day|daily|requestsperday|tokensperday|\brpd\b|\btpd\b/i.test(source)) {
    category = "daily_quota";
  } else if (/per[_-]?minute|requestsperminute|tokensperminute|\brpm\b|\btpm\b/i.test(source)) {
    category = "per_minute_quota";
  } else if (/spend.?cap|billing|prepay|payment|credit balance/i.test(source)) {
    category = "spend_cap";
  } else if (/capacity|overload|temporarily unavailable/i.test(source)) {
    category = "provider_capacity";
  }

  return { category, quotaIds, quotaMetrics, model, retryAfterSeconds };
}

export function describeGeminiRateLimit(info: GeminiRateLimitInfo): string {
  const wait = info.retryAfterSeconds ? " Retry after about " + info.retryAfterSeconds + " seconds." : "";
  switch (info.category) {
    case "search_grounding":
      return "Gemini Google Search grounding quota was exceeded. " + "Review the project's grounding quota in Google AI Studio." + wait;
    case "daily_quota":
      return "The Gemini project/model daily quota is exhausted. Wait for reset or review the project's usage tier in Google AI Studio." + wait;
    case "per_minute_quota":
      return "The Gemini project/model request or token-per-minute quota was exceeded. Pause briefly and retry." + wait;
    case "spend_cap":
      return "The Gemini project's billing, prepay balance, or spend cap blocked this request. Review billing in Google AI Studio." + wait;
    case "provider_capacity":
      return "Gemini serving capacity is temporarily limited. Please retry shortly." + wait;
    default:
      return "Gemini returned HTTP 429 across the available models. Review the active project/model Rate Limits and Billing in Google AI Studio." + wait;
  }
}
