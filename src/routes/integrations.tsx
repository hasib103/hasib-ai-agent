import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Link2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrations · Hasib AI Agent" },
    { name: "description", content: "Live connection readiness for core services and social platforms." },
    { property: "og:title", content: "Integrations · Hasib AI Agent" },
    { property: "og:description", content: "Secure provider connection status and setup requirements." },
  ] }),
  component: Integrations,
});

const coreItems = [
  { id: "github", name: "GitHub", desc: "Repositories, issues, pull requests and code workflows.", setup: "A server-side GitHub App or fine-grained access token with least-privilege repository permissions. OAuth/API adapter is not yet connected in this app." },
  { id: "supabase", name: "Supabase", desc: "Authentication, private database, task history and Edge Functions.", setup: "The app checks the signed-in user's access to the tasks table. Service-role credentials remain server-side." },
  { id: "vercel", name: "Vercel", desc: "Deployments, previews and project operations.", setup: "A server-side Vercel API token and a scoped project adapter are required. Deployment actions must require confirmation." },
  { id: "render", name: "Render", desc: "Hasib AI hosting, services, deploys and background workers.", setup: "The app is hosted on Render, but this does not mean the Hasib AI user account has a Render API connection. A server-side Render API key and workspace selection are required." },
  { id: "gemini", name: "Google Gemini", desc: "Chat, voice, planning and AI-assisted analysis.", setup: "A server-side Gemini API key and a project/model quota with available capacity are required. The 429 fix is being verified after deployment." },
  { id: "inkbox", name: "Inkbox", desc: "Agent email, SMS and external communications.", setup: "A server-side Inkbox API credential and explicit approval rules for outbound communication are required. The app adapter is not yet connected." },
  { id: "runway", name: "Runway", desc: "AI video and media generation.", setup: "A server-side Runway API key and a bounded media-generation adapter are required. The app adapter is not yet connected." },
  { id: "browserless", name: "Browserless", desc: "Controlled remote browser automation for approved public-page workflows.", setup: "BROWSERLESS_API_TOKEN must be configured server-side. The browser runner must remain bounded and require user confirmation for external actions." },
  { id: "tinyfish", name: "TinyFish", desc: "Web research and guided browser automation.", setup: "A server-side TinyFish integration and scoped run controls are required. A ChatGPT-side browser profile does not automatically connect this app." },
  { id: "url-proxy", name: "URL Fetch Proxy", desc: "DNS-pinned, read-only public URL retrieval with SSRF protections.", setup: "The trusted egress proxy endpoint and secret are held server-side in Supabase Vault. It must never be exposed to the browser." },
] as const;

const socialItems = [
  { id: "facebook", name: "Facebook Pages", desc: "Page connection, text publishing and page insights." },
  { id: "instagram", name: "Instagram", desc: "Professional account connection, image/Reels publishing and insights." },
  { id: "youtube", name: "YouTube", desc: "Channel connection, video upload and channel statistics." },
  { id: "tiktok", name: "TikTok", desc: "Account connection, approved video publishing and video metrics." },
  { id: "linkedin", name: "LinkedIn", desc: "Member authorization and text publishing where the app has permission." },
  { id: "x", name: "X", desc: "Account authorization, text posts and available post metrics." },
  { id: "pinterest", name: "Pinterest", desc: "Account authorization, board access, Pin publishing and analytics." },
  { id: "threads", name: "Threads", desc: "Account authorization, text publishing and supported insights." },
  { id: "whatsapp", name: "WhatsApp Business", desc: "Business messaging; requires a WABA, phone number, opt-in and approved templates." },
] as const;

type SocialProviderId = typeof socialItems[number]["id"];
type SocialReadiness = { provider: SocialProviderId; configured: boolean; publishing_supported: boolean; names?: string[] };
type SocialAccount = { id: string; provider: SocialProviderId; account_name: string; status: string };
type CoreStatus = "checking" | "connected" | "needs_setup" | "not_verified";

