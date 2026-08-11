import { describe, it, expect } from 'vitest'
import { formatDate, formatDateRange, aggregateDateRange } from '../format-date'

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

describe('aggregateDateRange', () => {
  it('returns the single entry range when there are no additional roles', () => {
    expect(aggregateDateRange([{ startDate: '2019-01', endDate: '2021-01' }])).toBe('01/2019 - 01/2021')
  })

  it('spans the earliest start to the latest end across all entries', () => {
    expect(aggregateDateRange([
      { startDate: '2019-01', endDate: '2021-01' },
      { startDate: '2021-01', endDate: '2023-06' },
    ])).toBe('01/2019 - 06/2023')
  })

  it('shows Present when the most recent entry is open and presentWhenOpen is true', () => {
    expect(aggregateDateRange([
      { startDate: '2019-01', endDate: '2021-01' },
      { startDate: '2021-01', endDate: undefined },
    ], true)).toBe('01/2019 - Present')
  })

  it('ignores an open end date when presentWhenOpen is false (education-style ranges)', () => {
    expect(aggregateDateRange([
      { startDate: '2019-01', endDate: '2021-01' },
      { startDate: '2021-01', endDate: undefined },
    ], false)).toBe('01/2019 - 01/2021')
  })

  it('orders roles correctly regardless of array order', () => {
    expect(aggregateDateRange([
      { startDate: '2021-01', endDate: '2023-06' },
      { startDate: '2019-01', endDate: '2021-01' },
    ])).toBe('01/2019 - 06/2023')
  })

  it('returns empty string for no entries or all-empty entries', () => {
    expect(aggregateDateRange([])).toBe('')
    expect(aggregateDateRange([{}])).toBe('')
  })
})
