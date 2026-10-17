import { Link } from "@tanstack/react-router";
import { badgePositionClass, badgeToneClass } from "@/lib/sections";
import { fileUrl } from "@/lib/storage";
import type { MediaItem } from "@/lib/media";

export function MediaCard({ item, block = false }: { item: MediaItem; block?: boolean }) {
  return (
    <Link
      to="/watch"
      search={{ id: item.id }}
      className={`group block ${block ? "w-full" : "w-[30.5vw] shrink-0 sm:w-[168px]"}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform duration-200 group-hover:-translate-y-1 group-hover:ring-brand">
        {item.poster_url ? (
          <img
            src={fileUrl(item.poster_url) ?? ""}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center px-2 text-center text-sm text-muted-foreground">
            {item.title}
          </div>
        )}
        {item.badge && (
          <span
            className={`absolute px-1.5 py-0.5 text-[10px] font-bold leading-tight ${badgePositionClass(item.badge_position)} ${badgeToneClass(item.badge)}`}
          >
            {item.badge}
          </span>
        )}
        {item.badge2 && (
          <span
            className={`absolute px-1.5 py-0.5 text-[10px] font-bold leading-tight ${badgePositionClass(
              item.badge_position === "top-left" ? "top-right" : "top-left",
            )} ${badgeToneClass(item.badge2)}`}
          >
            {item.badge2}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
        {item.caption || item.title}
      </p>
    </Link>
  );
}
