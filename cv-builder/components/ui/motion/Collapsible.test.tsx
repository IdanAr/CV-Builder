/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Collapsible } from './Collapsible'

describe('Collapsible', () => {
  it('renders children when open', () => {
    render(<Collapsible open><p>Body content</p></Collapsible>)
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(<Collapsible open={false}><p>Body content</p></Collapsible>)
    expect(screen.queryByText('Body content')).not.toBeInTheDocument()
  })
})
