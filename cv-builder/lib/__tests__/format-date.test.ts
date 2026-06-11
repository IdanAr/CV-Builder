import { describe, it, expect } from 'vitest'
import { formatDate, formatDateRange } from '../format-date'

describe('formatDate', () => {
  it('converts YYYY-MM to MM/YYYY', () => {
    expect(formatDate('2020-01')).toBe('01/2020')
  })
  it('passes through bare years and empty input', () => {
    expect(formatDate('2020')).toBe('2020')
    expect(formatDate(undefined)).toBe('')
  })
})

describe('formatDateRange', () => {
  it('joins start and end with a plain hyphen', () => {
    expect(formatDateRange('2020-01', '2022-06')).toBe('01/2020 - 06/2022')
  })
  it('falls back to Present for open-ended ranges when requested', () => {
    expect(formatDateRange('2020-01', undefined, true)).toBe('01/2020 - Present')
  })
  it('omits Present when not requested', () => {
    expect(formatDateRange('2020-01', undefined)).toBe('01/2020')
  })
  it('returns Present alone when only the flag applies', () => {
    expect(formatDateRange(undefined, undefined, true)).toBe('Present')
  })
  it('returns empty string when nothing is set', () => {
    expect(formatDateRange(undefined, undefined)).toBe('')
  })
  it('treats null the same as undefined', () => {
    expect(formatDateRange(null, null)).toBe('')
    expect(formatDateRange('2020-01', null, true)).toBe('01/2020 - Present')
  })
  it('returns only end when start is absent', () => {
    expect(formatDateRange(undefined, '2022-06')).toBe('06/2022')
  })
})
