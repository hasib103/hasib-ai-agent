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

const publicDns = async (_hostname: string, type: "A" | "AAAA"): Promise<string[]> =>
  type === "A" ? ["93.184.216.34"] : ["2606:2800:220:1:248:1893:25c8:1946"];

async function assertRejects(run: () => Promise<unknown>, messageIncludes: string) {
  let thrown: unknown;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof Error, "Expected the public page fetcher to reject this response");
  assert(thrown.message.includes(messageIncludes), "Unexpected fetch error: " + thrown.message);
}

Deno.test("fetches only bounded text pages and strips active HTML content", async () => {
  const html = "<html><head><title>News &amp; Updates</title><script>secret()</script></head><body><h1>Hello</h1><p>Visible text &amp; more</p></body></html>";
  const fetcher = (async () => new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  })) as typeof fetch;
  const page = await fetchPublicPageContent(new URL("https://example.com/article"), {
    fetcher,
    resolveDns: publicDns,
  });
  assert(page.title === "News & Updates", "Expected the HTML title to be extracted");
  assert(page.text.includes("Visible text & more"), "Expected visible page text");
  assert(!page.text.includes("secret()"), "Script content must be removed");
});

Deno.test("blocks private DNS answers before fetching a page", async () => {
  let fetchCalls = 0;
  const fetcher = (async () => {
    fetchCalls += 1;
    return new Response("should not fetch", { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof fetch;
  const privateDns = async (_hostname: string, type: "A" | "AAAA"): Promise<string[]> =>
    type === "A" ? ["10.0.0.5"] : [];
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), { fetcher, resolveDns: privateDns }),
    "public IP addresses",
  );
  assert(fetchCalls === 0, "A private DNS answer must be rejected before network fetch");
});

Deno.test("does not follow redirects or download oversized pages", async () => {
  const redirectFetcher = (async () => new Response(null, {
    status: 302,
    headers: { location: "http://127.0.0.1/" },
  })) as typeof fetch;
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), { fetcher: redirectFetcher, resolveDns: publicDns }),
    "redirects are not followed",
  );

  const largeFetcher = (async () => new Response("small", {
    status: 200,
    headers: { "content-type": "text/plain", "content-length": "300000" },
  })) as typeof fetch;
  await assertRejects(
    () => fetchPublicPageContent(new URL("https://example.com/"), { fetcher: largeFetcher, resolveDns: publicDns }),
    "256 KB safety limit",
  );
});
