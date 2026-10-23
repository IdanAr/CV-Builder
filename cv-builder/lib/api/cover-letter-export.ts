// lib/api/cover-letter-export.ts
// The checks both letter export routes share: the CV and the letter must be the
// user's, and the letter must be finished and fully approved before it can leave
// the app as a file.
import type { NextResponse } from 'next/server'
import { getResume } from '@/lib/api/resumes'
import { getCoverLetter } from '@/lib/api/cover-letters'
import { apiError } from '@/lib/api/route-errors'
import { letterExportInput } from '@/lib/coverletter/export-input'
import type { CoverLetterRenderInput } from '@/lib/coverletter/render-input'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export type LetterExport =
  | { ok: true; input: CoverLetterRenderInput; meta: ResumeMeta }
  | { ok: false; response: NextResponse }

export async function loadLetterForExport(userId: string, resumeId: string, letterId: string, now: Date): Promise<LetterExport> {
  const resume = await getResume(userId, resumeId)
  if (!resume) return { ok: false, response: apiError('NOT_FOUND', 'Not found', 404) }

  const letter = await getCoverLetter(userId, resumeId, letterId)
  if (!letter) return { ok: false, response: apiError('NOT_FOUND', 'Not found', 404) }

  if (letter.status === 'writing') {
    return { ok: false, response: apiError('CONFLICT', 'This letter is still being written.', 409) }
  }
  if ((letter.pendingApprovals ?? []).length > 0) {
    return { ok: false, response: apiError('CONFLICT', 'Keep or edit the flagged sentences before exporting.', 409) }
  }
  if (!letter.content?.trim()) {
    return { ok: false, response: apiError('CONFLICT', 'This letter has no text to export.', 409) }
  }

  const meta = (resume.meta ?? {}) as ResumeMeta
  const input = letterExportInput(letter, { data: (resume.data ?? {}) as ResumeData, meta }, now)
  return { ok: true, input, meta }
}
