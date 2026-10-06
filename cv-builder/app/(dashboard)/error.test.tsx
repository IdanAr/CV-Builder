// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DashboardError from './error'

describe('(dashboard) error boundary', () => {
  it('offers a retry and a way back to the dashboard', () => {
    const reset = vi.fn()
    render(<DashboardError error={new Error('boom')} reset={reset} />)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
  })

  it('does not claim the full viewport height, since it renders inside the shell', () => {
    const { container } = render(<DashboardError error={new Error('boom')} reset={vi.fn()} />)
    expect((container.firstElementChild as HTMLElement).className).not.toContain('min-h-screen')
  })
})
