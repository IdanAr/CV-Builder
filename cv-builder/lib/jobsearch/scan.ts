// Scan orchestration for a single JobSearchProfile (see design spec §6).
// Run synchronously today (Phase 2, no queue yet); Phase 5 wraps this same
// function in a QStash-triggered worker route without changing it.
import dbConnect from '@/lib/db'
import { searchFreehireJobs } from './sources/freehire'
import { getJobSearchProfile } from '@/lib/api/jobsearch-profiles'
import { findExistingSourceIds, createScrapedJobs } from '@/lib/api/scraped-jobs'
import { listRulesForProfile } from '@/lib/api/jobsearch-rules'
import { scoreResume } from '@/lib/ats/scorer'
import { matchesKeyword } from '@/lib/ats/keywords'
import { evaluateRules } from './rules'
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
  locations: { country?: string; region?: string; city?: string }[]
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
    region: profile.locations.map((l) => l.region).filter((r): r is string => !!r),
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

  // Everything from here on touches untrusted freehire data and the
  // database — wrapped so this function truly never throws (Phase 5 wraps
  // it in a QStash worker, where an uncaught throw means a retry storm
  // instead of one clean degraded result).
  try {
    const filtered = searchResult.postings.filter((p) => passesIndustryFilter(p, profile.industries))
    const existingIds = await findExistingSourceIds(
      userId,
      profileId,
      'freehire',
      filtered.map((p) => p.sourceId)
    )
    const notAlreadyStored = filtered.filter((p) => !existingIds.has(p.sourceId))

    // findExistingSourceIds only guards against sourceIds already persisted
    // from a previous scan — freehire's own response can itself contain a
    // repeated sourceId within one page, so dedupe within this batch too
    // (keep the first occurrence) before it ever reaches insertMany.
    const seenSourceIds = new Set<string>()
    const newPostings = notAlreadyStored.filter((p) => {
      if (seenSourceIds.has(p.sourceId)) return false
      seenSourceIds.add(p.sourceId)
      return true
    })

    const resumeData = newPostings.length > 0 ? await resolveResumeData(userId, profile.resumeId) : null
    const rules = newPostings.length > 0 ? await listRulesForProfile(userId, profileId) : []

    // A for-loop rather than .map(), because a posting matched by an
    // 'ignore' rule must be suppressed outright (design spec §4 step 2) —
    // never turned into a ScrapedJob at all, not even with an 'ignore'
    // status. It will simply be re-fetched and re-evaluated on the next
    // scan, which is the spec's intended behavior for suppressed postings.
    const toCreate: CreateScrapedJobInput[] = []
    for (const posting of newPostings) {
      const atsScore = resumeData ? scoreResume(resumeData, posting.description).total : undefined
      const evaluation = evaluateRules(
        { title: posting.title, company: posting.company, workMode: posting.workMode, postedAt: posting.postedAt, atsScore },
        rules
      )
      if (evaluation.suppressed) continue

      toCreate.push({
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
        atsScore,
        matchedRules: evaluation.matchedRules,
        resolvedActions: evaluation.resolvedActions,
        status: 'new',
      })
    }

    if (toCreate.length > 0) {
      await createScrapedJobs(userId, profileId, toCreate)
    }

    return {
      fetched: searchResult.postings.length,
      created: toCreate.length,
      skippedExisting: existingIds.size,
      degraded: false,
    }
  } catch (err) {
    return {
      fetched: 0,
      created: 0,
      skippedExisting: 0,
      degraded: true,
      errorMessage: err instanceof Error ? err.message : 'Scan failed unexpectedly',
    }
  }
}
