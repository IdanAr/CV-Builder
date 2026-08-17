import React from 'react'
import { describe, it, expect } from 'vitest'
import { SidebarPdfTemplate } from '../templates/SidebarPdfTemplate'
import { ExecutivePdfTemplate } from '../templates/ExecutivePdfTemplate'
import { renderToGlyphRuns, renderToBufferAndRuns } from './pdf-geometry'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { PDFParse } from 'pdf-parse'

/** Extracted PDF text, stripped of pdf-parse's own line breaks/whitespace and
 * its "-- N of M --" page-footer marker, so it can be compared directly
 * against the original unbroken contact string. A byte-identical match here
 * proves no character (hyphen, space, zero-width space, or otherwise) was
 * inserted by whatever wrapping mechanism produced the line breaks. */
async function extractStrippedText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const { text } = await parser.getText()
  return text.replace(/-- \d+ of \d+ --/g, '').replace(/\s+/g, '')
}

const baseMeta: ResumeMeta = {
  templateId: 'sidebar', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills', 'languages'],
  layout: 'two-column', columnAssignment: {}, excludedAtsKeywords: [],
}

const data: ResumeData = {
  basics: {
    name: 'Jane Smith', label: 'Principal Architect',
    email: 'jane.smith@example.com', phone: '+1 555 0100',
    location: { city: 'Tel Aviv', region: 'IL' },
    summary: 'Engineer with a decade of platform experience.',
  },
  work: [{ name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01', highlights: ['Cut infra costs 40%'] }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', startDate: '2012-09', endDate: '2016-06' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
  languages: [{ language: 'English', fluency: 'Native' }],
}

type AnyElement = { props?: { style?: unknown; children?: unknown } }

/** Flattens every style object found in an element subtree. */
function collectStyles(node: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node == null || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    node.forEach((n) => collectStyles(n, acc))
    return acc
  }
  const el = node as AnyElement
  if (el.props) {
    const s = el.props.style
    if (Array.isArray(s)) s.forEach((x) => x && acc.push(x as Record<string, unknown>))
    else if (s && typeof s === 'object') acc.push(s as Record<string, unknown>)
    collectStyles(el.props.children, acc)
  }
  return acc
}

/** Finds the flattened style of the element whose sole child is the given text. */
function findStyleOfText(node: unknown, text: string): Record<string, unknown> | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findStyleOfText(n, text)
      if (found) return found
    }
    return null
  }
  const el = node as AnyElement
  if (!el.props) return null
  if (el.props.children === text) {
    const s = el.props.style
    if (Array.isArray(s)) return Object.assign({}, ...s)
    return (s as Record<string, unknown>) ?? {}
  }
  return findStyleOfText(el.props.children, text)
}

function getPageColumns(meta: ResumeMeta) {
  const doc = SidebarPdfTemplate({ data, meta }) as unknown as AnyElement
  const page = doc.props!.children as AnyElement
  const children = (page.props!.children as AnyElement[]).filter(Boolean)
  const [rail, main] = children
  return { rail, main }
}

describe('SidebarPdfTemplate margin floor', () => {
  it('never pads rail or main column below 0.5in (36pt) for any pageMargins in [0.5, 1.5]', () => {
    for (const pageMargins of [0.5, 0.6, 0.75, 1.0, 1.25, 1.5]) {
      const { rail, main } = getPageColumns({ ...baseMeta, pageMargins })
      const railStyle = rail.props!.style as { padding: number }
      const mainStyle = main.props!.style as { padding: number }
      expect(railStyle.padding, `rail padding at pageMargins=${pageMargins}`).toBeGreaterThanOrEqual(36)
      expect(mainStyle.padding, `main padding at pageMargins=${pageMargins}`).toBeGreaterThanOrEqual(36)
    }
  })
})

describe('SidebarPdfTemplate rail typography bands', () => {
  it('keeps every rail font size at or above the 10pt body floor', () => {
    const { rail } = getPageColumns(baseMeta)
    const styles = collectStyles(rail)
    const sizes = styles
      .map((s) => s.fontSize)
      .filter((v): v is number => typeof v === 'number')
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(10)
    }
  })

  it('keeps rail section titles at or above the 12pt section-header floor', () => {
    const { rail } = getPageColumns(baseMeta)
    const titleStyles = collectStyles(rail).filter((s) => s.textTransform === 'uppercase')
    expect(titleStyles.length).toBeGreaterThan(0)
    for (const s of titleStyles) {
      expect(s.fontSize as number).toBeGreaterThanOrEqual(12)
    }
  })
})

describe('SidebarPdfTemplate rail section-title separator', () => {
  it('uses the accent color for the rail section-title separator', () => {
    const meta = { ...baseMeta, accentColor: '#ff00aa' }
    const { rail } = getPageColumns(meta)
    const styles = collectStyles(rail)
    const found = styles.some((s) => s.borderBottomColor === '#ff00aa')
    expect(found).toBe(true)
  })
})

