// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplatesShowcaseSection } from './TemplatesShowcaseSection'

describe('TemplatesShowcaseSection', () => {
  it('renders the section heading', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('heading', { name: /templates designed by recruiters/i })).toBeInTheDocument()
  })

  it('renders a labeled card for all five templates', () => {
    render(<TemplatesShowcaseSection />)
    for (const label of ['Classic', 'Minimal', 'Modern', 'Executive', 'Sidebar']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders a CTA linking to /signin', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('link', { name: /preview all templates/i })).toHaveAttribute('href', '/signin')
  })
})
