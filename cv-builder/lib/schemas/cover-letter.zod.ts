// lib/schemas/cover-letter.zod.ts
// Zod schemas for the CoverLetter collection: one letter per job, written by a
// background job. The create body carries the job posting; the update body only
// lets the user edit the text or accept the pending approvals.
import { z } from 'zod'
import { MAX_JD_LENGTH } from '@/lib/ai/jd-extraction-pipeline'
import { LETTER_DESIGNS } from '@/lib/coverletter/design'

export const CoverLetterNotesSchema = z.object({
  motivation: z.string().trim().max(1000).optional(),
  explain: z.string().trim().max(1000).optional(),
  hiringManager: z.string().trim().max(120).optional(),
})
export type CoverLetterNotes = z.infer<typeof CoverLetterNotesSchema>

export const COVER_LETTER_STATUSES = ['writing', 'ready', 'failed'] as const
export const CoverLetterStatusEnum = z.enum(COVER_LETTER_STATUSES)
export type CoverLetterStatus = z.infer<typeof CoverLetterStatusEnum>

export const LetterDesignEnum = z.enum(LETTER_DESIGNS)

export const CreateCoverLetterSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  jobText: z.string().trim().min(1).max(MAX_JD_LENGTH),
  notes: CoverLetterNotesSchema.optional(),
  applicationId: z.string().optional(),
  scrapedJobId: z.string().optional(),
})
export type CreateCoverLetterInput = z.infer<typeof CreateCoverLetterSchema>

export const UpdateCoverLetterSchema = z.object({
  content: z.string().max(20000).optional(),
  notes: CoverLetterNotesSchema.optional(),
  design: LetterDesignEnum.optional(),
  // Only an empty list is accepted: sending [] means "keep the letter as written".
  pendingApprovals: z.array(z.never()).max(0).optional(),
})
export type UpdateCoverLetterInput = z.infer<typeof UpdateCoverLetterSchema>
