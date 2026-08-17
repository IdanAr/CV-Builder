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

  it('dropdown contains Terms & Conditions and Sign Out', () => {
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

  it('opens Terms modal when Terms & Conditions is clicked', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    expect(screen.getByRole('heading', { name: /terms & conditions/i })).toBeInTheDocument()
    expect(screen.getByText(/acceptance of terms/i)).toBeInTheDocument()
  })

  it('closes Terms modal on backdrop click', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    fireEvent.click(screen.getByTestId('terms-backdrop'))
    expect(screen.queryByRole('heading', { name: /terms & conditions/i })).not.toBeInTheDocument()
  })

  it('closes Terms modal on close button', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    fireEvent.click(screen.getByRole('button', { name: /close terms/i }))
    expect(screen.queryByRole('heading', { name: /terms & conditions/i })).not.toBeInTheDocument()
  })

  it('closes Terms modal on Escape key', () => {
    render(<UserProfileButton user={user} />)
    fireEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('heading', { name: /terms & conditions/i })).not.toBeInTheDocument()
  })

  it('wraps focus from the last focusable element to the first on Tab', async () => {
    render(<UserProfileButton user={user} />)
    await userEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    const closeButton = screen.getByRole('button', { name: /close terms/i })
    const mailLink = screen.getByRole('link', { name: /idan.rbel@gmail.com/i })
    mailLink.focus()
    expect(mailLink).toHaveFocus()
    await userEvent.tab()
    expect(closeButton).toHaveFocus()
  })

  it('wraps focus from the first focusable element to the last on Shift+Tab', async () => {
    render(<UserProfileButton user={user} />)
    await userEvent.click(screen.getByRole('button', { name: /open user menu/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /terms/i }))
    const closeButton = screen.getByRole('button', { name: /close terms/i })
    const mailLink = screen.getByRole('link', { name: /idan.rbel@gmail.com/i })
    expect(closeButton).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(mailLink).toHaveFocus()
  })
})
