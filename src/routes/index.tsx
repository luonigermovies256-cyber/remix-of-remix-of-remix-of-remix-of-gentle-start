import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HomeGrid } from "@/components/youku/HomeGrid";
import { allMediaQuery } from "@/lib/media";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DWONLUOMOVIES - Watch Latest Movies & Series Online" },
      {
        name: "description",
        content:
          "Watch hit dramas, variety shows, anime, movies and documentaries in HD on DWONLUOMOVIES. VIP members get early access.",
      },
      { property: "og:title", content: "DWONLUOMOVIES - Latest Movies & Series" },
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
  const latest = useQuery(allMediaQuery(300));
  return <HomeGrid data={latest.data} isLoading={latest.isLoading} />;
}
