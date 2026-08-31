import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchComeetJobs } from '../comeet'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const COMPANY = { name: 'Acme Israel', uid: 'ACM.001', token: 'tok_abc123' }

describe('searchComeetJobs', () => {
  it('normalizes a bare-array response into JobPosting objects', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          uid: 'POS.123',
          name: 'Backend Engineer',
          company_name: 'Acme Israel',
          workplace_type: 'Hybrid',
          location: { city: 'Tel Aviv', country: 'Israel' },
          url_active_page: 'https://acme.example/careers/backend',
          time_updated: '2026-08-01T00:00:00.000Z',
          details: [{ name: 'Description', value: '<p>Build <b>backend</b> systems.</p>', order: 0 }],
        },
      ],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.degraded).toBe(false)
    expect(result.postings).toEqual([
      {
        source: 'comeet',
        sourceId: 'POS.123',
        title: 'Backend Engineer',
        company: 'Acme Israel',
        location: 'Tel Aviv, Israel',
        url: 'https://acme.example/careers/backend',
        description: 'Build backend systems.',
        postedAt: new Date('2026-08-01T00:00:00.000Z'),
        workMode: 'hybrid',
      },
    ])
  })

  it('normalizes a response wrapped under a "positions" key', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ positions: [{ uid: 'POS.1', name: 'A', company_name: 'X' }] }),
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings).toHaveLength(1)
    expect(result.postings[0].sourceId).toBe('POS.1')
  })

  it('normalizes a response wrapped under a "data" key', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ uid: 'POS.2', name: 'B', company_name: 'X' }] }),
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings).toHaveLength(1)
    expect(result.postings[0].sourceId).toBe('POS.2')
  })

  it("falls back to the watchlist entry's own name when company_name is missing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'POS.1', name: 'A' }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings[0].company).toBe('Acme Israel')
  })

  it('drops positions missing a usable uid rather than throwing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'valid-1', name: 'A' }, { name: 'No uid' }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings).toHaveLength(1)
    expect(result.postings[0].sourceId).toBe('valid-1')
  })

  it('degrades on a non-2xx response instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.degraded).toBe(true)
    expect(result.postings).toEqual([])
    expect(result.errorMessage).toContain('401')
    expect(result.errorMessage).toContain(COMPANY.name)
  })

  it('degrades on a network failure instead of throwing', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))

    const result = await searchComeetJobs(COMPANY)

    expect(result.degraded).toBe(true)
    expect(result.postings).toEqual([])
    expect(result.errorMessage).toBe('fetch failed')
  })

  it('drops an unparseable time_updated to undefined instead of an Invalid Date', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'valid-1', name: 'A', time_updated: 'not-a-real-date' }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings[0].postedAt).toBeUndefined()
  })

  it('parses an epoch-seconds time_updated', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'valid-1', name: 'A', time_updated: 1735689600 }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings[0].postedAt).toEqual(new Date(1735689600 * 1000))
  })

  it('drops a non-http(s) url (e.g. javascript:) to an empty string instead of passing it through', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'valid-1', name: 'A', url_active_page: 'javascript:alert(1)' }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings[0].url).toBe('')
  })

  it('falls back to url_comeet_hosted_page when url_active_page is absent', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'valid-1', name: 'A', url_comeet_hosted_page: 'https://comeet.example/hosted/1' }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings[0].url).toBe('https://comeet.example/hosted/1')
  })

  it('ignores an unrecognized workplace_type rather than guessing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ uid: 'valid-1', name: 'A', workplace_type: 'Freelance' }],
    } as Response)

    const result = await searchComeetJobs(COMPANY)

    expect(result.postings[0].workMode).toBeUndefined()
  })

  it('requests the documented endpoint shape with token and details=true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', mockFetch)

    await searchComeetJobs(COMPANY)

    const calledUrl = new URL(mockFetch.mock.calls[0][0])
    expect(calledUrl.pathname).toBe(`/careers-api/2.0/company/${COMPANY.uid}/positions`)
    expect(calledUrl.searchParams.get('token')).toBe(COMPANY.token)
    expect(calledUrl.searchParams.get('details')).toBe('true')
  })
})
