export interface JobPosting {
  source: 'freehire' | 'comeet'
  sourceId: string
  title: string
  company: string
  location?: string
  url: string
  description: string
  postedAt?: Date
  workMode?: 'remote' | 'hybrid' | 'onsite'
}

export interface SourceSearchResult {
  postings: JobPosting[]
  degraded: boolean
  errorMessage?: string
}

/**
 * Deadline for a single outbound request to a job-board source.
 *
 * A scan fans these out concurrently (up to MAX_ROLE_QUERIES for freehire,
 * MAX_COMEET_COMPANIES for Comeet), so without a bound one hung upstream
 * socket holds the whole scan open until the platform kills the function —
 * taking every other source's results with it, and on the user-triggered
 * "Scan now" route, the user's request too.
 *
 * Matches the deadline comeet-resolve.ts already applies to its own fetch.
 */
export const SOURCE_REQUEST_TIMEOUT_MS = 10_000
