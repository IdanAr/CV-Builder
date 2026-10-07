// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardNotFound from './not-found'

describe('(dashboard) not-found', () => {
  it('is generic and keeps the user in the app', () => {
    const { container } = render(<DashboardNotFound />)
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeInTheDocument()
    expect(container.textContent).toContain('The link may be out of date, or the item may have been deleted.')
    expect(container.textContent).not.toMatch(/CV|résumé/i)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
  })
})
