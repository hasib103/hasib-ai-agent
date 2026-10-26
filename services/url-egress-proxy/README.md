# Hasib AI Agent — URL Egress Proxy

This small server-side service fetches only public text pages for the Task Runner. It is deliberately separate from the Supabase Edge Function because the Edge Function's standard fetch API cannot pin a checked DNS answer to the socket connection.

## Security behavior

- `POST /fetch` requires `Authorization: Bearer <PUBLIC_URL_FETCH_PROXY_TOKEN>`; the token must be a high-entropy secret of at least 32 characters.
- Only HTTP/HTTPS URLs on standard ports are accepted. Embedded credentials, IP literals, local/reserved hostnames, sensitive query keys and redirects are rejected.
- Every outbound connection resolves the target hostname inside the custom `DialContext`, rejects the entire answer set if any A/AAAA result is not globally public, and dials a validated IP literal directly. TLS certificate verification and SNI continue to use the original hostname.
- The proxy does not follow redirects, forwards no caller cookies or authorization headers to the target, allows only text/HTML content types, caps upstream response bytes at 256 KiB, limits concurrent fetches, and applies short timeouts.
- `GET /healthz` is a liveness endpoint and does not expose configuration or secrets.

## Render deployment

Create a separate Render Web Service from this repository using Docker runtime, branch `main`, and Dockerfile path `services/url-egress-proxy/Dockerfile`. Set a randomly generated `PUBLIC_URL_FETCH_PROXY_TOKEN` (at least 32 characters) in the proxy service. After the service is deployed, set these server-side variables on the Hasib AI Agent Render service:

- `PUBLIC_URL_FETCH_PROXY_URL=https://<proxy-service-host>/fetch`
- `PUBLIC_URL_FETCH_PROXY_TOKEN=<same secret>`

Do not put the token in Vite/browser variables, the APK, source code, logs, or public documentation. The Task Runner intentionally fails closed if either variable is missing. Do not enable URL analysis until the proxy is deployed, its health endpoint is reachable, authenticated requests work, and the DNS-pinning tests pass.

## Local verification

Run `go test ./...` and `go vet ./...` from this directory.
