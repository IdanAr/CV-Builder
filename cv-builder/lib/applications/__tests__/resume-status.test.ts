import { describe, it, expect } from 'vitest'
import { computeResumeApplicationBadges } from '../resume-status'

const statusOptions = [
  { id: 'applied', label: 'Applied', color: '#3b82f6' },
  { id: 'interviewing', label: 'Interviewing', color: '#f59e0b' },
]

describe('computeResumeApplicationBadges', () => {
  it('returns no entry for a resume with zero linked applications', () => {
    const map = computeResumeApplicationBadges([], statusOptions)
    expect(map.get('resume-1')).toBeUndefined()
  })

  it('returns a single badge with the matching status label/color for one linked application', () => {
    const map = computeResumeApplicationBadges(
      [{ resumeId: 'resume-1', status: 'interviewing' }],
      statusOptions
    )
    expect(map.get('resume-1')).toEqual({ kind: 'single', label: 'Interviewing', color: '#f59e0b' })
  })

  it('falls back to Unknown for a status id with no matching option', () => {
    const map = computeResumeApplicationBadges(
      [{ resumeId: 'resume-1', status: 'archived-status-id' }],
      statusOptions
    )
    expect(map.get('resume-1')).toEqual({ kind: 'single', label: 'Unknown', color: '#94a3b8' })
  })

  it('returns a multiple badge with the count for 2+ linked applications', () => {
    const map = computeResumeApplicationBadges(
      [
        { resumeId: 'resume-1', status: 'applied' },
        { resumeId: 'resume-1', status: 'interviewing' },
      ],
      statusOptions
    )
    expect(map.get('resume-1')).toEqual({ kind: 'multiple', count: 2 })
  })

  it('ignores application rows with no resumeId', () => {
    const map = computeResumeApplicationBadges([{ status: 'applied' }], statusOptions)
    expect(map.size).toBe(0)
  })

  it('keys independently per resumeId', () => {
    const map = computeResumeApplicationBadges(
      [
        { resumeId: 'resume-1', status: 'applied' },
        { resumeId: 'resume-2', status: 'interviewing' },
      ],
      statusOptions
    )
    expect(map.get('resume-1')).toEqual({ kind: 'single', label: 'Applied', color: '#3b82f6' })
    expect(map.get('resume-2')).toEqual({ kind: 'single', label: 'Interviewing', color: '#f59e0b' })
  })
})
