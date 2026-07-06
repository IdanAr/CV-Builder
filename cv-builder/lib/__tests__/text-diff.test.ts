import { describe, it, expect } from 'vitest'
import { diffWords } from '../text-diff'

function joined(segments: { text: string }[]): string {
  return segments.map(s => s.text).join('')
}

describe('diffWords', () => {
  it('marks nothing as changed when the strings are identical', () => {
    const { before, after } = diffWords('Built React dashboard', 'Built React dashboard')
    expect(before.every(s => !s.changed)).toBe(true)
    expect(after.every(s => !s.changed)).toBe(true)
    expect(joined(before)).toBe('Built React dashboard')
    expect(joined(after)).toBe('Built React dashboard')
  })

  it('marks only the appended words as changed', () => {
    const { before, after } = diffWords('Built the dashboard', 'Built the dashboard using TypeScript')
    expect(before.every(s => !s.changed)).toBe(true)
    const changedAfter = after.filter(s => s.changed).map(s => s.text).join('')
    expect(changedAfter).toContain('TypeScript')
    expect(after.some(s => !s.changed && s.text.includes('Built'))).toBe(true)
  })

  it('marks only the replaced word as changed, keeping prefix and suffix unmarked', () => {
    const { before, after } = diffWords('Built a small dashboard for users', 'Built a scalable dashboard for users')
    const changedBefore = before.filter(s => s.changed).map(s => s.text).join('')
    const changedAfter = after.filter(s => s.changed).map(s => s.text).join('')
    expect(changedBefore).toContain('small')
    expect(changedAfter).toContain('scalable')
    // Unchanged prefix/suffix words must not be marked changed anywhere
    expect(before.some(s => s.changed && s.text.includes('dashboard'))).toBe(false)
    expect(after.some(s => s.changed && s.text.includes('dashboard'))).toBe(false)
    expect(before.some(s => s.changed && s.text.includes('users'))).toBe(false)
    expect(after.some(s => s.changed && s.text.includes('users'))).toBe(false)
  })

  it('reconstructs the original and suggested text exactly when segments are joined', () => {
    const original = 'Led a team of 5 engineers across 3 projects'
    const suggested = 'Led a cross-functional team of 5 engineers across 3 agile projects'
    const { before, after } = diffWords(original, suggested)
    expect(joined(before)).toBe(original)
    expect(joined(after)).toBe(suggested)
  })

  it('marks every word changed when the strings share no words', () => {
    const { before, after } = diffWords('abc def', 'xyz uvw')
    const nonWhitespace = (segs: { text: string; changed: boolean }[]) => segs.filter(s => s.text.trim().length > 0)
    expect(nonWhitespace(before).every(s => s.changed)).toBe(true)
    expect(nonWhitespace(after).every(s => s.changed)).toBe(true)
  })
})
