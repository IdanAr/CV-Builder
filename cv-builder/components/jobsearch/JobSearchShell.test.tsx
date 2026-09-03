// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobSearchShell, topLevelSegments, type JobSearchShellProps } from './JobSearchShell'

type Overrides = Partial<Omit<JobSearchShellProps, 'children'>>

function renderShell(props: Overrides = {}) {
  const { segments, active, title, description, ...rest } = props
  return render(
    <JobSearchShell
      segments={segments ?? topLevelSegments(0)}
      active={active ?? 'profiles'}
      title={title ?? 'Job Search'}
      description={description ?? 'Profiles watch job boards on a schedule.'}
      {...rest}
    >
      <p>content</p>
    </JobSearchShell>
  )
}

describe('topLevelSegments', () => {
  it('is the section pair, with Matches carrying the unread count', () => {
    const segments = topLevelSegments(7)

    expect(segments.map((s) => s.key)).toEqual(['profiles', 'matches'])
    expect(segments[1]).toMatchObject({ count: 7, tone: 'alert' })
  })
})

describe('JobSearchShell', () => {
  it('renders the title, description and its children', () => {
    renderShell()

    expect(screen.getByRole('heading', { name: 'Job Search' })).toBeInTheDocument()
    expect(screen.getByText(/watch job boards/i)).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders every segment as a real link, so any view opens in a new tab', () => {
    renderShell()

    expect(screen.getByRole('link', { name: 'Profiles' })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch'
    )
    expect(screen.getByRole('link', { name: /Matches/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch/notifications'
    )
  })

  it('marks the active view for assistive technology, not just visually', () => {
    renderShell({ active: 'matches' })

    expect(screen.getByRole('link', { name: /Matches/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Profiles' })).not.toHaveAttribute('aria-current')
  })

  it('takes a caller-supplied tab row, for the profile-scoped trio', () => {
    renderShell({
      active: 'rules',
      segments: [
        { key: 'jobs', label: 'Jobs', href: '/dashboard/jobsearch/p1', count: 12 },
        { key: 'matches', label: 'Matches', href: '/dashboard/jobsearch/p1?tab=matches', count: 4 },
        { key: 'rules', label: 'Rules', href: '/dashboard/jobsearch/p1?tab=rules', count: 3 },
      ],
    })

    expect(screen.getByRole('link', { name: /Jobs/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch/p1'
    )
    expect(screen.getByRole('link', { name: /Rules/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Profiles' })).not.toBeInTheDocument()
  })

  it('badges a segment with its count', () => {
    renderShell({ segments: topLevelSegments(7), active: 'profiles' })

    const matches = screen.getByRole('link', { name: /Matches/ })
    expect(matches).toHaveTextContent('7')
    expect(matches).toHaveTextContent(/unread matches/i)
  })

  it('caps a badge at "99+"', () => {
    renderShell({ segments: topLevelSegments(150) })

    expect(screen.getByRole('link', { name: /Matches/ })).toHaveTextContent('99+')
  })

  it('omits the badge entirely at zero rather than showing a "0"', () => {
    renderShell({ segments: topLevelSegments(0) })

    expect(screen.getByRole('link', { name: /Matches/ })).not.toHaveTextContent('0')
  })

  it('announces a neutral count without calling it unread', () => {
    renderShell({
      segments: [{ key: 'rules', label: 'Rules', href: '/x', count: 3, tone: 'neutral' }],
      active: 'rules',
    })

    const rules = screen.getByRole('link', { name: /Rules/ })
    expect(rules).toHaveTextContent('3')
    expect(rules).not.toHaveTextContent(/unread/i)
  })

  it('renders the stat strip as a definition list when stats are given', () => {
    renderShell({
      stats: [
        { value: '3', label: 'active' },
        { value: '7', label: 'new matches' },
      ],
    })

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('new matches')).toBeInTheDocument()
  })

  it('renders a banner above the content when one is given', () => {
    renderShell({ banner: <p>preferences bar</p> })

    expect(screen.getByText('preferences bar')).toBeInTheDocument()
  })

  it('offers a way back up when nested under a segment', () => {
    renderShell({ backHref: '/dashboard/jobsearch', backLabel: 'All profiles' })

    expect(screen.getByRole('link', { name: /All profiles/ })).toHaveAttribute(
      'href',
      '/dashboard/jobsearch'
    )
  })

  it('omits the breadcrumb on a top-level view', () => {
    renderShell()

    expect(screen.queryByRole('link', { name: /All profiles/ })).not.toBeInTheDocument()
  })
})
