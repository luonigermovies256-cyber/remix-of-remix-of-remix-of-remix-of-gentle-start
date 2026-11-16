import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Film, Tv, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSiteCategories } from "@/lib/categories";

/** Flat bottom menu bar (Home, Movies, Series, Menu), mobile only. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { content } = useSiteCategories();
  const [menuOpen, setMenuOpen] = useState(false);
  const item = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold ${
      active ? "text-active" : "text-muted-foreground"
    }`;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Link to="/" className={item(pathname === "/")}>
          <Home className="size-6" /> Home
        </Link>
        <Link to="/category/$slug" params={{ slug: "movies" }} className={item(pathname === "/category/movies")}>
          <Film className="size-6" /> Movies
        </Link>
        <Link to="/category/$slug" params={{ slug: "drama" }} className={item(pathname === "/category/drama")}>
          <Tv className="size-6" /> Series
        </Link>
        <button type="button" onClick={() => setMenuOpen(true)} className={item(menuOpen)}>
          <Menu className="size-6" /> Menu
        </button>
      </nav>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="bg-card">
          <SheetHeader>
            <SheetTitle>DWONLUOMOVIES</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-1">
            {content.map((c) => (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/10"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
