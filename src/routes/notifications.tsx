import { createFileRoute } from "@tanstack/react-router";
import { useStore, PageHeader, type Prefs } from "@/lib/store";
import { Toggle } from "@/components/Toggle";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [
    { title: "Notifications · Hasib AI Agent" },
    { name: "description", content: "Choose which agent events notify you." },
    { property: "og:title", content: "Notifications · Hasib AI Agent" },
    { property: "og:description", content: "Choose which agent events notify you." },
  ] }),
  component: Notifications,
});

const rows: { k: keyof Prefs; label: string; sub: string }[] = [
  { k: "approvals", label: "Approval requests", sub: "When the agent needs your confirmation" },
  { k: "taskDone", label: "Task completed", sub: "When a task finishes" },
  { k: "taskFailed", label: "Task failed or blocked", sub: "When a task needs attention" },
  { k: "dailyDigest", label: "Daily digest", sub: "One summary per day" },
  { k: "quietHours", label: "Quiet hours (22:00–07:00)", sub: "Hold non-urgent alerts overnight" },
];

function Notifications() {
  const { s, set } = useStore();
  return (
    <>
      <PageHeader title="Notification preferences" sub="In-app only for now. Push and email delivery are not connected." />
      <div className="card-surface divide-y">
        {rows.map((r) => (
          <Toggle key={r.k} label={r.label} sub={r.sub} on={s.prefs[r.k]}
            onChange={(v) => set((st) => ({ ...st, prefs: { ...st.prefs, [r.k]: v } }), `Notification "${r.label}" ${v ? "on" : "off"}`)} />
        ))}
      </div>
    </>
  );
}