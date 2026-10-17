/** Cast rail under the player: recommendation pill + circular actor chips. */
export function ActorRail({ actors }: { actors: string | null | undefined }) {
  const list = (actors ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  if (!list.length) return null;

  return (
    <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 rounded-full bg-brand/15 px-4 py-2 text-sm font-semibold text-brand">
        Recommended for you
      </span>
      {list.map((name) => (
        <span
          key={name}
          className="flex shrink-0 items-center gap-2 rounded-full bg-secondary py-1 pl-1 pr-4"
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand/20 text-xs font-bold uppercase text-brand">
            {name.slice(0, 2)}
          </span>
          <span className="whitespace-nowrap text-sm text-foreground/85">{name}</span>
        </span>
      ))}
    </div>
  );
}
