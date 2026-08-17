// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Progress, ProgressCircle, ProgressRadial } from './progress'

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

describe('ProgressCircle', () => {
  it('exposes progressbar semantics', () => {
    render(<ProgressCircle value={60} />)
    const el = screen.getByRole('progressbar')
    expect(el).toHaveAttribute('aria-valuenow', '60')
    expect(el).toHaveAttribute('aria-valuemin', '0')
    expect(el).toHaveAttribute('aria-valuemax', '100')
  })
})

describe('ProgressRadial', () => {
  it('exposes progressbar semantics', () => {
    render(<ProgressRadial value={35} />)
    const el = screen.getByRole('progressbar')
    expect(el).toHaveAttribute('aria-valuenow', '35')
    expect(el).toHaveAttribute('aria-valuemin', '0')
    expect(el).toHaveAttribute('aria-valuemax', '100')
  })
})
