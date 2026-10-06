// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, screen, fireEvent, act } from '@testing-library/react'
import { useCvDeletion } from './use-cv-deletion'
import { useToastStore } from '@/lib/stores/toast.store'
import { Toaster } from '@/components/ui/Toaster'

const routerPush = vi.fn()
const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: routerPush }),
}))

const ID = 'abc123'
const TITLE = 'My Resume'

describe('useCvDeletion', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requestDelete() hides immediately and only calls DELETE after the 6s undo window', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useCvDeletion())
    act(() => { result.current.requestDelete(ID, TITLE) })
    expect(result.current.isHidden(ID)).toBe(true)
    expect(useToastStore.getState().toasts[0].message).toBe('Deleted "My Resume"')
    await act(async () => { vi.advanceTimersByTime(5900) })
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123', { method: 'DELETE' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(routerRefresh).toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('undo restores the row without calling DELETE', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useCvDeletion())
    act(() => { result.current.requestDelete(ID, TITLE) })
    act(() => { useToastStore.getState().toasts[0].onAction!() })
    expect(result.current.isHidden(ID)).toBe(false)
    await act(async () => { vi.advanceTimersByTime(7000) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('unmounting with a pending delete fires DELETE immediately and drops the undo toast', () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { result, unmount } = renderHook(() => useCvDeletion())
    act(() => { result.current.requestDelete(ID, TITLE) })
    expect(fetchMock).not.toHaveBeenCalled()
    unmount()
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123', { method: 'DELETE' })
    expect(useToastStore.getState().toasts).toHaveLength(0)
    vi.advanceTimersByTime(7000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('restores the row and shows an error toast when DELETE fails', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { result } = renderHook(() => useCvDeletion())
    act(() => { result.current.requestDelete(ID, TITLE) })
    await act(async () => { vi.advanceTimersByTime(6100) })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(result.current.isHidden(ID)).toBe(false)
    const error = useToastStore.getState().toasts.find((t) => t.variant === 'error')
    expect(error?.message).toBe('Could not delete "My Resume". It has been restored.')
  })

  it('ignores a second request for a CV that is already pending', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useCvDeletion())
    act(() => { result.current.requestDelete(ID, TITLE) })
    act(() => { result.current.requestDelete(ID, TITLE) })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    await act(async () => { vi.advanceTimersByTime(6100) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('undo countdown pause on the toast', () => {
    function Harness() {
      const { requestDelete } = useCvDeletion()
      return (
        <>
          <button onClick={() => requestDelete(ID, TITLE)}>remove</button>
          <Toaster />
        </>
      )
    }

    async function startDeleteAndRunDown(fetchMock: ReturnType<typeof vi.fn>) {
      vi.useFakeTimers()
      vi.stubGlobal('fetch', fetchMock)
      render(<Harness />)
      fireEvent.click(screen.getByText('remove'))
      // 4s of the 6s window elapse, leaving 2s.
      await act(async () => { vi.advanceTimersByTime(4000) })
    }

    it('pauses while the toast is hovered and resumes with the remaining time, not a full reset', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      await startDeleteAndRunDown(fetchMock)
      const toastEl = screen.getByText('Deleted "My Resume"').parentElement!
      fireEvent.mouseEnter(toastEl)
      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(fetchMock).not.toHaveBeenCalled()
      fireEvent.mouseLeave(toastEl)
      await act(async () => { vi.advanceTimersByTime(2100) })
      expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123', { method: 'DELETE' })
    })

    it('pauses while the toast has focus', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      await startDeleteAndRunDown(fetchMock)
      const dismiss = screen.getByRole('button', { name: 'Dismiss notification' })
      fireEvent.focus(dismiss)
      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(fetchMock).not.toHaveBeenCalled()
      fireEvent.blur(dismiss)
      await act(async () => { vi.advanceTimersByTime(2100) })
      expect(fetchMock).toHaveBeenCalledWith('/api/resumes/abc123', { method: 'DELETE' })
    })
  })
})
