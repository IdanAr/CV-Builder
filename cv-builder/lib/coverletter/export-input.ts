// lib/coverletter/export-input.ts
// Builds what the PDF and DOCX renderers are handed from a stored letter and its
// CV. Pure: the route passes the date in. Fonts, accent and scale come from the
// CV's design tree (`meta`); the letter's own words come from the letter.
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type { CoverLetterNotes } from '@/lib/schemas/cover-letter.zod'
import { resolveDesign, type LetterDesign } from './design'
import { letterFileTitle, letterHeader, letterRecipient, letterSubject, type LetterLanguage } from './header'
import type { CoverLetterRenderInput } from './render-input'

export function letterExportInput(
  letter: {
    content: string
    company: string
    role: string
    notes: CoverLetterNotes
    language: LetterLanguage
    design?: LetterDesign
  },
  resume: { data: ResumeData; meta: ResumeMeta },
  now: Date,
): CoverLetterRenderInput {
  const header = letterHeader(resume.data?.basics, now, letter.language)
  const meta = resume.meta
  return {
    content: letter.content,
    design: resolveDesign(letter.design, meta?.templateId),
    language: letter.language,
    name: header.name || undefined,
    contact: header.contact || undefined,
    date: header.date,
    recipient: letterRecipient({ company: letter.company, hiringManager: letter.notes?.hiringManager }),
    subject: letterSubject({ company: letter.company, role: letter.role, language: letter.language }),
    title: letterFileTitle({ company: letter.company, role: letter.role }),
    font: meta?.fontFamily,
    headerFont: meta?.headerFontFamily,
    accentColor: meta?.accentColor,
    fontScale: meta?.fontScale,
  }
}

/**
 * Content-Disposition for a download: an ASCII `filename` for old clients and an
 * RFC 5987 `filename*` that carries the real (possibly Hebrew) name.
 */
export function contentDisposition(title: string, ext: 'pdf' | 'docx'): string {
  // Per " - " part, so a fully non-ASCII part leaves no empty separator behind.
  const fallback =
    title
      .split(' - ')
      .map((part) => part.replace(/[^\x20-\x7e]/g, '').replace(/"/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' - ') || 'Cover Letter'
  return `attachment; filename="${fallback}.${ext}"; filename*=UTF-8''${encodeURIComponent(`${title}.${ext}`)}`
}
