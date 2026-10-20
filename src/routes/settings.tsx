import { createFileRoute } from "@tanstack/react-router";
import { useStore, PageHeader } from "@/lib/store";
import { Toggle } from "@/components/Toggle";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings · Hasib AI Agent" },
    { name: "description", content: "Agent and security settings." },
    { property: "og:title", content: "Settings · Hasib AI Agent" },
    { property: "og:description", content: "Agent and security settings." },
  ] }),
  component: Settings,
});

function Settings() {
  const { s, set, confirm, reset } = useStore();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="card-surface p-4 space-y-3 mb-4">
        <label className="block text-sm">Agent name<input className="field mt-1" value={s.settings.agentName} onChange={(e) => set((st) => ({ ...st, settings: { ...st.settings, agentName: e.target.value } }))} /></label>
        <label className="block text-sm">Timezone<input className="field mt-1" value={s.settings.timezone} onChange={(e) => set((st) => ({ ...st, settings: { ...st.settings, timezone: e.target.value } }))} /></label>
      </div>
      <h2 className="font-semibold mb-2">Security</h2>
      <div className="card-surface p-4 mb-4 border border-warning/30 space-y-1">
        <p className="text-sm font-medium">Account protection enabled</p>
        <p className="text-xs text-muted-foreground">The dashboard requires a Supabase account. Workspace records are scoped by user ID and protected by row-level security. Do not store API keys or provider secrets in notes.</p>
      </div>
      <div className="card-surface divide-y mb-4">
        <Toggle label="Require confirmation for sensitive actions" sub="UI safety preference only; a real task execution runtime is not connected yet." on={s.settings.requireConfirm}
          onChange={async (v) => {
            if (!v) { await confirm("Cannot disable", "Confirmation for sensitive actions is a fixed safety default in this version.", false); return; }
          }} />
        <Toggle label="Auto-resume paused tasks" sub="Preference only; tasks do not automatically run or resume in this version." on={s.settings.autoResume}
          onChange={async (v) => { if (await confirm("Change security setting?", `Turn auto-resume ${v ? "on" : "off"}.`)) set((st) => ({ ...st, settings: { ...st.settings, autoResume: v } }), `Auto-resume ${v ? "enabled" : "disabled"}`); }} />
        <div className="p-4 text-sm"><div className="font-medium">API keys & secrets</div><p className="text-xs text-muted-foreground mt-1">Never stored in this app's browser code or requested in chat. They will live in server-side secret storage when integrations are set up.</p></div>
      </div>
      <h2 className="font-semibold mb-2">Data</h2>
      <div className="card-surface p-4 flex items-center gap-3">
        <span className="flex-1 text-sm text-muted-foreground">Erase tasks, notes, and logs stored in this browser. This does not erase any server-side data.</span>
        <button className="btn btn-danger" onClick={async () => { if (await confirm("Reset all data?", "All tasks, notes, and log entries saved in this browser will be erased. This cannot be undone.", true)) reset(); }}>Reset</button>
      </div>
      <p className="text-xs text-muted-foreground mt-6">Hasib AI Agent is an independent starter dashboard. It does not contain OpenHands source code.</p>
    </>
  );
}