import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { sectionQuery } from "@/lib/media";
import { MediaCard } from "./MediaCard";
import type { Category } from "@/lib/sections";

export function DbRow({
  category,
  hideHeading = false,
}: {
  category: Category;
  hideHeading?: boolean;
}) {
  const items = useQuery(sectionQuery(category.label, 20));
  const scroller = useRef<HTMLDivElement>(null);

  if (!items.data?.length) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 320), behavior: "smooth" });
  };

  return (
    <section className={hideHeading ? "mt-4" : "mt-8"}>
      {!hideHeading && (
        <div className="mb-3 flex items-end justify-between gap-4 pr-5">
          <h2 className="truncate text-xl font-bold text-foreground">{category.label}</h2>
          <Link
            to="/category/$slug"
            params={{ slug: category.slug }}
            className="flex shrink-0 items-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            See all
            <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
      <div className="group/row relative">
        <div
          ref={scroller}
          className="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth pb-1 pr-5"
        >
          {items.data.map((m) => (
            <MediaCard key={m.id} item={m} />
          ))}
        </div>
        <button
          type="button"
          aria-label={`Scroll ${category.label} left`}
          onClick={() => scrollBy(-1)}
          className="absolute -left-1 top-[38%] hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-lg ring-1 ring-border backdrop-blur-md transition hover:bg-background sm:grid"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label={`Scroll ${category.label} right`}
          onClick={() => scrollBy(1)}
          className="absolute right-4 top-[38%] hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-lg ring-1 ring-border backdrop-blur-md transition hover:bg-background sm:grid"
        >
          <ChevronRight className="size-5" />
        </button>

      </div>
    </section>
  );
}
