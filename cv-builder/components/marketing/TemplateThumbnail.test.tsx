// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateThumbnail } from './TemplateThumbnail'

describe('TemplateThumbnail', () => {
  it('renders the requested template with the sample data', () => {
    render(<TemplateThumbnail templateId="modern" />)
    expect(screen.getByText('Jordan Avery')).toBeInTheDocument()
  })

  it('renders each supported template id without throwing', () => {
    const ids = ['classic', 'minimal', 'modern', 'executive', 'sidebar'] as const
    for (const templateId of ids) {
      const { unmount } = render(<TemplateThumbnail templateId={templateId} />)
      expect(screen.getByText('Jordan Avery')).toBeInTheDocument()
      unmount()
    }
  })

  it('clips content to the given height', () => {
    render(<TemplateThumbnail templateId="classic" height={300} data-testid="thumb" />)
    const clip = screen.getByTestId('thumb')
    expect(clip).toHaveStyle({ height: '300px' })
  })
})
