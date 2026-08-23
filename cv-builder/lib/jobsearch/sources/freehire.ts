// Typed client for freehire.me's public job-search API (see design spec §5).
// freehire's exact response shape is best-effort documented (its own CLI
// skill only guarantees "at least id, title, company, location, date, url,
// description" per result) — every field here is defensively type-checked,
// and any fetch/parse problem degrades the result rather than throwing, so
// one source outage degrades a scan instead of crashing it.
import type { JobPosting, SourceSearchResult } from './types'

const DEFAULT_BASE_URL = 'https://freehire.me'
const WORK_MODES = new Set(['remote', 'hybrid', 'onsite'])

export interface FreehireSearchParams {
  query?: string
  region?: string[]
  country?: string[]
  city?: string[]
  seniority?: string[]
  category?: string[]
  skill?: string[]
  remote?: 'remote' | 'hybrid' | 'onsite'
  jobage?: number
  page?: number
  limit?: number
}

function isWorkMode(value: unknown): value is 'remote' | 'hybrid' | 'onsite' {
  return typeof value === 'string' && WORK_MODES.has(value)
}

// freehire's `date` field is best-effort/untrusted — an unparseable string
// must become `undefined`, never an `Invalid Date` object (which would
// later blow up Mongoose's Date cast on insert).
function parsePostedAt(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed
}

// freehire's `url` field is rendered verbatim as an <a href> in the UI
// (components/jobsearch/ScrapedJobsList.tsx). Only accept it if it parses
// as an absolute http(s) URL — anything else (a `javascript:` URL, a bare
// string, etc.) becomes an empty string rather than a stored XSS vector.
function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

function normalizePosting(raw: unknown): JobPosting | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id.length === 0) return null
  return {
    source: 'freehire',
    sourceId: r.id,
    title: typeof r.title === 'string' ? r.title : '',
    company: typeof r.company === 'string' ? r.company : '',
    location: typeof r.location === 'string' ? r.location : undefined,
    url: safeUrl(r.url),
    description: typeof r.description === 'string' ? r.description : '',
    postedAt: parsePostedAt(r.date),
    workMode: isWorkMode(r.work_mode) ? r.work_mode : undefined,
  }
}

export async function searchFreehireJobs(params: FreehireSearchParams): Promise<SourceSearchResult> {
  try {
    const baseUrl = process.env.FREEHIRE_API_URL ?? DEFAULT_BASE_URL
    const url = new URL('/api/v1/agent/jobs/search', baseUrl)
    if (params.query) url.searchParams.set('q', params.query)
    if (params.region?.length) url.searchParams.set('region', params.region.join(','))
    if (params.country?.length) url.searchParams.set('country', params.country.join(','))
    if (params.city?.length) url.searchParams.set('city', params.city.join(','))
    if (params.seniority?.length) url.searchParams.set('seniority', params.seniority.join(','))
    if (params.category?.length) url.searchParams.set('category', params.category.join(','))
    if (params.skill?.length) url.searchParams.set('skill', params.skill.join(','))
    if (params.remote) url.searchParams.set('remote', params.remote)
    if (params.jobage !== undefined) url.searchParams.set('jobage', String(params.jobage))
    url.searchParams.set('page', String(params.page ?? 1))
    url.searchParams.set('limit', String(params.limit ?? 25))

    const res = await fetch(url.toString())
    if (!res.ok) {
      return { postings: [], degraded: true, errorMessage: `freehire returned ${res.status}` }
    }
    const body: unknown = await res.json()
    const rawResults =
      typeof body === 'object' && body !== null && Array.isArray((body as Record<string, unknown>).results)
        ? ((body as Record<string, unknown>).results as unknown[])
        : []
    const postings = rawResults
      .map(normalizePosting)
      .filter((p): p is JobPosting => p !== null)
    return { postings, degraded: false }
  } catch (err) {
    return {
      postings: [],
      degraded: true,
      errorMessage: err instanceof Error ? err.message : 'freehire request failed',
    }
  }
}
