import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UploadField } from "@/components/admin/UploadField";
import { GenrePicker } from "@/components/admin/GenrePicker";
import { data as db } from "@/lib/fdb";
import { fileUrl } from "@/lib/storage";
import { BADGES, BADGE_POSITIONS } from "@/lib/sections";
import {
  categoriesQuery,
  mergeCategories,
  slugify,
  type DbCategory,
} from "@/lib/categories";

export const Route = createFileRoute("/admin/media")({
  component: MediaAdmin,
});

type Kind = "movie" | "series" | "live";
type Tab = Kind | "episodes" | "hero" | "categories";

type MediaRow = {
  id: string;
  kind: Kind;
  title: string;
  caption: string | null;
  description: string | null;
  section: string;
  sections: string[];
  badge: string | null;
  badge2: string | null;
  badge_position: string;
  genre: string | null;
  actors: string | null;
  year: number | null;
  duration_min: number | null;
  is_vip: boolean;
  poster_url: string | null;
  video_url: string | null;
  stream_url: string | null;
  is_published: boolean;
  sort_order: number;
};

type EpisodeRow = {
  id: string;
  media_id: string;
  episode_number: number;
  title: string | null;
  season: number;
  is_vip: boolean;
  video_url: string | null;
  thumbnail_url: string | null;
};

type HeroRow = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  media_id: string | null;
  is_active: boolean;
  sort_order: number;
};

const tabs: { key: Tab; label: string }[] = [
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
  { key: "episodes", label: "Episodes" },
  { key: "live", label: "Live TV" },
  { key: "hero", label: "Hero carousel" },
  { key: "categories", label: "Categories" },
];

