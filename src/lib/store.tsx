import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/integrations/supabase/types";

export type TaskStatus = "queued" | "running" | "paused" | "blocked" | "done" | "failed";
export type TaskPayload = { request?: string; url?: string; title?: string; body?: string; tags?: string[] };
export type Task = { id: string; title: string; status: TaskStatus; updated: string; history: { id?: string; at: string; note: string }[]; taskType?: "generate_plan" | "create_memory_note" | "analyze_url"; payload?: TaskPayload; result?: Json | null; demo?: boolean };
export type Note = { id: string; title: string; body: string; tags: string[]; updated: string; demo?: boolean };
export type Approval = { id: string; action: string; category: "publish" | "delete" | "spend" | "security" | "message"; detail: string; requested: string; status: "pending" | "approved" | "rejected"; demo?: boolean };
export type LogEntry = { id: string; at: string; actor: string; event: string; demo?: boolean };
export type Prefs = { approvals: boolean; taskDone: boolean; taskFailed: boolean; dailyDigest: boolean; quietHours: boolean };
export type Settings = { agentName: string; requireConfirm: boolean; autoResume: boolean; timezone: string };

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const seed = {
  // Start with genuinely empty user data; never present fabricated tasks or approvals as real.
  tasks: [] as Task[],
  notes: [] as Note[],
  approvals: [] as Approval[],
  log: [] as LogEntry[],
  prefs: { approvals: true, taskDone: true, taskFailed: true, dailyDigest: false, quietHours: true } as Prefs,
  settings: { agentName: "Hasib AI Agent", requireConfirm: true, autoResume: false, timezone: "Asia/Dhaka" } as Settings,
};
type State = typeof seed;
function stableHistoryId(taskId: string, index: number) {
  const tail = index.toString(16).padStart(12, "0").slice(-12);
  return taskId.slice(0, 24) + tail;
}

type Pending = { title: string; body: string; danger?: boolean | undefined; resolve: (ok: boolean) => void } | null;

const Ctx = createContext<{
  s: State;
  set: (fn: (s: State) => State, logEvent?: string) => void;
  confirm: (title: string, body: string, danger?: boolean) => Promise<boolean>;
  uid: () => string;
  now: () => string;
  reset: () => void;
  syncStatus: "loading" | "saving" | "synced" | "error";
} | null>(null);

