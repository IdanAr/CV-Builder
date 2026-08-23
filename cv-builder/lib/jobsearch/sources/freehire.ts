// Typed client for freehire.me's public job-search API (see design spec §5).
// Field/param names below were verified directly against the live API
// (https://freehire.me/api/v1/agent/jobs/search) — its own documentation
// was inaccurate: results live under `data` (not `results`), each posting's
// id is `public_slug` (not `id`), the date field is `posted_at` (not
// `date`), the plural facets are `regions`/`countries`/`cities`/`skills`
// (not the singular forms), the work-mode facet is `work_mode` (not
// `remote`), the recency facet is `posted_within_days` (not `jobage`), and
// pagination is `offset`-based (not `page` — the API silently ignores an
// unrecognized `page` param via its `meta.ignored_params` field). Every
// field read from the response is still defensively type-checked, and any
// fetch/parse problem degrades the result rather than throwing, so one
// source outage degrades a scan instead of crashing it.
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
  if (typeof r.public_slug !== 'string' || r.public_slug.length === 0) return null
  return {
    source: 'freehire',
    sourceId: r.public_slug,
    title: typeof r.title === 'string' ? r.title : '',
    company: typeof r.company === 'string' ? r.company : '',
    location: typeof r.location === 'string' ? r.location : undefined,
    url: safeUrl(r.url),
    description: typeof r.description === 'string' ? r.description : '',
    postedAt: parsePostedAt(r.posted_at),
    workMode: isWorkMode(r.work_mode) ? r.work_mode : undefined,
  }
}

export async function searchFreehireJobs(params: FreehireSearchParams): Promise<SourceSearchResult> {
  try {
    const baseUrl = process.env.FREEHIRE_API_URL ?? DEFAULT_BASE_URL
    const url = new URL('/api/v1/agent/jobs/search', baseUrl)
    const limit = params.limit ?? 25
    if (params.query) url.searchParams.set('q', params.query)
    if (params.region?.length) url.searchParams.set('regions', params.region.join(','))
    if (params.country?.length) url.searchParams.set('countries', params.country.join(','))
    if (params.city?.length) url.searchParams.set('cities', params.city.join(','))
    if (params.seniority?.length) url.searchParams.set('seniority', params.seniority.join(','))
    if (params.category?.length) url.searchParams.set('category', params.category.join(','))
    if (params.skill?.length) url.searchParams.set('skills', params.skill.join(','))
    if (params.remote) url.searchParams.set('work_mode', params.remote)
    if (params.jobage !== undefined) url.searchParams.set('posted_within_days', String(params.jobage))
    // The public interface stays page-based (1-indexed) for callers'
    // convenience; freehire's actual API is offset-based.
    url.searchParams.set('offset', String(((params.page ?? 1) - 1) * limit))
    url.searchParams.set('limit', String(limit))

    const res = await fetch(url.toString())
    if (!res.ok) {
      return { postings: [], degraded: true, errorMessage: `freehire returned ${res.status}` }
    }
    const body: unknown = await res.json()
    const rawResults =
      typeof body === 'object' && body !== null && Array.isArray((body as Record<string, unknown>).data)
        ? ((body as Record<string, unknown>).data as unknown[])
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
