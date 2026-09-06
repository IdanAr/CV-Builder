// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FaqSection } from './FaqSection'

describe('FaqSection', () => {
  it('renders all six questions collapsed by default', () => {
    render(<FaqSection />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-expanded', 'false')
    }
  })

  it('expands an answer when its question is clicked', async () => {
    const user = userEvent.setup()
    render(<FaqSection />)
    const question = screen.getByRole('button', { name: /what is an ats-friendly cv/i })
    await user.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/applicant tracking system/i)).toBeInTheDocument()
  })
})
