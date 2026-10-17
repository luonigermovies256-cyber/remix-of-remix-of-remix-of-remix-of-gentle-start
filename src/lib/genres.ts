import { useQuery } from "@tanstack/react-query";
import { data as db } from "@/lib/fdb";
import { allMediaQuery, type MediaItem } from "@/lib/media";


/** A genre (Action, Comedy, ...) managed from the admin dashboard. */
export type Genre = {
  id: string;
  slug: string;
  label: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export function genreSlugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function genresQuery() {
  return {
    queryKey: ["genres"],
    queryFn: async (): Promise<Genre[]> => {
      const { data, error } = await db.from("genres").select("*").order("sort_order");
      if (error) throw error;
      return ((data ?? []) as unknown as Genre[]).map((g) => ({
        ...g,
        slug: g.slug || genreSlugify(g.label ?? ""),
      }));
    },
  };
}

/**
 * Active genres for the public site: the ones the admin created, plus any
 * genre typed into a title's Genre field that isn't saved yet.
 */
export function useGenres() {
  const q = useQuery(genresQuery());
  const catalog = useQuery(allMediaQuery(200));

  const saved = (q.data ?? []).filter((g) => g.is_active !== false && !!g.label);
  const seen = new Set(saved.map((g) => genreSlugify(g.slug || g.label)));
  const derived: Genre[] = [];

  for (const m of catalog.data ?? []) {
    for (const label of mediaGenres(m)) {
      const slug = genreSlugify(label);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      derived.push({
        id: `derived-${slug}`,
        slug,
        label,
        image_url: m.poster_url ?? m.backdrop_url ?? null,
        sort_order: 999,
        is_active: true,
      });
    }
  }

  return {
    genres: [...saved, ...derived],
    isLoading: q.isLoading,
  };
}


/** A title can carry several comma separated genres. */
export function mediaGenres(item: Pick<MediaItem, "genre">): string[] {
  return (item.genre ?? "")
    .split(/[,/|]/)
    .map((g) => g.trim())
    .filter(Boolean);
}

export function hasGenre(item: Pick<MediaItem, "genre">, label: string) {
  const target = genreSlugify(label);
  return mediaGenres(item).some((g) => genreSlugify(g) === target);
}
