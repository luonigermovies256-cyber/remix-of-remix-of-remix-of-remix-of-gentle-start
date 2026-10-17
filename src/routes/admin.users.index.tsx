import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { data as db } from "@/lib/fdb";

export const Route = createFileRoute("/admin/users/")({
  component: UsersList,
});

function since(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Online now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function UsersList() {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: subs }] = await Promise.all([
        db.from("profiles").select("*").order("created_at", { ascending: false }),
        db.from("subscriptions").select("user_id, status, expires_at, plan_id"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        sub: (subs ?? []).find((s) => s.user_id === p.id) ?? null,
      }));
    },
  });

  const rows = (data ?? []).filter((u) =>
    `${u.name} ${u.phone ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Users / Clients</h1>
          <p className="text-xs text-muted-foreground">{rows.length} accounts</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email"
            className="h-9 rounded-xl pl-9 text-sm"
          />
        </div>
      </header>

      <div className="card-soft overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Phone</th>
              <th className="px-4 py-2 text-left font-medium">Subscription</th>
              <th className="px-4 py-2 text-left font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => {
              const active =
                u.sub?.status === "active" &&
                (!u.sub.expires_at || new Date(u.sub.expires_at) > new Date());
              return (
                <tr key={u.id} className="cursor-pointer hover:bg-accent/30">
                  <td className="px-4 py-2.5">
                    <Link to="/admin/users/$id" params={{ id: u.id }} className="block font-medium">
                      {u.name || "Unnamed"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <Link to="/admin/users/$id" params={{ id: u.id }} className="block">
                      {u.phone ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link to="/admin/users/$id" params={{ id: u.id }} className="block">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          active
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {active ? "Active" : "Free"}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    <Link to="/admin/users/$id" params={{ id: u.id }} className="block">
                      {since(u.last_seen)}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}