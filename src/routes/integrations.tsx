import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/lib/store";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrations · Hasib AI Agent" },
    { name: "description", content: "Connection status for GitHub, Supabase, Vercel, Render, Inkbox and Runway." },
    { property: "og:title", content: "Integrations · Hasib AI Agent" },
    { property: "og:description", content: "Connection status for external services." },
  ] }),
  component: Integrations,
});

const items = [
  { name: "GitHub", desc: "Repositories, issues, pull requests", setup: "OAuth app" },
  { name: "Supabase", desc: "Authenticated database, auth and row-level security", setup: "Connected to project database", connected: true },
  { name: "Vercel", desc: "Deployments and previews", setup: "OAuth integration" },
  { name: "Render", desc: "Services and background workers", setup: "Server-side API key" },
  { name: "Inkbox", desc: "Email and external messaging", setup: "Server-side API key" },
  { name: "Runway", desc: "AI video generation", setup: "Server-side API key" },
];

function Integrations() {
  return (
    <>
      <PageHeader title="Integrations" sub="No services are connected. Connections will be added once real OAuth or server-side API setup exists." />
      <div className="card-surface p-4 mb-4 text-sm text-muted-foreground">
        Keys are never entered here or in chat. They will be stored as server-side secrets only.
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((i) => (
          <div key={i.name} className="card-surface p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium flex-1">{i.name}</span>
              <span className="text-xs rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">● {"connected" in i && i.connected ? "Connected" : "Not connected"}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{i.desc}</p>
            <p className="text-xs font-mono text-muted-foreground mt-2">Planned setup: {i.setup}</p>
            <button className="btn btn-ghost w-full mt-3" disabled title={"connected" in i && i.connected ? "Supabase database is configured" : "Not available until real setup exists"}>{ "connected" in i && i.connected ? "Database connected" : "Connect — not available yet" }</button>
          </div>
        ))}
      </div>
    </>
  );
}