import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Pause, Play, RotateCcw, Target } from "lucide-react";
import { PageHeader, useStore, type TaskStatus } from "@/lib/store";

export const Route = createFileRoute("/focus")({ component: FocusPage });

const DURATIONS = [
  { label: "Focus", minutes: 25, description: "A focused work session" },
  { label: "Short break", minutes: 5, description: "Rest your mind" },
  { label: "Long break", minutes: 15, description: "Recharge between sessions" },
] as const;

const STORAGE_KEY = "hasib-focus-sessions-v1";

function readCompletedSessions() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function FocusPage() {
  const { s, set, confirm, now } = useStore();
  const [mode, setMode] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const openTasks = useMemo(
    () => s.tasks.filter((task) => ["queued", "running", "paused", "blocked"].includes(task.status)),
    [s.tasks],
  );
  const selectedTask = openTasks.find((task) => task.id === selectedTaskId);

  useEffect(() => {
    setCompletedSessions(readCompletedSessions());
  }, []);

  useEffect(() => {
    if (!running || deadline === null) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        setDeadline(null);
        if (mode === 25) {
          setCompletedSessions((current) => {
            const updated = current + 1;
            try {
              window.localStorage.setItem(STORAGE_KEY, String(updated));
            } catch {
              // Session tracking remains available for this page even if storage is disabled.
            }
            return updated;
          });
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, deadline, mode]);

  function chooseMode(minutes: number) {
    setRunning(false);
    setDeadline(null);
    setMode(minutes);
    setRemaining(minutes * 60);
  }

  function startOrPause() {
    if (running) {
      setRunning(false);
      setDeadline(null);
      return;
    }
    setDeadline(Date.now() + remaining * 1000);
    setRunning(true);
  }

  function resetTimer() {
    setRunning(false);
    setDeadline(null);
    setRemaining(mode * 60);
  }

  async function markTaskDone() {
    if (!selectedTask) return;
    const approved = await confirm(
      "Mark task as complete?",
      `This will mark “${selectedTask.title}” as done in your cloud workspace.`,
    );
    if (!approved) return;
    set((state) => ({
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === selectedTask.id
          ? { ...task, status: "done" as TaskStatus, updated: now(), history: [...task.history, { at: now(), note: "Marked complete from Focus Mode." }] }
          : task,
      ),
    }), `Completed task from Focus Mode: ${selectedTask.title}`);
    setSelectedTaskId("");
  }

  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  const progress = Math.min(100, Math.max(0, ((mode * 60 - remaining) / (mode * 60)) * 100));

  return (
    <>
      <PageHeader title="Focus Mode" sub="A simple focus timer connected to your real task inbox. Your sessions are tracked on this device." />

      <section className="card-surface p-4 sm:p-6 mb-5 space-y-5" aria-labelledby="focus-timer-heading">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Timer mode">
          {DURATIONS.map((item) => (
            <button
              key={item.minutes}
              type="button"
              onClick={() => chooseMode(item.minutes)}
              aria-pressed={mode === item.minutes}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${mode === item.minutes ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary"}`}
            >
              {item.label} · {item.minutes} min
            </button>
          ))}
        </div>

        <div className="text-center py-3">
          <Clock3 className="h-6 w-6 text-primary mx-auto mb-3" aria-hidden="true" />
          <h2 id="focus-timer-heading" className="text-6xl sm:text-7xl font-semibold font-display tabular-nums tracking-tight" aria-live="off">
            {minutes}:{seconds}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {running ? "Timer running — stay with one task." : DURATIONS.find((item) => item.minutes === mode)?.description}
          </p>
          <div className="mt-5 h-2 max-w-md mx-auto rounded-full bg-secondary overflow-hidden" role="progressbar" aria-label="Timer progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <button type="button" onClick={startOrPause} className="btn btn-primary min-w-28">
            {running ? <><Pause className="h-4 w-4 inline mr-2" />Pause</> : <><Play className="h-4 w-4 inline mr-2" />Start</>}
          </button>
          <button type="button" onClick={resetTimer} className="btn btn-ghost">
            <RotateCcw className="h-4 w-4 inline mr-2" />Reset
          </button>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <section className="card-surface p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Completed focus sessions</div>
          <div className="text-3xl font-semibold mt-2">{completedSessions}</div>
          <p className="text-xs text-muted-foreground mt-1">25-minute focus sessions completed on this device.</p>
        </section>
        <section className="card-surface p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4 text-primary" />Open tasks</div>
          <div className="text-3xl font-semibold mt-2">{openTasks.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Live count from your cloud-synced task inbox.</p>
        </section>
      </div>

      <section className="card-surface p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Focus on a task</h2>
          <p className="text-xs text-muted-foreground mt-1">Choose a real task to keep it in view. Mark it complete only when you are ready.</p>
        </div>
        {openTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground border-t pt-3">No open tasks yet. Add a task from the Tasks page, then return here to focus on it.</p>
        ) : (
          <>
            <label htmlFor="focus-task" className="text-sm font-medium">Selected task</label>
            <select id="focus-task" className="field" value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)}>
              <option value="">Choose a task…</option>
              {openTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            {selectedTask && (
              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium break-words">{selectedTask.title}</div>
                <div className="text-xs text-muted-foreground">Status: {selectedTask.status}</div>
                <button type="button" className="btn btn-ghost" onClick={() => void markTaskDone()}>Mark task complete</button>
              </div>
            )}
          </>
        )}
      </section>
      <p className="text-xs text-muted-foreground mt-4">Focus-session counts are stored locally in this browser/device; task status changes are saved to your cloud workspace. No task is automatically executed when the timer ends.</p>
    </>
  );
}
