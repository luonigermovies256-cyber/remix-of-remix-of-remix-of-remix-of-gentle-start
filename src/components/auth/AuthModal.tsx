import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoAsset from "@/assets/logo.png";
import { registerAccount, signInWithGoogle, signInWithPhone } from "@/lib/auth";

type Mode = "login" | "register";

export function AuthModal({
  open,
  onOpenChange,
  initialMode = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await signInWithPhone(email.trim(), password);
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        if (name.trim().length < 2) throw new Error("Enter your name");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
          throw new Error("Enter a valid email address");
        if (phone.replace(/\D/g, "").length < 7) throw new Error("Enter a valid phone number");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        const { error } = await registerAccount({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Account created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) throw res.error;
      if (!("redirected" in res && res.redirected)) onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] gap-0 rounded-2xl border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <img src={logoAsset} alt="" className="size-6" />
          <span className="text-[13px] font-bold tracking-tight">VJ EMMA.SITE</span>
        </div>
        <h2 className="text-base font-semibold">
          {mode === "login" ? "Sign in" : "Create account"}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {mode === "login" ? "Use your phone number or email" : "It only takes a moment"}
        </p>

        <form onSubmit={submit} className="mt-4 space-y-2.5">
          {mode === "register" && (
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
            />
          )}
          <Input
            type={mode === "login" ? "text" : "email"}
            placeholder={mode === "login" ? "Phone number or email" : "Email address"}
            inputMode={mode === "login" ? "text" : "email"}
            autoComplete={mode === "login" ? "username" : "email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 text-sm"
          />
          {mode === "register" && (
            <Input
              placeholder="Phone number"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-sm"
            />
          )}
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 text-sm"
          />
          <Button type="submit" disabled={busy} className="h-9 w-full text-sm">
            {busy && <Loader2 className="mr-1 size-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-3 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={google}
          disabled={busy}
          className="h-9 w-full gap-2 text-sm"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.9 0 3.2.8 3.9 1.5l2.7-2.6A9.7 9.7 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
            />
          </svg>
          Continue with Google
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </DialogContent>
    </Dialog>
  );
}