const emptyMedia = (kind: Kind): Partial<MediaRow> => ({
  kind,
  title: "",
  caption: "",
  description: "",
  section: kind === "live" ? "Live TV" : "Home",
  sections: [kind === "live" ? "Live TV" : "Home"],
  badge: "",
  badge2: "",
  badge_position: "top-right",
  genre: "",
  actors: "",
  year: null,
  duration_min: null,
  is_vip: false,
  poster_url: null,
  video_url: null,
  stream_url: "",
  is_published: true,
  sort_order: 0,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function MediaAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("movie");
  const [editing, setEditing] = useState<Partial<MediaRow> | null>(null);
  const [editingHero, setEditingHero] = useState<Partial<HeroRow> | null>(null);
  const [editingEp, setEditingEp] = useState<Partial<EpisodeRow> | null>(null);
  const [seriesId, setSeriesId] = useState<string>("");
  const [editingCat, setEditingCat] = useState<Partial<DbCategory> | null>(null);

  const categories = useQuery(categoriesQuery());
  const siteCategories = useMemo(() => mergeCategories(categories.data), [categories.data]);
  const sectionOptions = useMemo(
    () => siteCategories.filter((c) => c.slug !== "learn-more").map((c) => c.label),
    [siteCategories],
  );

  const media = useQuery({
    queryKey: ["admin-media"],
    queryFn: async () => {
      const { data, error } = await db
        .from("media")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MediaRow[];
    },
  });

  const heroes = useQuery({
    queryKey: ["admin-hero"],
    queryFn: async () => {
      const { data, error } = await db.from("hero_slides").select("*").order("sort_order");
      if (error) throw error;
      return data as unknown as HeroRow[];
    },
  });

  const seriesList = useMemo(
    () => (media.data ?? []).filter((m) => m.kind === "series"),
    [media.data],
  );
  const activeSeries = seriesId || seriesList[0]?.id || "";

  const episodes = useQuery({
    queryKey: ["admin-episodes", activeSeries],
    enabled: !!activeSeries,
    queryFn: async () => {
      const { data, error } = await db
        .from("episodes")
        .select("*")
        .eq("media_id", activeSeries)
        .order("season")
        .order("episode_number");
      if (error) throw error;
      return data as unknown as EpisodeRow[];
    },
  });

  const saveMedia = useMutation({
    mutationFn: async (row: Partial<MediaRow>) => {
      const payload = { ...row };
      delete (payload as { id?: string }).id;
      const { error } = row.id
        ? await db.from("media").update(payload).eq("id", row.id)
        : await db.from("media").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMedia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      void qc.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveHero = useMutation({
    mutationFn: async (row: Partial<HeroRow>) => {
      const payload = { ...row };
      delete (payload as { id?: string }).id;
      const { error } = row.id
        ? await db.from("hero_slides").update(payload).eq("id", row.id)
        : await db.from("hero_slides").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditingHero(null);
      void qc.invalidateQueries({ queryKey: ["admin-hero"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeHero = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("hero_slides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-hero"] });
    },
  });

  const saveCat = useMutation({
    mutationFn: async (row: Partial<DbCategory>) => {
      const label = (row.label ?? "").trim();
      if (!label) throw new Error("Give the category a name");
      const payload = {
        label,
        slug: row.slug ? slugify(row.slug) : slugify(label),
        short: row.short || label,
        blurb: row.blurb ?? "",
        icon: row.icon || "",
        sort_order: Number(row.sort_order ?? 0),
        is_active: row.is_active ?? true,
      };
      const { error } = row.id
        ? await db.from("categories").update(payload).eq("id", row.id)
        : await db.from("categories").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category saved");
      setEditingCat(null);
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const toggleSection = (label: string) => {
    const current = editing?.sections?.length
      ? editing.sections
      : editing?.section
        ? [editing.section]
        : [];
    const next = current.includes(label)
      ? current.filter((s) => s !== label)
      : [...current, label];
    setEditing({ ...editing, sections: next, section: next[0] ?? "Home" });
  };

  const saveEp = useMutation({
    mutationFn: async (row: Partial<EpisodeRow>) => {
      const payload = { ...row, media_id: activeSeries };
      delete (payload as { id?: string }).id;
      const { error } = row.id
        ? await db.from("episodes").update(payload).eq("id", row.id)
        : await db.from("episodes").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Episode saved");
      setEditingEp(null);
      void qc.invalidateQueries({ queryKey: ["admin-episodes", activeSeries] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("episodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-episodes", activeSeries] }),
  });

  const list = (media.data ?? []).filter((m) => m.kind === tab);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Media</h1>
          <p className="text-sm text-muted-foreground">
            Upload movies, series, episodes, live channels and hero slides.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (tab === "categories")
              setEditingCat({ label: "", short: "", blurb: "", sort_order: 0, is_active: true });
            else if (tab === "hero") setEditingHero({ title: "", is_active: true, sort_order: 0 });
            else if (tab === "episodes")
              setEditingEp({
                episode_number: (episodes.data?.length ?? 0) + 1,
                season: 1,
                is_vip: false,
              });
            else setEditing(emptyMedia(tab));
          }}
        >
          <Plus className="mr-1 size-4" /> New
        </Button>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "categories" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {siteCategories.map((c) => {
            const row = (categories.data ?? []).find((r) => (r.slug || slugify(r.label)) === c.slug);
            return (
              <div key={c.slug} className="card-soft p-3">
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">/{c.slug}</div>
                <div className="mt-2 flex items-center gap-2">
                  {c.builtin && !row ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Built-in</span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditingCat(
                        row ?? {
                          label: c.label,
                          slug: c.slug,
                          short: c.short,
                          blurb: c.blurb,
                          icon: c.icon,
                          sort_order: 0,
                          is_active: true,
                        },
                      )
                    }
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  {row && (
                    <Button size="sm" variant="outline" onClick={() => removeCat.mutate(row.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === "hero" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(heroes.data ?? []).map((h) => (
            <div key={h.id} className="overflow-hidden card-soft">
              {h.image_url && (
                <img src={fileUrl(h.image_url) ?? ""} alt="" className="h-28 w-full object-cover" />
              )}
              <div className="p-3">
                <div className="text-sm font-semibold">{h.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">{h.subtitle}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingHero(h)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeHero.mutate(h.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!heroes.data?.length && (
            <p className="text-xs text-muted-foreground">No hero slides yet.</p>
          )}
        </div>
      ) : tab === "episodes" ? (
        <div className="space-y-3">
          <Field label="Series">
            <select
              value={activeSeries}
              onChange={(e) => setSeriesId(e.target.value)}
              className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
            >
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
              {!seriesList.length && <option value="">Create a series first</option>}
            </select>
          </Field>
          <div className="overflow-hidden card-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">S/E</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">VIP</th>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(episodes.data ?? []).map((ep) => (
                  <tr key={ep.id}>
                    <td className="px-3 py-2">
                      S{ep.season} · E{ep.episode_number}
                    </td>
                    <td className="px-3 py-2">{ep.title || `Episode ${ep.episode_number}`}</td>
                    <td className="px-3 py-2 text-xs">{ep.is_vip ? "VIP" : "Free"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {ep.video_url ? "Uploaded" : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setEditingEp(ep)}
                        className="mr-2 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => removeEp.mutate(ep.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!episodes.data?.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No episodes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {media.isLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {list.map((m) => (
            <div key={m.id} className="flex gap-3 card-soft p-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                {m.poster_url && (
                  <img
                    src={fileUrl(m.poster_url) ?? ""}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">{m.caption}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {Array.from(new Set([m.section, ...(m.sections ?? [])].filter(Boolean))).map(
                    (s) => (
                      <span key={s} className="rounded bg-muted px-1.5 py-0.5">
                        {s}
                      </span>
                    ),
                  )}
                  {m.badge && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">
                      {m.badge}
                    </span>
                  )}
                  {!m.is_published && (
                    <span className="rounded bg-destructive/20 px-1.5 py-0.5">Hidden</span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeMedia.mutate(m.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!media.isLoading && !list.length && (
            <p className="text-xs text-muted-foreground">Nothing here yet.</p>
          )}
        </div>
      )}

      {/* Media dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="flex max-h-[90dvh] w-[96vw] max-w-5xl flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
          <h2 className="text-base font-semibold capitalize">
            {editing?.id ? "Edit" : "New"} {editing?.kind}
          </h2>
          <div className="-mr-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 grid gap-x-5 gap-y-3 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Title">
                <Input
                  value={editing?.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </Field>
              <Field label="Caption">
                <Input
                  value={editing?.caption ?? ""}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={2}
                  value={editing?.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field label="Display sections — pick every page this should show on">
                <div className="flex flex-wrap gap-1.5">
                  {sectionOptions.map((s) => {
                    const chosen = editing?.sections?.length
                      ? editing.sections
                      : editing?.section
                        ? [editing.section]
                        : [];
                    const active = chosen.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSection(s)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Genre">
                  <GenrePicker
                    value={editing?.genre ?? ""}
                    onChange={(v) => setEditing({ ...editing, genre: v })}
                  />
                </Field>
                <Field label="Actors (comma separated)">
                  <Input
                    value={editing?.actors ?? ""}
                    onChange={(e) => setEditing({ ...editing, actors: e.target.value })}
                    placeholder="Jackie Chan, Zhang Ziyi"
                  />
                </Field>
              </div>


              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Badge">
                  <select
                    value={editing?.badge ?? ""}
                    onChange={(e) => setEditing({ ...editing, badge: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {BADGES.map((b) => (
                      <option key={b} value={b}>
                        {b || "None"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Second badge">
                  <select
                    value={editing?.badge2 ?? ""}
                    onChange={(e) => setEditing({ ...editing, badge2: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {BADGES.map((b) => (
                      <option key={b} value={b}>
                        {b || "None"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Badge corner">
                  <select
                    value={editing?.badge_position ?? "top-right"}
                    onChange={(e) => setEditing({ ...editing, badge_position: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {BADGE_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Year">
                  <Input
                    type="number"
                    value={editing?.year ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        year: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Field>
                <Field label="Duration (min)">
                  <Input
                    type="number"
                    value={editing?.duration_min ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        duration_min: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Field>
                <Field label="Sort order">
                  <Input
                    type="number"
                    value={editing?.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing?.is_published ?? true}
                    onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing?.is_vip ?? false}
                    onChange={(e) => setEditing({ ...editing, is_vip: e.target.checked })}
                  />
                  VIP only
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <UploadField
                label="Poster"
                folder="posters"
                accept="image/*"
                value={editing?.poster_url ?? null}
                onChange={(p) => setEditing({ ...editing, poster_url: p })}
              />

              {editing?.kind === "live" ? (
                <Field label="Stream URL (m3u8)">
                  <Input
                    value={editing?.stream_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, stream_url: e.target.value })}
                    placeholder="https://…/index.m3u8"
                  />
                </Field>
              ) : editing?.kind === "movie" ? (
                <UploadField
                  label="Movie file"
                  folder="videos"
                  accept="video/*"
                  preview="none"
                  value={editing?.video_url ?? null}
                  onChange={(p) => setEditing({ ...editing, video_url: p })}
                />
              ) : (
                <p className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
                  Save this series, then open the Episodes tab, pick this series and add episodes.
                </p>
              )}

              <Button
                className="w-full"
                disabled={saveMedia.isPending || !editing?.title}
                onClick={() => editing && saveMedia.mutate(editing)}
              >
                {saveMedia.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hero dialog */}
      <Dialog open={!!editingHero} onOpenChange={(v) => !v && setEditingHero(null)}>
        <DialogContent className="flex max-h-[90dvh] w-[96vw] max-w-4xl flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
          <h2 className="text-base font-semibold">{editingHero?.id ? "Edit" : "New"} hero slide</h2>
          <div className="-mr-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 grid gap-x-5 gap-y-3 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Title">
                <Input
                  value={editingHero?.title ?? ""}
                  onChange={(e) => setEditingHero({ ...editingHero, title: e.target.value })}
                />
              </Field>
              <Field label="Subtitle">
                <Input
                  value={editingHero?.subtitle ?? ""}
                  onChange={(e) => setEditingHero({ ...editingHero, subtitle: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={editingHero?.description ?? ""}
                  onChange={(e) => setEditingHero({ ...editingHero, description: e.target.value })}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <UploadField
                label="Backdrop"
                folder="hero"
                accept="image/*"
                value={editingHero?.image_url ?? null}
                onChange={(p) => setEditingHero({ ...editingHero, image_url: p })}
              />
              <Field label="Links to title">
                <select
                  value={editingHero?.media_id ?? ""}
                  onChange={(e) =>
                    setEditingHero({ ...editingHero, media_id: e.target.value || null })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  {(media.data ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingHero?.is_active ?? true}
                  onChange={(e) => setEditingHero({ ...editingHero, is_active: e.target.checked })}
                />
                Active
              </label>
              <Button
                className="w-full"
                disabled={saveHero.isPending || !editingHero?.title}
                onClick={() => editingHero && saveHero.mutate(editingHero)}
              >
                {saveHero.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={!!editingCat} onOpenChange={(v) => !v && setEditingCat(null)}>
        <DialogContent className="w-[96vw] max-w-lg rounded-2xl">
          <h2 className="text-base font-semibold">
            {editingCat?.id ? "Edit" : "New"} category
          </h2>
          <div className="space-y-3">
            <Field label="Name (also the section label on media)">
              <Input
                value={editingCat?.label ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, label: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sidebar label">
                <Input
                  value={editingCat?.short ?? ""}
                  onChange={(e) => setEditingCat({ ...editingCat, short: e.target.value })}
                />
              </Field>
              <Field label="URL slug">
                <Input
                  value={editingCat?.slug ?? ""}
                  placeholder="auto from name"
                  onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                rows={2}
                value={editingCat?.blurb ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, blurb: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Icon key (optional)">
                <Input
                  value={editingCat?.icon ?? ""}
                  placeholder="movies, drama, trending…"
                  onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
                />
              </Field>
              <Field label="Sort order">
                <Input
                  type="number"
                  value={editingCat?.sort_order ?? 0}
                  onChange={(e) =>
                    setEditingCat({ ...editingCat, sort_order: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingCat?.is_active ?? true}
                onChange={(e) => setEditingCat({ ...editingCat, is_active: e.target.checked })}
              />
              Visible on the site
            </label>
            <Button
              className="w-full"
              disabled={saveCat.isPending || !editingCat?.label}
              onClick={() => editingCat && saveCat.mutate(editingCat)}
            >
              {saveCat.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Episode dialog */}
      <Dialog open={!!editingEp} onOpenChange={(v) => !v && setEditingEp(null)}>
        <DialogContent className="flex max-h-[90dvh] w-[96vw] max-w-4xl flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
          <h2 className="text-base font-semibold">{editingEp?.id ? "Edit" : "New"} episode</h2>
          <div className="-mr-1 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 grid gap-x-5 gap-y-3 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Series">
                <select
                  value={activeSeries}
                  onChange={(e) => setSeriesId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  {!seriesList.length && <option value="">Create a series first</option>}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Season">
                  <Input
                    type="number"
                    value={editingEp?.season ?? 1}
                    onChange={(e) => setEditingEp({ ...editingEp, season: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Episode number">
                  <Input
                    type="number"
                    value={editingEp?.episode_number ?? 1}
                    onChange={(e) =>
                      setEditingEp({ ...editingEp, episode_number: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field label="Title">
                <Input
                  value={editingEp?.title ?? ""}
                  onChange={(e) => setEditingEp({ ...editingEp, title: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingEp?.is_vip ?? false}
                  onChange={(e) => setEditingEp({ ...editingEp, is_vip: e.target.checked })}
                />
                VIP only
              </label>
            </div>
            <div className="space-y-3">
              <UploadField
                label="Thumbnail"
                folder="thumbs"
                accept="image/*"
                value={editingEp?.thumbnail_url ?? null}
                onChange={(p) => setEditingEp({ ...editingEp, thumbnail_url: p })}
              />
              <UploadField
                label="Episode file"
                folder="videos"
                accept="video/*"
                preview="none"
                value={editingEp?.video_url ?? null}
                onChange={(p) => setEditingEp({ ...editingEp, video_url: p })}
              />
              <Button
                className="w-full"
                disabled={saveEp.isPending || !activeSeries}
                onClick={() => editingEp && saveEp.mutate(editingEp)}
              >
                {saveEp.isPending && <Loader2 className="mr-1 size-4 animate-spin" />} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
