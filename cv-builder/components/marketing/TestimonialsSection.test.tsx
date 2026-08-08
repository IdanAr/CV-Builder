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

  it('renders three testimonial quotes', () => {
    const { container } = render(<TestimonialsSection />)
    expect(container.querySelectorAll('blockquote').length).toBe(3)
  })
})
