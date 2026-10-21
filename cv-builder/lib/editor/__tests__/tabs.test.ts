import { describe, it, expect } from 'vitest'
import { EDITOR_TABS, parseEditorTab } from '../tabs'

describe('parseEditorTab', () => {
  it('accepts each editor tab by name', () => {
    expect(EDITOR_TABS).toEqual(['edit', 'design', 'ats', 'coverLetter'])
    for (const tab of EDITOR_TABS) expect(parseEditorTab(tab)).toBe(tab)
  })

  it('falls back to edit for an unknown, empty or missing value', () => {
    expect(parseEditorTab('nonsense')).toBe('edit')
    expect(parseEditorTab('')).toBe('edit')
    expect(parseEditorTab(undefined)).toBe('edit')
  })

  it('is case-sensitive, so a near miss falls back to edit', () => {
    expect(parseEditorTab('coverletter')).toBe('edit')
  })

  it('uses the first value when the parameter is repeated', () => {
    expect(parseEditorTab(['ats', 'design'])).toBe('ats')
    expect(parseEditorTab(['bogus', 'ats'])).toBe('edit')
  })

  it('does not treat inherited object keys as tabs', () => {
    expect(parseEditorTab('constructor')).toBe('edit')
    expect(parseEditorTab('toString')).toBe('edit')
  })
})
