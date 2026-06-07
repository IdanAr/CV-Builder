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
}

function flattenAllText(data: ResumeData): string {
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
  }
  for (const edu of data.education ?? []) {
    if (edu.institution) parts.push(edu.institution)
    if (edu.area) parts.push(edu.area)
    if (edu.studyType) parts.push(edu.studyType)
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
  const recentJob = (data.work ?? [])[0]
  if (recentJob) {
    if (recentJob.position) parts.push(recentJob.position)
    if (recentJob.name) parts.push(recentJob.name)
    parts.push(...(recentJob.highlights ?? []))
  }
  return parts.join(' ')
}

function scoreFormat(data: ResumeData): number {
  let score = 0
  const b = data.basics ?? {}
  if (b.name) score += 5
  if (b.email) score += 5
  if (b.summary) score += 5
  if ((data.work ?? []).length > 0) score += 5
  if ((data.work ?? []).some(j => (j.highlights ?? []).length > 0)) score += 5
  return score // max 25
}

const METRIC_PATTERN = /\d+%|\$\d+|\d+[xX]|\d{2,}|\d+\s*(people|team|users|customers|members|reports|clients|projects)/i

function scoreMetrics(data: ResumeData): number {
  const highlights = [
    ...(data.work ?? []).flatMap(j => j.highlights ?? []),
    ...(data.volunteer ?? []).flatMap(v => v.highlights ?? []),
    ...(data.projects ?? []).flatMap(p => p.highlights ?? []),
  ]
  if (highlights.length === 0) return 0
  const withMetrics = highlights.filter(h => METRIC_PATTERN.test(h))
  return Math.min(15, Math.round((withMetrics.length / highlights.length) * 30))
}

export function scoreResume(data: ResumeData, jobDescription: string): AtsScoreResult {
  const formatScore = scoreFormat(data)
  const metricsScore = scoreMetrics(data)
  const jdKeywords = extractKeywords(jobDescription)

  if (jdKeywords.length === 0) {
    return {
      total: Math.min(100, formatScore + metricsScore),
      breakdown: { format: formatScore, keywordDensity: 0, keywordPlacement: 0, metrics: metricsScore },
      matchedKeywords: [],
      missingKeywords: [],
    }
  }

  const allText = flattenAllText(data)
  const highValueText = flattenHighValueText(data)

  const { matched, missing } = keywordOverlap(allText, jdKeywords)
  const keywordDensityScore = Math.min(35, Math.round((matched.length / jdKeywords.length) * 35))

  const { matched: hvMatched } = keywordOverlap(highValueText, jdKeywords)
  const keywordPlacementScore = Math.min(25, Math.round((hvMatched.length / jdKeywords.length) * 25))

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
  }
}
