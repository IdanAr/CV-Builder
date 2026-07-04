// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePdfPagination } from '@/lib/hooks/use-pdf-pagination'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = ResumeMetaSchema.parse({})
const dataA: ResumeData = { basics: { name: 'A' } }
const dataB: ResumeData = { basics: { name: 'B' } }

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('usePdfPagination', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn(async () => okResponse({ pageCount: 2, anchors: ['anchor text one'] }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not fetch before the debounce delay elapses', async () => {
    renderHook(() => usePdfPagination(dataA, meta))
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches once after the delay and reports synced truth', async () => {
    const { result } = renderHook(() => usePdfPagination(dataA, meta))
    expect(result.current.status).toBe('syncing')
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {}) // flush the fetch promise
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ status: 'synced', pageCount: 2, anchors: ['anchor text one'] })
  })

  it('flips back to syncing when the data changes after a sync', async () => {
    const { result, rerender } = renderHook(({ d }) => usePdfPagination(d, meta), {
      initialProps: { d: dataA },
    })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {})
    expect(result.current.status).toBe('synced')

    rerender({ d: dataB })
    expect(result.current.status).toBe('syncing')
  })

  it('aborts the in-flight request when the payload changes', async () => {
    let firstSignal: AbortSignal | undefined
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      if (!firstSignal) {
        firstSignal = init.signal as AbortSignal
        return new Promise<Response>(() => {}) // never resolves
      }
      return okResponse({ pageCount: 5, anchors: [] })
    })

    const { rerender } = renderHook(({ d }) => usePdfPagination(d, meta), {
      initialProps: { d: dataA },
    })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(firstSignal!.aborted).toBe(false)

    rerender({ d: dataB })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    expect(firstSignal!.aborted).toBe(true)
  })

  it('reports error status on a failed response without clearing prior truth', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ pageCount: 2, anchors: ['anchor text one'] }))
    const { result, rerender } = renderHook(({ d }) => usePdfPagination(d, meta), {
      initialProps: { d: dataA },
    })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {})
    expect(result.current.status).toBe('synced')

    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 429 }))
    rerender({ d: dataB })
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })
    await act(async () => {})
    expect(result.current.status).toBe('error')
    expect(result.current.pageCount).toBe(2)
  })
})
