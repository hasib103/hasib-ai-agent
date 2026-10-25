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
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("URL analysis supports only standard HTTP/HTTPS ports");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
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

  const sensitiveQueryKey = /^(?:token|secret|password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|session|signature|authorization|auth)$/i;
  for (const key of url.searchParams.keys()) {
    if (sensitiveQueryKey.test(key)) {
      throw new Error("Remove credentials or secret query parameters before analyzing this URL");
    }
  }

  url.hash = "";
  return url;
}
