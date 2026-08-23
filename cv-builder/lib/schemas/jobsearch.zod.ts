// Zod schemas for job-search profiles (Sprint: job search integration, Phase 1).
// See docs/superpowers/specs/2026-08-22-job-search-integration-design.md §4.
import { z } from 'zod'

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const
export const WorkModeEnum = z.enum(WORK_MODES)
export type WorkMode = z.infer<typeof WorkModeEnum>

// freehire.me's documented --seniority facet values (see design spec §5).
export const SENIORITY_LEVELS = ['junior', 'middle', 'senior', 'staff', 'principal', 'lead'] as const
export const SeniorityEnum = z.enum(SENIORITY_LEVELS)
export type Seniority = z.infer<typeof SeniorityEnum>

export const JobLocationSchema = z.object({
  country: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
})
export type JobLocation = z.infer<typeof JobLocationSchema>

export const DEFAULT_RECENCY_DAYS = 14
export const DEFAULT_MIN_ATS_SCORE = 75

export const JobSearchProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  resumeId: z.string().optional(),
  roles: z.array(z.string().trim().min(1)).default([]),
  workModes: z.array(WorkModeEnum).default([]),
  locations: z.array(JobLocationSchema).default([]),
  seniority: z.array(SeniorityEnum).default([]),
  categories: z.array(z.string().trim().min(1)).default([]),
  industries: z.array(z.string().trim().min(1)).default([]),
  recencyDays: z.number().int().min(1).max(90).default(DEFAULT_RECENCY_DAYS),
  minAtsScore: z.number().int().min(0).max(100).default(DEFAULT_MIN_ATS_SCORE),
  isActive: z.boolean().default(true),
})
export type JobSearchProfileInput = z.infer<typeof JobSearchProfileSchema>

export const CreateJobSearchProfileSchema = JobSearchProfileSchema
export type CreateJobSearchProfileInput = z.infer<typeof CreateJobSearchProfileSchema>

// NOT derived via JobSearchProfileSchema.partial(): in this repo's Zod version
// (4.4.3), .partial() on a schema whose fields carry .default(...) does NOT
// stop those defaults from firing when a key is absent from the input — so a
// partial() based schema would backfill every missing field (arrays -> [],
// recencyDays -> 14, etc.) and updateJobSearchProfile's `{ $set: input }`
// would silently wipe untouched fields on every PATCH. Instead this is its
// own explicit, hand-written all-optional object with no .default(...) calls
// at all, matching PatchApplicationSchema's pattern in application.zod.ts.
export const PatchJobSearchProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  resumeId: z.string().optional(),
  roles: z.array(z.string().trim().min(1)).optional(),
  workModes: z.array(WorkModeEnum).optional(),
  locations: z.array(JobLocationSchema).optional(),
  seniority: z.array(SeniorityEnum).optional(),
  categories: z.array(z.string().trim().min(1)).optional(),
  industries: z.array(z.string().trim().min(1)).optional(),
  recencyDays: z.number().int().min(1).max(90).optional(),
  minAtsScore: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
})
export type PatchJobSearchProfileInput = z.infer<typeof PatchJobSearchProfileSchema>

export const SCRAPE_SOURCES = ['freehire'] as const
export const ScrapeSourceEnum = z.enum(SCRAPE_SOURCES)
export type ScrapeSource = z.infer<typeof ScrapeSourceEnum>

export const SCRAPED_JOB_STATUSES = [
  'new',
  'notified',
  'queued',
  'needs_review',
  'submitted',
  'dismissed',
  'expired',
] as const
export const ScrapedJobStatusEnum = z.enum(SCRAPED_JOB_STATUSES)
export type ScrapedJobStatus = z.infer<typeof ScrapedJobStatusEnum>

export const RESOLVED_ACTIONS = ['notify', 'draft_and_queue'] as const
export const ResolvedActionEnum = z.enum(RESOLVED_ACTIONS)
export type ResolvedAction = z.infer<typeof ResolvedActionEnum>

// Internally constructed by lib/jobsearch/scan.ts, never accepted directly
// from a user-facing API route — there is no public write endpoint for
// ScrapedJob in this phase (only GET /api/jobsearch/scraped-jobs). Defined
// as a Zod schema anyway for type inference and test coverage, matching
// this repo's "extend the schema first" convention.
export const ScrapedJobSchema = z.object({
  profileId: z.string(),
  source: ScrapeSourceEnum,
  sourceId: z.string().min(1),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  url: z.string(),
  description: z.string(),
  postedAt: z.date().optional(),
  workMode: WorkModeEnum.optional(),
  atsScore: z.number().int().min(0).max(100).optional(),
  matchedRules: z.array(z.string()).default([]),
  resolvedActions: z.array(ResolvedActionEnum).default([]),
  draftResumeId: z.string().optional(),
  postTailorScore: z.number().int().min(0).max(100).optional(),
  status: ScrapedJobStatusEnum.default('new'),
})
export type CreateScrapedJobInput = z.infer<typeof ScrapedJobSchema>
