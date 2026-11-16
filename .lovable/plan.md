# Delete all movies and rename header

## 1. Delete all movies
Your movies are stored in your own Firebase database, which only a signed-in admin can change. I'll add a **"Delete all movies"** button in Admin → Media:
- It asks you to type DELETE to confirm, because this can't be undone.
- It removes every movie, its episodes, and the homepage slider entries that point to them.
- You then press it once while signed in as admin. Uploaded video files in storage are left alone.

## 2. Header name
Change "VJ EMMA.SITE" / "VJ EMMA" in the top bar, the side menu and the install message to **DWONLUOMOVIES**. The logo picture and page titles in search results stay the same.

## Technical details
- src/routes/admin.media.tsx: add bulk delete using the existing fdb delete helpers for the `media`, `episodes` and `hero_slides` tables, then invalidate media queries.
- src/components/youku/TopBar.tsx, Sidebar.tsx: replace the brand text and logo alt.
