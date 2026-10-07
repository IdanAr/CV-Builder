// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PipelineInbox } from './PipelineInbox'
import type { PipelineJob, PipelineCountsDto } from '@/lib/jobsearch/pipeline-types'
import type { PipelineInitial } from './use-pipeline-jobs'
import { useToastStore } from '@/lib/stores/toast.store'
import { useScrapedJobsSync } from '@/lib/stores/scraped-jobs.store'

const nav = vi.hoisted(() => {
  const state = {
    current: new URLSearchParams(),
    listeners: new Set<() => void>(),
    push: undefined as unknown as (href: string) => void,
  }
  return state
})

vi.mock('next/navigation', async () => {
  const React = await import('react')
  return {
    useRouter: () => ({ push: nav.push }),
    usePathname: () => '/dashboard/jobsearch',
    useSearchParams: () =>
      React.useSyncExternalStore(
        (cb) => { nav.listeners.add(cb); return () => nav.listeners.delete(cb) },
        () => nav.current,
        () => nav.current
      ),
  }
})

const push = vi.fn()
nav.push = push

// setView writes the URL with window.history.replaceState; mirror it into the
// mocked useSearchParams store so URL-driven behaviour still runs for real.
const replace = vi.fn()
const realReplaceState = window.history.replaceState.bind(window.history)
function installHistorySpy() {
  vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => {
    const href = String(url)
    replace(href)
    realReplaceState(data, unused, href)
    act(() => {
      nav.current = new URLSearchParams(href.split('?')[1] ?? '')
      nav.listeners.forEach((l) => l())
    })
  })
}

const counts = (over: Partial<PipelineCountsDto> = {}): PipelineCountsDto => ({
  found: 0, matched: 0, drafted: 0, ready: 0, applied: 0, archive: 0, matchedUnread: 0, waiting: 0, ...over,
})

const mk = (id: string, over: Partial<PipelineJob> = {}): PipelineJob => ({
  _id: id, profileId: 'p1', profileName: 'Frontend', title: `Job ${id}`, company: 'Acme', url: `https://x.test/${id}`,
  matchedRules: [], pendingApprovals: [], tailoredKeywords: [], status: 'notified', stage: 'found',
  createdAt: new Date().toISOString(), ...over,
})

const profiles = [
  { _id: 'p1', name: 'Frontend', isActive: true },
  { _id: 'p2', name: 'Backend', isActive: true },
  { _id: 'p3', name: 'Old', isActive: false },
]

function initial(stage: PipelineInitial['view']['stage'], items: PipelineJob[]): PipelineInitial {
  return { view: { stage, profile: null, q: '' }, items, nextCursor: null, counts: counts({ [stage]: items.length }) }
}

const fetchMock = vi.fn()
let pageItems: PipelineJob[] = []
const page = () => ({ items: pageItems, nextCursor: null, counts: counts() })
function ok(body: unknown = page(), status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body } as Response)
}

function setup(init: PipelineInitial, opts: { params?: string; profiles?: typeof profiles } = {}) {
  nav.current = new URLSearchParams(opts.params ?? '')
  pageItems = init.items.map((j) => (j.status === 'new' ? { ...j, status: 'notified' } : j))
  return render(<PipelineInbox initial={init} profiles={opts.profiles ?? profiles} />)
}

const calls = (needle: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(needle))

