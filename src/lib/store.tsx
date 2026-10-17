import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type TaskStatus = "queued" | "running" | "paused" | "blocked" | "done" | "failed";
export type Task = { id: string; title: string; status: TaskStatus; updated: string; history: { at: string; note: string }[]; demo?: boolean };
export type Note = { id: string; title: string; body: string; tags: string[]; updated: string; demo?: boolean };
export type Approval = { id: string; action: string; category: "publish" | "delete" | "spend" | "security" | "message"; detail: string; requested: string; status: "pending" | "approved" | "rejected"; demo?: boolean };
export type LogEntry = { id: string; at: string; actor: string; event: string; demo?: boolean };
export type Prefs = { approvals: boolean; taskDone: boolean; taskFailed: boolean; dailyDigest: boolean; quietHours: boolean };
export type Settings = { agentName: string; requireConfirm: boolean; autoResume: boolean; timezone: string };

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();

const seed = {
  tasks: [
    { id: "t1", title: "Audit repository structure for agent runtime", status: "running", updated: ago(12), demo: true, history: [{ at: ago(90), note: "Task created" }, { at: ago(60), note: "Listed top-level folders" }, { at: ago(12), note: "Drafting module map" }] },
    { id: "t2", title: "Draft deployment checklist for Vercel", status: "paused", updated: ago(180), demo: true, history: [{ at: ago(300), note: "Task created" }, { at: ago(180), note: "Paused: waiting on Vercel access" }] },
    { id: "t3", title: "Summarize Supabase schema options", status: "done", updated: ago(1440), demo: true, history: [{ at: ago(1600), note: "Task created" }, { at: ago(1440), note: "Completed summary" }] },
    { id: "t4", title: "Prepare Runway video prompt set", status: "blocked", updated: ago(400), demo: true, history: [{ at: ago(500), note: "Task created" }, { at: ago(400), note: "Blocked: Runway not connected" }] },
    { id: "t5", title: "Review Render service config", status: "queued", updated: ago(30), demo: true, history: [{ at: ago(30), note: "Task created" }] },
  ] as Task[],
  notes: [
    { id: "n1", title: "Project goal", body: "Independent starter dashboard to organize the agent project while repository access is resolved.", tags: ["project"], updated: ago(2000), demo: true },
    { id: "n2", title: "Security rules", body: "Secrets stay server-side. Never paste keys into chat. Sensitive actions need explicit approval.", tags: ["security"], updated: ago(900), demo: true },
    { id: "n3", title: "Preferred stack", body: "TypeScript, React, server functions. Deploy targets under evaluation: Vercel, Render.", tags: ["tech"], updated: ago(300), demo: true },
  ] as Note[],
  approvals: [
    { id: "a1", action: "Publish preview build", category: "publish", detail: "Deploy current branch to production domain.", requested: ago(20), status: "pending", demo: true },
    { id: "a2", action: "Delete stale memory notes", category: "delete", detail: "Remove 4 notes older than 90 days.", requested: ago(75), status: "pending", demo: true },
    { id: "a3", action: "Purchase 1,000 Runway credits", category: "spend", detail: "Estimated cost: $12.00", requested: ago(200), status: "pending", demo: true },
    { id: "a4", action: "Send status email via Inkbox", category: "message", detail: "To: team@example.com", requested: ago(400), status: "rejected", demo: true },
  ] as Approval[],
  log: [
    { id: "l1", at: ago(12), actor: "agent", event: "Task t1 progress: drafting module map", demo: true },
    { id: "l2", at: ago(20), actor: "agent", event: "Requested approval: Publish preview build", demo: true },
    { id: "l3", at: ago(180), actor: "agent", event: "Paused task t2 (missing Vercel access)", demo: true },
    { id: "l4", at: ago(400), actor: "Hasib", event: "Rejected: Send status email via Inkbox", demo: true },
  ] as LogEntry[],
  prefs: { approvals: true, taskDone: true, taskFailed: true, dailyDigest: false, quietHours: true } as Prefs,
  settings: { agentName: "Hasib AI Agent", requireConfirm: true, autoResume: false, timezone: "UTC" } as Settings,
};
type State = typeof seed;
const KEY = "hasib-agent-v1";

type Pending = { title: string; body: string; danger?: boolean | undefined; resolve: (ok: boolean) => void } | null;

const Ctx = createContext<{
  s: State;
  set: (fn: (s: State) => State, logEvent?: string) => void;
  confirm: (title: string, body: string, danger?: boolean) => Promise<boolean>;
  uid: () => string;
  now: () => string;
  reset: () => void;
} | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(seed);
  const loaded = useRef(false);
  const [pending, setPending] = useState<Pending>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...seed, ...JSON.parse(raw) }); } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);

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
    <Ctx.Provider value={{ s, set, confirm, uid, now, reset: () => setS(seed) }}>
      {children}
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