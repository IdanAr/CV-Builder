// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { PipelineStrip } from './PipelineStrip'
import { NeedsYou } from './NeedsYou'
import { RecentCvs } from './RecentCvs'
import { FirstRun } from './FirstRun'

const counts = { found: 12, matched: 5, drafted: 0, ready: 2, applied: 7, matchedUnread: 3, waiting: 5 }
const zero = { found: 0, matched: 0, drafted: 0, ready: 0, applied: 0, matchedUnread: 0, waiting: 0 }

describe('PipelineStrip', () => {
  it('renders five stage links with counts', () => {
    render(<PipelineStrip counts={counts} />)
    const matched = screen.getByRole('link', { name: 'Matched 5' })
    expect(matched).toHaveAttribute('href', '/dashboard/jobsearch?stage=matched')
    expect(screen.getByRole('link', { name: 'Found 12' })).toHaveAttribute('href', '/dashboard/jobsearch?stage=found')
    expect(screen.getByRole('link', { name: 'Drafted 0' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ready 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Applied 7' })).toBeInTheDocument()
  })

  it('gives attention border to matched/drafted/ready only when above zero', () => {
    render(<PipelineStrip counts={counts} />)
    expect(screen.getByRole('link', { name: 'Matched 5' }).className).toContain('border-border-attention')
    expect(screen.getByRole('link', { name: 'Ready 2' }).className).toContain('border-border-attention')
    expect(screen.getByRole('link', { name: 'Drafted 0' }).className).not.toContain('border-border-attention')
    expect(screen.getByRole('link', { name: 'Found 12' }).className).not.toContain('border-border-attention')
    expect(screen.getByRole('link', { name: 'Applied 7' }).className).not.toContain('border-border-attention')
  })
})

describe('NeedsYou', () => {
  it('lists rows with pluralisation and links, omitting zero rows', () => {
    render(<NeedsYou counts={{ ...zero, matched: 4, matchedUnread: 1, drafted: 2, ready: 1, waiting: 4 }} />)
    expect(screen.getByRole('link', { name: /^1 unread match to review/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch?stage=matched'
    )
    expect(screen.getByRole('link', { name: /2 drafts to review/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch?stage=drafted'
    )
    expect(screen.getByRole('link', { name: /1 application ready/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch?stage=ready'
    )
  })

  it('pluralises and omits zero rows', () => {
    render(<NeedsYou counts={{ ...zero, matched: 3, matchedUnread: 3, ready: 2, waiting: 5 }} />)
    expect(screen.getByRole('link', { name: /^3 unread matches to review/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 applications ready/ })).toBeInTheDocument()
    expect(screen.queryByText(/drafts? to review/)).not.toBeInTheDocument()
  })

  it('counts unread matches only, so the rows add up to the waiting chips', () => {
    // 173 matches in total, 30 waiting: 25 unread matches + 3 drafts + 2 ready.
    const c = { ...zero, matched: 173, matchedUnread: 25, drafted: 3, ready: 2, waiting: 30 }
    render(<NeedsYou counts={c} />)
    expect(screen.getByRole('link', { name: /^25 unread matches to review/ })).toBeInTheDocument()
    expect(screen.queryByText(/173/)).not.toBeInTheDocument()
    const numbers = screen.getAllByRole('link').map((l) => Number(l.textContent?.match(/^\d+/)?.[0]))
    expect(numbers.reduce((a, b) => a + b, 0)).toBe(c.waiting)
  })

  it('shows no matches row when every match has been read', () => {
    render(<NeedsYou counts={{ ...zero, matched: 6, matchedUnread: 0, ready: 1, waiting: 1 }} />)
    expect(screen.queryByText(/match/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^1 application ready/ })).toBeInTheDocument()
  })

  it('shows the caught-up invitation when all zero', () => {
    render(<NeedsYou counts={zero} />)
    expect(screen.getByText("You're caught up.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Run a scan' })).toHaveAttribute('href', '/dashboard/jobsearch')
  })
})

describe('RecentCvs', () => {
  const cvs = [
    { id: 'a1', title: 'Backend CV', updatedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), formatScore: 22 },
    { id: 'b2', title: 'Design CV', updatedAt: new Date(Date.now() - 2 * 86400_000).toISOString(), formatScore: 25 },
  ]

  it('links each CV to the editor with edited time and ATS score', () => {
    render(<RecentCvs cvs={cvs} />)
    const link = screen.getByRole('link', { name: /Backend CV/ })
    expect(link).toHaveAttribute('href', '/dashboard/resumes/a1')
    expect(link).toHaveTextContent('Edited 3 hours ago')
    expect(link).toHaveTextContent('ATS 22/25')
    // The two figures sit in a gap-3 flex row rather than relying on collapsed whitespace.
    expect(screen.getByText('ATS 22/25').parentElement?.className).toContain('gap-3')
    expect(screen.getByRole('link', { name: /Design CV/ })).toHaveAttribute('href', '/dashboard/resumes/b2')
    expect(screen.getByRole('link', { name: 'View all CVs' })).toHaveAttribute('href', '/dashboard/cvs')
  })

  it('renders nothing with no CVs', () => {
    const { container } = render(<RecentCvs cvs={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('FirstRun', () => {
  it('renders both cards when there are no CVs and no profiles', () => {
    render(<FirstRun hasCvs={false} hasProfiles={false} />)
    expect(screen.getByText('Create your first CV')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New CV' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up a job search' })).toHaveAttribute('href', '/dashboard/jobsearch')
  })

  it('renders nothing otherwise', () => {
    const a = render(<FirstRun hasCvs hasProfiles={false} />)
    expect(a.container).toBeEmptyDOMElement()
    const b = render(<FirstRun hasCvs={false} hasProfiles />)
    expect(b.container).toBeEmptyDOMElement()
  })
})
