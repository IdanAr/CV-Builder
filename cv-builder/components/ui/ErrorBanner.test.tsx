// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorBanner } from './ErrorBanner'

afterEach(cleanup)

describe('ErrorBanner', () => {
  // The point of the component. This markup existed eleven times across eight
  // files and ten copies omitted role="alert", so a failed scan or an unsaved
  // rule was shown but never announced.
  it('announces itself', () => {
    render(<ErrorBanner>Could not load your rules.</ErrorBanner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your rules.')
  })

  it('uses the danger tokens rather than raw red utilities', () => {
    render(<ErrorBanner>Boom</ErrorBanner>)
    const classes = screen.getByRole('alert').className.split(/\s+/)
    expect(classes).toContain('bg-surface-danger')
    expect(classes).toContain('text-fg-danger')
    expect(classes).not.toContain('bg-red-50')
    expect(classes).not.toContain('text-red-700')
  })

  it('lets a caller add layout classes without losing the tone', () => {
    render(<ErrorBanner className="mt-4">Boom</ErrorBanner>)
    const classes = screen.getByRole('alert').className.split(/\s+/)
    expect(classes).toContain('mt-4')
    expect(classes).toContain('bg-surface-danger')
  })

  it('passes DOM props through', () => {
    render(<ErrorBanner data-testid="scan-error">Boom</ErrorBanner>)
    expect(screen.getByTestId('scan-error').getAttribute('role')).toBe('alert')
  })
})
