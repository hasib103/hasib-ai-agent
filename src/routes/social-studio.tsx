import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, CalendarDays, CheckCircle2, Copy, Download, ExternalLink, Layers3, MessageSquareText, Plus, Send, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { PageHeader } from "@/lib/store";
import { askVoiceAssistant } from "@/lib/voice-chat.functions";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/social-studio")({
  head: () => ({
    meta: [
      { title: "Social Media Studio · Hasib AI Agent" },
      { name: "description", content: "Plan social campaigns, generate platform-ready content, organize a content calendar and prepare safe social media automation workflows." },
    ],
  }),
  component: SocialStudio,
});

const platforms = [
  { id: "Facebook", group: "Meta", use: "পেজ পোস্ট, কমিউনিটি ও প্রচার", integration: "Meta Graph API / OAuth" },
  { id: "Instagram", group: "Meta", use: "রিলস, ক্যারোসেল, স্টোরি আইডিয়া ও ক্যাপশন", integration: "Instagram Graph API / OAuth" },
  { id: "WhatsApp Business", group: "Messaging", use: "অনুমতিপ্রাপ্ত গ্রাহক বার্তা ও টেমপ্লেট", integration: "WhatsApp Business Platform" },
  { id: "YouTube", group: "Video", use: "ভিডিও ধারণা, শিরোনাম, বিবরণ ও Shorts", integration: "YouTube Data API / OAuth" },
  { id: "TikTok", group: "Video", use: "শর্ট ভিডিও স্ক্রিপ্ট ও ক্যাপশন", integration: "TikTok for Developers API" },
  { id: "LinkedIn", group: "Professional", use: "পেশাগত পোস্ট, ব্র্যান্ড ও B2B কনটেন্ট", integration: "LinkedIn API / OAuth" },
  { id: "X", group: "Microblog", use: "সংক্ষিপ্ত পোস্ট ও থ্রেড", integration: "X API / OAuth" },
  { id: "Pinterest", group: "Visual", use: "পিন আইডিয়া, শিরোনাম ও বর্ণনা", integration: "Pinterest API / OAuth" },
  { id: "Telegram", group: "Messaging", use: "চ্যানেল পোস্ট ও কমিউনিটি আপডেট", integration: "Telegram Bot API" },
  { id: "Threads", group: "Social", use: "আলোচনামূলক সংক্ষিপ্ত পোস্ট", integration: "Threads API / OAuth" },
] as const;

type SavedCampaign = { id: string; title: string; platforms: string[]; createdAt: string; content: string; goal: string };

const workflows = [
  { title: "একটি বিষয় থেকে বহু প্ল্যাটফর্মের কনটেন্ট", detail: "একটি ব্রিফ থেকে আলাদা ক্যাপশন, ভিডিও স্ক্রিপ্ট, পোস্ট ও CTA তৈরি করুন।" },
  { title: "সাপ্তাহিক কনটেন্ট ক্যালেন্ডার", detail: "লক্ষ্য, অডিয়েন্স ও প্রকাশনার সক্ষমতা অনুযায়ী সময়সূচির খসড়া সাজান।" },
  { title: "কনটেন্ট পুনর্ব্যবহার", detail: "দীর্ঘ লেখা থেকে সংক্ষিপ্ত পোস্ট, FAQ, ভিডিও হুক ও নিউজলেটার আইডিয়া বানান।" },
  { title: "ক্যাম্পেইন পর্যালোচনা", detail: "লক্ষ্য, মেট্রিক, পরীক্ষাযোগ্য হাইপোথিসিস ও পরবর্তী পদক্ষেপ নির্ধারণ করুন।" },
  { title: "অনুমোদন ও নিরাপদ প্রকাশনা", detail: "পোস্ট, বিজ্ঞাপন খরচ, গ্রাহক বার্তা বা অ্যাকাউন্ট পরিবর্তনের আগে মানব অনুমোদন রাখুন।" },
];

