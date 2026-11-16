import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { MobileNav } from "@/components/youku/MobileNav";
import { allMediaQuery } from "@/lib/media";
import { fileUrl } from "@/lib/storage";
import type { MediaItem } from "@/lib/media";
import logoAsset from "@/assets/logo.png";
import { AuthModal } from "@/components/auth/AuthModal";
import { SubscribeModal } from "@/components/auth/SubscribeModal";
import { useAuth } from "@/lib/auth";
import { useFirebaseAuth } from "@/lib/firebase-auth";

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
  const { session } = useAuth();
  const viewer = useFirebaseAuth();
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const term = q.trim().toLowerCase();
  const items = (latest.data ?? []).filter((m) => !term || m.title.toLowerCase().includes(term));
  const signedIn = !!session || !!viewer.user;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src={logoAsset} alt="DWONLUOMOVIES logo" className="size-9 rounded-full object-cover ring-1 ring-border" />
          <span className="hidden text-base font-black tracking-tight text-foreground min-[480px]:inline sm:text-lg">DWONLUOMOVIES</span>
        </Link>
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search movies"
            placeholder="Search movies..."
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        <button type="button" onClick={() => setSubOpen(true)} className="shrink-0 rounded-full bg-accent-orange px-3.5 py-2 text-sm font-bold text-accent-orange-foreground">
          Subscribe
        </button>
        {signedIn ? (
          <Link to="/dashboard" className="shrink-0 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-foreground">Me</Link>
        ) : (
          <button type="button" onClick={() => setAuthOpen(true)} className="shrink-0 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-foreground">
            Log in
          </button>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-2 pb-28 pt-3 lg:pb-12">
        {latest.isLoading ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-card" />
            ))}
          </div>
        ) : !items.length ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {term ? `No movies match "${q}".` : "No movies published yet."}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5 lg:grid-cols-7">
            {items.map((m) => <GridCard key={m.id} item={m} />)}
          </div>
        )}
      </main>
      <MobileNav />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <SubscribeModal open={subOpen} onOpenChange={setSubOpen} onNeedAuth={() => setAuthOpen(true)} />
    </div>
  );
}

function GridCard({ item }: { item: MediaItem }) {
  const poster = fileUrl(item.poster_url ?? item.backdrop_url);
  return (
    <Link to="/watch" search={{ id: item.id }} className="block min-w-0">
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-card">
        {poster && <img src={poster} alt={item.title} loading="lazy" className="size-full object-cover text-[0px]" />}
      </div>
      <p className="mt-1.5 truncate text-[13px] font-bold uppercase text-foreground">{item.title}</p>
      {item.year && <p className="text-[11px] text-muted-foreground">{item.year}</p>}
    </Link>
  );
}
