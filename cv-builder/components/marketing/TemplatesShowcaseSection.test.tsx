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
    decorative,
  }: {
    templateId: string
    colors?: { primaryColor: string; accentColor: string }
    decorative?: boolean
  }) => (
    <div
      data-testid={`thumb-${templateId}`}
      data-primary-color={colors?.primaryColor}
      data-accent-color={colors?.accentColor}
      data-decorative={String(decorative)}
    />
  ),
}))

describe('TemplatesShowcaseSection', () => {
  it('renders the section heading', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('heading', { name: /templates designed by recruiters/i })).toBeInTheDocument()
  })

  it('renders a labeled item for all five templates inside an auto-scrolling strip', () => {
    render(<TemplatesShowcaseSection />)
    expect(screen.getByRole('region', { name: /template previews/i })).toBeInTheDocument()
    // Marquee duplicates content for a seamless loop, so each label appears twice.
    for (const label of ['Classic', 'Minimal', 'Modern', 'Executive', 'Sidebar']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('labels the templates CTA to make the sign-in requirement explicit, linking to /signin', () => {
    render(<TemplatesShowcaseSection />)
    const cta = screen.getByRole('link', { name: /sign up to browse templates/i })
    expect(cta).toHaveAttribute('href', '/signin')
  })

  it('gives every template a distinct, non-default color scheme', () => {
    render(<TemplatesShowcaseSection />)
    const ids = ['classic', 'minimal', 'modern', 'executive', 'sidebar']
    const pairs = ids.map((id) => {
      const [el] = screen.getAllByTestId(`thumb-${id}`) // real copy, first in DOM order
      return `${el.dataset.primaryColor}-${el.dataset.accentColor}`
    })
    for (const pair of pairs) {
      expect(pair).not.toBe('undefined-undefined')
    }
    expect(new Set(pairs).size).toBe(pairs.length) // every template gets a unique pair
  })

  it('marks each template thumbnail as non-decorative primary content, so screen readers announce it', () => {
    render(<TemplatesShowcaseSection />)
    const ids = ['classic', 'minimal', 'modern', 'executive', 'sidebar']
    for (const id of ids) {
      const [el] = screen.getAllByTestId(`thumb-${id}`) // real copy, first in DOM order
      expect(el.dataset.decorative).toBe('false')
    }
  })
})
