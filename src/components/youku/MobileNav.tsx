import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Icon3D } from "@/components/Icon3D";
import { AuthModal } from "@/components/auth/AuthModal";
import { SubscribeModal } from "@/components/auth/SubscribeModal";
import { useAuth } from "@/lib/auth";

/** Floating liquid-glass bottom navigation with 3D icons, mobile only. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, profile } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);

  const shell =
    "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-semibold transition-all duration-300";
  const tone = (active: boolean) =>
    active
      ? "text-foreground"
      : "text-muted-foreground";

  const Glow = ({ active }: { active: boolean }) => (
    <span
      className={`pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand)_38%,transparent),transparent)] transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    />
  );

  const iconClass = (active: boolean) =>
    `size-6 transition-transform duration-300 ${active ? "-translate-y-0.5 scale-110" : "scale-95 opacity-80"}`;

  const home = pathname === "/";
  const movies = pathname === "/category/movies";
  const series = pathname === "/category/drama";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden">
        <nav className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-[26px] border border-foreground/10 bg-background/70 p-1.5 shadow-[0_10px_34px_-8px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <Link to="/" className={`${shell} ${tone(home)}`}>
            <Glow active={home} />
            <Icon3D name="home" className={`relative ${iconClass(home)}`} />
            <span className="relative">Home</span>
          </Link>

          <Link
            to="/category/$slug"
            params={{ slug: "movies" }}
            className={`${shell} ${tone(movies)}`}
          >
            <Glow active={movies} />
            <Icon3D name="movies" className={`relative ${iconClass(movies)}`} />
            <span className="relative">Movies</span>
          </Link>

          <Link
            to="/category/$slug"
            params={{ slug: "drama" }}
            className={`${shell} ${tone(series)}`}
          >
            <Glow active={series} />
            <Icon3D name="drama" className={`relative ${iconClass(series)}`} />
            <span className="relative">Series</span>
          </Link>

          <button type="button" onClick={() => setSubOpen(true)} className={`${shell} ${tone(false)}`}>
            <Icon3D name="vip" className={iconClass(false)} />
            <span>VIP</span>
          </button>

          <button
            type="button"
            onClick={() => !session && setAuthOpen(true)}
            className={`${shell} ${tone(false)}`}
          >
            {session && profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="size-6 rounded-full object-cover ring-1 ring-brand/60"
              />
            ) : (
              <Icon3D name="profile" className={iconClass(false)} />
            )}
            <span>{session ? "Me" : "Log in"}</span>
          </button>
        </nav>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <SubscribeModal
        open={subOpen}
        onOpenChange={setSubOpen}
        onNeedAuth={() => setAuthOpen(true)}
      />
    </>
  );
}