export function StoreProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [s, setS] = useState<State>(seed);
  const loaded = useRef(false);
  const previous = useRef<State>(seed);
  const [pending, setPending] = useState<Pending>(null);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "error">("loading");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);

  useEffect(() => {
    let alive = true;
    loaded.current = false;
    async function loadFromSupabase() {
      const [tasks, history, notes, approvals, log, settings, prefs] = await Promise.all([
        supabase.from("tasks").select("id,title,status,task_type,payload,result,updated_at").eq("user_id", userId),
        supabase.from("task_history").select("id,task_id,at,note").eq("user_id", userId).order("at", { ascending: true }),
        supabase.from("memory_notes").select("id,title,body,tags,updated_at").eq("user_id", userId),
        supabase.from("approvals").select("id,action,category,detail,requested_at,status").eq("user_id", userId),
        supabase.from("activity_log").select("id,at,actor,event").eq("user_id", userId).order("at", { ascending: false }),
        supabase.from("settings").select("agent_name,require_confirm,auto_resume,timezone").eq("user_id", userId).maybeSingle(),
        supabase.from("notification_preferences").select("approvals,task_done,task_failed,daily_digest,quiet_hours").eq("user_id", userId).maybeSingle(),
      ]);
      if (!alive) return;
      const firstError = [tasks, history, notes, approvals, log, settings, prefs].find((result) => result.error)?.error;
      if (firstError) console.error("Supabase workspace load failed:", firstError.message);
      const historyByTask = new Map<string, { at: string; note: string }[]>();
      for (const row of history.data ?? []) {
        const entries = historyByTask.get(row.task_id) ?? [];
        entries.push({ id: row.id, at: row.at, note: row.note });
        historyByTask.set(row.task_id, entries);
      }
      const next: State = {
        tasks: (tasks.data ?? []).map((row) => ({ id: row.id, title: row.title, status: row.status as TaskStatus, updated: row.updated_at, taskType: row.task_type as Task["taskType"], payload: (row.payload as TaskPayload | null) ?? {}, result: row.result, history: historyByTask.get(row.id) ?? [] })),
        notes: (notes.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, tags: row.tags ?? [], updated: row.updated_at })),
        approvals: (approvals.data ?? []).map((row) => ({ id: row.id, action: row.action, category: row.category as Approval["category"], detail: row.detail, requested: row.requested_at, status: row.status as Approval["status"] })),
        log: (log.data ?? []).map((row) => ({ id: row.id, at: row.at, actor: row.actor, event: row.event })),
        settings: settings.data ? { agentName: settings.data.agent_name, requireConfirm: settings.data.require_confirm, autoResume: settings.data.auto_resume, timezone: settings.data.timezone } : seed.settings,
        prefs: prefs.data ? { approvals: prefs.data.approvals, taskDone: prefs.data.task_done, taskFailed: prefs.data.task_failed, dailyDigest: prefs.data.daily_digest, quietHours: prefs.data.quiet_hours } : seed.prefs,
      };
      previous.current = next;
      setS(next);
      setSyncStatus(firstError ? "error" : "synced");
      loaded.current = true;
    }
    void loadFromSupabase().catch((error: unknown) => {
      console.error("Supabase workspace load failed:", error instanceof Error ? error.message : "Unknown error");
      if (alive) { previous.current = seed; setS(seed); setSyncStatus("error"); loaded.current = true; }
    });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    if (!loaded.current) return;
    const before = previous.current;
    previous.current = s;
    const version = ++saveVersion.current;
    setSyncStatus("saving");
    const save = async () => {
      const removedTasks = before.tasks.filter((old) => !s.tasks.some((item) => item.id === old.id)).map((item) => item.id);
      const removedNotes = before.notes.filter((old) => !s.notes.some((item) => item.id === old.id)).map((item) => item.id);
      const removedApprovals = before.approvals.filter((old) => !s.approvals.some((item) => item.id === old.id)).map((item) => item.id);
      const removedLogs = before.log.filter((old) => !s.log.some((item) => item.id === old.id)).map((item) => item.id);
      const results = await Promise.all([
        ...(removedTasks.length ? [supabase.from("tasks").delete().eq("user_id", userId).in("id", removedTasks)] : []),
        ...(removedNotes.length ? [supabase.from("memory_notes").delete().eq("user_id", userId).in("id", removedNotes)] : []),
        ...(removedApprovals.length ? [supabase.from("approvals").delete().eq("user_id", userId).in("id", removedApprovals)] : []),
        ...(removedLogs.length ? [supabase.from("activity_log").delete().eq("user_id", userId).in("id", removedLogs)] : []),
        ...s.tasks.map((task) => supabase.from("tasks").upsert({ id: task.id, user_id: userId, title: task.title, status: task.status, task_type: task.taskType ?? "generate_plan", payload: task.payload ?? {}, result: task.result ?? null, updated_at: task.updated }, { onConflict: "id" })),
        ...s.tasks.flatMap((task) => task.history.map((entry, index) => supabase.from("task_history").upsert({ id: entry.id ?? stableHistoryId(task.id, index), task_id: task.id, user_id: userId, at: entry.at, note: entry.note }, { onConflict: "id", ignoreDuplicates: true }))),
        ...s.notes.map((note) => supabase.from("memory_notes").upsert({ id: note.id, user_id: userId, title: note.title, body: note.body, tags: note.tags, updated_at: note.updated }, { onConflict: "id" })),
        ...s.approvals.map((item) => supabase.from("approvals").upsert({ id: item.id, user_id: userId, action: item.action, category: item.category, detail: item.detail, requested_at: item.requested, status: item.status }, { onConflict: "id" })),
        ...s.log.map((entry) => supabase.from("activity_log").upsert({ id: entry.id, user_id: userId, at: entry.at, actor: entry.actor, event: entry.event }, { onConflict: "id", ignoreDuplicates: true })),
        supabase.from("settings").upsert({ user_id: userId, agent_name: s.settings.agentName, require_confirm: s.settings.requireConfirm, auto_resume: s.settings.autoResume, timezone: s.settings.timezone, updated_at: now() }, { onConflict: "user_id" }),
        supabase.from("notification_preferences").upsert({ user_id: userId, approvals: s.prefs.approvals, task_done: s.prefs.taskDone, task_failed: s.prefs.taskFailed, daily_digest: s.prefs.dailyDigest, quiet_hours: s.prefs.quietHours, updated_at: now() }, { onConflict: "user_id" }),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
    };
    saveQueue.current = saveQueue.current
      .then(save)
      .then(() => {
        if (version === saveVersion.current) setSyncStatus("synced");
      })
      .catch((error: unknown) => {
        console.error("Supabase workspace save failed:", error instanceof Error ? error.message : "Unknown error");
        if (version === saveVersion.current) setSyncStatus("error");
      });
  }, [s, userId]);

  const set = useCallback((fn: (s: State) => State, logEvent?: string) => {
    setS((prev) => {
      const next = fn(prev);
      return logEvent ? { ...next, log: [{ id: uid(), at: now(), actor: "Hasib", event: logEvent }, ...next.log] } : next;
    });
  }, []);
  const confirm = useCallback((title: string, body: string, danger?: boolean) =>
    new Promise<boolean>((resolve) => setPending({ title, body, danger, resolve })), []);
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null); };

  return (
    <Ctx.Provider value={{ s, set, confirm, uid, now, reset: () => setS(seed), syncStatus }}>
      {children}
      <div
        className="fixed bottom-3 right-3 z-40 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm"
        role="status"
        aria-live="polite"
      >
        {syncStatus === "loading" ? "Loading cloud data…" :
          syncStatus === "saving" ? "Saving to cloud…" :
          syncStatus === "synced" ? "Cloud synced" :
          "Cloud sync failed — changes may not be saved"}
      </div>
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="card-surface w-full max-w-md p-5 space-y-3">
            <h3 className="text-lg font-semibold">{pending.title}</h3>
            <p className="text-sm text-muted-foreground">{pending.body}</p>
            <p className="text-xs text-warning">Explicit confirmation required.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-ghost" onClick={() => close(false)}>Cancel</button>
              <button className={`btn ${pending.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

export function Demo({ show }: { show?: boolean | undefined }) {
  return show ? <span className="demo-tag">DEMO</span> : null;
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </header>
  );
}