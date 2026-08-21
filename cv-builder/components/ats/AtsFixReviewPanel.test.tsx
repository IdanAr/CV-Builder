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

  it('labels "Apply All Verified" with a count and disables it when every visible fix has unverified claims', () => {
    render(
      <AtsFixReviewPanel
        fixes={[
          makeFix({ id: 'fix-a', pendingApprovals: ['45%'] }),
          makeFix({ id: 'fix-b', pendingApprovals: ['12'] }),
        ]}
        dismissedIds={new Set()}
        {...noop}
      />
    )
    const button = screen.getByRole('button', { name: /apply all verified/i })
    expect(button).toBeDisabled()
    expect(button.textContent).toContain('(0)')
  })

  it('enables "Apply All Verified" with a count reflecting only the unflagged fixes', () => {
    render(
      <AtsFixReviewPanel
        fixes={[
          makeFix({ id: 'fix-a', pendingApprovals: [] }),
          makeFix({ id: 'fix-b', pendingApprovals: ['45%'] }),
        ]}
        dismissedIds={new Set()}
        {...noop}
      />
    )
    const button = screen.getByRole('button', { name: /apply all verified/i })
    expect(button).toBeEnabled()
    expect(button.textContent).toContain('(1)')
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
    // The "After" text is split across multiple <span> segments (unchanged vs.
    // changed words) by the word-diff renderer, so match on combined textContent.
    const byTextContent = (target: string) =>
      screen.getByText((_, element) => element?.tagName.toLowerCase() === 'p' && element.textContent === target)
    expect(byTextContent('Experienced developer.')).toBeInTheDocument()
    expect(byTextContent('Experienced React developer.')).toBeInTheDocument()
  })

  it('only strikes through the words removed from the original, not the whole sentence', () => {
    const { container } = render(
      <AtsFixReviewPanel
        fixes={[makeFix({
          original: 'Built a small dashboard for users.',
          suggested: 'Built a scalable dashboard for users.',
        })]}
        dismissedIds={new Set()}
        {...noop}
      />
    )
    const struck = Array.from(container.querySelectorAll('.line-through')).map(el => el.textContent)
    expect(struck.join('')).toContain('small')
    expect(struck.join('')).not.toContain('dashboard')
    expect(struck.join('')).not.toContain('users')
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

  describe('section/record labeling and aggregation', () => {
    const data = {
      basics: { name: 'Jane Smith' },
      work: [{
        name: 'Acme Corp',
        position: 'Frontend Engineer',
      }],
    }

    it('labels a summary fix with "Summary Section"', () => {
      render(
        <AtsFixReviewPanel
          fixes={[makeFix()]}
          dismissedIds={new Set()}
          data={data}
          {...noop}
        />
      )
      expect(screen.getByText('Summary Section')).toBeInTheDocument()
    })

    it('labels a work fix with the section and the specific role/company record', () => {
      render(
        <AtsFixReviewPanel
          fixes={[makeFix({
            id: 'fix-work-0-0',
            section: 'work',
            workIndex: 0,
            highlightIndex: 0,
            original: 'Built a system.',
            suggested: 'Built a scalable system.',
          })]}
          dismissedIds={new Set()}
          data={data}
          {...noop}
        />
      )
      expect(screen.getByText('Work Experience Section - Frontend Engineer at Acme Corp')).toBeInTheDocument()
    })

    it('aggregates multiple fixes for the same work record under a single heading', () => {
      render(
        <AtsFixReviewPanel
          fixes={[
            makeFix({
              id: 'fix-work-0-0', section: 'work', workIndex: 0, highlightIndex: 0,
              original: 'Built a system.', suggested: 'Built a scalable system.',
            }),
            makeFix({
              id: 'fix-work-0-1', section: 'work', workIndex: 0, highlightIndex: 1,
              original: 'Wrote some docs.', suggested: 'Wrote thorough docs.',
            }),
          ]}
          dismissedIds={new Set()}
          data={data}
          {...noop}
        />
      )
      expect(screen.getAllByText('Work Experience Section - Frontend Engineer at Acme Corp')).toHaveLength(1)
      expect(screen.getByText('2 suggested fixes')).toBeInTheDocument()
    })

    it('falls back gracefully when data is not provided', () => {
      render(
        <AtsFixReviewPanel
          fixes={[makeFix({
            id: 'fix-work-0-0', section: 'work', workIndex: 0, highlightIndex: 0,
          })]}
          dismissedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.getByText('Work Experience Section')).toBeInTheDocument()
    })
  })

  describe('applied-confirmation card', () => {
    it('renders a compact "✓ Applied" card for a fix whose id is in appliedIds, instead of the full edit card', () => {
      render(
        <AtsFixReviewPanel
          fixes={[makeFix({ id: 'fix-a' })]}
          dismissedIds={new Set()}
          appliedIds={new Set(['fix-a'])}
          {...noop}
        />
      )
      expect(screen.getByText(/applied/i)).toBeInTheDocument()
      expect(screen.queryByText('Before')).not.toBeInTheDocument()
      expect(screen.queryByText('Apply')).not.toBeInTheDocument()
      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()
    })

    it('still renders the full edit card for a fix not in appliedIds', () => {
      render(
        <AtsFixReviewPanel
          fixes={[makeFix({ id: 'fix-a' })]}
          dismissedIds={new Set()}
          appliedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.getByText('Before')).toBeInTheDocument()
      expect(screen.getByText('Apply')).toBeInTheDocument()
    })

    it('groups an applied fix under its normal section/record heading, not a separate one', () => {
      const data = { basics: { name: 'Jane Smith' }, work: [{ name: 'Acme Corp', position: 'Frontend Engineer' }] }
      render(
        <AtsFixReviewPanel
          fixes={[
            makeFix({ id: 'fix-a', section: 'work', workIndex: 0, highlightIndex: 0 }),
            makeFix({ id: 'fix-b', section: 'work', workIndex: 0, highlightIndex: 1 }),
          ]}
          dismissedIds={new Set()}
          appliedIds={new Set(['fix-a'])}
          data={data}
          {...noop}
        />
      )
      expect(screen.getAllByText('Work Experience Section - Frontend Engineer at Acme Corp')).toHaveLength(1)
    })

    it('defaults to no applied fixes when appliedIds is omitted', () => {
      render(
        <AtsFixReviewPanel
          fixes={[makeFix({ id: 'fix-a' })]}
          dismissedIds={new Set()}
          {...noop}
        />
      )
      expect(screen.getByText('Before')).toBeInTheDocument()
    })
  })
})
