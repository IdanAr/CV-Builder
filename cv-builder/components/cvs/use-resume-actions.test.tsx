// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useResumeActions } from './use-resume-actions'
import { useToastStore } from '@/lib/stores/toast.store'

const routerPush = vi.fn()
const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: routerPush }),
}))

const args = { id: 'abc123', title: 'My Resume' }

describe('useResumeActions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('track() posts the resume id to /api/applications then navigates to the board', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useResumeActions(args))
    await act(async () => { await result.current.track() })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ resumeId: 'abc123' }) })
    )
    expect(routerPush).toHaveBeenCalledWith('/dashboard/applications')
  })

  it('duplicate() posts to the duplicate endpoint then refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useResumeActions(args))
    await act(async () => { await result.current.duplicate() })
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123/duplicate', { method: 'POST' })
    expect(routerRefresh).toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  it('download() fetches the resume', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resume: { data: {} } }) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { result } = renderHook(() => useResumeActions(args))
    await act(async () => { await result.current.download() })
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123')
  })

  it('reports busy while a duplicate is in flight', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolveFetch = r })))
    const { result } = renderHook(() => useResumeActions(args))
    let p: Promise<void> = Promise.resolve()
    act(() => { p = result.current.duplicate() })
    await waitFor(() => expect(result.current.busy).toBe(true))
    await act(async () => { resolveFetch({ ok: true }); await p })
    expect(result.current.busy).toBe(false)
  })

  it('remove() hides immediately and only calls DELETE after the 6s undo window', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useResumeActions(args))
    act(() => { result.current.remove() })
    expect(result.current.hidden).toBe(true)
    expect(useToastStore.getState().toasts[0].message).toBe('Deleted "My Resume"')
    await act(async () => { vi.advanceTimersByTime(5900) })
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123', { method: 'DELETE' })
  })

  it('undo restores the row without calling DELETE', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useResumeActions(args))
    act(() => { result.current.remove() })
    act(() => { useToastStore.getState().toasts[0].onAction!() })
    expect(result.current.hidden).toBe(false)
    await act(async () => { vi.advanceTimersByTime(7000) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('unmounting with a pending delete fires DELETE immediately', () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { result, unmount } = renderHook(() => useResumeActions(args))
    act(() => { result.current.remove() })
    expect(fetchMock).not.toHaveBeenCalled()
    unmount()
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123', { method: 'DELETE' })
  })
})
