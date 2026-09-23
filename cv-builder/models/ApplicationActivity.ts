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

// Matches lib/api/applications.ts's activity-log query:
// find({ applicationId, userId }).sort({ changedAt: -1 })
ApplicationActivitySchema.index({ applicationId: 1, userId: 1, changedAt: -1 })

// History retention: 180 days (product decision).
//
// This collection gains a row per changed field per PATCH and nothing pruned
// it, so a long-lived, heavily-edited application accumulated history without
// bound. Unlike a ScrapedJob tombstone, an old activity row carries no
// load-bearing meaning -- it is a record for the user to read, and one they
// stop reading long before six months are up.
//
// lib/api/applications.ts also bounds how much is read at once; this bounds
// how much is stored.
//
// Note for deploy: this removes existing rows older than 180 days shortly
// after the index builds. That is the intent, but it is not reversible.
ApplicationActivitySchema.index({ changedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })

const ApplicationActivity =
  models.ApplicationActivity ??
  model<IApplicationActivity>('ApplicationActivity', ApplicationActivitySchema)
export default ApplicationActivity
