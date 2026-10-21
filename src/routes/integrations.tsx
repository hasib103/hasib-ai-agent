import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  const [selected, setSelected] = useState<(typeof items)[number] | null>(null);
  return (
    <>
      <PageHeader title="Integrations" sub="Supabase database access is connected. Other provider integrations remain unavailable until their own OAuth or server-side credentials are configured." />
      <div className="card-surface p-3 sm:p-4 mb-3 sm:mb-4 text-sm text-muted-foreground">
        Keys are never entered here or in chat. They will be stored as server-side secrets only.
      </div>
      <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
        {items.map((i) => (
          <div key={i.name} className="card-surface p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium flex-1">{i.name}</span>
              <span className="text-xs rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">● {"connected" in i && i.connected ? "Connected" : "Not connected"}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{i.desc}</p>
            <p className="text-xs font-mono text-muted-foreground mt-1.5 sm:mt-2">Planned setup: {i.setup}</p>
            <button className="btn btn-ghost w-full mt-2 sm:mt-3" type="button" onClick={() => setSelected(i)}>{ "connected" in i && i.connected ? "View connection details" : "View setup requirements" }</button>
          </div>
        ))}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="integration-dialog-title" className="card-surface w-full max-w-md p-5 space-y-3">
            <div className="flex items-start gap-3">
              <h2 id="integration-dialog-title" className="text-lg font-semibold flex-1">{selected.name} setup</h2>
              <button type="button" className="btn btn-ghost !py-1" onClick={() => setSelected(null)} aria-label="Close setup details">Close</button>
            </div>
            <p className="text-sm text-muted-foreground">{selected.desc}</p>
            <p className="text-sm"><span className="font-medium">Status: </span>{"connected" in selected && selected.connected ? "Database configured in this app; this screen does not perform a live connection test." : "Not connected. The UI cannot connect this provider yet."}</p>
            <p className="text-sm"><span className="font-medium">Required setup: </span>{selected.setup}</p>
            <p className="text-xs text-muted-foreground">For security, configure credentials in the provider dashboard or server-side environment. Do not paste API keys into this page or into chat. No connection has been created by opening this dialog.</p>
            <button type="button" className="btn btn-primary w-full" onClick={() => setSelected(null)}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}