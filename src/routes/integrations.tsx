import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/lib/store";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrations · Hasib AI Agent" },
    { name: "description", content: "Manage provider setup and connection status for Hasib AI Agent." },
    { property: "og:title", content: "Integrations · Hasib AI Agent" },
    { property: "og:description", content: "Manage external service connections." },
  ] }),
  component: Integrations,
});

type Integration = {
  name: string;
  desc: string;
  status: "configured" | "needs-setup";
  statusText: string;
  setup: string[];
  consoleUrl: string;
  consoleLabel: string;
  capability: string;
};

const items: Integration[] = [
  {
    name: "GitHub",
    desc: "Repositories, issues, pull requests and source changes.",
    status: "needs-setup",
    statusText: "Authorization not configured",
    setup: ["Create/configure a GitHub App or OAuth App for Hasib AI Agent.", "Add the client ID and secret to server-side environment variables.", "Implement and verify the OAuth callback and least-privilege scopes."],
    consoleUrl: "https://github.com/settings/apps",
    consoleLabel: "Open GitHub app settings",
    capability: "Repository and pull-request actions require a working OAuth/API integration; opening GitHub settings alone does not connect this app.",
  },
  {
    name: "Supabase",
    desc: "Authentication and the app's user-scoped database.",
    status: "configured",
    statusText: "App database configured",
    setup: ["The app is configured to use its Supabase project.", "A successful live health check is not performed by this page."],
    consoleUrl: "https://supabase.com/dashboard",
    consoleLabel: "Open Supabase dashboard",
    capability: "This status describes app configuration, not proof that every database operation or policy has been tested.",
  },
  {
    name: "Vercel",
    desc: "Projects, deployment status and previews.",
    status: "needs-setup",
    statusText: "Authorization not configured",
    setup: ["Create a Vercel integration or provision a scoped access token.", "Store credentials only in server-side environment variables.", "Implement provider API calls and test access to the intended team/projects."],
    consoleUrl: "https://vercel.com/account/settings",
    consoleLabel: "Open Vercel settings",
    capability: "The agent cannot manage deployments until server-side credentials and provider actions are implemented.",
  },
  {
    name: "Render",
    desc: "Web services, deploys, events and logs.",
    status: "needs-setup",
    statusText: "Authorization not configured",
    setup: ["Create a Render API key with the minimum required access.", "Store it as a server-side secret, never in browser code.", "Connect the API and verify access to the intended workspace and services."],
    consoleUrl: "https://dashboard.render.com",
    consoleLabel: "Open Render dashboard",
    capability: "A dashboard link is not an API connection. Server-side API access must be configured and tested.",
  },
  {
    name: "Inkbox",
    desc: "Communication identity, email and supported messaging workflows.",
    status: "needs-setup",
    statusText: "Authorization not configured",
    setup: ["Confirm the Inkbox account and API access required for the intended workflow.", "Configure server-side credentials using the provider's supported setup.", "Implement and test only the approved communication actions."],
    consoleUrl: "https://inkbox.ai",
    consoleLabel: "Open Inkbox",
    capability: "Sending messages is an external side effect and must remain behind explicit approval.",
  },
  {
    name: "Runway",
    desc: "AI video generation and supported media workflows.",
    status: "needs-setup",
    statusText: "Authorization not configured",
    setup: ["Create or locate API credentials for the Runway account.", "Store the key in server-side secrets.", "Implement the API workflow and test a bounded request."],
    consoleUrl: "https://app.runwayml.com",
    consoleLabel: "Open Runway",
    capability: "Media generation requires provider API access; this page does not start a generation job.",
  },
];

function Integrations() {
  const [selected, setSelected] = useState<Integration | null>(null);

  return (
    <>
      <PageHeader
        title="Integrations"
        sub="Review each provider, open its official settings, and see what is needed before Hasib AI Agent can perform real actions."
      />

      <div className="card-surface p-3 sm:p-4 mb-3 sm:mb-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">Credentials stay server-side</p>
          <p className="mt-1 text-muted-foreground">Do not paste API keys or OAuth secrets into this page or chat. Provider links open the provider's official website; they do not grant access to Hasib AI Agent by themselves.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const configured = item.status === "configured";
          return (
            <article key={item.name} className="card-surface p-4 flex flex-col">
              <div className="flex items-start gap-2">
                <h2 className="font-semibold flex-1">{item.name}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                  {configured
                    ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    : <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                  {configured ? "Configured" : "Needs setup"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              <p className="mt-3 text-xs text-muted-foreground">{item.statusText}</p>
              <div className="mt-auto grid grid-cols-1 gap-2 pt-4">
                <button className="btn btn-primary w-full" type="button" onClick={() => setSelected(item)}>
                  {configured ? "View connection details" : "Set up connection"}
                </button>
                <a className="btn btn-ghost w-full inline-flex items-center justify-center gap-2" href={item.consoleUrl} target="_blank" rel="noreferrer">
                  {item.consoleLabel}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="integration-dialog-title" className="card-surface w-full max-w-lg p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 id="integration-dialog-title" className="text-lg font-semibold">{selected.name} connection</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selected.statusText}</p>
              </div>
              <button type="button" className="btn btn-ghost !py-1" onClick={() => setSelected(null)} aria-label="Close setup details">Close</button>
            </div>
            <p className="text-sm">{selected.capability}</p>
            <div>
              <h3 className="text-sm font-semibold">What is required</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {selected.setup.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <a className="btn btn-primary w-full inline-flex items-center justify-center gap-2" href={selected.consoleUrl} target="_blank" rel="noreferrer">
              {selected.consoleLabel}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="text-xs text-muted-foreground">No permission is granted automatically. After provider credentials and the server-side integration are configured, verify the connection before relying on agent actions.</p>
          </section>
        </div>
      )}
    </>
  );
}
