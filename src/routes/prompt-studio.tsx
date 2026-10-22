import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookmarkPlus, Check, Copy, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/lib/store";

export const Route = createFileRoute("/prompt-studio")({
  head: () => ({
    meta: [
      { title: "Prompt Studio · Hasib AI Agent" },
      { name: "description", content: "Create, search, save and reuse AI prompt templates." },
    ],
  }),
  component: PromptStudio,
});

type PromptCategory = "Coding" | "Research" | "Planning" | "Writing";
type Prompt = {
  id: string;
  title: string;
  category: PromptCategory;
  description: string;
  body: string;
  custom?: boolean;
};

const STORAGE_KEY = "hasib-ai-agent.prompt-studio.v1";
const categories: Array<PromptCategory | "All"> = ["All", "Coding", "Research", "Planning", "Writing"];
const starterPrompts: Prompt[] = [
  { id: "debug", title: "Debug a difficult issue", category: "Coding", description: "Trace a bug systematically without guessing.", body: "Act as a senior engineer. Diagnose this issue systematically. First list the most likely causes, then identify the evidence needed to distinguish them. Propose the smallest safe fix, explain edge cases, and provide focused tests. Do not claim anything was tested unless it was actually run.\n\nContext / error:\n[Paste details here]" },
  { id: "review", title: "Review code for production", category: "Coding", description: "Find correctness, security and maintainability risks.", body: "Review the following code as a production code reviewer. Prioritize bugs, security risks, data loss, race conditions, accessibility and performance. For each finding, include severity, exact location, impact and a concrete fix. Separate confirmed issues from hypotheses.\n\nCode / diff:\n[Paste code here]" },
  { id: "feature", title: "Implement a feature in phases", category: "Coding", description: "Turn a feature request into a shippable implementation.", body: "Act as a staff engineer. Inspect the existing architecture before changing it. Implement this feature in one coherent phase: update the relevant UI and logic, preserve existing behavior, add focused tests, and run the available validation commands. Do not refactor unrelated areas. Report changed files, test results, and anything still blocked.\n\nFeature request:\n[Describe feature]" },
  { id: "research", title: "Evidence-based research brief", category: "Research", description: "Compare options using reliable, current evidence.", body: "Research the question below using primary and authoritative sources first. Compare the strongest options, distinguish facts from interpretation, note important uncertainty, and cite each material claim. Include publication dates for time-sensitive information. End with a concise recommendation and the evidence that would change it.\n\nQuestion:\n[Enter question]" },
  { id: "architecture", title: "Architecture decision record", category: "Planning", description: "Make trade-offs explicit before choosing a design.", body: "Help me make an architecture decision. Define the problem and constraints, compare at least three viable options, and evaluate complexity, reliability, security, cost, scalability and reversibility. Recommend one option, state the trade-offs, and provide a migration plan with measurable acceptance criteria.\n\nContext and constraints:\n[Add context]" },
  { id: "roadmap", title: "Turn an idea into a roadmap", category: "Planning", description: "Break a broad goal into meaningful delivery phases.", body: "Convert this goal into a practical product roadmap. Group work into large, coherent phases with dependencies, deliverables, acceptance criteria and risks. Prioritize user-visible value. Avoid repeating completed work; use existing evidence and resume from the last verified checkpoint. Mark any step that needs credentials or explicit approval.\n\nGoal:\n[Describe outcome]" },
  { id: "writing", title: "Rewrite for clarity", category: "Writing", description: "Improve structure without changing the meaning.", body: "Rewrite the text below for clarity, natural flow and precision. Preserve the original meaning and all factual details. Remove repetition, use concrete language, and match the intended audience. If a statement is ambiguous, flag it rather than inventing details.\n\nAudience and tone:\n[Specify]\n\nText:\n[Paste text]" },
  { id: "spec", title: "Create an acceptance-ready spec", category: "Planning", description: "Define behavior, edge cases and completion criteria.", body: "Write a concise implementation-ready specification. Include user problem, intended behavior, user flows, loading/empty/error states, accessibility, security/privacy considerations, edge cases, analytics if relevant, and testable acceptance criteria. Separate requirements from optional enhancements.\n\nIdea:\n[Describe feature]" },
];

