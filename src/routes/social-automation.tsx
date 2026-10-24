import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, CheckCircle2, CircleAlert, ExternalLink, Link2, LoaderCircle, RefreshCw, Send, Unplug } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/social-automation")({
  head: () => ({ meta: [{ title: "Social Automation · Hasib AI Agent" }, { name: "description", content: "Connect social accounts using OAuth, approve and schedule posts, and review available analytics." }] }),
  component: SocialAutomation,
});

const endpoint = (supabase.supabaseUrl || "https://qmdxpvimryxwezqmjbge.supabase.co") + "/functions/v1/social-automation";
const providers = [
  { id: "facebook", name: "Facebook Pages", note: "Page posts and page insights; Meta app review may be required." },
  { id: "instagram", name: "Instagram", note: "Business/Creator media publishing; a linked professional account and public media URL are required." },
  { id: "youtube", name: "YouTube", note: "Channel connection and channel statistics. Video publishing requires a separate media upload workflow." },
  { id: "linkedin", name: "LinkedIn", note: "Member posts, subject to LinkedIn app products and w_member_social approval." },
  { id: "x", name: "X", note: "Text posts and recent-post metrics; API plan and write scope apply." },
  { id: "threads", name: "Threads", note: "Text posts; account permissions and app review apply." },
  { id: "tiktok", name: "TikTok", note: "OAuth account connection; publishing is not enabled until the required media flow is configured." },
  { id: "pinterest", name: "Pinterest", note: "OAuth account connection; board selection is needed before pin publishing." },
  { id: "whatsapp", name: "WhatsApp Business", note: "Meta OAuth; a WhatsApp Business Account and phone number must be selected before messaging." },
] as const;

type Provider = typeof providers[number]["id"];
type Account = { id: string; provider: Provider; external_account_id: string; account_name: string; token_expires_at: string | null; scopes: string[]; metadata: Record<string, unknown>; status: string; created_at: string };
type Job = { id: string; connection_id: string; content_type: string; content: { text?: string; media_url?: string }; scheduled_at: string | null; status: string; approved_at: string | null; published_at: string | null; provider_post_id: string | null; provider_post_url: string | null; last_error: string | null; created_at: string };
type MetricResult = { provider: string; captured_at: string; metrics: Record<string, unknown> };

