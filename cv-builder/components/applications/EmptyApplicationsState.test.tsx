// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyApplicationsState } from './EmptyApplicationsState'

describe('EmptyApplicationsState', () => {
  it('offers a New Application CTA that does not require a resume', () => {
    const onCreate = vi.fn()
    render(<EmptyApplicationsState onCreate={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: 'New Application' }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('points at the resume-based entry path, referencing the CV card Track action', () => {
    render(<EmptyApplicationsState onCreate={vi.fn()} />)
    expect(screen.getByRole('link', { name: /My CVs/i })).toHaveAttribute('href', '/dashboard')
    // References ResumeCard's Track button generically (no emoji) — see components/ResumeCard.tsx.
    expect(screen.getByText(/Track.*on any CV card/)).toBeInTheDocument()
  })
})
