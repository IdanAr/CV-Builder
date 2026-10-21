// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCoverLetters } from './use-cover-letters'
import type { CoverLetterView } from '@/lib/api/cover-letters'

const BASE = '/api/resumes/r1/cover-letters'

function letter(id: string, over: Partial<CoverLetterView> = {}): CoverLetterView {
  return {
    id,
    userId: 'u1',
    resumeId: 'r1',
    company: 'Acme',
    role: 'Engineer',
    notes: {},
    content: `Letter ${id}`,
    pendingApprovals: [],
    notices: [],
    language: 'en',
    status: 'ready',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const listBody = (letters: CoverLetterView[] = [], over: Record<string, unknown> = {}) => ({
  letters,
  notes: {},
  suggestedPosting: null,
  ...over,
})

let fetchMock: ReturnType<typeof vi.fn>

/** Calls to fetch matching a method and url, e.g. calls('PATCH', `${BASE}/l1`). */
function calls(method: string, url: string) {
  return fetchMock.mock.calls.filter(
    (c) => c[0] === url && ((c[1] as RequestInit | undefined)?.method ?? 'GET') === method
  )
}
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string)

/** Routes fetch by method + url; anything unmatched is a 500 so a missing route shows up. */
function route(handlers: Record<string, () => Response | Promise<Response>>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const handler = handlers[key]
    return handler ? handler() : json({ error: `unrouted ${key}` }, 500)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(resumeId: string | null = 'r1') {
  const hook = renderHook(({ id }) => useCoverLetters(id), { initialProps: { id: resumeId } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
  return hook
}

describe('useCoverLetters', () => {
  it('loads the list, prefill notes and suggested posting on mount', async () => {
    const posting = { company: 'Beta', role: 'Dev', jobText: 'text', scrapedJobId: 's1' }
    route({
      [`GET ${BASE}`]: () =>
        json(listBody([letter('l1')], { notes: { motivation: 'Loves it' }, suggestedPosting: posting })),
    })
    const { result } = await mount()
    expect(result.current.loading).toBe(false)
    expect(result.current.letters.map((l) => l.id)).toEqual(['l1'])
    expect(result.current.prefillNotes).toEqual({ motivation: 'Loves it' })
    expect(result.current.suggestedPosting).toEqual(posting)
    expect(result.current.error).toBeNull()
  })

  it('makes no requests and is not loading when resumeId is null', async () => {
    const { result } = await mount(null)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.letters).toEqual([])
    expect(result.current.suggestedPosting).toBeNull()
  })

  it('surfaces a failed list load as an error', async () => {
    route({ [`GET ${BASE}`]: () => json({ error: 'Not found', code: 'NOT_FOUND' }, 404) })
    const { result } = await mount()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Not found')
  })

  it('create adds a writing letter, polls every 2s until ready, then stops', async () => {
    let polls = 0
    route({
      [`GET ${BASE}`]: () => json(listBody()),
      [`POST ${BASE}`]: () => json({ letter: letter('l1', { status: 'writing', content: '' }) }, 202),
      [`GET ${BASE}/l1`]: () => {
        polls += 1
        return json({ letter: letter('l1', polls >= 2 ? { status: 'ready' } : { status: 'writing' }) })
      },
    })
    const { result } = await mount()

    let created: CoverLetterView | null = null
    await act(async () => {
      created = await result.current.create({ company: 'Acme', role: 'Engineer', jobText: 'Build things' })
    })
    expect(created).toMatchObject({ id: 'l1', status: 'writing' })
    expect(result.current.letters[0]).toMatchObject({ id: 'l1', status: 'writing' })
    expect(bodyOf(calls('POST', BASE)[0])).toEqual({ company: 'Acme', role: 'Engineer', jobText: 'Build things' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(polls).toBe(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(polls).toBe(1)
    expect(result.current.letters[0].status).toBe('writing')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(polls).toBe(2)
    expect(result.current.letters[0].status).toBe('ready')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(polls).toBe(2)
  })

  it('create surfaces the rate-limit message and returns null', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody()),
      [`POST ${BASE}`]: () =>
        json({ error: 'Too many AI requests - please wait a moment.', code: 'RATE_LIMITED' }, 429),
    })
    const { result } = await mount()
    let created: CoverLetterView | null = null
    await act(async () => {
      created = await result.current.create({ company: 'Acme', role: 'Engineer', jobText: 'x' })
    })
    expect(created).toBeNull()
    expect(result.current.error).toContain('Too many AI requests - please wait a moment')
    expect(result.current.letters).toEqual([])
  })

  it('polls letters that were already writing when the list loaded', async () => {
    let polls = 0
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1', { status: 'writing' })])),
      [`GET ${BASE}/l1`]: () => {
        polls += 1
        return json({ letter: letter('l1', { status: 'failed', error: 'Nope' }) })
      },
    })
    const { result } = await mount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(polls).toBe(1)
    expect(result.current.letters[0]).toMatchObject({ status: 'failed', error: 'Nope' })
  })

  it('keeps polling after a failed poll request, without throwing', async () => {
    let polls = 0
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1', { status: 'writing' })])),
      [`GET ${BASE}/l1`]: () => {
        polls += 1
        if (polls === 1) throw new Error('network down')
        if (polls === 2) return json({ error: 'boom' }, 500)
        return json({ letter: letter('l1') })
      },
    })
    const { result } = await mount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(polls).toBe(3)
    expect(result.current.letters[0].status).toBe('ready')
  })

  it('drops a letter whose poll answers 404', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1', { status: 'writing' }), letter('l2')])),
      [`GET ${BASE}/l1`]: () => json({ error: 'Not found', code: 'NOT_FOUND' }, 404),
    })
    const { result } = await mount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.letters.map((l) => l.id)).toEqual(['l2'])
  })

  it('stops polling on unmount', async () => {
    let polls = 0
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1', { status: 'writing' })])),
      [`GET ${BASE}/l1`]: () => {
        polls += 1
        return json({ letter: letter('l1', { status: 'writing' }) })
      },
    })
    const { unmount } = await mount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(polls).toBe(1)
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(polls).toBe(1)
  })

  it('three quick content saves send one PATCH with the last content after 800 ms', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1')])),
      [`PATCH ${BASE}/l1`]: () => json({ letter: letter('l1', { content: 'third' }) }),
    })
    const { result } = await mount()

    act(() => {
      result.current.save('l1', { content: 'first' })
      result.current.save('l1', { content: 'second' })
      result.current.save('l1', { content: 'third' })
    })
    // Optimistic: the list shows the edit before the request goes out.
    expect(result.current.letters[0].content).toBe('third')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(799)
    })
    expect(calls('PATCH', `${BASE}/l1`)).toHaveLength(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    const patches = calls('PATCH', `${BASE}/l1`)
    expect(patches).toHaveLength(1)
    expect(bodyOf(patches[0])).toEqual({ content: 'third' })
  })

  it('sends notes and pendingApprovals patches at once', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1', { pendingApprovals: ['10 years'] })])),
      [`PATCH ${BASE}/l1`]: () => json({ letter: letter('l1') }),
    })
    const { result } = await mount()

    await act(async () => {
      result.current.save('l1', { notes: { motivation: 'Mission' } })
      result.current.save('l1', { pendingApprovals: [] })
    })
    const patches = calls('PATCH', `${BASE}/l1`)
    expect(patches).toHaveLength(2)
    expect(bodyOf(patches[0])).toEqual({ notes: { motivation: 'Mission' } })
    expect(bodyOf(patches[1])).toEqual({ pendingApprovals: [] })
    expect(result.current.letters[0].pendingApprovals).toEqual([])
  })

  it('takes the letter the server returns after a save', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1')])),
      [`PATCH ${BASE}/l1`]: () => json({ letter: letter('l1', { notes: { hiringManager: 'Dana' }, notices: ['n'] }) }),
    })
    const { result } = await mount()
    await act(async () => {
      result.current.save('l1', { notes: { hiringManager: 'Dana' } })
    })
    expect(result.current.letters[0].notices).toEqual(['n'])
  })

  it('does not overwrite newer local text with a stale save response', async () => {
    let resolveFirst!: (r: Response) => void
    let calledOnce = false
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') return json(listBody([letter('l1')]))
      if (!calledOnce) {
        calledOnce = true
        return new Promise<Response>((r) => {
          resolveFirst = r
        })
      }
      return json({ letter: letter('l1', { content: 'newer' }) })
    })
    const { result } = await mount()

    act(() => result.current.save('l1', { content: 'older' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    act(() => result.current.save('l1', { content: 'newer' }))
    await act(async () => {
      resolveFirst(json({ letter: letter('l1', { content: 'older' }) }))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.letters[0].content).toBe('newer')
  })

  it('sets the server message on a 409 from PATCH', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1')])),
      [`PATCH ${BASE}/l1`]: () =>
        json({ error: 'This letter is still being written.', code: 'CONFLICT' }, 409),
    })
    const { result } = await mount()
    await act(async () => {
      result.current.save('l1', { notes: { motivation: 'x' } })
    })
    expect(result.current.error).toBe('This letter is still being written.')
  })

  it('flushes a pending content save on unmount', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1')])),
      [`PATCH ${BASE}/l1`]: () => json({ letter: letter('l1') }),
    })
    const { result, unmount } = await mount()
    act(() => result.current.save('l1', { content: 'last words' }))
    expect(calls('PATCH', `${BASE}/l1`)).toHaveLength(0)

    unmount()
    const patches = calls('PATCH', `${BASE}/l1`)
    expect(patches).toHaveLength(1)
    expect(bodyOf(patches[0])).toEqual({ content: 'last words' })

    // The cancelled timer does not send it a second time.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(calls('PATCH', `${BASE}/l1`)).toHaveLength(1)
  })

  it('flushes a pending content save when another letter is saved', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1'), letter('l2')])),
      [`PATCH ${BASE}/l1`]: () => json({ letter: letter('l1') }),
      [`PATCH ${BASE}/l2`]: () => json({ letter: letter('l2') }),
    })
    const { result } = await mount()
    act(() => result.current.save('l1', { content: 'edit one' }))
    await act(async () => {
      result.current.save('l2', { content: 'edit two' })
    })
    const first = calls('PATCH', `${BASE}/l1`)
    expect(first).toHaveLength(1)
    expect(bodyOf(first[0])).toEqual({ content: 'edit one' })
    expect(calls('PATCH', `${BASE}/l2`)).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(bodyOf(calls('PATCH', `${BASE}/l2`)[0])).toEqual({ content: 'edit two' })
    expect(calls('PATCH', `${BASE}/l1`)).toHaveLength(1)
  })

  it('remove deletes the letter locally after a successful DELETE', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1'), letter('l2')])),
      [`DELETE ${BASE}/l1`]: () => new Response(null, { status: 204 }),
    })
    const { result } = await mount()
    await act(async () => {
      await result.current.remove('l1')
    })
    expect(calls('DELETE', `${BASE}/l1`)).toHaveLength(1)
    expect(result.current.letters.map((l) => l.id)).toEqual(['l2'])
  })

  it('remove keeps the letter and reports an error when DELETE fails', async () => {
    route({
      [`GET ${BASE}`]: () => json(listBody([letter('l1')])),
      [`DELETE ${BASE}/l1`]: () => json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500),
    })
    const { result } = await mount()
    await act(async () => {
      await result.current.remove('l1')
    })
    expect(result.current.letters.map((l) => l.id)).toEqual(['l1'])
    expect(result.current.error).toBe('Internal server error')
  })
})
