// lib/jobsearch/__tests__/scan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const {
  mockSearchFreehireJobs,
  mockGetJobSearchProfile,
  mockFindExistingSourceIds,
  mockCreateScrapedJobs,
  mockScoreResume,
  mockResumeFindOne,
  mockListRulesForProfile,
} = vi.hoisted(() => ({
  mockSearchFreehireJobs: vi.fn(),
  mockGetJobSearchProfile: vi.fn(),
  mockFindExistingSourceIds: vi.fn(),
  mockCreateScrapedJobs: vi.fn(),
  mockScoreResume: vi.fn(),
  mockResumeFindOne: vi.fn(),
  mockListRulesForProfile: vi.fn(),
}))

vi.mock('../sources/freehire', () => ({ searchFreehireJobs: mockSearchFreehireJobs }))
vi.mock('@/lib/api/jobsearch-profiles', () => ({ getJobSearchProfile: mockGetJobSearchProfile }))
vi.mock('@/lib/api/scraped-jobs', () => ({
  findExistingSourceIds: mockFindExistingSourceIds,
  createScrapedJobs: mockCreateScrapedJobs,
}))
vi.mock('@/lib/api/jobsearch-rules', () => ({ listRulesForProfile: mockListRulesForProfile }))
vi.mock('@/lib/ats/scorer', () => ({ scoreResume: mockScoreResume }))
vi.mock('@/models/Resume', () => ({ default: { findOne: mockResumeFindOne } }))

import { runScanForProfile } from '../scan'

function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}
function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) }
}

const baseProfile = {
  _id: 'p1',
  userId: 'u1',
  roles: ['Backend Engineer'],
  workModes: [],
  locations: [],
  seniority: [],
  categories: [],
  industries: [],
  recencyDays: 14,
  resumeId: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindExistingSourceIds.mockResolvedValue(new Set())
  mockCreateScrapedJobs.mockResolvedValue(undefined)
  mockScoreResume.mockReturnValue({ total: 60 })
  mockResumeFindOne.mockReturnValue(sortLeanChain({ data: { basics: { name: 'Test' } } }))
  mockListRulesForProfile.mockResolvedValue([])
})

