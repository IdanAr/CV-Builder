import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { renderPdfRichText } from '../templates/pdf-utils'
import { fontDiagnostics, renderToGlyphRuns } from './pdf-geometry'

const meta = {
  templateId: 'minimal', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc', pageMargins: 0.5, sidebarRailWidth: 33, lineSpacing: 1.15,
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

  it('renders a soft line break as a nested <Text> per line within one paragraph block', () => {
    const children = React.Children.toArray(renderPdfRichText('Line one\nLine two') as React.ReactNode)
    // Still exactly one paragraph-level <Text> block (no blank-line phantom risk)...
    expect(children).toHaveLength(1)
    // ...but that block now nests one <Text> per line rather than one flat string.
    const paragraph = children[0] as React.ReactElement<{ children: React.ReactNode }>
    const lines = React.Children.toArray(paragraph.props.children)
    expect(lines).toHaveLength(2)
  })

  it('keeps rendering multiple paragraphs as separate <Text> blocks when combined with soft breaks', () => {
    const children = React.Children.toArray(
      renderPdfRichText('A1\nA2\n\nB1\nB2') as React.ReactNode
    )
    expect(children).toHaveLength(2)
  })
})

const TWO_LINES = 'First line here.\nSecond line here.'

describe('soft line break rendering (PDF)', () => {
  // Not a byte-level fontDiagnostics().usesBase14 check like the paragraph-gap
  // test above: rendering the soft break requires a literal '\n' inside the
  // Text run, and @react-pdf's own font-substitution engine (verified against
  // both the installed @react-pdf/textkit and the latest published release)
  // unconditionally falls back to the standard, unembedded Helvetica for any
  // codepoint no font in the stack can shape — and no font ships a glyph for
  // U+000A. That forces a `/BaseFont /Helvetica` entry into the PDF's
  // resource dictionary purely to hold the invisible line-break character,
  // even though every embedded custom font is otherwise used correctly. It's
  // the same benign "empty-line phantom" category already known in this
  // codebase (see pdf-hebrew-font-fallback memory note) — a resource that is
  // declared but never used to paint a visible glyph. So assert the thing
  // that actually matters for font fidelity: no *visible* glyph run is drawn
  // with Helvetica.
  it('does not render any visible glyph in a base-14 font on a soft-break field', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(resumeWithSummary(TWO_LINES), meta, 'designed', 'CV') as React.ReactElement
    )
    expect(runs.some(r => /helvetica|times|courier/i.test(r.fontName))).toBe(false)
  })

  it('renders both lines on separate visual lines', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(resumeWithSummary(TWO_LINES), meta, 'designed', 'CV') as React.ReactElement
    )
    const first = runs.find(r => r.str.includes('First'))!
    const second = runs.find(r => r.str.includes('Second'))!
    expect(second.y).toBeLessThan(first.y)
  })
})
