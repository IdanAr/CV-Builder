// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HowItWorksSection } from './HowItWorksSection'

describe('HowItWorksSection', () => {
  it('renders all four steps in order', () => {
    render(<HowItWorksSection />)
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Start or Upload', 'Edit & Enhance', 'ATS Check', 'Export & Apply'])
  })
})
