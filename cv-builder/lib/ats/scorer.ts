import type { ResumeData } from '@/lib/schemas/resume.zod'
import { extractKeywords, keywordOverlap } from './keywords'

export interface AtsScoreResult {
  total: number
  breakdown: {
    format: number          // max 25
    keywordDensity: number  // max 35
    keywordPlacement: number // max 25
    metrics: number         // max 15
  }
  matchedKeywords: string[]
  missingKeywords: string[]
  /** User-excluded JD keywords that are present in the resume — shown as muted chips, never scored. */
  excludedMatchedKeywords: string[]
  /** User-excluded JD keywords that are absent from the resume — shown as muted chips, never scored or sent to AI tailoring. */
  excludedMissingKeywords: string[]
  /** The JD keyword list actually used for this scoring pass (AI-extracted override, or the regex-extracted fallback) — callers cache and re-send this to avoid redundant AI extraction on re-scores of the same job description. */
  jdKeywords: string[]
}

export function flattenAllText(data: ResumeData): string {
  const parts: string[] = []
  const b = data.basics ?? {}
  if (b.name) parts.push(b.name)
  if (b.label) parts.push(b.label)
  if (b.summary) parts.push(b.summary)
  for (const job of data.work ?? []) {
    if (job.name) parts.push(job.name)
    if (job.position) parts.push(job.position)
    if (job.summary) parts.push(job.summary)
    parts.push(...(job.highlights ?? []))
    for (const role of job.roles ?? []) {
      if (role.position) parts.push(role.position)
      if (role.summary) parts.push(role.summary)
      parts.push(...(role.highlights ?? []))
    }
  }
  for (const edu of data.education ?? []) {
    if (edu.institution) parts.push(edu.institution)
    if (edu.area) parts.push(edu.area)
    if (edu.studyType) parts.push(edu.studyType)
    for (const role of edu.roles ?? []) {
      if (role.area) parts.push(role.area)
      if (role.studyType) parts.push(role.studyType)
    }
  }
  for (const s of data.skills ?? []) {
    if (s.name) parts.push(s.name)
    if (s.level) parts.push(s.level)
    parts.push(...(s.keywords ?? []))
  }
  for (const c of data.certificates ?? []) {
    if (c.name) parts.push(c.name)
  }
  for (const p of data.projects ?? []) {
    if (p.name) parts.push(p.name)
    if (p.description) parts.push(p.description)
    parts.push(...(p.highlights ?? []))
    parts.push(...(p.keywords ?? []))
  }
  for (const v of data.volunteer ?? []) {
    if (v.organization) parts.push(v.organization)
    if (v.position) parts.push(v.position)
    parts.push(...(v.highlights ?? []))
  }
  return parts.join(' ')
}

function flattenHighValueText(data: ResumeData): string {
  const parts: string[] = []
  const b = data.basics ?? {}
  if (b.label) parts.push(b.label)
  if (b.summary) parts.push(b.summary)
  for (const job of (data.work ?? []).slice(0, 2)) {
    if (job.position) parts.push(job.position)
    if (job.name) parts.push(job.name)
    parts.push(...(job.highlights ?? []))
    for (const role of job.roles ?? []) {
      if (role.position) parts.push(role.position)
      parts.push(...(role.highlights ?? []))
    }
  }
  return parts.join(' ')
}

function scoreFormat(data: ResumeData): number {
  let score = 0
  const b = data.basics ?? {}

  // 1. Core identity: both name and email present
  if (b.name && b.email) score += 5

  // 2. Meaningful summary: at least 40 characters after trimming
  if (b.summary && b.summary.trim().length >= 40) score += 5

  // 3. Work entries structurally complete: name + position + startDate
  const work = data.work ?? []
  if (work.length > 0) {
    const complete = work.filter(j => j.name && j.position && j.startDate)
    score += Math.round(5 * (complete.length / work.length))
  }

  // 4. Highlights are real bullets (10-400 chars), not placeholders or paragraph-dumps
  const highlights = [
    ...work.flatMap(j => [...(j.highlights ?? []), ...(j.roles ?? []).flatMap(r => r.highlights ?? [])]),
    ...(data.volunteer ?? []).flatMap(v => v.highlights ?? []),
    ...(data.projects ?? []).flatMap(p => p.highlights ?? []),
  ]
  if (highlights.length > 0) {
    const wellFormed = highlights.filter(h => {
      const len = h.trim().length
      return len >= 10 && len <= 400
    })
    score += Math.round(5 * (wellFormed.length / highlights.length))
  }

  // 5. Skills are structured: at least one non-empty keyword per skill
  const skills = data.skills ?? []
  if (skills.length > 0) {
    const structured = skills.filter(s => (s.keywords ?? []).some(k => k.trim().length > 0))
    score += Math.round(5 * (structured.length / skills.length))
  }

  return score // each check maxes at 5, so total is capped at 25 by construction
}

