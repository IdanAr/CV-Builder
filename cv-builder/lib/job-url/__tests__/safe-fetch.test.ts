import { describe, it, expect, vi, afterEach } from 'vitest'
import dns from 'node:dns'
import { isBlockedAddress, validateJobUrl, fetchPublicPage, JobUrlError } from '../safe-fetch'

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::7f00:1',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '104.18.1.1', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])('allows public %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false)
  })
})

describe('validateJobUrl', () => {
  it('accepts an ordinary https link', () => {
    expect(validateJobUrl(' https://boards.greenhouse.io/acme/jobs/1 ').hostname).toBe('boards.greenhouse.io')
  })

  it.each([
    ['not a url', /full link/],
    ['ftp://example.com/job', /Only http and https/],
    ['file:///etc/passwd', /Only http and https/],
    ['https://example.com:8443/job', /unusual port/],
    ['https://user:pw@example.com/job', /username or password/],
    ['http://127.0.0.1/admin', /not a public website/],
    ['http://[::1]/', /not a public website/],
    ['http://169.254.169.254/latest/meta-data', /not a public website/],
    ['http://localhost/', /not a public website/],
    ['http://metadata.google.internal/', /not a public website/],
  ])('rejects %s', (raw, message) => {
    expect(() => validateJobUrl(raw)).toThrow(message)
  })
})

describe('fetchPublicPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refuses to connect when a public-looking name resolves to a private address', async () => {
    vi.spyOn(dns, 'lookup').mockImplementation(((_host: string, _opts: unknown, cb: (e: null, a: dns.LookupAddress[]) => void) => {
      cb(null, [{ address: '127.0.0.1', family: 4 }])
    }) as unknown as typeof dns.lookup)
    const err = await fetchPublicPage('http://jobs.attacker.example/').catch((e) => e)
    expect(err).toBeInstanceOf(JobUrlError)
    expect(err.message).toMatch(/not a public website/)
  })

  it('refuses when any one of several resolved addresses is private', async () => {
    vi.spyOn(dns, 'lookup').mockImplementation(((_host: string, _opts: unknown, cb: (e: null, a: dns.LookupAddress[]) => void) => {
      cb(null, [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }])
    }) as unknown as typeof dns.lookup)
    const err = await fetchPublicPage('http://mixed.example/').catch((e) => e)
    expect(err.message).toMatch(/not a public website/)
  })
})
