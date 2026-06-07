import { describe, it, expect } from 'vitest'
import { sectionsFilledCount } from '../sections'

describe('sectionsFilledCount', () => {
  it('returns 0 for empty data', () => {
    expect(sectionsFilledCount({})).toBe(0)
  })

  it('returns 0 when all sections are empty arrays', () => {
    expect(sectionsFilledCount({ work: [], education: [], skills: [] })).toBe(0)
  })

  it('counts sections with at least one item', () => {
    expect(sectionsFilledCount({
      work: [{ name: 'Acme' }],
      education: [{ institution: 'MIT' }],
      skills: [],
    })).toBe(2)
  })

  it('counts all 10 countable sections', () => {
    expect(sectionsFilledCount({
      work: [{}],
      education: [{}],
      skills: [{}],
      certificates: [{}],
      awards: [{}],
      publications: [{}],
      volunteer: [{}],
      languages: [{}],
      interests: [{}],
      projects: [{}],
    })).toBe(10)
  })

  it('ignores the basics object (not a countable section)', () => {
    expect(sectionsFilledCount({ basics: { name: 'Ada' } })).toBe(0)
  })
})
