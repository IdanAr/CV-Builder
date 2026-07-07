// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ApplicationsBoard from './ApplicationsBoard'
import { defaultBoardColumns, type BoardColumn } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '@/lib/applications/types'

function app(partial: Partial<ApplicationRow> & { _id: string }): ApplicationRow {
  return {
    company: '',
    role: '',
    status: 'applied',
    order: 1000,
    customFields: {},
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  }
}

const apps = [
  app({ _id: 'a1', company: 'Acme', role: 'Engineer', status: 'applied', order: 2000, resumeTitle: 'Backend CV' }),
  app({ _id: 'a2', company: 'Globex', role: 'PM', status: 'applied', order: 1000 }),
  app({ _id: 'a3', company: 'Initech', status: 'offer', order: 3000 }),
]

describe('ApplicationsBoard', () => {
  it('renders one lane per status option with correct grouping and counts', () => {
    render(
      <ApplicationsBoard applications={apps} columns={defaultBoardColumns()} onCardMove={vi.fn()} />
    )

    const appliedLane = screen.getByRole('group', { name: 'Applied column' })
    expect(within(appliedLane).getAllByRole('listitem')).toHaveLength(2)
    expect(within(appliedLane).getByText('Acme')).toBeInTheDocument()

    const offerLane = screen.getByRole('group', { name: 'Offer column' })
    expect(within(offerLane).getByText('Initech')).toBeInTheDocument()

    // Empty lanes still render.
    expect(screen.getByRole('group', { name: 'Interviewing column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Rejected column' })).toBeInTheDocument()
  })

  it('orders cards within a lane by their manual order value', () => {
    render(
      <ApplicationsBoard applications={apps} columns={defaultBoardColumns()} onCardMove={vi.fn()} />
    )
    const appliedLane = screen.getByRole('group', { name: 'Applied column' })
    const cards = within(appliedLane).getAllByRole('listitem')
    expect(cards[0]).toHaveTextContent('Globex') // order 1000 before 2000
    expect(cards[1]).toHaveTextContent('Acme')
  })

  it('reflects renamed/recolored status options from the board config', () => {
    const columns: BoardColumn[] = defaultBoardColumns().map((c) =>
      c.id === 'status'
        ? {
            ...c,
            options: [
              { id: 'applied', label: 'Wishlist', color: '#888888' },
              { id: 'offer', label: 'Won', color: '#00ff00' },
            ],
          }
        : c
    )
    render(<ApplicationsBoard applications={apps} columns={columns} onCardMove={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Wishlist column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Won column' })).toBeInTheDocument()
    expect(screen.queryByText('Applied')).not.toBeInTheDocument()
  })

  it('collects cards whose status no longer matches any option into a "No status" lane', () => {
    const orphan = app({ _id: 'a4', company: 'Umbrella', status: 'ghosted' })
    render(
      <ApplicationsBoard
        applications={[...apps, orphan]}
        columns={defaultBoardColumns()}
        onCardMove={vi.fn()}
      />
    )
    const lane = screen.getByRole('group', { name: 'No status column' })
    expect(within(lane).getByText('Umbrella')).toBeInTheDocument()
  })

  it('shows the resume title and custom select chips on cards', () => {
    const columns: BoardColumn[] = [
      ...defaultBoardColumns(),
      {
        id: 'col-src',
        key: 'col-src',
        label: 'Source',
        type: 'select',
        isBuiltIn: false,
        order: 6000,
        options: [{ id: 'opt-li', label: 'LinkedIn', color: '#0a66c2' }],
      },
    ]
    const withChip = [app({ _id: 'a9', company: 'Acme', status: 'applied', resumeTitle: 'Backend CV', customFields: { 'col-src': 'opt-li' } })]
    render(<ApplicationsBoard applications={withChip} columns={columns} onCardMove={vi.fn()} />)

    expect(screen.getByText(/Backend CV/)).toBeInTheDocument()
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
  })
})
