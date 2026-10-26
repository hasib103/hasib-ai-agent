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
          taskType: "generate_plan",
          payload: { request: `${step.title}\n${step.rationale}` },
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

type GeneratedPlanStep = { title: string; priority: string; risk: string; rationale: string };
type GeneratedPlan = { summary: string; steps: GeneratedPlanStep[] };

type UrlAnalysisResult = { url: string; title: string; summary: string; key_points: string[]; limitations: string[] };

function isUrlAnalysisResult(value: unknown): value is UrlAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.url === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.key_points) &&
    candidate.key_points.every((point) => typeof point === "string") &&
    Array.isArray(candidate.limitations) &&
    candidate.limitations.every((item) => typeof item === "string");
}

function isGeneratedPlan(value: unknown): value is GeneratedPlan {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { summary?: unknown; steps?: unknown };
  if (typeof candidate.summary !== "string" || !Array.isArray(candidate.steps)) return false;
  return candidate.steps.every((step: unknown) => {
    if (typeof step !== "object" || step === null) return false;
    const item = step as Record<string, unknown>;
    return typeof item.title === "string" &&
      typeof item.priority === "string" &&
      typeof item.risk === "string" &&
      typeof item.rationale === "string";
  });
}

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
  const [urlToAnalyze, setUrlToAnalyze] = useState("");
  const [runnerBusy, setRunnerBusy] = useState<string | null>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const list = s.tasks.filter((t) => f === "all" || t.status === f);

  const refreshTaskHistory = async (id: string) => {
    const [taskResult, historyResult] = await Promise.all([
      supabase.from("tasks").select("status,result,updated_at").eq("id", id).maybeSingle(),
      supabase.from("task_history").select("id,at,note").eq("task_id", id).order("at", { ascending: true }),
    ]);
    if (taskResult.error) console.error("Could not refresh task state:", taskResult.error.message);
    if (historyResult.error) console.error("Could not refresh task history:", historyResult.error.message);
    const persistedTask = taskResult.data;
    const persistedHistory = historyResult.data;
    if (!persistedTask && !persistedHistory?.length) return;

    const validStatuses = ["queued", "running", "paused", "blocked", "done", "failed"] as const;
    const persistedStatus = typeof persistedTask?.status === "string" &&
      validStatuses.includes(persistedTask.status as (typeof validStatuses)[number])
      ? persistedTask.status as TaskStatus
      : undefined;

    set((st) => ({
      ...st,
      tasks: st.tasks.map((item) => item.id !== id ? item : ({
        ...item,
        ...(persistedStatus ? { status: persistedStatus } : {}),
        ...(persistedTask?.updated_at ? { updated: persistedTask.updated_at } : {}),
        ...(persistedTask && "result" in persistedTask ? { result: persistedTask.result } : {}),
        ...(persistedHistory?.length
          ? { history: persistedHistory.map((entry) => ({ id: entry.id, at: entry.at, note: entry.note })) }
          : {}),
      })),
    }));
  };

  const runTask = async (id: string) => {
    setRunnerBusy(id);
    setRunnerError(null);
    try {
      const task = s.tasks.find((item) => item.id === id);
      if (!task) throw new Error("Task is no longer in the inbox. Refresh the page and try again.");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (sessionError || !userId) throw new Error("Sign in again before running a task.");

      // Persist the task synchronously before invoking the runner. The store's
      // background cloud sync is asynchronous, so relying on it creates a race.
      const { error: persistError } = await supabase.from("tasks").upsert({
        id,
        user_id: userId,
        title: task.title,
        status: "queued",
        task_type: task.taskType ?? "generate_plan",
        payload: task.payload ?? { request: task.title },
        result: task.result ?? null,
        updated_at: task.updated,
      }, { onConflict: "id" });
      if (persistError) throw new Error("Could not save this task to cloud storage: " + persistError.message);

      const { data, error } = await supabase.functions.invoke("task-runner", { body: { task_id: id } });
      if (error) {
        let detail = error.message || "Task runner request failed";
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          const responseBody = await context.clone().json().catch(() => null) as { error?: unknown; message?: unknown } | null;
          if (typeof responseBody?.error === "string") detail = responseBody.error;
          else if (typeof responseBody?.message === "string") detail = responseBody.message;
        }
        throw new Error(detail);
      }
      if (data?.status !== "done") throw new Error(data?.error || "Task did not complete successfully");
      setStatus(id, "done", task.taskType === "analyze_url" ? "Public URL analysis completed and saved; no external action was executed." : "AI plan generated and saved; no external task was executed.", data.result);
      await refreshTaskHistory(id);
    } catch (e) {
      setRunnerError(e instanceof Error ? e.message : "Task runner failed");
      await refreshTaskHistory(id);
    } finally {
      setRunnerBusy(null);
    }
  };

  const setStatus = (id: string, status: TaskStatus, note: string, result?: unknown) =>
    set((st) => ({ ...st, tasks: st.tasks.map((t) => t.id === id ? { ...t, status, updated: now(), ...(result !== undefined ? { result } : {}), history: [...t.history, { at: now(), note }] } : t) }), `Task "${s.tasks.find((t) => t.id === id)?.title}": ${note}`);

  return (
    <>
      <PageHeader title="Task inbox" sub="Tasks sync to Supabase. Supported tasks can generate plans or summarize public URLs; they do not execute external actions." />
      <AiPlanner />
      <section className="card-surface p-4 mb-4 space-y-3">
        <div>
          <h2 className="font-semibold">Analyze a public URL</h2>
          <p className="text-xs text-muted-foreground mt-1">Create a read-only webpage analysis task. The agent summarizes page content; it does not sign in, click, submit forms, or change the website.</p>
        </div>
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={(event) => {
          event.preventDefault();
          const rawUrl = urlToAnalyze.trim();
          let parsed: URL;
          try { parsed = new URL(rawUrl); } catch { return; }
          if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return;
          set((st) => ({
            ...st,
            tasks: [{
              id: uid(),
              title: "Analyze URL: " + parsed.hostname,
              taskType: "analyze_url",
              payload: { url: parsed.toString() },
              status: "queued" as TaskStatus,
              updated: now(),
              history: [{ at: now(), note: "Created read-only public URL analysis task." }],
            }, ...st.tasks],
          }), "Created public URL analysis task");
          setUrlToAnalyze("");
        }}>
          <input className="field flex-1" type="url" inputMode="url" placeholder="https://example.com/article" value={urlToAnalyze} onChange={(event) => setUrlToAnalyze(event.target.value)} maxLength={2048} required />
          <button className="btn btn-primary" type="submit" disabled={!urlToAnalyze.trim()}>Add URL task</button>
        </form>
      </section>
      <section className="card-surface p-4 mb-4 space-y-3">
        <div>
          <h2 className="font-semibold">Starter task prompts</h2>
          <p className="text-xs text-muted-foreground mt-1">Starter prompts are saved to your Supabase workspace as queued items. Select one and choose “Generate plan securely” to create and save a plan; no external action is performed.</p>
        </div>
        <ul className="space-y-2">
          {starterPrompts.map((item) => {
            const alreadySaved = s.tasks.some((task) => task.title === item.title);
            return (
              <li key={item.title} className="rounded-md border p-3">
                <button type="button" className="w-full text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => {
                  if (alreadySaved) { setTitle(item.title); return; }
                  set((st) => ({ ...st, tasks: [{ id: uid(), title: item.title, taskType: "generate_plan", payload: { request: item.prompt }, status: "queued" as TaskStatus, updated: now(), history: [{ at: now(), note: `Saved prompt: ${item.prompt}` }] }, ...st.tasks] }), `Saved starter prompt: ${item.title}`);
                }} aria-label={`Add starter task: ${item.title}`}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.prompt}</p>
                  <p className="text-xs text-primary mt-2">{alreadySaved ? "Already in inbox" : "Tap to add this full prompt to the inbox"}</p>
                </button>
              </li>
            );
          })}
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
                  taskType: "generate_plan",
                  payload: { request: item.prompt },
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
        set((st) => ({ ...st, tasks: [{ id: uid(), title: title.trim(), taskType: "generate_plan", payload: { request: title.trim() }, status: "queued", updated: now(), history: [{ at: now(), note: "Task created" }] }, ...st.tasks] }), `Created task "${title.trim()}"`); setTitle(""); }}>
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
                {runnerError && <p className="text-sm text-destructive" role="alert">{runnerError}</p>}
                {isGeneratedPlan(t.result) && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium">Generated AI plan</p>
                    <p className="text-xs text-muted-foreground">{t.result.summary}</p>
                    <ol className="list-decimal pl-5 space-y-2">
                      {t.result.steps.map((step, i) => (
                        <li key={i} className="space-y-1">
                          <p className="text-sm">{step.title}</p>
                          <p className="text-xs text-muted-foreground">{step.priority} priority · {step.risk} risk — {step.rationale}</p>
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-muted-foreground">Plan generation only; no external action was executed.</p>
                  </div>
                )}
                {isUrlAnalysisResult(t.result) && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm font-medium">{t.result.title}</p>
                    <p className="text-xs text-muted-foreground break-all">{t.result.url}</p>
                    <p className="text-sm">{t.result.summary}</p>
                    {t.result.key_points.length > 0 && (
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {t.result.key_points.map((point, index) => <li key={index}>{point}</li>)}
                      </ul>
                    )}
                    {t.result.limitations.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium">Access limitations</p>
                        <ul className="list-disc pl-5">{t.result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Read-only analysis; the page was not changed.</p>
                  </div>
                )}
                <ol className="space-y-1.5 text-sm">
                  {t.history.map((h, i) => <li key={h.id ?? i} className="flex gap-2"><span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{timeAgo(h.at)}</span>{h.note}</li>)}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {t.status === "queued" && <button className="btn btn-primary" disabled={runnerBusy !== null} onClick={() => void runTask(t.id)}>{runnerBusy === t.id ? (t.taskType === "analyze_url" ? "Analyzing URL…" : "Generating plan…") : (t.taskType === "analyze_url" ? "Analyze URL securely" : "Generate plan securely")}</button>}
                  {t.status === "running" && <button className="btn btn-ghost" onClick={() => setStatus(t.id, "paused", "Paused by Hasib")}>Pause</button>}
                  {["paused", "blocked", "failed"].includes(t.status) && <button className="btn btn-primary" onClick={() => setStatus(t.id, "queued", "Requeued by Hasib; generate and save a new AI plan when ready")}>Requeue</button>}
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