// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyApplicationsState } from './EmptyApplicationsState'

describe('EmptyApplicationsState', () => {
  it('offers a New Application CTA that does not require a resume', () => {
    const onCreate = vi.fn()
    render(<EmptyApplicationsState onCreate={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: '+ New Application' }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('points at the resume-based entry path, quoting the CV card button label verbatim', () => {
    render(<EmptyApplicationsState onCreate={vi.fn()} />)
    expect(screen.getByRole('link', { name: /My CVs/i })).toHaveAttribute('href', '/dashboard')
    // Matches ResumeCard's actual visible button text ("📋 Track"), not a
    // paraphrase — see components/ResumeCard.tsx.
    expect(screen.getByText(/📋 Track/)).toBeInTheDocument()
  })
})
