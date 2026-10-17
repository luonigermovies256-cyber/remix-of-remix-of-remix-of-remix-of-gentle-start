import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Icon3D } from "@/components/Icon3D";
import logoAsset from "@/assets/logo.png";
import { AuthModal } from "@/components/auth/AuthModal";
import { SubscribeModal } from "@/components/auth/SubscribeModal";
import { useAuth } from "@/lib/auth";
import { useSiteCategories } from "@/lib/categories";
import { getSetting, loadAppSettings, type MobileAppSettings } from "@/lib/app-settings";
import { usePwaInstall } from "@/lib/pwa";
import { toast } from "sonner";

/** Tabs shown in the mobile top strip, in order. */
const TOP_TABS = [
  "trending",
  "latest",
  "recommended",
  "top-50",
  "movies",
  "drama",
  "animation",
  "short-series",
  "upcoming-selections",
];

export function TopBar() {
  const { session, profile, isAdmin, signOut } = useAuth();
  const { content: allCategories } = useSiteCategories();
  const categories = TOP_TABS.map((slug) => allCategories.find((c) => c.slug === slug)).filter(
    (c): c is NonNullable<typeof c> => !!c,
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { canInstall, installed, install } = usePwaInstall();

  /** Triggers the real browser install of our app — no manual steps shown. */
  const installApp = async () => {
    if (installed) {
      toast.success("Our app is already installed on this device.");
      return;
    }
    if (await install()) {
      toast.success("Installing VJ EMMA.SITE — check your home screen.");
      return;
    }
    if (canInstall) return; // user dismissed the native prompt
    const app = getSetting<MobileAppSettings>("mobile_app");
    const href = app?.link || app?.file_path;
    if (href) {
      window.open(href, "_blank", "noopener");
      return;
    }
    toast("Install our app", {
      description: "Open this site in Chrome or Safari and tap install to get the app.",
    });
  };
  const [authOpen, setAuthOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    void loadAppSettings().catch(() => undefined);
  }, []);

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-3 px-3 lg:gap-4 lg:pl-[calc(var(--sidebar-w)+20px)]">
      <Link to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
        <img src={logoAsset} alt="VJ EMMA.SITE logo" className="size-8 shrink-0 object-contain" />
        <span className="truncate text-[15px] font-black tracking-tight text-foreground">
          VJ EMMA.SITE
        </span>
      </Link>
      <nav
        aria-label="Sections"
        className="scrollbar-none hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto"
      >
        <Link
          to="/"
          className={`shrink-0 text-[15px] font-bold ${pathname === "/" ? "text-foreground" : "text-foreground/70"}`}
        >
          Home
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            to="/category/$slug"
            params={{ slug: c.slug }}
            className={`shrink-0 text-[15px] font-medium ${
              pathname === `/category/${c.slug}` ? "font-bold text-foreground" : "text-foreground/70"
            }`}
          >
            {c.slug === "drama" ? "Series" : c.short}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex min-w-0 flex-1 justify-end max-lg:flex-none">
        <button
          type="button"
          aria-label="Search"
          onClick={() => setSearchOpen((v) => !v)}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/12 backdrop-blur-md lg:hidden"
        >
          <Icon3D name="search" className="size-5" />
        </button>
        <div className="hidden h-9 w-full max-w-[340px] items-center gap-2 rounded-full bg-foreground/12 px-4 backdrop-blur-md lg:flex">
          <input
            aria-label="Search"
            defaultValue=""
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/70 focus:outline-none"
          />
          <Icon3D name="search" className="size-5" />
        </div>
      </div>
      {searchOpen && (
        <div className="absolute inset-x-3 top-14 z-30 flex h-10 items-center gap-2 rounded-full bg-card backdrop-blur-2xl px-4 ring-1 ring-border lg:hidden">
          <input
            autoFocus
            aria-label="Search"
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Icon3D name="search" className="size-5" />
        </div>
      )}
      <button
        onClick={() => setSubOpen(true)}
        className="hidden shrink-0 items-center gap-1.5 rounded-full badge-vip px-4 py-1.5 text-sm font-semibold sm:flex"
      >
        <Icon3D name="vip" className="size-5" />
        VIP Deals
      </button>
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-foreground/12 p-1 backdrop-blur-md">
        <div className="hidden items-center md:flex">
          {[
            { label: "History", icon: "history" },
          ].map(({ label, icon }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-foreground/85 transition-colors hover:bg-foreground/12 hover:text-foreground"
            >
              <Icon3D name={icon} className="size-5" />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void installApp()}
          className="flex items-center gap-1.5 rounded-full badge-app px-3 py-1.5 text-[12px] font-semibold shadow-sm"
        >
          <Icon3D name="app" className="size-5" />
          <span className="hidden sm:inline">App</span>
          <span className="sm:hidden">VJ EMMA</span>
        </button>
        {isAdmin && (
          <Link
            to="/admin"
            className="rounded-full px-3 py-1.5 text-[12px] text-foreground/85 transition-colors hover:bg-foreground/12 hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Icon3D name="admin" className="size-4" /> Admin
            </span>
          </Link>
        )}
        {session ? (
          <button
            onClick={() => void signOut()}
            title="Sign out"
            className="flex items-center gap-2 rounded-full bg-foreground/15 py-1 pl-1 pr-3 text-[12px] font-medium text-foreground hover:bg-foreground/25"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="size-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold uppercase text-primary-foreground">
                {(profile?.name || session.user.email || "U").trim().charAt(0)}
              </span>
            )}
            <span className="max-w-[110px] truncate">{profile?.name || "Account"}</span>
          </button>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            className="rounded-full bg-foreground/15 px-3.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-foreground/25"
          >
            Log in
          </button>
        )}
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <SubscribeModal
        open={subOpen}
        onOpenChange={setSubOpen}
        onNeedAuth={() => setAuthOpen(true)}
      />
    </header>
  );
}