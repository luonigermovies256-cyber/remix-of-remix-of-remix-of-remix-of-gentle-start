# Move search bar under the header

- Top row: DWONLUOMOVIES name (now always visible, also on phones) on the left, Subscribe and Log in on the right.
- Second row, directly below: a full-width "Search movies..." box.
- Both rows stay pinned to the top while scrolling. Applies to Home, Movies, Series, Music and category pages (they share one layout).

## Technical details
- HomeGrid.tsx: sticky header becomes two rows; name loses `hidden min-[480px]:inline`; search label moves to its own `px-3 pb-2` row with `w-full`.
