import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { renderPdfRichText } from '../templates/pdf-utils'
import { fontDiagnostics, renderToGlyphRuns } from './pdf-geometry'

const meta = {
  templateId: 'minimal', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc', pageMargins: 0.5, lineSpacing: 1.15,
  sectionOrder: [], layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
} as ResumeMeta

const TWO_PARAS = 'First paragraph about pipelines.\n\nSecond paragraph about platforms.'

function resumeWithSummary(summary: string): ResumeData {
  return { basics: { name: 'Test User', summary } } as ResumeData
}

describe('multi-paragraph summary rendering (PDF)', () => {
  it('does not fall back to a base-14 font (no empty-line Helvetica phantom)', async () => {
    const buf = await renderToBuffer(
      selectPdfTemplate(resumeWithSummary(TWO_PARAS), meta, 'designed', 'CV') as React.ReactElement<never>
    )
    expect(fontDiagnostics(buf).usesBase14).toBe(false)
  })

  it('keeps both paragraphs and renders them on separate lines', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(resumeWithSummary(TWO_PARAS), meta, 'designed', 'CV') as React.ReactElement
    )
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('First paragraph')
    expect(text).toContain('Second paragraph')
    const first = runs.find(r => r.str.includes('First'))!
    const second = runs.find(r => r.str.includes('Second'))!
    // PDF y-axis points up, so the lower second paragraph has the smaller y.
    // A gap wider than one body line confirms a real paragraph break, not a wrap.
    expect(second.y).toBeLessThan(first.y)
    expect(first.y - second.y).toBeGreaterThan(11.5) // > one 10pt line at 1.15

  })
})

describe('renderPdfRichText', () => {
  it('emits one <Text> block per paragraph rather than one Text with an empty line', () => {
    const children = React.Children.toArray(renderPdfRichText(TWO_PARAS) as React.ReactNode)
    expect(children).toHaveLength(2)
  })

  it('still returns a single block for single-paragraph text', () => {
    const children = React.Children.toArray(renderPdfRichText('Just one.') as React.ReactNode)
    expect(children).toHaveLength(1)
  })
})