describe('runScanForProfile', () => {
  it('returns a degraded result when the profile does not exist', async () => {
    mockGetJobSearchProfile.mockResolvedValue(null)

    const result = await runScanForProfile('u1', 'missing')

    expect(result.degraded).toBe(true)
    expect(result.errorMessage).toMatch(/not found/i)
    expect(mockSearchFreehireJobs).not.toHaveBeenCalled()
  })

  it('propagates a degraded freehire result without persisting anything', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: true, errorMessage: 'freehire returned 503' })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.degraded).toBe(true)
    expect(result.errorMessage).toBe('freehire returned 503')
    expect(mockCreateScrapedJobs).not.toHaveBeenCalled()
  })

  it('dedupes against existing sourceIds and scores only the new postings', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [
        { source: 'freehire', sourceId: 'a1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', description: 'JD 1' },
        { source: 'freehire', sourceId: 'a2', title: 'Frontend Engineer', company: 'Acme', url: 'https://x/a2', description: 'JD 2' },
      ],
    })
    mockFindExistingSourceIds.mockResolvedValue(new Set(['a1']))
    mockScoreResume.mockReturnValue({ total: 77 })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.fetched).toBe(2)
    expect(result.skippedExisting).toBe(1)
    expect(result.created).toBe(1)
    expect(mockCreateScrapedJobs).toHaveBeenCalledWith(
      'u1',
      'p1',
      expect.arrayContaining([expect.objectContaining({ sourceId: 'a2', atsScore: 77, status: 'new' })])
    )
    expect(mockCreateScrapedJobs.mock.calls[0][2]).toHaveLength(1)
  })

  it('applies the industry filter before scoring or persisting', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, industries: ['fintech'] })
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [
        { source: 'freehire', sourceId: 'a1', title: 'Payments Engineer', company: 'Stripe', url: 'https://x/a1', description: 'fintech role' },
        { source: 'freehire', sourceId: 'a2', title: 'Game Engineer', company: 'Ubisoft', url: 'https://x/a2', description: 'gaming role' },
      ],
    })

    await runScanForProfile('u1', 'p1')

    expect(mockCreateScrapedJobs.mock.calls[0][2]).toHaveLength(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].sourceId).toBe('a1')
  })

  it('omits the remote facet when zero or multiple work modes are selected', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, workModes: ['remote', 'hybrid'] })
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    await runScanForProfile('u1', 'p1')

    expect(mockSearchFreehireJobs).toHaveBeenCalledWith(expect.not.objectContaining({ remote: expect.anything() }))
  })

  it('passes the single selected work mode as the remote facet', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, workModes: ['remote'] })
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    await runScanForProfile('u1', 'p1')

    expect(mockSearchFreehireJobs).toHaveBeenCalledWith(expect.objectContaining({ remote: 'remote' }))
  })

  it('scores against the profile-linked resume when resumeId is set', async () => {
    const mockFindOne = vi.fn().mockReturnValue(leanChain({ data: { basics: { name: 'Linked' } } }))
    mockResumeFindOne.mockImplementation(mockFindOne)
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, resumeId: 'r1' })
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })

    await runScanForProfile('u1', 'p1')

    expect(mockFindOne).toHaveBeenCalledWith({ _id: 'r1', userId: 'u1' })
  })

  it('maps location region into the freehire search params alongside country and city', async () => {
    mockGetJobSearchProfile.mockResolvedValue({
      ...baseProfile,
      locations: [{ country: 'DE', region: 'Bavaria', city: 'Munich' }, { region: 'Île-de-France' }],
    })
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    await runScanForProfile('u1', 'p1')

    expect(mockSearchFreehireJobs).toHaveBeenCalledWith(
      expect.objectContaining({ region: ['Bavaria', 'Île-de-France'] })
    )
  })

  it('returns a degraded result instead of throwing when createScrapedJobs fails unexpectedly', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })
    mockCreateScrapedJobs.mockRejectedValue(new Error('insertMany exploded'))

    const result = await runScanForProfile('u1', 'p1')

    expect(result).toEqual({
      fetched: 0,
      created: 0,
      skippedExisting: 0,
      degraded: true,
      errorMessage: 'insertMany exploded',
    })
  })

  it('dedupes postings that share a sourceId within the same freehire response before persisting', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [
        { source: 'freehire', sourceId: 'dup', title: 'First', company: 'Acme', url: 'https://x/dup', description: 'JD 1' },
        { source: 'freehire', sourceId: 'dup', title: 'Second (repeat)', company: 'Acme', url: 'https://x/dup', description: 'JD 2' },
      ],
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.created).toBe(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2]).toHaveLength(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].title).toBe('First')
  })

  it('leaves atsScore undefined when the user has no resume at all', async () => {
    mockResumeFindOne.mockReturnValue(sortLeanChain(null))
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })

    await runScanForProfile('u1', 'p1')

    expect(mockScoreResume).not.toHaveBeenCalled()
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].atsScore).toBeUndefined()
  })

  it('does not fetch rules when there are no new postings', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    await runScanForProfile('u1', 'p1')

    expect(mockListRulesForProfile).not.toHaveBeenCalled()
  })

  it('suppresses a posting matched by an ignore rule and never persists it', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Blocked Co', url: 'https://x/a1', description: 'JD' }],
    })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Block it', isActive: true, action: 'ignore', conditions: [{ field: 'company', op: 'in', value: ['Blocked Co'] }] },
    ])

    const result = await runScanForProfile('u1', 'p1')

    expect(result.created).toBe(0)
    expect(mockCreateScrapedJobs).not.toHaveBeenCalled()
  })

  it('suppresses only the posting matched by an ignore rule, not the entire batch', async () => {
    // Regression guard for a batch-wide-drop bug: a single mismatched
    // posting in the earlier ignore-veto test can't distinguish "suppress
    // this one posting" from "drop everything once any posting matches an
    // ignore rule" (e.g. a stray `break`/`return` instead of `continue` in
    // the per-posting loop). A mixed batch with one suppressed and one
    // surviving posting proves the suppression is genuinely per-posting.
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [
        { source: 'freehire', sourceId: 'blocked-1', title: 'X', company: 'Blocked Co', url: 'https://x/blocked-1', description: 'JD' },
        { source: 'freehire', sourceId: 'ok-1', title: 'Y', company: 'Fine Co', url: 'https://x/ok-1', description: 'JD' },
      ],
    })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Block it', isActive: true, action: 'ignore', conditions: [{ field: 'company', op: 'in', value: ['Blocked Co'] }] },
    ])

    const result = await runScanForProfile('u1', 'p1')

    expect(result.created).toBe(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2]).toHaveLength(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].sourceId).toBe('ok-1')
  })

  it('sets matchedRules and resolvedActions from matched rules on a persisted posting', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', description: 'JD' }],
    })
    mockScoreResume.mockReturnValue({ total: 80 })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'High fit', isActive: true, action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] },
    ])

    await runScanForProfile('u1', 'p1')

    expect(mockCreateScrapedJobs.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({ matchedRules: ['High fit'], resolvedActions: ['notify'] })
    )
  })
})
