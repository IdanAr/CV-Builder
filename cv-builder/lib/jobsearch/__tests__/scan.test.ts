// lib/jobsearch/__tests__/scan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }))

const {
  mockSearchFreehireJobs,
  mockSearchComeetJobs,
  mockGetJobSearchProfile,
  mockFindExistingSourceIds,
  mockCreateScrapedJobs,
  mockScoreResume,
  mockResumeFindOne,
  mockListRulesForProfile,
  mockCountDraftedInWindow,
  mockListDraftQueueBacklog,
  mockMarkScrapedJobDrafted,
  mockRunApplyPipeline,
  mockListNewScrapedJobs,
  mockDeleteScrapedJobsByIds,
} = vi.hoisted(() => ({
  mockSearchFreehireJobs: vi.fn(),
  mockSearchComeetJobs: vi.fn(),
  mockGetJobSearchProfile: vi.fn(),
  mockFindExistingSourceIds: vi.fn(),
  mockCreateScrapedJobs: vi.fn(),
  mockScoreResume: vi.fn(),
  mockResumeFindOne: vi.fn(),
  mockListRulesForProfile: vi.fn(),
  mockCountDraftedInWindow: vi.fn(),
  mockListDraftQueueBacklog: vi.fn(),
  mockMarkScrapedJobDrafted: vi.fn(),
  mockRunApplyPipeline: vi.fn(),
  mockListNewScrapedJobs: vi.fn(),
  mockDeleteScrapedJobsByIds: vi.fn(),
}))

vi.mock('../sources/freehire', () => ({ searchFreehireJobs: mockSearchFreehireJobs }))
vi.mock('../sources/comeet', () => ({ searchComeetJobs: mockSearchComeetJobs }))
vi.mock('@/lib/api/jobsearch-profiles', () => ({ getJobSearchProfile: mockGetJobSearchProfile }))
vi.mock('@/lib/api/scraped-jobs', () => ({
  findExistingSourceIds: mockFindExistingSourceIds,
  createScrapedJobs: mockCreateScrapedJobs,
  countDraftedInWindow: mockCountDraftedInWindow,
  listDraftQueueBacklog: mockListDraftQueueBacklog,
  markScrapedJobDrafted: mockMarkScrapedJobDrafted,
  listNewScrapedJobs: mockListNewScrapedJobs,
  deleteScrapedJobsByIds: mockDeleteScrapedJobsByIds,
}))
vi.mock('@/lib/api/jobsearch-rules', () => ({ listRulesForProfile: mockListRulesForProfile }))
vi.mock('@/lib/ats/scorer', () => ({ scoreResume: mockScoreResume }))
vi.mock('@/models/Resume', () => ({ default: { findOne: mockResumeFindOne } }))
vi.mock('../apply', () => ({
  runApplyPipeline: mockRunApplyPipeline,
  PER_PROFILE_DAILY_DRAFT_CAP: 3,
  PER_USER_DAILY_DRAFT_CAP: 10,
}))

import { runScanForProfile, MAX_ROLE_QUERIES } from '../scan'

function leanChain(resolved: unknown) {
  return { lean: vi.fn().mockResolvedValue(resolved) }
}
function sortLeanChain(resolved: unknown) {
  return { sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(resolved) })) }
}

