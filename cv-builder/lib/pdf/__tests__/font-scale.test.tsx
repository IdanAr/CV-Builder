import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { scaleStyle } from '../font-scale'
import { renderToGlyphRuns, type GlyphRun } from './pdf-geometry'
import { ClassicPdfTemplate } from '../templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from '../templates/ModernPdfTemplate'
import { MinimalPdfTemplate } from '../templates/MinimalPdfTemplate'
import { ExecutivePdfTemplate } from '../templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from '../templates/SidebarPdfTemplate'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 30_000 })

describe('scaleStyle', () => {
  it('is the identity at scale 1 (same reference)', () => {
    const s = { fontSize: 10, color: '#000' }
    expect(scaleStyle(s, 1)).toBe(s)
  })

  it('scales fontSize and leaves other properties alone', () => {
    expect(scaleStyle({ fontSize: 10, marginTop: 4 }, 1.05)).toEqual({ fontSize: 10.5, marginTop: 4 })
  })

  it('flattens style arrays with later entries winning, then scales', () => {
    expect(scaleStyle([{ fontSize: 10, color: 'red' }, false, [{ fontSize: 12 }]], 1.1)).toEqual({ fontSize: 13.2, color: 'red' })
  })

  it('passes through styles without a fontSize', () => {
    expect(scaleStyle({ marginTop: 3 }, 1.05)).toEqual({ marginTop: 3 })
    expect(scaleStyle(undefined, 1.05)).toBeUndefined()
  })
})

const fixture: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Principal Architect', email: 'jane@example.com', summary: 'Platform engineer.' },
  work: [{ name: 'Acme Corp', position: 'Senior Engineer', startDate: '2020-01', highlights: ['Cut infra costs 40%'] }],
  education: [{ institution: 'MIT', area: 'Computer Science', studyType: 'BSc', endDate: '2016-06' }],
  skills: [{ name: 'TypeScript', keywords: ['React'] }],
}

function metaFor(templateId: string, fontScale: number): ResumeMeta {
  return {
    templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
    primaryColor: '#1e3a5f', accentColor: '#0066cc',
    pageMargins: 0.75, sidebarRailWidth: 33, lineSpacing: 1.15, fontScale,
    sectionOrder: ['work', 'education', 'skills'],
    layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
  }
}

const TEMPLATES = [
  ['classic', ClassicPdfTemplate],
  ['modern', ModernPdfTemplate],
  ['minimal', MinimalPdfTemplate],
  ['executive', ExecutivePdfTemplate],
  ['sidebar', SidebarPdfTemplate],
  ['ats', AtsPdfTemplate],
] as const

/** The distinct glyph heights of a render, rounded so layout jitter does not matter. */
function heights(runs: GlyphRun[]): number[] {
  return [...new Set(runs.map((r) => Math.round(r.height * 10) / 10))].sort((a, b) => a - b)
}

describe.each(TEMPLATES)('%s PDF font scale', (id, Template) => {
  it('scales every rendered text size by the same factor', async () => {
    const base = heights(await renderToGlyphRuns(Template({ data: fixture, meta: metaFor(id, 1), title: 'CV' })))
    const big = heights(await renderToGlyphRuns(Template({ data: fixture, meta: metaFor(id, 1.05), title: 'CV' })))
    expect(base.length).toBeGreaterThan(2)
    for (const h of base) {
      expect(big.some((b) => Math.abs(b - h * 1.05) <= 0.2), `no ${h}pt -> ${(h * 1.05).toFixed(1)}pt`).toBe(true)
    }
  })

  it('is unchanged in text layout at scale 1', async () => {
    const a = await renderToGlyphRuns(Template({ data: fixture, meta: metaFor(id, 1), title: 'CV' }))
    const { fontScale: _omit, ...rest } = metaFor(id, 1)
    const b = await renderToGlyphRuns(Template({ data: fixture, meta: rest as unknown as ResumeMeta, title: 'CV' }))
    expect(b.map((r) => [r.str, r.x, r.y, r.height])).toEqual(a.map((r) => [r.str, r.x, r.y, r.height]))
  })
})

describe('sidebar rail contact text with a scaled font', () => {
  it('keeps unbroken contact tokens inside the rail and sizes chunks from the scaled font', async () => {
    const email = 'averyveryverylongfirstname.anevenlongerlastname@subdomain.example-company.com'
    const data: ResumeData = { ...fixture, basics: { ...fixture.basics, email } }
    // 20% rail at pageMargins 0.775: padding 0.7 x 0.775in = 39.06pt a side, so
    // the content box is ~40.9pt. The chunk size is floor(width / (0.65 x font)):
    // 6 chars at the 10pt contact size, 5 at the 11pt that fontScale 1.1 renders.
    const meta = { ...metaFor('sidebar', 1.1), pageMargins: 0.775, sidebarRailWidth: 20 }
    const runs = await renderToGlyphRuns(SidebarPdfTemplate({ data, meta, title: 'CV' }))
    const railRight = 595.28 * 0.2 - 0.775 * 0.7 * 72
    const parts = runs.filter((r) => r.str.trim().length > 0 && email.includes(r.str.trim()) && r.x < railRight + 1)
    expect(parts.length).toBeGreaterThan(5)
    expect(Math.max(...parts.map((r) => r.str.trim().length))).toBeLessThanOrEqual(5)
    for (const r of parts) expect(r.x + r.width, r.str).toBeLessThanOrEqual(railRight + 0.5)
  })
})
