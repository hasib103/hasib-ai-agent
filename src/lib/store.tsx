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
  // Start with genuinely empty user data; never present fabricated tasks or approvals as real.
  tasks: [] as Task[],
  notes: [] as Note[],
  approvals: [] as Approval[],
  log: [] as LogEntry[],
  prefs: { approvals: true, taskDone: true, taskFailed: true, dailyDigest: false, quietHours: true } as Prefs,
  settings: { agentName: "Hasib AI Agent", requireConfirm: true, autoResume: false, timezone: "Asia/Dhaka" } as Settings,
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