import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError, useFirebaseAuth } from "@/lib/firebase-auth";

const GOOGLE_G = (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

export function AuthForm({ mode, redirect }: { mode: "login" | "signup"; redirect: string }) {
  const { signIn, signUp, signInWithGoogle, configured } = useFirebaseAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  const done = () => navigate({ to: redirect.startsWith("/") ? redirect : "/dashboard" });

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      done();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSignup && password !== confirm) return setError("Passwords don't match.");
    void run(() => (isSignup ? signUp(email, password, name.trim()) : signIn(email, password)));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
        <Link to="/" className="text-sm font-black tracking-tight text-foreground">VJ EMMA.SITE</Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignup ? "Sign up to keep your viewer dashboard." : "Sign in to open your dashboard."}
        </p>
        {!configured && (
          <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Viewer sign-in isn't configured yet.
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
          style={{ background: "#FFFFFF", border: "1px solid #747775", color: "#1F1F1F", padding: "10px 12px" }}
          className="mt-5 flex w-full items-center justify-center gap-[10px] rounded-md text-sm font-medium leading-5 disabled:opacity-60"
        >
          {GOOGLE_G}
          {isSignup ? "Sign up with Google" : "Sign in with Google"}
        </button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} />
          </div>
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Sign up" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link to={isSignup ? "/login" : "/signup"} search={{ redirect }} className="font-medium text-primary">
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
