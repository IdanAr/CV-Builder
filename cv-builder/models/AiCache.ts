import { Schema, model, models, type Document } from 'mongoose'

// Saved AI results, so the same input gives the same answer: a job
// description always yields the same keyword list, and an unchanged CV the
// same synonym matches. See lib/api/ai-cache.ts.
export interface IAiCache extends Document {
  userId: string
  // 'jd-requirements' | 'synonym-matches'
  kind: string
  // SHA-256 of a version tag plus the normalized input.
  key: string
  value: unknown
  createdAt: Date
}

const AiCacheSchema = new Schema<IAiCache>({
  userId: { type: String, required: true },
  kind: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
})

AiCacheSchema.index({ userId: 1, kind: 1, key: 1 }, { unique: true })

// A cache, not a record: entries expire after 30 days, and the next check
// of the same job simply asks the AI again.
AiCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

const AiCache = models.AiCache ?? model<IAiCache>('AiCache', AiCacheSchema)
export default AiCache
