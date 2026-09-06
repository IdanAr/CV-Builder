// Scan orchestration for a single JobSearchProfile (see design spec §6).
// Run synchronously today (Phase 2, no queue yet); Phase 5 wraps this same
// function in a QStash-triggered worker route without changing it.
import dbConnect from '@/lib/db'
import { searchFreehireJobs } from './sources/freehire'
import { searchComeetJobs, type ComeetCompanyPref } from './sources/comeet'
import { getJobSearchProfile } from '@/lib/api/jobsearch-profiles'
import {
  findExistingSourceIds,
  createScrapedJobs,
  countDraftedInWindow,
  listDraftQueueBacklog,
  markScrapedJobDrafted,
  listNewScrapedJobs,
  deleteScrapedJobsByIds,
} from '@/lib/api/scraped-jobs'
import { listRulesForProfile } from '@/lib/api/jobsearch-rules'
import { scoreResume } from '@/lib/ats/scorer'
import { matchesKeyword } from '@/lib/ats/keywords'
import { evaluateRules } from './rules'
import { runApplyPipeline, PER_PROFILE_DAILY_DRAFT_CAP, PER_USER_DAILY_DRAFT_CAP } from './apply'
import Resume from '@/models/Resume'
import type { CreateScrapedJobInput, ScrapeSource } from '@/lib/schemas/jobsearch.zod'
import type { JobPosting, SourceSearchResult } from './sources/types'
import { ResumeMetaSchema, type ResumeData, type ResumeMeta } from '@/lib/schemas/resume.zod'

export interface ScanResult {
  fetched: number
  created: number
  skippedExisting: number
  drafted: number
  pruned: number
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
  // Optional: a profile document saved before this field existed comes back from
  // getJobSearchProfile's .lean() read without it at all (Mongoose doesn't backfill
  // schema defaults onto pre-existing documents).
  comeetCompanies?: ComeetCompanyPref[]
  recencyDays: number
  minAtsScore: number
  resumeId?: string
}

interface DraftQueueBacklogItem {
  _id: unknown
  title: string
  company: string
  description: string
}

interface ResolvedResume {
  id: string
  data: ResumeData
  meta: ResumeMeta
}

// Returns the source resume's id and design meta alongside its data so
// tailored drafts can record lineage (Resume.parentResumeId) back to the
// resume they were built from — the same field duplicateResume() sets for
// manual copies — and so runApplyPipeline can carry over the source's
// template/colors/spacing/sectionOrder instead of falling back to schema
// defaults (which drops any custom sections, since they only render when
// their `custom:<id>` key is present in sectionOrder).
async function resolveResumeData(userId: string, resumeId?: string): Promise<ResolvedResume | null> {
  await dbConnect()
  if (resumeId) {
    const resume = (await Resume.findOne({ _id: resumeId, userId }).lean()) as {
      _id: unknown
      data: ResumeData
      meta?: ResumeMeta
    } | null
    if (resume) return { id: String(resume._id), data: resume.data, meta: ResumeMetaSchema.parse(resume.meta ?? {}) }
  }
  const fallback = (await Resume.findOne({ userId }).sort({ updatedAt: -1 }).lean()) as {
    _id: unknown
    data: ResumeData
    meta?: ResumeMeta
  } | null
  return fallback
    ? { id: String(fallback._id), data: fallback.data, meta: ResumeMetaSchema.parse(fallback.meta ?? {}) }
    : null
}

// Narrower than JobPosting so this is reusable against both a freshly
// fetched posting and a stored ScrapedJob summary (see pruneStaleScrapedJobs
// below) — both carry title/company/description, nothing else is needed.
function passesIndustryFilter(posting: { title: string; company: string; description: string }, industries: string[]): boolean {
  if (industries.length === 0) return true
  const haystack = `${posting.title} ${posting.company} ${posting.description}`
  return industries.some((tag) => matchesKeyword(haystack, tag))
}

