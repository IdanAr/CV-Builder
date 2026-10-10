import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getResume } from '@/lib/api/resumes'
import { scoreResume } from '@/lib/ats/scorer'
import { extractJdRequirements, normalizePriority, MAX_JD_LENGTH, type KeywordPriority } from '@/lib/ai/jd-extraction-pipeline'
import { checkRateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit'
import { apiError, handleRouteError } from '@/lib/api/route-errors'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export const POST = auth(async (req, ctx) => {
  if (!req.auth?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>)
    const resume = await getResume(req.auth.user.id, id)
    if (!resume) {
      return apiError('NOT_FOUND', 'Not found', 404)
    }

    const body = await req.json().catch(() => ({}))
    const jobDescription: string =
      typeof body.jobDescription === 'string' ? body.jobDescription.slice(0, MAX_JD_LENGTH) : ''
    const excludedKeywords: string[] = Array.isArray(body.excludedKeywords)
      ? body.excludedKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 200)
      : []
    const semanticMatches: string[] = Array.isArray(body.semanticMatches)
      ? body.semanticMatches.filter((k: unknown) => typeof k === 'string').slice(0, 30)
      : []
    const cachedJdKeywords: string[] = Array.isArray(body.jdKeywords)
      ? body.jdKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 60)
      : []
    // Never trust cached priority values from the client at face value —
    // normalizePriority coerces anything unrecognized (or tampered with) to
    // "ambiguous" rather than passing it through as an arbitrary string.
    const cachedKeywordPriorities: Record<string, KeywordPriority> = {}
    if (body.keywordPriorities && typeof body.keywordPriorities === 'object' && !Array.isArray(body.keywordPriorities)) {
      for (const [term, priority] of Object.entries(body.keywordPriorities).slice(0, 60)) {
        if (typeof term === 'string') cachedKeywordPriorities[term] = normalizePriority(priority)
      }
    }

    // The client sends back the jdKeywords/keywordPriorities a prior
    // /ats-score response returned whenever it's only re-scoring the same
    // job description (toggling an excluded keyword, applying a semantic
    // match) — reusing that avoids spending an AI call and rate-limit
    // budget on every re-score. Only a genuinely fresh Analyze (empty
    // cache) triggers extraction here. AI extraction failing or being
    // rate-limited never blocks scoring: scoreResume falls back to the
    // regex extractor whenever it receives an empty override, and
    // keywordPriorities is simply empty (the UI treats an absent entry as
    // "ambiguous", matching the pre-priority-coloring behavior).
    let jdKeywordsOverride = cachedJdKeywords
    let keywordPriorities: Record<string, KeywordPriority> = jdKeywordsOverride.length > 0 ? cachedKeywordPriorities : {}
    // Which extractor produced the keyword list on a fresh check, so the UI can
    // say so: the regex fallback is far noisier than the AI reading, and
    // silently showing its output made a broken AI setup look like bad advice.
    // 'cached' means the client supplied the list from an earlier response.
    let keywordSource: 'ai' | 'basic' | 'cached' = jdKeywordsOverride.length > 0 ? 'cached' : 'basic'
    let keywordFallbackReason: 'rate-limited' | 'ai-error' | 'ai-empty' | undefined
    if (jdKeywordsOverride.length === 0 && jobDescription.trim()) {
      const rate = checkRateLimit(`${req.auth.user.id}:ai`, AI_RATE_LIMIT)
      if (rate.allowed) {
        try {
          const requirements = await extractJdRequirements(jobDescription)
          jdKeywordsOverride = requirements.map(r => r.term)
          keywordPriorities = Object.fromEntries(requirements.map(r => [r.term, r.priority]))
          if (requirements.length > 0) keywordSource = 'ai'
          else keywordFallbackReason = 'ai-empty'
        } catch (err) {
          console.error('POST /api/resumes/[id]/ats-score: extractJdRequirements threw, falling back to regex extraction', err)
          jdKeywordsOverride = []
          keywordPriorities = {}
          keywordFallbackReason = 'ai-error'
        }
      } else {
        console.warn('POST /api/resumes/[id]/ats-score: AI rate limit reached, falling back to regex extraction')
        keywordFallbackReason = 'rate-limited'
      }
    }

    const data = (resume.data ?? {}) as ResumeData
    const result = scoreResume(data, jobDescription, excludedKeywords, semanticMatches, jdKeywordsOverride)

    return NextResponse.json({ ...result, keywordPriorities, keywordSource, keywordFallbackReason })
  } catch (err) {
    return handleRouteError(err, 'POST /api/resumes/[id]/ats-score')
  }
})
