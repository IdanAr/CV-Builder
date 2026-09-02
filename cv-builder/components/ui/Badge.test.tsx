// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Badge, type BadgeTone } from './Badge'

afterEach(cleanup)

const TONES: BadgeTone[] = ['accent', 'neutral', 'danger', 'success', 'warning']

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>Applied</Badge>)
    expect(screen.getByText('Applied')).toBeTruthy()
  })

  it.each(TONES)('%s pairs a surface with a foreground', (tone) => {
    const { container } = render(<Badge tone={tone}>Status</Badge>)
    const classes = (container.firstChild as HTMLElement).className
    expect(classes).toMatch(/\bbg-/)
    expect(classes).toMatch(/\btext-fg-/)
  })

  it('defaults to the accent tone', () => {
    const { container } = render(<Badge>Draft</Badge>)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('bg-surface-subtle')
    expect(classes).toContain('text-fg-body')
  })

  // Company and role names run long, and a pill that grows without bound
  // pushes the rest of a Kanban card off screen.
  it('truncates rather than growing past its container', () => {
    const { container } = render(<Badge>A very long company name</Badge>)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('truncate')
    expect(classes).toContain('max-w-full')
  })

  it('lets a caller override a tone utility rather than colliding with it', () => {
    const { container } = render(<Badge tone="danger" className="bg-surface" />)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('bg-surface')
    expect(classes).not.toContain('bg-surface-danger')
  })

  it('passes DOM props through, so a badge can carry its own semantics', () => {
    render(<Badge data-testid="unread" role="status" aria-label="3 unread jobs" />)
    expect(screen.getByTestId('unread').getAttribute('role')).toBe('status')
  })
})
