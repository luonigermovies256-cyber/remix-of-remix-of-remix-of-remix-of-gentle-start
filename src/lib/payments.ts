/**
 * Subscription payments: creates transaction records, drives Pesapal
 * checkouts, polls their status and activates/expires subscriptions.
 * Everything is real — no simulated states.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { data as db } from "@/lib/fdb";
import { CURRENCY_CODE } from "@/lib/currency";
import { normalizeMsisdn } from "@/lib/phone";
import { pesapalCreateOrder, pesapalStatus } from "@/lib/pesapal.functions";
import type { Plan } from "@/components/auth/SubscribeModal";

export type PayStatus = "pending" | "success" | "failed";


export type TxStatus =
  | "awaiting_scan"
  | "pending"
  | "completed"
  | "failed"
  | "expired";

export type PaymentTx = {
  id: string;
  user_id: string | null;
  plan_id: string | null;
  plan_name?: string | null;
  duration_days?: number | null;
  amount: number;
  currency: string;
  kind: string;
  status: TxStatus | string;
  method: string | null;
  reference: string | null;
  internal_reference?: string | null;
  msisdn?: string | null;
  note?: string | null;
  link_expires_at?: string | null;
  used_at?: string | null;
  completed_at?: string | null;
  activated_at?: string | null;
  created_at: string;
};

const LAST_TX_KEY = "last_payment_tx";

export function rememberTx(id: string) {
  try {
    window.localStorage.setItem(LAST_TX_KEY, id);
  } catch {
    /* ignore */
  }
}

export function forgetTx() {
  try {
    window.localStorage.removeItem(LAST_TX_KEY);
  } catch {
    /* ignore */
  }
}

export function lastTxId(): string | null {
  try {
    return window.localStorage.getItem(LAST_TX_KEY);
  } catch {
    return null;
  }
}

export async function getTx(id: string): Promise<PaymentTx | null> {
  const { data } = await db.from("transactions").select("*").eq("id", id).maybeSingle();
  return (data as PaymentTx | null) ?? null;
}

