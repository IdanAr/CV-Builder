import { Schema, model, models, type Document } from 'mongoose'
import type {
  ScrapeSource,
  ScrapedJobStatus,
  ResolvedAction,
  WorkMode,
} from '@/lib/schemas/jobsearch.zod'

export interface IScrapedJob extends Document {
  userId: string
  profileId: string
  source: ScrapeSource
  sourceId: string
  title: string
  company: string
  location?: string
  url: string
  description: string
  postedAt?: Date
  workMode?: WorkMode
  firstSeenAt: Date
  atsScore?: number
  matchedRules: string[]
  resolvedActions: ResolvedAction[]
  draftResumeId?: string
  postTailorScore?: number
  pendingApprovals: string[]
  tailoredKeywords: string[]
  draftedAt?: Date
  deletedAt?: Date
  status: ScrapedJobStatus
  createdAt: Date
  updatedAt: Date
}

const ScrapedJobSchema = new Schema<IScrapedJob>(
  {
    userId: { type: String, required: true, index: true },
    profileId: { type: String, required: true, index: true },
    source: { type: String, required: true },
    sourceId: { type: String, required: true },
    title: { type: String, default: '' },
    company: { type: String, default: '' },
    location: { type: String },
    url: { type: String, default: '' },
    description: { type: String, default: '' },
    postedAt: { type: Date },
    workMode: { type: String },
    firstSeenAt: { type: Date, default: () => new Date() },
    atsScore: { type: Number },
    matchedRules: { type: [String], default: [] },
    resolvedActions: { type: [String], default: [] },
    draftResumeId: { type: String },
    postTailorScore: { type: Number },
    pendingApprovals: { type: [String], default: [] },
    tailoredKeywords: { type: [String], default: [] },
    draftedAt: { type: Date },
    // Soft-delete marker — see the `deletedAt` note in lib/schemas/jobsearch.zod.ts.
    // User-facing lists filter it out; the unique (userId, profileId, source,
    // sourceId) index above keeps using the surviving row to suppress re-scraping.
    deletedAt: { type: Date },
    status: { type: String, default: 'new' },
  },
  { timestamps: true, minimize: false }
)

ScrapedJobSchema.index({ userId: 1, profileId: 1, source: 1, sourceId: 1 }, { unique: true })
ScrapedJobSchema.index({ userId: 1, draftedAt: 1 })

// Covers listScrapedJobs' {userId, profileId} query sorted by createdAt desc,
// and listDraftQueueBacklog's/listNewScrapedJobs' status-filtered queries —
// both fall back to an in-memory sort/filter over the (userId,profileId)
// prefix without these as scraped-job history accumulates per profile.
ScrapedJobSchema.index({ userId: 1, profileId: 1, createdAt: -1 })
ScrapedJobSchema.index({ userId: 1, profileId: 1, status: 1 })

// Tombstone retention: 90 days (product decision).
//
// A deleted posting is kept rather than removed because the row IS the dedup
// key — findExistingSourceIds is what stops the next scan re-fetching and
// re-tailoring something the user deliberately deleted, at full AI cost. So
// these cannot simply be purged; they can only be allowed to expire once the
// posting they describe is old enough that re-surfacing it is acceptable
// rather than annoying. 90 days is comfortably past the life of a real job
// posting.
//
// A TTL index only expires documents where the field exists and holds a Date,
// so this applies to tombstones alone -- live postings have no deletedAt and
// are never touched by it.
//
// Note for deploy: MongoDB's TTL monitor runs about once a minute, so
// expiry is eventual, not immediate. Existing tombstones older than 90 days
// will be removed shortly after this index builds.
ScrapedJobSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

const ScrapedJob = models.ScrapedJob ?? model<IScrapedJob>('ScrapedJob', ScrapedJobSchema)
export default ScrapedJob
