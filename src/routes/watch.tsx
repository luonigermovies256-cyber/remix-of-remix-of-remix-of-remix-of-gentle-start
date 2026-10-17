import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Download, MessageCircle, Share2 } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MediaCard } from "@/components/youku/MediaCard";
import { Player } from "@/components/youku/Player";
import { ActorRail } from "@/components/youku/ActorRail";
import { WatchSkeleton } from "@/components/youku/Skeletons";
import { episodesQuery, mediaByIdQuery, sectionQuery, allMediaQuery } from "@/lib/media";
import { fileUrl } from "@/lib/storage";
import { recordWatch } from "@/lib/history";
import { useSubscription } from "@/lib/subscription";
import { downloadVideo, playableUrl } from "@/lib/download";
import { AuthModal } from "@/components/auth/AuthModal";
import { SubscribeModal } from "@/components/auth/SubscribeModal";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/logo.png";

export const Route = createFileRoute("/watch")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Watch Free Online | VJ EMMA.SITE" },
      {
        name: "description",
        content:
          "Stream movies, drama series, anime and live channels in HD on VJ EMMA.SITE, with episodes and related titles.",
      },
      { property: "og:title", content: "Watch on VJ EMMA.SITE" },
      {
        property: "og:description",
        content: "Stream movies, drama series and anime in HD with episodes and related titles.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Watch,
});