// freehire's `q` param does a loose OR-across-words match even within a
// single role query (verified directly against the live API: q="AI
// Developer" returns "Senior Backend Developer" and "Security Analyst"
// postings — neither word appears together, and quoting the phrase makes no
// difference), so freehire's own result set can't be trusted as "relevant to
// this role." This requires every significant word of the queried role to
// appear in the posting's title (word-boundary, case-insensitive) before it
// counts as a match for that role.
function passesRoleTitleFilter(title: string, role: string): boolean {
  const words = role.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return true
  return words.every((word) => matchesKeyword(title, word))
}

/** Max distinct role titles queried per scan — bounds how many outbound freehire calls one profile can trigger. */
export const MAX_ROLE_QUERIES = 5

/**
 * Max watched Comeet companies polled per scan — bounds how many outbound Comeet
 * calls one profile can trigger. Re-enforced here (rather than trusted solely from
 * the schema's own .max()) the same way MAX_ROLE_QUERIES re-bounds profile.roles.
 */
export const MAX_COMEET_COMPANIES = 10

interface RoleQueryParams {
  region: string[]
  country: string[]
  city: string[]
  seniority: string[]
  category: string[]
  remote?: 'remote' | 'hybrid' | 'onsite'
  jobage: number
}

// freehire's `q` param does a loose keyword match across the whole query
// string — joining multiple distinct role titles into one space-separated
// string made it match almost any posting containing any single word from
// any role (e.g. "Product Analyst Data Analyst" matched "Senior Backend
// Engineer" postings with none of those words in the title, because common
// words like "product" show up somewhere in nearly every description),
// rather than "any of these role titles." Querying once per role and
// merging keeps each query focused enough that `q` actually narrows
// results — verified directly against the live API: a single-role query
// like "Data Analyst" returns only Data Analyst postings, while the joined
// multi-role string returned an unrelated grab-bag.
async function fetchPostingsForRoles(
  roles: string[],
  params: RoleQueryParams
): Promise<{ postings: JobPosting[]; degraded: boolean; errorMessage?: string }> {
  const queries = roles.length > 0 ? roles.slice(0, MAX_ROLE_QUERIES) : [undefined]
  const results = await Promise.all(
    queries.map((role) => searchFreehireJobs({ ...params, query: role, limit: 25 }))
  )

  const succeeded = results
    .map((result, i) => ({ result, role: queries[i] }))
    .filter((entry): entry is { result: SourceSearchResult; role: string | undefined } => !entry.result.degraded)
  if (succeeded.length === 0) {
    return { postings: [], degraded: true, errorMessage: results[0]?.errorMessage }
  }

  // A posting can legitimately match more than one role query (e.g. a
  // "Data Analyst" posting also containing "Analyst" in its title) — dedupe
  // by sourceId across the merged results before this ever reaches the
  // existing dedup-against-stored-jobs step below. A posting rejected by one
  // role's title filter still gets a fresh chance under a different role's
  // query, so the filter check must run before it's marked "seen."
  const seen = new Set<string>()
  const postings: JobPosting[] = []
  for (const { result, role } of succeeded) {
    for (const posting of result.postings) {
      if (seen.has(posting.sourceId)) continue
      if (role !== undefined && !passesRoleTitleFilter(posting.title, role)) continue
      seen.add(posting.sourceId)
      postings.push(posting)
    }
  }
  return { postings, degraded: false }
}

