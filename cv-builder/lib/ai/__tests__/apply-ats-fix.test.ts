import { describe, it, expect } from 'vitest'
import { applyAtsFixToResumeData } from '../apply-ats-fix'
import type { AtsFix } from '../ats-fix-pipeline'
import type { ResumeData } from '@/lib/schemas/resume.zod'

function fix(overrides: Partial<AtsFix>): AtsFix {
  return {
    id: 'f1',
    section: 'summary',
    original: '',
    suggested: '',
    targetKeywords: [],
    pendingApprovals: [],
    ...overrides,
  }
}

describe('applyAtsFixToResumeData', () => {
  it('replaces basics.summary for a summary fix', () => {
    const data: ResumeData = { basics: { name: 'Jane', summary: 'Old summary.' } }
    const patch = applyAtsFixToResumeData(data, fix({ section: 'summary', suggested: 'New summary.' }))
    expect(patch).toEqual({ basics: { name: 'Jane', summary: 'New summary.' } })
  })

  it('drafts a brand-new summary when original is empty (generate kind)', () => {
    const data: ResumeData = { basics: { name: 'Jane' } }
    const patch = applyAtsFixToResumeData(
      data,
      fix({ section: 'summary', kind: 'generate', original: '', suggested: 'Fresh summary.' })
    )
    expect(patch).toEqual({ basics: { name: 'Jane', summary: 'Fresh summary.' } })
  })

  it('writes into work[].roles[] when roleIndex is set', () => {
    const data: ResumeData = {
      work: [{ name: 'Acme', highlights: undefined, roles: [{ id: 'role-1', highlights: ['Built a system.'] }] }],
    }
    const patch = applyAtsFixToResumeData(
      data,
      fix({
        section: 'work',
        workIndex: 0,
        roleIndex: 0,
        highlightIndex: 0,
        original: 'Built a system.',
        suggested: 'Built a scalable system.',
      })
    )
    expect(patch.work?.[0].roles?.[0].highlights?.[0]).toBe('Built a scalable system.')
    expect(patch.work?.[0].highlights).toBeUndefined()
  })

  it('writes into the legacy top-level highlights when roleIndex is absent', () => {
    const data: ResumeData = { work: [{ name: 'Acme', highlights: ['Built a system.'] }] }
    const patch = applyAtsFixToResumeData(
      data,
      fix({ section: 'work', workIndex: 0, highlightIndex: 0, original: 'Built a system.', suggested: 'Built a scalable system.' })
    )
    expect(patch.work?.[0].highlights?.[0]).toBe('Built a scalable system.')
  })

  it('leaves other work entries untouched', () => {
    const data: ResumeData = {
      work: [
        { name: 'Acme', highlights: ['A'] },
        { name: 'Other', highlights: ['B'] },
      ],
    }
    const patch = applyAtsFixToResumeData(
      data,
      fix({ section: 'work', workIndex: 0, highlightIndex: 0, original: 'A', suggested: 'A2' })
    )
    expect(patch.work?.[1]).toEqual({ name: 'Other', highlights: ['B'] })
  })

  it('returns an empty patch for a work fix missing workIndex/highlightIndex', () => {
    const data: ResumeData = { work: [{ name: 'Acme', highlights: ['A'] }] }
    const patch = applyAtsFixToResumeData(data, fix({ section: 'work' }))
    expect(patch).toEqual({})
  })
})
