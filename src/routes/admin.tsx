import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BarChart3, Clapperboard, LogOut, Settings, Users, Wallet } from "lucide-react";
import logoAsset from "@/assets/logo.png";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — VJ EMMA.SITE" },
      { name: "description", content: "Manage media, users, wallet and settings." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Console — VJ EMMA.SITE" },
      { property: "og:description", content: "Manage media, users, wallet and settings." },
    ],
  }),
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: typeof Users; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { to: "/admin/media", label: "Media", icon: Clapperboard },
  { to: "/admin/users", label: "Users / Clients", icon: Users },
  { to: "/admin/wallet", label: "Wallet", icon: Wallet },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const { isAdmin, loading, session, signOut, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading console…
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <img src={logoAsset} alt="" className="size-10" />
        <h1 className="text-lg font-semibold">Admin access only</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {session
            ? "This account does not have admin rights."
            : "Sign in with an admin account to open the console."}
        </p>
        <Link to="/" className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Back to site
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-surface flex min-h-screen w-full bg-background lg:p-3">
      <aside className="card-soft fixed inset-y-3 left-3 z-30 hidden w-[196px] flex-col lg:flex">
        <Link to="/" className="flex h-14 shrink-0 items-center gap-2 px-4">
          <img src={logoAsset} alt="" className="size-6" />
          <span className="whitespace-nowrap text-[13px] font-bold tracking-tight">
            VJ EMMA.SITE
          </span>
        </Link>
        <div className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Console
        </div>
        <nav className="flex-1 space-y-1 px-2.5">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors ${
                  active
                    ? "bg-primary/12 font-medium text-foreground"
                    : "text-sidebar-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-lg ${
                    active ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="m-2.5 rounded-xl bg-muted/40 p-2.5">
          <div className="px-1 pb-2 text-xs">
            <div className="truncate font-medium">{profile?.name || "Admin"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{profile?.phone}</div>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-[13px] text-sidebar-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[200px]">
        <nav className="scrollbar-none flex gap-1.5 overflow-x-auto px-3 py-2 lg:hidden">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="whitespace-nowrap rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}