function PromptStudio() {
  const [customPrompts, setCustomPrompts] = useState<Prompt[]>([]);\n  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PromptCategory | "All">("All");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [newCategory, setNewCategory] = useState<PromptCategory>("Coding");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomPrompts(parsed.filter((item): item is Prompt =>
            typeof item?.id === "string" && typeof item?.title === "string" &&
            typeof item?.body === "string" && typeof item?.description === "string" &&
            ["Coding", "Research", "Planning", "Writing"].includes(item?.category) && item?.custom === true
          ));
        }
      }
    } catch {
      setNotice("Saved prompts could not be loaded. You can still use the built-in templates.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customPrompts));
    } catch {
      setNotice("Browser storage is unavailable; custom prompts may not persist after leaving this page.");
    }
  }, [customPrompts, hydrated]);

  const allPrompts = useMemo(() => [...starterPrompts, ...customPrompts], [customPrompts]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return allPrompts.filter((prompt) =>
      (category === "All" || prompt.category === category) &&
      (!needle || [prompt.title, prompt.description, prompt.body, prompt.category].some((value) => value.toLocaleLowerCase().includes(needle)))
    );
  }, [allPrompts, category, query]);

  async function copyPrompt(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.body);
      setNotice(`Copied “${prompt.title}” to clipboard.`);
    } catch {
      setNotice("Clipboard access was blocked by the browser. Open the prompt and copy its text manually.");
    }
  }

  function savePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;
    setCustomPrompts((current) => [{
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: cleanTitle,
      category: newCategory,
      description: description.trim() || "Custom prompt saved in this browser.",
      body: cleanBody,
      custom: true,
    }, ...current]);
    setTitle("");
    setDescription("");
    setBody("");
    setShowForm(false);
    setCategory("All");
    setNotice("Your prompt has been saved in this browser.");
  }

  return (
    <>
      <PageHeader title="Prompt Studio" sub="A reusable workspace for high-quality prompts. Search templates, copy them into a chat, or save your own." />
      <section className="card-surface mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Build once. Reuse whenever you need.</h2>
            <p className="mt-1 text-sm text-muted-foreground">{starterPrompts.length} ready-made templates · {customPrompts.length} saved by you · custom prompts stay in this browser.</p>
          </div>
          <button type="button" className="btn btn-primary shrink-0" onClick={() => setShowForm((open) => !open)}>
            <BookmarkPlus className="mr-1.5 inline h-4 w-4" aria-hidden="true" /> Add prompt
          </button>
        </div>
      </section>

      {showForm && (
        <form className="card-surface mb-4 space-y-3 p-4 sm:p-5" onSubmit={savePrompt}>
          <h2 className="font-semibold">Save a custom prompt</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">Title
              <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required placeholder="e.g. API design reviewer" />
            </label>
            <label className="block text-sm">Category
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={newCategory} onChange={(event) => setNewCategory(event.target.value as PromptCategory)}>
                {categories.filter((item): item is PromptCategory => item !== "All").map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">Short description
            <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} placeholder="What is this prompt useful for?" />
          </label>
          <label className="block text-sm">Prompt text
            <textarea className="mt-1 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" value={body} onChange={(event) => setBody(event.target.value)} maxLength={12000} required placeholder="Write instructions you want to reuse…" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">Save prompt</button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompts, topics or text…" aria-label="Search prompts" />
        </label>
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by category">
          {categories.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-md border px-3 py-2 text-sm transition-colors ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-secondary"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {notice && <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-input p-3 text-sm" role="status"><span>{notice}</span><button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setNotice("")} aria-label="Dismiss notice">Dismiss</button></div>}

      {filtered.length === 0 ? (
        <div className="card-surface p-8 text-center">
          <p className="font-medium">No matching prompts</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another search or create a custom prompt.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((prompt) => (
            <article key={prompt.id} className="card-surface flex min-w-0 flex-col p-4">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 font-semibold">{prompt.title}</h2>
                <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">{prompt.category}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{prompt.description}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-primary">Preview prompt</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-secondary/60 p-3 text-xs leading-relaxed">{prompt.body}</pre>
              </details>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <button type="button" className="btn btn-primary flex-1" onClick={() => void copyPrompt(prompt)}><Copy className="mr-1.5 inline h-4 w-4" aria-hidden="true" /> Copy prompt</button>
                {prompt.custom && <button type="button" className="btn btn-ghost" aria-label={`Delete ${prompt.title}`} onClick={() => { setCustomPrompts((current) => current.filter((item) => item.id !== prompt.id)); setNotice("Custom prompt deleted."); }}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Built-in templates are read-only. Your custom prompts are stored locally and are not synced to other devices.</p>
    </>
  );
}