beforeEach(() => {
  installHistorySpy()
  replace.mockClear()
  push.mockClear()
  fetchMock.mockReset()
  fetchMock.mockImplementation(() => ok())
  vi.stubGlobal('fetch', fetchMock)
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('PipelineInbox', () => {
  it('renders initial items without fetching and writes ?job= on select', () => {
    setup(initial('found', [mk('a'), mk('b')]))
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Job b/ }))
    expect(replace).toHaveBeenCalledWith('/dashboard/jobsearch?stage=found&job=b')
  })

  it('uses the shared page-title scale, with and without profiles', () => {
    const { unmount } = setup(initial('found', [mk('a')]))
    expect(screen.getByRole('heading', { level: 1, name: 'Job search' })).toHaveAttribute(
      'class',
      'text-xl font-medium text-fg-heading',
    )
    unmount()
    setup(initial('found', []), { profiles: [] })
    expect(screen.getByRole('heading', { level: 1, name: 'Job search' })).toHaveAttribute(
      'class',
      'text-xl font-medium text-fg-heading',
    )
  })

  it('clicking a stage tab replaces the URL with that stage and no job', () => {
    setup(initial('found', [mk('a')]), { params: 'stage=found&job=a' })
    fireEvent.click(screen.getByRole('tab', { name: /Drafted/ }))
    expect(replace).toHaveBeenCalledWith('/dashboard/jobsearch?stage=drafted')
  })

  it('debounces search into the URL by 250ms', () => {
    vi.useFakeTimers()
    setup(initial('found', [mk('a')]))
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 're' } })
    fireEvent.change(input, { target: { value: 'react' } })
    expect((input as HTMLInputElement).value).toBe('react')
    act(() => { vi.advanceTimersByTime(249) })
    expect(replace).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2) })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/dashboard/jobsearch?stage=found&q=react')
  })

  it('keeps a trailing space in the search box after the debounce writes the trimmed q', () => {
    vi.useFakeTimers()
    setup(initial('found', [mk('a')]))
    const input = screen.getByRole('searchbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'foo ' } })
    act(() => { vi.advanceTimersByTime(250) })
    expect(replace).toHaveBeenLastCalledWith('/dashboard/jobsearch?stage=found&q=foo')
    expect(input.value).toBe('foo ')
  })

  it('still syncs the search box when the URL q changes externally', () => {
    setup(initial('found', [mk('a')]), { params: 'stage=found&q=foo' })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('foo')
    act(() => {
      nav.current = new URLSearchParams('stage=found&q=bar')
      nav.listeners.forEach((l) => l())
    })
    expect(input.value).toBe('bar')
  })

  it('J/K move the selection and are ignored while typing in search', () => {
    setup(initial('found', [mk('a'), mk('b'), mk('c')]))
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(replace).toHaveBeenLastCalledWith('/dashboard/jobsearch?stage=found&job=a')
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(replace).toHaveBeenLastCalledWith('/dashboard/jobsearch?stage=found&job=b')
    fireEvent.keyDown(document.body, { key: 'k' })
    expect(replace).toHaveBeenLastCalledWith('/dashboard/jobsearch?stage=found&job=a')

    replace.mockClear()
    const input = screen.getByRole('searchbox') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: 'j' } })
    fireEvent.keyDown(input, { key: 'j' })
    expect(input.value).toBe('j')
    expect(replace).not.toHaveBeenCalled()
  })

  it('A runs a one-step primary (Ready -> convert) but does nothing for open-posting', async () => {
    setup(initial('ready', [mk('r', { stage: 'ready', status: 'queued' })]), { params: 'stage=ready&job=r' })
    fireEvent.keyDown(document.body, { key: 'a' })
    await waitFor(() => expect(calls('/r/convert')).toHaveLength(1))
    expect(fetchMock.mock.calls.find(([u]) => String(u).includes('/convert'))?.[1]).toMatchObject({ method: 'POST' })
    cleanup()

    fetchMock.mockClear()
    setup(initial('found', [mk('f')]), { params: 'stage=found&job=f' })
    fireEvent.keyDown(document.body, { key: 'a' })
    await act(async () => { await Promise.resolve() })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('D dismisses the selected job and removes the row at once', async () => {
    setup(initial('found', [mk('a'), mk('b')]), { params: 'stage=found&job=a' })
    fireEvent.keyDown(document.body, { key: 'd' })
    expect(screen.queryByRole('button', { name: /Job a/ })).toBeNull()
    await waitFor(() => expect(calls('/scraped-jobs/a')).toHaveLength(1))
    const [, init] = calls('/scraped-jobs/a')[0]
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ dismissed: true }) })
  })

  it('swaps list and detail with CSS-only classes and Back to list drops ?job=', () => {
    const { container, unmount } = setup(initial('found', [mk('a')]))
    expect(container.querySelector('[data-pipeline-detail]')?.className).toContain('hidden min-w-0 lg:block')
    expect(container.querySelector('[data-pipeline-list]')?.className).toBe('block min-w-0')
    unmount()

    const second = setup(initial('found', [mk('a')]), { params: 'stage=found&job=a' })
    expect(second.container.querySelector('[data-pipeline-list]')?.className).toContain('hidden min-w-0 lg:block')
    expect(second.container.querySelector('[data-pipeline-detail]')?.className).toBe('block min-w-0')
    fireEvent.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(replace).toHaveBeenCalledWith('/dashboard/jobsearch?stage=found')
  })

  it('keeps the layout grid on an explicit shrinkable track so it cannot overflow narrow screens', () => {
    const { container } = setup(initial('found', [mk('a')]))
    const list = container.querySelector('[data-pipeline-list]') as HTMLElement
    const detail = container.querySelector('[data-pipeline-detail]') as HTMLElement
    expect(list.parentElement?.className).toContain('grid-cols-[minmax(0,1fr)]')
    expect(list.className).toContain('min-w-0')
    expect(detail.className).toContain('min-w-0')
  })

  it('wraps both the inbox and the first-run card in the page frame', () => {
    const frame = ['mx-auto', 'w-full', 'max-w-6xl', 'px-4', 'py-6', 'sm:px-6', 'sm:py-8']
    const { container, unmount } = setup(initial('found', [mk('a')]))
    for (const c of frame) expect(container.firstElementChild?.className).toContain(c)
    unmount()
    const empty = setup(initial('found', []), { profiles: [] })
    for (const c of frame) expect(empty.container.firstElementChild?.className).toContain(c)
  })

  it('scan with a profile filter posts that profile once', async () => {
    setup(initial('found', [mk('a')]), { params: 'stage=found&profile=p2' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Scan now' })) })
    await screen.findByRole('button', { name: 'Scan now' })
    expect(calls('/api/jobsearch/scan').map(([, i]) => JSON.parse(i.body))).toEqual([{ profileId: 'p2' }])
  })

  it('scan without a filter loops active profiles in order and stops on a 429', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/api/jobsearch/scan') ? ok({}, 429) : ok()
    )
    setup(initial('found', [mk('a')]))
    const before = useScrapedJobsSync.getState().revision
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Scan all' })) })
    // Scanning finished once the button reads "Scan all" again; only then is "stops after the 429" provable.
    await screen.findByRole('button', { name: 'Scan all' })
    expect(calls('/api/jobsearch/scan').map(([, i]) => JSON.parse(i.body))).toEqual([{ profileId: 'p1' }])
    expect(useScrapedJobsSync.getState().revision).toBeGreaterThan(before)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Too many scans. Wait a minute and try again.')
  })

  it('scan without a filter posts each active profile', async () => {
    setup(initial('found', [mk('a')]))
    const before = useScrapedJobsSync.getState().revision
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Scan all' })) })
    await screen.findByRole('button', { name: 'Scan all' })
    // The inactive profile p3 is never scanned.
    expect(calls('/api/jobsearch/scan').map(([, i]) => JSON.parse(i.body).profileId)).toEqual(['p1', 'p2'])
    expect(useScrapedJobsSync.getState().revision).toBeGreaterThan(before)
  })

  it('surfaces a degraded scan message through a toast', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/api/jobsearch/scan')
        ? ok({ result: { degraded: true, errorMessage: 'freehire returned 503' } })
        : ok()
    )
    setup(initial('found', [mk('a')]), { params: 'stage=found&profile=p1' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Scan now' })) })
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('freehire returned 503')
    )
  })

  it('shows the first-run card and no tabs with zero profiles', () => {
    setup(initial('found', []), { profiles: [] })
    expect(screen.getByText('Set up a profile to start finding jobs.')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    const links = screen.getAllByRole('link', { name: /Sources and rules/ })
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) expect(l.getAttribute('href')).toBe('/dashboard/jobsearch/sources')
  })

  it('hides scan and invites setup when no profile is active', () => {
    setup(initial('found', [mk('a')]), { profiles: [{ _id: 'p3', name: 'Old', isActive: false }] })
    expect(screen.queryByRole('button', { name: /Scan/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Set up a profile' }).getAttribute('href')).toBe('/dashboard/jobsearch/sources')
  })

  it('drops an unknown ?job= from the URL once loaded', async () => {
    setup(initial('found', [mk('a')]), { params: 'stage=found&job=ghost' })
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/dashboard/jobsearch?stage=found')
    )
  })

  it('shows an inline banner for action errors while items stay', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/convert') ? ok({ error: 'Nope' }, 500) : ok()
    )
    setup(initial('ready', [mk('r', { stage: 'ready', status: 'queued' })]), { params: 'stage=ready&job=r' })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as applied' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Job r/ })).toBeTruthy()
  })

  it('clears the action error banner when the stage changes', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/convert') ? ok({ error: 'Nope' }, 500) : ok()
    )
    setup(initial('ready', [mk('r', { stage: 'ready', status: 'queued' })]), { params: 'stage=ready&job=r' })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as applied' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Drafted/ }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  describe('ported behaviours', () => {
    it('dismiss shows an Undo toast and undo restores', async () => {
      setup(initial('found', [mk('a')]), { params: 'stage=found&job=a' })
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      await waitFor(() => expect(useToastStore.getState().toasts.some((t) => t.actionLabel === 'Undo')).toBe(true))
      const undo = useToastStore.getState().toasts.find((t) => t.actionLabel === 'Undo')!
      act(() => undo.onAction?.())
      await waitFor(() => expect(calls('/scraped-jobs/a')).toHaveLength(2))
      expect(calls('/scraped-jobs/a')[1][1].body).toBe(JSON.stringify({ dismissed: false }))
    })

    it('delete waits 6s before the DELETE request', async () => {
      const user = userEvent.setup()
      setup(initial('found', [mk('a')]), { params: 'stage=found&job=a' })
      await user.click(screen.getByRole('button', { name: 'More actions' }))
      const item = await screen.findByRole('menuitem', { name: 'Delete' })
      vi.useFakeTimers()
      fireEvent.click(item)
      act(() => { vi.advanceTimersByTime(5900) })
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false)
      act(() => { vi.advanceTimersByTime(200) })
      expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(true)
    })

    it('keeps the New chip on unread Matched rows after mark-read', async () => {
      const job = mk('m', { stage: 'matched', status: 'new' })
      const seeded = initial('matched', [job])
      seeded.counts = counts({ matched: 1, matchedUnread: 1 })
      setup(seeded, { params: 'stage=matched' })
      await waitFor(() => expect(calls('mark-read')).toHaveLength(1))
      // mark-read bumps the revision, which reloads the (now read) page; let that second matched fetch land.
      await waitFor(() => expect(calls('stage=matched')).toHaveLength(1))
      await act(async () => { await Promise.resolve() })
      expect(screen.getByText('New')).toBeTruthy()
    })

    it('Archive offers Find again for a tombstone and Restore for a dismissed job', () => {
      const tomb = mk('t', { stage: 'archive', status: 'dismissed', deletedAt: new Date().toISOString() })
      const dismissed = mk('d', { stage: 'archive', status: 'dismissed' })
      const first = setup(initial('archive', [tomb, dismissed]), { params: 'stage=archive&job=t' })
      expect(screen.getByRole('button', { name: 'Find again' })).toBeTruthy()
      first.unmount()
      setup(initial('archive', [tomb, dismissed]), { params: 'stage=archive&job=d' })
      expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy()
    })
  })
})
