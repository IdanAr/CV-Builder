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
