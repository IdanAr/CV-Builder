import type { MetadataRoute } from 'next'
import { resolveSiteUrl } from '@/lib/site-url'

/**
 * Crawlers previously got no robots.txt at all, which meant the authenticated
 * app was fair game. Everything behind sign-in is disallowed — those routes
 * would only ever serve a redirect to a crawler, so indexing them wastes budget
 * and can surface bare "/dashboard" results.
 *
 * `/signin` is crawlable but kept out of `sitemap.ts`: it is a real public page,
 * just not one worth ranking.
 */
export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
