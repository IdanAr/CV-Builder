import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withFontScale } from '../font-scale'
import { renderToGlyphRuns, type GlyphRun } from './pdf-geometry'
import { ClassicPdfTemplate } from '../templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from '../templates/ModernPdfTemplate'
import { MinimalPdfTemplate } from '../templates/MinimalPdfTemplate'
import { ExecutivePdfTemplate } from '../templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from '../templates/SidebarPdfTemplate'
import { AtsPdfTemplate } from '../templates/AtsPdfTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

vi.setConfig({ testTimeout: 30_000 })

describe('withFontScale', () => {
  const styles = { a: { fontSize: 10, color: 'red' }, b: { marginTop: 2 } }

  it('returns the same object at scale 1', () => {
    expect(withFontScale(styles, 1)).toBe(styles)
  })

  it('scales every fontSize and leaves other styles alone', () => {
    const out = withFontScale(styles, 1.1)
    expect(out.a).toEqual({ fontSize: 11, color: 'red' })
    expect(out.b).toEqual({ marginTop: 2 })
    expect(styles.a.fontSize).toBe(10)
  })
})

describe('PDF modules stay server-safe', () => {
  it('uses no React context or client directive (Next route handlers import these)', () => {
    const dir = join(__dirname, '..')
    const files = [
      'font-scale.ts', 'templates/pdf-utils.tsx', 'templates/pdf-primitives.tsx', 'templates/renderPdfCustomSection.tsx',
      ...['Classic', 'Modern', 'Minimal', 'Executive', 'Sidebar', 'Ats'].map((n) => `templates/${n}PdfTemplate.tsx`),
    ]
    for (const f of files) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/createContext|useContext|use client/)
    }
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
  const email = 'averyveryverylongfirstname.anevenlongerlastname@subdomain.example-company.com'
  const data: ResumeData = { ...fixture, basics: { ...fixture.basics, email } }

  // 20% rail; the rail padding is 0.7 x pageMargins. Chunk length is
  // floor(contentWidth / (0.65 x measured font size)).
  async function emailChunks(fontScale: number, pageMargins: number) {
    const meta = { ...metaFor('sidebar', fontScale), pageMargins, sidebarRailWidth: 20 }
    const runs = await renderToGlyphRuns(SidebarPdfTemplate({ data, meta, title: 'CV' }))
    const railRight = 595.28 * 0.2 - pageMargins * 0.7 * 72
    const parts = runs.filter((r) => r.str.trim().length > 0 && email.includes(r.str.trim()) && r.x < railRight + 1)
    for (const r of parts) expect(r.x + r.width, r.str).toBeLessThanOrEqual(railRight + 0.5)
    return Math.max(...parts.map((r) => r.str.trim().length))
  }

  it('sizes chunks from the rendered (scaled) font, not the unscaled one', async () => {
    // Content ~40.9pt: 6 chars at 10pt, 5 at 11pt.
    expect(await emailChunks(1, 0.775)).toBe(6)
    expect(await emailChunks(1.1, 0.775)).toBe(5)
  })

  it('does not scale the measured size twice', async () => {
    // Content ~44.0pt: 6 chars at 10pt and at 11pt, but 5 at 12.1pt (11 scaled again).
    expect(await emailChunks(1, 0.745)).toBe(6)
    expect(await emailChunks(1.1, 0.745)).toBe(6)
  })
})
