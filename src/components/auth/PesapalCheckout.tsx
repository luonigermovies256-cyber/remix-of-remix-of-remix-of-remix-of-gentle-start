import { Loader2, ShieldCheck, X } from "lucide-react";
import { formatMoney } from "@/lib/currency";

/** Floating Pesapal payment window: the hosted checkout inside a styled modal. */
export function PesapalCheckout({
  open,
  url,
  amount,
  planLabel,
  reference,
  statusMsg,
  onClose,
}: {
  open: boolean;
  url: string | null;
  amount: number;
  planLabel?: string | null;
  reference?: string | null;
  statusMsg?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="surface-solid flex h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-vip/40 shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <ShieldCheck className="size-4 text-vip" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold uppercase tracking-wide text-vip">
              {planLabel || `Pay ${formatMoney(amount)}`}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Pesapal · Mobile money & cards{reference ? ` · Ref ${reference}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close payment"
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-white">
          {url ? (
            <iframe
              key={url}
              src={url}
              title="Pesapal checkout"
              className="size-full border-0"
              allow="payment *"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-card">
              <Loader2 className="size-7 animate-spin text-vip" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-vip" />
          {statusMsg || "Checking payment status every second…"}
        </div>
      </div>
    </div>
  );
}
