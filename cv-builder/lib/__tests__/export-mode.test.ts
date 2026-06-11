import { describe, it, expect } from 'vitest'
import { parseExportMode } from '../export-mode'

describe('parseExportMode', () => {
  it('returns ats for "ats"', () => {
    expect(parseExportMode('ats')).toBe('ats')
  })
  it('returns designed for "designed"', () => {
    expect(parseExportMode('designed')).toBe('designed')
  })
  it('defaults to designed when value is undefined', () => {
    expect(parseExportMode(undefined)).toBe('designed')
  })
  it('defaults to designed when value is null', () => {
    expect(parseExportMode(null)).toBe('designed')
  })
  it('treats "ATS" (uppercase) as invalid — case sensitive', () => {
    expect(parseExportMode('ATS')).toBe('designed')
  })
  it('defaults to designed for non-string values', () => {
    expect(parseExportMode(42)).toBe('designed')
  })
})
