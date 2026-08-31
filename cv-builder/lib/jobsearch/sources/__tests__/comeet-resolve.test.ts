import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveComeetCompanyFromUrl } from '../comeet-resolve'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function pageHtml(companyDataJson: string): string {
  return `<html><head><script>var COMPANY_DATA = ${companyDataJson};</script></head><body></body></html>`
}

describe('resolveComeetCompanyFromUrl', () => {
  it('extracts name/uid/token from a real careers page shape', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        pageHtml(
          '{"name": "DealHub", "location": "Israel", "company_uid": "86.005", "token": "685271E6853AAD1A14D0A2099138F2DA33428", "slug": "dealhub"}'
        ),
    } as Response)

    const result = await resolveComeetCompanyFromUrl('https://www.comeet.com/jobs/dealhub/86.005')

    expect(result).toEqual({
      ok: true,
      company: { name: 'DealHub', uid: '86.005', token: '685271E6853AAD1A14D0A2099138F2DA33428' },
    })
  })

  it('correctly balances braces when a string value (e.g. description) contains its own braces', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        pageHtml(
          '{"name": "Acme", "description": "We use {curly braces} in our style guide", "company_uid": "AC.001", "token": "tok_1"}'
        ),
    } as Response)

    const result = await resolveComeetCompanyFromUrl('https://comeet.com/jobs/acme/AC.001')

    expect(result).toEqual({ ok: true, company: { name: 'Acme', uid: 'AC.001', token: 'tok_1' } })
  })

  it('rejects a non-comeet.com host instead of fetching it (SSRF guard)', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const result = await resolveComeetCompanyFromUrl('https://evil.example/jobs/x/1')

    expect(result.ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects a non-http(s) protocol instead of fetching it', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const result = await resolveComeetCompanyFromUrl('javascript:alert(1)')

    expect(result.ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects an unparseable URL', async () => {
    const result = await resolveComeetCompanyFromUrl('not a url')
    expect(result.ok).toBe(false)
  })

  it('returns an error when the page has no COMPANY_DATA at all', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => '<html><body>Not a Comeet page</body></html>',
    } as Response)

    const result = await resolveComeetCompanyFromUrl('https://www.comeet.com/jobs/nope/1')

    expect(result).toEqual({ ok: false, error: expect.any(String) })
  })

  it('returns an error when COMPANY_DATA is missing a required field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => pageHtml('{"name": "Acme", "company_uid": "AC.001"}'),
    } as Response)

    const result = await resolveComeetCompanyFromUrl('https://www.comeet.com/jobs/acme/AC.001')

    expect(result.ok).toBe(false)
  })

  it('returns an error on a non-2xx response instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response)

    const result = await resolveComeetCompanyFromUrl('https://www.comeet.com/jobs/gone/1')

    expect(result).toEqual({ ok: false, error: expect.stringContaining('404') })
  })

  it('returns an error on a network failure instead of throwing', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    const result = await resolveComeetCompanyFromUrl('https://www.comeet.com/jobs/x/1')

    expect(result.ok).toBe(false)
  })
})
