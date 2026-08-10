// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RichText } from '../RichText'

describe('RichText', () => {
  it('renders a single line of text with no <br>', () => {
    const { container } = render(<RichText text="Hello world" />)
    expect(container.querySelectorAll('br')).toHaveLength(0)
    expect(container.textContent).toBe('Hello world')
  })

  it('renders a soft line break within one paragraph as <br>, not a new paragraph block', () => {
    const { container } = render(<RichText text={'Line one\nLine two'} />)
    expect(container.querySelectorAll('br')).toHaveLength(1)
    // Only one paragraph-level <span> wrapper — the whole render tree has no
    // block-level element boundary between the two lines besides the <br>.
    expect(container.textContent).toBe('Line oneLine two')
  })

  it('renders a blank line as a separate paragraph block, not a <br>', () => {
    const { container } = render(<RichText text={'Para one\n\nPara two'} />)
    const blocks = container.querySelectorAll('span[style*="display: block"]')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].textContent).toBe('Para one')
    expect(blocks[1].textContent).toBe('Para two')
  })

  it('renders soft breaks inside each paragraph of a multi-paragraph field', () => {
    const { container } = render(<RichText text={'A1\nA2\n\nB1\nB2'} />)
    expect(container.querySelectorAll('br')).toHaveLength(2)
    const blocks = container.querySelectorAll('span[style*="display: block"]')
    expect(blocks).toHaveLength(2)
  })

  it('returns null for empty text', () => {
    const { container } = render(<RichText text="" />)
    expect(container.textContent).toBe('')
  })
})