function SocialStudio() {
  const runAssistant = useServerFn(askVoiceAssistant);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Facebook", "Instagram", "YouTube"]);
  const [goal, setGoal] = useState("ব্র্যান্ড পরিচিতি ও অর্গানিক রিচ বাড়ানো");
  const [business, setBusiness] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [tone, setTone] = useState("বন্ধুসুলভ ও বিশ্বাসযোগ্য");
  const [language, setLanguage] = useState("বাংলা");
  const [frequency, setFrequency] = useState("প্রতি প্ল্যাটফর্মে সপ্তাহে ৩টি পোস্ট");
  const [notes, setNotes] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState<SavedCampaign[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("hasib-social-studio-campaigns-v1");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setSaved(parsed.filter((item): item is SavedCampaign =>
          !!item && typeof item.id === "string" && typeof item.content === "string" &&
          typeof item.title === "string" && Array.isArray(item.platforms) &&
          typeof item.createdAt === "string" && typeof item.goal === "string"
        ).slice(0, 20));
      }
    } catch {
      // Local drafts are optional; keep the studio usable if browser storage is unavailable.
    } finally { setHydrated(true); }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("hasib-social-studio-campaigns-v1", JSON.stringify(saved.slice(0, 20))); }
    catch { setStatus("ব্রাউজারের স্টোরেজে সংরক্ষণ করা যায়নি। কনটেন্ট কপি বা ডাউনলোড করে রাখুন।"); }
  }, [saved, hydrated]);

  function togglePlatform(id: string) {
    setSelectedPlatforms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || selectedPlatforms.length === 0) return;
    setBusy(true); setError(""); setAnswer(""); setStatus("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (sessionError || !accessToken) throw new Error("এই সুবিধা ব্যবহার করতে আপনার অ্যাকাউন্টে আবার সাইন ইন করুন।");
      const selectedDetails = platforms.filter((item) => selectedPlatforms.includes(item.id))
        .map((item) => item.id + ": " + item.use).join("\n");
      const prompt = [
        "You are the Social Media Strategy and Content Operations assistant inside Hasib AI Agent. Answer in clear Bengali. Plain text only: no Markdown bold/italic markers, no heading markers, and no backticks. Use readable numbered sections and simple line breaks.",
        "Create an actionable social campaign plan and ready-to-edit content drafts. Be specific, realistic, platform-native and honest; do not promise virality, guaranteed reach, or guaranteed sales. Do not claim that you published, scheduled, connected accounts, accessed analytics, or sent messages.",
        "Selected platforms and formats:\n" + selectedDetails,
        "Campaign objective: " + goal,
        "Business, creator or organization: " + (business.trim() || "Not provided"),
        "Target audience: " + (audience.trim() || "Not provided"),
        "Product, service, offer or topic: " + (offer.trim() || "Not provided"),
        "Tone: " + tone,
        "Content language: " + language,
        "Publishing cadence: " + frequency,
        "Constraints, links, brand voice, campaign dates or extra context: " + (notes.trim() || "Not provided"),
        "Return: 1) brief strategy and measurable KPI suggestions; 2) a 7-day calendar with suggested local posting windows clearly marked as hypotheses, not guaranteed best times; 3) platform-specific ready-to-edit captions/scripts, hooks and calls to action; 4) visual/video concepts and accessibility/alt-text suggestions; 5) a repurposing workflow; 6) a human review checklist for claims, copyright, consent, privacy, ad disclosures and links; 7) a tracking table specification with UTM naming suggestions; 8) next 3 actions. Adapt format and length to each selected platform. Avoid spam, fake engagement, scraping personal data, unsolicited bulk DMs, deceptive claims and evasion of platform rules. Ask for missing critical details only if essential."
      ].join("\n\n");
      const result = await runAssistant({ data: { message: prompt, history: [], language: "bn-BD", profile: "business_strategist", accessToken } });
      setAnswer(result);
      setStatus("কনটেন্ট তৈরি হয়েছে। এটি খসড়া—কোনো সোশ্যাল মিডিয়া অ্যাকাউন্টে প্রকাশ বা সময়সূচি নির্ধারণ করা হয়নি।");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "কনটেন্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  function saveCampaign() {
    if (!answer.trim()) return;
    const title = (offer.trim() || business.trim() || goal).slice(0, 90);
    const entry: SavedCampaign = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      title, platforms: [...selectedPlatforms], createdAt: new Date().toISOString(), content: answer, goal,
    };
    setSaved((current) => [entry, ...current.filter((item) => item.content !== answer)].slice(0, 20));
    setStatus("ক্যাম্পেইনের খসড়া এই ব্রাউজারে সংরক্ষিত হয়েছে। অন্য ডিভাইসে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে না।");
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); setStatus("কনটেন্ট কপি করা হয়েছে।"); }
    catch { setStatus("কপি করা যায়নি। কনটেন্ট নির্বাচন করে কপি করুন।"); }
  }

  function downloadText(item: SavedCampaign | null = null) {
    const content = item ? item.content : answer;
    if (!content.trim()) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hasib-social-campaign-" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Social Media Studio" sub="এক জায়গায় সোশ্যাল মিডিয়া পরিকল্পনা, বহু-প্ল্যাটফর্ম কনটেন্ট, কনটেন্ট ক্যালেন্ডার ও অনুমোদনভিত্তিক অটোমেশন ওয়ার্কফ্লো তৈরি করুন।" />
      <section className="card-surface mb-4 space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Workflow className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1"><h2 className="font-semibold">একটি ব্রিফ থেকে পরিকল্পিত কাজ</h2><p className="mt-1 text-sm text-muted-foreground">কনটেন্ট তৈরি, প্ল্যাটফর্ম অনুযায়ী রূপান্তর, সময়সূচির খসড়া, অনুমোদন এবং ফলাফল মাপার পরিকল্পনা—সব একই জায়গায়।</p></div>
        </div>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">সংযোগের স্বচ্ছ অবস্থা</p>
          <p className="mt-1 text-muted-foreground">এই সংস্করণে কনটেন্ট পরিকল্পনা ও খসড়া তৈরি, স্থানীয়ভাবে সংরক্ষণ এবং রপ্তানি কাজ করে। Facebook, Instagram, YouTube বা অন্য প্ল্যাটফর্মে সরাসরি পোস্ট/শিডিউল করতে প্রতিটি প্ল্যাটফর্মের অনুমোদিত API, OAuth এবং সার্ভার-সাইড কনফিগারেশন লাগবে। সেগুলো এখানে এখনো সংযুক্ত নয়—তাই কোনো অ্যাকাউন্টকে ভুলভাবে “Connected” দেখানো হচ্ছে না।</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {workflows.map((item) => <div key={item.title} className="rounded-lg border p-3"><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p></div>)}
        </div>
      </section>

      <section className="card-surface mb-4 p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Layers3 className="h-5 w-5" />জনপ্রিয় প্ল্যাটফর্ম</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {platforms.map((platform) => <label key={platform.id} className={"flex cursor-pointer gap-3 rounded-lg border p-3 " + (selectedPlatforms.includes(platform.id) ? "border-primary bg-primary/5" : "")}>
            <input type="checkbox" checked={selectedPlatforms.includes(platform.id)} onChange={() => togglePlatform(platform.id)} className="mt-1" />
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 font-medium">{platform.id}<span className="text-[10px] font-normal text-muted-foreground">{platform.group}</span></span><span className="mt-1 block text-sm text-muted-foreground">{platform.use}</span><span className="mt-1 block text-xs text-muted-foreground">API: {platform.integration}</span></span>
          </label>)}
        </div>
      </section>

      <form className="card-surface space-y-4 p-4 sm:p-5" onSubmit={generate}>
        <h2 className="font-semibold">ক্যাম্পেইন ব্রিফ</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="social-goal" className="mb-1.5 block text-sm font-medium">মূল লক্ষ্য</label><select id="social-goal" className="field" value={goal} onChange={(e) => setGoal(e.target.value)}><option>ব্র্যান্ড পরিচিতি ও অর্গানিক রিচ বাড়ানো</option><option>লিড ও সম্ভাব্য গ্রাহক সংগ্রহ</option><option>বিক্রি বা বুকিং বাড়ানো</option><option>কমিউনিটি ও এনগেজমেন্ট বাড়ানো</option><option>ভিডিও ভিউ ও সাবস্ক্রাইবার বাড়ানো</option><option>বিশেষ অফার বা নতুন পণ্য চালু</option><option>শিক্ষামূলক কনটেন্ট ও বিশ্বাসযোগ্যতা</option></select></div>
          <div><label htmlFor="social-business" className="mb-1.5 block text-sm font-medium">ব্যবসা / ব্র্যান্ড / ক্রিয়েটর</label><input id="social-business" className="field" value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={180} placeholder="যেমন: অনলাইন পোশাকের দোকান" /></div>
          <div><label htmlFor="social-audience" className="mb-1.5 block text-sm font-medium">টার্গেট অডিয়েন্স</label><input id="social-audience" className="field" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={240} placeholder="যেমন: বাংলাদেশের ১৮–৩৫ বছর বয়সী ক্রেতা" /></div>
          <div className="sm:col-span-2"><label htmlFor="social-offer" className="mb-1.5 block text-sm font-medium">পণ্য / সেবা / বিষয়</label><textarea id="social-offer" className="field min-h-20" value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={1200} placeholder="কী প্রচার করবেন, দাম/সুবিধা, প্রমাণযোগ্য দাবি ও লিংক লিখুন।" /></div>
          <div><label htmlFor="social-tone" className="mb-1.5 block text-sm font-medium">ব্র্যান্ডের ভাষা</label><select id="social-tone" className="field" value={tone} onChange={(e) => setTone(e.target.value)}><option>বন্ধুসুলভ ও বিশ্বাসযোগ্য</option><option>পেশাদার ও তথ্যভিত্তিক</option><option>উদ্দীপনামূলক ও প্রাণবন্ত</option><option>মার্জিত ও প্রিমিয়াম</option><option>হালকা ও মজার</option></select></div>
          <div><label htmlFor="social-language" className="mb-1.5 block text-sm font-medium">কনটেন্টের ভাষা</label><select id="social-language" className="field" value={language} onChange={(e) => setLanguage(e.target.value)}><option>বাংলা</option><option>English</option><option>বাংলা ও English</option><option>Hindi</option><option>Urdu</option></select></div>
          <div className="sm:col-span-2"><label htmlFor="social-frequency" className="mb-1.5 block text-sm font-medium">প্রকাশনার লক্ষ্য</label><select id="social-frequency" className="field" value={frequency} onChange={(e) => setFrequency(e.target.value)}><option>প্রতি প্ল্যাটফর্মে সপ্তাহে ৩টি পোস্ট</option><option>প্রতিদিন ১টি পোস্ট</option><option>সপ্তাহে ৫টি পোস্ট ও ২টি শর্ট ভিডিও</option><option>সপ্তাহে ১টি দীর্ঘ ভিডিও ও ৩টি শর্টস</option><option>শুধু ক্যাম্পেইন / লঞ্চভিত্তিক</option></select></div>
          <div className="sm:col-span-2"><label htmlFor="social-notes" className="mb-1.5 block text-sm font-medium">অতিরিক্ত নির্দেশনা (ঐচ্ছিক)</label><textarea id="social-notes" className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="ক্যাম্পেইনের তারিখ, ব্র্যান্ডের নিয়ম, বাজেটের সীমা, নিষিদ্ধ শব্দ, ওয়েবসাইট লিংক ইত্যাদি।" /></div>
        </div>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={busy || selectedPlatforms.length === 0}><Sparkles className="mr-2 inline h-4 w-4" />{busy ? "ক্যাম্পেইন তৈরি হচ্ছে…" : "ক্যাম্পেইন ও কনটেন্ট তৈরি করুন"}</button>
        {selectedPlatforms.length === 0 && <p className="text-sm text-muted-foreground">অন্তত একটি প্ল্যাটফর্ম নির্বাচন করুন।</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
      </form>

      {answer && <section className="card-surface mt-4 p-4 sm:p-5" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-5 w-5" />ক্যাম্পেইন খসড়া</h2><div className="flex flex-wrap gap-2"><button type="button" className="btn" onClick={() => void copyText(answer)}><Copy className="mr-1 inline h-4 w-4" />কপি</button><button type="button" className="btn" onClick={() => downloadText()}><Download className="mr-1 inline h-4 w-4" />ডাউনলোড</button><button type="button" className="btn btn-primary" onClick={saveCampaign}><Plus className="mr-1 inline h-4 w-4" />সংরক্ষণ</button></div></div>
        <div className="whitespace-pre-wrap break-words text-sm leading-7">{answer}</div>
        <p className="mt-4 rounded-md border p-3 text-sm text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4" />প্রকাশের আগে তথ্য, মূল্য, অফার, কপিরাইট, অনুমতি, ব্যক্তিগত তথ্য ও প্ল্যাটফর্মের নীতিমালা যাচাই করুন। পোস্ট/বিজ্ঞাপন খরচ/গ্রাহককে বার্তা পাঠানোর আগে অনুমোদন নিন।</p>
      </section>}

      <section className="card-surface mt-4 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2"><CalendarDays className="h-5 w-5" /><h2 className="font-semibold">সংরক্ষিত ক্যাম্পেইন</h2><span className="ml-auto text-xs text-muted-foreground">{saved.length}/20</span></div>
        {saved.length === 0 ? <p className="text-sm text-muted-foreground">এখনো কোনো ক্যাম্পেইন সংরক্ষণ করা হয়নি। তৈরি করা খসড়া সংরক্ষণ করলে এখানে দেখা যাবে।</p> : <div className="space-y-2">{saved.map((item) => <article key={item.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start gap-2"><h3 className="min-w-0 flex-1 font-medium">{item.title}</h3><span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.platforms.join(" · ")} — {item.goal}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="btn" onClick={() => { setAnswer(item.content); setStatus("সংরক্ষিত খসড়া খুলেছে।"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>খুলুন</button><button type="button" className="btn" onClick={() => void copyText(item.content)}><Copy className="mr-1 inline h-4 w-4" />কপি</button><button type="button" className="btn" onClick={() => setSaved((current) => current.filter((entry) => entry.id !== item.id))}>মুছুন</button></div></article>)}</div>}
      </section>

      <section className="card-surface mt-4 p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Activity className="h-5 w-5" />পরবর্তী ধাপ: বাস্তব অটোমেশন সংযোগ</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>ব্যবহারকারী অনুমোদিত OAuth দিয়ে সংশ্লিষ্ট সোশ্যাল অ্যাকাউন্ট সংযুক্ত করবেন। পাসওয়ার্ড বা API key এই ফর্মে নেওয়া হবে না।</li>
          <li>সার্ভারে অনুমোদিত token নিরাপদে সংরক্ষণ, প্রয়োজনীয় scope, refresh ও disconnect ব্যবস্থা তৈরি হবে।</li>
          <li>প্রতিটি প্ল্যাটফর্মের অনুমোদিত API অনুযায়ী draft, scheduling, publishing ও analytics আলাদাভাবে চালু হবে। সব API-তে একই ধরনের প্রকাশনা সুবিধা নেই।</li>
          <li>পোস্ট প্রকাশ, বিজ্ঞাপন খরচ, bulk messaging এবং account permissions-এর আগে স্পষ্ট user approval থাকবে।</li>
        </ol>
      </section>
    </>
  );
}
