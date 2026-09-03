import type { MetadataRoute } from 'next'
import { resolveSiteUrl } from '@/lib/site-url'

/**
 * Only the four routes a signed-out visitor can actually read. Everything under
 * `/dashboard` is gated by `proxy.ts` and would serve a redirect to a crawler,
 * and `/signin` is excluded on purpose — public, but not a page anyone should
 * arrive at from a search result.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl()
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
