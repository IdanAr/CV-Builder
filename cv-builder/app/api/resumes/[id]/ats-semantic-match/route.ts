import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { runSemanticKeywordAnalysis, SYNONYM_CHECK_VERSION, type SemanticMatch } from '@/lib/ai/keyword-analysis-pipeline'
import { aiCacheKey, readAiCache, writeAiCache } from '@/lib/api/ai-cache'
import { flattenAllText } from '@/lib/ats/scorer'
import { checkAiRateLimit, aiRateLimitedResponse } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { ResumeData } from '@/lib/schemas/resume.zod'

/**
 * POST { missingKeywords } -> { confirmedMatches, evidence }
 *
 * `evidence` maps each confirmed keyword to the words in the CV that show it.
 * Results are cached per CV text and keyword set, so re-checking an unchanged
 * CV gives the same answer and spends no AI budget.
 */
export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  const userId = req.auth.user.id

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(userId, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => ({}))
    const missingKeywords: string[] = Array.isArray(body.missingKeywords)
      ? body.missingKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 30)
      : []

    if (missingKeywords.length === 0) {
      return apiError('BAD_REQUEST', 'missingKeywords array is required', 400)
    }

    const data = (resume.data ?? {}) as ResumeData
    const resumeText = flattenAllText(data)
    const cacheKey = aiCacheKey(
      SYNONYM_CHECK_VERSION,
      resumeText,
      [...new Set(missingKeywords.map((k) => k.toLowerCase()))].sort().join('\n'),
    )

    let matches = await readAiCache<SemanticMatch[]>(userId, 'synonym-matches', cacheKey)
    if (!matches) {
      const rate = await checkAiRateLimit(userId)
      if (!rate.allowed) {
        return aiRateLimitedResponse(rate)
      }
      matches = await runSemanticKeywordAnalysis(resumeText, missingKeywords)
      // An empty answer is also what an unparseable reply turns into, so it
      // is not worth pinning for 30 days; it is simply asked again next time.
      if (matches.length > 0) await writeAiCache(userId, 'synonym-matches', cacheKey, matches)
    }

    // A cached entry was written for the same keyword set, possibly in other
    // casing; answer in the spelling this request used.
    const requested = new Map(missingKeywords.map((k) => [k.toLowerCase(), k]))
    const confirmed = matches
      .map((m) => ({ keyword: requested.get(m.keyword.toLowerCase()), evidence: m.evidence }))
      .filter((m): m is SemanticMatch => m.keyword !== undefined)

    return NextResponse.json({
      confirmedMatches: confirmed.map((m) => m.keyword),
      evidence: Object.fromEntries(confirmed.map((m) => [m.keyword, m.evidence])),
    })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/ats-semantic-match')
  }
})
