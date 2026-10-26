import { fetchPublicPageContent, validatePublicAnalysisUrl } from "./public-url.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(run: () => unknown, messageIncludes: string) {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof Error, "Expected the URL validator to reject this input");
  assert(thrown.message.includes(messageIncludes), "Unexpected validation error: " + thrown.message);
}

async function assertRejects(run: () => Promise<unknown>, messageIncludes: string) {
  let thrown: unknown;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof Error, "Expected the operation to reject");
  assert(thrown.message.includes(messageIncludes), "Unexpected error: " + thrown.message);
}

const PROXY_URL = "https://safe-egress.example.com/fetch";
const PROXY_TOKEN = "test-only-proxy-token";
const publicDns = async (_hostname: string, type: "A" | "AAAA"): Promise<string[]> =>
  type === "A" ? ["93.184.216.34"] : ["2606:2800:220:1:248:1893:25c8:1946"];

Deno.test("accepts public HTTP/HTTPS URLs and removes fragments", () => {
  const url = validatePublicAnalysisUrl("https://example.com/article?lang=bn#private-fragment");
  assert(url.protocol === "https:", "HTTPS should be accepted");
  assert(url.hostname === "example.com", "Expected the public hostname");
  assert(url.hash === "", "Fragments must not be sent to the provider");
  assert(validatePublicAnalysisUrl("http://example.org").protocol === "http:", "HTTP should be accepted");
});

Deno.test("rejects unsupported schemes and malformed URLs", () => {
  assertThrows(() => validatePublicAnalysisUrl("javascript:alert(1)"), "HTTP and HTTPS");
  assertThrows(() => validatePublicAnalysisUrl("file:///etc/passwd"), "HTTP and HTTPS");
  assertThrows(() => validatePublicAnalysisUrl("not a URL"), "valid public");
});

Deno.test("rejects credentials, local hosts, and IP-literal addresses", () => {
  assertThrows(() => validatePublicAnalysisUrl("https://user:pass@example.com/"), "embedded credentials");
  assertThrows(() => validatePublicAnalysisUrl("http://localhost/"), "public DNS hostname");
  assertThrows(() => validatePublicAnalysisUrl("http://127.0.0.1/"), "public DNS hostname");
  assertThrows(() => validatePublicAnalysisUrl("http://[::1]/"), "public DNS hostname");
  assertThrows(() => validatePublicAnalysisUrl("https://service.internal/"), "public DNS hostname");
});

Deno.test("rejects non-standard ports, sensitive query keys, and oversized URLs", () => {
  assertThrows(() => validatePublicAnalysisUrl("https://example.com:8443/"), "standard HTTP/HTTPS ports");
  assertThrows(() => validatePublicAnalysisUrl("https://example.com/?api_key=secret"), "secret query parameters");
  assertThrows(() => validatePublicAnalysisUrl("https://example.com/?access_token=secret"), "secret query parameters");
  assertThrows(() => validatePublicAnalysisUrl("https://example.com/" + "a".repeat(2050)), "2048 characters");
});

Deno.test("fetches through the configured proxy only and strips active HTML content", async () => {
  const html = "<html><head><title>News &amp; Updates</title><script>secret()</script></head><body><h1>Hello</h1><p>Visible text &amp; more</p></body></html>";
  let fetchCalls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1;
    assert(String(input) === PROXY_URL, "The user-supplied target must never be fetched directly");
    assert(init?.method === "POST", "The egress proxy must be called with POST");
    const headers = new Headers(init?.headers);
    assert(headers.get("authorization") === "Bearer " + PROXY_TOKEN, "The proxy token must be sent in the authorization header");
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert(request.url === "https://example.com/article", "The target URL should be sent only in the proxy request body");
    assert(request.maxBytes === 256 * 1024 && request.pinResolvedAddress === true, "The proxy must receive strict SSRF and size requirements");
    return new Response(html, {
      status: 200,
      headers: {
        "x-upstream-status": "200",
        "x-upstream-content-type": "text/html; charset=utf-8",
        "x-upstream-content-length": String(new TextEncoder().encode(html).length),
      },
    });
  }) as typeof fetch;

  const page = await fetchPublicPageContent(new URL("https://example.com/article"), {
    fetcher,
    resolveDns: publicDns,
    proxyUrl: PROXY_URL,
    proxyToken: PROXY_TOKEN,
  });
  assert(fetchCalls === 1, "Expected exactly one call to the configured proxy");
  assert(page.title === "News & Updates", "Expected the HTML title to be extracted");
  assert(page.text.includes("Visible text & more"), "Expected visible page text");
  assert(!page.text.includes("secret()"), "Script content must be removed");
});

Deno.test("fails closed when the DNS-pinning egress proxy is not configured", async () => {
  let fetchCalls = 0;
  const fetcher = (async () => {
    fetchCalls += 1;
    return new Response("must not fetch", { status: 200 });
  }) as typeof fetch;
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), { fetcher, resolveDns: publicDns }),
    "DNS-pinning egress proxy is configured",
  );
  assert(fetchCalls === 0, "No direct target request may occur when the proxy is not configured");
});

Deno.test("blocks private DNS answers before calling the proxy", async () => {
  let fetchCalls = 0;
  const fetcher = (async () => {
    fetchCalls += 1;
    return new Response("should not fetch", { status: 200 });
  }) as typeof fetch;
  const privateDns = async (_hostname: string, type: "A" | "AAAA"): Promise<string[]> =>
    type === "A" ? ["10.0.0.5"] : [];
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), {
      fetcher, resolveDns: privateDns, proxyUrl: PROXY_URL, proxyToken: PROXY_TOKEN,
    }),
    "public IP addresses",
  );
  assert(fetchCalls === 0, "A private DNS answer must be rejected before the proxy call");
});

Deno.test("does not accept redirects or oversized upstream pages", async () => {
  const redirectFetcher = (async () => new Response(null, {
    status: 200,
    headers: { "x-upstream-status": "302", "x-upstream-content-type": "text/html" },
  })) as typeof fetch;
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), {
      fetcher: redirectFetcher, resolveDns: publicDns, proxyUrl: PROXY_URL, proxyToken: PROXY_TOKEN,
    }),
    "redirects are not followed",
  );

  const largeFetcher = (async () => new Response("small", {
    status: 200,
    headers: {
      "x-upstream-status": "200",
      "x-upstream-content-type": "text/plain",
      "x-upstream-content-length": "300000",
    },
  })) as typeof fetch;
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), {
      fetcher: largeFetcher, resolveDns: publicDns, proxyUrl: PROXY_URL, proxyToken: PROXY_TOKEN,
    }),
    "256 KB safety limit",
  );
});

Deno.test("rejects an unsafe egress proxy URL", async () => {
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), {
      fetcher: (async () => new Response("must not fetch")) as typeof fetch,
      resolveDns: publicDns,
      proxyUrl: "http://safe-egress.example.com/fetch",
      proxyToken: PROXY_TOKEN,
    }),
    "trusted HTTPS endpoint",
  );
});
