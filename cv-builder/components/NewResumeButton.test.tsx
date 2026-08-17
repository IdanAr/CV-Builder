// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewResumeButton from './NewResumeButton'
import { useToastStore } from '@/lib/stores/toast.store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('NewResumeButton', () => {
  it('shows an error toast and re-enables the button when create fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    render(<NewResumeButton />)
    fireEvent.click(screen.getByRole('button', { name: 'New CV' }))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(t => t.variant === 'error')).toBe(true)
    })
    expect(screen.getByRole('button', { name: 'New CV' })).toBeEnabled()
  })
})
