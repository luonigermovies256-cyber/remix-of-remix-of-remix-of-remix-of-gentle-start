import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { data as db } from "@/lib/fdb";
import { genresQuery, genreSlugify, mediaGenres } from "@/lib/genres";

/**
 * Genre chooser for the media form: pick from the genres the admin already
 * created, or type a new one — new genres are saved to the genres table so
 * they immediately show up in the genre rail on every browse page.
 */
export function GenrePicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  const qc = useQueryClient();
  const genres = useQuery(genresQuery());
  const [draft, setDraft] = useState("");

  const selected = mediaGenres({ genre: value ?? null });
  const isSelected = (label: string) =>
    selected.some((s) => genreSlugify(s) === genreSlugify(label));

  const toggle = (label: string) => {
    const next = isSelected(label)
      ? selected.filter((s) => genreSlugify(s) !== genreSlugify(label))
      : [...selected, label];
    onChange(next.join(", "));
  };

  const addGenre = useMutation({
    mutationFn: async (label: string) => {
      const clean = label.trim();
      if (!clean) throw new Error("Type a genre name first");
      const slug = genreSlugify(clean);
      const exists = (genres.data ?? []).some((g) => genreSlugify(g.slug || g.label) === slug);
      if (!exists) {
        const { error } = await db
          .from("genres")
          .insert({ label: clean, slug, image_url: null, sort_order: 0, is_active: true });
        if (error) throw error;
      }
      return clean;
    },
    onSuccess: (label) => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["genres"] });
      if (!isSelected(label)) onChange([...selected, label].join(", "));
      toast.success(`Genre "${label}" added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(genres.data ?? []).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => toggle(g.label)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              isSelected(g.label)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
        {/* genres typed before they were saved */}
        {selected
          .filter(
            (s) =>
              !(genres.data ?? []).some((g) => genreSlugify(g.label) === genreSlugify(s)),
          )
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className="rounded-full border border-primary bg-primary px-2.5 py-1 text-[11px] text-primary-foreground"
            >
              {s}
            </button>
          ))}
        {!genres.data?.length && (
          <span className="text-[11px] text-muted-foreground">
            No genres yet — add one below.
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="New genre (e.g. Action)"
          className="h-8 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGenre.mutate(draft);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={addGenre.isPending || !draft.trim()}
          onClick={() => addGenre.mutate(draft)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
