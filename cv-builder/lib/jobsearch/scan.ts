// Scan orchestration for a single JobSearchProfile (see design spec §6).
// Run synchronously today (Phase 2, no queue yet); Phase 5 wraps this same
// function in a QStash-triggered worker route without changing it.
import dbConnect from '@/lib/db'
import { searchFreehireJobs } from './sources/freehire'
import { getJobSearchProfile } from '@/lib/api/jobsearch-profiles'
import { findExistingSourceIds, createScrapedJobs } from '@/lib/api/scraped-jobs'
import { scoreResume } from '@/lib/ats/scorer'
import { matchesKeyword } from '@/lib/ats/keywords'
import Resume from '@/models/Resume'
import type { CreateScrapedJobInput } from '@/lib/schemas/jobsearch.zod'
import type { JobPosting } from './sources/types'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface ScanResult {
  fetched: number
  created: number
  skippedExisting: number
  degraded: boolean
  errorMessage?: string
}

interface ScannedProfile {
  roles: string[]
  workModes: string[]
  locations: { country?: string; city?: string }[]
  seniority: string[]
  categories: string[]
  industries: string[]
  recencyDays: number
  resumeId?: string
}

async function resolveResumeData(userId: string, resumeId?: string): Promise<ResumeData | null> {
  await dbConnect()
  if (resumeId) {
    const resume = (await Resume.findOne({ _id: resumeId, userId }).lean()) as { data: ResumeData } | null
    if (resume) return resume.data
  }
  const fallback = (await Resume.findOne({ userId }).sort({ updatedAt: -1 }).lean()) as {
    data: ResumeData
  } | null
  return fallback?.data ?? null
}

function passesIndustryFilter(posting: JobPosting, industries: string[]): boolean {
  if (industries.length === 0) return true
  const haystack = `${posting.title} ${posting.company} ${posting.description}`
  return industries.some((tag) => matchesKeyword(haystack, tag))
}

export async function runScanForProfile(userId: string, profileId: string): Promise<ScanResult> {
  const profile = (await getJobSearchProfile(userId, profileId)) as ScannedProfile | null
  if (!profile) {
    return { fetched: 0, created: 0, skippedExisting: 0, degraded: true, errorMessage: 'Profile not found' }
  }

  const searchResult = await searchFreehireJobs({
    query: profile.roles.join(' ') || undefined,
    country: profile.locations.map((l) => l.country).filter((c): c is string => !!c),
    city: profile.locations.map((l) => l.city).filter((c): c is string => !!c),
    seniority: profile.seniority,
    category: profile.categories,
    // freehire's --remote facet takes exactly one value; a profile with 0
    // or 2+ selected work modes omits the facet entirely rather than
    // arbitrarily picking one and silently narrowing the search.
    remote: profile.workModes.length === 1 ? (profile.workModes[0] as 'remote' | 'hybrid' | 'onsite') : undefined,
    jobage: profile.recencyDays,
    limit: 25,
  })

  if (searchResult.degraded) {
    return {
      fetched: 0,
      created: 0,
      skippedExisting: 0,
      degraded: true,
      errorMessage: searchResult.errorMessage,
    }
  }

  const filtered = searchResult.postings.filter((p) => passesIndustryFilter(p, profile.industries))
  const existingIds = await findExistingSourceIds(
    userId,
    profileId,
    'freehire',
    filtered.map((p) => p.sourceId)
  )
  const newPostings = filtered.filter((p) => !existingIds.has(p.sourceId))

  const resumeData = newPostings.length > 0 ? await resolveResumeData(userId, profile.resumeId) : null

  const toCreate: CreateScrapedJobInput[] = newPostings.map((posting) => ({
    // createScrapedJobs also receives profileId as its own argument and
    // spreads it onto each job (see lib/api/scraped-jobs.ts) — it's set here
    // too only because CreateScrapedJobInput's Zod schema requires it.
    profileId,
    source: 'freehire',
    sourceId: posting.sourceId,
    title: posting.title,
    company: posting.company,
    location: posting.location,
    url: posting.url,
    description: posting.description,
    postedAt: posting.postedAt,
    workMode: posting.workMode,
    atsScore: resumeData ? scoreResume(resumeData, posting.description).total : undefined,
    matchedRules: [],
    resolvedActions: [],
    status: 'new',
  }))

  if (toCreate.length > 0) {
    await createScrapedJobs(userId, profileId, toCreate)
  }

  return {
    fetched: searchResult.postings.length,
    created: toCreate.length,
    skippedExisting: existingIds.size,
    degraded: false,
  }
}
