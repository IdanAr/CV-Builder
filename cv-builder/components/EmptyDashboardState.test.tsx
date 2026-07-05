// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyDashboardState } from './EmptyDashboardState'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('EmptyDashboardState', () => {
  it('renders both primary actions as buttons', () => {
    render(<EmptyDashboardState />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new cv|start/i })).toBeInTheDocument()
  })

  it('explains the value of each path', () => {
    render(<EmptyDashboardState />)
    expect(screen.getAllByText(/ATS/i).length).toBeGreaterThan(0)
  })
})
