// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppNavbar } from './AppNavbar'

describe('AppNavbar', () => {
  it('renders the brand logo inside the home link', () => {
    const { container } = render(<AppNavbar />)
    const imgs = container.querySelectorAll('a[aria-label="CVitae Studio home"] img')
    const srcs = [...imgs].map(i => decodeURIComponent(i.getAttribute('src') ?? ''))
    expect(srcs.some(s => s.includes('cvitae-mark-light.svg'))).toBe(true)
    expect(srcs.some(s => s.includes('cvitae-studio-horizontal-light.svg'))).toBe(true)
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

  it('shows the compact mark below md and the full lockup from md up', () => {
    const { container } = render(<AppNavbar />)
    const [mark, lockup] = [...container.querySelectorAll('a[aria-label="CVitae Studio home"] img')]
    expect(mark.className).toMatch(/(^|\s)md:hidden(\s|$)/)
    expect(lockup.className).toMatch(/(^|\s)hidden(\s|$)/)
    expect(lockup.className).toMatch(/md:block/)
  })

  it('defaults the logo link to /dashboard when homeHref is omitted', () => {
    render(<AppNavbar />)
    expect(screen.getByLabelText('CVitae Studio home')).toHaveAttribute('href', '/dashboard')
  })

  it('points the logo link at homeHref when provided', () => {
    render(<AppNavbar homeHref="/" />)
    expect(screen.getByLabelText('CVitae Studio home')).toHaveAttribute('href', '/')
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
    const logo = container.querySelector('a[aria-label="CVitae Studio home"]')!
    const classes = logo.className

    // Unprefixed absolute positioning is exactly what caused the overlap.
    expect(classes).not.toMatch(/(^|\s)absolute(\s|$)/)
    expect(classes).toMatch(/(^|\s)order-first(\s|$)/)
  })

  it('is centred again from md up', () => {
    const { container } = render(<AppNavbar />)
    const classes = container.querySelector('a[aria-label="CVitae Studio home"]')!.className
    expect(classes).toMatch(/md:absolute/)
    expect(classes).toMatch(/md:left-1\/2/)
    expect(classes).toMatch(/md:-translate-x-1\/2/)
  })

  // A tall logo in a short bar leaves no room once the actions wrap.
  it('keeps the logo at a fixed 32px height', () => {
    const { container } = render(<AppNavbar />)
    for (const img of container.querySelectorAll('a[aria-label="CVitae Studio home"] img')) {
      expect(img.className).toMatch(/(^|\s)h-8(\s|$)/)
    }
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
