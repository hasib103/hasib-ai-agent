import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore, timeAgo, Demo, PageHeader } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Hasib AI Agent" },
      { name: "description", content: "Personal AI agent control panel: tasks, approvals, memory and integrations." },
      { property: "og:title", content: "Hasib AI Agent" },
      { property: "og:description", content: "Personal AI agent control panel." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { s } = useStore();
  const pending = s.approvals.filter((a) => a.status === "pending");
  const active = s.tasks.filter((t) => ["running", "paused", "blocked", "queued"].includes(t.status));
  const stats = [
    { label: "Active tasks", value: active.length, to: "/tasks" },
    { label: "Pending approvals", value: pending.length, to: "/approvals" },
    { label: "Memory notes", value: s.notes.length, to: "/memory" },
    { label: "Integrations connected", value: "0 / 6", to: "/integrations" },
  ] as const;
  return (
    <>
      <PageHeader title={`Good to see you, Hasib`} sub="Independent starter dashboard while repository access is resolved." />
      <div className="card-surface p-4 mb-5 border-warning/40 text-sm">
        <span className="demo-tag mr-2">DEMO</span>
        Seeded demo data is shown. No external services are connected; data is stored only in this browser.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((x) => (
          <Link key={x.label} to={x.to} className="card-surface p-4 hover:border-primary/60 transition-colors">
            <div className="text-2xl font-display font-semibold text-primary">{x.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{x.label}</div>
          </Link>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="card-surface p-4">
          <h2 className="font-semibold mb-3">Needs your approval</h2>
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : pending.slice(0, 3).map((a) => (
            <Link key={a.id} to="/approvals" className="block py-2 border-t first:border-t-0 text-sm">
              {a.action} <Demo show={a.demo} /><div className="text-xs text-muted-foreground">{timeAgo(a.requested)}</div>
            </Link>
          ))}
        </section>
        <section className="card-surface p-4">
          <h2 className="font-semibold mb-3">Recent activity</h2>
          {s.log.slice(0, 4).map((l) => (
            <div key={l.id} className="py-2 border-t first:border-t-0 text-sm">
              {l.event} <Demo show={l.demo} /><div className="text-xs text-muted-foreground">{l.actor} · {timeAgo(l.at)}</div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}