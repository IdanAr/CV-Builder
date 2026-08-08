// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialProofSection } from './SocialProofSection'

describe('SocialProofSection', () => {
  it('renders the trust headline', () => {
    render(<SocialProofSection />)
    expect(screen.getByText(/helping thousands land jobs at top companies/i)).toBeInTheDocument()
  })

  it('renders a row of placeholder wordmarks', () => {
    render(<SocialProofSection />)
    const list = screen.getByRole('list', { name: /companies/i })
    expect(list.children.length).toBeGreaterThanOrEqual(5)
  })
})
