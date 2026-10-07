// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from './not-found'

describe('root not-found', () => {
  it('keeps both links and drops the old gradient', () => {
    const { container } = render(<NotFound />)
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Homepage' })).toHaveAttribute('href', '/')
    const cls = (container.firstElementChild as HTMLElement).className
    expect(cls).not.toMatch(/from-indigo|to-violet/)
    expect(cls).toContain('bg-surface-page')
  })
})
