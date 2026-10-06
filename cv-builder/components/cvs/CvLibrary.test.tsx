// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toCvRow, sortRows, type CvRow } from './cv-row'
import { CvLibrary } from './CvLibrary'
import { useToastStore } from '@/lib/stores/toast.store'

const routerPush = vi.fn()
const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}))

// The real thumbnail renders a whole CV template; CvThumbnail.test.tsx covers
// it. Here it only has to show up in the cards view.
vi.mock('./CvThumbnail', () => ({
  CvThumbnail: () => <div data-testid="thumb" />,
}))

function resume(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'r1',
    title: 'Backend CV',
    data: { basics: { label: 'Platform engineer' } },
    meta: { templateId: 'modern', layout: 'two-column' },
    sectionsFilledCount: 4,
    formatScore: 18,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T12:30:00.000Z'),
    pendingApprovals: ['42%'],
    ...overrides,
  }
}

describe('toCvRow', () => {
  it('maps a listed resume into a serializable row', () => {
    const row = toCvRow(resume(), { kind: 'none' })
    expect(row).toMatchObject({
      id: 'r1',
      title: 'Backend CV',
      roleLabel: 'Platform engineer',
      templateId: 'modern',
      templateLabel: 'Modern',
      formatScore: 18,
      sectionsFilledCount: 4,
      layout: 'two column',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-10-01T12:30:00.000Z',
      badge: { kind: 'none' },
      pendingClaims: 1,
    })
    expect(row.parentResumeId).toBeUndefined()
    expect(row.parentResumeTitle).toBeUndefined()
  })

  it('falls back to "No role set" when the role label is missing or blank', () => {
    expect(toCvRow(resume({ data: {} }), { kind: 'none' }).roleLabel).toBe('No role set')
    expect(toCvRow(resume({ data: { basics: { label: '   ' } } }), { kind: 'none' }).roleLabel).toBe(
      'No role set'
    )
    expect(toCvRow(resume({ data: undefined }), { kind: 'none' }).roleLabel).toBe('No role set')
  })

  it('labels the template via templateLabel, defaulting to Classic', () => {
    const row = toCvRow(resume({ meta: {} }), { kind: 'none' })
    expect(row.templateId).toBe('classic')
    expect(row.templateLabel).toBe('Classic')
    expect(row.layout).toBe('single column')
  })

  it('defaults the format score to 0 and pendingClaims to 0', () => {
    const row = toCvRow(resume({ formatScore: undefined, pendingApprovals: undefined }), { kind: 'none' })
    expect(row.formatScore).toBe(0)
    expect(row.pendingClaims).toBe(0)
  })

  it('stringifies ids and accepts ISO strings for dates', () => {
    const row = toCvRow(
      resume({
        _id: { toString: () => 'oid-1' },
        parentResumeId: { toString: () => 'oid-0' },
        parentResumeTitle: 'Base CV',
        createdAt: '2026-09-01T10:00:00.000Z',
      }),
      { kind: 'multiple', count: 2 }
    )
    expect(row.id).toBe('oid-1')
    expect(row.parentResumeId).toBe('oid-0')
    expect(row.parentResumeTitle).toBe('Base CV')
    expect(row.createdAt).toBe('2026-09-01T10:00:00.000Z')
    expect(row.badge).toEqual({ kind: 'multiple', count: 2 })
  })
})

function row(id: string, title: string, formatScore: number, updatedAt: string): CvRow {
  return toCvRow(
    resume({ _id: id, title, formatScore, updatedAt: new Date(updatedAt) }),
    { kind: 'none' }
  )
}

