import { Link, useRouterState } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png";
import { Icon3D } from "@/components/Icon3D";
import { useAuth } from "@/lib/auth";
import { useSiteCategories } from "@/lib/categories";

export function Sidebar() {
  const { isAdmin } = useAuth();
  const { all: categories } = useSiteCategories();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const itemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${
      active
        ? "text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
    }`;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col bg-sidebar backdrop-blur-2xl lg:flex">
      <Link to="/" className="flex h-16 shrink-0 items-center gap-2 pl-0 pr-2">
        <img src={logoAsset} alt="VJ EMMA.SITE logo" className="size-11 shrink-0" />
        <span className="whitespace-nowrap text-[15px] font-black uppercase tracking-tight text-foreground">
          VJ EMMA.SITE
        </span>
      </Link>
      <nav className="scrollbar-none flex-1 overflow-y-auto pb-4">
        {categories.map(({ slug, short, icon }) => {
          const to = slug === "home" ? "/" : `/category/${slug}`;
          const active = slug === "home" ? pathname === "/" : pathname === to;
          const inner = (
            <>
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-sidebar-primary" />
              )}
              <Icon3D name={icon} className="size-8 shrink-0" />
              <span className="truncate">{short}</span>
            </>
          );
          return slug === "home" ? (
            <Link key={slug} to="/" className={itemClass(active)}>
              {inner}
            </Link>
          ) : (
            <Link
              key={slug}
              to="/category/$slug"
              params={{ slug }}
              className={itemClass(active)}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
      {isAdmin && (
        <div className="shrink-0 border-t border-sidebar-border bg-sidebar backdrop-blur-2xl p-3">
          <Link
            to="/admin"
            className="group relative flex min-h-16 items-center gap-3 overflow-hidden rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-foreground shadow-lg transition-colors hover:bg-primary/25"
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
            <Icon3D name="admin" className="size-11" />
            <span className="min-w-0">
              <span className="block text-[13px] font-black uppercase">ADMIN PANEL</span>
              <span className="block truncate text-[10px] font-semibold uppercase text-muted-foreground">
                Manage platform
              </span>
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
