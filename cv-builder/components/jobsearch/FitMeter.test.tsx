// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FitMeter, fitBand, STRONG_FIT, FAIR_FIT } from './FitMeter'

describe('fitBand', () => {
  it('reads a high score as success, a fair one as accent, a weak one as warning', () => {
    expect(fitBand(91).text).toBe('text-fg-success')
    expect(fitBand(78).text).toBe('text-fg-body')
    expect(fitBand(64).text).toBe('text-fg-warning')
  })

  it('fills one more segment per band', () => {
    expect(fitBand(85).filled).toBe(3)
    expect(fitBand(84).filled).toBe(2)
    expect(fitBand(69).filled).toBe(1)
  })

  it('puts the "strong fit" filter above the default profile threshold', () => {
    // DEFAULT_MIN_ATS_SCORE is 75; a "strong" filter at or below it would
    // select everything the scan already kept, which is no filter at all.
    expect(STRONG_FIT).toBeGreaterThan(75)
    expect(FAIR_FIT).toBeLessThan(STRONG_FIT)
  })
})

describe('FitMeter', () => {
  it('shows the score and states the unit for screen readers', () => {
    render(<FitMeter score={82} />)

    expect(screen.getByText('82')).toBeInTheDocument()
    // The bare number is meaningless without the unit, which is why the
    // percentage is announced rather than drawn.
    expect(screen.getByText('82% match')).toBeInTheDocument()
  })
})
