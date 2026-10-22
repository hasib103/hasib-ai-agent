import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const nav = [
  { to: "/", label: "Home", icon: "◉" },
  { to: "/tasks", label: "Tasks", icon: "☰" },
  { to: "/approvals", label: "Approvals", icon: "✓" },
  { to: "/memory", label: "Memory", icon: "✎" },
  { to: "/browser", label: "Browser", icon: "↗" },
  { to: "/prompt-studio", label: "Prompt Studio", icon: "✧" },
  { to: "/integrations", label: "Integrations", icon: "⇄" },
  { to: "/activity", label: "Activity", icon: "≡" },
  { to: "/notifications", label: "Alerts", icon: "◔" },
  { to: "/settings", label: "Settings", icon: "⚙" },
] as const;
const mobile = ["/", "/tasks", "/approvals", "/memory", "/settings"];

export function AppShell({ children }: { children: ReactNode }) {
  const { s } = useStore();
  const pending = s.approvals.filter((a) => a.status === "pending").length;
  const linkCls = "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary";
  const active = { className: "bg-accent text-accent-foreground" };
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r p-4 gap-1 sticky top-0 h-screen">
        <div className="px-3 pb-5 pt-1">
          <div className="font-display text-lg font-semibold">Hasib<span className="text-primary"> AI Agent</span></div>
          <div className="text-xs text-muted-foreground font-mono">control panel · MVP</div>
        </div>
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className={linkCls} activeProps={active} activeOptions={{ exact: n.to === "/" }}>
            <span className="w-4 text-center">{n.icon}</span>{n.label}
            {n.to === "/approvals" && pending > 0 && <span className="ml-auto rounded-full bg-warning text-warning-foreground text-xs px-2">{pending}</span>}
          </Link>
        ))}
        <button className={linkCls + " mt-auto"} onClick={() => { void supabase.auth.signOut(); }}>
          <span className="w-4 text-center">↪</span>Sign out
        </button>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="mobile-header md:hidden flex items-center justify-between border-b px-3 py-2.5 sticky safe-area-top bg-background/90 backdrop-blur z-30">
          <span className="font-display font-semibold">Hasib<span className="text-primary"> AI</span></span>
          <div className="mobile-header-links flex gap-2 text-xs text-muted-foreground">
            <Link to="/browser" activeProps={{ className: "text-primary" }}>Browser</Link>
            <Link to="/prompt-studio" activeProps={{ className: "text-primary" }}>Prompts</Link>
            <Link to="/integrations" activeProps={{ className: "text-primary" }}>Integrations</Link>
            <Link to="/activity" activeProps={{ className: "text-primary" }}>Log</Link>
            <Link to="/notifications" activeProps={{ className: "text-primary" }}>Alerts</Link>
            <button onClick={() => { void supabase.auth.signOut(); }} className="text-muted-foreground">Sign out</button>
          </div>
        </div>
        <main className="mx-auto max-w-4xl px-3 py-4 pb-24 sm:px-4 sm:py-5 sm:pb-24 md:pb-10">{children}</main>
      </div>
      <nav className="mobile-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-card grid grid-cols-5 safe-area-bottom">
        {nav.filter((n) => mobile.includes(n.to)).map((n) => (
          <Link key={n.to} to={n.to} className="relative flex flex-col items-center py-1.5 text-xs text-muted-foreground" activeProps={{ className: "text-primary" }} activeOptions={{ exact: n.to === "/" }}>
            <span className="text-lg leading-none">{n.icon}</span>{n.label}
            {n.to === "/approvals" && pending > 0 && <span className="absolute top-1 right-1/4 rounded-full bg-warning text-warning-foreground text-[10px] px-1.5">{pending}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
