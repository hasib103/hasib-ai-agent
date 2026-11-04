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

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  ).map((value) => value.trim()))].slice(0, 8);
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.ceil(value));
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)s$/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds)) : null;
}

function parseRetryAfterHeader(value: string | null | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.max(1, Math.ceil(numeric));
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(1, Math.ceil((timestamp - Date.now()) / 1000)) : null;
}

export function inspectGeminiRateLimit(
  payload: unknown,
  retryAfterHeader?: string | null,
): GeminiRateLimitInfo {
  const root = asRecord(payload);
  const error = asRecord(root?.error);
  const message = typeof error?.message === "string" ? error.message : "";
  const details = Array.isArray(error?.details) ? error.details : [];
  const violations = details.flatMap((detail) => {
    const record = asRecord(detail);
    return Array.isArray(record?.violations)
      ? record.violations.map(asRecord).filter((item): item is JsonRecord => item !== null)
      : [];
  });
  const quotaIds = uniqueStrings(violations.map((item) => item.quotaId));
  const quotaMetrics = uniqueStrings(violations.map((item) => item.quotaMetric));
  const model = violations
    .map((item) => asRecord(item.quotaDimensions)?.model)
    .find((value): value is string => typeof value === "string") ?? null;
  const source = [message, ...quotaIds, ...quotaMetrics].join(" ").toLowerCase();
  const retryInfo = details
    .map(asRecord)
    .find((item) => typeof item?.["@type"] === "string" && item["@type"].endsWith("RetryInfo"));
  const retryAfterSeconds = parseDurationSeconds(retryInfo?.retryDelay) ??
    parseRetryAfterHeader(retryAfterHeader);

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

    category = "per_minute_quota";
  } else if (/capacity|overload|temporarily unavailable/i.test(source)) {
    category = "provider_capacity";
  }

  return { category, quotaIds, quotaMetrics, model, retryAfterSeconds };
}

export function shouldUseGoogleSearch(message: string): boolean {
  const query = message.normalize("NFKC").toLowerCase();
  const englishIntent = /\b(?:search(?: the web)?|browse|look up|find online|online|web|latest|current|today|right now|news|price|cost|rate|exchange rate|stock|market|weather|forecast|recent|update|source|sources|citation|cite|official site|website|review|reviews)\b/i;
  const bengaliIntent = /(?:সার্চ|খুঁজে|অনলাইনে|ওয়েবে|সর্বশেষ|সাম্প্রতিক|আজ|এখন|বর্তমানে|খবর|দাম|দর|রেট|বিনিময় হার|শেয়ার বাজার|আবহাওয়া|পূর্বাভাস|আপডেট|সূত্র|লিংক|রিভিউ|তুলনা)/i;
  return englishIntent.test(query) || bengaliIntent.test(query);
}

export function describeGeminiRateLimit(info: GeminiRateLimitInfo, language = "en"): string {
  const wait = info.retryAfterSeconds
    ? language.toLowerCase().startsWith("bn")
      ? " Retry-After অনুযায়ী প্রায় " + info.retryAfterSeconds + " সেকেন্ড পরে আবার চেষ্টা করুন।"
      : " Retry after about " + info.retryAfterSeconds + " seconds."
    : "";
  if (language.toLowerCase().startsWith("bn")) {
    switch (info.category) {
      case "search_grounding":
        return "Gemini-এর Google Search grounding quota অতিক্রম হয়েছে। Search ছাড়া পুনরায় চেষ্টা করা হয়েছে; AI Studio-তে project-এর grounding quota পরীক্ষা করুন।" + wait;
      case "daily_quota":
        return "Gemini project/model-এর দৈনিক quota শেষ হয়েছে। quota reset হওয়া পর্যন্ত অপেক্ষা করুন বা Google AI Studio-তে billing ও usage tier পরীক্ষা করুন।" + wait;
      case "per_minute_quota":
        return "Gemini project/model-এর request বা token-per-minute সীমা অতিক্রম হয়েছে। কিছুক্ষণ বিরতি দিয়ে আবার চেষ্টা করুন।" + wait;
      case "spend_cap":
        return "Gemini project-এর billing, prepay balance বা spend cap অনুরোধটি আটকে দিয়েছে। Google AI Studio-তে billing ও spend limit পরীক্ষা করুন।" + wait;
      case "provider_capacity":
        return "Gemini provider-এর serving capacity সাময়িকভাবে সীমিত। কিছুক্ষণ পরে আবার চেষ্টা করুন।" + wait;
      default:
        return "Gemini provider সব fallback model-এ HTTP 429 ফিরিয়েছে। এটি provider/project quota বা capacity সীমা; Google AI Studio-তে active Rate Limits ও Billing পরীক্ষা করুন।" + wait;
    }
  }
  switch (info.category) {
    case "search_grounding":
      return "Gemini Google Search grounding quota was exceeded. The request was retried without web search; review the project's grounding quota in Google AI Studio." + wait;
    case "daily_quota":
      return "The Gemini project/model daily quota is exhausted. Wait for the reset or review the project's billing tier in Google AI Studio." + wait;
    case "per_minute_quota":
      return "The Gemini project/model request or token-per-minute quota was exceeded. Pause briefly and retry." + wait;
    case "spend_cap":
      return "The Gemini project's billing, prepay balance, or spend cap blocked this request. Review billing and spend limits in Google AI Studio." + wait;
    case "provider_capacity":
      return "Gemini serving capacity is temporarily limited. Please retry shortly." + wait;
    default:
      return "Gemini returned HTTP 429 across the available models. This is a provider/project quota or capacity limit; review the active Rate Limits and Billing in Google AI Studio." + wait;
  }
}
