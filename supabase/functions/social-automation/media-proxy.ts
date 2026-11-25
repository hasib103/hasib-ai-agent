export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

const allowedVideoTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/3gpp",
  "video/mpeg",
  "video/x-matroska",
  "video/x-msvideo",
]);

export function buildMediaProxyUrl(proxyUrl: string): string {
  let url: URL;
  try {
    url = new URL(proxyUrl);
  } catch {
    throw new Error("Invalid trusted media proxy URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/fetch" || url.search || url.hash) {
    throw new Error("The trusted media proxy must use HTTPS and the exact /fetch endpoint.");
  }
  url.pathname = "/fetch-media";
  return url.toString();
}

export async function fetchVideoViaProxy(
  mediaUrl: string,
  proxyUrl: string,
  proxyToken: string,
  fetcher: typeof fetch = fetch,
): Promise<{ media: Uint8Array; contentType: string }> {
  const endpoint = buildMediaProxyUrl(proxyUrl);
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + proxyToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: mediaUrl,
      maxBytes: MAX_MEDIA_BYTES,
      followRedirects: false,
      rejectNonPublicAddresses: true,
      pinResolvedAddress: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error("The trusted media proxy could not fetch the video source.");
  const contentType = (response.headers.get("x-upstream-content-type") || "").split(";")[0].trim().toLowerCase();
  if (!allowedVideoTypes.has(contentType)) throw new Error("The video source returned an unsupported media type.");
  const reportedLength = Number(response.headers.get("x-upstream-content-length") || response.headers.get("content-length") || 0);
  if (reportedLength > MAX_MEDIA_BYTES) throw new Error("Video is over the 50 MB upload safety limit for this workflow.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("Video is over the 50 MB upload safety limit for this workflow.");
  if (buffer.byteLength === 0) throw new Error("Media source returned an empty body.");
  return { media: new Uint8Array(buffer), contentType };
}