const baseProfile = {
  _id: 'p1',
  userId: 'u1',
  // Empty by default: most tests below aren't exercising role-title
  // relevance and use generic placeholder titles ('X', 'Y') that wouldn't
  // survive the role-title filter. Tests that need a specific role set
  // their own `roles` override with a title that actually matches it (see
  // the "queries freehire once per role" tests below).
  roles: [] as string[],
  workModes: [],
  locations: [],
  seniority: [],
  categories: [],
  industries: [],
  comeetCompanies: [] as { name: string; uid: string; token: string }[],
  recencyDays: 14,
  minAtsScore: 75,
  resumeId: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindExistingSourceIds.mockResolvedValue(new Set())
  mockCreateScrapedJobs.mockResolvedValue(undefined)
  // Default score sits above baseProfile.minAtsScore (75) so tests that
  // don't care about the threshold filter aren't accidentally tripped by
  // it; tests exercising the threshold override this explicitly.
  mockScoreResume.mockReturnValue({ total: 80, missingKeywords: [] })
  mockResumeFindOne.mockReturnValue(sortLeanChain({ _id: 'r-default', data: { basics: { name: 'Test' } } }))
  mockListRulesForProfile.mockResolvedValue([])
  mockCountDraftedInWindow.mockResolvedValue(0)
  mockListDraftQueueBacklog.mockResolvedValue([])
  mockMarkScrapedJobDrafted.mockResolvedValue(undefined)
  mockListNewScrapedJobs.mockResolvedValue([])
  mockDeleteScrapedJobsByIds.mockResolvedValue(0)
  mockRunApplyPipeline.mockResolvedValue({
    draftResumeId: 'draft1',
    postTailorScore: 90,
    pendingApprovals: [],
    tailoredKeywords: [],
    status: 'queued',
  })
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
      drafted: 0,
      pruned: 0,
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

  it('runs the apply pipeline and persists drafted fields for a draft_and_queue match', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', description: 'JD' }],
    })
    mockScoreResume.mockReturnValue({ total: 80, missingKeywords: ['Node'] })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Draft it', isActive: true, action: 'draft_and_queue', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] },
    ])
    mockRunApplyPipeline.mockResolvedValue({
      draftResumeId: 'draft1', postTailorScore: 91, pendingApprovals: [], tailoredKeywords: ['Node'], status: 'queued',
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(mockRunApplyPipeline).toHaveBeenCalledWith(
      'u1', expect.anything(), expect.objectContaining({ title: 'Backend Engineer', company: 'Acme' }), ['Node'], 75, 'r-default', expect.anything()
    )
    expect(mockCreateScrapedJobs.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({
        draftResumeId: 'draft1', postTailorScore: 91, status: 'queued', tailoredKeywords: ['Node'], draftedAt: expect.any(Date),
      })
    )
    expect(result.drafted).toBe(1)
  })

  it("forwards the source resume's own meta (not schema defaults) into the apply pipeline", async () => {
    const customMeta = { templateId: 'sidebar', sectionOrder: ['work', 'custom:proj-1'] }
    mockResumeFindOne.mockReturnValue(
      sortLeanChain({ _id: 'r-default', data: { basics: { name: 'Test' } }, meta: customMeta })
    )
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'Backend Engineer', company: 'Acme', url: 'https://x/a1', description: 'JD' }],
    })
    mockScoreResume.mockReturnValue({ total: 80, missingKeywords: ['Node'] })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Draft it', isActive: true, action: 'draft_and_queue', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] },
    ])
    mockRunApplyPipeline.mockResolvedValue({
      draftResumeId: 'draft1', postTailorScore: 91, pendingApprovals: [], tailoredKeywords: ['Node'], status: 'queued',
    })

    await runScanForProfile('u1', 'p1')

    expect(mockRunApplyPipeline).toHaveBeenCalledWith(
      'u1',
      expect.anything(),
      expect.objectContaining({ title: 'Backend Engineer' }),
      ['Node'],
      75,
      'r-default',
      expect.objectContaining({ templateId: 'sidebar', sectionOrder: ['work', 'custom:proj-1'] })
    )
  })

  it('does not run the apply pipeline for a draft_and_queue match when the user has no resume', async () => {
    mockResumeFindOne.mockReturnValue(sortLeanChain(null))
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Draft it', isActive: true, action: 'draft_and_queue', conditions: [{ field: 'title', op: 'contains', value: 'x' }] },
    ])

    const result = await runScanForProfile('u1', 'p1')

    expect(mockRunApplyPipeline).not.toHaveBeenCalled()
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].status).toBe('new')
    expect(result.drafted).toBe(0)
  })

  it('stops drafting once the per-profile daily cap is reached, leaving later matches as "new"', async () => {
    mockCountDraftedInWindow.mockResolvedValue(3)
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Draft it', isActive: true, action: 'draft_and_queue', conditions: [{ field: 'title', op: 'contains', value: 'x' }] },
    ])

    const result = await runScanForProfile('u1', 'p1')

    expect(mockRunApplyPipeline).not.toHaveBeenCalled()
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].status).toBe('new')
    expect(result.drafted).toBe(0)
  })

  it('stops drafting once the per-user aggregate daily cap is reached even though the per-profile cap has room', async () => {
    mockCountDraftedInWindow.mockImplementation((_userId: string, profileId?: string) =>
      Promise.resolve(profileId ? 0 : 10)
    )
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })
    mockListRulesForProfile.mockResolvedValue([
      { name: 'Draft it', isActive: true, action: 'draft_and_queue', conditions: [{ field: 'title', op: 'contains', value: 'x' }] },
    ])

    const result = await runScanForProfile('u1', 'p1')

    expect(mockRunApplyPipeline).not.toHaveBeenCalled()
    expect(result.drafted).toBe(0)
  })

  it('drains the existing draft_and_queue backlog before evaluating newly fetched postings', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })
    mockListDraftQueueBacklog.mockResolvedValue([
      { _id: 'backlog1', title: 'Old Match', company: 'Acme', description: 'JD' },
    ])
    mockScoreResume.mockReturnValue({ total: 80, missingKeywords: ['Node'] })
    mockRunApplyPipeline.mockResolvedValue({
      draftResumeId: 'draft2', postTailorScore: 92, pendingApprovals: [], tailoredKeywords: ['Node'], status: 'queued',
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(mockRunApplyPipeline).toHaveBeenCalledWith(
      'u1', expect.anything(), expect.objectContaining({ title: 'Old Match' }), ['Node'], 75, 'r-default', expect.anything()
    )
    expect(mockMarkScrapedJobDrafted).toHaveBeenCalledWith('u1', 'backlog1', {
      draftResumeId: 'draft2', postTailorScore: 92, pendingApprovals: [], tailoredKeywords: ['Node'], status: 'queued',
    })
    expect(result.drafted).toBe(1)
  })

  it('leaves a backlog item undrafted (for retry next scan) when the apply pipeline throws', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })
    mockListDraftQueueBacklog.mockResolvedValue([
      { _id: 'backlog1', title: 'Old Match', company: 'Acme', description: 'JD' },
    ])
    mockScoreResume.mockReturnValue({ total: 80, missingKeywords: [] })
    mockRunApplyPipeline.mockRejectedValue(new Error('Anthropic API error'))

    const result = await runScanForProfile('u1', 'p1')

    expect(mockMarkScrapedJobDrafted).not.toHaveBeenCalled()
    expect(result.drafted).toBe(0)
    expect(result.degraded).toBe(false)
  })

  it('queries freehire once per role and merges results, deduping by sourceId', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['Data Analyst', 'Product Analyst'] })
    mockSearchFreehireJobs.mockImplementation((params: { query?: string }) => {
      if (params.query === 'Data Analyst') {
        return Promise.resolve({
          degraded: false,
          postings: [
            { source: 'freehire', sourceId: 'shared', title: 'Data Analyst', company: 'Acme', url: 'https://x/shared', description: 'JD' },
            { source: 'freehire', sourceId: 'da-only', title: 'Data Analyst II', company: 'Acme', url: 'https://x/da-only', description: 'JD' },
          ],
        })
      }
      if (params.query === 'Product Analyst') {
        return Promise.resolve({
          degraded: false,
          postings: [
            { source: 'freehire', sourceId: 'shared', title: 'Product Analyst / Data Analyst', company: 'Acme', url: 'https://x/shared', description: 'JD' },
            { source: 'freehire', sourceId: 'pa-only', title: 'Product Analyst', company: 'Acme', url: 'https://x/pa-only', description: 'JD' },
          ],
        })
      }
      return Promise.resolve({ degraded: false, postings: [] })
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(mockSearchFreehireJobs).toHaveBeenCalledTimes(2)
    expect(mockSearchFreehireJobs).toHaveBeenCalledWith(expect.objectContaining({ query: 'Data Analyst' }))
    expect(mockSearchFreehireJobs).toHaveBeenCalledWith(expect.objectContaining({ query: 'Product Analyst' }))
    expect(result.fetched).toBe(3)
    expect(mockCreateScrapedJobs.mock.calls[0][2]).toHaveLength(3)
    const sourceIds = mockCreateScrapedJobs.mock.calls[0][2].map((j: { sourceId: string }) => j.sourceId).sort()
    expect(sourceIds).toEqual(['da-only', 'pa-only', 'shared'])
  })

  it('caps the number of role queries at MAX_ROLE_QUERIES', async () => {
    mockGetJobSearchProfile.mockResolvedValue({
      ...baseProfile,
      roles: ['Role A', 'Role B', 'Role C', 'Role D', 'Role E', 'Role F', 'Role G'],
    })
    mockSearchFreehireJobs.mockResolvedValue({ degraded: false, postings: [] })

    await runScanForProfile('u1', 'p1')

    expect(mockSearchFreehireJobs).toHaveBeenCalledTimes(MAX_ROLE_QUERIES)
  })

  it('sends no query and makes a single call when the profile has no roles', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: [] })
    mockSearchFreehireJobs.mockResolvedValue({ degraded: false, postings: [] })

    await runScanForProfile('u1', 'p1')

    expect(mockSearchFreehireJobs).toHaveBeenCalledTimes(1)
    expect(mockSearchFreehireJobs).toHaveBeenCalledWith(expect.objectContaining({ query: undefined }))
  })

  it('returns results from the roles whose query succeeded when only some role queries are degraded', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['Data Analyst', 'Product Analyst'] })
    mockSearchFreehireJobs.mockImplementation((params: { query?: string }) => {
      if (params.query === 'Data Analyst') {
        return Promise.resolve({ degraded: true, postings: [], errorMessage: 'freehire returned 503' })
      }
      return Promise.resolve({
        degraded: false,
        postings: [{ source: 'freehire', sourceId: 'pa-1', title: 'Product Analyst', company: 'Acme', url: 'https://x/pa-1', description: 'JD' }],
      })
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.degraded).toBe(false)
    expect(result.fetched).toBe(1)
  })

  it('degrades the whole scan only when every role query fails', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['Data Analyst', 'Product Analyst'] })
    mockSearchFreehireJobs.mockResolvedValue({ degraded: true, postings: [], errorMessage: 'freehire returned 503' })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.degraded).toBe(true)
    expect(result.errorMessage).toBe('freehire returned 503')
    expect(mockCreateScrapedJobs).not.toHaveBeenCalled()
  })

  it('drops a posting whose title is missing one of the queried role\'s significant words, even though freehire returned it', async () => {
    // Regression guard for freehire's own loose q= matching: verified live
    // against the API that q="AI Developer" returns postings containing
    // only one of the two words (e.g. "Senior Backend Developer",
    // "Security Analyst") — freehire's result set can't be trusted as
    // relevant on its own, so the title-word filter below it is load-bearing.
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['AI Developer'] })
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [
        { source: 'freehire', sourceId: 'match', title: 'AI Full-Stack Developer', company: 'Acme', url: 'https://x/match', description: 'JD' },
        { source: 'freehire', sourceId: 'no-ai', title: 'Senior Backend Developer', company: 'Acme', url: 'https://x/no-ai', description: 'JD' },
        { source: 'freehire', sourceId: 'no-developer', title: 'Senior AI Product Manager', company: 'Acme', url: 'https://x/no-developer', description: 'JD' },
      ],
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.fetched).toBe(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2]).toHaveLength(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].sourceId).toBe('match')
  })

  it('gives a posting rejected under one role a fresh chance under a different role in the same scan', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['AI Developer', 'Product Manager'] })
    mockSearchFreehireJobs.mockImplementation((params: { query?: string }) => {
      if (params.query === 'AI Developer') {
        return Promise.resolve({
          degraded: false,
          postings: [
            { source: 'freehire', sourceId: 'pm-1', title: 'Senior AI Product Manager', company: 'Acme', url: 'https://x/pm-1', description: 'JD' },
          ],
        })
      }
      if (params.query === 'Product Manager') {
        return Promise.resolve({
          degraded: false,
          postings: [
            { source: 'freehire', sourceId: 'pm-1', title: 'Senior AI Product Manager', company: 'Acme', url: 'https://x/pm-1', description: 'JD' },
          ],
        })
      }
      return Promise.resolve({ degraded: false, postings: [] })
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.fetched).toBe(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].sourceId).toBe('pm-1')
  })

  it('does not create a ScrapedJob for a posting scored below the profile\'s minAtsScore', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockScoreResume.mockReturnValue({ total: 50, missingKeywords: [] })
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [{ source: 'freehire', sourceId: 'a1', title: 'X', company: 'Y', url: 'https://x/a1', description: 'JD' }],
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.created).toBe(0)
    expect(mockCreateScrapedJobs).not.toHaveBeenCalled()
  })

  it('prunes an existing "new" scraped job whose title no longer matches the profile\'s current roles', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['AI Developer'] })
    mockListNewScrapedJobs.mockResolvedValue([
      { _id: 'stale1', title: 'Senior Backend Engineer', company: 'Acme', description: 'JD', atsScore: 80 },
    ])
    mockDeleteScrapedJobsByIds.mockResolvedValue(1)
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    const result = await runScanForProfile('u1', 'p1')

    expect(mockDeleteScrapedJobsByIds).toHaveBeenCalledWith('u1', ['stale1'])
    expect(result.pruned).toBe(1)
  })

  it('prunes an existing "new" scraped job that no longer clears the profile\'s current threshold', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, minAtsScore: 70 })
    mockListNewScrapedJobs.mockResolvedValue([
      { _id: 'stale1', title: 'X', company: 'Y', description: 'JD', atsScore: 46 },
    ])
    mockDeleteScrapedJobsByIds.mockResolvedValue(1)
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    await runScanForProfile('u1', 'p1')

    expect(mockDeleteScrapedJobsByIds).toHaveBeenCalledWith('u1', ['stale1'])
  })

  it('leaves a "new" scraped job alone when it still matches the profile\'s current roles and threshold', async () => {
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['AI Developer'], minAtsScore: 70 })
    mockListNewScrapedJobs.mockResolvedValue([
      { _id: 'ok1', title: 'AI Developer', company: 'Acme', description: 'JD', atsScore: 80 },
    ])
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    const result = await runScanForProfile('u1', 'p1')

    expect(mockDeleteScrapedJobsByIds).toHaveBeenCalledWith('u1', [])
    expect(result.pruned).toBe(0)
  })

  it('never re-checks a job that is already dismissed, queued, needs_review, or submitted (listNewScrapedJobs only returns "new")', async () => {
    // listNewScrapedJobs is the only read path pruning uses, and it's
    // scoped to status:'new' at the data-access layer — this test locks in
    // that pruning never even sees a non-'new' job, regardless of whether
    // it would otherwise fail the current filters.
    mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, roles: ['AI Developer'] })
    mockListNewScrapedJobs.mockResolvedValue([])
    mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: false })

    await runScanForProfile('u1', 'p1')

    expect(mockListNewScrapedJobs).toHaveBeenCalledWith('u1', 'p1')
    expect(mockDeleteScrapedJobsByIds).toHaveBeenCalledWith('u1', [])
  })

  it('filters below-threshold postings per-posting, not the whole batch', async () => {
    mockGetJobSearchProfile.mockResolvedValue(baseProfile)
    mockScoreResume.mockImplementation((_resume: unknown, description: string) =>
      description === 'low JD' ? { total: 50, missingKeywords: [] } : { total: 90, missingKeywords: [] }
    )
    mockSearchFreehireJobs.mockResolvedValue({
      degraded: false,
      postings: [
        { source: 'freehire', sourceId: 'low', title: 'X', company: 'Y', url: 'https://x/low', description: 'low JD' },
        { source: 'freehire', sourceId: 'high', title: 'X', company: 'Y', url: 'https://x/high', description: 'high JD' },
      ],
    })

    const result = await runScanForProfile('u1', 'p1')

    expect(result.created).toBe(1)
    expect(mockCreateScrapedJobs.mock.calls[0][2][0].sourceId).toBe('high')
  })

  describe('multi-source (freehire + Comeet)', () => {
    const comeetCompany = { name: 'Acme Israel', uid: 'ACM.001', token: 'tok_abc' }

    it('merges postings from both sources into one scan result', async () => {
      mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, comeetCompanies: [comeetCompany] })
      mockSearchFreehireJobs.mockResolvedValue({
        degraded: false,
        postings: [{ source: 'freehire', sourceId: 'fh1', title: 'X', company: 'Y', url: 'https://x/fh1', description: 'd' }],
      })
      mockSearchComeetJobs.mockResolvedValue({
        degraded: false,
        postings: [{ source: 'comeet', sourceId: 'cm1', title: 'X', company: 'Acme', url: 'https://x/cm1', description: 'd' }],
      })

      const result = await runScanForProfile('u1', 'p1')

      expect(result.fetched).toBe(2)
      expect(result.created).toBe(2)
      expect(mockSearchComeetJobs).toHaveBeenCalledWith(comeetCompany)
    })

    it('continues with Comeet postings when freehire is fully degraded', async () => {
      mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, comeetCompanies: [comeetCompany] })
      mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: true, errorMessage: 'freehire returned 503' })
      mockSearchComeetJobs.mockResolvedValue({
        degraded: false,
        postings: [{ source: 'comeet', sourceId: 'cm1', title: 'X', company: 'Acme', url: 'https://x/cm1', description: 'd' }],
      })

      const result = await runScanForProfile('u1', 'p1')

      expect(result.degraded).toBe(false)
      expect(result.created).toBe(1)
      expect(mockCreateScrapedJobs.mock.calls[0][2][0].source).toBe('comeet')
    })

    it('returns degraded only when freehire and every watched Comeet company fail', async () => {
      mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, comeetCompanies: [comeetCompany] })
      mockSearchFreehireJobs.mockResolvedValue({ postings: [], degraded: true, errorMessage: 'freehire returned 503' })
      mockSearchComeetJobs.mockResolvedValue({ postings: [], degraded: true, errorMessage: 'comeet (Acme Israel) returned 401' })

      const result = await runScanForProfile('u1', 'p1')

      expect(result.degraded).toBe(true)
      expect(mockCreateScrapedJobs).not.toHaveBeenCalled()
    })

    it('tolerates one bad Comeet company without blocking others or freehire', async () => {
      const goodCompany = { name: 'Good Co', uid: 'GOOD.1', token: 'tok_good' }
      const badCompany = { name: 'Bad Co', uid: 'BAD.1', token: 'tok_bad' }
      mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, comeetCompanies: [goodCompany, badCompany] })
      mockSearchFreehireJobs.mockResolvedValue({
        degraded: false,
        postings: [{ source: 'freehire', sourceId: 'fh1', title: 'X', company: 'Y', url: 'https://x/fh1', description: 'd' }],
      })
      mockSearchComeetJobs.mockImplementation(async (company: { uid: string }) =>
        company.uid === 'BAD.1'
          ? { postings: [], degraded: true, errorMessage: 'comeet (Bad Co) returned 401' }
          : {
              degraded: false,
              postings: [{ source: 'comeet', sourceId: 'cm-good', title: 'X', company: 'Good Co', url: 'https://x/good', description: 'd' }],
            }
      )

      const result = await runScanForProfile('u1', 'p1')

      expect(result.degraded).toBe(false)
      expect(result.fetched).toBe(2)
      expect(result.created).toBe(2)
    })

    it('dedupes sourceIds independently per source, so identical id strings from different sources are both created', async () => {
      mockGetJobSearchProfile.mockResolvedValue({ ...baseProfile, comeetCompanies: [comeetCompany] })
      mockSearchFreehireJobs.mockResolvedValue({
        degraded: false,
        postings: [{ source: 'freehire', sourceId: '123', title: 'X', company: 'Y', url: 'https://x/fh', description: 'd' }],
      })
      mockSearchComeetJobs.mockResolvedValue({
        degraded: false,
        postings: [{ source: 'comeet', sourceId: '123', title: 'X', company: 'Acme', url: 'https://x/cm', description: 'd' }],
      })
      // Only freehire's '123' is already stored — comeet's own '123' is a distinct job.
      mockFindExistingSourceIds.mockImplementation(async (_u: string, _p: string, source: string) =>
        source === 'freehire' ? new Set(['123']) : new Set()
      )

      const result = await runScanForProfile('u1', 'p1')

      expect(result.skippedExisting).toBe(1)
      expect(result.created).toBe(1)
      expect(mockCreateScrapedJobs.mock.calls[0][2][0].source).toBe('comeet')
    })
  })
})
