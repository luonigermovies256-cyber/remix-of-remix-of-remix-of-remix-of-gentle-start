import { data as db } from "@/lib/fdb";

export type MediaItem = {
  id: string;
  kind: string;
  title: string;
  caption: string | null;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  video_url: string | null;
  stream_url: string | null;
  genre: string | null;
  actors: string | null;
  year: number | null;
  rating: number | null;
  duration_min: number | null;
  section: string;
  sections?: string[] | null;
  badge: string | null;
  badge2: string | null;
  badge_position: string | null;
  is_vip: boolean;
  views: number;
  created_at?: string | null;
};

export type Episode = {
  id: string;
  media_id: string;
  episode_number: number;
  season: number;
  title: string | null;
  is_vip: boolean;
  video_url: string | null;
  thumbnail_url: string | null;
};

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  media_id: string | null;
  is_active: boolean;
  sort_order: number;
};

const COLUMNS =
  "id,kind,title,caption,description,poster_url,backdrop_url,video_url,stream_url,genre,actors,year,rating,duration_min,section,sections,badge,badge2,badge_position,is_vip,views,created_at";

/** A title can be assigned to several sections; `section` is the primary one. */
export function mediaSections(item: Pick<MediaItem, "section" | "sections">): string[] {
  const list = Array.isArray(item.sections) ? item.sections.filter(Boolean) : [];
  const all = [item.section, ...list].filter(Boolean) as string[];
  return Array.from(new Set(all));
}

export function inSection(item: MediaItem, section: string) {
  return mediaSections(item).includes(section);
}

export function sectionQuery(section: string, limit = 24) {
  return {
    queryKey: ["media-section", section, limit],
    queryFn: async (): Promise<MediaItem[]> => {
      const { data, error } = await db
        .from("media")
        .select(COLUMNS)
        .eq("is_published", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as MediaItem[];
      return rows.filter((m) => inSection(m, section)).slice(0, limit);
    },
  };
}

/** All published titles, newest first. */

/** Trending rail: only titles tagged Trending, newest upload first. */
export function trendingQuery(limit = 20) {
  return {
    queryKey: ["media-trending", limit],
    queryFn: async (): Promise<MediaItem[]> => {
      const { data, error } = await db.from("media").select(COLUMNS).eq("is_published", true);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MediaItem[];
      return rows
        .filter((m) => inSection(m, "Trending"))
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
        .slice(0, limit);
    },
  };
}

export function allMediaQuery(limit = 60) {
  return {
    queryKey: ["media-all", limit],
    queryFn: async (): Promise<MediaItem[]> => {
      const { data, error } = await db
        .from("media")
        .select(COLUMNS)
        .eq("is_published", true)
        .order("sort_order")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as MediaItem[];
    },
  };
}

export function mediaByIdQuery(id: string) {
  return {
    queryKey: ["media-item", id],
    enabled: !!id,
    queryFn: async (): Promise<MediaItem | null> => {
      const { data, error } = await db
        .from("media")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as MediaItem | null;
    },
  };
}

export function episodesQuery(mediaId: string) {
  return {
    queryKey: ["media-episodes", mediaId],
    enabled: !!mediaId,
    queryFn: async (): Promise<Episode[]> => {
      const { data, error } = await db
        .from("episodes")
        .select("*")
        .eq("media_id", mediaId)
        .order("season")
        .order("episode_number");
      if (error) throw error;
      return (data ?? []) as unknown as Episode[];
    },
  };
}

export function heroQuery() {
  return {
    queryKey: ["hero-slides"],
    queryFn: async (): Promise<HeroSlide[]> => {
      const { data, error } = await db
        .from("hero_slides")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as HeroSlide[];
    },
  };
}
