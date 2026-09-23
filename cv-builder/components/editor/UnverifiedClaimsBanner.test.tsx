// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UnverifiedClaimsBanner } from './UnverifiedClaimsBanner'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('UnverifiedClaimsBanner', () => {
  it('stays out of the way when nothing was flagged', () => {
    const { container } = render(<UnverifiedClaimsBanner resumeId="r1" claims={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names every unverified claim so the user can check them', () => {
    render(<UnverifiedClaimsBanner resumeId="r1" claims={['40%', 'Kubernetes']} />)

    expect(screen.getByText('2 claims in this draft were written by AI and not verified')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('Kubernetes')).toBeInTheDocument()
  })

  it('clears the flag only after the write succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    render(<UnverifiedClaimsBanner resumeId="r1" claims={['40%']} />)

    fireEvent.click(screen.getByRole('button', { name: /checked these/i }))

    await waitFor(() => expect(screen.queryByText('40%')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/resumes/r1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ pendingApprovals: [] }),
    }))
  })

  it('keeps warning when the write fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<UnverifiedClaimsBanner resumeId="r1" claims={['40%']} />)

    fireEvent.click(screen.getByRole('button', { name: /checked these/i }))

    // Hiding the warning on a failed save would leave unverified claims
    // unflagged in a document the user is about to send out.
    expect(await screen.findByText('Could not save that. Try again.')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
  })
})
