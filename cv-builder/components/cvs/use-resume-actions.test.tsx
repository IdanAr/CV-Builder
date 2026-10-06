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
    expect(result.current.duplicating).toBe(false)
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

  it('reports duplicating while a duplicate is in flight', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolveFetch = r })))
    const { result } = renderHook(() => useResumeActions(args))
    let p: Promise<void> = Promise.resolve()
    act(() => { p = result.current.duplicate() })
    await waitFor(() => expect(result.current.duplicating).toBe(true))
    await act(async () => { resolveFetch({ ok: true }); await p })
    expect(result.current.duplicating).toBe(false)
  })

  it('shows an error toast and does not navigate when tracking fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { result } = renderHook(() => useResumeActions(args))
    await act(async () => { await result.current.track() })
    expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('shows an error toast when duplicate fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { result } = renderHook(() => useResumeActions(args))
    await act(async () => { await result.current.duplicate() })
    expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
    expect(routerRefresh).not.toHaveBeenCalled()
  })

  it('shows an error toast when the JSON download fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { result } = renderHook(() => useResumeActions(args))
    await act(async () => { await result.current.download() })
    expect(useToastStore.getState().toasts.some((t) => t.variant === 'error')).toBe(true)
  })

  it('reports downloading while in flight and ignores a second download() call', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    const fetchMock = vi.fn(() => new Promise((r) => { resolveFetch = r }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { result } = renderHook(() => useResumeActions(args))
    let first: Promise<void> = Promise.resolve()
    act(() => { first = result.current.download() })
    await waitFor(() => expect(result.current.downloading).toBe(true))
    await act(async () => { await result.current.download() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ resume: { data: {} } }) })
      await first
    })
    expect(result.current.downloading).toBe(false)
  })
})
