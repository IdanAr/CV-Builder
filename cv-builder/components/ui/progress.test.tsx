// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress } from './progress'

describe('Progress', () => {
  it('exposes the current value on the progressbar role', () => {
    render(<Progress value={42} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '42')
  })

  it('applies indicatorClassName to the indicator element', () => {
    render(<Progress value={10} indicatorClassName="bg-indigo-600" />)
    const bar = screen.getByRole('progressbar')
    const indicator = bar.querySelector('[data-slot="progress-indicator"]')
    expect(indicator?.className).toContain('bg-indigo-600')
  })
})
