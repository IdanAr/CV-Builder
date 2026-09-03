/**
 * The app's canonical public address, for metadata that has to name it:
 * `metadataBase`, `sitemap.ts`, `robots.ts`.
 *
 * Deliberately *not* shared with `resolveAppUrl()` in `lib/jobsearch/queue.ts`,
 * even though both read `APP_URL`. They answer different questions, and folding
 * them together would break one of them:
 *
 *   - queue.ts asks "where should QStash call *this deployment* back?" — it has
 *     to resolve to the running deployment, so `VERCEL_URL` (the per-deployment
 *     hostname) is the right fallback there.
 *   - this asks "what is our canonical public address?" — a preview deployment
 *     must still emit production URLs in its canonical tags and sitemap, or
 *     every preview competes with production in search results. Hence
 *     `VERCEL_PROJECT_PRODUCTION_URL` (the stable production alias) ahead of
 *     `VERCEL_URL`.
 *
 * `APP_URL` stays the first choice in both, so a single explicit setting
 * continues to govern everything.
 */
export function resolveSiteUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:3000'

  // Trailing slashes matter: `new URL('/terms', 'https://x.com/')` and
  // `new URL('/terms', 'https://x.com')` agree, but string-concatenated
  // sitemap entries would emit `https://x.com//terms`.
  return raw.replace(/\/+$/, '')
}
