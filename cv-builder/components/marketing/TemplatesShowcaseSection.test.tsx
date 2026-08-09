// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplatesShowcaseSection } from './TemplatesShowcaseSection'

// Real templates style differently — e.g. MinimalTemplate hardcodes its
// section-title color and ignores `meta` entirely for it — so asserting on
// deep rendered colors here would be fragile and template-implementation-
// specific. Test the contract instead: what colors does this section pass
// to TemplateThumbnail per template?
vi.mock('./TemplateThumbnail', () => ({
  TemplateThumbnail: ({
    templateId,
    colors,
  }: {
    templateId: string
    colors?: { primaryColor: string; accentColor: string }
  }) => (
    <div data-testid={`thumb-${templateId}`} data-primary-color={colors?.primaryColor} data-accent-color={colors?.accentColor} />
  ),
}))

describe('TemplatesShowcaseSection', () => {
  it('renders the section heading', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('heading', { name: /templates designed by recruiters/i })).toBeInTheDocument()
  })

  it('renders a labeled slide for all five templates inside a carousel', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('region', { name: /template previews/i })).toBeInTheDocument()
    for (const label of ['Classic', 'Minimal', 'Modern', 'Executive', 'Sidebar']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('renders a CTA linking to /signin', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('link', { name: /preview all templates/i })).toHaveAttribute('href', '/signin')
  })

  it('gives every template a distinct, non-default color scheme', () => {
    render(<TemplatesShowcaseSection />)
    const ids = ['classic', 'minimal', 'modern', 'executive', 'sidebar']
    const pairs = ids.map((id) => {
      const el = screen.getByTestId(`thumb-${id}`)
      return `${el.dataset.primaryColor}-${el.dataset.accentColor}`
    })
    for (const pair of pairs) {
      expect(pair).not.toBe('undefined-undefined')
    }
    expect(new Set(pairs).size).toBe(pairs.length) // every template gets a unique pair
  })
})
