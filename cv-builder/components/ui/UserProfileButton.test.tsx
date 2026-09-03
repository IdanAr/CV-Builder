// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfileButton } from './UserProfileButton'
import { signOut } from 'next-auth/react'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const user = { name: 'Idan Arbel', email: 'idan@example.com', image: null }

// These tests open the menu with userEvent rather than fireEvent. That is not
// cosmetic: the menu now opens on `pointerdown` (which is what makes it
// dismissable by touch), and fireEvent.click dispatches a bare click with no
// preceding pointer events, so it would no longer open the menu at all. Driving
// it the way a real user does is also the more honest test.
async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: /open user menu/i }))
}

describe('UserProfileButton', () => {
  beforeEach(() => {
    vi.mocked(signOut).mockClear()
  })

  it('renders the first name in the trigger pill', () => {
    render(<UserProfileButton user={user} />)
    expect(screen.getByText('Idan')).toBeInTheDocument()
  })

  it('renders 2-char uppercase initials when no image', () => {
    render(<UserProfileButton user={user} />)
    expect(screen.getByText('IA')).toBeInTheDocument()
  })

  it('dropdown is hidden on mount', () => {
    render(<UserProfileButton user={user} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens dropdown on trigger click', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('dropdown contains Terms and Sign Out', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    expect(screen.getByRole('menuitem', { name: /terms/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('closes dropdown on an outside press', async () => {
    render(
      <>
        <UserProfileButton user={user} />
        <button>Outside</button>
      </>
    )
    await openMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes dropdown on Escape key', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // Written against the item count rather than a hard-coded two, because this
  // menu grows: it was Terms and Sign Out, then Settings landed and the old
  // assertion that a second ArrowDown wrapped to the top became false.
  //
  // Opened from the keyboard, because that is the case the assertion is about.
  // A keyboard open focuses the first item; a pointer open deliberately focuses
  // the panel instead, so that a mouse user gets no highlighted row they never
  // asked for. Both then respond to arrow keys.
  it('moves focus into the menu on keyboard open and supports arrow-key navigation', async () => {
    render(<UserProfileButton user={user} />)
    screen.getByRole('button', { name: /open user menu/i }).focus()
    await userEvent.keyboard('{Enter}')

    const items = screen.getAllByRole('menuitem')
    expect(items.length).toBeGreaterThan(1)

    expect(items[0]).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()

    // Down from the last item wraps to the first.
    for (let i = 1; i < items.length; i++) await userEvent.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()

    // Up from the first wraps to the last.
    await userEvent.keyboard('{ArrowUp}')
    expect(items[items.length - 1]).toHaveFocus()
  })

  // A pointer open leaves focus on the panel, but the menu must still be
  // navigable from there — otherwise a user who opened with the mouse and then
  // reached for the keyboard would be stranded.
  it('reaches the first item with one arrow press after a pointer open', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
  })

  it('returns focus to the trigger button when Escape closes the menu', async () => {
    render(<UserProfileButton user={user} />)
    const trigger = screen.getByRole('button', { name: /open user menu/i })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('calls signOut with callbackUrl /signin', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))
    expect(vi.mocked(signOut)).toHaveBeenCalledWith({ callbackUrl: '/signin' })
  })

  // The modal these replaced held ~120 lines of legal copy duplicating
  // app/terms/page.tsx, and the two had diverged — 11 sections against 15, with
  // Eligibility, Termination and Governing Law appearing only on the page. A
  // signed-in user was reading a different agreement from a visitor.
  it('links Terms to the canonical page instead of duplicating it', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    expect(screen.getByRole('menuitem', { name: /terms/i })).toHaveAttribute('href', '/terms')
  })

  // The guard against the duplicate coming back. Copy is easy to paste into a
  // component again; a dialog appearing here is the signal that it has.
  it('renders no dialog of its own', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the menu when Terms is chosen', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // The audit found the profile menu held exactly two items — Terms and Sign
  // Out — while the privacy policy promised data access and deletion rights
  // with nowhere to exercise them. This is the way in.
  it('offers a way into account settings', async () => {
    render(<UserProfileButton user={user} />)
    await openMenu()
    expect(screen.getByRole('menuitem', { name: /settings/i })).toHaveAttribute(
      'href',
      '/dashboard/settings'
    )
  })
})
