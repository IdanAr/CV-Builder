// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ApplicationsView from './ApplicationsView'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '@/lib/applications/types'

const apps: ApplicationRow[] = [
  {
    _id: 'a1',
    company: 'Zeta',
    role: 'Eng',
    status: 'applied',
    order: 1000,
    customFields: {},
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  },
  {
    _id: 'a2',
    company: 'Acme',
    role: 'PM',
    status: 'offer',
    order: 2000,
    customFields: {},
    createdAt: '2026-07-02T10:00:00.000Z',
    updatedAt: '2026-07-02T10:00:00.000Z',
  },
]

function renderView() {
  return render(
    <ApplicationsView
      initialApplications={apps}
      initialBoardConfig={{ columns: defaultBoardColumns(), sort: [] }}
      resumes={[]}
    />
  )
}

function rowTexts() {
  return screen
    .getAllByRole('row')
    .map((r) => r.textContent ?? '')
    .filter((t) => t.includes('Zeta') || t.includes('Acme'))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  )
})

describe('ApplicationsView sorting', () => {
  it('renders rows in manual order when no sort is active', () => {
    renderView()
    const rows = rowTexts()
    expect(rows[0]).toContain('Zeta')
    expect(rows[1]).toContain('Acme')
  })

  it('clicking a header sorts rows and persists the sort spec to board-config', async () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: /Sort by Company/ }))

    const rows = rowTexts()
    expect(rows[0]).toContain('Acme')
    expect(rows[1]).toContain('Zeta')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/applications/board-config',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ sort: [{ columnId: 'company', direction: 'asc' }] }),
        })
      )
    })
  })

  it('adds a custom column through the + Column flow and persists it', async () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: '+ Column' }))
    fireEvent.change(screen.getByLabelText(/column name/i), { target: { value: 'Recruiter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }))

    // The new column header appears immediately (optimistic)…
    expect(screen.getByRole('button', { name: /Sort by Recruiter/ })).toBeInTheDocument()

    // …and the full column set is persisted to board-config.
    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => url === '/api/applications/board-config')
      expect(call).toBeDefined()
      const body = JSON.parse(String((call![1] as RequestInit).body))
      const added = body.columns.find((c: { label: string }) => c.label === 'Recruiter')
      expect(added).toEqual(
        expect.objectContaining({ type: 'text', isBuiltIn: false })
      )
    })
  })

  it('deleting a custom column asks for confirmation first', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderView()

    // Add a custom column, then try to delete it.
    fireEvent.click(screen.getByRole('button', { name: '+ Column' }))
    fireEvent.change(screen.getByLabelText(/column name/i), { target: { value: 'Notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete Notes column' }))
    expect(confirmSpy).toHaveBeenCalled()
    // Declined: column stays.
    expect(screen.getByRole('button', { name: /Sort by Notes/ })).toBeInTheDocument()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Notes column' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Sort by Notes/ })).not.toBeInTheDocument()
    })
  })

  it('offers no delete affordance for built-in columns', () => {
    renderView()
    expect(screen.queryByRole('button', { name: 'Delete Company column' })).not.toBeInTheDocument()
    // Built-ins are still editable (rename / option editing).
    expect(screen.getByRole('button', { name: 'Edit Status column' })).toBeInTheDocument()
  })

  it('a second click flips to descending and a third clears the sort', async () => {
    renderView()
    const header = () => screen.getByRole('button', { name: /Sort by Company/ })

    fireEvent.click(header())
    fireEvent.click(header())
    expect(rowTexts()[0]).toContain('Zeta')
    expect(header().getAttribute('aria-label')).toMatch(/descending/)

    fireEvent.click(header())
    // Back to manual order
    expect(rowTexts()[0]).toContain('Zeta')
    expect(header().getAttribute('aria-label')).not.toMatch(/ascending|descending/)
  })
})
