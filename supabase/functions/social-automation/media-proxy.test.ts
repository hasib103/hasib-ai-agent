import { buildMediaProxyUrl, fetchVideoViaProxy, MAX_MEDIA_BYTES } from "./media-proxy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(run: () => unknown, messageIncludes: string) {
  let thrown: unknown;
  try { run(); } catch (error) { thrown = error; }
  assert(thrown instanceof Error, "Expected the operation to throw");
  assert(thrown.message.includes(messageIncludes), "Unexpected error: " + thrown.message);
}

async function assertRejects(run: () => Promise<unknown>, messageIncludes: string) {
  let thrown: unknown;
  try { await run(); } catch (error) { thrown = error; }
  assert(thrown instanceof Error, "Expected the operation to reject");
  assert(thrown.message.includes(messageIncludes), "Unexpected error: " + thrown.message);
}

Deno.test("builds only the media endpoint from the configured proxy URL", () => {
  assert(buildMediaProxyUrl("https://proxy.example.com/fetch") === "https://proxy.example.com/fetch-media", "Expected /fetch-media endpoint");
  assertThrows(() => buildMediaProxyUrl("http://proxy.example.com/fetch"), "HTTPS");
  assertThrows(() => buildMediaProxyUrl("https://proxy.example.com/other"), "exact /fetch");
  assertThrows(() => buildMediaProxyUrl("https://proxy.example.com/fetch?token=x"), "exact /fetch");
});

Deno.test("fetches media only through the trusted proxy with bounded safety options", async () => {
  let calls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    assert(String(input) === "https://proxy.example.com/fetch-media", "Target URL must never be fetched directly");
    assert(init?.method === "POST", "Proxy fetch must use POST");
    const headers = new Headers(init?.headers);
    assert(headers.get("authorization") === "Bearer test-only-token", "Expected the proxy token");
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert(request.url === "https://cdn.example.com/video.mp4?sig=opaque", "The signed media URL should be sent only to the proxy");
    assert(request.maxBytes === MAX_MEDIA_BYTES && request.pinResolvedAddress === true && request.followRedirects === false, "Expected bounded, DNS-pinned options");
    return new Response("video", { headers: { "x-upstream-content-type": "video/mp4", "x-upstream-content-length": "5" } });
  }) as typeof fetch;
  const result = await fetchVideoViaProxy("https://cdn.example.com/video.mp4?sig=opaque", "https://proxy.example.com/fetch", "test-only-token", fetcher);
  assert(calls === 1, "Expected exactly one proxy request");
  assert(result.contentType === "video/mp4" && new TextDecoder().decode(result.media) === "video", "Expected video bytes and MIME type");
});

Deno.test("rejects non-video responses", async () => {
  const fetcher = (async () => new Response("not video", { headers: { "x-upstream-content-type": "text/html" } })) as typeof fetch;
  await assertRejects(() => fetchVideoViaProxy("https://cdn.example.com/video.mp4", "https://proxy.example.com/fetch", "test-only-token", fetcher), "unsupported media type");
});