export function checkoutUrl(txId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/pay/${txId}`;
}

/** Creates the transaction row a checkout (in-app or scanned link) runs on. */
export async function createPaymentIntent(input: {
  userId: string;
  plan: Plan;
  method: "link" | "pesapal";
}): Promise<PaymentTx> {
  const id = crypto.randomUUID();
  const row: PaymentTx = {
    id,
    user_id: input.userId,
    plan_id: input.plan.id,
    plan_name: input.plan.name,
    duration_days: Number(input.plan.duration_days ?? 30),
    amount: Number(input.plan.price ?? 0),
    currency: CURRENCY_CODE,
    kind: "payment",
    status: input.method === "link" ? "awaiting_scan" : "pending",
    method: input.method,
    reference: `LUO-${Date.now()}-${id.slice(0, 8)}`,
    internal_reference: null,
    msisdn: null,
    note: `Subscription — ${input.plan.name}`,
    link_expires_at:
      input.method === "link" ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
    used_at: null,
    completed_at: null,
    activated_at: null,
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from("transactions").insert(row);
  if (error) throw error;
  rememberTx(id);
  return row;
}

/** Opens a Pesapal checkout for this transaction and returns its payment URL. */
export async function startPesapal(
  tx: PaymentTx,
  payer: { email?: string; phone?: string; name?: string },
): Promise<{ tx: PaymentTx; redirectUrl: string }> {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const res = await pesapalCreateOrder({
    data: {
      reference: (tx.reference ?? tx.id).replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 50),
      amount: Number(tx.amount),
      currency: tx.currency || CURRENCY_CODE,
      description: tx.note ?? "Subscription payment",
      callbackUrl: `${origin}/pay/${tx.id}`,
      ipnUrl: `${origin}/api/public/pesapal-ipn`,
      ...(payer.email ? { email: payer.email } : {}),
      ...(payer.phone ? { phone: normalizeMsisdn(payer.phone) } : {}),
      ...(payer.name ? { firstName: payer.name } : {}),
    },
  });
  const patch = {
    internal_reference: res.orderTrackingId,
    status: "pending" as const,
    method: "pesapal",
    used_at: new Date().toISOString(),
  };
  await db.from("transactions").update(patch).eq("id", tx.id);
  rememberTx(tx.id);
  return { tx: { ...tx, ...patch }, redirectUrl: res.redirectUrl };
}


async function activateSubscription(tx: PaymentTx) {
  if (!tx.user_id) return;
  const days = Number(tx.duration_days ?? 30) || 30;
  const now = new Date();
  const subscriptionId = `payment_${tx.id}`;
  const activityId = `payment_${tx.id}`;

  // A transaction can be polled by the modal and the global resume worker at
  // the same time. A deterministic document prevents double activation.
  const { data: subscriptions, error: subscriptionsError } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", tx.user_id);
  if (subscriptionsError) throw subscriptionsError;
  const rows = (subscriptions ?? []) as {
    id: string;
    status?: string;
    expires_at?: string | null;
    created_at?: string;
  }[];
  if (rows.some((row) => row.id === subscriptionId)) return;

  // Stack onto an existing live subscription instead of cutting it short.
  const live = rows
    .filter((row) => row.id !== subscriptionId)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  const base =
    live && (live.status ?? "").toLowerCase() === "active" && live.expires_at &&
    new Date(live.expires_at).getTime() > now.getTime()
      ? new Date(live.expires_at)
      : now;
  const expires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const subscriptionWrite = await db.from("subscriptions").insert({
    id: subscriptionId,
    user_id: tx.user_id,
    plan_id: tx.plan_id,
    status: "active",
    started_at: now.toISOString(),
    expires_at: expires.toISOString(),
    source: "pesapal",
    transaction_id: tx.id,
    created_at: now.toISOString(),
  });
  if (subscriptionWrite.error) throw subscriptionWrite.error;

  const activityWrite = await db.from("activities").insert({
    id: activityId,
    user_id: tx.user_id,
    action: "subscription_activated",
    detail: `${tx.plan_name ?? "Plan"} · ${days} days`,
    created_at: now.toISOString(),
  });
  if (activityWrite.error) throw activityWrite.error;
}

/** Completes activation and leaves the transaction retryable if a data write fails. */
async function finalizeSuccessfulPayment(tx: PaymentTx, message: string): Promise<SyncResult> {
  const completedAt = tx.completed_at ?? new Date().toISOString();
  const completed = { status: "completed" as const, completed_at: completedAt };
  const completionWrite = await db.from("transactions").update(completed).eq("id", tx.id);
  if (completionWrite.error) throw completionWrite.error;

  if (!tx.activated_at) {
    await activateSubscription({ ...tx, ...completed });
    const activatedAt = new Date().toISOString();
    const activationWrite = await db
      .from("transactions")
      .update({ activated_at: activatedAt })
      .eq("id", tx.id);
    if (activationWrite.error) throw activationWrite.error;
    forgetTx();
    return {
      status: "success",
      message,
      tx: { ...tx, ...completed, activated_at: activatedAt },
    };
  }

  forgetTx();
  return { status: "success", message, tx: { ...tx, ...completed } };
}

/** Marks any subscription whose window has closed as expired. */
export async function expireStaleSubscriptions(userId: string) {
  const { data } = await db.from("subscriptions").select("*").eq("user_id", userId);
  const rows = (data ?? []) as { id: string; status?: string; expires_at?: string | null }[];
  await Promise.all(
    rows
      .filter(
        (r) =>
          (r.status ?? "").toLowerCase() === "active" &&
          r.expires_at &&
          new Date(r.expires_at).getTime() <= Date.now(),
      )
      .map((r) => db.from("subscriptions").update({ status: "expired" }).eq("id", r.id)),
  );
}

export type SyncResult = { status: PayStatus | "expired"; message: string; tx: PaymentTx | null };

/** Reads the live status of one transaction and applies its side effects. */
export async function syncTransaction(txId: string): Promise<SyncResult> {
  const tx = await getTx(txId);
  if (!tx) return { status: "failed", message: "Payment not found", tx: null };

  // A refresh may happen after Pesapal confirmed payment but before the
  // subscription write completed. Keep retrying until activation is recorded.
  if (tx.status === "completed") return finalizeSuccessfulPayment(tx, "Payment received");
  if (tx.status === "failed") return { status: "failed", message: "Payment failed", tx };
  if (tx.status === "expired") return { status: "expired", message: "This link expired", tx };

  if (
    tx.status === "awaiting_scan" &&
    tx.link_expires_at &&
    new Date(tx.link_expires_at).getTime() <= Date.now()
  ) {
    await db.from("transactions").update({ status: "expired" }).eq("id", tx.id);
    return { status: "expired", message: "This payment link expired", tx };
  }

  if (!tx.internal_reference) {
    return { status: "pending", message: "Waiting for payment to start", tx };
  }

  const res = await pesapalStatus({ data: { orderTrackingId: tx.internal_reference } });
  if (res.state === "success") {
    return finalizeSuccessfulPayment(tx, res.message);
  }
  if (res.state === "failed" || res.state === "cancelled") {
    await db.from("transactions").update({ status: "failed", note: res.message }).eq("id", tx.id);
    forgetTx();
    return { status: "failed", message: res.message, tx: { ...tx, status: "failed" } };
  }
  return { status: "pending", message: res.message, tx };
}


/** Newest unfinished payment for a user (used to resume polling after reloads). */
export async function findUnfinishedTx(userId: string): Promise<PaymentTx | null> {
  const { data } = await db.from("transactions").select("*").eq("user_id", userId);
  const rows = (data ?? []) as PaymentTx[];
  const open = rows
    .filter(
      (r) =>
        r.kind === "payment" &&
        (r.status === "pending" ||
          r.status === "awaiting_scan" ||
          (r.status === "completed" && !r.activated_at)) &&
        Date.now() - new Date(r.created_at ?? 0).getTime() < 6 * 60 * 60 * 1000,
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return open[0] ?? null;
}

/**
 * Background resume: on every page (and after refreshes) keep checking the
 * user's last unfinished payment so a completed one always activates.
 */
export function usePaymentResume(userId: string | null | undefined) {
  const qc = useQueryClient();
  const busy = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const tick = async () => {
      if (busy.current || cancelled) return;
      busy.current = true;
      try {
        await expireStaleSubscriptions(userId);
        const remembered = lastTxId();
        const tx = remembered ? await getTx(remembered) : await findUnfinishedTx(userId);
        const target =
          tx &&
          (tx.status === "pending" ||
            tx.status === "awaiting_scan" ||
            (tx.status === "completed" && !tx.activated_at))
            ? tx
            : await findUnfinishedTx(userId);
        if (!target) return;
        const res = await syncTransaction(target.id);
        if (res.status === "success") {
          void qc.invalidateQueries({ queryKey: ["my-subscription"] });
          const { toast } = await import("sonner");
          toast.success("Payment confirmed — your subscription is active.");
        }
      } catch {
        /* keep trying quietly */
      } finally {
        busy.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [userId, qc]);
}