function Integrations() {
  const [coreStatus, setCoreStatus] = useState<CoreStatus>("checking");
  const [socialReadiness, setSocialReadiness] = useState<SocialReadiness[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<typeof coreItems[number] | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) {
        setCoreStatus("not_verified");
        setSocialReadiness([]);
        setSocialAccounts([]);
        throw new Error("লাইভ সংযোগের অবস্থা দেখতে আগে Hasib AI-তে সাইন ইন করুন।");
      }

      const dbProbe = await supabase.from("tasks").select("id", { count: "exact", head: true });
      setCoreStatus(dbProbe.error ? "needs_setup" : "connected");

      const endpoint = (supabase.supabaseUrl || "https://qmdxpvimryxwezqmjbge.supabase.co") + "/functions/v1/social-automation";
      const request = async (action: "provider_status" | "accounts") => {
        const response = await fetch(endpoint + "?action=" + action, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
            apikey: supabase.supabaseKey,
          },
          body: "{}",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "সোশ্যাল সংযোগের অবস্থা পড়া যায়নি।");
        return payload;
      };
      const [statusData, accountData] = await Promise.all([request("provider_status"), request("accounts")]);
      setSocialReadiness(Array.isArray(statusData.providers) ? statusData.providers : []);
      setSocialAccounts(Array.isArray(accountData.accounts) ? accountData.accounts : []);
      setCheckedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "ইন্টিগ্রেশন অবস্থা পরীক্ষা করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connectedSocialCount = socialItems.filter((provider) =>
    socialAccounts.some((account) => account.provider === provider.id && account.status === "connected")
  ).length;

  const coreLabel = coreStatus === "connected"
    ? "Database verified"
    : coreStatus === "checking"
      ? "Checking"
      : coreStatus === "not_verified"
        ? "Sign in required"
        : "Connection check failed";

  const statusClass = (connected: boolean, ready: boolean) =>
    connected
      ? "bg-success/15 text-success"
      : ready
        ? "bg-primary/10 text-primary"
        : "bg-secondary text-muted-foreground";

  return (
    <>
      <PageHeader
        title="Integrations"
        sub="Core services and social channels are listed separately. A provider is shown as connected only after a live authenticated check or a stored account connection."
      />

      <div className="card-surface mb-4 flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Connection audit</p>
          <p className="text-xs text-muted-foreground mt-1">
            {coreLabel} · {connectedSocialCount}/{socialItems.length} social providers have at least one connected account.
            {checkedAt ? " Last checked " + new Date(checkedAt).toLocaleString() : ""}
          </p>
        </div>
        <button className="btn" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={"mr-1 inline h-4 w-4 " + (loading ? "animate-spin" : "")} />
          Refresh status
        </button>
      </div>

      {error && <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-destructive/40 p-3 text-sm"><CircleAlert className="h-5 w-5 shrink-0 text-destructive" />{error}</div>}

      <section className="mb-6">
        <div className="mb-3">
          <h2 className="font-semibold">Core services</h2>
          <p className="text-xs text-muted-foreground mt-1">Developer, AI, infrastructure and browser providers.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {coreItems.map((item) => {
            const connected = item.id === "supabase" && coreStatus === "connected";
            const status = item.id === "supabase"
              ? loading ? "Checking…" : connected ? "Connected" : "Not verified"
              : item.id === "url-proxy"
                ? "Server-side only"
                : item.id === "render"
                  ? "App hosted; API not linked"
                  : item.id === "gemini"
                    ? "Provider quota verification"
                    : "Setup required";
            return (
              <article key={item.id} className="card-surface flex flex-col p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <h3 className="min-w-0 flex-1 font-medium">{item.name}</h3>
                  <span className={"shrink-0 rounded-full px-2 py-1 text-[10px] " + statusClass(connected, false)}>{status}</span>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{item.desc}</p>
                <button className="btn btn-ghost mt-3 w-full" type="button" onClick={() => setSelected(item)}>View setup requirements</button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Social and messaging providers</h2>
            <p className="text-xs text-muted-foreground mt-1">OAuth readiness comes from the Social Automation backend; account status comes from saved, encrypted connections.</p>
          </div>
          <a className="btn btn-primary" href="/social-automation"><Link2 className="mr-1 inline h-4 w-4" />Manage social accounts</a>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {socialItems.map((provider) => {
            const readiness = socialReadiness.find((item) => item.provider === provider.id);
            const accounts = socialAccounts.filter((account) => account.provider === provider.id && account.status === "connected");
            const connected = accounts.length > 0;
            const status = loading
              ? "Checking…"
              : connected
                ? accounts.length + " connected"
                : readiness?.configured
                  ? "OAuth ready"
                  : readiness
                    ? "Developer app required"
                    : "Not verified";
            return (
              <article key={provider.id} className="card-surface flex flex-col p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <h3 className="min-w-0 flex-1 font-medium">{provider.name}</h3>
                  <span className={"shrink-0 rounded-full px-2 py-1 text-[10px] " + statusClass(connected, !!readiness?.configured)}>{status}</span>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{provider.desc}</p>
                {readiness && !readiness.publishing_supported && <p className="mt-2 text-xs text-warning">Publishing adapter is not enabled for this provider.</p>}
                <a className="btn btn-ghost mt-3 w-full" href="/social-automation">Configure and manage</a>
              </article>
            );
          })}
        </div>
      </section>

      <div className="card-surface p-3 sm:p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Credential safety</p>
        <p className="mt-1">Never paste API keys, OAuth client secrets, access tokens or passwords into this page or chat. Provider credentials belong in the approved server-side secret store. A configured OAuth app is not the same as a connected user account, and a connection does not imply that every publishing or analytics permission has been approved.</p>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="integration-dialog-title" className="card-surface w-full max-w-md space-y-3 p-5">
            <div className="flex items-start gap-3">
              <h2 id="integration-dialog-title" className="flex-1 text-lg font-semibold">{selected.name} setup</h2>
              <button type="button" className="btn btn-ghost !py-1" onClick={() => setSelected(null)} aria-label="Close setup details">Close</button>
            </div>
            <p className="text-sm text-muted-foreground">{selected.desc}</p>
            <p className="text-sm">{selected.setup}</p>
            {selected.id === "supabase" && coreStatus === "connected" && <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Authenticated database read check succeeded.</p>}
            {selected.id === "supabase" && coreStatus !== "connected" && <p className="text-sm text-destructive">The current session could not verify database access. Sign in again and refresh.</p>}
            {selected.id === "url-proxy" && <p className="text-xs text-muted-foreground">The proxy endpoint and token are intentionally never returned to the browser.</p>}
            <button type="button" className="btn btn-primary w-full" onClick={() => setSelected(null)}>Close</button>
          </section>
        </div>
      )}
    </>
  );
}
