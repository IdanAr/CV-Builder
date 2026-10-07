// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormatScore } from '../use-format-score'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ResumeMetaSchema, type ResumeData } from '@/lib/schemas/resume.zod'
import * as scorer from '@/lib/ats/scorer'

const rich: ResumeData = {
  basics: { name: 'Ada Lovelace', email: 'ada@example.com', phone: '555-0100', summary: 'Engineer.' },
  work: [{ name: 'Acme', position: 'Engineer', startDate: '2020-01', highlights: ['Built things'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BS' }],
  skills: [{ name: 'Languages', keywords: ['TypeScript'] }],
}

describe('useFormatScore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useResumeEditorStore.setState({ data: rich, meta: ResumeMetaSchema.parse({}) })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns the 0-100 format breakdown of the store data', () => {
    const { result } = renderHook(() => useFormatScore())
    const expected = scorer.scoreResume(rich, '').breakdown.format
    expect(result.current).toBe(expected)
    expect(result.current).toBeGreaterThanOrEqual(0)
    expect(result.current).toBeLessThanOrEqual(100)
  })

  it('updates after the 300ms debounce when data changes', () => {
    const { result } = renderHook(() => useFormatScore())
    const before = result.current
    const emptied: ResumeData = {}
    act(() => {
      useResumeEditorStore.setState({ data: emptied })
    })
    expect(result.current).toBe(before)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe(scorer.scoreResume(emptied, '').breakdown.format)
    expect(result.current).not.toBe(before)
  })

  it('does not recompute on a meta-only change', () => {
    const spy = vi.spyOn(scorer, 'scoreResume')
    renderHook(() => useFormatScore())
    const calls = spy.mock.calls.length
    act(() => {
      useResumeEditorStore.setState({ meta: { ...useResumeEditorStore.getState().meta, accentColor: '#ff0000' } })
      vi.advanceTimersByTime(500)
    })
    expect(spy.mock.calls.length).toBe(calls)
  })
})
