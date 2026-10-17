import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, Demo, PageHeader } from "@/lib/store";

export const Route = createFileRoute("/activity")({
  head: () => ({ meta: [
    { title: "Activity log · Hasib AI Agent" },
    { name: "description", content: "Audit trail of agent and user actions." },
    { property: "og:title", content: "Activity log · Hasib AI Agent" },
    { property: "og:description", content: "Audit trail of agent and user actions." },
  ] }),
  component: Activity,
});

function Activity() {
  const { s } = useStore();
  const [q, setQ] = useState("");
  const list = s.log.filter((l) => (l.event + l.actor).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Activity & audit log" sub="Append-only record of actions in this panel." />
      <input className="field mb-4" placeholder="Filter log…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card-surface divide-y">
        {list.map((l) => (
          <div key={l.id} className="p-3 text-sm flex gap-3">
            <span className="font-mono text-xs text-muted-foreground w-32 shrink-0">{new Date(l.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="flex-1">{l.event} <Demo show={l.demo} /></span>
            <span className="text-xs text-primary">{l.actor}</span>
          </div>
        ))}
      </div>
    </>
  );
}