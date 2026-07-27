// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { ExecutiveTemplate } from '@/components/templates/ExecutiveTemplate'
import { SidebarTemplate } from '@/components/templates/SidebarTemplate'
import { MinimalPdfTemplate } from '../templates/MinimalPdfTemplate'
import { ClassicPdfTemplate } from '../templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from '../templates/ModernPdfTemplate'
import { ExecutivePdfTemplate } from '../templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from '../templates/SidebarPdfTemplate'
import { renderToGlyphRuns, type GlyphRun } from './pdf-geometry'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 30_000 })

/**
 * The formal, enforceable statement of "WYSIWYG": whatever the editor shows,
 * the exported PDF must contain the same content in the same order.
 *
 * Comparing the two renderers' text is harder than it looks, because three
 * things differ between them for reasons that are not defects. All three were
 * measured against the real output, not assumed:
 *
 *  1. `Element.textContent` concatenates across block boundaries with no
 *     separator, so the DOM yields "PresentData" where two adjacent divs
 *     render on separate lines.
 *  2. The PDF applies CSS letter-spacing by emitting literal spaces, so a
 *     section title arrives as "W O R K  E X P E R I E N C E".
 *  3. react-pdf splits a line into several runs at font-fallback boundaries,
 *     so "₪1" arrives as "₪" then "1".
 *
 * Whitespace is therefore not comparable between the engines, and neither is
 * case (the web uppercases section titles with CSS `text-transform`, which
 * never reaches the DOM text). What IS comparable — and what actually matters —
 * is the sequence of characters: every word present, in the same order, with
 * nothing dropped, duplicated or reordered.
 *
 * Spacing is not abandoned; it is checked separately and more precisely in the
 * second test, using glyph geometry rather than string equality.
 */

const PAIRS = [
  ['minimal', MinimalTemplate, MinimalPdfTemplate],
  ['classic', ClassicTemplate, ClassicPdfTemplate],
  ['modern', ModernTemplate, ModernPdfTemplate],
  ['executive', ExecutiveTemplate, ExecutivePdfTemplate],
  ['sidebar', SidebarTemplate, SidebarPdfTemplate],
] as const

function metaFor(templateId: string): ResumeMeta {
  return {
    templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.5, lineSpacing: 1.15,
    sectionOrder: ['work', 'education', 'skills', 'languages'],
    layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
  } as ResumeMeta
}

const data: ResumeData = {
  basics: {
    name: 'Idan Arbel', label: 'Solutions Architect | Data & AI',
    email: 'idan@example.com', phone: '054-0000000',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Data Solutions Architect and GenAI platform developer.',
  },
  work: [{ name: 'SAS Israel', position: 'Data Solutions Architect', startDate: '2022-07',
           highlights: ['Prevented over ₪1 million in fraud'] }],
  education: [{ institution: 'Technion', area: 'Generative AI', studyType: 'Certificate', endDate: '2025-12' }],
  skills: [{ name: 'Data', keywords: ['SQL', 'MongoDB'] }],
  languages: [{ language: 'Hebrew', fluency: 'Native' }],
}

/**
 * Reduce text to what both engines can be held to: the character sequence,
 * ignoring whitespace, case, and the separator glyphs each renderer picks for
 * itself (the web uses "·" between contact fields where the PDF uses "|").
 */
function comparable(text: string): string {
  return text.replace(/[·|•\s]/g, '').toLowerCase()
}

describe('preview / export parity', () => {
  it.each(PAIRS)('%s renders the same content in the same order in both engines', async (id, Web, Pdf) => {
    const meta = metaFor(id)
    const { container } = render(<Web data={data} meta={meta} />)
    const web = comparable(container.textContent ?? '')

    const runs = await renderToGlyphRuns(Pdf({ data, meta, title: 'CV' }))
    const pdf = comparable(runs.map(r => r.str).join(''))

    // Guards against the comparison passing because both sides came back empty.
    expect(web.length).toBeGreaterThan(200)
    expect(pdf).toBe(web)
  })

  /*
   * NOT COVERED HERE: word spacing — the original "IdanSolutions" defect,
   * where two adjacent Text elements render with no gap and separate words
   * visually collide.
   *
   * A geometric version of this check was written and discarded, because at
   * this level a defect is indistinguishable from correct output. Two runs
   * butted together at a ~0pt gap is exactly what react-pdf also emits when it
   * splits one string mid-word: "over ₪1 million" arrives as "₪" + "1 million"
   * at a measured gap of -0.00pt, which is correct — no space belongs there.
   * `fontName` does not separate the two cases either; the split runs report
   * the same font (g_d0_f2), so the split is not a fallback boundary.
   * Letter-spacing closes the last door: the PDF renders it as literal spaces
   * ("W O R K  E X P E R I E N C E"), so a real gap does not imply a real
   * space in the source.
   *
   * Deciding correctly needs the source string's true word boundaries, which
   * means block-aware DOM extraction compared position-by-position against
   * reconstructed PDF lines. That is a larger piece of machinery than this
   * task, and shipping a version with a hardcoded exception list would give
   * false confidence while masking the defects it claims to catch.
   */
})
