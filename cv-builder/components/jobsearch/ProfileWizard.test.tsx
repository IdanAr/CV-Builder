// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileWizard } from './ProfileWizard'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('ProfileWizard', () => {
  it('starts on step 1 and advances to step 5 via Next', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Roles')
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Review')
  })

  it('disables the create button until a profile name is entered', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByRole('button', { name: /create profile/i })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Frontend, Remote EU')
    expect(screen.getByRole('button', { name: /create profile/i })).toBeEnabled()
  })

  it('submits the profile and calls onCreated with the response', async () => {
    const onCreated = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Frontend, Remote EU' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={onCreated} />)
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Frontend, Remote EU')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/jobsearch/profiles',
      expect.objectContaining({ method: 'POST' })
    )
    expect(onCreated).toHaveBeenCalledWith({ _id: 'p1', name: 'Frontend, Remote EU' })
  })

  it('preserves city input when navigating away and back to step 2', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    // Navigate to step 2
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    // Type a city
    const cityInput = screen.getByLabelText(/city/i) as HTMLInputElement
    await userEvent.type(cityInput, 'Berlin')
    expect(cityInput.value).toBe('Berlin')
    // Navigate to step 4
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    // Click back to step 2 via tab
    await userEvent.click(screen.getByRole('tab', { name: /location/i }))
    // Verify city is still there
    const cityInputAfter = screen.getByLabelText(/city/i) as HTMLInputElement
    expect(cityInputAfter.value).toBe('Berlin')
  })

  it('displays an error message when profile creation fails', async () => {
    const onCreated = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={onCreated} />)
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Frontend, Remote EU')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    expect(screen.getByText(/failed to create profile/i)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('allows typing multi-word roles without stripping spaces mid-typing', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    const rolesInput = screen.getByLabelText(/target roles/i) as HTMLInputElement
    await userEvent.type(rolesInput, 'Data Analyst')
    expect(rolesInput.value).toBe('Data Analyst')
  })

  it('allows typing categories with commas and spaces without stripping them', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i })) // -> step 2
    await userEvent.click(screen.getByRole('button', { name: /next/i })) // -> step 3
    const categoriesInput = screen.getByLabelText(/^categories/i) as HTMLInputElement
    await userEvent.type(categoriesInput, 'Backend Engineering, Site Reliability')
    expect(categoriesInput.value).toBe('Backend Engineering, Site Reliability')
  })

  it('parses multi-word, comma-separated roles into tags on submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Test' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.type(screen.getByLabelText(/target roles/i), 'Data Analyst, Product Manager')
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.roles).toEqual(['Data Analyst', 'Product Manager'])
  })

  it('offers seniority as checkboxes and includes toggled levels in the submitted payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Test' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /^senior$/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^staff$/i }))
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.seniority).toEqual(['senior', 'staff'])
  })

  it('shows a summary of set preferences on the review step', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.type(screen.getByLabelText(/target roles/i), 'Data Analyst')
    await userEvent.click(screen.getByRole('checkbox', { name: /^senior$/i }))
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByText('Data Analyst')).toBeInTheDocument()
    expect(screen.getByText('senior')).toBeInTheDocument()
  })

  it('shows a Back button that returns to the previous step', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Sources')
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Location')
  })
})
