# Restyle homepage to match the screenshot

Rebuild the homepage look from the uploaded screenshot, keeping your own movies and the DWONLUOMOVIES name.

## What changes
- **Top bar (compact, dark navy):** round logo + DWONLUOMOVIES name, a rounded dark search box ("Search movies..."), an orange **Subscribe** pill, and an outlined **Log in** pill (shows the viewer's name / Logout when signed in).
- **Movie grid:** 4 posters per row on phones (more on wider screens), tall poster cards with rounded corners, bold uppercase title (cut off with "...") and the year in grey underneath. Tapping a poster opens the movie.
- **Bottom menu bar:** fixed at the bottom with Home, Movies, Series and Menu icons; the current page is highlighted in purple. Menu opens the existing side menu.
- **Colours:** deep navy background, orange accent for Subscribe, purple for the active tab.
- The slider, "Latest" row and green Download buttons from the earlier redesign are replaced by this simpler poster grid. Search still filters the grid.

## Not changed
Watch page, admin pages, payments, sign-in logic.

## Technical details
- Update design tokens in src/styles.css (navy background, orange accent, purple active).
- Rework src/components/youku/TopBar.tsx, MediaCard.tsx, MobileNav.tsx; simplify src/routes/index.tsx to the grid layout using the existing movie data query.
- Movies/Series tabs link to existing category routes (or filter the homepage by type if none exist).
