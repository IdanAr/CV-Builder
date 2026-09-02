// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Card, type CardTone } from './Card'

afterEach(cleanup)

const TONES: CardTone[] = ['default', 'raised', 'outline']

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Panel body</Card>)
    expect(screen.getByText('Panel body')).toBeTruthy()
  })

  it.each(TONES)('%s is a distinct tone', (tone) => {
    const { container } = render(<Card tone={tone} />)
    const classes = (container.firstChild as HTMLElement).className
    expect(classes).toContain('rounded-card')
    expect(classes).toContain('border')
  })

  it('defaults to the translucent tone at medium padding', () => {
    const { container } = render(<Card />)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('bg-surface/70')
    expect(classes).toContain('p-4')
  })

  it('can drop padding entirely, for a card that owns its own layout', () => {
    const { container } = render(<Card padding="none" />)
    expect((container.firstChild as HTMLElement).className).not.toMatch(/\bp-\d/)
  })

  it('lets a caller override a tone utility rather than colliding with it', () => {
    const { container } = render(<Card padding="lg" className="p-0" />)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('p-0')
    expect(classes).not.toContain('p-6')
  })

  it('passes DOM props through', () => {
    render(<Card data-testid="panel" role="group" aria-label="Résumé design" />)
    expect(screen.getByTestId('panel').getAttribute('aria-label')).toBe('Résumé design')
  })
})
