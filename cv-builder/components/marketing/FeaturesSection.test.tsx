// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeaturesSection } from './FeaturesSection'

describe('FeaturesSection', () => {
  it('renders all three feature titles', () => {
    render(<FeaturesSection />)
    expect(screen.getByRole('heading', { name: /write with ai/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /ats optimization & scoring/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /track your success/i })).toBeInTheDocument()
  })
})
