// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppNavbar } from './AppNavbar'

describe('AppNavbar', () => {
  it('renders the logo mark', () => {
    const { container } = render(<AppNavbar />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders provided actions', () => {
    render(<AppNavbar actions={<button>Save</button>} />)
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('allows the actions row to wrap instead of overflowing below the breakpoint', () => {
    render(<AppNavbar actions={<button>Action 1</button>} />)
    const actionsRow = screen.getByText('Action 1').closest('div')
    expect(actionsRow?.className).toMatch(/flex-wrap/)
  })

  it('hides the wordmark text below the narrow breakpoint but keeps it at wider sizes', () => {
    render(<AppNavbar />)
    const wordmark = screen.getByText('CV Builder')
    expect(wordmark.className).toMatch(/hidden/)
    // Some responsive prefix (e.g. sm:/md:) must re-show it at wider viewports.
    expect(wordmark.className).toMatch(/:(inline|block|flex)/)
  })

  it('keeps the logo mark visible regardless of the wordmark visibility class', () => {
    render(<AppNavbar />)
    const svg = document.querySelector('svg')
    expect(svg?.className.baseVal ?? '').not.toMatch(/^hidden/)
  })

  it('defaults the logo link to /dashboard when homeHref is omitted', () => {
    render(<AppNavbar />)
    expect(screen.getByLabelText('CV Builder home')).toHaveAttribute('href', '/dashboard')
  })

  it('points the logo link at homeHref when provided', () => {
    render(<AppNavbar homeHref="/" />)
    expect(screen.getByLabelText('CV Builder home')).toHaveAttribute('href', '/')
  })
})
