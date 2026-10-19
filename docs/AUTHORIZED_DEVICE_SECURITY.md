# Authorized Device Security — Implementation Plan

## Status

Planning checkpoint only. This document does **not** enable authentication or device enforcement. Do not treat the app as private or device-locked until implementation and tests are merged and deployed.

## Security objective

Allow private dashboard/API operations only after both:
1. The user authenticates with a supported identity provider.
2. The server verifies that the authenticated user is using an enrolled and approved device.

A browser-supplied device ID, localStorage flag, user-agent, IP address, or client-side route guard is not proof of device authorization.

## Required design

- Use Supabase Auth (or another verified server-side identity provider) for user identity.
- Enroll devices only after an authenticated user explicitly approves enrollment.
- Issue a cryptographically random device credential once; store only a one-way hash server-side. Keep the raw credential in OS-protected storage where the Android shell supports it; never store it in localStorage.
- On every private server endpoint, validate the session, device credential, enrollment status, owner relationship, and revocation status on the server.
- Keep service-role keys and signing secrets only in server-side environment variables. Never put them in VITE-prefixed variables or the APK.
- Add device list/revoke flow, rate limits, audit events without secrets, and safe failure behavior.
- Apply database RLS and ownership checks to all user/device records. A public publishable key alone must not grant access.
- Keep task execution disabled until these checks are enforced for every task-creation and task-execution endpoint.

## Minimum acceptance tests

1. Anonymous request to each private API is rejected.
2. Authenticated user with no enrolled device is rejected.
3. Valid session + approved device can access only that user's data.
4. Device A cannot access Device B's credential or records.
5. Revoked device is rejected on its next request.
6. Forged client-supplied user/device IDs do not change authorization.
7. Missing or invalid server secrets fail closed.
8. No raw device credential, session token, or secret appears in logs, browser storage, source, or build artifacts.
9. Production deployment and the Android APK are tested after the code is merged.

## Work sequence

1. Map all routes, server functions, and data access paths.
2. Implement authenticated device enrollment and revocation using persistent server-side storage.
3. Add a shared server authorization guard to every private route/action.
4. Add automated negative and cross-user tests.
5. Run secret scan, build, and tests; review diffs.
6. Merge and deploy only after the checks pass, then test the Android client.

## Current blocker

The available repository connector can read individual known files but did not return a repository tree, and code search returned no indexed results. The current source entry points/routes therefore still need to be mapped before adding enforcement safely. Avoid guessing route paths or claiming device security is enabled.
