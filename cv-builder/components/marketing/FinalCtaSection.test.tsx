// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinalCtaSection } from './FinalCtaSection'

describe('FinalCtaSection', () => {
  it('renders the closing headline and CTA linking to /signin', () => {
    render(<FinalCtaSection />)
    expect(screen.getByRole('heading', { name: /ready to land your dream job/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create your free cv/i })).toHaveAttribute('href', '/signin')
  })
})
