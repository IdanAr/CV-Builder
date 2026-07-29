// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RichText } from '../RichText'

describe('RichText (preview)', () => {
  it('renders each paragraph of a blank-line-separated field as its own block', () => {
    const { container } = render(<RichText text={'First para.\n\nSecond para.'} />)
    const blocks = Array.from(container.children) as HTMLElement[]
    expect(blocks).toHaveLength(2)
    expect(blocks[0].textContent).toBe('First para.')
    expect(blocks[1].textContent).toBe('Second para.')
    expect(blocks[1].style.display).toBe('block')
    // Every paragraph after the first is spaced from the one above it.
    expect(blocks[1].style.marginTop).not.toBe('')
  })

  it('renders single-paragraph text as one inline element with the text intact', () => {
    const { container } = render(<RichText text={'Just one paragraph.'} />)
    expect(container.children).toHaveLength(1)
    expect(container.textContent).toBe('Just one paragraph.')
  })

  it('preserves inline bold formatting within a paragraph', () => {
    const { container } = render(<RichText text={'a **bold** word'} />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('renders nothing for empty or missing text', () => {
    const { container } = render(<RichText text={''} />)
    expect(container.children).toHaveLength(0)
    const { container: c2 } = render(<RichText text={null} />)
    expect(c2.children).toHaveLength(0)
  })
})
