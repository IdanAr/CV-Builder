import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import robots from '../robots'
import sitemap from '../sitemap'
import manifest from '../manifest'

const KEYS = ['APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  KEYS.forEach((k) => delete process.env[k])
  process.env.APP_URL = 'https://cv.example.com'
})
afterEach(() => {
  KEYS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  })
})

describe('robots.txt', () => {
  // Everything under /dashboard is gated by proxy.ts, so a crawler only ever
  // sees a redirect there. Letting it try wastes crawl budget and can surface
  // bare "/dashboard" results that go nowhere useful.
  it('keeps crawlers out of the authenticated app and the API', () => {
    const rules = robots().rules as { disallow?: string[] }
    expect(rules.disallow).toContain('/dashboard')
    expect(rules.disallow).toContain('/api')
  })

  it('points at an absolute sitemap URL', () => {
    expect(robots().sitemap).toBe('https://cv.example.com/sitemap.xml')
  })
})

describe('sitemap.xml', () => {
  it('lists only pages a signed-out visitor can read', () => {
    expect(sitemap().map((e) => e.url)).toEqual([
      'https://cv.example.com/',
      'https://cv.example.com/terms',
      'https://cv.example.com/privacy',
    ])
  })

  // The pairing that actually matters: a route disallowed in robots.txt but
  // still advertised in the sitemap is a contradiction crawlers report as an
  // error, and it is the natural way this drifts as routes get added.
  it('never advertises a route robots.txt disallows', () => {
    const disallow = (robots().rules as { disallow?: string[] }).disallow ?? []
    for (const entry of sitemap()) {
      const path = new URL(entry.url).pathname
      expect(disallow.some((d) => path.startsWith(d))).toBe(false)
    }
  })

  it('emits absolute URLs with no doubled slashes', () => {
    process.env.APP_URL = 'https://cv.example.com/'
    for (const entry of sitemap()) {
      expect(entry.url).toMatch(/^https:\/\/cv\.example\.com\/[a-z]*$/)
    }
  })
})

describe('manifest', () => {
  it('ships both an SVG and a raster icon, so no platform is left without one', () => {
    const types = manifest().icons?.map((i) => i.type)
    expect(types).toContain('image/svg+xml')
    expect(types).toContain('image/png')
  })

  it('opens installed users straight into the app rather than the marketing page', () => {
    expect(manifest().start_url).toBe('/dashboard')
  })
})
