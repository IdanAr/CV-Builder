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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: { count: 1, page: 1, total: 1 },
        results: [
          {
            id: 'golang-zensar-2bxu6dxm',
            title: 'Backend Engineer',
            company: 'Zensar',
            location: 'Berlin, Germany',
            date: '2026-08-01',
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

  it('drops results missing a usable id rather than throwing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { id: 'valid-1', title: 'A', company: 'X', url: 'https://x', description: 'd' },
          { title: 'No id', company: 'X', url: 'https://x', description: 'd' },
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

  it('joins array facets with commas and honors FREEHIRE_API_URL', async () => {
    process.env.FREEHIRE_API_URL = 'http://localhost:8080'
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    await searchFreehireJobs({
      query: 'go',
      region: ['eu', 'us'],
      country: ['DE'],
      seniority: ['senior', 'staff'],
      remote: 'remote',
      jobage: 7,
      page: 2,
      limit: 10,
    })

    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.origin).toBe('http://localhost:8080')
    expect(calledUrl.pathname).toBe('/api/v1/agent/jobs/search')
    expect(calledUrl.searchParams.get('q')).toBe('go')
    expect(calledUrl.searchParams.get('region')).toBe('eu,us')
    expect(calledUrl.searchParams.get('country')).toBe('DE')
    expect(calledUrl.searchParams.get('seniority')).toBe('senior,staff')
    expect(calledUrl.searchParams.get('remote')).toBe('remote')
    expect(calledUrl.searchParams.get('jobage')).toBe('7')
    expect(calledUrl.searchParams.get('page')).toBe('2')
    expect(calledUrl.searchParams.get('limit')).toBe('10')
  })

  it('degrades on a malformed FREEHIRE_API_URL instead of throwing', async () => {
    process.env.FREEHIRE_API_URL = 'not a valid url'

    const result = await searchFreehireJobs({})

    expect(result.degraded).toBe(true)
    expect(result.postings).toEqual([])
    expect(result.errorMessage).toBeDefined()
  })
})
