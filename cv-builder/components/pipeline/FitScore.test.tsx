// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FitScore, STRONG_FIT } from './FitScore'

describe('FitScore', () => {
  it('colours strong fits and adds an sr-only companion', () => {
    render(<FitScore score={STRONG_FIT} />)
    const num = screen.getByText(String(STRONG_FIT))
    expect(num.className).toContain('text-fg-success')
    expect(num.className).toContain('font-medium')
    expect(screen.getByText(`${STRONG_FIT}% match`).className).toContain('sr-only')
  })

  it('leaves weaker fits in body colour', () => {
    render(<FitScore score={STRONG_FIT - 1} />)
    const num = screen.getByText(String(STRONG_FIT - 1))
    expect(num.className).toContain('text-fg-body')
    expect(num.className).not.toContain('text-fg-success')
  })

  it('renders nothing without a score', () => {
    const { container } = render(<FitScore />)
    expect(container.firstChild).toBeNull()
  })
})
