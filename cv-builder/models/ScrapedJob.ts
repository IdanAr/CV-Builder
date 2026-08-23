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
    status: { type: String, default: 'new' },
  },
  { timestamps: true, minimize: false }
)

ScrapedJobSchema.index({ userId: 1, profileId: 1, source: 1, sourceId: 1 }, { unique: true })

const ScrapedJob = models.ScrapedJob ?? model<IScrapedJob>('ScrapedJob', ScrapedJobSchema)
export default ScrapedJob
