// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { usePipelineActions, UNDO_DELETE_DURATION } from './use-pipeline-actions'
import { useToastStore } from '@/lib/stores/toast.store'
import { useScrapedJobsSync } from '@/lib/stores/scraped-jobs.store'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'

function job(over: Partial<PipelineJob> = {}): PipelineJob {
  return {
    _id: 'j1', profileId: 'p1', title: 'Engineer', company: 'Acme', url: 'https://x/j1',
    matchedRules: [], pendingApprovals: [], tailoredKeywords: [],
    status: 'matched', stage: 'matched', createdAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}

const ok = (body: unknown = {}) => ({ ok: true, json: async () => body }) as Response
const bad = (body: unknown = {}) => ({ ok: false, json: async () => body }) as Response

let fetchMock: ReturnType<typeof vi.fn>
let deps: {
  removeLocal: Mock<(id: string) => void>
  reload: Mock<() => Promise<void>>
  navigate: Mock<(href: string) => void>
}

const revision = () => useScrapedJobsSync.getState().revision
const toasts = () => useToastStore.getState().toasts
const calls = (method: string) => fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === method)

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  deps = {
    removeLocal: vi.fn<(id: string) => void>(),
    reload: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    navigate: vi.fn<(href: string) => void>(),
  }
  fetchMock.mockResolvedValue(ok())
  useToastStore.setState({ toasts: [] })
  useScrapedJobsSync.setState({ revision: 0 })
})
afterEach(() => {
  // Unmount while fetch is still stubbed: pending deletes flush on unmount.
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('usePipelineActions', () => {
  it('dismiss hides first, PATCHes, notifies and offers a working Undo', async () => {
    fetchMock.mockResolvedValue(ok())
    const { result } = renderHook(() => usePipelineActions(deps))
    await act(async () => { await result.current.dismiss(job()) })
    expect(deps.removeLocal).toHaveBeenCalledWith('j1')
    expect(fetchMock).toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ dismissed: true }),
    }))
    expect(revision()).toBe(1)
    const t = toasts()[0]
    expect(t.message).toBe('Dismissed "Engineer"')
    expect(t.actionLabel).toBe('Undo')
    await act(async () => { t.onAction!() })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/jobsearch/scraped-jobs/j1', expect.objectContaining({
      body: JSON.stringify({ dismissed: false }),
    }))
    expect(revision()).toBe(2)
  })

  it('dismiss failure reloads and sets the error; undo failure toasts', async () => {
    fetchMock.mockResolvedValue(bad())
    const { result } = renderHook(() => usePipelineActions(deps))
    await act(async () => { await result.current.dismiss(job()) })
    expect(deps.reload).toHaveBeenCalled()
    expect(result.current.error).toBe('Failed to dismiss the posting. Please try again.')
    expect(result.current.busyId).toBeNull()
    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })

  it('restoreDismissed PATCHes dismissed:false and notifies; failure sets error', async () => {
    fetchMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(bad())
    const { result } = renderHook(() => usePipelineActions(deps))
    await act(async () => { await result.current.restoreDismissed(job()) })
    expect(revision()).toBe(1)
    await act(async () => { await result.current.restoreDismissed(job()) })
    expect(result.current.error).toBe('Failed to update the listing. Please try again.')
  })

  it('remove does not DELETE before 6000ms, then DELETEs once and notifies', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(ok())
    const { result } = renderHook(() => usePipelineActions(deps))
    act(() => result.current.remove(job()))
    expect(deps.removeLocal).toHaveBeenCalledWith('j1')
    await act(async () => { vi.advanceTimersByTime(UNDO_DELETE_DURATION - 1) })
    expect(calls('DELETE')).toHaveLength(0)
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(calls('DELETE')).toHaveLength(1)
    expect(revision()).toBe(1)
    expect(toasts()).toHaveLength(0)
  })

  it('Undo before the window clears the timer and reloads', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(ok())
    const { result } = renderHook(() => usePipelineActions(deps))
    act(() => result.current.remove(job()))
    act(() => { toasts()[0].onAction!() })
    expect(deps.reload).toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(UNDO_DELETE_DURATION * 2) })
    expect(calls('DELETE')).toHaveLength(0)
  })

  it('remove toast mentions the tailored résumé only with draftResumeId', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => usePipelineActions(deps))
    act(() => result.current.remove(job()))
    act(() => result.current.remove(job({ _id: 'j2', draftResumeId: 'r1' })))
    expect(toasts()[0].message).toBe('Deleted "Engineer"')
    expect(toasts()[1].message).toBe('Deleted "Engineer" and its tailored résumé')
  })

  it('unmount sends a pending DELETE immediately', () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(ok())
    const { result, unmount } = renderHook(() => usePipelineActions(deps))
    act(() => result.current.remove(job()))
    expect(calls('DELETE')).toHaveLength(0)
    unmount()
    expect(calls('DELETE')).toHaveLength(1)
    vi.advanceTimersByTime(UNDO_DELETE_DURATION * 2)
    expect(calls('DELETE')).toHaveLength(1)
  })

  it('remove commit failure toasts the restore message and reloads', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(bad())
    const { result } = renderHook(() => usePipelineActions(deps))
    act(() => result.current.remove(job()))
    await act(async () => { vi.advanceTimersByTime(UNDO_DELETE_DURATION) })
    expect(toasts().some((t) => t.message === 'Could not delete "Engineer". It has been restored.')).toBe(true)
    expect(deps.reload).toHaveBeenCalled()
  })

  it('findAgain PATCHes deleted:false, notifies, toasts success', async () => {
    fetchMock.mockResolvedValue(ok())
    const { result } = renderHook(() => usePipelineActions(deps))
    await act(async () => { await result.current.findAgain(job()) })
    expect(fetchMock).toHaveBeenCalledWith('/api/jobsearch/scraped-jobs/j1', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ deleted: false }),
    }))
    expect(revision()).toBe(1)
    expect(toasts()[0].message).toBe('"Engineer" will be picked up by the next scan.')
    fetchMock.mockResolvedValue(bad())
    await act(async () => { await result.current.findAgain(job()) })
    expect(result.current.error).toBe('Could not restore the listing. Please try again.')
  })

  it('approve and markApplied notify on success and surface errors', async () => {
    const { result } = renderHook(() => usePipelineActions(deps))
    fetchMock.mockResolvedValue(ok())
    await act(async () => { await result.current.approve(job()) })
    await act(async () => { await result.current.markApplied(job()) })
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/jobsearch/scraped-jobs/j1/approve', '/api/jobsearch/scraped-jobs/j1/convert',
    ])
    expect(revision()).toBe(2)
    fetchMock.mockResolvedValue(bad({ error: 'Nope' }))
    await act(async () => { await result.current.approve(job()) })
    expect(result.current.error).toBe('Nope')
    fetchMock.mockResolvedValue(bad())
    await act(async () => { await result.current.approve(job()) })
    expect(result.current.error).toBe('Failed to approve the flagged claims.')
    await act(async () => { await result.current.markApplied(job()) })
    expect(result.current.error).toBe('Failed to mark as applied.')
  })

  it('reloads the list when approve or convert fails, since the row is stale', async () => {
    const { result } = renderHook(() => usePipelineActions(deps))
    fetchMock.mockResolvedValue(bad({ error: 'Conflict' }))
    await act(async () => { await result.current.approve(job()) })
    expect(result.current.error).toBe('Conflict')
    expect(deps.reload).toHaveBeenCalledTimes(1)
    await act(async () => { await result.current.markApplied(job()) })
    expect(deps.reload).toHaveBeenCalledTimes(2)
    fetchMock.mockResolvedValue(ok())
    await act(async () => { await result.current.approve(job()) })
    expect(deps.reload).toHaveBeenCalledTimes(2)
  })

  it('track POSTs, toasts a View action and does not navigate itself', async () => {
    fetchMock.mockResolvedValue(ok())
    const { result } = renderHook(() => usePipelineActions(deps))
    await act(async () => { await result.current.track(job()) })
    expect(fetchMock).toHaveBeenCalledWith('/api/applications', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ company: 'Acme', role: 'Engineer' }),
    }))
    expect(deps.navigate).not.toHaveBeenCalled()
    const t = toasts()[0]
    expect(t.message).toBe('Now tracking "Engineer"')
    expect(t.actionLabel).toBe('View')
    act(() => t.onAction!())
    expect(deps.navigate).toHaveBeenCalledWith('/dashboard/applications')
    fetchMock.mockResolvedValue(bad())
    await act(async () => { await result.current.track(job()) })
    expect(result.current.error).toBe('Could not start tracking "Engineer". Please try again.')
  })

  it('run dispatches navigation actions', () => {
    const { result } = renderHook(() => usePipelineActions(deps))
    act(() => result.current.run('open-cv', job({ draftResumeId: 'r9' })))
    expect(deps.navigate).toHaveBeenCalledWith('/dashboard/resumes/r9')
    act(() => result.current.run('open-applications', job()))
    expect(deps.navigate).toHaveBeenLastCalledWith('/dashboard/applications')
  })
})
