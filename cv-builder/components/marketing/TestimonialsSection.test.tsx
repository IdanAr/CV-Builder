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

  it('renders all four testimonial quotes inside an auto-scrolling strip', () => {
    // Marquee duplicates its content once for a seamless loop (see Marquee.tsx),
    // so each testimonial appears twice in the DOM — 8 blockquotes total.
    const { container } = render(<TestimonialsSection />)
    expect(screen.getByRole('region', { name: /success stories/i })).toBeInTheDocument()
    expect(container.querySelectorAll('blockquote').length).toBe(8)
  })

  it('renders a 5-star rating widget under every testimonial (including its duplicate copy)', () => {
    const { container } = render(<TestimonialsSection />)
    const ratings = container.querySelectorAll('[aria-label="5 out of 5 stars"]')
    expect(ratings).toHaveLength(8)
    for (const rating of ratings) {
      // 5 filled star icons, no partial/empty ones for a 5-star rating
      expect(rating.querySelectorAll('svg')).toHaveLength(5)
    }
  })
})
