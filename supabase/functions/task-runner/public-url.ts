const MAX_PUBLIC_PAGE_BYTES = 256 * 1024;
const MAX_PUBLIC_PAGE_TEXT_CHARS = 40_000;
const DNS_TIMEOUT_MS = 3_000;

type DnsRecordType = "A" | "AAAA";
type DnsResolver = (hostname: string, type: DnsRecordType) => Promise<string[]>;
type PublicPageFetchOptions = {
  // This transport is used only to call the configured trusted egress proxy, never the target URL.
  fetcher?: typeof fetch;
  resolveDns?: DnsResolver;
  proxyUrl?: string | null;
  proxyToken?: string | null;
};

export type PublicPageContent = {
  title: string;
  text: string;
  contentType: string;
};

export function validatePublicAnalysisUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    throw new Error("URL analysis requires a URL no longer than 2048 characters");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid public HTTP or HTTPS URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only public HTTP and HTTPS URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing embedded credentials are not allowed");
  }
  if (url.port && !((url.protocol === "http:" && url.port === "80") ||
                    (url.protocol === "https:" && url.port === "443"))) {
    throw new Error("URL analysis supports only standard HTTP/HTTPS ports");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hostname = hostname;
  if (!hostname.includes(".") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".onion") ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".invalid") ||
      hostname.startsWith("[") ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
      hostname.includes(":")) {
    throw new Error("URL analysis requires a public DNS hostname, not a local or IP-literal address");
  }

  const sensitiveQueryKey = /^(?:token|secret|password|passwd|key|api[_-]?key|access[_-]?token|refresh[_-]?token|session|signature|sig|authorization|auth|credential|client[_-]?secret|x-(?:amz|goog)-(?:signature|credential))$/i;
  for (const key of url.searchParams.keys()) {
    if (sensitiveQueryKey.test(key)) {
      throw new Error("Remove credentials or secret query parameters before analyzing this URL");
    }
  }

  url.hash = "";
  return url;
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return false;
  const [a, b, c] = octets as [number, number, number, number];

  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && ((b === 0 && (c === 0 || c === 2)) || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)) ) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0] ?? "";
  // Only global-unicast 2000::/3 addresses are accepted; mapped/private/special ranges fail closed.
  if (!normalized || normalized.startsWith("::") || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") ||
      normalized.startsWith("feb") || normalized.startsWith("ff") ||
      /^2001:db8:/i.test(normalized)) return false;
  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return firstHextet >= 0x2000 && firstHextet <= 0x3fff;
}

function isPublicAddress(address: string): boolean {
  return address.includes(":") ? isPublicIpv6(address) : isPublicIpv4(address);
}

async function resolveDnsOverHttps(hostname: string, type: DnsRecordType): Promise<string[]> {
  const endpoint = new URL("https://dns.google/resolve");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", type);
  const response = await fetch(endpoint, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Public DNS verification failed");
  const payload = await response.json() as {
    Status?: number;
    Answer?: Array<{ type?: number; data?: string }>;
  };
  if (payload.Status !== 0) {
    if (payload.Status === 3) return [];
    throw new Error("Public DNS verification failed");
  }
  const expectedType = type === "A" ? 1 : 28;
  return (payload.Answer ?? [])
    .filter((answer) => answer.type === expectedType && typeof answer.data === "string")
    .map((answer) => answer.data as string);
}

async function assertPublicDns(hostname: string, resolver: DnsResolver): Promise<void> {
  const [ipv4, ipv6] = await Promise.all([
    resolver(hostname, "A"),
    resolver(hostname, "AAAA"),
  ]);
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error("The URL hostname did not resolve exclusively to public IP addresses");
  }
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function extractHtmlText(html: string): { title: string; text: string } {
  const titleMarkup = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = decodeHtmlEntities(titleMarkup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 200);
  const text = html
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|td|th|header|footer|main|nav)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  return {
    title,
    text: decodeHtmlEntities(text).replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_PUBLIC_PAGE_TEXT_CHARS),
  };
}

