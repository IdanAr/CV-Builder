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
})
