import mongoose, { Schema, model, models, type Document } from 'mongoose'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export interface IResume extends Document {
  userId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  createdAt: Date
  updatedAt: Date
}

const ResumeSchema = new Schema<IResume>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    data: { type: Schema.Types.Mixed, default: {} },
    meta: {
      templateId: { type: String, default: 'classic' },
      fontFamily: { type: String, default: 'Calibri' },
      headerFontFamily: { type: String, default: 'Calibri' },
      primaryColor: { type: String, default: '#000000' },
      accentColor: { type: String, default: '#0066cc' },
      pageMargins: { type: Number, default: 1.0 },
      lineSpacing: { type: Number, default: 1.15 },
      sectionOrder: {
        type: [String],
        default: ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects'],
      },
      layout: { type: String, enum: ['single-column', 'two-column'], default: 'single-column' },
      excludedAtsKeywords: { type: [String], default: [] },
    },
  },
  { timestamps: true }
)

const Resume = models.Resume ?? model<IResume>('Resume', ResumeSchema)
export default Resume
