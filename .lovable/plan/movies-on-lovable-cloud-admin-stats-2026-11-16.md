# Movies on Lovable Cloud + Admin stats

## What you get
- Movies, series episodes, homepage slides, categories and genres are stored in Lovable Cloud instead of Firebase. The site loads them faster and pages share properly with search and social previews.
- Viewer and admin sign-in stay on Firebase as they are today, so nobody has to re-register.
- A new **Stats** section on the Admin home page:
  - Views: total plays today, last 7 days, last 30 days, plus a daily chart.
  - Top 10 most watched titles.
  - New signups per day and total accounts.
  - Payments: revenue and number of payments per day, plus active subscriptions.
  - Date range picker (7 / 30 / 90 days).

## Steps
1. Turn on Lovable Cloud.
2. Create storage for movies, episodes, slides, categories, genres and a new "views" log.
3. One-time copy of the current movies from Firebase into Cloud (an admin button "Import from Firebase" in Admin → Media, so nothing is lost). Since you may already have deleted all movies, this may simply copy nothing.
4. Switch the homepage, Movies, Series, Music, watch page and Admin → Media to read and save through Cloud.
5. Record a view each time someone starts playing a title.
6. Build the Stats section with charts.

## Notes
- Payments, subscriptions and accounts stay in Firebase; the Stats section reads them from there.
- Video files themselves stay where they are uploaded now.

## Technical details
- Tables: media, episodes, hero_slides, categories, genres, media_views (media_id, viewer id nullable, created_at), each with GRANTs + RLS. Public SELECT for catalog tables; anon INSERT on media_views only (rate-limited per session in the server fn).
- Writes go through createServerFn handlers that verify the caller's Firebase ID token (Google JWKs via `jose`, workerd-safe) and check the email/role against the shared admin-access policy, then use the admin client. No passwords involved.
- src/lib/media.ts, categories.ts, genres.ts switch from fdb to these server functions; public reads via a publishable-key server client so SSR/head() works.
- Stats: server fn aggregating media_views in SQL (daily counts, top 10); signups/payments aggregated client-side from Firestore profiles/transactions as today; charts with recharts.
