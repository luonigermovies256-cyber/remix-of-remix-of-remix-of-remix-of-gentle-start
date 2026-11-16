# Branding, Music tab and new bottom bar style

## What changes
1. **Remove the logo** from the top bar, side menu, watch page header and admin header. The name text DWONLUOMOVIES stays.
2. **Replace "VJ EMMA.SITE" with "DWONLUOMOVIES"** everywhere visitors can see it: page titles, sharing previews, About text, payment page, admin pages, home-screen app name.
   - Hidden internal sign-in addresses ending in @vjemma.site stay as they are, otherwise existing phone/name accounts (including admin) could no longer sign in.
3. **Bottom bar: Menu becomes Music.** Music opens a Music page showing titles in a "music" category, using the same poster grid as Home/Movies/Series. Upload music videos in Admin → Media and choose the Music category. Until then it shows an empty message.
4. **New icon style:** the active tab's icon sits inside a filled, rounded purple pill; inactive tabs stay plain grey.

## Technical details
- MobileNav.tsx: drop Sheet/Menu, add Music link to `/category/$slug` slug `music` (lucide `Music`), pill wrapper on active icon.
- Ensure `music` exists in the content category list (categories.ts / sections.ts) so admin can tag uploads.
- Remove logoAsset imports/img in TopBar, Sidebar, watch.tsx, admin.tsx.
- Text replace in head() metadata and copy across routes; leave auth.tsx, admin-access(.test).ts, pesapal fallback email untouched.
