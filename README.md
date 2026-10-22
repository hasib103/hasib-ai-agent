# Hasib AI Agent

A mobile-first, authenticated control panel for a personal AI assistant. The current release is a guarded MVP: it can generate plans, grounded web answers, and a bounded remote browser task; it is not an unrestricted autonomous agent.

## Remote Browser

The `/browser` page adds a server-side Browserless-powered browser session for public HTTP/HTTPS pages. It supports opening a page, clicking a CSS selector, filling a text field, waiting, and returning visible text plus links. Each run is capped at six explicit actions and 25 seconds. The user must confirm before a run begins.

### Configure

Set `BROWSERLESS_API_TOKEN` as a server-only secret in the deployment platform. Get the token from the Browserless account dashboard. Never use a `VITE_*` variable and never paste the token into chat or the app UI. Browserless uses a paid/limited remote browser service; review its pricing and data handling before enabling it.

The current integration creates a fresh browser session for each task. It does **not** persist cookies or logged-in sessions. Do not enter passwords, OTPs, payment details, or other sensitive information. Persistent authenticated profiles and credential vault/OAuth integrations require a separate secure session-storage design and are intentionally not faked by this implementation.

### Security limits

- Requires an authenticated Hasib AI session and consumes the existing AI request quota.
- Validates the initial URL and blocks local/private address patterns; browser requests are intercepted to reject non-public/local destinations.
- The browser runner is fixed server-owned code; users cannot submit JavaScript for execution.
- Maximum six bounded actions; no shell, downloads, file uploads, or arbitrary script execution.
- Browser output is untrusted website content. Treat it as evidence, never as instructions.
- Clicking or filling forms can change external sites. Run only actions you understand and have permission to perform.
- Browserless processes page content remotely; do not use it with sensitive or regulated data unless your privacy requirements and provider terms permit it.

## Existing web-grounded chat

The chat uses Gemini Google Search grounding and URL Context when supported. Search grounding is not the same as a persistent, authenticated browser session.

## Development

Use Node.js 22 or newer.

    npm install
    npm run dev
    npm run build
    npm run test
    npm run lint

GitHub Actions uses Bun with the committed lockfile. Render is configured to build with npm install && npm run build and start with node .output/server/index.mjs. Confirm the current deployment state after merges before describing a commit as live.

## Security reporting

See SECURITY.md. Never commit secret values.
