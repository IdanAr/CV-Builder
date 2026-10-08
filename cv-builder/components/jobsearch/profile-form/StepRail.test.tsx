// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepRail } from './StepRail'

const steps = ['Role', 'Where', 'Sources', 'Review']

describe('StepRail', () => {
  it('marks the current step and disables locked steps', () => {
    render(<StepRail steps={steps} current={1} maxUnlocked={1} onStepClick={() => {}} />)
    expect(screen.getByRole('button', { name: /Where/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Sources/ })).toBeDisabled()
  })

  it('jumps to an unlocked step', async () => {
    const onStepClick = vi.fn()
    render(<StepRail steps={steps} current={2} maxUnlocked={2} onStepClick={onStepClick} />)
    await userEvent.click(screen.getByRole('button', { name: /Role/ }))
    expect(onStepClick).toHaveBeenCalledWith(0)
  })

  it('gives phones a compact "Step n of 4" line', () => {
    render(<StepRail steps={steps} current={2} maxUnlocked={3} onStepClick={() => {}} />)
    expect(screen.getByText('Step 3 of 4: Sources')).toBeInTheDocument()
  })

  it('keeps every step reachable and 40px tall below sm', () => {
    render(<StepRail steps={steps} current={0} maxUnlocked={3} onStepClick={() => {}} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toBeDisabled()
    }
    expect(screen.getByRole('button', { name: /Review/ }).className).toContain('max-sm:min-h-10')
  })
})
