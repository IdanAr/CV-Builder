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

  it('renders Before/After blocks for an edit-kind fix', () => {
    render(
      <AtsFixReviewPanel
        fixes={[makeFix()]}
        dismissedIds={new Set()}
        {...noop}
      />
    )
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
    expect(screen.getByText('Experienced developer.')).toBeInTheDocument()
    expect(screen.getByText('Experienced React developer.')).toBeInTheDocument()
  })

  describe('generate-kind fix (no original text)', () => {
    const generateFix = makeFix({
      id: 'fix-summary-new',
      kind: 'generate',
      original: '',
      suggested: 'React developer with a track record of shipping ATS-friendly tools.',
      targetKeywords: ['react', 'ats'],
    })

    it('renders a "New professional summary" card with the suggested text', () => {
      render(
        <AtsFixReviewPanel
          fixes={[generateFix]}
          dismissedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.getByText(/new professional summary/i)).toBeInTheDocument()
      expect(
        screen.getByText('React developer with a track record of shipping ATS-friendly tools.')
      ).toBeInTheDocument()
    })

    it('does not render a Before block or any strikethrough element', () => {
      const { container } = render(
        <AtsFixReviewPanel
          fixes={[generateFix]}
          dismissedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.queryByText('Before')).not.toBeInTheDocument()
      expect(screen.queryByText('After')).not.toBeInTheDocument()
      expect(container.querySelector('.line-through')).toBeNull()
    })

    it('still renders keyword chips, Apply and Dismiss buttons', () => {
      render(
        <AtsFixReviewPanel
          fixes={[generateFix]}
          dismissedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('ats')).toBeInTheDocument()
      expect(screen.getByText('Apply')).toBeInTheDocument()
      expect(screen.getByText('Dismiss')).toBeInTheDocument()
    })

    it('still shows the unverified-claims warning when pendingApprovals is present', () => {
      render(
        <AtsFixReviewPanel
          fixes={[{ ...generateFix, pendingApprovals: ['30%'] }]}
          dismissedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.getByText(/not in your original text/i)).toBeInTheDocument()
      expect(screen.getByText('30%')).toBeInTheDocument()
    })
  })
})