const METRIC_PATTERN = /\d+%|\$\d+|\d+[xX]|\d{2,}|\d+\s*(people|team|users|customers|members|reports|clients|projects)/i

function scoreMetrics(data: ResumeData): number {
  const highlights = [
    ...(data.work ?? []).flatMap(j => [...(j.highlights ?? []), ...(j.roles ?? []).flatMap(r => r.highlights ?? [])]),
    ...(data.volunteer ?? []).flatMap(v => v.highlights ?? []),
    ...(data.projects ?? []).flatMap(p => p.highlights ?? []),
  ]
  if (highlights.length === 0) return 0
  const withMetrics = highlights.filter(h => METRIC_PATTERN.test(h))
  return Math.min(15, Math.round((withMetrics.length / highlights.length) * 30))
}

export function scoreResume(
  data: ResumeData,
  jobDescription: string,
  excludedKeywords: string[] = [],
  semanticMatches: string[] = [],
  jdKeywordsOverride: string[] = []
): AtsScoreResult {
  const formatScore = scoreFormat(data)
  const metricsScore = scoreMetrics(data)
  // An AI-extracted keyword list (see lib/ai/jd-extraction-pipeline.ts) takes
  // priority when supplied — it recognizes product/tool names and multi-word
  // phrases the regex extractor's fixed dictionary and single-token
  // tokenizer can't. Falls back to the regex extractor when no override is
  // given (e.g. AI extraction was rate-limited or unavailable).
  const jdKeywords = jdKeywordsOverride.length > 0
    ? jdKeywordsOverride.map(k => k.toLowerCase())
    : extractKeywords(jobDescription)

  if (jdKeywords.length === 0) {
    return {
      total: Math.min(100, formatScore + metricsScore),
      breakdown: { format: formatScore, keywordDensity: 0, keywordPlacement: 0, metrics: metricsScore },
      matchedKeywords: [],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: [],
    }
  }

  const excluded = new Set(excludedKeywords.map(k => k.toLowerCase()))
  const semantic = new Set(semanticMatches.map(k => k.toLowerCase()))
  const allText = flattenAllText(data)
  const highValueText = flattenHighValueText(data)

  // Every JD candidate keyword is matched/missing against the full set, so
  // excluded ones stay visible to the UI (as muted chips) instead of vanishing.
  const { matched: literalMatched, missing: literalMissing } = keywordOverlap(allText, jdKeywords)

  // Keywords Claude confirmed as covered by a synonym/abbreviation (see
  // lib/ai/keyword-analysis-pipeline.ts) are promoted from missing to
  // matched, counting the same as a literal match everywhere below.
  const semanticallyPromoted = literalMissing.filter(k => semantic.has(k))
  const allMatched = [...literalMatched, ...semanticallyPromoted]
  const allMissing = literalMissing.filter(k => !semantic.has(k))

  const matched = allMatched.filter(k => !excluded.has(k))
  const excludedMatchedKeywords = allMatched.filter(k => excluded.has(k))
  const missing = allMissing.filter(k => !excluded.has(k))
  const excludedMissingKeywords = allMissing.filter(k => excluded.has(k))

  // Scoring only considers the active (non-excluded) subset, both as the
  // matched count and as the denominator, so an excluded word neither helps
  // nor drags down the score.
  const activeKeywords = jdKeywords.filter(k => !excluded.has(k))
  const keywordDensityScore = activeKeywords.length > 0
    ? Math.min(35, Math.round((matched.length / activeKeywords.length) * 35))
    : 0

  const { matched: hvMatchedLiteral } = keywordOverlap(highValueText, activeKeywords)
  const hvMatched = new Set([
    ...hvMatchedLiteral,
    ...semanticallyPromoted.filter(k => !excluded.has(k)),
  ])
  const keywordPlacementScore = activeKeywords.length > 0
    ? Math.min(25, Math.round((hvMatched.size / activeKeywords.length) * 25))
    : 0

  const total = Math.min(100, formatScore + keywordDensityScore + keywordPlacementScore + metricsScore)

  return {
    total,
    breakdown: {
      format: formatScore,
      keywordDensity: keywordDensityScore,
      keywordPlacement: keywordPlacementScore,
      metrics: metricsScore,
    },
    matchedKeywords: matched,
    missingKeywords: missing,
    excludedMatchedKeywords,
    excludedMissingKeywords,
    jdKeywords,
  }
}
