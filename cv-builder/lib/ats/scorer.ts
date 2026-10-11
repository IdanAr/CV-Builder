import type { ResumeData } from '@/lib/schemas/resume.zod'
import { extractKeywords, keywordOverlap } from './keywords'
import { resolveWorkRoles, resolveEducationRoles } from '@/lib/roles'
import type { KeywordPriority } from '@/lib/ai/jd-extraction-pipeline'

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
  /** The subset of `matchedKeywords` found only through a synonym, not as literal text. Scored at SEMANTIC_MATCH_WEIGHT. */
  semanticMatchedKeywords: string[]
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
    for (const role of resolveWorkRoles(job)) {
      if (role.position) parts.push(role.position)
      if (role.summary) parts.push(role.summary)
      parts.push(...(role.highlights ?? []))
    }
  }
  for (const edu of data.education ?? []) {
    if (edu.institution) parts.push(edu.institution)
    for (const role of resolveEducationRoles(edu)) {
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
    if (job.name) parts.push(job.name)
    for (const role of resolveWorkRoles(job)) {
      if (role.position) parts.push(role.position)
      parts.push(...(role.highlights ?? []))
    }
  }
  // Degree fields and certifications have one natural home, so a job's
  // "BSc in Statistics" or "CPA" requirement is well placed there.
  for (const edu of data.education ?? []) {
    for (const role of resolveEducationRoles(edu)) {
      if (role.area) parts.push(role.area)
      if (role.studyType) parts.push(role.studyType)
    }
  }
  for (const c of data.certificates ?? []) {
    if (c.name) parts.push(c.name)
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

  // 3. Work entries structurally complete: name + at least one role with position + startDate
  const work = data.work ?? []
  if (work.length > 0) {
    const complete = work.filter(j => j.name && resolveWorkRoles(j).some(r => r.position && r.startDate))
    score += Math.round(5 * (complete.length / work.length))
  }

  // 4. Highlights are real bullets (10-400 chars), not placeholders or paragraph-dumps
  const highlights = [
    ...work.flatMap(j => resolveWorkRoles(j).flatMap(r => r.highlights ?? [])),
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
    ...(data.work ?? []).flatMap(j => resolveWorkRoles(j).flatMap(r => r.highlights ?? [])),
    ...(data.volunteer ?? []).flatMap(v => v.highlights ?? []),
    ...(data.projects ?? []).flatMap(p => p.highlights ?? []),
  ]
  if (highlights.length === 0) return 0
  const withMetrics = highlights.filter(h => METRIC_PATTERN.test(h))
  return Math.min(15, Math.round((withMetrics.length / highlights.length) * 30))
}

/** Share of a literal match's density and placement credit that a synonym-only match earns. */
export const SEMANTIC_MATCH_WEIGHT = 0.5

/** Weight of a nice-to-have keyword relative to a must-have (or unclear) one. */
export const NICE_TO_HAVE_WEIGHT = 0.5

export function scoreResume(
  data: ResumeData,
  jobDescription: string,
  excludedKeywords: string[] = [],
  semanticMatches: string[] = [],
  jdKeywordsOverride: string[] = [],
  /** Lowercased keyword -> priority, from AI extraction. Absent keywords weigh as must-haves. */
  keywordPriorities: Record<string, KeywordPriority> = {}
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
      semanticMatchedKeywords: [],
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
  // matched, but earn only SEMANTIC_MATCH_WEIGHT of a literal match below:
  // recruiter search in most ATS products is literal, so the JD's exact term
  // is still worth adding. Only literally-missing keywords can be promoted,
  // so a term the user has since written out counts in full.
  const semanticallyPromoted = literalMissing.filter(k => semantic.has(k))
  const allMatched = [...literalMatched, ...semanticallyPromoted]
  const allMissing = literalMissing.filter(k => !semantic.has(k))

  const matched = allMatched.filter(k => !excluded.has(k))
  const excludedMatchedKeywords = allMatched.filter(k => excluded.has(k))
  const missing = allMissing.filter(k => !excluded.has(k))
  const excludedMissingKeywords = allMissing.filter(k => excluded.has(k))

  // Scoring only considers the active (non-excluded) subset, both as the
  // matched count and as the denominator, so an excluded word neither helps
  // nor drags down the score. Each keyword is weighted by how strongly the
  // job asks for it, so a missing nice-to-have costs half a missing must-have.
  const activeKeywords = jdKeywords.filter(k => !excluded.has(k))
  const semanticMatchedKeywords = semanticallyPromoted.filter(k => !excluded.has(k))
  const semanticSet = new Set(semanticMatchedKeywords)
  const literalSet = new Set(matched.filter(k => !semanticSet.has(k)))
  const weightOf = (k: string) => (keywordPriorities[k] === 'nice-to-have' ? NICE_TO_HAVE_WEIGHT : 1)
  const totalWeight = activeKeywords.reduce((sum, k) => sum + weightOf(k), 0)

  // Literal match earns full credit, a synonym-only match SEMANTIC_MATCH_WEIGHT.
  const creditOf = (k: string, literal: Set<string>) =>
    literal.has(k) ? 1 : semanticSet.has(k) ? SEMANTIC_MATCH_WEIGHT : 0
  const weightedShare = (literal: Set<string>) =>
    totalWeight > 0 ? activeKeywords.reduce((sum, k) => sum + weightOf(k) * creditOf(k, literal), 0) / totalWeight : 0

  const keywordDensityScore = Math.min(35, Math.round(weightedShare(literalSet) * 35))

  // Where a synonym sits in the CV is unknown, so it gets the same partial
  // credit for placement rather than counting as a high-value match.
  const { matched: hvMatchedLiteral } = keywordOverlap(highValueText, activeKeywords)
  const keywordPlacementScore = Math.min(25, Math.round(weightedShare(new Set(hvMatchedLiteral)) * 25))

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
    semanticMatchedKeywords,
    jdKeywords,
  }
}
