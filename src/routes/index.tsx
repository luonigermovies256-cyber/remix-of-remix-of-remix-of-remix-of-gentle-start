import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, ChevronLeft, ChevronRight, Search, Download, Star } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { RowSkeleton } from "@/components/youku/Skeletons";
import { DbRow } from "@/components/youku/DbRow";

import { MobileNav } from "@/components/youku/MobileNav";
import { heroQuery, allMediaQuery } from "@/lib/media";
import { fileUrl } from "@/lib/storage";
import type { MediaItem } from "@/lib/media";
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
  const latest = useQuery(allMediaQuery(300));
  const homeSections = useHomeSections();
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
              <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col justify-end gap-3 px-3 pb-12 pt-10 lg:justify-center lg:gap-4 lg:px-8 lg:pb-0">
                <span className="w-fit rounded-md bg-background/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-go backdrop-blur-md">Streaming</span>
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
                <>
                  <button type="button" aria-label="Previous slide" onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/70 text-foreground ring-1 ring-border backdrop-blur-md"><ChevronLeft className="size-5" /></button>
                  <button type="button" aria-label="Next slide" onClick={() => setIndex((i) => (i + 1) % slides.length)} className="absolute right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/70 text-foreground ring-1 ring-border backdrop-blur-md"><ChevronRight className="size-5" /></button>
                </>
              )}
              {slides.length > 1 && (
                <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 lg:bottom-20 right-5 z-10 flex gap-2 lg:bottom-20 lg:right-8">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-8 bg-go" : "w-2 bg-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
        <HomeLatest items={latest.data ?? []} />

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

function isNew(item: MediaItem) {
  const t = item.created_at ? Date.parse(item.created_at) : 0;
  return Date.now() - t < 14 * 864e5;
}

function PosterCard({ item }: { item: MediaItem }) {
  const poster = fileUrl(item.poster_url ?? item.backdrop_url);
  return (
    <div className="flex w-full flex-col gap-2">
      <Link to="/watch" search={{ id: item.id }} className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-card">
        {poster && <img src={poster} alt={item.title} loading="lazy" className="size-full object-cover" />}
        {isNew(item) && (
          <span className="go-btn absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider">New</span>
        )}
        {item.rating != null && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 text-sm font-bold text-foreground drop-shadow">
            <Star className="size-3.5 fill-vip text-vip" />
            {Number(item.rating).toFixed(1)}
          </span>
        )}
      </Link>
      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
      <Link to="/watch" search={{ id: item.id }} className="go-btn flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold uppercase tracking-widest">
        <Download className="size-4" /> Download
      </Link>
    </div>
  );
}

function HomeLatest({ items }: { items: MediaItem[] }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLElement>(null);
  if (!items.length) return null;
  const fresh = items.filter(isNew);
  const latestList = (fresh.length ? fresh : items).slice(0, 12);
  const t = term.trim().toLowerCase();
  const all = t
    ? items.filter((i) => `${i.title} ${i.genre ?? ""} ${i.actors ?? ""}`.toLowerCase().includes(t))
    : items;
  const scroll = (d: number) => rail.current?.scrollBy({ left: d * rail.current.clientWidth * 0.9, behavior: "smooth" });
  return (
    <div className="space-y-6 px-3 pt-5 sm:px-4 lg:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q);
          allRef.current?.scrollIntoView({ behavior: "smooth" });
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pl-4 pr-1.5"
      >
        <Search className="size-5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, series, anime..."
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" className="go-btn rounded-full px-5 py-2 text-sm font-extrabold uppercase tracking-widest">Go</button>
      </form>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <span className="size-3 rounded-full bg-go" /> Latest Movies
          </h2>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{fresh.length || latestList.length} New</span>
        </div>
        <div className="relative">
          <div ref={rail} className="scrollbar-none grid auto-cols-[calc((100%-1.5rem)/3)] grid-flow-col gap-3 overflow-x-auto scroll-smooth sm:auto-cols-[180px]">
            {latestList.map((i) => <PosterCard key={i.id} item={i} />)}
          </div>
          <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className="absolute left-1 top-[30%] grid size-9 place-items-center rounded-full bg-background/70 text-foreground ring-1 ring-border backdrop-blur-md"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className="absolute right-1 top-[30%] grid size-9 place-items-center rounded-full bg-background/70 text-foreground ring-1 ring-border backdrop-blur-md"><ChevronRight className="size-5" /></button>
        </div>
      </section>

      <section ref={allRef} className="border-t border-border pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-go">All Content</p>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{t ? `Results for "${term}"` : "Movies, Series & Animation"}</h2>
          <span className="text-sm font-semibold text-muted-foreground">{all.length}</span>
        </div>
        {all.length ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {all.map((i) => <PosterCard key={`all-${i.id}`} item={i} />)}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches your search.</p>
        )}
      </section>
    </div>
  );
}
