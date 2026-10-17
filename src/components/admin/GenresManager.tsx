import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UploadField } from "@/components/admin/UploadField";
import { data as db } from "@/lib/fdb";
import { genresQuery, genreSlugify, type Genre } from "@/lib/genres";

/** Admin CRUD for content genres (Action, Comedy, ...). */
export function GenresManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Genre> | null>(null);
  const genres = useQuery(genresQuery());

  const save = useMutation({
    mutationFn: async (row: Partial<Genre>) => {
      const label = (row.label ?? "").trim();
      if (!label) throw new Error("Genre name is required");
      const payload = {
        label,
        slug: genreSlugify(row.slug || label),
        image_url: row.image_url ?? null,
        sort_order: Number(row.sort_order ?? 0),
        is_active: row.is_active ?? true,
      };
      const { error } = row.id
        ? await db.from("genres").update(payload).eq("id", row.id)
        : await db.from("genres").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Genre saved");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["genres"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("genres").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Genre deleted");
      void qc.invalidateQueries({ queryKey: ["genres"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Genres</h2>
          <p className="text-[11px] text-muted-foreground">
            Action, Comedy, Horror… shown as image chips on every browse page.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing({ label: "", sort_order: 0, is_active: true })}
        >
          <Plus className="mr-1 size-4" /> Add genre
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {(genres.data ?? []).map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {g.label}
                {g.is_active === false && (
                  <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">Off</span>
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">/genre/{g.slug}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(g)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove.mutate(g.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
        {!genres.data?.length && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">
            No genres yet. Add Action, Comedy, Horror…
          </li>
        )}
      </ul>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <h2 className="text-base font-semibold">{editing?.id ? "Edit" : "New"} genre</h2>
          <div className="space-y-3">
            <Input
              placeholder="Genre name (e.g. Action)"
              value={editing?.label ?? ""}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              className="h-9"
            />
            <Input
              placeholder="Sort order"
              type="number"
              value={editing?.sort_order ?? 0}
              onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
              className="h-9"
            />
            <UploadField
              label="Genre image"
              folder="genres"
              value={editing?.image_url ?? null}
              onChange={(p) => setEditing({ ...editing, image_url: p ?? null })}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={editing?.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Active
            </label>
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() => editing && save.mutate(editing)}
            >
              Save genre
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
