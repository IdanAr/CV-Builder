import React from 'react'
import { describe, it, expect } from 'vitest'
import { CoverLetterPdfTemplate } from '../CoverLetterPdfTemplate'
import { renderToBufferAndRuns, fontDiagnostics } from '@/lib/pdf/__tests__/pdf-geometry'

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

  it('renders a Hebrew date and contact line in the header with real glyphs', async () => {
    const { buffer, runs } = await renderToBufferAndRuns(
      React.createElement(CoverLetterPdfTemplate, {
        content: 'שלום עולם',
        name: 'ישראל ישראלי',
        contact: '050-0000000 · חיפה',
        date: '21 באוקטובר 2026',
        language: 'he',
      })
    )
    const diag = fontDiagnostics(buffer)
    expect(diag.embedded).toBe(true)
    expect(diag.usesBase14).toBe(false)
    const extracted = runs.map((r) => r.str).join(' ')
    // pdfjs splits an RTL word across runs, so check the glyphs rather than the word.
    for (const ch of new Set('באוקטובר')) expect(extracted).toContain(ch)
    expect(extracted).toContain('2026')
    expect(extracted).toContain('חיפה')
  })
})
