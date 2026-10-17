import { createFileRoute } from "@tanstack/react-router";
import { Player } from "@/components/youku/Player";

/**
 * Embeddable player surface: /embed?src=<url>&title=<name>&poster=<url>
 * Drop into any site with:
 * <iframe src="https://<host>/embed?src=..." allowfullscreen allow="picture-in-picture"></iframe>
 */
export const Route = createFileRoute("/embed")({
  validateSearch: (search: Record<string, unknown>) => ({
    src: typeof search["src"] === "string" ? search["src"] : "",
    title: typeof search["title"] === "string" ? search["title"] : "",
    poster: typeof search["poster"] === "string" ? search["poster"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Nexus Embedded Player | VJ EMMA.SITE" },
      {
        name: "description",
        content:
          "Embeddable liquid-glass video player with adaptive quality from 360P to 4K, subtitles and full playback controls.",
      },
      { property: "og:title", content: "Nexus Embedded Player" },
      {
        property: "og:description",
        content: "Liquid-glass embeddable player with adaptive 360P–4K quality and full controls.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Embed,
});

function Embed() {
  const { src, title, poster } = Route.useSearch();

  return (
    <main className="grid min-h-screen place-items-center bg-black">
      {src ? (
        <Player
          src={src}
          poster={poster || undefined}
          title={title || undefined}
          className="aspect-video w-full"
        />
      ) : (
        <p className="p-6 text-center text-sm text-white/60">
          Add a <code>?src=</code> parameter with the video URL to load the player.
        </p>
      )}
    </main>
  );
}
