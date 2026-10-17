import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MediaCard } from "@/components/youku/MediaCard";
import { RowSkeleton } from "@/components/youku/Skeletons";
import { DbRow } from "@/components/youku/DbRow";

import { MobileNav } from "@/components/youku/MobileNav";
import { heroQuery, allMediaQuery, trendingQuery } from "@/lib/media";
import { fileUrl } from "@/lib/storage";
import { CATEGORIES, type Category } from "@/lib/sections";
import { useSiteCategories } from "@/lib/categories";
import { Film } from "lucide-react";

const HOME_ORDER = [
  "latest",
  "recommended",
  "movies",
  "drama",
  "old-skull",
  "nigerian",
  "short-series",
];
const HIDE_ON_HOME = new Set([
  "home",
  "live-tv",
  "learn-more",
  "upcoming",
  // The unlabeled first rail is already the Trending section.
  "trending",
]);

/** Home rows: the curated order first, then every other active category. */
function useHomeSections(): Category[] {
  const { content } = useSiteCategories();
  const all = content.filter((c) => !HIDE_ON_HOME.has(c.slug));
  const ordered = [
    ...HOME_ORDER.map((slug) => all.find((c) => c.slug === slug)).filter(Boolean),
    ...all.filter((c) => !HOME_ORDER.includes(c.slug)),
  ] as { slug: string; label: string; short: string; blurb: string }[];
  return ordered.map((c) => ({
    slug: c.slug,
    label: c.label,
    short: c.short,
    blurb: c.blurb,
    icon: CATEGORIES.find((b) => b.slug === c.slug)?.icon ?? Film,
  }));
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VJ EMMA.SITE - Drama, Shows, Anime, Movies & Docs Online" },
      {
        name: "description",
        content:
          "Watch hit dramas, variety shows, anime, movies and documentaries in HD on VJ EMMA.SITE. VIP members get early access.",
      },
      { property: "og:title", content: "VJ EMMA.SITE - This World Is Cool" },
      {
        property: "og:description",
        content: "Hit dramas, shows, anime, movies and documentaries streaming in HD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const hero = useQuery(heroQuery());
  const latest = useQuery(allMediaQuery(20));
  const trending = useQuery(trendingQuery(20));
  const homeSections = useHomeSections();
  const rail = useRef<HTMLDivElement>(null);
  const railScroll = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: "smooth" });
  };

  const slides = hero.data ?? [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))];
  const fallback = latest.data?.[0];
  const heroTitle = slide?.title ?? fallback?.title;
  const heroImage = fileUrl(slide?.image_url ?? fallback?.backdrop_url ?? fallback?.poster_url);
  const heroText = slide?.description ?? fallback?.description ?? fallback?.caption ?? null;
  const heroSubtitle = slide?.subtitle ?? fallback?.genre ?? null;
  const heroTarget = slide?.media_id ?? fallback?.id ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative">
          <TopBar />

          {/* Hero carousel */}
          {heroTitle && (
            <section className="relative h-[300px] w-full overflow-hidden sm:h-[400px] lg:h-[460px]">
              {heroImage ? (
                <img
                  key={heroImage}
                  src={heroImage}
                  alt={heroTitle}
                  className="size-full animate-in fade-in object-cover duration-700"
                />
              ) : (
                <div className="size-full bg-card" />
              )}
              <div
                className="absolute inset-0"
                style={{ backgroundImage: "var(--gradient-hero-fade)" }}
              />
              <div
                className="absolute inset-0"
                style={{ backgroundImage: "var(--gradient-hero-bottom)" }}
              />
              <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col justify-end gap-3 px-3 pb-20 pt-10 lg:justify-center lg:gap-4 lg:px-8 lg:pb-0">
                <h1 className="text-3xl font-black tracking-widest text-foreground sm:text-4xl lg:text-5xl">
                  {heroTitle}
                </h1>
                {heroSubtitle && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-foreground/15 px-2 py-1 text-foreground/90">
                      {heroSubtitle}
                    </span>
                  </div>
                )}
                {heroText && (
                  <p className="line-clamp-3 max-w-md text-sm text-foreground/85">{heroText}</p>
                )}
                {heroTarget && (
                  <Link
                    to="/watch"
                    search={{ id: heroTarget }}
                    className="mt-1 flex w-[132px] items-center justify-center gap-2 rounded bg-foreground/20 py-3 text-base font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-foreground/30"
                  >
                    <Play className="size-5 fill-current" />
                    Play
                  </Link>
                )}
              </div>

              {slides.length > 1 && (
                <div className="absolute bottom-20 right-5 z-10 flex gap-2 lg:bottom-20 lg:right-8">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-6 bg-brand" : "w-2 bg-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Trending rail (newest trending upload first) */}
          {!!trending.data?.length && (
            <div className={`relative z-10 pl-3 sm:pl-4 lg:pl-8 ${heroTitle ? "-mt-8 lg:-mt-14" : "mt-4"}`}>
              <div className="group/rail relative">
                <div
                  ref={rail}
                  className="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth pb-1 pr-2 sm:pr-4"
                >
                  {trending.data.map((item) => (
                    <MediaCard key={`trending-${item.id}`} item={item} />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Scroll trending left"
                  onClick={() => railScroll(-1)}
                  className="absolute left-0 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-lg ring-1 ring-border backdrop-blur-md sm:size-10"
                >
                  <ChevronLeft className="size-4 sm:size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Scroll trending right"
                  onClick={() => railScroll(1)}
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow-lg ring-1 ring-border backdrop-blur-md sm:right-4 sm:size-10"
                >
                  <ChevronRight className="size-4 sm:size-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <main className="pb-28 pl-3 sm:pl-4 lg:pb-16 lg:pl-8">
          {latest.isLoading ? (
            <div className="mt-2">
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : !latest.data?.length ? (
            <div className="card-soft mt-8 mr-5 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No titles published yet. Upload content from the admin console to see it here.
              </p>
            </div>
          ) : (
            homeSections.map((c) => <DbRow key={c.slug} category={c} />)
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
