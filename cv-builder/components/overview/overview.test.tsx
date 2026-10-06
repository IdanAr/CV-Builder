// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { PipelineStrip } from './PipelineStrip'
import { NeedsYou } from './NeedsYou'
import { RecentCvs } from './RecentCvs'
import { FirstRun } from './FirstRun'
import { greetingFor } from './greeting'

const counts = { found: 12, matched: 5, drafted: 0, ready: 2, applied: 7, waiting: 7 }
const zero = { found: 0, matched: 0, drafted: 0, ready: 0, applied: 0, waiting: 0 }

describe('greetingFor', () => {
  it('picks the phrase by hour', () => {
    expect(greetingFor(0, 'Jordan')).toBe('Good morning, Jordan')
    expect(greetingFor(11, 'Jordan')).toBe('Good morning, Jordan')
    expect(greetingFor(12, 'Jordan')).toBe('Good afternoon, Jordan')
    expect(greetingFor(17, 'Jordan')).toBe('Good afternoon, Jordan')
    expect(greetingFor(18, 'Jordan')).toBe('Good evening, Jordan')
  })
  it('uses the first name only and drops it when missing', () => {
    expect(greetingFor(9, 'Jordan Lee Smith')).toBe('Good morning, Jordan')
    expect(greetingFor(9, '  ')).toBe('Good morning')
    expect(greetingFor(9, null)).toBe('Good morning')
    expect(greetingFor(9)).toBe('Good morning')
  })
})

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
    render(<NeedsYou counts={{ ...zero, matched: 1, drafted: 2, ready: 1 }} />)
    expect(screen.getByRole('link', { name: /1 match to triage/ })).toHaveAttribute(
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
    render(<NeedsYou counts={{ ...zero, matched: 3, ready: 2 }} />)
    expect(screen.getByRole('link', { name: /3 matches to triage/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /2 applications ready/ })).toBeInTheDocument()
    expect(screen.queryByText(/to review/)).not.toBeInTheDocument()
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