// Comeet has no keyword/role query of its own (see lib/jobsearch/sources/comeet.ts) —
// this just lists every position for each watched company and lets the caller apply
// the same passesRoleTitleFilter used for freehire afterward. Each company's fetch is
// independent: one dead/unauthorized company degrades only its own contribution,
// mirroring how fetchPostingsForRoles tolerates individual role-query failures above.
async function fetchComeetPostings(
  companies: ComeetCompanyPref[]
): Promise<{ postings: JobPosting[]; anySucceeded: boolean }> {
  // Zero configured companies correctly yields anySucceeded: false — there's no
  // company whose fetch actually succeeded, so this must not rescue an otherwise
  // total freehire failure into a false non-degraded result.
  const results = await Promise.all(
    companies.slice(0, MAX_COMEET_COMPANIES).map((company) => searchComeetJobs(company))
  )
  const postings: JobPosting[] = []
  let anySucceeded = false
  for (const result of results) {
    if (result.degraded) continue
    anySucceeded = true
    postings.push(...result.postings)
  }
  return { postings, anySucceeded }
}

// A profile-preference edit (tighter roles or a raised threshold) doesn't
// retroactively touch postings scraped under the old preferences — scanning
// is otherwise purely additive (dedup only ever skips re-fetching, never
// removes). This re-checks every still-'new' job against the profile's
// *current* roles/industries/threshold and deletes the ones that no longer
// qualify, so a scan after a preference change actually shrinks the list
// the way the wizard's filters imply it should. Jobs already dismissed,
// queued, needs_review'd, or submitted are never touched (see
// listNewScrapedJobs) — those reflect a decision the user or pipeline
// already made, not just an unreviewed scan result.
async function pruneStaleScrapedJobs(userId: string, profileId: string, profile: ScannedProfile): Promise<number> {
  const jobs = await listNewScrapedJobs(userId, profileId)
  const staleIds = jobs
    .filter((job) => {
      const roleOk = profile.roles.length === 0 || profile.roles.some((role) => passesRoleTitleFilter(job.title, role))
      const industryOk = passesIndustryFilter(job, profile.industries)
      const scoreOk = job.atsScore === undefined || job.atsScore >= profile.minAtsScore
      return !(roleOk && industryOk && scoreOk)
    })
    .map((job) => String(job._id))
  return deleteScrapedJobsByIds(userId, staleIds)
}