describe('SidebarPdfTemplate rail width', () => {
  it('renders the rail at meta.sidebarRailWidth as a width percentage', () => {
    const { rail } = getPageColumns({ ...baseMeta, sidebarRailWidth: 25 })
    expect((rail.props!.style as { width: string }).width).toBe('25%')
  })

  it('renders the rail at 40% at the top of the allowed range', () => {
    const { rail } = getPageColumns({ ...baseMeta, sidebarRailWidth: 40 })
    expect((rail.props!.style as { width: string }).width).toBe('40%')
  })

  it('defaults to a 33% rail when meta.sidebarRailWidth is missing (pre-existing résumé)', () => {
    const { sidebarRailWidth: _unused, ...metaWithoutRailWidth } = baseMeta
    void _unused
    const { rail } = getPageColumns(metaWithoutRailWidth as ResumeMeta)
    expect((rail.props!.style as { width: string }).width).toBe('33%')
  })

  // Element-tree style assertions above prove the width prop is wired; this
  // renders an actual PDF (via pdfjs) at both range extremes to confirm the
  // document still parses without error, and that the main column — which
  // starts immediately after the rail — visibly shifts right as the rail
  // widens from 20% to 40%. (Default columnAssignment puts "Work Experience"
  // in the main column; see the SidebarPdfTemplate default in getColumnSide.)
  it('actually renders and parses at both range extremes (20% and 40%), with the main column starting further right at the wider extreme', async () => {
    const mainHeadingXByWidth: Record<number, number> = {}
    for (const sidebarRailWidth of [20, 40]) {
      const runs = await renderToGlyphRuns(
        SidebarPdfTemplate({ data, meta: { ...baseMeta, sidebarRailWidth } })
      )
      expect(runs.length).toBeGreaterThan(0)
      const mainHeading = runs.find((r) => r.str === 'WORK EXPERIENCE')
      expect(mainHeading, `no WORK EXPERIENCE heading found at sidebarRailWidth=${sidebarRailWidth}`).toBeTruthy()
      mainHeadingXByWidth[sidebarRailWidth] = mainHeading!.x
    }
    expect(mainHeadingXByWidth[40]).toBeGreaterThan(mainHeadingXByWidth[20])
  })
})

describe('SidebarPdfTemplate rail contact text fit at 20% rail width', () => {
  it('wraps a long unbroken email into multiple glyph runs instead of one run that overflows the rail, without corrupting the extracted text', async () => {
    const email = 'jane.smith.principal.architect@a-very-long-corporate-domain-name.example.com'
    const dataWithLongEmail: ResumeData = {
      basics: { name: 'Jane Smith', email },
    }
    const meta = { ...baseMeta, sidebarRailWidth: 20 }
    const { buffer, runs } = await renderToBufferAndRuns(SidebarPdfTemplate({ data: dataWithLongEmail, meta }))
    const railWidthPt = 595.28 * 0.20 // A4 width * 20% rail

    // Every glyph run belonging to the rail (left column) must fit inside the
    // rail width. Unlike an `.includes()` substring filter, this does NOT
    // silently drop runs that contain characters absent from the original
    // string (e.g. an injected hyphen) — every rail run is checked.
    const railRuns = runs.filter((r) => r.x < railWidthPt)
    expect(railRuns.length).toBeGreaterThan(0)
    for (const run of railRuns) {
      expect(run.x + run.width, `run "${run.str}" must not overflow the ${railWidthPt}pt rail`).toBeLessThanOrEqual(railWidthPt)
    }

    // The extracted/copyable text must reassemble to exactly the original
    // email — no inserted hyphen, space, or zero-width character anywhere,
    // whether or not a wrap actually occurred at a given point.
    const stripped = await extractStrippedText(buffer)
    expect(stripped).toContain(email)
  })

  it('wraps a long unbroken profile URL into multiple glyph runs instead of one run that overflows the rail, without corrupting the extracted text', async () => {
    const url = 'https://a-very-long-portfolio-domain-name.example.com/jane-smith/portfolio'
    const dataWithLongUrl: ResumeData = {
      basics: { name: 'Jane Smith', profiles: [{ id: 'p1', url }] },
    }
    const meta = { ...baseMeta, sidebarRailWidth: 20 }
    const { buffer, runs } = await renderToBufferAndRuns(SidebarPdfTemplate({ data: dataWithLongUrl, meta }))
    const railWidthPt = 595.28 * 0.20

    const railRuns = runs.filter((r) => r.x < railWidthPt)
    expect(railRuns.length).toBeGreaterThan(0)
    for (const run of railRuns) {
      expect(run.x + run.width, `run "${run.str}" must not overflow the ${railWidthPt}pt rail`).toBeLessThanOrEqual(railWidthPt)
    }

    const stripped = await extractStrippedText(buffer)
    expect(stripped).toContain(url)
  })

  it('does not alter the extracted text of a long email at wider rail widths (33%, 40%), where wrapping may not even be needed', async () => {
    const email = 'jane.smith.principal.architect@a-very-long-corporate-domain-name.example.com'
    const dataWithLongEmail: ResumeData = { basics: { name: 'Jane Smith', email } }
    for (const sidebarRailWidth of [33, 40]) {
      const { buffer } = await renderToBufferAndRuns(
        SidebarPdfTemplate({ data: dataWithLongEmail, meta: { ...baseMeta, sidebarRailWidth } })
      )
      const stripped = await extractStrippedText(buffer)
      expect(stripped, `sidebarRailWidth=${sidebarRailWidth}`).toContain(email)
    }
  })

  it('leaves ordinary short contact text (well under the chunk threshold) rendered as a single glyph run, unchanged from before', async () => {
    const runs = await renderToGlyphRuns(SidebarPdfTemplate({ data, meta: baseMeta }))
    const phoneRun = runs.find((r) => r.str === data.basics!.phone)
    expect(phoneRun, 'phone number should render as one intact glyph run').toBeTruthy()
  })
})

describe('ExecutivePdfTemplate name band', () => {
  it('clamps the name to 22pt (top of the 18-22pt band)', () => {
    const doc = ExecutivePdfTemplate({
      data,
      meta: { ...baseMeta, templateId: 'executive', layout: 'single-column' },
    }) as unknown as AnyElement
    const nameStyle = findStyleOfText(doc, 'Jane Smith')
    expect(nameStyle).not.toBeNull()
    expect(nameStyle!.fontSize).toBe(22)
  })
})
