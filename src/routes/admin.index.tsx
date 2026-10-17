import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, DollarSign, Radio, TrendingUp, UserCheck, Users } from "lucide-react";
import { data as db } from "@/lib/fdb";

export const Route = createFileRoute("/admin/")({
  component: Overview,
});

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Users;
}) {
  return (
    <div className="card-soft p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="mt-2 text-[22px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Overview() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [users, media, live, subs, tx, recent] = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("media").select("id", { count: "exact", head: true }),
        db.from("media").select("id", { count: "exact", head: true }).eq("kind", "live"),
        db
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        db.from("transactions").select("amount, kind, status, created_at"),
        db
          .from("profiles")
          .select("id, name, phone, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const rows = tx.data ?? [];
      const revenue = rows
        .filter((r) => r.kind === "payment" && r.status === "completed")
        .reduce((s, r) => s + Number(r.amount), 0);
      const monthAgo = Date.now() - 30 * 864e5;
      const monthly = rows
        .filter(
          (r) =>
            r.kind === "payment" &&
            r.status === "completed" &&
            new Date(r.created_at).getTime() > monthAgo,
        )
        .reduce((s, r) => s + Number(r.amount), 0);

      return {
        users: users.count ?? 0,
        media: media.count ?? 0,
        live: live.count ?? 0,
        subs: subs.count ?? 0,
        revenue,
        monthly,
        recent: recent.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
          <p className="text-xs text-muted-foreground">Everything at a glance.</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total users" value={data?.users ?? 0} icon={Users} />
        <StatCard label="Active subscriptions" value={data?.subs ?? 0} icon={UserCheck} />
        <StatCard
          label="Total revenue"
          value={`$${(data?.revenue ?? 0).toFixed(2)}`}
          sub={`$${(data?.monthly ?? 0).toFixed(2)} in the last 30 days`}
          icon={DollarSign}
        />
        <StatCard label="Titles in library" value={data?.media ?? 0} icon={Clapperboard} />
        <StatCard label="Live TV channels" value={data?.live ?? 0} icon={Radio} />
        <StatCard
          label="Conversion"
          value={`${data && data.users ? Math.round((data.subs / data.users) * 100) : 0}%`}
          sub="Subscribers vs users"
          icon={TrendingUp}
        />
      </div>

      <section className="card-soft overflow-hidden">
        <h2 className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">
          Newest clients
        </h2>
        <ul className="divide-y divide-border">
          {(data?.recent ?? []).map((u) => (
            <li key={u.id}>
              <Link
                to="/admin/users/$id"
                params={{ id: u.id }}
                className="flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-accent/30"
              >
                <span className="font-medium">{u.name || "Unnamed"}</span>
                <span className="text-xs text-muted-foreground">{u.phone ?? "—"}</span>
              </Link>
            </li>
          ))}
          {!data?.recent.length && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">No users yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}