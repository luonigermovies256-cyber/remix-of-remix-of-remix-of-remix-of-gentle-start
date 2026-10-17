import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MediaCard } from "@/components/youku/MediaCard";
import { GenreRail } from "@/components/youku/GenreRail";
import { MobileNav } from "@/components/youku/MobileNav";
import { GridSkeleton } from "@/components/youku/Skeletons";
import { Icon3D } from "@/components/Icon3D";
import { sectionQuery, allMediaQuery, inSection, type MediaItem } from "@/lib/media";
import { categoryBySlug } from "@/lib/sections";
import { hasGenre } from "@/lib/genres";
import { useSiteCategories, CONTENT_FALLBACK_BLURB } from "@/lib/categories";
import { readHistory } from "@/lib/history";
import { recommendMedia } from "@/lib/recommend.functions";

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    const category = categoryBySlug(params.slug);
    const label =
      category?.label ??
      params.slug
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    return { label, blurb: category?.blurb ?? CONTENT_FALLBACK_BLURB };
  },
  head: ({ loaderData }) => {
    const label = loaderData?.label ?? "Browse";
    const blurb = loaderData?.blurb ?? CONTENT_FALLBACK_BLURB;
    const title = `${label} — VJ EMMA.SITE`;
    return {
      meta: [
        { title },
        { name: "description", content: blurb },
        { property: "og:title", content: title },
        { property: "og:description", content: blurb },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CategoryPage,
});

const NO_GENRE_RAIL = ["live-tv", "learn-more"];

function Shell({
  slug,
  children,
  activeGenre,
  onGenre,
}: {
  slug?: string;
  children: React.ReactNode;
  activeGenre?: string | undefined;
  onGenre?: (slug: string | null) => void;
}) {
  const showGenres = !slug || !NO_GENRE_RAIL.includes(slug);
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-14 bg-card/40">
          <TopBar />
        </div>
        <main className="px-3 pb-28 pt-5 sm:px-4 lg:px-8 lg:pb-16 lg:pt-4">
          {showGenres && (
            <GenreRail activeSlug={activeGenre ?? undefined} onSelect={onGenre} />
          )}
          <div className="mt-4 sm:mt-5">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function Grid({ items }: { items: MediaItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9">
      {items.map((m) => (
        <MediaCard key={m.id} item={m} block />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="card-soft p-8 text-center">
      <p className="text-sm text-muted-foreground">Nothing published in {label} yet.</p>
    </div>
  );
}

/** AI-ranked feed based on what this viewer has been watching. */
function ForYou({ genre }: { genre: string | null }) {
  const catalog = useQuery(allMediaQuery(120));
  const [ordered, setOrdered] = useState<MediaItem[] | null>(null);
  const [smart, setSmart] = useState(false);
  const items = useMemo(() => catalog.data ?? [], [catalog.data]);

  useEffect(() => {
    if (!items.length) return;
    let cancelled = false;
    const history = readHistory().map((h) => ({
      title: h.title,
      genre: h.genre ?? null,
      section: h.section ?? null,
    }));
    void recommendMedia({
      data: {
        history,
        candidates: items.map((m) => ({
          id: m.id,
          title: m.title,
          genre: m.genre,
          section: m.section,
        })),
      },
    })
      .then((res) => {
        if (cancelled) return;
        const byId = new Map(items.map((m) => [m.id, m]));
        const list = res.ids.map((id) => byId.get(id)).filter(Boolean) as MediaItem[];
        setOrdered(list.length ? list : items);
        setSmart(!!history.length && !!list.length);
      })
      .catch(() => {
        if (!cancelled) setOrdered(items);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (catalog.isLoading) return <GridSkeleton />;
  const base = ordered ?? items;
  const list = genre ? base.filter((m) => hasGenre(m, genre)) : base;
  if (!list.length) return <Empty label="Recommended" />;

  return (
    <>
      <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-4 text-brand" />
        {smart
          ? "Picked for you by our AI recommender, based on what you have been watching."
          : "Start watching a few titles and our AI recommender will personalise this page."}
      </p>
      <Grid items={list} />
    </>
  );
}

/** Slugs that should also pull in everything of a given media kind. */
const KIND_FOR_SLUG: Record<string, string[]> = {
  movies: ["movie", "film"],
  drama: ["series", "drama", "tv", "show"],
};

function CategoryPage() {
  const { slug } = Route.useParams();
  const { all } = useSiteCategories();
  const category = all.find((c) => c.slug === slug);
  const { label: fallbackLabel } = Route.useLoaderData();
  const label = category?.label ?? fallbackLabel;
  const [genre, setGenre] = useState<string | null>(null);

  useEffect(() => {
    setGenre(null);
  }, [slug]);

  const isLearn = slug === "learn-more";
  const isForYou = slug === "recommended";
  const kinds = KIND_FOR_SLUG[slug];

  const sectionItems = useQuery({
    ...sectionQuery(label, 120),
    enabled: !isLearn && !isForYou && !kinds,
  });

  // Movies / Series pages list every title of that kind, plus anything the
  // admin explicitly filed under the section.
  const catalog = useQuery({ ...allMediaQuery(200), enabled: !!kinds });
  const kindItems = kinds
    ? (catalog.data ?? []).filter(
        (m) => kinds.includes((m.kind ?? "").toLowerCase()) || inSection(m, label),
      )
    : [];

  const rawItems = kinds ? kindItems : (sectionItems.data ?? []);
  const items = {
    isLoading: kinds ? catalog.isLoading : sectionItems.isLoading,
    // Genre chips filter only the titles that belong to this page.
    data: genre ? rawItems.filter((m) => hasGenre(m, genre)) : rawItems,
  };


  if (isLearn) {
    return (
      <Shell slug={slug}>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card-soft p-5">
            <h2 className="text-base font-semibold">About VJ EMMA.SITE</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              VJ EMMA.SITE streams movies, drama, animation, Nollywood titles and live channels in
              HD. New titles land every week and VIP members get them first.
            </p>
          </section>
          <section className="card-soft p-5">
            <h2 className="text-base font-semibold">VIP membership</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              VIP unlocks early episodes, exclusive premieres, ad-free playback and 4K where
              available. Manage your plan any time from your profile.
            </p>
          </section>
          <section className="card-soft p-5">
            <h2 className="text-base font-semibold">Browse by section</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {all
                .filter((c) => c.slug !== "home" && c.slug !== "learn-more")
                .map((c) => (
                  <Link
                    key={c.slug}
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Icon3D name={c.icon} className="size-4" />
                    {c.label}
                  </Link>
                ))}
            </div>
          </section>
          <section className="card-soft p-5">
            <h2 className="text-base font-semibold">Support</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Playback trouble, billing questions or a title request? Reach out from the profile
              menu and our team will respond within 24 hours.
            </p>
          </section>
        </div>
      </Shell>
    );
  }

  if (isForYou) {
    return (
      <Shell slug={slug} activeGenre={genre ?? undefined} onGenre={setGenre}>
        <ForYou genre={genre} />
      </Shell>
    );
  }

  return (
    <Shell slug={slug} activeGenre={genre ?? undefined} onGenre={setGenre}>
      {items.isLoading ? (
        <GridSkeleton />
      ) : items.data?.length ? (
        <Grid items={items.data} />
      ) : (
        <Empty label={genre ? `${label} · ${genre}` : label} />
      )}
    </Shell>
  );
}
