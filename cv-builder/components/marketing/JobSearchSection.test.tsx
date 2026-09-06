// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobSearchSection } from './JobSearchSection'

describe('JobSearchSection', () => {
  it('renders a section heading', () => {
    render(<JobSearchSection />)
    expect(
      screen.getByRole('heading', { level: 2, name: /find your next role/i })
    ).toBeInTheDocument()
  })

  it('renders all four capability headings', () => {
    render(<JobSearchSection />)
    expect(screen.getByRole('heading', { name: /automated scanning/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instant fit score/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /smart rules/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /you stay in control/i })).toBeInTheDocument()
  })

  it('makes clear applications are never submitted without approval', () => {
    render(<JobSearchSection />)
    expect(screen.getByText(/nothing (is )?(sent|submitted)/i)).toBeInTheDocument()
  })

  it('links its call to action to sign in', () => {
    render(<JobSearchSection />)
    const link = screen.getByRole('link', { name: /set up job search/i })
    expect(link).toHaveAttribute('href', '/signin')
  })

  it('hides its illustrative match-list mockup from assistive tech', () => {
    const { container } = render(<JobSearchSection />)
    const mock = container.querySelector('[data-jobsearch-mock]')
    expect(mock).toHaveAttribute('aria-hidden', 'true')
  })
})
