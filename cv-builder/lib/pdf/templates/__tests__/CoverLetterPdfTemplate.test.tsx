import React from 'react'
import { describe, it, expect } from 'vitest'
import { CoverLetterPdfTemplate } from '../CoverLetterPdfTemplate'
import { renderToBufferAndRuns, fontDiagnostics, lineTexts, lineHasWord } from '@/lib/pdf/__tests__/pdf-geometry'

describe('CoverLetterPdfTemplate', () => {
  it('renders real Hebrew glyphs, not blank/missing characters', async () => {
    const { buffer, runs } = await renderToBufferAndRuns(
      React.createElement(CoverLetterPdfTemplate, { content: 'שלום עולם', name: 'ישראל ישראלי' })
    )
    const diag = fontDiagnostics(buffer)
    expect(diag.embedded).toBe(true)
    expect(diag.usesBase14).toBe(false)
    const extracted = runs.map((r) => r.str).join('')
    expect(extracted).toContain('שלום')
    expect(extracted).toContain('עולם')
    expect(extracted).toContain('ישראל')
  })

  it('still renders Latin content correctly', async () => {
    const { runs } = await renderToBufferAndRuns(
      React.createElement(CoverLetterPdfTemplate, { content: 'Dear Hiring Manager, thank you.', name: 'Jane Smith' })
    )
    const text = runs.map((r) => r.str).join(' ')
    expect(text).toContain('Dear Hiring Manager')
    expect(text).toContain('Jane Smith')
  })

  /**
   * The realistic Hebrew letter: Hebrew name and body, a Latin email, a digit
   * date. Hebrew and Latin text get different embedded fonts, and the old
   * @react-pdf/textkit (before 7.x) reordered glyphs across font runs in a
   * right-to-left line, so Hebrew letters were drawn with the Latin font's
   * glyphs (extracted as stray 'a' and 'x'), and digits drew as accent marks.
   * pdfjs reads back the character each glyph was drawn as, so a word that is
   * scrambled on the page is scrambled here too.
   */
  it('keeps every Hebrew word intact next to a Latin email and a digit date', async () => {
    const { buffer, runs } = await renderToBufferAndRuns(
      React.createElement(CoverLetterPdfTemplate, {
        content: 'שלום רב, אני כותבת בנוגע למשרה ב-Acme Corp.',
        name: 'דנה לוי',
        contact: 'חיפה · dana@example.com · 050-0000000',
        date: '21 באוקטובר 2026',
        language: 'he',
      })
    )
    const diag = fontDiagnostics(buffer)
    expect(diag.embedded).toBe(true)
    expect(diag.usesBase14).toBe(false)
    const lineText = lineTexts(runs)
    for (const word of ['באוקטובר', 'שלום', 'כותבת', 'בנוגע', 'למשרה', 'חיפה', 'dana@example.com', 'AcmeCorp']) {
      expect(lineHasWord(lineText, word), `"${word}" is intact in: ${JSON.stringify(lineText)}`).toBe(true)
    }
    expect(lineText.join('')).not.toMatch(/[\u0590-\u05ff][a-z][\u0590-\u05ff]/)
  })
})
