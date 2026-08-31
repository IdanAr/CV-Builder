import { Schema, model, models, type Document } from 'mongoose'
import type { ApplicationStatus, ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export interface IResume extends Document {
  userId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  applicationStatus: ApplicationStatus
  targetCompany?: string
  targetRole?: string
  parentResumeId?: string
  createdAt: Date
  updatedAt: Date
}

const ResumeSchema = new Schema<IResume>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    data: { type: Schema.Types.Mixed, default: {} },
    meta: { type: Schema.Types.Mixed, default: {} },
    applicationStatus: { type: String, enum: ['draft', 'applied', 'interviewing', 'offer', 'rejected'], default: 'draft' },
    targetCompany: { type: String, maxlength: 200 },
    targetRole: { type: String, maxlength: 200 },
    parentResumeId: { type: String },
  },
  { timestamps: true }
)

const Resume = models.Resume ?? model<IResume>('Resume', ResumeSchema)
export default Resume
