import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useStore, timeAgo, Demo, PageHeader, type TaskStatus } from "@/lib/store";
import { generateTaskPlan, type AiPlan } from "@/lib/ai-plan.functions";
import { supabase } from "@/lib/supabase";

const riskTone: Record<string, string> = {
  low: "bg-success/15 text-success", medium: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive",
};
const prioTone: Record<string, string> = {
  high: "bg-primary/15 text-primary", medium: "bg-secondary text-muted-foreground", low: "bg-secondary text-muted-foreground",
};

function AiPlanner() {
  const { set, uid, now } = useStore();
  const run = useServerFn(generateTaskPlan);
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const generate = async () => {
    setBusy(true); setError(null); setPlan(null); setAdded(false);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("Sign in again to use the AI planner.");
      const p = await run({ data: { request, accessToken: sessionData.session.access_token } });
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const addToInbox = () => {
    if (!plan) return;
    set((st) => ({
      ...st,
      tasks: [
        ...plan.steps.map((step, i) => ({
          id: uid(),
          title: `[${step.priority.toUpperCase()}] ${step.title}`,
          status: "queued" as TaskStatus,
          updated: now(),
          history: [{ at: now(), note: `From AI plan (${i + 1}/${plan.steps.length}) · risk: ${step.risk} — ${step.rationale}` }],
        })),
        ...st.tasks,
      ],
    }), `AI plan added to inbox: ${plan.summary}`);
    setAdded(true);
  };

  return (
    <section className="card-surface p-4 mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">AI plan generator</h2>
        <span className="text-xs rounded-full px-2 py-0.5 bg-primary/15 text-primary">AI</span>
      </div>
      <p className="text-xs text-muted-foreground">Describe a goal; the model drafts a prioritized, risk-labeled plan. Nothing runs automatically — you review and add steps yourself.</p>
      <textarea
        className="field min-h-20"
        placeholder="e.g. Prepare the app for a first closed beta with 5 testers…"
        value={request}
        maxLength={2000}
        onChange={(e) => setRequest(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy || !request.trim()} onClick={generate}>
          {busy ? "Planning…" : "Generate plan"}
        </button>
        {plan && !added && <button className="btn btn-ghost" onClick={addToInbox}>Add {plan.steps.length} steps to inbox</button>}
        {added && <span className="text-sm text-success self-center">Added to inbox ✓</span>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {plan && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium">{plan.summary}</p>
          <ol className="space-y-2">
            {plan.steps.map((step, i) => (
              <li key={i} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1 text-sm font-medium">{step.title}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 capitalize ${prioTone[step.priority]}`}>{step.priority} priority</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 capitalize ${riskTone[step.risk]}`}>{step.risk} risk</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.rationale}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [
    { title: "Task inbox · Hasib AI Agent" },
    { name: "description", content: "Agent tasks with status and resumable history." },
    { property: "og:title", content: "Task inbox · Hasib AI Agent" },
    { property: "og:description", content: "Agent tasks with status and resumable history." },
  ] }),
  component: Tasks,
});

const tone: Record<TaskStatus, string> = {
  running: "bg-primary/15 text-primary", queued: "bg-secondary text-muted-foreground", paused: "bg-warning/15 text-warning",
  blocked: "bg-destructive/15 text-destructive", done: "bg-success/15 text-success", failed: "bg-destructive/15 text-destructive",
};
const filters = ["all", "running", "queued", "paused", "blocked", "done", "failed"] as const;

const starterPrompts = [
  {
    title: "Check app health and report",
    prompt: "Inspect the Hasib AI Agent app and report only verified facts: what works now, what is broken, what is still a mock/local-only feature, and the exact next steps. Do not claim a task ran unless execution evidence confirms it. Do not expose secrets.",
  },
  {
    title: "Verify AI planner",
    prompt: "Test the AI plan generator using a harmless request. Confirm whether the backend and AI provider respond successfully. If it fails, record the exact non-secret error and the likely configuration area; never print API keys or secret values.",
  },
  {
    title: "Set up secure persistent storage",
    prompt: "Plan and implement persistent task and memory storage with authenticated access. Verify the database configuration before use, keep service-role credentials server-side only, enable row-level security, and document any setup steps that require Hasib's approval. Do not invent credentials.",
  },
  {
    title: "Connect task execution safely",
    prompt: "Design a server-side task runner that executes only explicitly supported actions. Require Hasib's confirmation before sending messages, publishing, deleting data, spending money, changing security settings, or using external accounts. Log outcomes and failures accurately; do not mark queued tasks as completed.",
  },
  {
    title: "Build and verify Android APK",
    prompt: "Build the latest Hasib AI Agent Android debug APK from the current main branch. Verify the GitHub Actions run succeeded and the APK artifact exists and has not expired. Report the exact artifact link and installation/testing limitations; do not claim device testing unless it actually occurred.",
  },
] as const;


function Tasks() {
  const { s, set, uid, now, confirm } = useStore();
  const [f, setF] = useState<(typeof filters)[number]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const list = s.tasks.filter((t) => f === "all" || t.status === f);

  const setStatus = (id: string, status: TaskStatus, note: string) =>
    set((st) => ({ ...st, tasks: st.tasks.map((t) => t.id === id ? { ...t, status, updated: now(), history: [...t.history, { at: now(), note }] } : t) }), `Task "${s.tasks.find((t) => t.id === id)?.title}": ${note}`);

  return (
    <>
      <PageHeader title="Task inbox" sub="Tasks are tracked locally. The agent runtime is not connected yet." />
      <AiPlanner />
      <section className="card-surface p-4 mb-4 space-y-3">
        <div>
          <h2 className="font-semibold">Starter task prompts</h2>
          <p className="text-xs text-muted-foreground mt-1">These prompts are saved as queued inbox tasks in this browser only. They do not run automatically; the agent runtime is not connected yet.</p>
        </div>
        <ul className="space-y-2">
          {starterPrompts.map((item) => (
            <li key={item.title} className="rounded-md border p-3">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.prompt}</p>
            </li>
          ))}
        </ul>
        <button
          className="btn btn-primary"
          disabled={starterPrompts.every((item) => s.tasks.some((task) => task.title === item.title))}
          onClick={() => {
            const fresh = starterPrompts.filter((item) => !s.tasks.some((task) => task.title === item.title));
            if (!fresh.length) return;
            set((st) => ({
              ...st,
              tasks: [
                ...fresh.map((item) => ({
                  id: uid(),
                  title: item.title,
                  status: "queued" as TaskStatus,
                  updated: now(),
                  history: [{ at: now(), note: `Saved prompt: ${item.prompt}` }],
                })),
                ...st.tasks,
              ],
            }), `Saved ${fresh.length} starter task prompts to inbox`);
          }}
        >
          {starterPrompts.every((item) => s.tasks.some((task) => task.title === item.title))
            ? "Starter prompts already saved"
            : "Save starter prompts to inbox"}
        </button>
      </section>
      <form className="flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return;
        set((st) => ({ ...st, tasks: [{ id: uid(), title: title.trim(), status: "queued", updated: now(), history: [{ at: now(), note: "Task created" }] }, ...st.tasks] }), `Created task "${title.trim()}"`); setTitle(""); }}>
        <input className="field" placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-primary">Add</button>
      </form>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {filters.map((x) => <button key={x} onClick={() => setF(x)} className={`btn capitalize shrink-0 ${f === x ? "btn-primary" : "btn-ghost"}`}>{x}</button>)}
      </div>
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.id} className="card-surface p-4">
            <button className="w-full text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <div className="flex items-start gap-2">
                <span className="flex-1 font-medium">{t.title} <Demo show={t.demo} /></span>
                <span className={`text-xs rounded-full px-2 py-0.5 capitalize ${tone[t.status]}`}>{t.status}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Updated {timeAgo(t.updated)} · {t.history.length} steps</div>
            </button>
            {open === t.id && (
              <div className="mt-3 border-t pt-3 space-y-3">
                <ol className="space-y-1.5 text-sm">
                  {t.history.map((h, i) => <li key={i} className="flex gap-2"><span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{timeAgo(h.at)}</span>{h.note}</li>)}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {t.status === "running" && <button className="btn btn-ghost" onClick={() => setStatus(t.id, "paused", "Paused by Hasib")}>Pause</button>}
                  {["paused", "blocked", "failed", "queued"].includes(t.status) && <button className="btn btn-primary" onClick={() => setStatus(t.id, "running", "Resumed from last step")}>Resume</button>}
                  {t.status !== "done" && <button className="btn btn-ghost" onClick={() => setStatus(t.id, "done", "Marked done")}>Mark done</button>}
                  <button className="btn btn-danger" onClick={async () => {
                    if (await confirm("Delete task?", `"${t.title}" and its history will be permanently removed.`, true))
                      set((st) => ({ ...st, tasks: st.tasks.filter((x) => x.id !== t.id) }), `Deleted task "${t.title}"`);
                  }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No tasks.</p>}
      </div>
    </>
  );
}