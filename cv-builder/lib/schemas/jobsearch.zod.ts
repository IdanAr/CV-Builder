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

// One Comeet-hosted employer to poll directly (see lib/jobsearch/sources/comeet.ts) —
// Comeet has no cross-company search, so unlike freehire this is a hand-curated list
// rather than a role/keyword query. `token` is the company's public-facing careers-page
// token (same tier as freehire's own public API — not a user secret), obtained from
// that company's own public Comeet careers page.
export const ComeetCompanyWatchSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100),
  uid: z.string().trim().min(1, 'Company UID is required').max(100),
  token: z.string().trim().min(1, 'Company token is required').max(200),
})
export type ComeetCompanyWatch = z.infer<typeof ComeetCompanyWatchSchema>

// Bounds how many outbound Comeet calls one profile can trigger per scan (see
// lib/jobsearch/scan.ts's MAX_COMEET_COMPANIES, which re-enforces this at fetch time).
export const MAX_COMEET_COMPANIES = 10

export const JobSearchProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  resumeId: z.string().optional(),
  roles: z.array(z.string().trim().min(1)).default([]),
  workModes: z.array(WorkModeEnum).default([]),
  locations: z.array(JobLocationSchema).default([]),
  seniority: z.array(SeniorityEnum).default([]),
  categories: z.array(z.string().trim().min(1)).default([]),
  industries: z.array(z.string().trim().min(1)).default([]),
  comeetCompanies: z.array(ComeetCompanyWatchSchema).max(MAX_COMEET_COMPANIES).default([]),
  recencyDays: z.number().int().min(1).max(90).default(DEFAULT_RECENCY_DAYS),
  minAtsScore: z.number().int().min(0).max(100).default(DEFAULT_MIN_ATS_SCORE),
  isActive: z.boolean().default(true),
})

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
  comeetCompanies: z.array(ComeetCompanyWatchSchema).max(MAX_COMEET_COMPANIES).optional(),
  recencyDays: z.number().int().min(1).max(90).optional(),
  minAtsScore: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
})
export type PatchJobSearchProfileInput = z.infer<typeof PatchJobSearchProfileSchema>

export const SCRAPE_SOURCES = ['freehire', 'comeet'] as const
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
  // Numeric claims / skill terms hallucination-guard flagged in the tailored
  // draft or cover letter — non-empty blocks status from reaching 'queued'
  // (design spec §7 step 3) and is surfaced to the user for resolution.
  pendingApprovals: z.array(z.string()).default([]),
  // Union of AtsFix.targetKeywords across every fix actually applied while
  // tailoring — powers the "which JD keywords moved the score" panel
  // (design spec §7, reusing AtsFixReviewPanel's missing-keyword UI).
  tailoredKeywords: z.array(z.string()).default([]),
  // Set exactly once, when the apply pipeline successfully persists a draft
  // — the anchor for the rolling-24h daily draft caps (design spec §7).
  // Absent means "not drafted yet" (either never matched draft_and_queue,
  // or matched but is sitting in the backlog waiting for cap headroom).
  draftedAt: z.date().optional(),
  status: ScrapedJobStatusEnum.default('new'),
})
export type CreateScrapedJobInput = z.infer<typeof ScrapedJobSchema>

// Rule conditions for job-search matching (design spec §4). A discriminated
// union on `field` so each field only accepts the ops/value shape that make
// sense for it — e.g. postedWithinDays only ever takes `lte`, never `gte`.
const AtsScoreConditionSchema = z.object({
  field: z.literal('atsScore'),
  op: z.enum(['gte', 'lte']),
  value: z.number().int().min(0).max(100),
})
const CompanyConditionSchema = z.object({
  field: z.literal('company'),
  op: z.enum(['in', 'notIn']),
  value: z.array(z.string().trim().min(1)).min(1),
})
const WorkModeConditionSchema = z.object({
  field: z.literal('workMode'),
  op: z.literal('in'),
  value: z.array(WorkModeEnum).min(1),
})
const PostedWithinDaysConditionSchema = z.object({
  field: z.literal('postedWithinDays'),
  op: z.literal('lte'),
  value: z.number().int().min(1),
})
const TitleConditionSchema = z.object({
  field: z.literal('title'),
  op: z.enum(['contains', 'notContains']),
  value: z.string().trim().min(1),
})

export const RuleConditionSchema = z.discriminatedUnion('field', [
  AtsScoreConditionSchema,
  CompanyConditionSchema,
  WorkModeConditionSchema,
  PostedWithinDaysConditionSchema,
  TitleConditionSchema,
])
export type RuleCondition = z.infer<typeof RuleConditionSchema>

export const RULE_ACTIONS = ['notify', 'draft_and_queue', 'ignore'] as const
export const RuleActionEnum = z.enum(RULE_ACTIONS)
export type RuleAction = z.infer<typeof RuleActionEnum>

export const JobSearchRuleSchema = z.object({
  // null = applies to every profile this user has (design spec §4).
  profileId: z.string().nullable().default(null),
  name: z.string().trim().min(1, 'Name is required').max(100),
  isActive: z.boolean().default(true),
  // Display/notification ordering only — NOT precedence (design spec §4).
  order: z.number().int().default(0),
  conditions: z.array(RuleConditionSchema).min(1, 'At least one condition is required'),
  action: RuleActionEnum,
})

export const CreateJobSearchRuleSchema = JobSearchRuleSchema
export type CreateJobSearchRuleInput = z.infer<typeof CreateJobSearchRuleSchema>

// NOT derived via JobSearchRuleSchema.partial() — same reasoning as
// PatchJobSearchProfileSchema above: this repo's Zod version re-applies
// .default(...) for absent keys even through .partial(), which would
// silently backfill/wipe fields on every PATCH. Hand-written, all-optional,
// zero .default(...) calls.
export const PatchJobSearchRuleSchema = z.object({
  profileId: z.string().nullable().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
  conditions: z.array(RuleConditionSchema).min(1, 'At least one condition is required').optional(),
  action: RuleActionEnum.optional(),
})
export type PatchJobSearchRuleInput = z.infer<typeof PatchJobSearchRuleSchema>
