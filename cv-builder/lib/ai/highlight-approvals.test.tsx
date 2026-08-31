// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { highlightApprovals } from './highlight-approvals'

describe('highlightApprovals', () => {
  it('returns the text unchanged when there are no pending approvals', () => {
    render(<>{highlightApprovals('Plain text', [])}</>)
    expect(screen.getByText('Plain text')).toBeInTheDocument()
  })

  it('gives an unverified phrase an accessible name beyond color, discoverable without a mouse', () => {
    render(<>{highlightApprovals('Led a team of 12 engineers', ['12 engineers'])}</>)

    const mark = screen.getByText('12 engineers')
    expect(mark.tagName).toBe('MARK')
    // Must be reachable/announced without hover: either an accessible name/role
    // on the element itself, or adjacent screen-reader-only text.
    const accessibleViaRole =
      mark.getAttribute('role') === 'note' && !!mark.getAttribute('aria-label')
    const accessibleViaSrText = !!mark.parentElement?.querySelector('.sr-only')
    expect(accessibleViaRole || accessibleViaSrText).toBe(true)
  })
})
