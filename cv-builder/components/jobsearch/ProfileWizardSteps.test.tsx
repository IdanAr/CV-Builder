// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileWizardSteps } from './ProfileWizardSteps'

const LABELS = ['Roles', 'Location', 'Sources', 'Threshold', 'Review']

describe('ProfileWizardSteps', () => {
  it('renders one tab per label with the current step selected', () => {
    render(<ProfileWizardSteps current={2} maxUnlocked={3} labels={LABELS} onStepClick={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('disables steps beyond maxUnlocked', () => {
    render(<ProfileWizardSteps current={1} maxUnlocked={2} labels={LABELS} onStepClick={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[3]).toBeDisabled()
    expect(tabs[4]).toBeDisabled()
  })

  it('calls onStepClick with the 1-indexed step number', async () => {
    const onStepClick = vi.fn()
    render(<ProfileWizardSteps current={3} maxUnlocked={4} labels={LABELS} onStepClick={onStepClick} />)
    await userEvent.click(screen.getAllByRole('tab')[1])
    expect(onStepClick).toHaveBeenCalledWith(2)
  })

  it('gives each tab an id and aria-controls pointing at its panel', () => {
    render(<ProfileWizardSteps current={1} maxUnlocked={2} labels={LABELS} onStepClick={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('id', 'wizard-tab-1')
    expect(tabs[0]).toHaveAttribute('aria-controls', 'wizard-panel-1')
    expect(tabs[1]).toHaveAttribute('id', 'wizard-tab-2')
    expect(tabs[1]).toHaveAttribute('aria-controls', 'wizard-panel-2')
  })
})
