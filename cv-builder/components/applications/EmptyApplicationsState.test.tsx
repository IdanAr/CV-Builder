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

  it('points at the resume-based entry path, referencing the Track application menu action', () => {
    render(<EmptyApplicationsState onCreate={vi.fn()} />)
    expect(screen.getByRole('link', { name: /My CVs/i })).toHaveAttribute('href', '/dashboard/cvs')
    // Names the "Track application" item in the CV library's row actions menu
    // (components/cvs/CvRowActions.tsx).
    expect(
      screen.getByText(/Use Track application in a CV's actions menu to create a pre-filled row linked to that CV\./)
    ).toBeInTheDocument()
  })
})
