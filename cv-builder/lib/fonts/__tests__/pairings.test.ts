import { describe, it, expect } from 'vitest'
import { FONT_SUBSTITUTES } from '../families'
import { PAIRINGS, matchPairing } from '../pairings'

describe('font pairings', () => {
  it('only uses fonts the picker, preview and PDF know about', () => {
    for (const p of PAIRINGS) {
      expect(FONT_SUBSTITUTES[p.heading], p.id).toBeDefined()
      expect(FONT_SUBSTITUTES[p.body], p.id).toBeDefined()
    }
  })

  it('matches by heading and body, and returns undefined for a custom combination', () => {
    expect(matchPairing('Cambria', 'Calibri')?.id).toBe('editorial')
    expect(matchPairing('Calibri', 'Calibri')?.id).toBe('clean')
    expect(matchPairing('Roboto', 'Lato')).toBeUndefined()
  })

  it('the schema default fonts (Calibri/Calibri) land on the first pairing', () => {
    expect(matchPairing('Calibri', 'Calibri')).toBe(PAIRINGS[0])
  })
})
