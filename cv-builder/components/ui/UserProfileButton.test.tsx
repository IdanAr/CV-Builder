// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProfileButton } from './UserProfileButton'
import { signOut } from 'next-auth/react'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}))

const user = { name: 'Idan Arbel', email: 'idan@example.com', image: null }

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

  it('opens dropdown on trigger click', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('dropdown contains Terms and Sign Out', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByRole('menuitem', { name: /terms/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('closes dropdown on outside mousedown', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes dropdown on Escape key', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('moves focus into the menu on open and supports arrow-key navigation', async () => {
    render(<UserProfileButton user={user} />)
    await userEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(items[1]).toHaveFocus()
  })

  it('returns focus to the trigger button when Escape closes the menu', async () => {
    render(<UserProfileButton user={user} />)
    const trigger = screen.getByRole('button', { name: /open user menu/i })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('calls signOut with callbackUrl /signin', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))
    expect(vi.mocked(signOut)).toHaveBeenCalledWith({ callbackUrl: '/signin' })
  })

  // The modal these replaced held ~120 lines of legal copy duplicating
  // app/terms/page.tsx, and the two had diverged — 11 sections against 15, with
  // Eligibility, Termination and Governing Law appearing only on the page. A
  // signed-in user was reading a different agreement from a visitor.
  it('links Terms to the canonical page instead of duplicating it', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    expect(screen.getByRole('menuitem', { name: /terms/i })).toHaveAttribute('href', '/terms')
  })

  // The guard against the duplicate coming back. Copy is easy to paste into a
  // component again; a dialog appearing here is the signal that it has.
  it('renders no dialog of its own', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the menu when Terms is chosen', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
