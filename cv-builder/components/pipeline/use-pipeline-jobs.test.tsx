// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePipelineJobs, type PipelineInitial } from './use-pipeline-jobs'
import { useScrapedJobsSync, notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'
import type { PipelineJob, PipelineCountsDto } from '@/lib/jobsearch/pipeline-types'

function job(id: string, over: Partial<PipelineJob> = {}): PipelineJob {
  return {
    _id: id,
    profileId: 'p1',
    title: `Job ${id}`,
    company: 'Acme',
    url: `https://x/${id}`,
    matchedRules: [],
    pendingApprovals: [],
    tailoredKeywords: [],
    status: 'matched',
    stage: 'matched',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const COUNTS: PipelineCountsDto = {
  found: 1, matched: 2, drafted: 0, ready: 0, applied: 0, archive: 0, matchedUnread: 1, waiting: 1,
}

type Page = { items: PipelineJob[]; nextCursor: string | null; counts: PipelineCountsDto }
const page = (items: PipelineJob[], nextCursor: string | null = null, counts = COUNTS): Page => ({
  items, nextCursor, counts,
})
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const bad = () => ({ ok: false, json: async () => ({}) }) as Response

let fetchMock: ReturnType<typeof vi.fn>

function view(over: Partial<{ stage: 'found' | 'matched' | 'drafted'; profile: string | null; q: string }> = {}) {
  return { stage: 'found' as 'found' | 'matched' | 'drafted', profile: null as string | null, q: '', ...over }
}

beforeEach(() => {
  useScrapedJobsSync.setState({ revision: 0 })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function urlsOf(prefix = '/api/jobsearch/scraped-jobs?') {
  return fetchMock.mock.calls.map((c) => c[0] as string).filter((u) => u.startsWith(prefix))
}

function defer(): { promise: Promise<Response>; resolve(r: Response): void } {
  let resolve!: (r: Response) => void
  const promise = new Promise<Response>((r) => { resolve = r })
  return { promise, resolve }
}

describe('usePipelineJobs', () => {
  it('uses initial data without fetching when the view matches', () => {
    const initial: PipelineInitial = { view: view(), items: [job('a')], nextCursor: 'c1', counts: COUNTS }
    const { result } = renderHook(() => usePipelineJobs(view(), initial))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('ready')
    expect(result.current.items.map((j) => j._id)).toEqual(['a'])
    expect(result.current.counts).toEqual(COUNTS)
    expect(result.current.nextCursor).toBe('c1')
  })

  it('fetches without initial, going loading -> ready, omitting empty params', async () => {
    fetchMock.mockResolvedValue(ok(page([job('a')])))
    const { result } = renderHook(() => usePipelineJobs(view({ stage: 'found' })))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/jobsearch/scraped-jobs?stage=found')
    expect(result.current.items).toHaveLength(1)
  })

  it('includes profileId and trimmed q when set', async () => {
    fetchMock.mockResolvedValue(ok(page([])))
    renderHook(() => usePipelineJobs(view({ profile: 'p9', q: ' react ' })))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/jobsearch/scraped-jobs?stage=found&profileId=p9&q=react')
  })

  it('aborts the in-flight request on view change and ignores the stale response', async () => {
    const first = defer()
    const signals: AbortSignal[] = []
    fetchMock.mockImplementationOnce((_u: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal)
      return first.promise
    })
    fetchMock.mockResolvedValueOnce(ok(page([job('new')])))
    const { result, rerender } = renderHook(({ v }) => usePipelineJobs(v), { initialProps: { v: view() } })
    rerender({ v: view({ stage: 'drafted' }) })
    expect(signals[0].aborted).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => { first.resolve(ok(page([job('stale')]))) })
    expect(result.current.items.map((j) => j._id)).toEqual(['new'])
    expect(urlsOf()[1]).toBe('/api/jobsearch/scraped-jobs?stage=drafted')
  })

  it('resets to loading when the view changes', async () => {
    fetchMock.mockResolvedValueOnce(ok(page([job('a')])))
    const next = defer()
    fetchMock.mockReturnValueOnce(next.promise)
    const { result, rerender } = renderHook(({ v }) => usePipelineJobs(v), { initialProps: { v: view() } })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ v: view({ q: 'zzz' }) })
    expect(result.current.status).toBe('loading')
    expect(result.current.items).toEqual([])
    await act(async () => { next.resolve(ok(page([job('b')]))) })
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('loadMore appends without duplicates and updates the cursor', async () => {
    fetchMock.mockResolvedValueOnce(ok(page([job('a'), job('b')], 'c1')))
    fetchMock.mockResolvedValueOnce(ok(page([job('b'), job('c')], null)))
    const { result } = renderHook(() => usePipelineJobs(view()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => { await result.current.loadMore() })
    expect(urlsOf()[1]).toBe('/api/jobsearch/scraped-jobs?stage=found&cursor=c1')
    expect(result.current.items.map((j) => j._id)).toEqual(['a', 'b', 'c'])
    expect(result.current.nextCursor).toBeNull()
    expect(result.current.loadingMore).toBe(false)
  })

  it('loadMore is a no-op without a cursor or while already loading more', async () => {
    fetchMock.mockResolvedValueOnce(ok(page([job('a')], null)))
    const { result } = renderHook(() => usePipelineJobs(view()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => { await result.current.loadMore() })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const more = defer()
    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(ok(page([job('a')], 'c1')))
    const r2 = renderHook(() => usePipelineJobs(view({ stage: 'drafted' })))
    await waitFor(() => expect(r2.result.current.status).toBe('ready'))
    fetchMock.mockReturnValueOnce(more.promise)
    let p1!: Promise<void>
    act(() => { p1 = r2.result.current.loadMore() })
    expect(r2.result.current.loadingMore).toBe(true)
    await act(async () => { await r2.result.current.loadMore() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { more.resolve(ok(page([job('z')], null))); await p1 })
    expect(r2.result.current.items.map((j) => j._id)).toEqual(['a', 'z'])
  })

  it('re-reads page 1 on a revision change without full loading and not at mount', async () => {
    useScrapedJobsSync.setState({ revision: 5 })
    fetchMock.mockResolvedValueOnce(ok(page([job('a')], 'c1')))
    const { result } = renderHook(() => usePipelineJobs(view()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const refresh = defer()
    fetchMock.mockReturnValueOnce(refresh.promise)
    act(() => { notifyScrapedJobsChanged() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
    expect(result.current.items).toHaveLength(1)
    const newCounts = { ...COUNTS, found: 9 }
    await act(async () => { refresh.resolve(ok(page([job('a'), job('n')], null, newCounts))) })
    expect(result.current.items.map((j) => j._id)).toEqual(['a', 'n'])
    expect(result.current.counts?.found).toBe(9)
    expect(result.current.nextCursor).toBeNull()
  })

  it('does not fetch at mount just because the revision is non-zero (initial data)', () => {
    useScrapedJobsSync.setState({ revision: 3 })
    const initial: PipelineInitial = { view: view(), items: [], nextCursor: null, counts: COUNTS }
    renderHook(() => usePipelineJobs(view(), initial))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('snapshots unread ids and fires mark-read once for the matched stage', async () => {
    fetchMock.mockImplementation(async (u: string) => {
      if (u.startsWith('/api/jobsearch/notifications/mark-read')) return ok({})
      return ok(page([job('a', { status: 'new' }), job('b', { status: 'matched' })]))
    })
    const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched', profile: 'p1' })))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect([...result.current.unreadIds]).toEqual(['a'])
    const markCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('mark-read'))
    await waitFor(() => expect(markCalls()).toHaveLength(1))
    expect(markCalls()[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ profileId: 'p1' }) })
    // notifyScrapedJobsChanged() after mark-read bumps the revision
    await waitFor(() => expect(useScrapedJobsSync.getState().revision).toBe(1))
    // the resulting revision reload keeps the snapshot and does not mark read again
    await waitFor(() => expect(urlsOf()).toHaveLength(2))
    await act(async () => {})
    expect([...result.current.unreadIds]).toEqual(['a'])
    expect(markCalls()).toHaveLength(1)
  })

  it('sends an empty body without a profile filter and skips mark-read for other stages or no unread', async () => {
    fetchMock.mockImplementation(async (u: string) =>
      u.includes('mark-read') ? ok({}) : ok(page([job('a', { status: 'new' })])))
    const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched' })))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() =>
      expect(fetchMock.mock.calls.find((c) => String(c[0]).includes('mark-read'))?.[1].body).toBe('{}'))

    fetchMock.mockClear()
    const other = renderHook(() => usePipelineJobs(view({ stage: 'drafted' })))
    await waitFor(() => expect(other.result.current.status).toBe('ready'))
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('mark-read'))).toBe(false)
  })

  it('removeLocal drops the row immediately', async () => {
    fetchMock.mockResolvedValueOnce(ok(page([job('a'), job('b')])))
    const { result } = renderHook(() => usePipelineJobs(view()))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => { result.current.removeLocal('a') })
    expect(result.current.items.map((j) => j._id)).toEqual(['b'])
    expect(result.current.counts).toEqual(COUNTS)
  })

  it('reports an error when nothing is loaded, and keeps items on a failed reload', async () => {
    fetchMock.mockResolvedValueOnce(bad())
    const { result } = renderHook(() => usePipelineJobs(view()))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Failed to load jobs.')

    fetchMock.mockResolvedValueOnce(ok(page([job('a')])))
    await act(async () => { await result.current.reload() })
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toBeNull()

    fetchMock.mockResolvedValueOnce(bad())
    await act(async () => { await result.current.reload() })
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toBe('Failed to load jobs.')
    expect(result.current.items).toHaveLength(1)
  })

  it('does not get stuck loading when the view goes A -> B -> A', async () => {
    fetchMock.mockResolvedValueOnce(ok(page([job('a')])))
    const b = defer()
    fetchMock.mockReturnValueOnce(b.promise)
    fetchMock.mockResolvedValueOnce(ok(page([job('a')])))
    const { result, rerender } = renderHook(({ v }) => usePipelineJobs(v), { initialProps: { v: view({ q: 'ab' }) } })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ v: view({ q: 'abc' }) })
    rerender({ v: view({ q: 'ab' }) })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.items.map((j) => j._id)).toEqual(['a'])
    await act(async () => { b.resolve(ok(page([job('stale')]))) })
    expect(result.current.items.map((j) => j._id)).toEqual(['a'])
  })

  it('applies a pending view load (snapshot + mark-read) when a revision tick lands meanwhile', async () => {
    const pending = defer()
    fetchMock.mockImplementation((u: string) =>
      u.includes('mark-read') ? Promise.resolve(ok({})) : pending.promise)
    const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched' })))
    act(() => { notifyScrapedJobsChanged() })
    await act(async () => { pending.resolve(ok(page([job('a', { status: 'new' })]))) })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.items.map((j) => j._id)).toEqual(['a'])
    expect([...result.current.unreadIds]).toEqual(['a'])
    const marks = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('mark-read'))
    await waitFor(() => expect(marks()).toHaveLength(1))
    await act(async () => {})
    expect(marks()).toHaveLength(1)
  })

  it('seeded matched view snapshots unread ids from initial and POSTs mark-read once, no data fetch', async () => {
    fetchMock.mockResolvedValue(ok({}))
    const initial: PipelineInitial = {
      view: view({ stage: 'matched' }),
      items: [job('a', { status: 'new' }), job('b')],
      nextCursor: null,
      counts: COUNTS,
    }
    const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched' }), initial))
    expect([...result.current.unreadIds]).toEqual(['a'])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/jobsearch/notifications/mark-read')
    await waitFor(() => expect(useScrapedJobsSync.getState().revision).toBe(1))
    await act(async () => {})
    // no mount fetch: the only data fetch is the revision reload after mark-read
    expect(urlsOf()).toHaveLength(1)
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('mark-read'))).toHaveLength(1)
  })

  describe('unread badge gating', () => {
    const markCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('mark-read'))

    it('marks read from counts.matchedUnread even when page 1 has no new rows', async () => {
      const counts = { ...COUNTS, matchedUnread: 3 }
      fetchMock.mockImplementation(async (u: string) =>
        u.includes('mark-read') ? ok({}) : ok(page([job('a', { status: 'notified' })], 'c1', counts)))
      const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched' })))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      await waitFor(() => expect(markCalls()).toHaveLength(1))
      expect(markCalls()[0][1].body).toBe('{}')
      expect([...result.current.unreadIds]).toEqual([])
      await act(async () => {})
      expect(markCalls()).toHaveLength(1)
    })

    it('does not mark read when counts report no unread, even if a row says new', async () => {
      const counts = { ...COUNTS, matchedUnread: 0 }
      fetchMock.mockImplementation(async (u: string) =>
        u.includes('mark-read') ? ok({}) : ok(page([job('a', { status: 'new' })], null, counts)))
      const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched' })))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      await act(async () => {})
      expect(markCalls()).toHaveLength(0)
    })

    it('seeded view marks read from initial counts without new rows on page 1, and not when zero', async () => {
      fetchMock.mockResolvedValue(ok({}))
      const seed = (matchedUnread: number): PipelineInitial => ({
        view: view({ stage: 'matched' }),
        items: [job('a', { status: 'notified' })],
        nextCursor: 'c1',
        counts: { ...COUNTS, matchedUnread },
      })
      renderHook(() => usePipelineJobs(view({ stage: 'matched' }), seed(3)))
      await waitFor(() => expect(markCalls()).toHaveLength(1))
      fetchMock.mockClear()
      renderHook(() => usePipelineJobs(view({ stage: 'matched' }), seed(0)))
      await act(async () => {})
      expect(markCalls()).toHaveLength(0)
    })
  })

  describe('refresh keeps loaded pages', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => job(`r${i}`))

    it('a revision tick requests as many rows as are loaded, between 30 and 50', async () => {
      fetchMock.mockResolvedValue(ok(page([])))
      const seed = (n: number): PipelineInitial => ({ view: view(), items: rows(n), nextCursor: null, counts: COUNTS })
      const first = renderHook(() => usePipelineJobs(view(), seed(45)))
      act(() => { notifyScrapedJobsChanged() })
      await waitFor(() => expect(urlsOf()).toHaveLength(1))
      expect(urlsOf()[0]).toBe('/api/jobsearch/scraped-jobs?stage=found&limit=45')
      first.unmount()

      fetchMock.mockClear()
      const second = renderHook(() => usePipelineJobs(view(), seed(3)))
      act(() => { notifyScrapedJobsChanged() })
      await waitFor(() => expect(urlsOf().length).toBeGreaterThan(0))
      expect(urlsOf().every((u) => u.endsWith('limit=30'))).toBe(true)
      second.unmount()

      fetchMock.mockClear()
      renderHook(() => usePipelineJobs(view(), seed(80)))
      act(() => { notifyScrapedJobsChanged() })
      await waitFor(() => expect(urlsOf().length).toBeGreaterThan(0))
      expect(urlsOf().every((u) => u.endsWith('limit=50'))).toBe(true)
    })

    it('reload() also requests the loaded size', async () => {
      fetchMock.mockResolvedValue(ok(page([])))
      const initial: PipelineInitial = { view: view(), items: rows(40), nextCursor: null, counts: COUNTS }
      const { result } = renderHook(() => usePipelineJobs(view(), initial))
      await act(async () => { await result.current.reload() })
      expect(urlsOf()[0]).toBe('/api/jobsearch/scraped-jobs?stage=found&limit=40')
    })

    it('replays a tick that arrived during a pending view load, without marking read again', async () => {
      const pending = defer()
      const counts = { ...COUNTS, matchedUnread: 1 }
      let dataCalls = 0
      fetchMock.mockImplementation((u: string) => {
        if (u.includes('mark-read')) return Promise.resolve(ok({}))
        dataCalls++
        return dataCalls === 1 ? pending.promise : Promise.resolve(ok(page([job('a'), job('n')], null, counts)))
      })
      const { result } = renderHook(() => usePipelineJobs(view({ stage: 'matched' })))
      act(() => { notifyScrapedJobsChanged() })
      expect(dataCalls).toBe(1)
      await act(async () => { pending.resolve(ok(page([job('a', { status: 'new' })], null, counts))) })
      await waitFor(() => expect(dataCalls).toBeGreaterThanOrEqual(2))
      await waitFor(() => expect(result.current.items.map((j) => j._id)).toEqual(['a', 'n']))
      await act(async () => {})
      expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('mark-read'))).toHaveLength(1)
    })
  })
})