function SocialAutomation() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [contentType, setContentType] = useState("text");
  const [scheduledAt, setScheduledAt] = useState("");
  const [metrics, setMetrics] = useState<MetricResult | null>(null);

  const call = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error: authError } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (authError || !token) throw new Error("সোশ্যাল অ্যাকাউন্ট পরিচালনার জন্য আবার সাইন ইন করুন।");
    const response = await fetch(endpoint + "?action=" + encodeURIComponent(action), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, apikey: supabase.supabaseKey },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "অনুরোধ সম্পন্ন হয়নি।");
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [accountData, jobData] = await Promise.all([call("accounts"), call("jobs")]);
      setAccounts(accountData.accounts || []); setJobs(jobData.jobs || []);
    } catch (e) { setError(e instanceof Error ? e.message : "ডেটা লোড করা যায়নি।"); }
    finally { setLoading(false); }
  }, [call]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const count = params.get("count");
    const oauthError = params.get("error");
    if (connected) setNotice((connected + " সংযোগের OAuth ধাপ সম্পন্ন হয়েছে; " + (count || "0") + "টি অ্যাকাউন্ট পাওয়া গেছে।"));
    if (oauthError) setError("OAuth সংযোগ সম্পন্ন হয়নি: " + oauthError.replaceAll("_", " "));
    void refresh();
  }, [refresh]);

  async function connect(provider: Provider) {
    setBusy("connect:" + provider); setError(""); setNotice("");
    try {
      const result = await call("connect", { provider });
      if (!result.authorization_url) throw new Error("OAuth লিংক পাওয়া যায়নি।");
      window.location.assign(result.authorization_url);
    } catch (e) { setError(e instanceof Error ? e.message : "সংযোগ শুরু করা যায়নি।"); setBusy(""); }
  }

  async function disconnect(account: Account) {
    if (!window.confirm(account.account_name + " অ্যাকাউন্টটি বিচ্ছিন্ন করবেন?")) return;
    setBusy(account.id); setError(""); setNotice("");
    try { await call("disconnect", { connection_id: account.id }); setNotice("অ্যাকাউন্ট বিচ্ছিন্ন হয়েছে।"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "অ্যাকাউন্ট বিচ্ছিন্ন করা যায়নি।"); }
    finally { setBusy(""); }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connectionId) { setError("প্রথমে একটি সংযুক্ত অ্যাকাউন্ট বেছে নিন।"); return; }
    setBusy("create"); setError(""); setNotice("");
    try {
      const result = await call("create_job", { connection_id: connectionId, content_type: contentType, content: { text, media_url: mediaUrl }, scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null, request_approval: true });
      setNotice("পোস্টের খসড়া সংরক্ষিত হয়েছে। প্রকাশ বা শিডিউল করার আগে অনুমোদন দিতে হবে।");
      setText(""); setMediaUrl(""); setScheduledAt(""); setConnectionId("");
      await refresh();
      if (result.job?.id) setNotice("খসড়া সংরক্ষিত হয়েছে: " + result.job.id.slice(0, 8) + "। প্রকাশের আগে অনুমোদন দিন।");
    } catch (e) { setError(e instanceof Error ? e.message : "খসড়া সংরক্ষণ করা যায়নি।"); }
    finally { setBusy(""); }
  }

  async function approve(job: Job) {
    setBusy(job.id); setError(""); setNotice("");
    try { const result = await call("approve_job", { job_id: job.id }); setNotice(result.status === "scheduled" ? "পোস্ট অনুমোদিত হয়েছে এবং নির্ধারিত সময়ের জন্য অপেক্ষা করছে।" : "পোস্ট অনুমোদিত হয়েছে। এখনই প্রকাশ করতে পারেন।"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "অনুমোদন করা যায়নি."); }
    finally { setBusy(""); }
  }

  async function publish(job: Job) {
    if (!window.confirm("এই পোস্টটি এখনই নির্বাচিত সোশ্যাল অ্যাকাউন্টে প্রকাশ করবেন?")) return;
    setBusy(job.id); setError(""); setNotice("");
    try { const result = await call("publish_job", { job_id: job.id }); setNotice("পোস্ট প্রকাশিত হয়েছে। পোস্ট আইডি: " + (result.provider_post_id || "প্রদান করা হয়নি")); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "পোস্ট প্রকাশ করা যায়নি।"); await refresh(); }
    finally { setBusy(""); }
  }

  async function loadMetrics(account: Account) {
    setBusy("metrics:" + account.id); setError(""); setMetrics(null);
    try { setMetrics(await call("metrics", { connection_id: account.id })); setNotice("উপলভ্য পরিসংখ্যান সংগ্রহ করা হয়েছে।"); }
    catch (e) { setError(e instanceof Error ? e.message : "পরিসংখ্যান পাওয়া যায়নি।"); }
    finally { setBusy(""); }
  }

  return <>
    <PageHeader title="Social Automation" sub="OAuth দিয়ে অ্যাকাউন্ট সংযুক্ত করুন, প্রকাশনার খসড়া অনুমোদন করুন, সময়সূচি তৈরি করুন এবং অনুমোদিত API থেকে ফলাফল দেখুন।" />
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <p className="font-semibold">শুরু করার আগে</p>
      <p className="mt-1 text-muted-foreground">প্রতিটি প্ল্যাটফর্মের Developer App, OAuth redirect URI, API scope ও app review আলাদা করে সেট করতে হবে। সার্ভারের প্রয়োজনীয় secrets না থাকলে সংযোগ ব্যর্থ হবে—এই পৃষ্ঠা কোনো অ্যাকাউন্টকে মিথ্যাভাবে Connected দেখাবে না। অ্যাকাউন্টের পাসওয়ার্ড বা API secret এখানে লিখবেন না।</p>
    </div>
    {error && <div role="alert" className="mb-3 flex gap-2 rounded-lg border border-destructive/40 p-3 text-sm"><CircleAlert className="h-5 w-5 shrink-0 text-destructive" />{error}</div>}
    {notice && <div role="status" className="mb-3 flex gap-2 rounded-lg border p-3 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />{notice}</div>}

    <section className="card-surface mb-4 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">১. সোশ্যাল অ্যাকাউন্ট সংযোগ</h2><button className="btn" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-1 inline h-4 w-4" />রিফ্রেশ</button></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((p) => {
          const connected = accounts.filter((a) => a.provider === p.id);
          return <article key={p.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-medium">{p.name}</h3><p className="mt-1 text-xs text-muted-foreground">{p.note}</p></div><span className={"shrink-0 rounded-full px-2 py-1 text-[10px] " + (connected.length ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{connected.length ? connected.length + " সংযুক্ত" : "সংযুক্ত নয়"}</span></div>
            <button type="button" className="btn mt-3 w-full" disabled={!!busy || loading} onClick={() => void connect(p.id)}>{busy === "connect:" + p.id ? <LoaderCircle className="mr-1 inline h-4 w-4 animate-spin" /> : <Link2 className="mr-1 inline h-4 w-4" />}OAuth দিয়ে সংযোগ</button>
          </article>;
        })}
      </div>
      <div className="mt-4 space-y-2">
        {accounts.map((a) => <article key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <div className="min-w-0 flex-1"><p className="font-medium">{a.account_name}</p><p className="text-xs text-muted-foreground">{a.provider} · {a.external_account_id} · অনুমতি: {(a.scopes || []).join(", ") || "প্রোভাইডার নিশ্চিত করেনি"}</p></div>
          <button className="btn" type="button" disabled={!!busy} onClick={() => void loadMetrics(a)}><Activity className="mr-1 inline h-4 w-4" />পরিসংখ্যান</button>
          <button className="btn" type="button" disabled={!!busy} onClick={() => void disconnect(a)}><Unplug className="mr-1 inline h-4 w-4" />বিচ্ছিন্ন</button>
        </article>)}
        {!loading && accounts.length === 0 && <p className="text-sm text-muted-foreground">এখনো কোনো সোশ্যাল অ্যাকাউন্ট সংযুক্ত নেই।</p>}
      </div>
    </section>

    <section className="card-surface mb-4 p-4 sm:p-5">
      <h2 className="mb-3 font-semibold">২. পোস্টের খসড়া ও সময়সূচি</h2>
      <form onSubmit={createDraft} className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium" htmlFor="social-account">সংযুক্ত অ্যাকাউন্ট</label><select id="social-account" className="field" value={connectionId} onChange={(e) => setConnectionId(e.target.value)} required><option value="">অ্যাকাউন্ট নির্বাচন করুন</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.provider})</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-medium" htmlFor="social-content-type">কনটেন্টের ধরন</label><select id="social-content-type" className="field" value={contentType} onChange={(e) => setContentType(e.target.value)}><option value="text">টেক্সট পোস্ট</option><option value="image">ছবি পোস্ট</option><option value="video">ভিডিও / রিল</option><option value="link">লিংক পোস্ট</option></select></div>
        <div><label className="mb-1 block text-sm font-medium" htmlFor="social-post-text">পোস্টের লেখা</label><textarea id="social-post-text" className="field min-h-28" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder="প্রকাশ করতে চান এমন পোস্টের লেখা..." /></div>
        <div><label className="mb-1 block text-sm font-medium" htmlFor="social-media-url">মিডিয়ার HTTPS URL (যদি দরকার হয়)</label><input id="social-media-url" className="field" type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://example.com/public-image.jpg" /></div>
        <div><label className="mb-1 block text-sm font-medium" htmlFor="social-schedule">প্রকাশের সময় (ঐচ্ছিক)</label><input id="social-schedule" className="field" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">সময় দিলে অনুমোদনের পর পোস্ট নির্ধারিত সময়ে প্রকাশের জন্য অপেক্ষা করবে। সময় স্বয়ংক্রিয়ভাবে স্থানীয় টাইমজোন থেকে ISO সময়ে রূপান্তরিত হয়।</p></div>
        <button className="btn btn-primary w-full" type="submit" disabled={!!busy || loading || accounts.length === 0}>{busy === "create" ? <LoaderCircle className="mr-1 inline h-4 w-4 animate-spin" /> : <Send className="mr-1 inline h-4 w-4" />}অনুমোদনের জন্য খসড়া জমা দিন</button>
      </form>
    </section>

    <section className="card-surface mb-4 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">৩. অনুমোদন, প্রকাশনা ও শিডিউল</h2><span className="text-xs text-muted-foreground">{jobs.length}টি</span></div>
      {jobs.length === 0 ? <p className="text-sm text-muted-foreground">এখনো কোনো পোস্টের খসড়া নেই।</p> : <div className="space-y-3">{jobs.map((job) => {
        const account = accounts.find((a) => a.id === job.connection_id);
        return <article key={job.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{account?.account_name || "সোশ্যাল অ্যাকাউন্ট"}</span><span className="rounded-full bg-secondary px-2 py-1 text-xs">{job.status}</span><span className="ml-auto text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{job.content?.text || job.content?.media_url || "মিডিয়া পোস্ট"}</p>
          {job.scheduled_at && <p className="mt-1 text-xs text-muted-foreground">নির্ধারিত: {new Date(job.scheduled_at).toLocaleString()}</p>}
          {job.last_error && <p className="mt-2 text-sm text-destructive">{job.last_error}</p>}
          {job.provider_post_url && <a className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline" href={job.provider_post_url} target="_blank" rel="noreferrer">প্রকাশিত পোস্ট দেখুন <ExternalLink className="h-3 w-3" /></a>}
          <div className="mt-3 flex flex-wrap gap-2">
            {["draft","pending_approval"].includes(job.status) && <button className="btn" type="button" disabled={!!busy} onClick={() => void approve(job)}>অনুমোদন</button>}
            {job.status === "approved" && <button className="btn btn-primary" type="button" disabled={!!busy} onClick={() => void publish(job)}>{busy === job.id ? <LoaderCircle className="mr-1 inline h-4 w-4 animate-spin" /> : <Send className="mr-1 inline h-4 w-4" />}এখনই প্রকাশ</button>}
          </div>
        </article>;
      })}</div>}
    </section>

    {metrics && <section className="card-surface p-4 sm:p-5"><h2 className="mb-2 font-semibold">৪. সংগৃহীত পরিসংখ্যান</h2><p className="mb-2 text-xs text-muted-foreground">{metrics.provider} · {new Date(metrics.captured_at).toLocaleString()}</p><pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-3 text-xs">{JSON.stringify(metrics.metrics, null, 2)}</pre></section>}
  </>;
}
