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
