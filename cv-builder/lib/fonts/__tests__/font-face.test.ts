import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fontFaceCss, FONT_SUBSTITUTES } from '../families'

describe('preview font-face', () => {
  it('emits a rule for every distinct family, weight and style', () => {
    const css = fontFaceCss()
    const families = new Set(Object.values(FONT_SUBSTITUTES).map(f => f.family))
    for (const family of families) {
      expect(css).toContain(`font-family:'${family}'`)
    }
    // families × 2 weights × 2 styles
    expect(css.match(/@font-face/g) ?? []).toHaveLength(families.size * 4)
  })

  // ExecutiveTemplate and ClassicTemplate render italic text. Without a real
  // italic face the browser shears the regular one, so the preview and the
  // embedded-italic PDF disagree on letterforms.
  it('emits italic rules so the browser never synthesizes a fake italic', () => {
    const css = fontFaceCss()
    expect(css).toContain('font-style:italic')
    expect(css.match(/font-style:italic/g) ?? [])
      .toHaveLength(new Set(Object.values(FONT_SUBSTITUTES).map(f => f.family)).size * 2)
  })

  it('every referenced woff exists under public/fonts', () => {
    const urls = [...fontFaceCss().matchAll(/url\('([^']+)'\)/g)].map(m => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      const file = path.join(process.cwd(), 'public', url.replace(/^\//, ''))
      expect(existsSync(file), `missing ${file} — run npm run fonts:copy`).toBe(true)
    }
  })
})
