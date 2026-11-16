# Make Movies and Series pages look exactly like Home

Movies and Series (bottom bar tabs) will use the same layout as the new homepage, so all three look identical.

## What changes
- Same top bar on all three: logo, "Search movies..." box, orange Subscribe, Log in.
- Same poster grid: 4 per row on phones, uppercase title and year under each poster.
- Same bottom bar, with the current tab in purple.
- Movies shows only movies; Series shows only series. Search filters within the current tab.
- The old sidebar, genre strip and section header disappear from these two pages.
- Other category pages (from the Menu) also use this same look.

## Technical details
- Move the homepage header and grid card into a shared component (e.g. src/components/youku/HomeGrid.tsx) taking a list of items.
- index.tsx renders it with all media; category.$slug.tsx renders it with the section's items (existing sectionQuery / inSection filter).
- Update category page title to DWONLUOMOVIES.
