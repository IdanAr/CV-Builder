import { describe, expect, it } from 'vitest'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { detectGaps } from '../gaps'

const job = (startDate?: string, endDate?: string) => ({ name: 'Acme', position: 'Analyst', startDate, endDate })
const cv = (work: ResumeData['work'], extra: Partial<ResumeData> = {}): ResumeData => ({ work, ...extra })
const TODAY = '2026-10'

describe('detectGaps', () => {
  it('reports a certain gap between two roles', () => {
    expect(detectGaps(cv([job('2019-01', '2021-12'), job('2023-01')]), TODAY)).toEqual([
      { from: '2022-01', to: '2022-12', months: 12, coveredBy: [], filled: [], after: '2021-12', exactStart: true },
    ])
  })

  it('respects date resolution: "2022 to 2024" then "2024 to present" is never a gap', () => {
    expect(detectGaps(cv([job('2022', '2024'), job('2024')]), TODAY)).toEqual([])
  })

  it('ignores roles without dates', () => {
    expect(detectGaps(cv([job('2019-01', '2021-12'), job(), job('2022-02')]), TODAY)).toEqual([])
  })

  it('reports a gap a career break fills, and says what fills it', () => {
    const data = cv([job('2016-01', '2021-12'), job('2025-04')], {
      customSections: [
        { id: 'c', name: 'Career break', enabledFields: ['dateRange', 'summary'], items: [{ id: 'i', title: 'Caregiving', startDate: '2022-01', endDate: '2025-03' }] },
      ],
    })
    expect(detectGaps(data, TODAY)).toEqual([{ from: '2022-01', to: '2025-03', months: 39, coveredBy: ['custom'], filled: [{ kind: 'custom', from: '2022-01', to: '2025-03' }], after: '2021-12', exactStart: true }])
  })

  it('says when study fills a gap', () => {
    const data = cv([job('2015-01', '2018-12'), job('2021-01')], { education: [{ institution: 'TAU', studyType: 'M.A.', startDate: '2019', endDate: '2020' }] })
    expect(detectGaps(data, TODAY)[0].coveredBy).toEqual(['education'])
    expect(detectGaps(data, TODAY)[0].filled).toEqual([{ kind: 'education', from: '2019-01', to: '2020-12' }])
  })

  it('keeps the dates of study that fills only part of a gap', () => {
    const data = cv([job('2022-07', '2024-09')], { education: [{ institution: 'Northfield Institute', studyType: 'Program', startDate: '2025-12', endDate: '2026-07' }] })
    const [gap] = detectGaps(data, TODAY)
    expect(gap.from).toBe('2024-10')
    expect(gap.filled).toEqual([{ kind: 'education', from: '2025-12', to: '2026-07' }])
  })

  it('reports a gap running to today after the last role ended', () => {
    expect(detectGaps(cv([job('2020-01', '2024-09')]), TODAY)).toEqual([{ from: '2024-10', to: TODAY, months: 25, coveredBy: [], filled: [], after: '2024-09', exactStart: true }])
  })

  it('treats overlapping roles as covered time', () => {
    expect(detectGaps(cv([job('2018-01', '2022-06'), job('2020-01', '2021-01'), job('2022-07')]), TODAY)).toEqual([])
  })

  it('does not flag a certain gap of exactly 6 months', () => {
    expect(detectGaps(cv([job('2019-01', '2021-06'), job('2022-01')]), TODAY)).toEqual([])
    expect(detectGaps(cv([job('2019-01', '2021-06'), job('2022-02')]), TODAY)).toHaveLength(1)
  })

  it('marks a gap whose start month the CV does not give, after a year-only end date', () => {
    expect(detectGaps(cv([job('2024', '2025')]), TODAY)).toEqual([{ from: '2026-01', to: TODAY, months: 10, coveredBy: [], filled: [], after: '2025', exactStart: false }])
  })

  it('counts every role of a multi-role employer', () => {
    const data = cv([{ name: 'Acme', roles: [{ id: 'a', position: 'Analyst', startDate: '2018-01', endDate: '2020-12' }, { id: 'b', position: 'Lead', startDate: '2021-01' }] }])
    expect(detectGaps(data, TODAY)).toEqual([])
  })
})
