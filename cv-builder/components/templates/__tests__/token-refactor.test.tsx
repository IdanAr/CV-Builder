// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ClassicTemplate } from '../ClassicTemplate'
import { ExecutiveTemplate } from '../ExecutiveTemplate'
import { MinimalTemplate } from '../MinimalTemplate'
import { ModernTemplate } from '../ModernTemplate'
import { SidebarTemplate } from '../SidebarTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const TEMPLATES = [
  ['classic', ClassicTemplate], ['modern', ModernTemplate],
  ['minimal', MinimalTemplate], ['executive', ExecutiveTemplate],
  ['sidebar', SidebarTemplate],
] as const

const data: ResumeData = {
  basics: { name: 'Idan Arbel', label: 'Architect', email: 'idan@example.com',
            summary: 'Data Solutions Architect and GenAI platform developer.' },
  work: [{ name: 'SAS Israel', position: 'Data Solutions Architect', startDate: '2022-07',
           highlights: ['Prevented fraud', 'Cut false positives 20%'] }],
  education: [{ institution: 'Technion', area: 'Generative AI', studyType: 'Certificate', endDate: '2025-12' }],
  skills: [{ name: 'Data', keywords: ['SQL', 'MongoDB'] }],
}

// Snapshot every inline style the tree sets. A pure refactor changes none of
// them; a mis-transcribed token shows up here as a changed px value.
describe('token refactor moves nothing on the web side', () => {
  for (const [templateId, Template] of TEMPLATES) {
    it(`${templateId} inline styles are unchanged`, () => {
      const meta = {
        templateId, fontFamily: 'Calibri', headerFontFamily: 'Calibri',
        primaryColor: '#1e3a5f', accentColor: '#0066cc',
        pageMargins: 0.5, lineSpacing: 1.15,
        sectionOrder: ['work', 'education', 'skills'],
        layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
      } as ResumeMeta
      const { container } = render(<Template data={data} meta={meta} />)
      const styles = [...container.querySelectorAll<HTMLElement>('*')]
        .map((el, i) => `${i}:${el.getAttribute('style') ?? ''}`)
      expect(styles).toMatchSnapshot()
    })
  }
})
