import { describe, it, expect } from 'vitest'
import { parseExportMode } from '../export-mode'

describe('parseExportMode', () => {
  it('returns ats for "ats"', () => {
    expect(parseExportMode('ats')).toBe('ats')
  })
  it('defaults to designed for anything else', () => {
    expect(parseExportMode('designed')).toBe('designed')
    expect(parseExportMode(undefined)).toBe('designed')
    expect(parseExportMode(null)).toBe('designed')
    expect(parseExportMode('ATS')).toBe('designed')
    expect(parseExportMode(42)).toBe('designed')
  })
})
