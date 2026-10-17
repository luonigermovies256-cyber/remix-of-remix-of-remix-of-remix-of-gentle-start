import { useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth, saveProfilePhone } from "@/lib/auth";
import { isValidMsisdn } from "@/lib/phone";

/**
 * Google sign-in gives us no phone number, so anyone who lands here without one
 * must add it before using the site. Deliberately not dismissible.
 */
export function PhoneGate() {
  const { session, profile, loading, refresh } = useAuth();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading || !session || !profile || profile.phone) return null;

  const submit = async () => {
    if (!isValidMsisdn(phone)) {
      toast.error("Enter a valid phone number, e.g. 0770123456");
      return;
    }
    setBusy(true);
    try {
      await saveProfilePhone(session.user.id, phone.trim());
      await refresh();
      toast.success("Phone number saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your number");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-base font-bold text-foreground">One last step</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Add your mobile number to finish creating your account. It is used for payments and
          account recovery.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
          <Smartphone className="size-4 text-muted-foreground" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoFocus
            placeholder="0770123456"
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Save and continue
        </button>
      </div>
    </div>
  );
}
