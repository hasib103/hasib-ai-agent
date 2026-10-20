import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: (userId: string) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) setSession(nextSession);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Account request received. Check your email for the confirmation link, then sign in.");
        } else {
          setMessage("Account created successfully.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Checking secure session…</div>;
  }

  if (session) return <>{children(session.user.id)}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="card-surface w-full max-w-md p-6 space-y-4">
        <div>
          <p className="font-display text-xl font-semibold">Hasib<span className="text-primary"> AI Agent</span></p>
          <h1 className="text-lg font-semibold mt-4">{mode === "signin" ? "Sign in to your workspace" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Your workspace is protected by Supabase authentication and row-level security.</p>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm">Email
            <input className="field mt-1" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm">Password
            <input className="field mt-1" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {message && <p className="text-sm text-primary" role="status">{message}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button className="btn btn-ghost w-full" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>
          {mode === "signin" ? "New here? Create an account" : "Already registered? Sign in"}
        </button>
        <p className="text-xs text-muted-foreground">Use your own account. Never share your password or API keys in chat.</p>
      </div>
    </div>
  );
}
