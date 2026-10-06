// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppNavbar } from './AppNavbar'

describe('AppNavbar', () => {
  it('renders the logo mark', () => {
    const { container } = render(<AppNavbar />)
    expect(container.querySelector('a[aria-label="CV Builder home"] [aria-hidden="true"]')).toHaveTextContent('CV')
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
    const mark = document.querySelector('a[aria-label="CV Builder home"] [aria-hidden="true"]')
    expect(mark?.className ?? '').not.toMatch(/(^|\s)hidden(\s|$)/)
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

describe('AppNavbar logo placement', () => {
  // Measured in a real browser at a 500px viewport before this fix: the
  // dashboard navbar overflowed to 651px, leaving "Job Search" and the profile
  // button off-screen and unreachable, while the absolutely-centred logo was
  // drawn on top of the "Homepage" link.
  //
  // The overflow came from the *pages*, which each nested a non-wrapping
  // `flex items-center gap-3` row inside AppNavbar's own wrapping slot. But
  // letting those rows wrap is only half the fix: a logo pinned to the centre
  // at every width then sits on top of whatever wraps underneath it. So below
  // `md` the logo joins the flow, and only from `md` up is it centred.
  it('joins the flow below md so it cannot overlap a wrapped actions row', () => {
    const { container } = render(<AppNavbar />)
    const logo = container.querySelector('a[aria-label="CV Builder home"]')!
    const classes = logo.className

    // Unprefixed absolute positioning is exactly what caused the overlap.
    expect(classes).not.toMatch(/(^|\s)absolute(\s|$)/)
    expect(classes).toMatch(/(^|\s)order-first(\s|$)/)
  })

  it('is centred again from md up', () => {
    const { container } = render(<AppNavbar />)
    const classes = container.querySelector('a[aria-label="CV Builder home"]')!.className
    expect(classes).toMatch(/md:absolute/)
    expect(classes).toMatch(/md:left-1\/2/)
    expect(classes).toMatch(/md:-translate-x-1\/2/)
  })

  // A tall mark in a short bar leaves no room once the actions wrap.
  it('uses a compact mark below md and a slightly larger one above', () => {
    const { container } = render(<AppNavbar />)
    const mark = container.querySelector('a[aria-label="CV Builder home"] [aria-hidden="true"]')!
    expect(mark.className).toMatch(/h-8 w-8/)
    expect(mark.className).toMatch(/md:h-9 md:w-9/)
  })
})

describe('AppNavbar flat styling', () => {
  it('has no gradient wordmark and no purple hex fills', () => {
    const { container } = render(<AppNavbar />)
    expect(container.innerHTML).not.toContain('bg-gradient')
    expect(container.innerHTML).not.toMatch(/#7C3AED|#A78BFA/i)
  })

  it('is an opaque bar with a hairline border and no blur', () => {
    render(<AppNavbar />)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav.className).toContain('bg-surface')
    expect(nav.className).toContain('border-border')
    expect(nav.className).not.toContain('backdrop-blur')
  })
})