export async function runScanForProfile(userId: string, profileId: string): Promise<ScanResult> {
  const profile = (await getJobSearchProfile(userId, profileId)) as ScannedProfile | null
  if (!profile) {
    return { fetched: 0, created: 0, skippedExisting: 0, drafted: 0, pruned: 0, degraded: true, errorMessage: 'Profile not found' }
  }

  // Runs before the backlog drain below so a job that no longer qualifies
  // under the current preferences is never drafted from that backlog either
  // (listDraftQueueBacklog only ever selects status:'new' items).
  const pruned = await pruneStaleScrapedJobs(userId, profileId, profile)

  // Memoized so the backlog drain below and the new-postings loop further
  // down share at most one DB read for the linked resume, even though each
  // decides independently whether it needs it at all.
  let resolvedResumeData: ResolvedResume | null | undefined
  const getResumeData = async (): Promise<ResolvedResume | null> => {
    if (resolvedResumeData === undefined) {
      resolvedResumeData = await resolveResumeData(userId, profile.resumeId)
    }
    return resolvedResumeData
  }

  // Cap bookkeeping runs before the freehire fetch so a degraded/unreachable
  // source (handled below) never blocks draining postings already sitting
  // in the draft_and_queue backlog from a previous cap-limited run (design
  // spec §7: "drafting for them waits for the next scan run").
  let profileDraftsRemaining = PER_PROFILE_DAILY_DRAFT_CAP - (await countDraftedInWindow(userId, profileId))
  let userDraftsRemaining = PER_USER_DAILY_DRAFT_CAP - (await countDraftedInWindow(userId))
  let drafted = 0

  if (profileDraftsRemaining > 0 && userDraftsRemaining > 0) {
    const backlog = (await listDraftQueueBacklog(
      userId,
      profileId,
      Math.min(profileDraftsRemaining, userDraftsRemaining)
    )) as unknown as DraftQueueBacklogItem[]
    if (backlog.length > 0) {
      const resumeData = await getResumeData()
      if (resumeData) {
        for (const item of backlog) {
          if (profileDraftsRemaining <= 0 || userDraftsRemaining <= 0) break
          try {
            const missingKeywords = scoreResume(resumeData.data, item.description).missingKeywords
            const applyResult = await runApplyPipeline(
              userId,
              resumeData.data,
              { title: item.title, company: item.company, description: item.description },
              missingKeywords,
              profile.minAtsScore,
              resumeData.id,
              resumeData.meta
            )
            await markScrapedJobDrafted(userId, String(item._id), {
              draftResumeId: applyResult.draftResumeId,
              postTailorScore: applyResult.postTailorScore,
              pendingApprovals: applyResult.pendingApprovals,
              tailoredKeywords: applyResult.tailoredKeywords,
              status: applyResult.status,
            })
            profileDraftsRemaining--
            userDraftsRemaining--
            drafted++
          } catch {
            // Left as backlog (draftedAt still unset) — retried on the next scan.
          }
        }
      }
    }
  }

  const [freehireResult, comeetResult] = await Promise.all([
    fetchPostingsForRoles(profile.roles, {
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
    }),
    fetchComeetPostings(profile.comeetCompanies ?? []),
  ])

  // Overall degraded only when BOTH sources produced nothing — one dead source
  // (freehire down, or every watched Comeet company unauthorized/unreachable)
  // shouldn't blank out a scan that's still getting data from the other.
  if (freehireResult.degraded && !comeetResult.anySucceeded) {
    return {
      fetched: 0,
      created: 0,
      skippedExisting: 0,
      drafted,
      pruned,
      degraded: true,
      errorMessage: freehireResult.errorMessage,
    }
  }

  // Comeet has no role query of its own (see fetchComeetPostings) — apply the same
  // title filter freehire's per-role queries already enforce per posting (empty
  // roles = no filter, matching freehire's own fallback for an unspecified query).
  const comeetPostings =
    profile.roles.length === 0
      ? comeetResult.postings
      : comeetResult.postings.filter((p) => profile.roles.some((role) => passesRoleTitleFilter(p.title, role)))

  const mergedPostings = [...(freehireResult.degraded ? [] : freehireResult.postings), ...comeetPostings]

  // Everything from here on touches untrusted freehire data and the
  // database — wrapped so this function truly never throws (Phase 5 wraps
  // it in a QStash worker, where an uncaught throw means a retry storm
  // instead of one clean degraded result).
  try {
    const filtered = mergedPostings.filter((p) => passesIndustryFilter(p, profile.industries))

    // findExistingSourceIds is scoped to a single source per call — group by source
    // so a sourceId string that happens to collide across sources (e.g. freehire's
    // '123' and comeet's '123' being different jobs) is never treated as one job.
    const bySource = new Map<ScrapeSource, JobPosting[]>()
    for (const p of filtered) {
      const list = bySource.get(p.source) ?? []
      list.push(p)
      bySource.set(p.source, list)
    }
    const existingKeys = new Set<string>()
    let existingCount = 0
    for (const [source, postingsForSource] of bySource) {
      const ids = await findExistingSourceIds(userId, profileId, source, postingsForSource.map((p) => p.sourceId))
      existingCount += ids.size
      for (const id of ids) existingKeys.add(`${source}:${id}`)
    }
    const notAlreadyStored = filtered.filter((p) => !existingKeys.has(`${p.source}:${p.sourceId}`))

    // existingKeys only guards against sourceIds already persisted from a previous
    // scan — a source's own response can itself contain a repeated sourceId within
    // one page, so dedupe within this batch too (keep the first occurrence) before
    // it ever reaches insertMany.
    const seenKeys = new Set<string>()
    const newPostings = notAlreadyStored.filter((p) => {
      const key = `${p.source}:${p.sourceId}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    const resumeData = newPostings.length > 0 ? await getResumeData() : null
    const rules = newPostings.length > 0 ? await listRulesForProfile(userId, profileId) : []

    // A for-loop rather than .map(), because a posting matched by an
    // 'ignore' rule must be suppressed outright (design spec §4 step 2) —
    // never turned into a ScrapedJob at all, not even with an 'ignore'
    // status. It will simply be re-fetched and re-evaluated on the next
    // scan, which is the spec's intended behavior for suppressed postings.
    const toCreate: CreateScrapedJobInput[] = []
    for (const posting of newPostings) {
      const scoreResult = resumeData ? scoreResume(resumeData.data, posting.description) : null
      const atsScore = scoreResult?.total
      // Postings scored below the profile's own fit threshold never become a
      // ScrapedJob at all (per product decision: the wizard's "threshold"
      // step should behave like the roles/location filters, not merely
      // gate auto-draft readiness). A posting with no resume to score
      // against (atsScore undefined) is never filtered — there's nothing to
      // compare against the threshold.
      if (atsScore !== undefined && atsScore < profile.minAtsScore) continue
      const evaluation = evaluateRules(
        { title: posting.title, company: posting.company, workMode: posting.workMode, postedAt: posting.postedAt, atsScore },
        rules
      )
      if (evaluation.suppressed) continue

      // Semi-auto apply (design spec §7): only for draft_and_queue matches,
      // only when there's a resume to tailor from, and only while today's
      // per-profile and per-user caps still have room (§7's "Cost/spend
      // safety valves"). A posting that misses the cap or whose pipeline
      // throws simply stays at status 'new' with no draftedAt — the next
      // scan's backlog drain (above) picks it back up.
      let draftFields: Partial<CreateScrapedJobInput> = {}
      if (
        evaluation.resolvedActions.includes('draft_and_queue') &&
        resumeData &&
        scoreResult &&
        profileDraftsRemaining > 0 &&
        userDraftsRemaining > 0
      ) {
        try {
          const applyResult = await runApplyPipeline(
            userId,
            resumeData.data,
            { title: posting.title, company: posting.company, description: posting.description },
            scoreResult.missingKeywords,
            profile.minAtsScore,
            resumeData.id,
            resumeData.meta
          )
          draftFields = {
            draftResumeId: applyResult.draftResumeId,
            postTailorScore: applyResult.postTailorScore,
            pendingApprovals: applyResult.pendingApprovals,
            tailoredKeywords: applyResult.tailoredKeywords,
            status: applyResult.status,
            draftedAt: new Date(),
          }
          profileDraftsRemaining--
          userDraftsRemaining--
          drafted++
        } catch {
          // Left at the default 'new' status below — picked up as backlog next scan.
        }
      }

      toCreate.push({
        // createScrapedJobs also receives profileId as its own argument and
        // spreads it onto each job (see lib/api/scraped-jobs.ts) — it's set here
        // too only because CreateScrapedJobInput's Zod schema requires it.
        profileId,
        source: posting.source,
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
        // pendingApprovals/tailoredKeywords carry Zod .default([]) — the
        // inferred CreateScrapedJobInput type makes them required fields,
        // not optional, so they must be set explicitly here even when
        // draftFields won't overwrite them (Task 1's review caught this
        // exact class of bug in the pre-Phase-4 scan.ts).
        pendingApprovals: [],
        tailoredKeywords: [],
        status: 'new',
        ...draftFields,
      })
    }

    if (toCreate.length > 0) {
      await createScrapedJobs(userId, profileId, toCreate)
    }

    return {
      fetched: mergedPostings.length,
      created: toCreate.length,
      skippedExisting: existingCount,
      drafted,
      pruned,
      degraded: false,
    }
  } catch (err) {
    return {
      fetched: 0,
      created: 0,
      skippedExisting: 0,
      drafted,
      pruned,
      degraded: true,
      errorMessage: err instanceof Error ? err.message : 'Scan failed unexpectedly',
    }
  }
}
