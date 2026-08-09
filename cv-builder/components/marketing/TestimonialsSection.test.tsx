// @vitest-environment jsdom
// components/marketing/TestimonialsSection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestimonialsSection } from './TestimonialsSection'

describe('TestimonialsSection', () => {
  it('renders the section heading', () => {
    render(<TestimonialsSection />)
    expect(screen.getByRole('heading', { name: /success stories/i })).toBeInTheDocument()
  })

  it('renders all four testimonial quotes inside a carousel', () => {
    const { container } = render(<TestimonialsSection />)
    expect(screen.getByRole('region', { name: /success stories/i })).toBeInTheDocument()
    expect(container.querySelectorAll('blockquote').length).toBe(4)
  })

  it('renders a 5-star rating widget under every testimonial', () => {
    // Non-active carousel slides are `inert`/aria-hidden (by design — verified
    // in Carousel.test.tsx), so they're correctly excluded from accessibility
    // queries like getAllByRole. Query the DOM directly to confirm all 4
    // widgets exist regardless of which slide is currently active.
    const { container } = render(<TestimonialsSection />)
    const ratings = container.querySelectorAll('[aria-label="5 out of 5 stars"]')
    expect(ratings).toHaveLength(4)
    for (const rating of ratings) {
      // 5 filled star icons, no partial/empty ones for a 5-star rating
      expect(rating.querySelectorAll('svg')).toHaveLength(5)
    }
  })
})
