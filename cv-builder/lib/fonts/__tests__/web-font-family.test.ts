import { describe, it, expect } from 'vitest'
import { webFontFamily, FONT_SUBSTITUTES } from '../families'

describe('webFontFamily', () => {
  it('maps every picker name to its registered substitute family', () => {
    for (const [picker, { family }] of Object.entries(FONT_SUBSTITUTES)) {
      expect(webFontFamily(picker), picker).toContain(`'${family}'`)
    }
  })

  it('never returns a bare picker name that has no @font-face rule', () => {
    // 'Calibri' etc. are not registered families; emitting them is the bug.
    for (const picker of ['Calibri', 'Cambria', 'Arial', 'Helvetica', 'Georgia', 'Garamond']) {
      expect(webFontFamily(picker)).not.toContain(`'${picker}'`)
    }
  })

  it('falls back to the default for an unknown font', () => {
    expect(webFontFamily('NotAFont')).toBe(webFontFamily('Calibri'))
  })
})
