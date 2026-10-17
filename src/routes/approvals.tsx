import { createFileRoute } from "@tanstack/react-router";
import { useStore, timeAgo, Demo, PageHeader, type Approval } from "@/lib/store";

export const Route = createFileRoute("/approvals")({
  head: () => ({ meta: [
    { title: "Approvals · Hasib AI Agent" },
    { name: "description", content: "Approve or reject sensitive agent actions." },
    { property: "og:title", content: "Approvals · Hasib AI Agent" },
    { property: "og:description", content: "Approve or reject sensitive agent actions." },
  ] }),
  component: Approvals,
});

const labels: Record<Approval["category"], string> = { publish: "Publishing", delete: "Deleting data", spend: "Spending money", security: "Security change", message: "External message" };

function Approvals() {
  const { s, set, confirm } = useStore();
  const decide = async (a: Approval, status: "approved" | "rejected") => {
    if (status === "approved" && !(await confirm(`Approve: ${a.action}?`, `${labels[a.category]} — ${a.detail} Nothing will actually run until the related integration is connected.`, a.category !== "message")))
      return;
    set((st) => ({ ...st, approvals: st.approvals.map((x) => x.id === a.id ? { ...x, status } : x) }), `${status === "approved" ? "Approved" : "Rejected"}: ${a.action}`);
  };
  const pending = s.approvals.filter((a) => a.status === "pending");
  const done = s.approvals.filter((a) => a.status !== "pending");
  return (
    <>
      <PageHeader title="Approval queue" sub="Publishing, deleting, spending, security changes and external messages always need your explicit confirmation." />
      <div className="space-y-2 mb-8">
        {pending.map((a) => (
          <div key={a.id} className="card-surface p-4">
            <div className="flex items-center gap-2 text-xs"><span className="rounded bg-warning/15 text-warning px-2 py-0.5">{labels[a.category]}</span><Demo show={a.demo} /><span className="ml-auto text-muted-foreground">{timeAgo(a.requested)}</span></div>
            <div className="font-medium mt-2">{a.action}</div>
            <p className="text-sm text-muted-foreground">{a.detail}</p>
            <div className="flex gap-2 mt-3"><button className="btn btn-ghost flex-1" onClick={() => decide(a, "rejected")}>Reject</button><button className="btn btn-primary flex-1" onClick={() => decide(a, "approved")}>Approve…</button></div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Queue is clear.</p>}
      </div>
      <h2 className="font-semibold mb-2">Decided</h2>
      <div className="space-y-1">
        {done.map((a) => <div key={a.id} className="flex text-sm py-2 border-b gap-2"><span className="flex-1">{a.action} <Demo show={a.demo} /></span><span className={a.status === "approved" ? "text-success" : "text-destructive"}>{a.status}</span></div>)}
      </div>
    </>
  );
}