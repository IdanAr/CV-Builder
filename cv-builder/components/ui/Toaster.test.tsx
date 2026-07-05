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
})