function Watch() {
  const { id } = Route.useSearch();
  const media = useQuery(mediaByIdQuery(id));
  const episodes = useQuery(episodesQuery(id));
  const item = media.data;
  const related = useQuery({
    ...sectionQuery(item?.section ?? "", 18),
    enabled: !!item?.section,
  });
  const fallbackList = useQuery({ ...allMediaQuery(18), enabled: !id });

  const eps = episodes.data ?? [];
  const [activeEp, setActiveEp] = useState<string>("");
  const [theater, setTheater] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const { signedIn, isActive, loading: subLoading } = useSubscription();

  useEffect(() => {
    setActiveEp("");
  }, [id]);

  useEffect(() => {
    if (item) {
      recordWatch({
        id: item.id,
        title: item.title,
        genre: item.genre,
        section: item.section,
      });
    }
  }, [item]);

  const current = eps.find((e) => e.id === activeEp) ?? eps[0] ?? null;
  const nextEp = current ? (eps[eps.findIndex((e) => e.id === current.id) + 1] ?? null) : null;
  // For series, the episode's own VIP flag decides; standalone titles use their own flag.
  const vipRequired = current ? !!current.is_vip : !!item?.is_vip;
  const locked = vipRequired && !isActive && !subLoading;

  const requireVip = () => {
    if (!signedIn) {
      toast.info("Sign in and subscribe to watch VIP content.");
      setAuthOpen(true);
      return;
    }
    toast.info("This is VIP content — an active subscription is required.");
    setSubOpen(true);
  };

  const src = fileUrl(current?.video_url ?? item?.video_url ?? item?.stream_url);
  const playSrc = src ? playableUrl(src) : null;
  const poster = fileUrl(item?.backdrop_url ?? item?.poster_url);

  const downloadName = `${item?.title ?? "video"}${
    current ? ` S${current.season}E${current.episode_number}` : ""
  }`.replace(/[\\/:*?"<>|]+/g, "-");

  const [progress, setProgress] = useState<number | null>(null);

  /**
   * S3/OneAxcess originals are re-served by the download worker with a proper
   * filename; everything else is streamed into a blob so the browser download
   * manager handles it instead of opening the video URL in a tab.
   */
  const handleDownload = () => {
    if (locked) {
      requireVip();
      return;
    }
    if (!src || downloading) return;
    setDownloading(true);
    setProgress(null);
    void downloadVideo(src, downloadName, (pct) => setProgress(pct))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Download failed"))
      .finally(() => {
        setTimeout(() => {
          setDownloading(false);
          setProgress(null);
        }, 1200);
      });
  };

  if (!id) {
    return (
      <Shell>
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">Pick a title to start watching.</p>
        </div>
        <Grid items={fallbackList.data ?? []} />
      </Shell>
    );
  }

  if (media.isLoading) {
    return (
      <Shell>
        <WatchSkeleton />
      </Shell>
    );
  }

  if (!item) {
    return (
      <Shell>
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">This title is no longer available.</p>
          <Link to="/" className="mt-3 inline-block text-sm text-primary underline">
            Back home
          </Link>
        </div>
      </Shell>
    );
  }

  const relatedItems = (related.data ?? []).filter((m) => m.id !== item.id);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-14 bg-card/40">
          <TopBar />
        </div>
        <div
          className={`flex flex-col gap-6 px-3 py-0 sm:px-4 sm:py-5 lg:px-8 ${theater ? "" : "lg:flex-row"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="relative -mx-3 aspect-video w-screen overflow-hidden rounded-none bg-black sm:mx-0 sm:w-full sm:rounded-[1.25rem]">
              {locked ? (
                <div className="flex size-full flex-col items-center justify-center bg-black/80 px-6 text-center">
                  <Lock className="size-7 text-vip" />
                  <p className="mt-2 text-sm font-semibold text-foreground">VIP content</p>
                  <p className="mt-1 max-w-xs text-xs leading-snug text-muted-foreground">
                    An active subscription is required to watch and download this
                    {current ? " episode" : " title"}.
                  </p>
                  <button
                    type="button"
                    onClick={requireVip}
                    className="mt-3 rounded-full badge-vip px-5 py-2 text-sm font-bold"
                  >
                    {signedIn ? "Subscribe now" : "Sign in to subscribe"}
                  </button>
                </div>
              ) : playSrc ? (
                <Player
                  src={playSrc}
                  poster={poster ?? undefined}
                  title={`${item.title}${current ? ` · S${current.season} E${current.episode_number}` : ""}`}
                  onNext={nextEp ? () => setActiveEp(nextEp.id) : undefined}
                  onTheater={() => setTheater((t) => !t)}
                  theater={theater}
                  className="size-full"
                />

              ) : (
                <div className="grid size-full place-items-center px-6 text-center text-sm text-muted-foreground">
                  No video uploaded for this title yet.
                </div>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-bold text-foreground">
              {item.title}
              {current ? ` · S${current.season} E${current.episode_number}` : ""}
            </h1>

            <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-hidden sm:flex-wrap sm:gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={(!src && !locked) || downloading}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-secondary px-2 py-2 text-xs text-foreground/85 transition-colors hover:bg-brand/15 hover:text-brand disabled:opacity-50 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
              >
                {locked ? <Lock className="size-4 shrink-0" /> : <Download className="size-4 shrink-0" />}
                <span className="truncate">
                  {downloading
                    ? progress != null
                      ? `${progress}%`
                      : "Downloading…"
                    : locked
                      ? "VIP"
                      : "Download"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = window.location.href;
                  if (navigator.share) void navigator.share({ title: item.title, url });
                  else void navigator.clipboard?.writeText(url);
                }}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-secondary px-2 py-2 text-xs text-foreground/85 transition-colors hover:bg-brand/15 hover:text-brand sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Share2 className="size-4 shrink-0" /> <span className="truncate">Share</span>
              </button>
              <button
                type="button"
                onClick={() => setSaved((s) => !s)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 py-2 text-xs transition-colors sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${
                  saved ? "bg-brand/15 text-brand" : "bg-secondary text-foreground/85 hover:bg-brand/15 hover:text-brand"
                }`}
              >
                <Bookmark className={`size-4 shrink-0 ${saved ? "fill-current" : ""}`} />{" "}
                <span className="truncate">Save</span>
              </button>
              <button
                type="button"
                onClick={() => setShowComments((c) => !c)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 py-2 text-xs transition-colors sm:flex-none sm:gap-2 sm:px-4 sm:text-sm ${
                  showComments
                    ? "bg-brand/15 text-brand"
                    : "bg-secondary text-foreground/85 hover:bg-brand/15 hover:text-brand"
                }`}
              >
                <MessageCircle className="size-4 shrink-0" /> <span className="truncate">Comment</span>
              </button>
            </div>

            <ActorRail actors={item.actors} />

            {showComments && (
              <div className="card-soft mt-4 max-w-3xl p-4">
                <textarea
                  rows={3}
                  placeholder="Write a comment…"
                  className="w-full resize-none rounded-lg bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <p className="mt-2 text-xs text-muted-foreground">Comments are coming soon.</p>
              </div>
            )}

            {eps.length > 0 && (
              <div className="mt-4 lg:hidden">
                <h2 className="text-sm font-semibold text-foreground">Episodes</h2>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {eps.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => setActiveEp(ep.id)}
                      title={ep.title ?? `Episode ${ep.episode_number}`}
                      className={`relative min-w-11 shrink-0 rounded-lg py-2 text-sm ${
                        current?.id === ep.id
                          ? "bg-brand/15 font-semibold text-brand"
                          : "bg-secondary text-foreground/80"
                      }`}
                    >
                      {ep.episode_number}
                      {ep.is_vip && (
                        <span className="absolute right-0.5 top-0.5 text-[8px] font-bold text-vip">
                          VIP
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}


            {!!relatedItems.length && (
              <>
                <h2 className="mt-8 text-lg font-bold text-foreground">More in {item.section}</h2>
                <Grid items={relatedItems} />
              </>
            )}
          </div>

          {/* Right rail */}
          <aside className="w-full shrink-0 lg:w-[380px]">
            <div className="hidden items-center gap-2 border-b border-border pb-3 lg:flex">
              <img src={logoAsset} alt="VJ EMMA.SITE logo" className="size-6 shrink-0" />
              <span className="whitespace-nowrap text-base font-bold tracking-tight text-foreground">
                VJ EMMA.SITE
              </span>
            </div>


            {eps.length > 0 ? (
              <div className="mt-4 hidden lg:block">
                <h2 className="text-sm font-semibold text-foreground">Episodes</h2>
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {eps.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => setActiveEp(ep.id)}
                      title={ep.title ?? `Episode ${ep.episode_number}`}
                      className={`relative rounded py-2 text-sm ${
                        current?.id === ep.id
                          ? "bg-brand/15 font-semibold text-brand"
                          : "bg-secondary text-foreground/80 hover:text-foreground"
                      }`}
                    >
                      {ep.episode_number}
                      {ep.is_vip && (
                        <span className="absolute right-0.5 top-0.5 text-[8px] font-bold text-vip">
                          VIP
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!!relatedItems.length && (
              <div className="hidden lg:block">
                <h2 className="mt-6 text-lg font-bold text-foreground">You may also like</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {relatedItems.slice(0, 8).map((v) => (
                    <Link
                      key={v.id}
                      to="/watch"
                      search={{ id: v.id }}
                      className="group flex gap-3"
                    >
                      <div className="h-[76px] w-[136px] shrink-0 overflow-hidden rounded bg-muted">
                        {v.poster_url && (
                          <img
                            src={fileUrl(v.poster_url) ?? ""}
                            alt={v.title}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm text-foreground/90 group-hover:text-foreground">
                          {v.title}
                        </p>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          {v.caption ?? v.genre ?? ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <SubscribeModal
        open={subOpen}
        onOpenChange={setSubOpen}
        onNeedAuth={() => setAuthOpen(true)}
      />
    </div>
  );
}

function Grid({ items }: { items: { id: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3 lg:grid-cols-6">
      {items.map((m) => (
        <MediaCard key={m.id} item={m as never} block />
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-14 bg-card/40">
          <TopBar />
        </div>
        <main className="px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
