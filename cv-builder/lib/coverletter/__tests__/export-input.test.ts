import { describe, it, expect } from 'vitest'
import { letterExportInput, contentDisposition } from '../export-input'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const NOW = new Date('2026-10-21T09:00:00Z')

const data = {
  basics: { name: 'Jordan Example', email: 'jordan@example.com', location: { city: 'Haifa' } },
} as unknown as ResumeData

const meta = (over: Partial<ResumeMeta> = {}) => ({ templateId: 'classic', fontFamily: 'Arial', ...over }) as ResumeMeta

const letter = (over: Record<string, unknown> = {}) => ({
  content: 'Dear team,\n\nHello.',
  company: 'Acme',
  role: 'Data Analyst',
  notes: {},
  language: 'en' as const,
  ...over,
})

describe('letterExportInput', () => {
  it('fills the header, recipient, subject and title', () => {
    const input = letterExportInput(letter({ notes: { hiringManager: 'Sam Rivers' } }), { data, meta: meta() }, NOW)
    expect(input.name).toBe('Jordan Example')
    expect(input.contact).toBe('jordan@example.com · Haifa')
    expect(input.date).toBe('21 October 2026')
    expect(input.recipient).toEqual(['Sam Rivers', 'Acme'])
    expect(input.subject).toBe('Re: Data Analyst, Acme')
    expect(input.title).toBe('Cover Letter - Data Analyst - Acme')
    expect(input.content).toBe('Dear team,\n\nHello.')
  })

  it('leaves out the recipient and subject of a legacy letter', () => {
    const input = letterExportInput(letter({ company: 'Unspecified', role: 'Unspecified' }), { data, meta: meta() }, NOW)
    expect(input.recipient).toEqual([])
    expect(input.subject).toBeNull()
    expect(input.title).toBe('Cover Letter')
  })

  it('follows the CV template when the letter has no design', () => {
    expect(letterExportInput(letter(), { data, meta: meta({ templateId: 'modern' }) }, NOW).design).toBe('accent-edge')
    expect(letterExportInput(letter(), { data, meta: meta({ templateId: 'classic' }) }, NOW).design).toBe('classic')
  })

  it('uses the letter design when it is set', () => {
    expect(letterExportInput(letter({ design: 'classic' }), { data, meta: meta({ templateId: 'modern' }) }, NOW).design).toBe('classic')
    expect(letterExportInput(letter({ design: 'accent-edge' }), { data, meta: meta() }, NOW).design).toBe('accent-edge')
  })

  it('passes fonts, accent and font scale from the CV meta and the language from the letter', () => {
    const input = letterExportInput(
      letter({ language: 'he' }),
      { data, meta: meta({ fontFamily: 'Heebo', headerFontFamily: 'Rubik', accentColor: '#112233', fontScale: 1.1 }) },
      NOW,
    )
    expect(input).toMatchObject({ font: 'Heebo', headerFont: 'Rubik', accentColor: '#112233', fontScale: 1.1, language: 'he' })
    expect(input.date).toContain('באוקטובר')
  })

  it('omits an empty name and contact', () => {
    const input = letterExportInput(letter(), { data: {} as ResumeData, meta: meta() }, NOW)
    expect(input.name).toBeUndefined()
    expect(input.contact).toBeUndefined()
  })
})

describe('contentDisposition', () => {
  it('gives an ASCII fallback and a UTF-8 filename*', () => {
    const h = contentDisposition('Cover Letter - אנליסט - אקמי', 'pdf')
    expect(h).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/)
    expect(h).toContain(`filename*=UTF-8''${encodeURIComponent('Cover Letter - אנליסט - אקמי.pdf')}`)
  })

  it('never leaves the fallback empty', () => {
    const h = contentDisposition('אקמי', 'docx')
    expect(h).toContain('filename="Cover Letter.docx"')
  })

  it('drops non-ASCII parts without leaving a dangling separator', () => {
    expect(contentDisposition('Cover Letter - אנליסט - Acme', 'pdf')).toContain('filename="Cover Letter - Acme.pdf"')
  })

  it('keeps plain ASCII titles in the fallback', () => {
    expect(contentDisposition('Cover Letter - Data Analyst - Acme', 'pdf')).toContain('filename="Cover Letter - Data Analyst - Acme.pdf"')
  })
})
