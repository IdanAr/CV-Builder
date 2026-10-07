// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StageTabs } from './StageTabs'
import type { PipelineCountsDto } from '@/lib/jobsearch/pipeline-types'

const counts: PipelineCountsDto = {
  found: 12, matched: 5, drafted: 2, ready: 0, applied: 7, archive: 3, matchedUnread: 3, waiting: 5,
}

describe('StageTabs', () => {
  it('renders six tabs with counts, hiding zero counts', () => {
    render(<StageTabs active="found" counts={counts} onSelect={() => {}} />)
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getByRole('tab', { name: /^Found/ }).textContent).toContain('12')
    expect(screen.getByRole('tab', { name: /^Ready/ }).textContent).toBe('Ready')
  })

  it('adds visually hidden waiting text on attention stages', () => {
    render(<StageTabs active="found" counts={counts} onSelect={() => {}} />)
    expect(screen.getByText('3 waiting')).toBeTruthy()
    expect(screen.getByText('2 waiting')).toBeTruthy()
    expect(screen.queryByText('0 waiting')).toBeNull()
  })

  it('marks the active tab and roves tabIndex', () => {
    render(<StageTabs active="matched" counts={counts} onSelect={() => {}} />)
    const tab = screen.getByRole('tab', { name: /^Matched/ })
    expect(tab.getAttribute('aria-selected')).toBe('true')
    expect(tab.tabIndex).toBe(0)
    expect(screen.getByRole('tab', { name: /^Found/ }).tabIndex).toBe(-1)
  })

  it('arrow keys call onSelect with the next stage', async () => {
    const onSelect = vi.fn()
    render(<StageTabs active="found" counts={counts} onSelect={onSelect} />)
    screen.getByRole('tab', { name: /^Found/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenCalledWith('matched')
  })

  it('renders without counts', () => {
    render(<StageTabs active="found" counts={null} onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Archive' })).toBeTruthy()
  })
})
