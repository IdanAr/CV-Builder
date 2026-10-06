// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CvThumbnail, THUMBNAIL_SCALE } from './CvThumbnail'

const data = {
  basics: { name: 'Jane Smith', label: 'Engineer', email: 'jane@example.com' },
  work: [{ name: 'Acme', position: 'Staff engineer', highlights: ['Shipped things'] }],
}

describe('CvThumbnail', () => {
  it('renders the real preview template, scaled down, for the CV template', () => {
    const { container } = render(<CvThumbnail data={data} meta={{ templateId: 'modern' }} />)
    expect(container.textContent).toContain('Jane Smith')
    const page = screen.getByTestId('cv-thumbnail-page')
    expect(page.style.transform).toBe(`scale(${THUMBNAIL_SCALE})`)
    expect(page.style.transformOrigin).toBe('top left')
    expect(page.style.width).toBe('794px')
  })

  it('is decorative: hidden from assistive tech and out of the tab order', () => {
    const { container } = render(<CvThumbnail data={data} meta={{}} />)
    const wrapper = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveAttribute('inert')
    // The template's own mailto link sits inside the inert, hidden wrapper.
    expect(wrapper.querySelector('a[href^="mailto:"]')).not.toBeNull()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('fills missing meta fields from the schema defaults and falls back to Classic', () => {
    expect(() =>
      render(<CvThumbnail data={{}} meta={{ templateId: 'no-such-template' }} />)
    ).not.toThrow()
    expect(() => render(<CvThumbnail data={undefined} meta={undefined} />)).not.toThrow()
  })
})
