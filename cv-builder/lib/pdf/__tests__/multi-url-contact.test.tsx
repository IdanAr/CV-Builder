import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { renderToGlyphRuns } from './pdf-geometry'

const meta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc', pageMargins: 0.5, lineSpacing: 1.15,
  sectionOrder: [], layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
} as ResumeMeta

const dataWithProfiles: ResumeData = {
  basics: {
    name: 'Jane Smith',
    profiles: [
      { id: 'p1', label: 'Portfolio', url: 'https://janesmith.dev' },
      { id: 'p2', url: 'https://github.com/janesmith' },
    ],
  },
}

describe('multi-URL contact row (PDF, designed mode)', () => {
  it('renders the label for a labeled profile and the raw URL for an unlabeled one', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(dataWithProfiles, meta, 'designed', 'CV') as React.ReactElement
    )
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('Portfolio')
    expect(text).toContain('github.com/janesmith')
  })

  it('does not crash when profiles is empty', async () => {
    const buf = await renderToBuffer(
      selectPdfTemplate({ basics: { name: 'Jane' } }, meta, 'designed', 'CV') as React.ReactElement<never>
    )
    expect(buf.length).toBeGreaterThan(0)
  })
})

describe('multi-URL contact row (PDF, Sidebar template)', () => {
  it('renders each profile as a clickable link in the rail', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(dataWithProfiles, { ...meta, templateId: 'sidebar' }, 'designed', 'CV') as React.ReactElement
    )
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('Portfolio')
    expect(text).toContain('github.com/janesmith')
  })
})

describe('multi-URL contact row (PDF, ats mode)', () => {
  it('joins every profile URL into the single plain-text contact line', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(dataWithProfiles, meta, 'ats', 'CV') as React.ReactElement
    )
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('Portfolio')
    expect(text).toContain('github.com/janesmith')
  })

  it('preserves the raw URL text even when the profile has a label, so ATS parsers can still extract it', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(dataWithProfiles, meta, 'ats', 'CV') as React.ReactElement
    )
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('Portfolio')
    expect(text).toContain('janesmith.dev')
  })
})