describe('sortRows', () => {
  const rows = [
    row('a', 'beta', 10, '2026-10-02T00:00:00.000Z'),
    row('b', 'Alpha', 20, '2026-10-03T00:00:00.000Z'),
    row('c', 'gamma', 10, '2026-10-01T00:00:00.000Z'),
  ]

  it('sorts by name case-insensitively', () => {
    expect(sortRows(rows, 'name', 'asc').map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(sortRows(rows, 'name', 'desc').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by edited date', () => {
    expect(sortRows(rows, 'edited', 'desc').map((r) => r.id)).toEqual(['b', 'a', 'c'])
    expect(sortRows(rows, 'edited', 'asc').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by ATS numerically and keeps ties in their original order', () => {
    expect(sortRows(rows, 'ats', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(sortRows(rows, 'ats', 'desc').map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  it('does not mutate its input', () => {
    const before = rows.map((r) => r.id)
    sortRows(rows, 'name', 'asc')
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

function libraryRow(overrides: Partial<CvRow> & { id: string; title: string }): CvRow {
  return {
    roleLabel: 'Engineer',
    templateId: 'classic',
    templateLabel: 'Classic',
    formatScore: 15,
    sectionsFilledCount: 3,
    layout: 'single column',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    badge: { kind: 'none' },
    pendingClaims: 0,
    data: {},
    meta: {},
    ...overrides,
  }
}

const ROWS: CvRow[] = [
  libraryRow({ id: 'a', title: 'Alpha CV', formatScore: 22, updatedAt: '2026-10-01T00:00:00.000Z' }),
  libraryRow({
    id: 'b',
    title: 'Beta CV',
    formatScore: 8,
    updatedAt: '2026-10-03T00:00:00.000Z',
    parentResumeId: 'a',
    parentResumeTitle: 'Alpha CV',
    badge: { kind: 'single', label: 'Interviewing', color: '#2457f5' },
    pendingClaims: 2,
  }),
  libraryRow({
    id: 'c',
    title: 'Gamma CV',
    formatScore: 14,
    updatedAt: '2026-10-02T00:00:00.000Z',
    badge: { kind: 'multiple', count: 3 },
  }),
]

/** Titles of the body rows, in rendered order. */
function rowTitles(): string[] {
  const table = screen.getByRole('table')
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('link')[0].textContent ?? '')
}

function columnHeader(name: string) {
  return screen.getAllByRole('columnheader').find((h) => h.textContent?.startsWith(name))!
}

describe('CvLibrary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    // Unmount first: a row deleted inside its undo window commits the DELETE
    // on unmount, and that request must still hit the stubbed fetch.
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    document.cookie = 'cvb-cvs-view=; Max-Age=0; Path=/'
  })

  it('renders the table by default with its column headers and one row per CV', () => {
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.slice(0, 5)).toEqual(['Name', 'Template', 'ATS', 'Edited', 'Status'])
    expect(within(table).getAllByRole('row')).toHaveLength(ROWS.length + 1)
    expect(screen.getByRole('link', { name: 'Alpha CV' })).toHaveAttribute('href', '/dashboard/resumes/a')
    expect(screen.getByText('3 CVs')).toBeInTheDocument()
  })

  it('shows "Tailored from <parent>" linking to the parent CV', () => {
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const betaRow = screen.getByRole('link', { name: 'Beta CV' }).closest('[role="row"]') as HTMLElement
    expect(betaRow).toHaveTextContent('Tailored from Alpha CV')
    // The whole phrase is the link text, so the parent link is never a second,
    // ambiguous "Alpha CV" link in the list.
    expect(within(betaRow).getByRole('link', { name: 'Tailored from Alpha CV' })).toHaveAttribute(
      'href',
      '/dashboard/resumes/a'
    )
  })

  it('always pairs the ATS colour with N/25 text', () => {
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const alphaRow = screen.getByRole('link', { name: 'Alpha CV' }).closest('[role="row"]') as HTMLElement
    const ats = within(alphaRow).getAllByText('22/25').find((el) => el.className.includes('text-fg-success'))
    expect(ats).toBeDefined()
  })

  it('sorts by Edited descending by default', () => {
    render(<CvLibrary rows={ROWS} initialView="table" />)
    expect(rowTitles()).toEqual(['Beta CV', 'Gamma CV', 'Alpha CV'])
    expect(columnHeader('Edited')).toHaveAttribute('aria-sort', 'descending')
    expect(columnHeader('ATS')).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts by ATS ascending, then descending, then back to the default', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const atsButton = within(columnHeader('ATS')).getByRole('button')

    await user.click(atsButton)
    expect(columnHeader('ATS')).toHaveAttribute('aria-sort', 'ascending')
    expect(columnHeader('Edited')).toHaveAttribute('aria-sort', 'none')
    expect(rowTitles()).toEqual(['Beta CV', 'Gamma CV', 'Alpha CV'])

    await user.click(atsButton)
    expect(columnHeader('ATS')).toHaveAttribute('aria-sort', 'descending')
    expect(rowTitles()).toEqual(['Alpha CV', 'Gamma CV', 'Beta CV'])

    await user.click(atsButton)
    expect(columnHeader('ATS')).toHaveAttribute('aria-sort', 'none')
    expect(columnHeader('Edited')).toHaveAttribute('aria-sort', 'descending')
  })

  it('sorts by name when the Name header is used', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    await user.click(within(columnHeader('Name')).getByRole('button'))
    expect(columnHeader('Name')).toHaveAttribute('aria-sort', 'ascending')
    expect(rowTitles()).toEqual(['Alpha CV', 'Beta CV', 'Gamma CV'])
  })

  it('shows the application status and the review claims chip', () => {
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const rowOf = (title: string) =>
      screen.getByRole('link', { name: title }).closest('[role="row"]') as HTMLElement
    expect(within(rowOf('Alpha CV')).getByText('Draft')).toBeInTheDocument()
    expect(within(rowOf('Beta CV')).getByText('Interviewing')).toBeInTheDocument()
    expect(within(rowOf('Gamma CV')).getByText('3 applications')).toBeInTheDocument()
    expect(within(rowOf('Beta CV')).getByText('Review claims')).toBeInTheDocument()
    expect(within(rowOf('Alpha CV')).queryByText('Review claims')).not.toBeInTheDocument()
  })

  it('opens the editor when a row is clicked outside its links and buttons', () => {
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const alphaRow = screen.getByRole('link', { name: 'Alpha CV' }).closest('[role="row"]') as HTMLElement
    fireEvent.click(within(alphaRow).getByText('Draft'))
    expect(routerPush).toHaveBeenCalledWith('/dashboard/resumes/a')
  })

  it('does not navigate the row when its actions menu trigger is used', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    await user.click(screen.getByRole('button', { name: 'More actions for Alpha CV' }))
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('switches views with a View toggle group and remembers the choice in a cookie', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    const group = screen.getByRole('group', { name: 'View' })
    const tableBtn = within(group).getByRole('button', { name: 'Table' })
    const cardsBtn = within(group).getByRole('button', { name: 'Cards' })
    expect(tableBtn).toHaveAttribute('aria-pressed', 'true')
    expect(cardsBtn).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryAllByTestId('thumb')).toHaveLength(0)

    await user.click(cardsBtn)
    expect(cardsBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('thumb')).toHaveLength(ROWS.length)
    expect(document.cookie).toContain('cvb-cvs-view=cards')
  })

  it('renders cards first when the remembered view is cards', () => {
    render(<CvLibrary rows={ROWS} initialView="cards" />)
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByTestId('thumb')).toHaveLength(ROWS.length)
    expect(screen.getByRole('link', { name: 'Alpha CV' })).toHaveAttribute('href', '/dashboard/resumes/a')
    expect(screen.getByText('ATS 22/25')).toBeInTheDocument()
    // A CV with claims waiting shows the attention chip instead of its score.
    expect(screen.getByText('Review claims')).toBeInTheDocument()
    expect(screen.queryByText('ATS 8/25')).not.toBeInTheDocument()
  })

  it('offers Duplicate, Download JSON, Track application and Delete in the row menu', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    await user.click(screen.getByRole('button', { name: 'More actions for Alpha CV' }))
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent)
    expect(items).toEqual(['Duplicate', 'Download JSON', 'Track application', 'Delete'])
  })

  it('duplicates through the actions menu', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    await user.click(screen.getByRole('button', { name: 'More actions for Alpha CV' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
    expect(fetch).toHaveBeenCalledWith('/api/resumes/a/duplicate', { method: 'POST' })
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('hides a deleted row immediately with an undo toast', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="table" />)
    await user.click(screen.getByRole('button', { name: 'More actions for Alpha CV' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(screen.queryByRole('link', { name: 'Alpha CV' })).not.toBeInTheDocument()
    expect(useToastStore.getState().toasts[0].message).toBe('Deleted "Alpha CV"')
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('offers the same actions menu on cards', async () => {
    const user = userEvent.setup()
    render(<CvLibrary rows={ROWS} initialView="cards" />)
    await user.click(screen.getByRole('button', { name: 'More actions for Gamma CV' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(screen.queryByRole('link', { name: 'Gamma CV' })).not.toBeInTheDocument()
  })

  it('invites the user to build a first CV when there are none', () => {
    render(<CvLibrary rows={[]} initialView="table" />)
    expect(screen.getByText("Let's build your first CV")).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument()
  })
})
