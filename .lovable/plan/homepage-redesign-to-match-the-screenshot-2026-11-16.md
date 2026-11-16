# Homepage redesign to match the screenshot

Restyle the homepage (mainly on phones) to follow the reference layout, keeping your own movies, logo and data.

## What changes
1. **Top bar**: logo on the left; on the right three pill buttons — **Install** (green outline, opens the "add to home screen" prompt), **Subscribe** (goes to the VIP/subscribe page), **Login** (goes to /login, or shows the viewer's name when signed in).
2. **Hero slider**: full-width banner of featured movies with left/right arrow buttons, a "Streaming" label card with the title, and a row of dots at the bottom (active dot is a longer green bar). Auto-slides.
3. **Search bar**: rounded dark field "Search movies, series, anime..." with a teal-green **GO** button, opening the search page.
4. **Latest Movies** row: green dot + "Latest Movies" heading, "X NEW" count on the right, 3 poster cards across with a green **NEW** badge, star rating, title, and a full-width teal-green **Download** button under each. Arrow buttons to scroll.
5. **All Content** section: small green "ALL CONTENT" label, "Movies, Series & Animation" heading with total count, then a 3-column poster grid.
6. **Bottom menu**: Home, Movies, Series, Anime with icons; active item highlighted.

## Look
Near-black background, teal-to-green gradient accent for buttons and badges, bold uppercase letter-spaced button text.

## Technical details
- Edit src/routes/index.tsx, src/components/youku/TopBar.tsx, MediaCard.tsx (add NEW badge + Download button variant), MobileNav.tsx.
- Add accent gradient tokens in src/styles.css; no hardcoded colors.
- Download button links to the existing watch/download page for each title. Existing category rows stay below the All Content grid. Desktop keeps the sidebar.
