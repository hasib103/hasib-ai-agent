# Social Automation — provider setup

The Social Automation page uses the Supabase Edge Function `social-automation`. It never accepts provider passwords or client secrets in the browser.

## Deploy prerequisites

1. Apply `supabase/migrations/20261024090000_social_media_automation.sql` to project `qmdxpvimryxwezqmjbge`. This creates owner-scoped publish jobs, encrypted-token storage, a private scheduler credential in Vault, and a one-minute Supabase Cron job.
2. Deploy `supabase/functions/social-automation/index.ts` with JWT verification disabled for the OAuth callback. The handler validates a one-time, expiring OAuth state for callbacks and validates the user's Supabase access token for user actions.
3. Add these Edge Function secrets in Supabase Dashboard → Edge Functions → Secrets:
   - The migration creates `social_token_encryption_key` in Supabase Vault automatically. The Edge Function reads it through a service-role-only database function. Do not rotate or delete it without re-encrypting all stored tokens first. An optional `SOCIAL_TOKEN_ENCRYPTION_KEY` Edge Function secret can override Vault for managed key rotation.
   - `APP_URL=https://hasib-ai-agent.onrender.com`
   - Add each provider's client ID and secret only when its developer app is ready:
     - Meta (Facebook Pages, Instagram, WhatsApp): `SOCIAL_META_CLIENT_ID`, `SOCIAL_META_CLIENT_SECRET`
     - YouTube / Google: `SOCIAL_GOOGLE_CLIENT_ID`, `SOCIAL_GOOGLE_CLIENT_SECRET`
     - LinkedIn: `SOCIAL_LINKEDIN_CLIENT_ID`, `SOCIAL_LINKEDIN_CLIENT_SECRET`
     - X: `SOCIAL_X_CLIENT_ID`, `SOCIAL_X_CLIENT_SECRET`
     - TikTok: `SOCIAL_TIKTOK_CLIENT_ID`, `SOCIAL_TIKTOK_CLIENT_SECRET`
     - Pinterest: `SOCIAL_PINTEREST_CLIENT_ID`, `SOCIAL_PINTEREST_CLIENT_SECRET`
     - Threads: `SOCIAL_THREADS_CLIENT_ID`, `SOCIAL_THREADS_CLIENT_SECRET`
4. In each provider's developer console, register the exact callback URL:
   `https://qmdxpvimryxwezqmjbge.supabase.co/functions/v1/social-automation?action=oauth_callback&provider=PROVIDER`
   Replace `PROVIDER` with the lowercase provider ID: `facebook`, `instagram`, `whatsapp`, `youtube`, `linkedin`, `x`, `tiktok`, `pinterest`, or `threads`.
5. Request only the scopes needed by the enabled workflow. App review, business verification, test-user access, domain verification, or an API plan may be required by the provider.

## Current supported operations

- OAuth connection and disconnect: Facebook Pages, Instagram professional accounts, YouTube channels, TikTok, LinkedIn members, X, Pinterest, Threads, and the Meta OAuth entry point for WhatsApp Business.
- Publishing adapters: Facebook Page text posts; Instagram image/Reels posts from public HTTPS media URLs; YouTube video upload from a public HTTPS media URL (50 MB safety cap, private by default); TikTok video publish from a verified public HTTPS URL; LinkedIn text posts; X text posts; Threads text posts; Pinterest image Pins to the first available board.
- Analytics adapters: Facebook Page insights, Instagram account insights, YouTube channel statistics, X recent post metrics, TikTok recent video metrics, Pinterest account analytics.
- Approved future posts are dispatched by Supabase Cron once per minute. Failed provider jobs retain an error for the owner to review.

## Provider-specific limitations

- Provider app approval and granted scopes determine what works. A successful OAuth redirect alone is not proof that publishing or analytics permissions were approved.
- Instagram publishing needs a professional account linked to a Facebook Page and a publicly accessible media URL.
- TikTok requires the media domain to be verified and the requested privacy setting to be permitted. Processing can take longer than the short synchronous poll window.
- Pinterest requires an existing board; the current adapter uses the first board returned by the API.
- WhatsApp Business is a messaging API, not a public post feed. A WABA, phone-number ID, opt-in recipient, and approved message template may be required; generic post publishing is intentionally not enabled.
- OAuth tokens are encrypted with AES-GCM before database storage. Never change the encryption key without a planned token re-encryption migration.
- Scheduled publishing requires the migration's `pg_cron` and `pg_net` extensions. The scheduler credential is stored in Supabase Vault, not in the client or a public table.
