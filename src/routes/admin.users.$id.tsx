import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data as db } from "@/lib/fdb";
import { formatMoney } from "@/lib/currency";
import type { Plan } from "@/components/auth/SubscribeModal";

export const Route = createFileRoute("/admin/users/$id")({
  component: UserDetail,
});

const tabs = ["Overview", "Transactions", "Activities", "Account"] as const;
type Tab = (typeof tabs)[number];

function UserDetail() {
  const { id } = useParams({ from: "/admin/users/$id" });
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [planId, setPlanId] = useState("");

  const user = useQuery({
    queryKey: ["admin-user", id],
    queryFn: async () => {
      const [profile, sub, tx, acts, plans, roles] = await Promise.all([
        db.from("profiles").select("*").eq("id", id).maybeSingle(),
        db
          .from("subscriptions")
          .select("*, plans(name)")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        db
          .from("transactions")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        db
          .from("activities")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        db.from("plans").select("*").eq("is_active", true).order("sort_order"),
        db.from("user_roles").select("role").eq("user_id", id),
      ]);
      return {
        profile: profile.data,
        sub: sub.data as (Record<string, unknown> & { plans?: { name: string } }) | null,
        tx: tx.data ?? [],
        acts: acts.data ?? [],
        plans: (plans.data ?? []) as unknown as Plan[],
        isAdmin: (roles.data ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      const plan = user.data?.plans.find((p) => p.id === planId);
      if (!plan) throw new Error("Pick a plan");
      const expires = new Date(Date.now() + plan.duration_days * 864e5).toISOString();
      const existing = user.data?.sub as { id?: string } | null;
      if (existing?.id) {
        const { error } = await db
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: "active",
            started_at: new Date().toISOString(),
            expires_at: expires,
            source: "manual",
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("subscriptions").insert({
          user_id: id,
          plan_id: plan.id,
          status: "active",
          expires_at: expires,
          source: "manual",
        });
        if (error) throw error;
      }
      // Manual activations are comps — they never touch the wallet/ledger,
      // so no transaction row is written.
      await db
        .from("activities")
        .insert({ user_id: id, action: "Subscription activated", detail: plan.name });
    },
    onSuccess: () => {
      toast.success("Subscription activated");
      void qc.invalidateQueries({ queryKey: ["admin-user", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSub = useMutation({
    mutationFn: async () => {
      const existing = user.data?.sub as { id?: string } | null;
      if (!existing?.id) throw new Error("No subscription");
      const { error } = await db
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription cancelled");
      void qc.invalidateQueries({ queryKey: ["admin-user", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProfile = useMutation({
    mutationFn: async (patch: { name?: string; phone?: string; email?: string }) => {
      const { error } = await db.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      void qc.invalidateQueries({ queryKey: ["admin-user", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAdmin = useMutation({
    mutationFn: async (make: boolean) => {
      if (make) {
        const { error } = await db.from("user_roles").insert({ user_id: id, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await db
          .from("user_roles")
          .delete()
          .eq("user_id", id)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      void qc.invalidateQueries({ queryKey: ["admin-user", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = user.data?.profile;
  const sub = user.data?.sub as
    | { status?: string; expires_at?: string | null; source?: string; plans?: { name: string } }
    | null
    | undefined;

  return (
    <div className="space-y-5">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All users
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
          {(p?.name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{p?.name || "Unnamed"}</h1>
          <p className="text-sm text-muted-foreground">
            {p?.phone ?? "—"} · {p?.email ?? "—"}
          </p>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              tab === t
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">Subscription</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{sub?.status ?? "None"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Plan</dt>
                <dd>{sub?.plans?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Source</dt>
                <dd>{sub?.source ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <label className="text-xs font-medium text-muted-foreground">
                Activate manually
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Select a plan</option>
                {(user.data?.plans ?? []).map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} — {formatMoney(pl.price)} / {pl.duration_days}d
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!planId || activate.isPending}
                  onClick={() => activate.mutate()}
                >
                  {activate.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => cancelSub.mutate()}>
                  Cancel subscription
                </Button>
              </div>
            </div>
          </section>

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Joined</dt>
                <dd>{p?.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last seen</dt>
                <dd>{p?.last_seen ? new Date(p.last_seen).toLocaleString() : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Role</dt>
                <dd>{user.data?.isAdmin ? "Admin" : "User"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Lifetime spend</dt>
                <dd>
                  {formatMoney(
                    (user.data?.tx ?? [])
                      .filter((t) => t.kind === "payment" && t.status === "completed")
                      .reduce((s, t) => s + Number(t.amount), 0),
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {tab === "Transactions" && (
        <div className="overflow-x-auto card-soft">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Type</th>
                <th className="px-4 py-2.5 text-left">Amount</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(user.data?.tx ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-xs">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{t.kind}</td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs">{t.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.note}</td>
                </tr>
              ))}
              {!user.data?.tx.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No transactions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Activities" && (
        <ul className="divide-y divide-border card-soft">
          {(user.data?.acts ?? []).map((a) => (
            <li key={a.id} className="flex justify-between px-4 py-3 text-sm">
              <span>
                {a.action}
                {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </li>
          ))}
          {!user.data?.acts.length && (
            <li className="px-4 py-8 text-center text-xs text-muted-foreground">No activity.</li>
          )}
        </ul>
      )}

      {tab === "Account" && (
        <section className="max-w-md space-y-3 card-soft p-4">
          <h2 className="text-sm font-semibold">Account management</h2>
          <Input defaultValue={p?.name ?? ""} id="acc-name" placeholder="Name" className="h-9" />
          <Input defaultValue={p?.phone ?? ""} id="acc-phone" placeholder="Phone" className="h-9" />
          <Input defaultValue={p?.email ?? ""} id="acc-email" placeholder="Email" className="h-9" />
          <Button
            size="sm"
            onClick={() =>
              saveProfile.mutate({
                name: (document.getElementById("acc-name") as HTMLInputElement).value,
                phone: (document.getElementById("acc-phone") as HTMLInputElement).value,
                email: (document.getElementById("acc-email") as HTMLInputElement).value,
              })
            }
          >
            Save changes
          </Button>
          <div className="border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleAdmin.mutate(!user.data?.isAdmin)}
            >
              {user.data?.isAdmin ? "Revoke admin" : "Make admin"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}