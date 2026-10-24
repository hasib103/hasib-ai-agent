import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Provider = "facebook" | "instagram" | "youtube" | "tiktok" | "linkedin" | "x" | "pinterest" | "threads" | "whatsapp";
const PROVIDERS: Provider[] = ["facebook", "instagram", "youtube", "tiktok", "linkedin", "x", "pinterest", "threads", "whatsapp"];
const env = (key: string) => Deno.env.get(key) ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "https://hasib-ai-agent.onrender.com", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" } });
const redirect = (url: string) => Response.redirect(url, 302);
const supabaseUrl = env("SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const appUrl = () => (env("APP_URL") || "https://hasib-ai-agent.onrender.com").replace(/\/$/, "");
const callbackUrl = (provider: Provider) => supabaseUrl + "/functions/v1/social-automation?action=oauth_callback&provider=" + provider;
const allowedOrigins = new Set([appUrl(), "https://hasib-ai-agent-test.onrender.com", "http://localhost:3000", "http://localhost:5173"]);
const cors = (req: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(req.headers.get("origin") || "") ? (req.headers.get("origin") || appUrl()) : appUrl(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join(""); }
function base64(bytes: Uint8Array) { let s = ""; bytes.forEach((b) => s += String.fromCharCode(b)); return btoa(s); }
function fromBase64(s: string) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
let cachedEncryptionKey: CryptoKey | null = null;
async function encryptionKey() {
  if (cachedEncryptionKey) return cachedEncryptionKey;
  let raw = env("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!raw) {
    const { data, error } = await admin.rpc("get_social_token_encryption_key");
    if (error || typeof data !== "string" || !data) throw new Error("Social token encryption key is unavailable in Supabase Vault.");
    raw = data;
  }
  const bytes = fromBase64(raw);
  if (bytes.length !== 32) throw new Error("Social token encryption key must be a base64-encoded 32-byte key.");
  cachedEncryptionKey = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  return cachedEncryptionKey;
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return { ciphertext: base64(new Uint8Array(cipher)), iv: base64(iv) };
}
async function decrypt(ciphertext: string, iv: string) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await encryptionKey(), fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
function credentials(provider: Provider) {
  const prefix = ["facebook", "instagram", "whatsapp"].includes(provider) ? "META" : provider === "youtube" ? "GOOGLE" : provider.toUpperCase();
  const clientId = env("SOCIAL_" + prefix + "_CLIENT_ID") || env("SOCIAL_" + provider.toUpperCase() + "_CLIENT_ID");
  const clientSecret = env("SOCIAL_" + prefix + "_CLIENT_SECRET") || env("SOCIAL_" + provider.toUpperCase() + "_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Provider is not configured yet. Add SOCIAL_" + prefix + "_CLIENT_ID and SOCIAL_" + prefix + "_CLIENT_SECRET in Supabase Edge Function secrets.");
  return { clientId, clientSecret };
}
function oauthConfig(provider: Provider, state: string, challenge?: string) {
  const { clientId } = credentials(provider);
  const redirectUri = callbackUrl(provider);
  const scopes: Record<Provider, string[]> = {
    facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights"],
    instagram: ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
    youtube: ["openid", "profile", "email", "https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    tiktok: ["user.info.basic", "video.list", "video.publish", "video.upload"],
    linkedin: ["openid", "profile", "w_member_social"],
    x: ["users.read", "tweet.read", "tweet.write", "offline.access"],
    pinterest: ["user_accounts:read", "boards:read", "pins:read", "pins:write"],
    threads: ["threads_basic", "threads_content_publish", "threads_manage_insights"],
    whatsapp: ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"],
  };
  let endpoint = "";
  const params = new URLSearchParams();
  if (provider === "facebook" || provider === "instagram" || provider === "whatsapp") {
    endpoint = "https://www.facebook.com/v22.0/dialog/oauth";
    params.set("client_id", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(",")); params.set("state", state);
  } else if (provider === "youtube") {
    endpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    params.set("client_id", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(" ")); params.set("access_type", "offline"); params.set("prompt", "consent"); params.set("include_granted_scopes", "true"); params.set("state", state);
  } else if (provider === "linkedin") {
    endpoint = "https://www.linkedin.com/oauth/v2/authorization";
    params.set("client_id", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(" ")); params.set("state", state);
  } else if (provider === "x") {
    endpoint = "https://twitter.com/i/oauth2/authorize";
    params.set("client_id", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(" ")); params.set("state", state); params.set("code_challenge", challenge || ""); params.set("code_challenge_method", "S256");
  } else if (provider === "pinterest") {
    endpoint = "https://www.pinterest.com/oauth/";
    params.set("client_id", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(",")); params.set("state", state);
  } else if (provider === "tiktok") {
    endpoint = "https://www.tiktok.com/v2/auth/authorize/";
    params.set("client_key", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(",")); params.set("state", state);
  } else {
    endpoint = "https://threads.net/oauth/authorize";
    params.set("client_id", clientId); params.set("redirect_uri", redirectUri); params.set("response_type", "code");
    params.set("scope", scopes[provider].join(",")); params.set("state", state);
  }
  return endpoint + "?" + params.toString();
}
async function exchangeCode(provider: Provider, code: string, verifier?: string) {
  const { clientId, clientSecret } = credentials(provider);
  const redirectUri = callbackUrl(provider);
  let url = ""; let body = new URLSearchParams(); const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (provider === "facebook" || provider === "instagram" || provider === "whatsapp") {
    url = "https://graph.facebook.com/v22.0/oauth/access_token";
    body.set("client_id", clientId); body.set("client_secret", clientSecret); body.set("redirect_uri", redirectUri); body.set("code", code);
  } else if (provider === "youtube") {
    url = "https://oauth2.googleapis.com/token";
    body.set("client_id", clientId); body.set("client_secret", clientSecret); body.set("redirect_uri", redirectUri); body.set("grant_type", "authorization_code"); body.set("code", code);
  } else if (provider === "linkedin") {
    url = "https://www.linkedin.com/oauth/v2/accessToken";
    body.set("client_id", clientId); body.set("client_secret", clientSecret); body.set("redirect_uri", redirectUri); body.set("grant_type", "authorization_code"); body.set("code", code);
  } else if (provider === "x") {
    url = "https://api.twitter.com/2/oauth2/token";
    headers.Authorization = "Basic " + btoa(clientId + ":" + clientSecret);
    body.set("client_id", clientId); body.set("redirect_uri", redirectUri); body.set("grant_type", "authorization_code"); body.set("code", code); body.set("code_verifier", verifier || "");
  } else if (provider === "pinterest") {
    url = "https://api.pinterest.com/v5/oauth/token";
    headers.Authorization = "Basic " + btoa(clientId + ":" + clientSecret);
    body.set("grant_type", "authorization_code"); body.set("code", code); body.set("redirect_uri", redirectUri);
  } else if (provider === "tiktok") {
    url = "https://open.tiktokapis.com/v2/oauth/token/";
    body.set("client_key", clientId); body.set("client_secret", clientSecret); body.set("redirect_uri", redirectUri); body.set("grant_type", "authorization_code"); body.set("code", code);
  } else {
    url = "https://graph.threads.net/oauth/access_token";
    body.set("client_id", clientId); body.set("client_secret", clientSecret); body.set("redirect_uri", redirectUri); body.set("grant_type", "authorization_code"); body.set("code", code);
  }
  const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("OAuth token exchange failed for " + provider + " (HTTP " + response.status + "). Check provider app settings and redirect URI.");
  const token = data.data?.access_token || data.access_token;
  if (!token) throw new Error("Provider did not return an access token.");
  return { accessToken: String(token), refreshToken: data.data?.refresh_token || data.refresh_token || null, expiresIn: Number(data.data?.expires_in || data.expires_in || 3600), scopes: String(data.data?.scope || data.scope || "").split(/[ ,]+/).filter(Boolean) };
}
async function providerAccounts(provider: Provider, accessToken: string) {
  const h = { Authorization: "Bearer " + accessToken };
  if (provider === "facebook" || provider === "instagram" || provider === "whatsapp") {
    const r = await fetch("https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100", { headers: h });
    const d = await r.json(); if (!r.ok) throw new Error("Meta account discovery failed.");
    const out: Array<{ id: string; name: string; token: string; platform: Provider; metadata: Record<string, unknown> }> = [];
    for (const p of d.data || []) {
      if (provider !== "instagram" && provider !== "whatsapp" && p.id && p.access_token) out.push({ id: String(p.id), name: String(p.name || "Facebook Page"), token: String(p.access_token), platform: "facebook", metadata: { page_id: String(p.id) } });
      if (provider !== "facebook" && p.instagram_business_account?.id && p.access_token) out.push({ id: String(p.instagram_business_account.id), name: String(p.instagram_business_account.username || "Instagram account"), token: String(p.access_token), platform: "instagram", metadata: { instagram_user_id: String(p.instagram_business_account.id), page_id: String(p.id) } });
    }
    if (!out.length) {
      const requirement = provider === "instagram"
        ? "No linked Instagram professional account was found. Link an Instagram Business/Creator account to a Facebook Page and retry."
        : provider === "whatsapp"
          ? "Meta OAuth succeeded, but WhatsApp Business requires selecting a Business Account and phone number ID. No WhatsApp connection was saved."
          : "No Facebook Page you manage was returned by Meta. A personal profile cannot be used as a Page publishing connection.";
      throw new Error(requirement);
    }
    if (provider === "whatsapp") throw new Error("WhatsApp Business requires a separate WABA and phone-number selection flow. No WhatsApp connection was saved.");
    return out;
  }
  if (provider === "youtube") {
    const d = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: h }).then((r) => r.json());
    if (d.error) throw new Error("YouTube channel lookup failed.");
    return (d.items || []).map((x: any) => ({ id: String(x.id), name: String(x.snippet?.title || "YouTube channel"), token: accessToken, platform: "youtube" as Provider, metadata: { channel_id: String(x.id) } }));
  }
  if (provider === "linkedin") {
    const d = await fetch("https://api.linkedin.com/v2/userinfo", { headers: h }).then((r) => r.json());
    if (!d.sub) throw new Error("LinkedIn profile lookup failed; ensure the OpenID Connect product is enabled.");
    return [{ id: String(d.sub), name: String(d.name || d.email || "LinkedIn profile"), token: accessToken, platform: "linkedin" as Provider, metadata: { author_urn: "urn:li:person:" + d.sub } }];
  }
  if (provider === "x") {
    const d = await fetch("https://api.twitter.com/2/users/me?user.fields=name,username", { headers: h }).then((r) => r.json());
    if (!d.data?.id) throw new Error("X profile lookup failed.");
    return [{ id: String(d.data.id), name: "@" + String(d.data.username || d.data.name), token: accessToken, platform: "x" as Provider, metadata: { username: d.data.username } }];
  }
  if (provider === "tiktok") {
    const d = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { headers: h }).then((r) => r.json());
    if (!d.data?.user?.open_id) throw new Error("TikTok profile lookup failed.");
    return [{ id: String(d.data.user.open_id), name: String(d.data.user.display_name || "TikTok account"), token: accessToken, platform: "tiktok" as Provider, metadata: {} }];
  }
  if (provider === "pinterest") {
    const d = await fetch("https://api.pinterest.com/v5/user_account", { headers: h }).then((r) => r.json());
    if (!d.username) throw new Error("Pinterest profile lookup failed.");
    const boards = await fetch("https://api.pinterest.com/v5/boards?page_size=25", { headers: h }).then((r) => r.json()).catch(() => ({}));
    const firstBoard = (boards.items || [])[0];
    return [{ id: String(d.username), name: String(d.username), token: accessToken, platform: "pinterest" as Provider, metadata: firstBoard?.id ? { default_board_id: String(firstBoard.id), default_board_name: String(firstBoard.name || "") } : {} }];
  }
  if (provider === "threads") {
    const d = await fetch("https://graph.threads.net/v1.0/me?fields=id,username", { headers: h }).then((r) => r.json());
    if (!d.id) throw new Error("Threads profile lookup failed.");
    return [{ id: String(d.id), name: "@" + String(d.username || "Threads account"), token: accessToken, platform: "threads" as Provider, metadata: { username: d.username } }];
  }
  // WhatsApp uses Meta business assets; a WABA phone number must be selected before sending.
  const d = await fetch("https://graph.facebook.com/v22.0/me?fields=id,name", { headers: h }).then((r) => r.json());
  return [{ id: String(d.id || "meta-business"), name: String(d.name || "WhatsApp Business"), token: accessToken, platform: "whatsapp" as Provider, metadata: { setup_required: "Select a WhatsApp Business Account and phone number ID before messaging." } }];
}
async function storeConnection(userId: string, account: { id: string; name: string; token: string; platform: Provider; metadata: Record<string, unknown> }, tokenData: { refreshToken: string | null; expiresIn: number; scopes: string[] }) {
  const enc = await encrypt(account.token);
  const refresh = tokenData.refreshToken ? await encrypt(tokenData.refreshToken) : null;
  const row = {
    user_id: userId, provider: account.platform, external_account_id: account.id, account_name: account.name,
    token_ciphertext: enc.ciphertext, token_iv: enc.iv,
    refresh_ciphertext: refresh?.ciphertext ?? null, refresh_iv: refresh?.iv ?? null,
    token_expires_at: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
    scopes: tokenData.scopes, metadata: account.metadata, status: "connected", updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("social_connections").upsert(row, { onConflict: "user_id,provider,external_account_id" });
  if (error) throw new Error("Could not safely save the social connection.");
}
async function authenticate(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Sign in before managing social accounts.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session expired. Sign in again.");
  return data.user;
}
async function readLimitedBody(response: Response, limitBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("Media source returned an empty body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limitBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Media is over the 50 MB upload safety limit for this workflow.");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return combined;
}
function safePublicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (u.protocol !== "https:" || u.username || u.password || !h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false;
    return true;
  } catch { return false; }
}
async function getValidAccessToken(conn: any): Promise<string> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (!expiresAt || expiresAt > Date.now() + 5 * 60_000) return decrypt(conn.token_ciphertext, conn.token_iv);
  const currentToken = await decrypt(conn.token_ciphertext, conn.token_iv);
  let refreshed: { access_token?: string; refresh_token?: string; expires_in?: number; data?: { access_token?: string; refresh_token?: string; expires_in?: number } } | null = null;
  if (conn.provider === "threads") {
    const r = await fetch("https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=" + encodeURIComponent(currentToken));
    refreshed = await r.json().catch(() => null);
    if (!r.ok) refreshed = null;
  } else if (conn.refresh_ciphertext && conn.refresh_iv && ["youtube","x","linkedin","pinterest","tiktok"].includes(conn.provider)) {
    const refreshToken = await decrypt(conn.refresh_ciphertext, conn.refresh_iv);
    const provider = conn.provider as Provider;
    const { clientId, clientSecret } = credentials(provider);
    const body = new URLSearchParams();
    const headers: Record<string,string> = { "Content-Type": "application/x-www-form-urlencoded" };
    let url = "";
    if (provider === "youtube") {
      url = "https://oauth2.googleapis.com/token";
      body.set("client_id", clientId); body.set("client_secret", clientSecret); body.set("refresh_token", refreshToken); body.set("grant_type", "refresh_token");
    } else if (provider === "x") {
      url = "https://api.twitter.com/2/oauth2/token"; headers.Authorization = "Basic " + btoa(clientId + ":" + clientSecret);
      body.set("client_id", clientId); body.set("refresh_token", refreshToken); body.set("grant_type", "refresh_token");
    } else if (provider === "linkedin") {
      url = "https://www.linkedin.com/oauth/v2/accessToken";
      body.set("client_id", clientId); body.set("client_secret", clientSecret); body.set("refresh_token", refreshToken); body.set("grant_type", "refresh_token");
    } else if (provider === "pinterest") {
      url = "https://api.pinterest.com/v5/oauth/token"; headers.Authorization = "Basic " + btoa(clientId + ":" + clientSecret);
      body.set("grant_type", "refresh_token"); body.set("refresh_token", refreshToken);
    } else {
      url = "https://open.tiktokapis.com/v2/oauth/token/";
      body.set("client_key", clientId); body.set("client_secret", clientSecret); body.set("refresh_token", refreshToken); body.set("grant_type", "refresh_token");
    }
    const r = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(12000) });
    refreshed = await r.json().catch(() => null);
    if (!r.ok) refreshed = null;
  }
  const nextToken = refreshed?.data?.access_token || refreshed?.access_token;
  if (!nextToken) {
    await admin.from("social_connections").update({ status: "needs_reauth", updated_at: new Date().toISOString() }).eq("id", conn.id).eq("user_id", conn.user_id);
    throw new Error("This social account needs to be reconnected because its access token expired.");
  }
  const nextRefresh = refreshed?.data?.refresh_token || refreshed?.refresh_token;
  const encrypted = await encrypt(String(nextToken));
  const refreshEncrypted = nextRefresh ? await encrypt(String(nextRefresh)) : null;
  await admin.from("social_connections").update({
    token_ciphertext: encrypted.ciphertext, token_iv: encrypted.iv,
    refresh_ciphertext: refreshEncrypted?.ciphertext ?? conn.refresh_ciphertext,
    refresh_iv: refreshEncrypted?.iv ?? conn.refresh_iv,
    token_expires_at: new Date(Date.now() + Number(refreshed?.data?.expires_in || refreshed?.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conn.id).eq("user_id", conn.user_id);
  return String(nextToken);
}
async function publishJob(userId: string, jobId: string) {
  const { data: job, error: jobError } = await admin.from("social_publish_jobs").select("*").eq("id", jobId).eq("user_id", userId).single();
  if (jobError || !job) throw new Error("Publish job not found.");
  if (job.status !== "approved" && job.status !== "scheduled") throw new Error("This post needs explicit approval before publishing.");
  if (job.scheduled_at && new Date(job.scheduled_at).getTime() > Date.now()) throw new Error("This post is scheduled for a future time.");
  const { data: conn, error: connError } = await admin.from("social_connections").select("*").eq("id", job.connection_id).eq("user_id", userId).eq("status", "connected").single();
  if (connError || !conn) throw new Error("Connected account not found. Reconnect it and try again.");
  await admin.from("social_publish_jobs").update({ status: "publishing", attempts: job.attempts + 1, updated_at: new Date().toISOString(), last_error: null }).eq("id", jobId).eq("user_id", userId);
  const token = await getValidAccessToken(conn);
  const content = job.content || {};
  let postId = ""; let postUrl = "";
  try {
    if (conn.provider === "facebook") {
      if (!content.text) throw new Error("Facebook post text is required.");
      const d = await fetch("https://graph.facebook.com/v22.0/" + encodeURIComponent(conn.external_account_id) + "/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content.text, access_token: token }) }).then((r) => r.json());
      if (!d.id) throw new Error("Facebook rejected the post. Check Page permissions and app review.");
      postId = String(d.id); postUrl = "https://facebook.com/" + postId.replace("_", "/posts/");
    } else if (conn.provider === "linkedin") {
      if (!content.text) throw new Error("LinkedIn post text is required.");
      const author = String(conn.metadata?.author_urn || "urn:li:person:" + conn.external_account_id);
      const d = await fetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "LinkedIn-Version": env("LINKEDIN_API_VERSION") || "202601", "X-Restli-Protocol-Version": "2.0.0" }, body: JSON.stringify({ author, commentary: content.text, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshare: false }) });
      if (!d.ok) throw new Error("LinkedIn rejected the post (HTTP " + d.status + "). Check w_member_social approval.");
      postId = d.headers.get("x-restli-id") || "published";
    } else if (conn.provider === "x") {
      if (!content.text) throw new Error("X post text is required.");
      const d = await fetch("https://api.twitter.com/2/tweets", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ text: content.text }) }).then((r) => r.json());
      if (!d.data?.id) throw new Error("X rejected the post. Check write scope and API plan.");
      postId = String(d.data.id); postUrl = "https://x.com/" + String(conn.metadata?.username || "i") + "/status/" + postId;
    } else if (conn.provider === "threads") {
      if (!content.text) throw new Error("Threads post text is required.");
      const params = new URLSearchParams({ media_type: "TEXT", text: content.text, access_token: token });
      const c = await fetch("https://graph.threads.net/v1.0/" + encodeURIComponent(conn.external_account_id) + "/threads", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params }).then((r) => r.json());
      if (!c.id) throw new Error("Threads rejected the post container.");
      const p = await fetch("https://graph.threads.net/v1.0/" + encodeURIComponent(conn.external_account_id) + "/threads_publish", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: String(c.id), access_token: token }) }).then((r) => r.json());
      if (!p.id) throw new Error("Threads could not publish the post.");
      postId = String(p.id); postUrl = "https://www.threads.net/@"+String(conn.metadata?.username || "user")+"/post/"+postId;
    } else if (conn.provider === "instagram") {
      if (!content.media_url || !safePublicHttpsUrl(String(content.media_url))) throw new Error("Instagram requires a public HTTPS media_url; a text-only post is not supported.");
      const params = new URLSearchParams({ caption: String(content.text || ""), access_token: token });
      if (job.content_type === "video") { params.set("media_type", "REELS"); params.set("video_url", String(content.media_url)); }
      else params.set("image_url", String(content.media_url));
      const c = await fetch("https://graph.facebook.com/v22.0/" + encodeURIComponent(conn.external_account_id) + "/media", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params }).then((r) => r.json());
      if (!c.id) throw new Error("Instagram could not create a media container.");
      const p = await fetch("https://graph.facebook.com/v22.0/" + encodeURIComponent(conn.external_account_id) + "/media_publish", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: String(c.id), access_token: token }) }).then((r) => r.json());
      if (!p.id) throw new Error("Instagram could not publish the media.");
      postId = String(p.id);
    } else if (conn.provider === "youtube") {
      if (job.content_type !== "video" || !content.media_url || !safePublicHttpsUrl(String(content.media_url))) throw new Error("YouTube publishing requires a public HTTPS video URL and video content type.");
      const source = await fetch(String(content.media_url), { redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!source.ok) throw new Error("YouTube could not fetch the video source URL.");
      const length = Number(source.headers.get("content-length") || 0);
      if (length > 50 * 1024 * 1024) throw new Error("Video is over the 50 MB upload safety limit for this workflow.");
      const media = await readLimitedBody(source, 50 * 1024 * 1024);
      const boundary = "hasib_social_" + crypto.randomUUID().replaceAll("-", "");
      const metadata = { snippet: { title: String(content.title || content.text || "Hasib AI Agent video").slice(0, 100), description: String(content.text || "").slice(0, 5000) }, status: { privacyStatus: content.privacy_status === "public" ? "public" : "private" } };
      const body = new Blob(["--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n", JSON.stringify(metadata), "\r\n--" + boundary + "\r\nContent-Type: video/*\r\n\r\n", media, "\r\n--" + boundary + "--"]);
      const response = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "multipart/related; boundary=" + boundary }, body, signal: AbortSignal.timeout(90000) });
      const d = await response.json().catch(() => ({}));
      if (!response.ok || !d.id) throw new Error("YouTube upload failed (HTTP " + response.status + "). Check channel permissions and API quota.");
      postId = String(d.id); postUrl = "https://www.youtube.com/watch?v=" + postId;
    } else if (conn.provider === "tiktok") {
      if (job.content_type !== "video" || !content.media_url || !safePublicHttpsUrl(String(content.media_url))) throw new Error("TikTok publishing requires video content with a public HTTPS URL on a verified domain.");
      const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ post_info: { title: String(content.text || "").slice(0, 150), privacy_level: String(content.privacy_level || "SELF_ONLY"), disable_duet: false, disable_comment: false, disable_stitch: false }, source_info: { source: "PULL_FROM_URL", video_url: String(content.media_url) } }) });
      const initData = await init.json().catch(() => ({}));
      const publishId = initData.data?.publish_id;
      if (!init.ok || !publishId) throw new Error("TikTok rejected video publishing. Verify domain ownership, privacy options and app approval.");
      let complete: any = null;
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const statusResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ publish_id: publishId }) });
        complete = await statusResponse.json().catch(() => ({}));
        const status = complete.data?.status;
        if (status === "PUBLISH_COMPLETE") break;
        if (status === "FAILED") throw new Error("TikTok could not publish the video. Check the creator account and video policy.");
      }
      if (complete?.data?.status !== "PUBLISH_COMPLETE") throw new Error("TikTok accepted the publish request but processing is still pending. Retry status check later; publish ID: " + String(publishId));
      postId = String(complete.data?.publicaly_available_post_id?.[0] || publishId);
    } else if (conn.provider === "pinterest") {
      if (job.content_type !== "image" || !content.media_url || !safePublicHttpsUrl(String(content.media_url))) throw new Error("Pinterest pins require image content with a public HTTPS image URL.");
      const boardId = String(conn.metadata?.default_board_id || "");
      if (!boardId) throw new Error("No Pinterest board was found. Create a board and reconnect Pinterest.");
      const d = await fetch("https://api.pinterest.com/v5/pins", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ board_id: boardId, title: String(content.title || content.text || "New Pin").slice(0, 100), description: String(content.text || "").slice(0, 800), media_source: { source_type: "image_url", url: String(content.media_url) } }) }).then((r) => r.json());
      if (!d.id) throw new Error("Pinterest rejected the Pin. Check board permissions and pins:write scope.");
      postId = String(d.id); postUrl = d.link || "";
    } else {
      throw new Error("Publishing is not enabled for " + conn.provider + ". The provider requires a separate account or content workflow.");
    }
    await admin.from("social_publish_jobs").update({ status: "published", published_at: new Date().toISOString(), provider_post_id: postId, provider_post_url: postUrl || null, updated_at: new Date().toISOString(), last_error: null }).eq("id", jobId).eq("user_id", userId);
    return { id: jobId, status: "published", provider: conn.provider, provider_post_id: postId, provider_post_url: postUrl || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publishing failed.";
    await admin.from("social_publish_jobs").update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);
    throw error;
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const provider = url.searchParams.get("provider") as Provider;
  try {
    if (action === "oauth_callback") {
      const error = url.searchParams.get("error");
      if (error) return redirect(appUrl() + "/social-automation?error=" + encodeURIComponent(url.searchParams.get("error_description") || error));
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      if (!code || !state || !PROVIDERS.includes(provider)) return redirect(appUrl() + "/social-automation?error=invalid_oauth_response");
      const stateHash = await sha256(state);
      const { data: oauthState } = await admin.from("social_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state_hash", stateHash).eq("provider", provider).is("consumed_at", null).gt("expires_at", new Date().toISOString()).select("*").maybeSingle();
      if (!oauthState) return redirect(appUrl() + "/social-automation?error=expired_oauth_state");
      const tokenData = await exchangeCode(provider, code, oauthState.code_verifier || undefined);
      if (["facebook", "instagram", "whatsapp"].includes(provider)) {
        const { clientId, clientSecret } = credentials(provider);
        const longUrl = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
        longUrl.searchParams.set("grant_type", "fb_exchange_token"); longUrl.searchParams.set("client_id", clientId);
        longUrl.searchParams.set("client_secret", clientSecret); longUrl.searchParams.set("fb_exchange_token", tokenData.accessToken);
        const longResponse = await fetch(longUrl);
        const longData = await longResponse.json().catch(() => ({}));
        if (longResponse.ok && longData.access_token) { tokenData.accessToken = String(longData.access_token); tokenData.expiresIn = Number(longData.expires_in || 5184000); }
      } else if (provider === "threads") {
        const { clientSecret } = credentials(provider);
        const longUrl = new URL("https://graph.threads.net/access_token");
        longUrl.searchParams.set("grant_type", "th_exchange_token"); longUrl.searchParams.set("client_secret", clientSecret); longUrl.searchParams.set("access_token", tokenData.accessToken);
        const longResponse = await fetch(longUrl);
        const longData = await longResponse.json().catch(() => ({}));
        if (longResponse.ok && longData.access_token) { tokenData.accessToken = String(longData.access_token); tokenData.expiresIn = Number(longData.expires_in || 5184000); }
      }
      const accounts = await providerAccounts(provider, tokenData.accessToken);
      for (const account of accounts) await storeConnection(oauthState.user_id, account, tokenData);
      return redirect(appUrl() + "/social-automation?connected=" + encodeURIComponent(provider) + "&count=" + accounts.length);
    }
    if (action === "run_due_jobs") {
      const schedulerSecret = req.headers.get("x-social-scheduler-secret") || "";
      const { data: schedulerAuthorized, error: schedulerAuthError } = await admin.rpc("verify_social_scheduler_secret", { p_candidate: schedulerSecret });
      if (schedulerAuthError || schedulerAuthorized !== true) return json({ error: "Unauthorized scheduler." }, 401);
      const { data: jobs, error } = await admin.from("social_publish_jobs").select("id,user_id").eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).limit(25);
      if (error) throw new Error("Could not read scheduled jobs.");
      const results = [];
      for (const job of jobs || []) {
        try { results.push(await publishJob(job.user_id, job.id)); }
        catch (e) { results.push({ id: job.id, status: "failed", error: e instanceof Error ? e.message : "Failed" }); }
      }
      return json({ processed: results.length, results });
    }
    const user = await authenticate(req);
    if (req.method !== "POST") return json({ error: "Use POST for this action." }, 405);
    const body = await req.json().catch(() => ({}));
    if (action === "connect") {
      if (!PROVIDERS.includes(body.provider)) return json({ error: "Unsupported provider." }, 400);
      const p = body.provider as Provider;
      const state = base64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c] || "");
      const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
      const verifier = base64(verifierBytes).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c] || "");
      const challenge = base64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c] || "");
      const { error } = await admin.from("social_oauth_states").insert({ state_hash: await sha256(state), user_id: user.id, provider: p, code_verifier: p === "x" ? verifier : null, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      if (error) throw new Error("Could not start a secure OAuth session.");
      return json({ authorization_url: oauthConfig(p, state, challenge), provider: p });
    }
    if (action === "accounts") {
      const { data, error } = await admin.from("social_connections").select("id,provider,external_account_id,account_name,token_expires_at,scopes,metadata,status,created_at").eq("user_id", user.id).eq("status", "connected").order("created_at", { ascending: false });
      if (error) throw new Error("Could not load connected accounts.");
      return json({ accounts: data || [] });
    }
    if (action === "disconnect") {
      const id = String(body.connection_id || "");
      const { error } = await admin.from("social_connections").update({ status: "disconnected", token_ciphertext: "", token_iv: "", refresh_ciphertext: null, refresh_iv: null, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
      if (error) throw new Error("Could not disconnect the account.");
      return json({ disconnected: true });
    }
    if (action === "create_job") {
      const connectionId = String(body.connection_id || "");
      const contentType = String(body.content_type || "text");
      if (!["text","image","video","link"].includes(contentType)) return json({ error: "Invalid content type." }, 400);
      const { data: connection } = await admin.from("social_connections").select("id").eq("id", connectionId).eq("user_id", user.id).eq("status", "connected").maybeSingle();
      if (!connection) return json({ error: "Connected account not found." }, 404);
      const text = typeof body.content?.text === "string" ? body.content.text.trim() : "";
      const mediaUrl = typeof body.content?.media_url === "string" ? body.content.media_url.trim() : "";
      if (!text && !mediaUrl) return json({ error: "Add post text or a media URL." }, 400);
      if (mediaUrl && !safePublicHttpsUrl(mediaUrl)) return json({ error: "Media URLs must use a public HTTPS address." }, 400);
      const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
      if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000)) return json({ error: "Choose a schedule at least one minute in the future." }, 400);
      const status = body.request_approval === true ? "pending_approval" : "draft";
      const { data, error } = await admin.from("social_publish_jobs").insert({ user_id: user.id, connection_id: connectionId, content_type: contentType, content: { text, media_url: mediaUrl || undefined }, scheduled_at: scheduledAt?.toISOString() || null, status }).select("id,connection_id,content_type,content,scheduled_at,status,created_at").single();
      if (error) throw new Error("Could not save the post draft.");
      return json({ job: data }, 201);
    }
    if (action === "jobs") {
      const { data, error } = await admin.from("social_publish_jobs").select("id,connection_id,content_type,content,scheduled_at,status,approved_at,published_at,provider_post_id,provider_post_url,last_error,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error("Could not load publish jobs.");
      return json({ jobs: data || [] });
    }
    if (action === "approve_job") {
      const id = String(body.job_id || "");
      const { data: job, error } = await admin.from("social_publish_jobs").select("id,scheduled_at,status").eq("id", id).eq("user_id", user.id).single();
      if (error || !job || !["draft","pending_approval"].includes(job.status)) return json({ error: "Only your draft posts can be approved." }, 409);
      const future = job.scheduled_at && new Date(job.scheduled_at).getTime() > Date.now();
      const nextStatus = future ? "scheduled" : "approved";
      const { error: updateError } = await admin.from("social_publish_jobs").update({ status: nextStatus, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
      if (updateError) throw new Error("Could not approve the post.");
      return json({ id, status: nextStatus, approved_at: new Date().toISOString() });
    }
    if (action === "publish_job") {
      const id = String(body.job_id || "");
      return json(await publishJob(user.id, id));
    }
    if (action === "metrics") {
      const id = String(body.connection_id || "");
      const { data: conn } = await admin.from("social_connections").select("*").eq("id", id).eq("user_id", user.id).eq("status", "connected").single();
      if (!conn) return json({ error: "Connected account not found." }, 404);
      const token = await getValidAccessToken(conn);
      let metrics: Record<string, unknown> = {};
      if (conn.provider === "facebook") {
        const d = await fetch("https://graph.facebook.com/v22.0/" + encodeURIComponent(conn.external_account_id) + "/insights?metric=page_impressions,page_engaged_users&period=day&access_token=" + encodeURIComponent(token)).then((r) => r.json());
        if (d.error) throw new Error("Facebook insights unavailable; check page insights permission.");
        metrics = { source: "facebook_page_insights", data: d.data || [] };
      } else if (conn.provider === "instagram") {
        const d = await fetch("https://graph.facebook.com/v22.0/" + encodeURIComponent(conn.external_account_id) + "/insights?metric=reach,views,likes,comments&period=day&access_token=" + encodeURIComponent(token)).then((r) => r.json());
        if (d.error) throw new Error("Instagram insights unavailable; check account type and permissions.");
        metrics = { source: "instagram_insights", data: d.data || [] };
      } else if (conn.provider === "x") {
        const d = await fetch("https://api.twitter.com/2/users/" + encodeURIComponent(conn.external_account_id) + "/tweets?max_results=10&tweet.fields=public_metrics,created_at", { headers: { Authorization: "Bearer " + token } }).then((r) => r.json());
        if (d.errors) throw new Error("X metrics unavailable; check API plan and scopes.");
        metrics = { source: "x_recent_tweets", data: d.data || [] };
      } else if (conn.provider === "youtube") {
        const d = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=" + encodeURIComponent(conn.external_account_id), { headers: { Authorization: "Bearer " + token } }).then((r) => r.json());
        if (d.error) throw new Error("YouTube channel metrics unavailable.");
        metrics = { source: "youtube_channel_statistics", data: d.items || [] };
      } else if (conn.provider === "tiktok") {
        const d = await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,view_count,like_count,comment_count,share_count", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ max_count: 20 }) }).then((r) => r.json());
        if (d.error?.code && d.error.code !== "ok") throw new Error("TikTok metrics unavailable; check video.list scope and app review.");
        metrics = { source: "tiktok_recent_videos", data: d.data?.videos || [] };
      } else if (conn.provider === "pinterest") {
        const end = new Date(); const start = new Date(Date.now() - 29 * 86400000);
        const date = (d: Date) => d.toISOString().slice(0, 10);
        const query = new URLSearchParams({ start_date: date(start), end_date: date(end), metric_types: "IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK" });
        const r = await fetch("https://api.pinterest.com/v5/user_account/analytics?" + query.toString(), { headers: { Authorization: "Bearer " + token } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.code) throw new Error("Pinterest analytics unavailable; check account analytics permissions.");
        metrics = { source: "pinterest_account_analytics_30d", data: d };
      } else {
        throw new Error("Metrics API adapter is not yet enabled for " + conn.provider + ".");
      }
      await admin.from("social_post_metrics").insert({ user_id: user.id, connection_id: conn.id, provider_post_id: "account_snapshot", metrics });
      return json({ provider: conn.provider, captured_at: new Date().toISOString(), metrics });
    }
    return json({ error: "Unknown action." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected social automation error.";
    if (action === "oauth_callback") return redirect(appUrl() + "/social-automation?error=" + encodeURIComponent(message));
    return json({ error: message }, 400);
  }
});
