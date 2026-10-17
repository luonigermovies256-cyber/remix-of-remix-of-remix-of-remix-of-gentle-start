import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { MediaCard } from "@/components/youku/MediaCard";
import { GenreRail } from "@/components/youku/GenreRail";
import { GridSkeleton } from "@/components/youku/Skeletons";
import { allMediaQuery } from "@/lib/media";
import { hasGenre, genreSlugify } from "@/lib/genres";

export const Route = createFileRoute("/genre/$slug")({
  loader: ({ params }) => {
    const label = params.slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    return { label };
  },
  head: ({ loaderData }) => {
    const label = loaderData?.label ?? "Genre";
    const title = `${label} movies & series — VJ EMMA.SITE`;
    const description = `Stream ${label} titles in HD on VJ EMMA.SITE.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: GenrePage,
});

function GenrePage() {
  const { slug } = Route.useParams();
  const { label } = Route.useLoaderData();
  const catalog = useQuery(allMediaQuery(200));
  const items = (catalog.data ?? []).filter((m) => hasGenre(m, genreSlugify(slug)));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative bg-card/40">
          <TopBar />
        </div>
        <main className="px-3 pb-28 pt-16 sm:px-4 lg:px-8 lg:pb-16 lg:pt-4">
          <GenreRail activeSlug={slug} />
          <h1 className="mt-5 text-lg font-bold text-foreground">{label}</h1>
          <div className="mt-3">
            {catalog.isLoading ? (
              <GridSkeleton />
            ) : items.length ? (
              <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9">
                {items.map((m) => (
                  <MediaCard key={m.id} item={m} block />
                ))}
              </div>
            ) : (
              <div className="card-soft p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing tagged {label} yet.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
