// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtsFixReviewPanel } from './AtsFixReviewPanel'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'

function makeFix(overrides: Partial<AtsFix> = {}): AtsFix {
  return {
    id: 'fix-summary',
    section: 'summary',
    original: 'Experienced developer.',
    suggested: 'Experienced React developer.',
    targetKeywords: ['react'],
    pendingApprovals: [],
    ...overrides,
  }
}

const noop = { onApply: vi.fn(), onDismiss: vi.fn(), onApplyAll: vi.fn() }

describe('AtsFixReviewPanel', () => {
  it('shows an unverified-claims warning when a fix has pendingApprovals', () => {
    render(
      <AtsFixReviewPanel
        fixes={[makeFix({ pendingApprovals: ['45%', '12'] })]}
        dismissedIds={new Set()}
        {...noop}
      />
    )
    expect(screen.getByText(/not in your original text/i)).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('shows no warning when pendingApprovals is empty', () => {
    render(
      <AtsFixReviewPanel
        fixes={[makeFix()]}
        dismissedIds={new Set()}
        {...noop}
      />
    )
    expect(screen.queryByText(/not in your original text/i)).not.toBeInTheDocument()
  })
})
