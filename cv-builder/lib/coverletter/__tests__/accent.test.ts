import { describe, it, expect } from 'vitest'
import { resolveAccent, DEFAULT_LETTER_ACCENT } from '../accent'

describe('resolveAccent', () => {
  it('returns a six-digit hex lowercased', () => {
    expect(resolveAccent('#1A7F4B')).toBe('#1a7f4b')
    expect(resolveAccent('  #c0392b ')).toBe('#c0392b')
  })

  it('expands a three-digit hex', () => {
    expect(resolveAccent('#0AF')).toBe('#00aaff')
  })

  it('falls back to the default for anything else', () => {
    for (const bad of [undefined, '', '1a7f4b', '0af', '#12', '#12345', '#1234567', '#ggg', 'red', 'red; drop', 'rgb(0,0,0)']) {
      expect(resolveAccent(bad)).toBe(DEFAULT_LETTER_ACCENT)
    }
    expect(DEFAULT_LETTER_ACCENT).toBe('#0066cc')
  })
})
