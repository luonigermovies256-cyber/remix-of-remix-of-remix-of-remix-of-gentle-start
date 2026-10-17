import { useQuery } from "@tanstack/react-query";
import { data as db } from "@/lib/fdb";
import { CATEGORIES, type Category } from "@/lib/sections";

/** A category row managed from the admin dashboard. */
export type DbCategory = {
  id: string;
  slug: string;
  label: string;
  short: string | null;
  blurb: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type SiteCategory = {
  slug: string;
  label: string;
  short: string;
  blurb: string;
  icon: string;
  builtin: boolean;
};

export const BUILTIN_CATEGORIES: SiteCategory[] = CATEGORIES.map((c: Category) => ({
  slug: c.slug,
  label: c.label,
  short: c.short,
  blurb: c.blurb,
  icon: c.slug,
  builtin: true,
}));

export const CONTENT_FALLBACK_BLURB = "Browse titles on VJ EMMA.SITE.";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function categoriesQuery() {
  return {
    queryKey: ["categories"],
    queryFn: async (): Promise<DbCategory[]> => {
      const { data, error } = await db.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as DbCategory[];
    },
  };
}

/** Built-in categories plus anything the admin added, de-duplicated by slug. */
export function mergeCategories(rows: DbCategory[] | undefined): SiteCategory[] {
  const out = [...BUILTIN_CATEGORIES];
  for (const r of rows ?? []) {
    if (r.is_active === false) continue;
    const slug = r.slug || slugify(r.label);
    if (!slug) continue;
    const mapped: SiteCategory = {
      slug,
      label: r.label,
      short: r.short || r.label,
      blurb: r.blurb || "",
      icon: r.icon || slug,
      builtin: false,
    };
    const i = out.findIndex((c) => c.slug === slug);
    if (i >= 0) out[i] = { ...out[i]!, ...mapped, builtin: out[i]!.builtin };
    else out.push(mapped);
  }
  return out;
}

/** All categories available site-wide (built-in + admin managed). */
export function useSiteCategories() {
  const q = useQuery(categoriesQuery());
  const all = mergeCategories(q.data);
  return {
    all,
    content: all.filter((c) => c.slug !== "home" && c.slug !== "learn-more"),
    isLoading: q.isLoading,
  };
}

/** Section labels an admin can assign media to. */
export function useSectionOptions() {
  const { all } = useSiteCategories();
  return all.filter((c) => c.slug !== "learn-more").map((c) => c.label);
}
