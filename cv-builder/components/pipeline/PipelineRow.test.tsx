// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PipelineRow } from './PipelineRow'
import type { PipelineJob } from '@/lib/jobsearch/pipeline-types'

const job: PipelineJob = {
  _id: 'j1', profileId: 'p', title: 'Staff Engineer', company: 'Acme', location: 'Remote',
  url: 'https://x', matchedRules: [], pendingApprovals: [], tailoredKeywords: [],
  status: 'new', stage: 'found', createdAt: new Date().toISOString(), atsScore: 85,
}

function setup(j: Partial<PipelineJob> = {}, selected = false, isNew = false) {
  const onSelect = vi.fn()
  render(
    <ul role="listbox" aria-label="Jobs">
      <PipelineRow job={{ ...job, ...j }} selected={selected} isNew={isNew} onSelect={onSelect} />
    </ul>
  )
  return onSelect
}

describe('PipelineRow', () => {
  it('shows title, company, location, age and score', () => {
    setup()
    expect(screen.getByText('Staff Engineer')).toBeTruthy()
    expect(screen.getByText(/Acme/)).toBeTruthy()
    expect(screen.getByText(/Remote/)).toBeTruthy()
    expect(screen.getByText('Just now')).toBeTruthy()
    expect(screen.getByText('85% match')).toBeTruthy()
  })

  it('is an option reflecting selection and roving tabIndex', () => {
    setup({}, true)
    const opt = screen.getByRole('option')
    expect(opt.getAttribute('aria-selected')).toBe('true')
    expect(opt.className).toContain('bg-surface-selected')
  })

  it('calls onSelect on click', async () => {
    const onSelect = setup()
    await userEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalled()
  })

  it('chips: Needs review, Ready to apply, New', () => {
    setup({ stage: 'drafted', pendingApprovals: ['x'] })
    expect(screen.getByText('Needs review')).toBeTruthy()
  })

  it('drafted without pending approvals has no chip', () => {
    setup({ stage: 'drafted' })
    expect(screen.queryByText('Needs review')).toBeNull()
  })

  it('ready chip', () => {
    setup({ stage: 'ready' })
    expect(screen.getByText('Ready to apply')).toBeTruthy()
  })

  it('new chip', () => {
    setup({}, false, true)
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('archived and deleted badges', () => {
    setup({ stage: 'archive' })
    expect(screen.getByText('Archived')).toBeTruthy()
  })

  it('deleted badge for tombstones', () => {
    setup({ stage: 'archive', deletedAt: new Date().toISOString() })
    expect(screen.getByText('Deleted')).toBeTruthy()
  })
})
