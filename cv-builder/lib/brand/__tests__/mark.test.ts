import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BRAND_MARK_SVG, BRAND_MARK_DATA_URI, BRAND_VIOLET } from '../mark'

/**
 * Pull the drawing instructions out of an SVG, ignoring comments, attribute
 * order and whitespace — everything that legitimately differs between the
 * hand-written `app/icon.svg` and the string this module builds.
 */
function shapes(svg: string): string[] {
  return [...svg.matchAll(/<(rect|polygon|path)\b([^>]*?)\/?>/g)]
    .map(([, tag, attrs]) => {
      const pairs = [...attrs.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)]
        .map(([, k, v]) => `${k}=${v.replace(/\s+/g, ' ').trim()}`)
        .sort()
      return `${tag}[${pairs.join(',')}]`
    })
    .sort()
}

const iconSvg = readFileSync(join(process.cwd(), 'app/icon.svg'), 'utf8')

describe('brand mark', () => {
  // The reason this test exists. `app/icon.svg` has to be a static file — Next's
  // `icon` file convention will not run a module — while satori needs the mark
  // inline as a data URI. So the same geometry lives in two places, and nothing
  // but this test stops the favicon and the Open Graph card drifting into two
  // different logos.
  it('keeps app/icon.svg and the generated mark drawing the same thing', () => {
    expect(shapes(iconSvg)).toEqual(shapes(BRAND_MARK_SVG))
  })

  it('draws a plate, a hexagon and a spark — nothing more', () => {
    expect(shapes(BRAND_MARK_SVG)).toHaveLength(3)
  })

  // A transparent mark measures 2.4:1 against a dark browser tab strip. The
  // opaque plate is the whole reason the favicon stays legible there, so its
  // absence is a real regression, not a styling preference.
  it('sits on an opaque plate rather than a transparent ground', () => {
    expect(BRAND_MARK_SVG).toContain(`<rect width="100" height="100" rx="22" fill="${BRAND_VIOLET}"/>`)
  })

  // Satori renders `<img src>` data URIs strictly; a percent-encoded SVG
  // carrying raw `#` and `"` is a well-known way to get a silently blank card.
  it('encodes the data URI as base64, and it round-trips', () => {
    expect(BRAND_MARK_DATA_URI.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const decoded = Buffer.from(BRAND_MARK_DATA_URI.split(',')[1], 'base64').toString('utf8')
    expect(decoded).toBe(BRAND_MARK_SVG)
  })
})
