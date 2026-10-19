# Security Policy — Hasib AI Agent

## Current security status

This project is a starter dashboard. The deployed dashboard has not yet been verified to have account authentication, enrolled-device authorization, or a connected server-side task runtime. Do not store personal, private, or sensitive data in it until those controls are implemented and tested.

## Secrets and API keys

- Store provider keys such as `GEMINI_API_KEY` only in the deployment platform's server-side environment/secret settings.
- Never use a `VITE_` prefix for private keys; Vite-prefixed values can be embedded in browser assets.
- Never commit `.env`, `.env.local`, access tokens, OAuth client secrets, Supabase service-role/secret keys, or private signing keys.
- The Supabase publishable key may be exposed to browsers by design; it is not authorization by itself. Enable and test Row Level Security (RLS) on every exposed table and restrict policies to authenticated, authorized users.
- If any real credential has ever been committed or shared publicly, revoke/rotate it at its provider. Deleting it from the latest file is not enough because Git history may retain it.

## API and data controls required before private use

1. Require authentication for every private dashboard and API operation.
2. Enforce authorization on the server for every record and action; never trust browser-only settings or a client-supplied user/device ID.
3. Apply rate limits and request-size/time limits to AI/API endpoints to reduce quota abuse.
4. Keep secrets server-side and use least-privilege credentials.
5. Enable database RLS, test policies for anonymous and cross-user access, and avoid storing secrets in browser local storage.
6. Log security-relevant events without logging API keys, access tokens, or sensitive payloads.
7. Test these controls before enabling task execution or storing sensitive information.

## Reporting

Do not post credentials or sensitive personal data in public issues. Revoke exposed credentials first, then report the affected path/commit privately to the repository owner.
