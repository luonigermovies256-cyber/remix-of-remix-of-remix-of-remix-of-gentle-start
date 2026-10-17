import { Link } from "@tanstack/react-router";
import { ListFilter } from "lucide-react";
import { useGenres } from "@/lib/genres";
import { fileUrl } from "@/lib/storage";

/**
 * Wide, image-backed genre chips (Action, Comedy, ...) shown at the top of
 * every browse page. Genres are managed by the admin.
 *
 * When `onSelect` is passed the chips act as in-page filters instead of
 * navigating to the global genre pages.
 */
export function GenreRail({
  activeSlug,
  onSelect,
}: {
  activeSlug?: string | undefined;
  onSelect?: ((slug: string | null) => void) | undefined;
}) {
  const { genres } = useGenres();
  if (!genres.length) return null;

  const cardClass =
    "relative flex h-[52px] w-[120px] shrink-0 items-center overflow-hidden rounded-lg bg-card ring-1 ring-border transition-transform duration-200 hover:-translate-y-0.5 sm:h-[86px] sm:w-[190px] sm:rounded-xl lg:h-[96px] lg:w-[220px]";
  const labelClass =
    "relative z-10 max-w-[70%] truncate pl-3 text-[13px] font-bold text-foreground sm:pl-4 sm:text-base";

  return (
    <nav
      aria-label="Genres"
      className="scrollbar-none -mx-0 flex gap-2 overflow-x-auto px-2 pb-1 sm:-mx-4 sm:gap-3 sm:px-4 lg:-mx-8 lg:px-8"
    >
      {(() => {
        const inner = (
          <>
            <span className="absolute inset-0 bg-[linear-gradient(100deg,var(--card)_0%,color-mix(in_oklab,var(--brand)_18%,var(--card))_100%)]" />
            <span className={labelClass}>All</span>
            <ListFilter className="relative z-10 ml-auto mr-3 size-4 text-foreground/80 sm:mr-4 sm:size-5" />
          </>
        );
        const cls = `${cardClass} ${!activeSlug ? "ring-2 ring-brand" : ""}`;
        return onSelect ? (
          <button type="button" onClick={() => onSelect(null)} className={cls}>
            {inner}
          </button>
        ) : (
          <Link to="/" className={cls}>
            {inner}
          </Link>
        );
      })()}

      {genres.map((g) => {
        const img = fileUrl(g.image_url);
        const active = g.slug === activeSlug;
        const cls = `${cardClass} ${active ? "ring-2 ring-brand" : ""}`;
        const inner = (
          <>
            {img && (
              <img
                src={img}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
            )}
            <span className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.16_0.006_264/0.94)_0%,oklch(0.16_0.006_264/0.72)_45%,oklch(0.16_0.006_264/0.25)_100%)]" />
            <span className={labelClass}>{g.label}</span>
          </>
        );
        return onSelect ? (
          <button key={g.id} type="button" onClick={() => onSelect(g.slug)} className={cls}>
            {inner}
          </button>
        ) : (
          <Link key={g.id} to="/genre/$slug" params={{ slug: g.slug }} className={cls}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
