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

  it('shows the reference, uses an h1 and token-based controls', () => {
    render(<DashboardError error={Object.assign(new Error('x'), { digest: 'abc123' })} reset={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
    for (const el of [screen.getByRole('button', { name: 'Try again' }), screen.getByRole('link', { name: 'Back to dashboard' })]) {
      expect(el.className).not.toMatch(/accent-|rounded-(lg|xl)/)
    }
  })

  it('does not claim the full viewport height, since it renders inside the shell', () => {
    const { container } = render(<DashboardError error={new Error('boom')} reset={vi.fn()} />)
    expect((container.firstElementChild as HTMLElement).className).not.toContain('min-h-screen')
  })
})
