// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleChipGroup } from './ToggleChipGroup'

describe('ToggleChipGroup', () => {
  it('labels the group and marks selected options pressed', () => {
    render(<ToggleChipGroup label="Seniority" options={['junior', 'senior']} selected={['senior']} onToggle={() => {}} />)
    const group = screen.getByRole('group', { name: 'Seniority' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'senior' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'junior' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the toggled option', async () => {
    const onToggle = vi.fn()
    render(<ToggleChipGroup label="Seniority" options={['junior', 'senior']} selected={[]} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: 'junior' }))
    expect(onToggle).toHaveBeenCalledWith('junior')
  })

  it('formats numeric options and keeps the mobile target floor', () => {
    render(
      <ToggleChipGroup label="Recency" options={[7, 14]} selected={[14]} onToggle={() => {}} format={(n) => `${n} days`} />
    )
    const chip = screen.getByRole('button', { name: '14 days' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip.className).toContain('max-sm:min-h-10')
  })
})
