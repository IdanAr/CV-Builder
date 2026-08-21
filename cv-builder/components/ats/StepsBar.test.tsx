// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepsBar } from './StepsBar'

describe('StepsBar', () => {
  it('renders three step segments with their labels', () => {
    render(<StepsBar current={1} maxUnlocked={1} onStepClick={vi.fn()} />)
    expect(screen.getByText('Job Description & Score')).toBeInTheDocument()
    expect(screen.getByText('Close the Gap')).toBeInTheDocument()
    expect(screen.getByText('Review & Apply')).toBeInTheDocument()
  })

  it('marks the current step selected and enabled', () => {
    render(<StepsBar current={2} maxUnlocked={2} onStepClick={vi.fn()} />)
    const current = screen.getByRole('tab', { name: /close the gap/i })
    expect(current).toHaveAttribute('aria-selected', 'true')
    expect(current).not.toBeDisabled()
  })

  it('disables a step beyond maxUnlocked and never calls onStepClick when clicked', () => {
    const onStepClick = vi.fn()
    render(<StepsBar current={1} maxUnlocked={1} onStepClick={onStepClick} />)
    const locked = screen.getByRole('tab', { name: /review & apply/i })
    expect(locked).toBeDisabled()
    fireEvent.click(locked)
    expect(onStepClick).not.toHaveBeenCalled()
  })

  it('shows a checkmark for a done step (unlocked but not current)', () => {
    render(<StepsBar current={2} maxUnlocked={2} onStepClick={vi.fn()} />)
    const done = screen.getByRole('tab', { name: /job description & score/i })
    expect(done.textContent).toContain('✓')
  })

  it('calls onStepClick with the step number when a reachable, non-current step is clicked', () => {
    const onStepClick = vi.fn()
    render(<StepsBar current={2} maxUnlocked={3} onStepClick={onStepClick} />)
    fireEvent.click(screen.getByRole('tab', { name: /review & apply/i }))
    expect(onStepClick).toHaveBeenCalledWith(3)
  })

  it('wraps the segments in a tablist for assistive tech', () => {
    render(<StepsBar current={1} maxUnlocked={1} onStepClick={vi.fn()} />)
    expect(screen.getByRole('tablist', { name: /ats analysis steps/i })).toBeInTheDocument()
  })
})
