// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingsLoading from './loading'

describe('settings loading', () => {
  it('announces itself, shares the page frame and shows card skeletons', () => {
    const { container } = render(<SettingsLoading />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading settings')
    expect(status.className).toContain('mx-auto max-w-2xl px-4 py-8')
    expect(container.querySelectorAll('.rounded-card').length).toBeGreaterThanOrEqual(3)
  })
})
