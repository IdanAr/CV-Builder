import { describe, it, expect } from 'vitest'
import { FONT_SCALE_MIN, FONT_SCALE_MAX, resolveFontScale, scalePt, pts } from '../font-scale'

describe('font-scale helpers', () => {
  it('resolveFontScale defaults missing or invalid values to 1', () => {
    expect(resolveFontScale({})).toBe(1)
    expect(resolveFontScale({ fontScale: null })).toBe(1)
    expect(resolveFontScale({ fontScale: Number.NaN })).toBe(1)
  })

  it('resolveFontScale clamps to the supported range', () => {
    expect(resolveFontScale({ fontScale: 5 })).toBe(FONT_SCALE_MAX)
    expect(resolveFontScale({ fontScale: 0.1 })).toBe(FONT_SCALE_MIN)
    expect(resolveFontScale({ fontScale: 1.05 })).toBe(1.05)
  })

  it('scalePt is the identity at scale 1 for every size the templates use', () => {
    for (const n of [9, 10, 10.5, 11, 12, 13, 20, 22]) expect(scalePt(n, 1)).toBe(n)
  })

  it('scalePt rounds to two decimals', () => {
    expect(scalePt(10.5, 1.05)).toBe(11.03)
    expect(scalePt(11, 1.05)).toBe(11.55)
  })

  it('pts renders a CSS point length', () => {
    expect(pts(10, 1)).toBe('10pt')
    expect(pts(10.5, 1)).toBe('10.5pt')
    expect(pts(10, 1.05)).toBe('10.5pt')
  })
})
