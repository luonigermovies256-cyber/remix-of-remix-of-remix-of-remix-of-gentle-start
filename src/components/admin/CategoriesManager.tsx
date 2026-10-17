import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { data as db } from "@/lib/fdb";
import {
  BUILTIN_CATEGORIES,
  categoriesQuery,
  slugify,
  type DbCategory,
} from "@/lib/categories";

/** Admin CRUD for site categories (Movies, Series, Live…). */
export function CategoriesManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<DbCategory> | null>(null);
  const categories = useQuery(categoriesQuery());
  const rows = categories.data ?? [];

  const save = useMutation({
    mutationFn: async (row: Partial<DbCategory>) => {
      const label = (row.label ?? "").trim();
      if (!label) throw new Error("Category name is required");
      const payload = {
        label,
        slug: slugify(row.slug || label),
        short: row.short ?? label,
        blurb: row.blurb ?? null,
        icon: row.icon ?? slugify(row.slug || label),
        sort_order: Number(row.sort_order ?? 0),
        is_active: row.is_active ?? true,
      };
      const { error } = row.id
        ? await db.from("categories").update(payload).eq("id", row.id)
        : await db.from("categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category saved");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category deleted");
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Categories</h2>
          <p className="text-[11px] text-muted-foreground">
            Pages in the sidebar. Add, edit or delete your own; built-ins can be overridden.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing({ label: "", short: "", blurb: "", sort_order: 0, is_active: true })}
        >
          <Plus className="mr-1 size-4" /> Add category
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {c.label}
                {c.is_active === false && (
                  <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">Off</span>
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">/category/{c.slug}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove.mutate(c.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
        {BUILTIN_CATEGORIES.filter(
          (b) => !rows.some((r) => (r.slug || slugify(r.label)) === b.slug),
        ).map((b) => (
          <li key={b.slug} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {b.label}
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">Built-in</span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">/category/{b.slug}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() =>
                setEditing({
                  label: b.label,
                  slug: b.slug,
                  short: b.short,
                  blurb: b.blurb,
                  icon: b.icon,
                  sort_order: 0,
                  is_active: true,
                })
              }
            >
              <Pencil className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <h2 className="text-base font-semibold">{editing?.id ? "Edit" : "New"} category</h2>
          <div className="space-y-3">
            <Input
              placeholder="Category name (e.g. Movies)"
              value={editing?.label ?? ""}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              className="h-9"
            />
            <Input
              placeholder="URL slug (auto from name)"
              value={editing?.slug ?? ""}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              className="h-9"
            />
            <Input
              placeholder="Short label (sidebar)"
              value={editing?.short ?? ""}
              onChange={(e) => setEditing({ ...editing, short: e.target.value })}
              className="h-9"
            />
            <Textarea
              placeholder="Description"
              value={editing?.blurb ?? ""}
              onChange={(e) => setEditing({ ...editing, blurb: e.target.value })}
              rows={2}
            />
            <Input
              placeholder="Sort order"
              type="number"
              value={editing?.sort_order ?? 0}
              onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
              className="h-9"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={editing?.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Active
            </label>
            <Button size="sm" disabled={save.isPending} onClick={() => editing && save.mutate(editing)}>
              Save category
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}