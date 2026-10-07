// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PipelineFilters, type ProfileOption } from './PipelineFilters'

const profiles: ProfileOption[] = [
  { _id: 'a', name: 'Frontend', isActive: true },
  { _id: 'b', name: 'Backend', isActive: false },
]

function setup(over: Partial<React.ComponentProps<typeof PipelineFilters>> = {}) {
  const props = {
    profiles, profile: null, q: '', scanning: false, scanLabel: 'Scan now',
    onProfileChange: vi.fn(), onQueryChange: vi.fn(), onScan: vi.fn(), ...over,
  }
  render(<PipelineFilters {...props} />)
  return props
}

describe('PipelineFilters', () => {
  it('lists profiles and marks paused ones', () => {
    setup()
    expect(screen.getByRole('option', { name: 'All profiles' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Backend (paused)' })).toBeTruthy()
  })

  it('fires profile changes, null for all', async () => {
    const p = setup({ profile: 'a' })
    await userEvent.selectOptions(screen.getByLabelText('Profile'), 'b')
    expect(p.onProfileChange).toHaveBeenCalledWith('b')
    await userEvent.selectOptions(screen.getByLabelText('Profile'), '')
    expect(p.onProfileChange).toHaveBeenLastCalledWith(null)
  })

  it('fires query changes on every input', async () => {
    const p = setup()
    await userEvent.type(screen.getByLabelText('Search jobs'), 'ab')
    expect(p.onQueryChange).toHaveBeenCalledTimes(2)
  })

  it('scans, and disables while scanning', async () => {
    const p = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Scan now' }))
    expect(p.onScan).toHaveBeenCalled()
  })

  it('shows Scanning… and disables the button', () => {
    setup({ scanning: true })
    const btn = screen.getByRole('button', { name: 'Scanning…' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
