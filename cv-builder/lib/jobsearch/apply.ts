// Semi-auto apply pipeline: tailor -> cover letter -> hallucination guard ->
// re-score -> persist draft (design spec §7). Invoked by scan.ts for every
// posting whose resolved actions include 'draft_and_queue', subject to the
// daily caps below (design spec §7's "Cost/spend safety valves").
import { runAtsFixPipeline } from '@/lib/ai/ats-fix-pipeline'
import { generateCoverLetter } from '@/lib/ai/cover-letter-pipeline'
import { applyAtsFixToResumeData } from '@/lib/ai/apply-ats-fix'
import { scoreResume } from '@/lib/ats/scorer'
import { createResume } from '@/lib/api/resumes'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import type { ScrapedJobStatus } from '@/lib/schemas/jobsearch.zod'

/** Max draft_and_queue runs per profile per rolling 24h window (design spec §7). */
export const PER_PROFILE_DAILY_DRAFT_CAP = 3
/** Max draft_and_queue runs per user, across all profiles, per rolling 24h window (design spec §7). */
export const PER_USER_DAILY_DRAFT_CAP = 10

export interface ApplyPostingInput {
  title: string
  company: string
  description: string
}

export interface ApplyResult {
  draftResumeId: string
  postTailorScore: number
  pendingApprovals: string[]
  tailoredKeywords: string[]
  status: ScrapedJobStatus
}

// Mongoose maxlength on Resume.title/targetCompany/targetRole (models/Resume.ts)
// is 200 — freehire postings are untrusted and carry no length guarantee, so
// truncate defensively rather than let createResume() throw a
// ValidationError that would abort the whole scan for one oversized posting.
function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

export async function runApplyPipeline(
  userId: string,
  resumeData: ResumeData,
  posting: ApplyPostingInput,
  missingKeywords: string[],
  minAtsScore: number,
  sourceResumeId: string
): Promise<ApplyResult> {
  const fixes = await runAtsFixPipeline(resumeData, missingKeywords)

  let tailoredData: ResumeData = resumeData
  const tailoredKeywords: string[] = []
  for (const fix of fixes) {
    tailoredData = { ...tailoredData, ...applyAtsFixToResumeData(tailoredData, fix) }
    tailoredKeywords.push(...fix.targetKeywords)
  }

  const coverLetter = await generateCoverLetter(tailoredData, posting.description, {
    companyName: posting.company,
    roleName: posting.title,
  })

  const pendingApprovals = [
    ...new Set([...fixes.flatMap((f) => f.pendingApprovals), ...coverLetter.pendingApprovals]),
  ]

  const postTailorScore = scoreResume(tailoredData, posting.description).total
  // Both gates from design spec §7 steps 3-4: unresolved flagged claims
  // block 'queued' regardless of score, and a score under the profile's
  // threshold blocks it regardless of claims — either alone is enough to
  // hold the item at 'needs_review' for the user to resolve.
  const status: ScrapedJobStatus =
    pendingApprovals.length > 0 || postTailorScore < minAtsScore ? 'needs_review' : 'queued'

  const resume = await createResume(userId, {
    title: truncate(`${posting.title} at ${posting.company} (tailored)`, 200),
    data: { ...tailoredData, coverLetter: coverLetter.content },
    // CreateResumeInput's inferred type requires `meta` (CreateResumeSchema
    // applies a default via .default(), which makes the output type
    // non-optional) even though callers going through the schema (e.g.
    // POST /api/resumes) get it filled in automatically. Since this call
    // builds the input object directly rather than parsing through the
    // schema, supply the same default design metadata explicitly — matching
    // the pattern in app/api/resumes/upload/extract/route.ts.
    meta: ResumeMetaSchema.parse({}),
    applicationStatus: 'draft',
    targetCompany: truncate(posting.company, 200),
    targetRole: truncate(posting.title, 200),
  }, { parentResumeId: sourceResumeId })

  return {
    draftResumeId: String(resume._id),
    postTailorScore,
    pendingApprovals,
    tailoredKeywords: [...new Set(tailoredKeywords)],
    status,
  }
}
