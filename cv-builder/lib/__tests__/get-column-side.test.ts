import { describe, it, expect } from 'vitest'
import { getColumnSide } from '../get-column-side'

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
})
