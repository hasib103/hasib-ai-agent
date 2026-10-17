import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, timeAgo, Demo, PageHeader, type Note } from "@/lib/store";

export const Route = createFileRoute("/memory")({
  head: () => ({ meta: [
    { title: "Memory · Hasib AI Agent" },
    { name: "description", content: "Persistent memory notes for your agent." },
    { property: "og:title", content: "Memory · Hasib AI Agent" },
    { property: "og:description", content: "Persistent memory notes for your agent." },
  ] }),
  component: Memory,
});

function Memory() {
  const { s, set, uid, now, confirm } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Note | null>(null);
  const ql = q.toLowerCase();
  const list = s.notes.filter((n) => [n.title, n.body, ...n.tags].join(" ").toLowerCase().includes(ql));

  const save = () => {
    if (!edit || !edit.title.trim()) return;
    const exists = s.notes.some((n) => n.id === edit.id);
    const note = { ...edit, updated: now(), demo: false };
    set((st) => ({ ...st, notes: exists ? st.notes.map((n) => n.id === note.id ? note : n) : [note, ...st.notes] }), `${exists ? "Edited" : "Added"} memory note "${note.title}"`);
    setEdit(null);
  };

  return (
    <>
      <PageHeader title="Memory" sub="Notes the agent can refer to. Saved in this browser. Never store secrets here." />
      <div className="flex gap-2 mb-4">
        <input className="field" placeholder="Search notes and tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setEdit({ id: uid(), title: "", body: "", tags: [], updated: now() })}>New</button>
      </div>
      {edit && (
        <div className="card-surface p-4 mb-4 space-y-2">
          <input className="field" placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <textarea className="field min-h-28" placeholder="Note" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <input className="field" placeholder="Tags, comma separated" value={edit.tags.join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {list.map((n) => (
          <div key={n.id} className="card-surface p-4 flex flex-col">
            <div className="font-medium">{n.title} <Demo show={n.demo} /></div>
            <p className="text-sm text-muted-foreground mt-1 flex-1 whitespace-pre-wrap">{n.body}</p>
            <div className="flex flex-wrap gap-1 mt-2">{n.tags.map((t) => <span key={t} className="text-xs rounded bg-accent text-accent-foreground px-1.5">#{t}</span>)}</div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span className="flex-1">{timeAgo(n.updated)}</span>
              <button className="btn btn-ghost !py-1" onClick={() => setEdit(n)}>Edit</button>
              <button className="btn btn-ghost !py-1" onClick={async () => {
                if (await confirm("Delete note?", `"${n.title}" will be permanently removed.`, true))
                  set((st) => ({ ...st, notes: st.notes.filter((x) => x.id !== n.id) }), `Deleted memory note "${n.title}"`);
              }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No matching notes.</p>}
    </>
  );
}