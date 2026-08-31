// Typed client for Comeet's public Careers API (see design plan "Add Comeet as a
// second JobSearch source"). Unlike freehire, Comeet has no cross-company search —
// each company's postings are fetched individually via that company's own UID +
// public-facing careers-page token (obtained from the company's own public Comeet
// careers page; this is the same tier of "public" credential as freehire's own API,
// not a user secret — but it is still never logged here).
//
// Per developers.comeet.com/reference/careers-position-model, a position carries
// `uid`, `name`, `company_name`, `workplace_type` ('On-site'/'Hybrid'/'Remote'),
// `location` (nested city/state/country/etc.), `url_active_page` /
// `url_comeet_hosted_page`, `time_updated`, and `details[]` (an array of
// `{name, value: HTML, order}` free-text blocks — only present when the request
// includes `details=true`). The docs do not show a live example of the list
// endpoint's top-level envelope (bare array vs. an object wrapping it) or
// `time_updated`'s exact format (epoch vs. ISO string) — no live company token was
// available to verify this against a real response, so both are handled
// defensively below and this should be re-verified against a real company's
// endpoint the first time one is actually scanned (see the design plan's
// Verification section).
import type { JobPosting, SourceSearchResult } from './types'

const BASE_URL = 'https://www.comeet.co/careers-api/2.0'
const WORK_MODES = new Set(['remote', 'hybrid', 'onsite'])
const WORKPLACE_TYPE_MAP: Record<string, 'remote' | 'hybrid' | 'onsite'> = {
  'on-site': 'onsite',
  hybrid: 'hybrid',
  remote: 'remote',
}

export interface ComeetCompanyPref {
  name: string
  uid: string
  token: string
}

function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

// `time_updated`'s exact representation wasn't confirmed live (see header comment) —
// accepts an epoch number (seconds or milliseconds) or an ISO-ish string, and returns
// `undefined` for anything that produces an Invalid Date rather than letting a bad
// value reach Mongoose's Date cast on insert (same reasoning as freehire's
// parsePostedAt).
function parseTimeUpdated(value: unknown): Date | undefined {
  if (typeof value === 'number') {
    // Comeet's own dashboard is JS-based; treat values too small to be a plausible
    // millisecond timestamp (i.e. before roughly year 2001) as seconds instead.
    const ms = value < 10_000_000_000 ? value * 1000 : value
    const parsed = new Date(ms)
    return Number.isNaN(parsed.valueOf()) ? undefined : parsed
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.valueOf()) ? undefined : parsed
  }
  return undefined
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractDescription(details: unknown): string {
  if (!Array.isArray(details)) return ''
  return details
    .map((d) => (typeof d === 'object' && d !== null && typeof (d as Record<string, unknown>).value === 'string'
      ? stripHtml((d as Record<string, unknown>).value as string)
      : ''))
    .filter(Boolean)
    .join('\n\n')
}

function extractLocation(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const loc = raw as Record<string, unknown>
  const parts = [loc.city, loc.state, loc.country].filter(
    (p): p is string => typeof p === 'string' && p.length > 0
  )
  return parts.length > 0 ? parts.join(', ') : undefined
}

function normalizePosition(raw: unknown, fallbackCompanyName: string): JobPosting | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.uid !== 'string' || r.uid.length === 0) return null

  const workplaceType = typeof r.workplace_type === 'string' ? r.workplace_type.toLowerCase() : undefined
  const workMode = workplaceType && WORKPLACE_TYPE_MAP[workplaceType]

  return {
    source: 'comeet',
    sourceId: r.uid,
    title: typeof r.name === 'string' ? r.name : '',
    company: typeof r.company_name === 'string' && r.company_name.length > 0 ? r.company_name : fallbackCompanyName,
    location: extractLocation(r.location),
    url: safeUrl(r.url_active_page) || safeUrl(r.url_comeet_hosted_page),
    description: extractDescription(r.details),
    postedAt: parseTimeUpdated(r.time_updated),
    workMode: workMode && WORK_MODES.has(workMode) ? workMode : undefined,
  }
}

// The list-positions response envelope wasn't confirmed live (see header comment) —
// accepts a bare array or an object wrapping it under a plausible key.
function extractRawPositions(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>
    if (Array.isArray(b.positions)) return b.positions
    if (Array.isArray(b.data)) return b.data
  }
  return []
}

export async function searchComeetJobs(company: ComeetCompanyPref): Promise<SourceSearchResult> {
  try {
    const url = new URL(`${BASE_URL}/company/${encodeURIComponent(company.uid)}/positions`)
    url.searchParams.set('token', company.token)
    url.searchParams.set('details', 'true')

    const res = await fetch(url.toString())
    if (!res.ok) {
      return { postings: [], degraded: true, errorMessage: `comeet (${company.name}) returned ${res.status}` }
    }
    const body: unknown = await res.json()
    const postings = extractRawPositions(body)
      .map((raw) => normalizePosition(raw, company.name))
      .filter((p): p is JobPosting => p !== null)
    return { postings, degraded: false }
  } catch (err) {
    return {
      postings: [],
      degraded: true,
      errorMessage: err instanceof Error ? err.message : `comeet (${company.name}) request failed`,
    }
  }
}
