import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { data as db } from "@/lib/fdb";
import { CURRENCY_CODE, formatMoney } from "@/lib/currency";
import { isValidMsisdn, normalizeMsisdn } from "@/lib/phone";

export const Route = createFileRoute("/admin/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-wallet"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: tx, error } = await db
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = tx ?? [];
      // Real money only: Pesapal subscription payments that actually completed.
      // Manual/comped activations never create a transaction, so they can't inflate this.
      const income = rows
        .filter(
          (t) => t.kind === "payment" && t.status === "completed" && t.method === "pesapal",
        )
        .reduce((s, t) => s + Number(t.amount), 0);
      // Only confirmed payouts leave the wallet.
      const withdrawn = rows
        .filter((t) => t.kind === "withdrawal" && t.status === "completed")
        .reduce((s, t) => s + Number(t.amount), 0);
      const pending = rows
        .filter((t) => t.kind === "withdrawal" && t.status === "pending")
        .reduce((s, t) => s + Number(t.amount), 0);

      return {
        rows,
        income,
        withdrawn,
        pending,
        balance: income - withdrawn - pending,
      };
    },
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!value || value <= 0) throw new Error("Enter a valid amount");
      if (value > (data?.balance ?? 0)) throw new Error("Amount exceeds balance");
      if (!isValidMsisdn(dest)) throw new Error("Enter the payout mobile money number");
      const msisdn = normalizeMsisdn(dest);
      const reference = `WD-${Date.now()}`;

      // Pesapal settles collections to the merchant account; payouts are made
      // from the Pesapal dashboard. We record the request and only deduct once
      // the payout is confirmed as sent.
      const { error } = await db.from("transactions").insert({
        id: crypto.randomUUID(),
        amount: value,
        currency: CURRENCY_CODE,
        kind: "withdrawal",
        status: "pending",
        method: "pesapal",
        reference,
        internal_reference: null,
        msisdn,
        note: `Pesapal payout to ${msisdn}`,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout requested — confirm it once Pesapal sends the money");
      setOpen(false);
      setAmount("");
      setDest("");
      void qc.invalidateQueries({ queryKey: ["admin-wallet"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["admin-wallet"] });
    },
  });

  const settle = useMutation({
    mutationFn: async (input: { id: string; status: "completed" | "failed" }) => {
      const { error } = await db
        .from("transactions")
        .update({
          status: input.status,
          note: input.status === "completed" ? "Pesapal payout sent" : "Pesapal payout failed",
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">Wallet</h1>
        <p className="text-sm text-muted-foreground">Revenue, payouts and transaction history.</p>
      </header>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/20 via-card to-card p-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="size-4" /> Available balance
        </div>
        <div className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          {formatMoney(data?.balance ?? 0)}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Real Pesapal subscription earnings, minus confirmed and in-flight payouts
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setOpen(true)}>
            <ArrowUpRight className="mr-1 size-4" /> Withdraw
          </Button>
          <div className="flex items-center gap-4 rounded-lg bg-background/40 px-4 py-2 text-xs">
            <span>
              Earned <b className="text-sm">{formatMoney(data?.income ?? 0)}</b>
            </span>
            <span>
              Withdrawn <b className="text-sm">{formatMoney(data?.withdrawn ?? 0)}</b>
            </span>
            <span>
              Pending <b className="text-sm">{formatMoney(data?.pending ?? 0)}</b>
            </span>
          </div>
        </div>

      </div>

      <div className="overflow-x-auto card-soft">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5 text-left">Type</th>
              <th className="px-4 py-2.5 text-left">Amount</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Note</th>
              <th className="px-4 py-2.5 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.rows ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    {t.kind === "withdrawal" ? (
                      <ArrowUpRight className="size-3.5 text-destructive" />
                    ) : (
                      <ArrowDownLeft className="size-3.5 text-primary" />
                    )}
                    {t.kind}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatMoney(t.amount)}
                </td>
                <td className="px-4 py-3 text-xs">{t.status}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{t.note}</td>
                <td className="px-4 py-3 text-xs">
                  {t.kind === "withdrawal" && t.status === "pending" ? (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        disabled={settle.isPending}
                        onClick={() => settle.mutate({ id: t.id as string, status: "completed" })}
                      >
                        Sent
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={settle.isPending}
                        onClick={() => settle.mutate({ id: t.id as string, status: "failed" })}
                      >
                        Failed
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {!data?.rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No transactions yet.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <h2 className="text-base font-semibold">Withdraw funds</h2>
          <div className="space-y-3">
            <Input
              placeholder="Amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9"
            />
            <Input
              placeholder="Payout number e.g. 0770123456"
              inputMode="tel"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              className="h-9"
            />
            <Button
              className="w-full"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate()}
            >
              {withdraw.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Request
              withdrawal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}