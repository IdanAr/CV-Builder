import { Schema, model, models, type Document } from 'mongoose'
import type { CustomFieldValue } from '@/lib/schemas/application.zod'

export interface IApplication extends Document {
  userId: string
  resumeId?: string
  company: string
  role: string
  // References an option id in the user's status column config (BoardConfig) —
  // status values are user-customizable, not a hardcoded enum.
  status: string
  // Fractional-index style ordering: rows start at 1000-spaced values and
  // drag-insertions land at midpoints, so reordering never renumbers every row.
  order: number
  // Keyed by BoardConfig column id, typed per that column's `type`.
  customFields: Record<string, CustomFieldValue>
  createdAt: Date
  updatedAt: Date
}

const ApplicationSchema = new Schema<IApplication>(
  {
    userId: { type: String, required: true, index: true },
    resumeId: { type: String },
    company: { type: String, default: '', maxlength: 200 },
    role: { type: String, default: '', maxlength: 200 },
    status: { type: String, default: 'applied' },
    order: { type: Number, default: 1000 },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
)

const Application = models.Application ?? model<IApplication>('Application', ApplicationSchema)
export default Application
