import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useFirebaseAuth } from "@/lib/firebase-auth";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My dashboard — VJ EMMA.SITE" },
      { name: "description", content: "Your VJ EMMA.SITE viewer dashboard." },
      { property: "og:title", content: "My dashboard — VJ EMMA.SITE" },
      { property: "og:description", content: "Your VJ EMMA.SITE viewer dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading, logout } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/dashboard" }, replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <Link to="/" className="text-sm font-black text-foreground">← VJ EMMA.SITE</Link>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold uppercase text-primary-foreground">
              {(user.displayName || user.email || "U").charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">{user.displayName || "Viewer"}</h1>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await logout();
            navigate({ to: "/login", search: { redirect: "/dashboard" }, replace: true });
          }}
        >
          Logout
        </Button>
      </div>
    </main>
  );
}
