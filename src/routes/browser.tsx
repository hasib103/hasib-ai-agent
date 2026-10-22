import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { runBrowserTask } from "@/lib/browser-automation.functions";
import { PageHeader } from "@/lib/store";

export const Route = createFileRoute("/browser")({
  head: () => ({ meta: [
    { title: "Browser · Hasib AI Agent" },
    { name: "description", content: "Run a bounded remote browser task against a public website." },
  ] }),
  component: BrowserPage,
});

type BrowserResult = Awaited<ReturnType<typeof runBrowserTask>>;

function BrowserPage() {
  const run = useServerFn(runBrowserTask);
  const [url, setUrl] = useState("https://example.com");
  const [goal, setGoal] = useState("এই ওয়েবপেজটি পড়ে গুরুত্বপূর্ণ তথ্য বের করো");
  const [actions, setActions] = useState<Array<{ type: "click" | "type" | "wait"; selector?: string; text?: string; milliseconds?: number }>>([]);
  const [newType, setNewType] = useState<"click" | "type" | "wait">("click");
  const [selector, setSelector] = useState("");
  const [textValue, setTextValue] = useState("");
  const [waitMs, setWaitMs] = useState(1000);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BrowserResult | null>(null);

  function addAction() {
    if (actions.length >= 6) return;
    if (newType !== "wait" && !selector.trim()) { setError("CSS selector দিন।"); return; }
    if (newType === "type" && !textValue.trim()) { setError("টাইপ করার টেক্সট দিন।"); return; }
    setActions((old) => [...old, newType === "wait"
      ? { type: "wait" as const, milliseconds: waitMs }
      : newType === "type"
        ? { type: "type" as const, selector: selector.trim(), text: textValue }
        : { type: "click" as const, selector: selector.trim() }]);
    setSelector(""); setTextValue(""); setError("");
  }

  async function execute() {
    if (!confirmed) { setError("ব্রাউজার অ্যাকশন চালাতে আগে নিশ্চিত করুন।"); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (sessionError || !accessToken) throw new Error("সেশন শেষ হয়েছে। আবার সাইন ইন করুন।");
      const response = await run({ data: { url, goal, actions, accessToken } });
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ব্রাউজার কাজ ব্যর্থ হয়েছে।");
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Remote Browser" sub="ওয়েবসাইট খুলুন, নির্দিষ্ট বোতামে ক্লিক করুন, ফর্ম ফিল্ডে টেক্সট দিন এবং দৃশ্যমান পেজের তথ্য পড়ুন।" />
      <section className="card-surface p-4 space-y-4 mb-4">
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          এই সুবিধার জন্য সার্ভারে BROWSERLESS_API_TOKEN লাগবে। এটি একটি নতুন, বিচ্ছিন্ন ব্রাউজার সেশন চালায়—সংরক্ষিত লগইন সেশন নয়। পাসওয়ার্ড, OTP, পেমেন্ট বা সংবেদনশীল তথ্য লিখবেন না। ওয়েবসাইটে ক্লিক করলে বাহ্যিক পরিবর্তন হতে পারে।
        </div>
        <label className="grid gap-1 text-sm font-medium">Website URL
          <input className="w-full rounded-md border bg-background px-3 py-2 font-normal" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" type="url" maxLength={2048} />
        </label>
        <label className="grid gap-1 text-sm font-medium">কাজের উদ্দেশ্য
          <input className="w-full rounded-md border bg-background px-3 py-2 font-normal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} />
        </label>
        <div className="space-y-2">
          <h2 className="font-medium">Browser actions ({actions.length}/6)</h2>
          {actions.map((a, i) => <div key={i} className="flex gap-2 items-start rounded border p-2 text-sm">
            <span className="flex-1 break-all">{i + 1}. {a.type === "wait" ? `Wait ${a.milliseconds}ms` : a.type === "click" ? `Click ${a.selector}` : `Type into ${a.selector}: ${a.text}`}</span>
            <button className="text-muted-foreground underline" type="button" onClick={() => setActions((old) => old.filter((_, index) => index !== i))}>Remove</button>
          </div>)}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Action
              <select className="rounded-md border bg-background px-3 py-2" value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)}>
                <option value="click">Click CSS selector</option><option value="type">Type text into field</option><option value="wait">Wait</option>
              </select>
            </label>
            {newType === "wait" ? <label className="grid gap-1 text-sm">Wait (milliseconds)
              <input className="rounded-md border bg-background px-3 py-2" type="number" min={100} max={5000} step={100} value={waitMs} onChange={(e) => setWaitMs(Math.max(100, Math.min(5000, Number(e.target.value) || 1000)))} />
            </label> : <label className="grid gap-1 text-sm">CSS selector
              <input className="rounded-md border bg-background px-3 py-2" value={selector} onChange={(e) => setSelector(e.target.value)} maxLength={300} placeholder="button.search, input[name=q]" />
            </label>}
            {newType === "type" && <label className="grid gap-1 text-sm sm:col-span-2">Text to type
              <input className="rounded-md border bg-background px-3 py-2" value={textValue} onChange={(e) => setTextValue(e.target.value)} maxLength={2000} />
            </label>}
          </div>
          <button type="button" disabled={actions.length >= 6} onClick={addAction} className="btn btn-ghost w-full">Add action</button>
        </div>
        <label className="flex gap-2 items-start text-sm">
          <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>আমি বুঝেছি যে এই কাজটি একটি বাহ্যিক ওয়েবসাইটে ক্লিক/ফর্ম পরিবর্তন করতে পারে এবং আমি এই কাজটি চালানোর অনুমতি দিচ্ছি।</span>
        </label>
        <button type="button" onClick={() => void execute()} disabled={busy || !url.trim() || !goal.trim()} className="btn btn-primary w-full">{busy ? "Browser চলছে…" : "Run browser task"}</button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
      {result && <section className="card-surface p-4 space-y-3">
        <h2 className="font-semibold break-words">{result.title || "Page result"}</h2>
        <p className="text-xs text-muted-foreground break-all">{result.url}</p>
        <div className="text-xs text-muted-foreground">Goal: {result.goal}</div>
        {!!result.actions.length && <div className="text-sm"><h3 className="font-medium">Actions performed</h3><ul className="list-disc pl-5">{result.actions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
        <div><h3 className="font-medium mb-1">Page text</h3><pre className="whitespace-pre-wrap break-words text-sm max-h-[32rem] overflow-auto rounded-md bg-secondary/50 p-3">{result.text || "No page text was returned."}</pre></div>
        {!!result.links.length && <div><h3 className="font-medium mb-1">Links</h3><ul className="space-y-1 text-sm">{result.links.map((link, i) => <li key={i} className="break-all"><a className="underline text-primary" href={link.href} target="_blank" rel="noreferrer">{link.text || link.href}</a></li>)}</ul></div>}
      </section>}
    </>
  );
}
