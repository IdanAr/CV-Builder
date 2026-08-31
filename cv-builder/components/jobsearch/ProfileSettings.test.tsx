// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileSettings } from './ProfileSettings'

const baseProfile = {
  _id: 'p1',
  name: 'Analyst',
  roles: ['Data Analyst'],
  workModes: ['remote'],
  locations: [{ country: 'IL', city: 'Tel Aviv' }],
  seniority: ['senior'],
  categories: [],
  industries: [],
  recencyDays: 14,
  minAtsScore: 50,
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('ProfileSettings', () => {
  it('renders a read-only summary of the current preferences', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ profile: baseProfile }))
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileSettings profileId="p1" />)

    expect(await screen.findByText('Data Analyst')).toBeInTheDocument()
    expect(screen.getByText(/israel.*tel aviv/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit preferences/i })).toBeInTheDocument()
  })

  it('switches to the wizard in edit mode and refreshes the summary after saving', async () => {
    let currentProfile = baseProfile
    const mockFetch = vi.fn((url: string, opts?: { method?: string }) => {
      if (url === '/api/jobsearch/profiles/p1' && opts?.method === 'PATCH') {
        currentProfile = { ...baseProfile, name: 'Updated', recencyDays: 30 }
        return Promise.resolve(jsonResponse({ profile: currentProfile }))
      }
      if (url === '/api/jobsearch/profiles/p1') {
        return Promise.resolve(jsonResponse({ profile: currentProfile }))
      }
      return Promise.resolve(jsonResponse({ resumes: [] }))
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileSettings profileId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: /edit preferences/i }))
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Roles')

    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument())
    expect(await screen.findByText(/30 days/i)).toBeInTheDocument()
  })

  it('cancels out of edit mode without saving', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ profile: baseProfile }))
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileSettings profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /edit preferences/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.getByRole('button', { name: /edit preferences/i })).toBeInTheDocument()
  })

  it('shows watched Comeet company names, or "-" when none are configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: { ...baseProfile, comeetCompanies: [{ name: 'Acme Israel', uid: 'ACM.001', token: 'tok_abc' }] },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileSettings profileId="p1" />)

    expect(await screen.findByText('Acme Israel')).toBeInTheDocument()
  })

  it('falls back to "-" for a profile saved before comeetCompanies existed', async () => {
    // Simulates a pre-migration document: no comeetCompanies field at all
    // (Mongoose .lean() doesn't backfill schema defaults onto existing docs).
    const { comeetCompanies: _unused, ...profileWithoutComeet } = { ...baseProfile, comeetCompanies: [] }
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ profile: profileWithoutComeet }))
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileSettings profileId="p1" />)

    expect(await screen.findByText('Data Analyst')).toBeInTheDocument()
    expect(screen.getByText('Watched companies').nextSibling).toHaveTextContent('-')
  })
})
