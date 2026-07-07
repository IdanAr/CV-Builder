import { Schema, model, models, type Document } from 'mongoose'

// The audit log: one row per changed field per PATCH — a flat, chronological
// "X changed from Y to Z at time T" feed.
export interface IApplicationActivity extends Document {
  applicationId: string
  userId: string
  // 'status' | 'company' | 'role' | 'resumeId' | a customFields column id
  field: string
  // Denormalized display label at the time of the change, so renaming a column
  // later doesn't rewrite history.
  fieldLabel: string
  fromValue: string | null
  toValue: string | null
  changedAt: Date
}

const ApplicationActivitySchema = new Schema<IApplicationActivity>({
  applicationId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  field: { type: String, required: true },
  fieldLabel: { type: String, required: true },
  fromValue: { type: String, default: null },
  toValue: { type: String, default: null },
  changedAt: { type: Date, required: true, default: () => new Date() },
})

const ApplicationActivity =
  models.ApplicationActivity ??
  model<IApplicationActivity>('ApplicationActivity', ApplicationActivitySchema)
export default ApplicationActivity
