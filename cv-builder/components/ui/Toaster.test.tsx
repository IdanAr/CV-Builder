/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Toaster } from './Toaster'
import { useToastStore, toast } from '@/lib/stores/toast.store'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('Toaster', () => {
  it('renders toasts inside an aria-live region', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved') })
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('auto-dismisses after the toast duration', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved') })
    act(() => { vi.advanceTimersByTime(5100) })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('invokes onAction and dismisses when the action button is clicked', () => {
    render(<Toaster />)
    const onAction = vi.fn()
    act(() => { toast.withAction('Deleted "My CV"', 'Undo', onAction) })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByText('Deleted "My CV"')).not.toBeInTheDocument()
  })

  it('dismisses when the close button is clicked', () => {
    render(<Toaster />)
    act(() => { toast.error('Failed') })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Failed')).not.toBeInTheDocument()
  })

  it('pauses the dismiss timer on hover and resumes with remaining time (not a full reset)', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved') })
    const toastEl = screen.getByText('Saved').parentElement!

    // 4s of the 5s default duration elapse — 1s remaining.
    act(() => { vi.advanceTimersByTime(4000) })
    fireEvent.mouseEnter(toastEl)

    // Advance well past the 1s that was remaining — should stay visible while paused.
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Saved')).toBeInTheDocument()

    fireEvent.mouseLeave(toastEl)

    // Not quite the ~1s remaining — still visible.
    act(() => { vi.advanceTimersByTime(900) })
    expect(screen.getByText('Saved')).toBeInTheDocument()

    // Past the remaining time — now dismissed.
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('pauses the dismiss timer while an element inside the toast has focus', () => {
    render(<Toaster />)
    act(() => { toast.success('Saved') })

    act(() => { vi.advanceTimersByTime(4000) })
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss notification' })
    fireEvent.focus(dismissBtn)

    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Saved')).toBeInTheDocument()

    fireEvent.blur(dismissBtn)

    act(() => { vi.advanceTimersByTime(1100) })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
