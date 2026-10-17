import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Smartphone,
  User,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { data as db } from "@/lib/fdb";
import { formatMoney } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { PesapalCheckout } from "@/components/auth/PesapalCheckout";
import {
  checkoutUrl,
  createPaymentIntent,
  startPesapal,
  syncTransaction,
  type PaymentTx,
} from "@/lib/payments";

export type Plan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_days: number;
  description: string | null;
  features: string[];
  is_active: boolean;
};

export function SubscribeModal({
  open,
  onOpenChange,
  onNeedAuth,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNeedAuth?: () => void;
}) {
  const qc = useQueryClient();
  const { session, profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "phone" | "waiting" | "done" | "failed">("idle");
  const [phone, setPhone] = useState("");
  const [tx, setTx] = useState<PaymentTx | null>(null);
  const [linkTx, setLinkTx] = useState<PaymentTx | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const linkFor = useRef<string | null>(null);
  const planStrip = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    db
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as Plan[];
        setPlans(rows);
        setSelected((s) => s ?? rows[1]?.id ?? rows[0]?.id ?? null);
      });
  }, [open]);

  useEffect(() => {
    if (open) setPhone((p) => p || profile?.phone || "");
    if (!open) {
      setPhase("idle");
      setTx(null);
      setStatusMsg("");
      setPayUrl(null);
      linkFor.current = null;
      setQr(null);
      setLinkTx(null);
    }
  }, [open, profile?.phone]);

  const shown = [...plans].sort((a, b) => Number(a.price) - Number(b.price));
  const current = shown.find((p) => p.id === selected) ?? shown[0] ?? null;

  /* A scannable payment link is minted per open plan so another device can pay. */
  useEffect(() => {
    if (!open || !session || !current) return;
    if (linkFor.current === current.id) return;
    linkFor.current = current.id;
    let cancelled = false;
    void (async () => {
      try {
        if (linkTx && linkTx.status === "awaiting_scan") {
          await db.from("transactions").update({ status: "expired" }).eq("id", linkTx.id);
        }
        const created = await createPaymentIntent({
          userId: session.user.id,
          plan: current,
          method: "link",
        });
        if (cancelled) return;
        setLinkTx(created);
        setQr(
          await QRCode.toDataURL(checkoutUrl(created.id), {
            margin: 1,
            width: 240,
            color: { dark: "#0b0b0f", light: "#ffffff" },
          }),
        );
      } catch {
        /* QR is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, current?.id]);

  const finish = useCallback(() => {
    setPhase("done");
    setPayUrl(null);
    setStatusMsg("Payment received — your subscription is active.");
    void qc.invalidateQueries({ queryKey: ["my-subscription"] });
    toast.success("Subscription activated");
    window.setTimeout(() => onOpenChange(false), 1600);
  }, [qc, onOpenChange]);

  /* Poll every second: the phone prompt and the scanned link both land here. */
  useEffect(() => {
    if (!open) return;
    const watch = tx ?? linkTx;
    if (!watch || phase === "done") return;
    let stop = false;
    const timer = window.setInterval(() => {
      void (async () => {
        if (stop) return;
        const res = await syncTransaction(watch.id);
        if (stop) return;
        if (res.status === "success") {
          stop = true;
          finish();
        } else if (res.status === "failed" || res.status === "expired") {
          if (tx) {
            setPhase("failed");
            setStatusMsg(res.message);
          }
        } else if (phase === "waiting") {
          setStatusMsg(res.message);
        }
      })();
    }, 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [open, tx, linkTx, phase, finish]);

  const beginCheckout = () => {
    if (!session) {
      onOpenChange(false);
      onNeedAuth?.();
      return;
    }
    if (!current) return;
    void pay();
  };

  const pay = async () => {
    if (!session || !current) return;
    setBusy(true);
    setStatusMsg("");
    try {
      const intent = await createPaymentIntent({
        userId: session.user.id,
        plan: current,
        method: "pesapal",
      });
      const started = await startPesapal(intent, {
        ...(session.user.email ? { email: session.user.email } : {}),
        ...(profile?.phone ? { phone: profile.phone } : {}),
        ...(profile?.name ? { name: profile.name } : {}),
      });
      setTx(started.tx);
      setPayUrl(started.redirectUrl);
      setPhase("waiting");
      setStatusMsg("Complete the payment in the window…");
    } catch (e) {
      setPhase("failed");
      setPayUrl(null);
      const msg = e instanceof Error ? e.message : "Could not start payment";
      setStatusMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const checkoutOpen = !!payUrl && phase === "waiting";

  return (
    <>
    <Dialog open={open && !checkoutOpen} onOpenChange={onOpenChange}>
      <DialogContent className="surface-solid flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[880px] flex-col gap-0 overflow-hidden rounded-2xl border-border p-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* Left panel */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-border md:overflow-y-auto md:border-r">

            <div className="flex items-center gap-2.5 bg-vip/10 px-3 py-2.5 md:px-5 md:py-3.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground md:size-10">
                <User className="size-4 md:size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {session ? profile?.name || "My account" : "Sign up / Log in"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Log in before purchase to enjoy membership on all your devices
                </p>
              </div>
              {!session && (
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onNeedAuth?.();
                  }}
                  className="shrink-0 rounded-full badge-vip px-4 py-1.5 text-xs font-semibold"
                >
                  Log in now
                </button>
              )}
            </div>

            {/* Plan cards */}
            <div className="relative px-3 py-3 md:px-10 md:py-5">
              {shown.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous subscription plans"
                    onClick={() => planStrip.current?.scrollBy({ left: -240, behavior: "smooth" })}
                    className="absolute left-1 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-foreground shadow-lg md:flex"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next subscription plans"
                    onClick={() => planStrip.current?.scrollBy({ left: 240, behavior: "smooth" })}
                    className="absolute right-1 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-foreground shadow-lg md:flex"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </>
              )}
              <div
                ref={planStrip}
                className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 md:gap-3"
              >
                {shown.map((p, i) => {
                  const active = current?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p.id);
                        setPhase("idle");
                        setTx(null);
                      }}
                      className={`relative w-[44%] min-w-[132px] max-w-[180px] shrink-0 snap-start rounded-xl border-2 px-2 pb-3 pt-5 text-center transition-colors sm:w-[31%] md:px-3 md:pb-4 md:pt-6 ${
                        active
                          ? "border-vip bg-vip/10"
                          : "border-border bg-secondary/40 hover:bg-secondary/70"
                      }`}
                    >
                      {i === 0 && (
                        <span className="absolute -top-px left-[-2px] rounded-br-xl rounded-tl-xl badge-hot px-2 py-0.5 text-[10px] font-bold">
                          Best deal
                        </span>
                      )}
                      <div className={`text-sm font-bold ${active ? "text-vip" : "text-foreground"}`}>
                        {p.name}
                      </div>
                      <div
                        className={`mt-2 text-[20px] font-extrabold leading-none ${
                          active ? "text-vip" : "text-foreground"
                        }`}
                      >
                        {formatMoney(p.price)}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {p.duration_days} days
                      </div>
                    </button>
                  );
                })}
                {shown.length === 0 && (
                  <p className="w-full py-8 text-center text-xs text-muted-foreground">
                    No plans available yet.
                  </p>
                )}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                · Access ends automatically when the paid period is over. Renew anytime.
              </p>
            </div>

            {/* Benefits table */}
            <div className="hidden min-h-0 flex-1 px-5 pb-5 md:block">
              <h3 className="mb-2 text-sm font-bold text-foreground">Membership benefits</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="grid grid-cols-4 bg-secondary/50 text-center text-[11px] font-semibold">
                  <span className="py-2 text-muted-foreground">Benefit</span>
                  <span className="py-2 text-muted-foreground">Free</span>
                  <span className="bg-vip/10 py-2 text-vip">VIP</span>
                  <span className="py-2 text-foreground/80">SVIP</span>
                </div>
                {[
                  { k: "VIP content", a: "—", b: "Early access", c: "Extra early" },
                  { k: "Ads", a: "Yes", b: "No ads", c: "No ads" },
                  { k: "Quality", a: "540P", b: "1080P", c: "4K HDR" },
                  { k: "Devices", a: "1", b: "3", c: "5 + TV" },
                ].map((r) => (
                  <div
                    key={r.k}
                    className="grid grid-cols-4 border-t border-border text-center text-[11px]"
                  >
                    <span className="py-2 text-muted-foreground">{r.k}</span>
                    <span className="py-2 text-foreground/70">{r.a}</span>
                    <span className="bg-vip/10 py-2 font-semibold text-vip">{r.b}</span>
                    <span className="py-2 text-foreground/80">{r.c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right payment panel */}
          <div className="w-full shrink-0 px-3 py-4 md:w-[300px] md:px-5 md:py-6">
            <p className="text-center text-sm text-muted-foreground">
              Pay{" "}
              <span className="text-[28px] font-extrabold leading-none text-vip">
                {formatMoney(current?.price ?? 0)}
              </span>
            </p>

            {phase === "done" ? (
              <div className="mt-4 rounded-2xl border border-dashed border-vip/50 p-5 text-center">
                <CheckCircle2 className="mx-auto size-10 text-vip" />
                <p className="mt-2 text-sm font-semibold">Payment received</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{statusMsg}</p>
              </div>
            ) : phase === "waiting" ? (
              <div className="mt-4 rounded-2xl border border-dashed border-vip/50 p-5 text-center">
                <Loader2 className="mx-auto size-9 animate-spin text-vip" />
                <p className="mt-3 text-sm font-semibold">Waiting for payment</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {statusMsg || "Complete the payment in the Pesapal window."}
                </p>
                {!payUrl && tx && (
                  <button
                    onClick={() => void pay()}
                    className="mt-3 w-full rounded-lg badge-vip py-2 text-xs font-bold"
                  >
                    Reopen payment window
                  </button>
                )}
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Ref {tx?.reference}
                </p>
              </div>
            ) : phase === "failed" ? (
              <div className="mt-4 rounded-2xl border border-dashed border-destructive/50 p-5 text-center">
                <XCircle className="mx-auto size-9 text-destructive" />
                <p className="mt-2 text-sm font-semibold">Payment not completed</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{statusMsg}</p>
                <button
                  onClick={() => {
                    setTx(null);
                    void pay();
                  }}
                  className="mt-3 w-full rounded-lg badge-vip py-2.5 text-sm font-bold"
                >
                  Try again
                </button>
              </div>
            ) : phase === "phone" ? (
              <div className="mt-4 rounded-2xl border border-dashed border-vip/50 p-4">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Mobile money number
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
                  <Smartphone className="size-4 text-muted-foreground" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="0770123456"
                    className="h-10 w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  You will get a prompt to approve {formatMoney(current?.price ?? 0)}.
                </p>
                <button
                  onClick={() => void pay()}
                  disabled={busy}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg badge-vip py-2.5 text-sm font-bold disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Send payment request
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-vip/50 p-3 text-center md:mt-4 md:p-4">
                <div className="mx-auto flex size-24 items-center justify-center overflow-hidden rounded-xl bg-white md:size-32">
                  {qr ? (
                    <img src={qr} alt="Scan to pay" className="size-24 md:size-32" />
                  ) : (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Scan with your phone to pay {formatMoney(current?.price ?? 0)}, or pay here.
                </p>
                <button
                  onClick={beginCheckout}
                  disabled={!current}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg badge-vip py-2.5 text-sm font-bold disabled:opacity-60"
                >
                  Agree and pay
                </button>
              </div>
            )}

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Mobile money, Visa & Mastercard · Secured by Pesapal
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <PesapalCheckout
      open={checkoutOpen}
      url={payUrl}
      amount={current?.price ?? 0}
      planLabel={
        current
          ? `VJ EMMA.SITE ${formatMoney(current.price)} ${current.duration_days} DAYS PASS`
          : null
      }
      reference={tx?.reference ?? null}
      statusMsg={statusMsg}
      onClose={() => setPayUrl(null)}
    />
    </>
  );
}

