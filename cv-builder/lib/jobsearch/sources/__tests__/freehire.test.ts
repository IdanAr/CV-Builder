import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchFreehireJobs } from '../freehire'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.FREEHIRE_API_URL
})

describe('searchFreehireJobs', () => {
  it('normalizes a well-formed response into JobPosting objects', async () => {
    // Shape verified against the live API (https://freehire.me/api/v1/agent/jobs/search):
    // results live under `data`, not `results`; each posting's id is
    // `public_slug`, not `id`; the date field is `posted_at`, not `date`.
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: { limit: 1, offset: 0, total: 1 },
        data: [
          {
            public_slug: 'golang-zensar-2bxu6dxm',
            title: 'Backend Engineer',
            company: 'Zensar',
            location: 'Berlin, Germany',
            posted_at: '2026-08-01',
            url: 'https://freehire.me/jobs/golang-zensar-2bxu6dxm',
            description: 'Build backend systems.',
            work_mode: 'remote',
          },
        ],
      }),
    } as Response)

    const result = await searchFreehireJobs({ query: 'backend', jobage: 14 })

    expect(result.degraded).toBe(false)
    expect(result.postings).toEqual([
      {
        source: 'freehire',
        sourceId: 'golang-zensar-2bxu6dxm',
        title: 'Backend Engineer',
        company: 'Zensar',
        location: 'Berlin, Germany',
        url: 'https://freehire.me/jobs/golang-zensar-2bxu6dxm',
        description: 'Build backend systems.',
        postedAt: new Date('2026-08-01'),
        workMode: 'remote',
      },
    ])
  })

  it('drops results missing a usable public_slug rather than throwing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { public_slug: 'valid-1', title: 'A', company: 'X', url: 'https://x', description: 'd' },
          { title: 'No slug', company: 'X', url: 'https://x', description: 'd' },
        ],
      }),
    } as Response)

    const result = await searchFreehireJobs({})

    expect(result.postings).toHaveLength(1)
    expect(result.postings[0].sourceId).toBe('valid-1')
  })

  it('degrades on a non-2xx response instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

    const result = await searchFreehireJobs({})

    expect(result.degraded).toBe(true)
    expect(result.postings).toEqual([])
    expect(result.errorMessage).toContain('503')
  })

  it('degrades on a network failure instead of throwing', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))

    const result = await searchFreehireJobs({})

    expect(result.degraded).toBe(true)
    expect(result.postings).toEqual([])
    expect(result.errorMessage).toBe('fetch failed')
  })

  it('maps facets to freehire\'s real param names, joins arrays with commas, translates page to offset, and honors FREEHIRE_API_URL', async () => {
    // Every param name below was verified against the live API: sending the
    // old assumed names (region/country/city/skill/remote/jobage/page) made
    // the API echo them back under `meta.ignored_params` (with a
    // `did_you_mean` hint for the plural facets) instead of filtering.
    process.env.FREEHIRE_API_URL = 'http://localhost:8080'
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    await searchFreehireJobs({
      query: 'go',
      region: ['eu', 'us'],
      country: ['DE'],
      city: ['Berlin'],
      skill: ['go', 'kubernetes'],
      seniority: ['senior', 'staff'],
      category: ['backend'],
      remote: 'remote',
      jobage: 7,
      page: 3,
      limit: 10,
    })

    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.origin).toBe('http://localhost:8080')
    expect(calledUrl.pathname).toBe('/api/v1/agent/jobs/search')
    expect(calledUrl.searchParams.get('q')).toBe('go')
    expect(calledUrl.searchParams.get('regions')).toBe('eu,us')
    expect(calledUrl.searchParams.get('countries')).toBe('DE')
    expect(calledUrl.searchParams.get('cities')).toBe('Berlin')
    expect(calledUrl.searchParams.get('skills')).toBe('go,kubernetes')
    expect(calledUrl.searchParams.get('seniority')).toBe('senior,staff')
    expect(calledUrl.searchParams.get('category')).toBe('backend')
    expect(calledUrl.searchParams.get('work_mode')).toBe('remote')
    expect(calledUrl.searchParams.get('posted_within_days')).toBe('7')
    // page 3, limit 10 -> offset 20 (0-indexed, two full pages before it)
    expect(calledUrl.searchParams.get('offset')).toBe('20')
    expect(calledUrl.searchParams.get('limit')).toBe('10')
    expect(calledUrl.searchParams.has('page')).toBe(false)
    expect(calledUrl.searchParams.has('jobage')).toBe(false)
    expect(calledUrl.searchParams.has('remote')).toBe(false)
  })

  it('defaults to offset 0 when no page is given', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    await searchFreehireJobs({ limit: 25 })

    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.searchParams.get('offset')).toBe('0')
  })

  it('drops an unparseable date string to undefined instead of an Invalid Date', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            public_slug: 'valid-1',
            title: 'A',
            company: 'X',
            url: 'https://x',
            description: 'd',
            posted_at: 'not-a-real-date',
          },
        ],
      }),
    } as Response)

    const result = await searchFreehireJobs({})

    expect(result.postings).toHaveLength(1)
    expect(result.postings[0].postedAt).toBeUndefined()
  })

  it('drops a non-http(s) url (e.g. javascript:) to an empty string instead of passing it through', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { public_slug: 'valid-1', title: 'A', company: 'X', url: 'javascript:alert(1)', description: 'd' },
        ],
      }),
    } as Response)

    const result = await searchFreehireJobs({})

    expect(result.postings).toHaveLength(1)
    expect(result.postings[0].url).toBe('')
  })

  it('degrades on a malformed FREEHIRE_API_URL instead of throwing', async () => {
    process.env.FREEHIRE_API_URL = 'not a valid url'

    const result = await searchFreehireJobs({})

    expect(result.degraded).toBe(true)
    expect(result.postings).toEqual([])
    expect(result.errorMessage).toBeDefined()
  })
})
