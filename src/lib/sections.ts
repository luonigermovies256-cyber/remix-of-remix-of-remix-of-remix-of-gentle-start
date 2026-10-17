import {
  Home,
  Flame,
  Clock3,
  Sparkles,
  Trophy,
  Film,
  Tv,
  Heart,
  Smile,
  Disc3,
  Globe2,
  Clapperboard,
  Radio,
  CalendarClock,
  CalendarDays,
  Info,
  type LucideIcon,
} from "lucide-react";

export type Category = {
  slug: string;
  /** Short label used in the sidebar. */
  short: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
};

/** Sidebar / section taxonomy. `label` is also the value stored on media.section. */
export const CATEGORIES: Category[] = [
  { slug: "home", short: "Home", label: "Home", icon: Home, blurb: "Everything worth watching, in one place." },
  { slug: "trending", short: "Trending", label: "Trending", icon: Flame, blurb: "What everyone is watching right now." },
  { slug: "latest", short: "Latest", label: "Latest", icon: Clock3, blurb: "Freshly added titles and new episodes." },
  {
    slug: "recommended", short: "For You",
    label: "Recommended",
    icon: Sparkles,
    blurb: "Hand-picked titles we think you'll love.",
  },
  { slug: "top-50", short: "Top 50", label: "Top 50", icon: Trophy, blurb: "The fifty most watched titles this season." },
  { slug: "movies", short: "Movies", label: "Movies", icon: Film, blurb: "Full-length films, ready to stream." },
  { slug: "drama", short: "Drama", label: "Drama", icon: Tv, blurb: "Long-form drama series and mini-series." },
  { slug: "love-story", short: "Love", label: "Love Story", icon: Heart, blurb: "Romance, heartbreak and happy endings." },
  { slug: "animation", short: "Anime", label: "Animation", icon: Smile, blurb: "Animated features and anime series." },
  { slug: "old-skull", short: "Classics", label: "Old Skull", icon: Disc3, blurb: "Classics and throwbacks worth revisiting." },
  { slug: "nigerian", short: "Naija", label: "Nigerian", icon: Globe2, blurb: "Nollywood hits and homegrown stories." },
  {
    slug: "short-series", short: "Shorts",
    label: "Short Series",
    icon: Clapperboard,
    blurb: "Bite-size series you can finish tonight.",
  },
  { slug: "live-tv", short: "Live TV", label: "Live TV", icon: Radio, blurb: "Live channels streaming around the clock." },
  {
    slug: "upcoming-selections", short: "Upcoming",
    label: "Upcoming Selections",
    icon: CalendarClock,
    blurb: "Coming soon to VJ EMMA.SITE.",
  },
  {
    slug: "for-the-week", short: "Weekly",
    label: "For the Week",
    icon: CalendarDays,
    blurb: "This week's curated line-up.",
  },
  { slug: "learn-more", short: "About", label: "Learn More", icon: Info, blurb: "About VJ EMMA.SITE, VIP and support." },
];

export const CONTENT_CATEGORIES = CATEGORIES.filter(
  (c) => c.slug !== "home" && c.slug !== "learn-more",
);

export const SECTIONS = CATEGORIES.filter((c) => c.slug !== "learn-more").map((c) => c.label);

export function categoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export const BADGES = [
  "",
  "VIP",
  "SVIP",
  "Free",
  "Exclusive",
  "Premiere",
  "TOP",
  "New",
  "Update",
  "HD",
  "4K",
] as const;

export const BADGE_POSITIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

export function badgePositionClass(pos: string | null | undefined) {
  switch (pos) {
    case "top-left":
      return "left-0 top-0 rounded-br-md";
    case "bottom-left":
      return "bottom-0 left-0 rounded-tr-md";
    case "bottom-right":
      return "bottom-0 right-0 rounded-tl-md";
    default:
      return "right-0 top-0 rounded-bl-md";
  }
}

export function badgeToneClass(badge: string | null | undefined) {
  switch (badge) {
    case "VIP":
    case "SVIP":
      return "badge-vip";
    case "Free":
    case "TOP":
    case "New":
      return "badge-hot";
    case "Exclusive":
    case "Premiere":
      return "bg-brand text-brand-foreground";
    default:
      return "bg-foreground/25 text-foreground backdrop-blur-sm";
  }
}
