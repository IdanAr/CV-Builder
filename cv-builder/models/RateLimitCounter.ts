import { Schema, model, models, type Document } from 'mongoose'

// One fixed-window counter per (limiter key, window). Shared by every
// serverless instance, which is the point: an in-process Map gives each Vercel
// lambda its own budget, so a limit of 10/min was really 10/min per instance.
// See lib/rate-limit.ts.
//
// Not user data in the export/deletion sense (lib/api/account.ts): a counter
// holds only a key and a number, and every row expires within a day.
export interface IRateLimitCounter extends Document<string> {
  _id: string // `${key}:${windowIndex}`
  count: number
  expiresAt: Date
}

const RateLimitCounterSchema = new Schema<IRateLimitCounter>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
)

// TTL: Mongo's monitor deletes a row once its window has closed. It runs
// about once a minute, so a row can outlive its window briefly; harmless,
// because a later window always uses a new _id.
RateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RateLimitCounter =
  models.RateLimitCounter ?? model<IRateLimitCounter>('RateLimitCounter', RateLimitCounterSchema)
export default RateLimitCounter
