import { validatePublicAnalysisUrl } from "./public-url.ts";

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
