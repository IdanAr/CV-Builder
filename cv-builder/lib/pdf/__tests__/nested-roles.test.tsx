import { describe, it, expect } from 'vitest'
import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { renderToGlyphRuns } from './pdf-geometry'

const meta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#1e3a5f', accentColor: '#0066cc', pageMargins: 0.5, sidebarRailWidth: 33, lineSpacing: 1.15,
  sectionOrder: [], layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
} as ResumeMeta

const dataWithWorkRoles: ResumeData = {
  work: [{
    name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
    roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: 'Present', summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
  }],
}

const dataWithEduRoles: ResumeData = {
  education: [{
    institution: 'MIT', studyType: 'BSc', area: 'CS', startDate: '2015-09', endDate: '2019-06',
    roles: [{ id: 'r1', studyType: 'MSc', area: 'CS', startDate: '2020-09', endDate: '2022-06', score: '3.9' }],
  }],
}

for (const templateId of ['classic', 'modern', 'minimal', 'executive'] as const) {
  describe(`nested work roles (PDF, ${templateId})`, () => {
    it('shows the aggregate header range and both roles', async () => {
      const runs = await renderToGlyphRuns(
        selectPdfTemplate(dataWithWorkRoles, { ...meta, templateId }, 'designed', 'CV') as React.ReactElement
      )
      const text = runs.map(r => r.str).join(' ')
      expect(text).toContain('Data Analyst')
      expect(text).toContain('Data Team Lead')
      expect(text).toContain('Grew headcount 3x')
      expect(text).toMatch(/01\/2019.*Present/)
    })
  })

  describe(`nested education roles (PDF, ${templateId})`, () => {
    it('shows the aggregate header range and both programs', async () => {
      const runs = await renderToGlyphRuns(
        selectPdfTemplate(dataWithEduRoles, { ...meta, templateId }, 'designed', 'CV') as React.ReactElement
      )
      const text = runs.map(r => r.str).join(' ')
      expect(text).toContain('BSc')
      expect(text).toContain('MSc')
      expect(text).toMatch(/09\/2015.*06\/2022/)
    })
  })
}

describe('nested work roles (PDF, Sidebar rail)', () => {
  it('shows both roles when work is assigned to the rail column', async () => {
    const runs = await renderToGlyphRuns(
      selectPdfTemplate(
        dataWithWorkRoles,
        { ...meta, templateId: 'sidebar', columnAssignment: { work: 'left' } },
        'designed', 'CV'
      ) as React.ReactElement
    )
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('Data Analyst')
    expect(text).toContain('Data Team Lead')
  })
})
