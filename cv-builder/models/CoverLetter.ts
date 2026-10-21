import { Schema, model, models } from 'mongoose'
import { PROGRESS_STEPS, type ProgressStep } from '@/lib/ai/cover-letter/pipeline'
import {
  COVER_LETTER_STATUSES,
  type CoverLetterNotes,
  type CoverLetterStatus,
} from '@/lib/schemas/cover-letter.zod'

export interface ICoverLetter {
  userId: string
  resumeId: string
  applicationId?: string
  scrapedJobId?: string
  company: string
  role: string
  jobText: string
  notes: CoverLetterNotes
  content: string
  // Claims the hallucination guard could not trace to the CV; cleared when the user keeps the letter.
  pendingApprovals: string[]
  notices: string[]
  language: 'en' | 'he'
  status: CoverLetterStatus
  progress?: ProgressStep
  error?: string
  startedAt?: Date
  // Set on the letter migrated from the old ResumeData.coverLetter field.
  legacy?: boolean
  createdAt: Date
  updatedAt: Date
}

const CoverLetterSchema = new Schema<ICoverLetter>(
  {
    userId: { type: String, required: true },
    resumeId: { type: String, required: true },
    applicationId: { type: String },
    scrapedJobId: { type: String },
    company: { type: String, required: true, maxlength: 200 },
    role: { type: String, required: true, maxlength: 200 },
    jobText: { type: String, required: true, maxlength: 10_000 },
    notes: {
      motivation: { type: String, maxlength: 1000 },
      explain: { type: String, maxlength: 1000 },
      hiringManager: { type: String, maxlength: 120 },
    },
    content: { type: String, default: '', maxlength: 20_000 },
    pendingApprovals: { type: [String], default: [] },
    notices: { type: [String], default: [] },
    language: { type: String, enum: ['en', 'he'], default: 'en' },
    status: { type: String, enum: COVER_LETTER_STATUSES, default: 'writing' },
    progress: { type: String, enum: PROGRESS_STEPS },
    error: { type: String },
    startedAt: { type: Date },
    legacy: { type: Boolean },
  },
  { timestamps: true, minimize: false }
)

// A résumé's letter list, newest first.
CoverLetterSchema.index({ userId: 1, resumeId: 1, updatedAt: -1 })
// At most one migrated legacy letter per résumé; ordinary letters are not indexed here.
CoverLetterSchema.index({ resumeId: 1, legacy: 1 }, { unique: true, partialFilterExpression: { legacy: true } })
// Finds the letter written for a scraped job.
CoverLetterSchema.index({ scrapedJobId: 1 }, { sparse: true })

const CoverLetter = models.CoverLetter ?? model<ICoverLetter>('CoverLetter', CoverLetterSchema)
export default CoverLetter
