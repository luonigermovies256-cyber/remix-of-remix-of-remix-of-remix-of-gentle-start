import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Film, Tv, Music } from "lucide-react";
import type { ReactNode } from "react";

/** Flat bottom bar (Home, Movies, Series, Music), mobile only. Active icon sits in a filled pill. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tab = (active: boolean, icon: ReactNode, label: string) => (
    <span className="flex flex-col items-center gap-1">
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
          active ? "bg-active text-background" : "text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className={`text-[11px] font-semibold ${active ? "text-active" : "text-muted-foreground"}`}>{label}</span>
    </span>
  );
  const cls = "flex flex-1 items-center justify-center py-2";
  const ic = "size-5";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <Link to="/" className={cls}>{tab(pathname === "/", <Home className={ic} />, "Home")}</Link>
      <Link to="/category/$slug" params={{ slug: "movies" }} className={cls}>
        {tab(pathname === "/category/movies", <Film className={ic} />, "Movies")}
      </Link>
      <Link to="/category/$slug" params={{ slug: "drama" }} className={cls}>
        {tab(pathname === "/category/drama", <Tv className={ic} />, "Series")}
      </Link>
      <Link to="/category/$slug" params={{ slug: "music" }} className={cls}>
        {tab(pathname === "/category/music", <Music className={ic} />, "Music")}
      </Link>
    </nav>
  );
}
