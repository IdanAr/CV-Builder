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

  it('reads as a row of labelled indicators, work mode included', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          _id: 'p1',
          name: 'Frontend',
          roles: ['React'],
          workModes: ['remote'],
          locations: [{ country: 'IL', city: 'Tel Aviv' }],
          seniority: [],
          categories: [],
          industries: [],
          comeetCompanies: [],
          recencyDays: 14,
          minAtsScore: 78,
        },
      }),
    } as Response)

    render(<ProfileSettings profileId="p1" />)

    expect(await screen.findByText('Roles')).toBeInTheDocument()
    expect(screen.getByText('Work mode')).toBeInTheDocument()
    expect(screen.getByText('remote')).toBeInTheDocument()
    expect(screen.getByText('Recency')).toBeInTheDocument()
    expect(screen.getByText('14 days')).toBeInTheDocument()
    expect(screen.getByText('Min fit')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
  })

  it('says "Any" rather than "-" when no work mode is set, since that is what it means', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          _id: 'p1',
          name: 'Frontend',
          roles: [],
          workModes: [],
          locations: [],
          seniority: [],
          categories: [],
          industries: [],
          comeetCompanies: [],
          recencyDays: 14,
          minAtsScore: 75,
        },
      }),
    } as Response)

    render(<ProfileSettings profileId="p1" />)

    expect(await screen.findByText('Any')).toBeInTheDocument()
  })

  it('skips the mount fetch when the server already supplied the profile', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    render(
      <ProfileSettings
        profileId="p1"
        initialProfile={{
          _id: 'p1',
          name: 'Seeded',
          roles: ['Seeded role'],
          workModes: [],
          locations: [],
          seniority: [],
          categories: [],
          industries: [],
          comeetCompanies: [],
          recencyDays: 21,
          minAtsScore: 80,
        }}
      />
    )

    expect(await screen.findByText('Seeded role')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