function validateTrustedProxyUrl(value: string): URL {
  let proxy: URL;
  try {
    proxy = new URL(value);
  } catch {
    throw new Error("The configured public URL egress proxy URL is invalid");
  }

  const hostname = proxy.hostname.toLowerCase().replace(/\\.$/, "");
  if (proxy.protocol !== "https:" || proxy.username || proxy.password || proxy.search || proxy.hash ||
      (proxy.port && proxy.port !== "443") ||
      !hostname.includes(".") || hostname.startsWith("[") ||
      /^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(hostname) || hostname.includes(":") ||
      hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") ||
      hostname.endsWith(".test") || hostname.endsWith(".invalid")) {
    throw new Error("The public URL egress proxy must be a trusted HTTPS endpoint on a DNS hostname");
  }
  proxy.hostname = hostname;
  return proxy;
}

export async function fetchPublicPageContent(
  url: URL,
  options: PublicPageFetchOptions = {},
): Promise<PublicPageContent> {
  const resolver = options.resolveDns ?? resolveDnsOverHttps;
  await assertPublicDns(url.hostname, resolver);

  const rawProxyUrl = options.proxyUrl?.trim();
  const proxyToken = options.proxyToken?.trim();
  if (!rawProxyUrl || !proxyToken) {
    throw new Error("Secure URL analysis is disabled until a trusted DNS-pinning egress proxy is configured");
  }
  const proxyUrl = validateTrustedProxyUrl(rawProxyUrl);
  const fetcher = options.fetcher ?? fetch;

  // Never fetch the user-supplied target directly. The trusted proxy must independently resolve
  // all A/AAAA records, reject any non-public address, pin the selected IP for the socket while
  // preserving TLS hostname verification, refuse redirects, and enforce the requested byte cap.
  const response = await fetcher(proxyUrl.toString(), {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/octet-stream",
      authorization: "Bearer " + proxyToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url: url.toString(),
      maxBytes: MAX_PUBLIC_PAGE_BYTES,
      followRedirects: false,
      rejectNonPublicAddresses: true,
      pinResolvedAddress: true,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Trusted public URL proxy request failed (HTTP " + response.status + ")");
  }

  const upstreamStatusHeader = response.headers.get("x-upstream-status");
  const upstreamStatus = upstreamStatusHeader === null ? NaN : Number(upstreamStatusHeader);
  if (!Number.isInteger(upstreamStatus) || upstreamStatus < 100 || upstreamStatus > 599) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Trusted public URL proxy returned an invalid upstream status");
  }
  if (upstreamStatus >= 300 && upstreamStatus < 400) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("This URL redirects. Use the final public URL directly; redirects are not followed for safety.");
  }
  if (upstreamStatus < 200 || upstreamStatus >= 300) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Public page fetch failed (HTTP " + upstreamStatus + ")");
  }

  const contentType = (response.headers.get("x-upstream-content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const supportedTypes = new Set([
    "text/html",
    "application/xhtml+xml",
    "text/plain",
    "application/json",
    "text/xml",
    "application/xml",
    "text/csv",
  ]);
  if (!supportedTypes.has(contentType)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("This URL returns an unsupported content type; only public text/HTML pages are supported.");
  }

  const declaredLengthHeader = response.headers.get("x-upstream-content-length");
  const declaredLength = declaredLengthHeader === null ? NaN : Number(declaredLengthHeader);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_PAGE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("The public page is larger than the 256 KB safety limit.");
  }
  if (!response.body) throw new Error("The public page returned no readable content");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      if (!part.value) continue;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAX_PUBLIC_PAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("The public page is larger than the 256 KB safety limit.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const rawText = new TextDecoder().decode(bytes);
  const extracted = contentType === "text/html" || contentType === "application/xhtml+xml"
    ? extractHtmlText(rawText)
    : { title: "", text: decodeHtmlEntities(rawText).trim().slice(0, MAX_PUBLIC_PAGE_TEXT_CHARS) };
  if (!extracted.text) throw new Error("No readable text was found on the public page");

  return {
    title: extracted.title,
    text: extracted.text,
    contentType,
  };
}
