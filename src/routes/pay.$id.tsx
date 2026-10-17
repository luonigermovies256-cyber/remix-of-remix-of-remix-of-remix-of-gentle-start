import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { getTx, startPesapal, syncTransaction, type PaymentTx } from "@/lib/payments";

export const Route = createFileRoute("/pay/$id")({
  head: () => ({
    meta: [
      { title: "Complete your payment — VJ EMMA.SITE" },
      { name: "description", content: "Pay for your VJ EMMA.SITE membership securely with Pesapal." },
      { property: "og:title", content: "Complete your payment — VJ EMMA.SITE" },
      { property: "og:description", content: "Pay for your VJ EMMA.SITE membership securely with Pesapal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { id } = Route.useParams();
  const [tx, setTx] = useState<PaymentTx | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "waiting" | "done" | "failed" | "expired"
  >("loading");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const row = await getTx(id);
      if (!row) {
        setState("failed");
        setMsg("This payment link is not valid.");
        return;
      }
      setTx(row);
      const res = await syncTransaction(row.id);
      if (res.status === "success") setState("done");
      else if (res.status === "expired") setState("expired");
      else if (res.status === "failed") {
        setState("failed");
        setMsg(res.message);
      } else setState(row.internal_reference ? "waiting" : "ready");
    })();
  }, [id]);

  useEffect(() => {
    if (state !== "waiting") return;
    const timer = window.setInterval(() => {
      void (async () => {
        const res = await syncTransaction(id);
        setMsg(res.message);
        if (res.status === "success") setState("done");
        if (res.status === "failed") setState("failed");
        if (res.status === "expired") setState("expired");
      })();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state, id]);

  const pay = async () => {
    if (!tx) return;
    setBusy(true);
    try {
      const started = await startPesapal(tx, {});
      setTx(started.tx);
      window.location.href = started.redirectUrl;
    } catch (e) {
      setState("failed");
      setMsg(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">Complete your payment</h1>
        {tx && (
          <div className="mt-3 rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">{tx.plan_name ?? "Membership"}</p>
            <p className="mt-1">
              {tx.duration_days ?? 30} days · Ref {tx.reference}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-vip">{formatMoney(tx.amount)}</p>
          </div>
        )}

        {state === "loading" && (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading payment…
          </p>
        )}

        {state === "ready" && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              You will be taken to the secure Pesapal checkout to pay with mobile money, card or
              bank.
            </p>
            <button
              onClick={() => void pay()}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg badge-vip py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Pay with Pesapal
            </button>
          </div>
        )}

        {state === "waiting" && (
          <div className="mt-5 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-vip" />
            <p className="mt-2 text-sm font-semibold">Waiting for payment</p>
            <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
          </div>
        )}

        {state === "done" && (
          <div className="mt-5 text-center">
            <CheckCircle2 className="mx-auto size-10 text-vip" />
            <p className="mt-2 text-sm font-semibold">Payment received</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The membership is now active on the account that started this checkout.
            </p>
          </div>
        )}

        {(state === "failed" || state === "expired") && (
          <div className="mt-5 text-center">
            <XCircle className="mx-auto size-10 text-destructive" />
            <p className="mt-2 text-sm font-semibold">
              {state === "expired"
                ? "This link expired or was already used"
                : "Payment not completed"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
          </div>
        )}

        <Link to="/" className="mt-5 block text-center text-xs text-muted-foreground underline">
          Back to VJ EMMA.SITE
        </Link>
      </div>
    </main>
  );
}
