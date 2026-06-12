import { describe, it, expect } from 'vitest'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '../get-column-side'

describe('getColumnSide', () => {
  it('returns left for work by default', () => {
    expect(getColumnSide('work', {})).toBe('left')
  })
  it('returns left for education by default', () => {
    expect(getColumnSide('education', {})).toBe('left')
  })
  it('returns left for volunteer by default', () => {
    expect(getColumnSide('volunteer', {})).toBe('left')
  })
  it('returns right for skills by default', () => {
    expect(getColumnSide('skills', {})).toBe('right')
  })
  it('returns right for languages by default', () => {
    expect(getColumnSide('languages', {})).toBe('right')
  })
  it('returns left for custom sections by default', () => {
    expect(getColumnSide('custom:abc123', {})).toBe('left')
  })
  it('honours explicit left override', () => {
    expect(getColumnSide('skills', { skills: 'left' })).toBe('left')
  })
  it('honours explicit right override on a default-left section', () => {
    expect(getColumnSide('work', { work: 'right' })).toBe('right')
  })
  it('honours explicit right override on a custom section', () => {
    expect(getColumnSide('custom:abc123', { 'custom:abc123': 'right' })).toBe('right')
  })

  // Sidebar defaults
  describe('with SIDEBAR_COLUMN_DEFAULTS', () => {
    it('SIDEBAR_COLUMN_DEFAULTS puts skills on left', () => {
      expect(SIDEBAR_COLUMN_DEFAULTS.skills).toBe('left')
    })
    it('SIDEBAR_COLUMN_DEFAULTS puts languages on left', () => {
      expect(SIDEBAR_COLUMN_DEFAULTS.languages).toBe('left')
    })
    it('skills defaults to left with sidebar templateDefaults', () => {
      expect(getColumnSide('skills', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('left')
    })
    it('languages defaults to left with sidebar templateDefaults', () => {
      expect(getColumnSide('languages', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('left')
    })
    it('work defaults to right with sidebar templateDefaults', () => {
      expect(getColumnSide('work', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
    })
    it('education defaults to right with sidebar templateDefaults', () => {
      expect(getColumnSide('education', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
    })
    it('explicit columnAssignment overrides sidebar defaults', () => {
      expect(getColumnSide('skills', { skills: 'right' }, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
      expect(getColumnSide('work', { work: 'left' }, SIDEBAR_COLUMN_DEFAULTS)).toBe('left')
    })
    it('unassigned section not in SIDEBAR_COLUMN_DEFAULTS falls back to right', () => {
      expect(getColumnSide('certificates', {}, SIDEBAR_COLUMN_DEFAULTS)).toBe('right')
    })
  })
})
