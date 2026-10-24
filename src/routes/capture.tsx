import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardPlus, NotebookPen, Send } from "lucide-react";
import { PageHeader, useStore, type TaskStatus } from "@/lib/store";

export const Route = createFileRoute("/capture")({ component: QuickCapturePage });

type CaptureKind = "task" | "note";

function QuickCapturePage() {
  const { set, uid, now } = useStore();
  const [kind, setKind] = useState<CaptureKind>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;

    const id = uid();
    const createdAt = now();
    const tags = tagsText.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);

    set((state) => ({
      ...state,
      tasks: [{
        id,
        title: kind === "task" ? cleanTitle : `Save memory note: ${cleanTitle}`,
        status: "queued" as TaskStatus,
        taskType: kind === "task" ? "generate_plan" : "create_memory_note",
        payload: kind === "task"
          ? { request: `${cleanTitle}\n\nDetails: ${cleanBody}` }
          : { title: cleanTitle, body: cleanBody, tags },
        updated: createdAt,
        history: [{ at: createdAt, note: kind === "task" ? "Captured from Quick Capture; waiting for AI planning." : "Memory note creation queued from Quick Capture." }],
      }, ...state.tasks],
    }), kind === "task" ? `Quick Capture added task: ${cleanTitle}` : `Quick Capture queued memory note: ${cleanTitle}`);

    setMessage(kind === "task" ? "Task added to your inbox. Run it when you are ready." : "Memory note queued. It will appear in Memory after the task runner completes it.");
    setTitle("");
    setBody("");
    setTagsText("");
  }

  return (
    <>
      <PageHeader title="Quick Capture" sub="Capture an idea, task, or memory without losing your train of thought." />
      <section className="card-surface p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose what to capture">
          <button type="button" onClick={() => { setKind("task"); setMessage(""); }} aria-pressed={kind === "task"} className={`rounded-md border p-3 text-left ${kind === "task" ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}>
            <ClipboardPlus className="h-5 w-5 mb-2 text-primary" />
            <span className="block text-sm font-medium">Task / idea</span>
            <span className="block text-xs text-muted-foreground mt-1">Queue an AI-generated plan</span>
          </button>
          <button type="button" onClick={() => { setKind("note"); setMessage(""); }} aria-pressed={kind === "note"} className={`rounded-md border p-3 text-left ${kind === "note" ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}>
            <NotebookPen className="h-5 w-5 mb-2 text-primary" />
            <span className="block text-sm font-medium">Memory note</span>
            <span className="block text-xs text-muted-foreground mt-1">Queue a note for your memory</span>
          </button>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="capture-title">Title</label>
          <input id="capture-title" className="field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder={kind === "task" ? "What do you want to accomplish?" : "What should you remember?"} />
          <label className="block text-sm font-medium" htmlFor="capture-body">{kind === "task" ? "Details / desired outcome" : "Note content"}</label>
          <textarea id="capture-body" className="field min-h-32" value={body} onChange={(event) => setBody(event.target.value)} maxLength={kind === "task" ? 1800 : 10000} required placeholder={kind === "task" ? "Add context so the AI can create a useful plan…" : "Write the details you want to save…"} />
          {kind === "note" && (
            <>
              <label className="block text-sm font-medium" htmlFor="capture-tags">Tags (comma-separated, optional)</label>
              <input id="capture-tags" className="field" value={tagsText} onChange={(event) => setTagsText(event.target.value)} maxLength={400} placeholder="project, idea, important" />
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || !body.trim()}>
            <Send className="h-4 w-4 inline mr-2" />{kind === "task" ? "Add to task inbox" : "Queue memory note"}
          </button>
        </form>
        {message && <p className="text-sm text-success" role="status" aria-live="polite">{message}</p>}
      </section>
      <p className="text-xs text-muted-foreground mt-4">Quick Capture adds a queued task to your existing cloud workspace. It does not run AI or create a memory note automatically; execution remains under your control.</p>
    </>
  );
}
