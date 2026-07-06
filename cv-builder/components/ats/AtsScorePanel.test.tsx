// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AtsScorePanel } from './AtsScorePanel'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import type { AtsScoreResult } from '@/lib/ats/scorer'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
}

const scoreResult: AtsScoreResult = {
  total: 42,
  breakdown: { format: 20, keywordDensity: 10, keywordPlacement: 7, metrics: 5 },
  matchedKeywords: [],
  missingKeywords: ['react', 'typescript'],
  excludedMatchedKeywords: [],
  excludedMissingKeywords: [],
}

const generateFix: AtsFix = {
  id: 'fix-summary-new',
  section: 'summary',
  kind: 'generate',
  original: '',
  suggested: 'React and TypeScript engineer focused on ATS-optimized resumes.',
  targetKeywords: ['react', 'typescript'],
  pendingApprovals: [],
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1',
    title: 'CV',
    // No basics.summary — this resume has never had one.
    data: { basics: { name: 'Jane Doe' } },
    meta: defaultMeta,
    isDirty: false,
    isSaving: false,
    saveError: null,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AtsScorePanel applyFix for generate-kind summary fixes', () => {
  it('applying a generate fix sets basics.summary when no summary existed before', async () => {
    const fetchMock = vi
      .fn()
      // 1st call: POST /ats-score
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      // 2nd call: POST /ats-fix
      .mockResolvedValueOnce(jsonResponse([generateFix]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)

    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/tailor with ai/i))
    await waitFor(() => expect(screen.getByText('Apply')).toBeInTheDocument())

    expect(useResumeEditorStore.getState().data.basics?.summary).toBeUndefined()

    fireEvent.click(screen.getByText('Apply'))

    const { data } = useResumeEditorStore.getState()
    expect(data.basics?.summary).toBe(
      'React and TypeScript engineer focused on ATS-optimized resumes.'
    )
    // Applying the summary must not clobber the rest of basics.
    expect(data.basics?.name).toBe('Jane Doe')
  })
})

describe('AtsScorePanel keyword exclusion toggle', () => {
  it('clicking a missing-keyword chip excludes it, persists via setMeta, and re-analyzes', async () => {
    const afterExclusion: AtsScoreResult = {
      total: 30,
      breakdown: { format: 20, keywordDensity: 0, keywordPlacement: 0, metrics: 5 },
      matchedKeywords: [],
      missingKeywords: ['typescript'],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: ['react'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse(afterExclusion))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByText('react')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Exclude "react" from scoring'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.excludedKeywords).toEqual(['react'])
    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual(['react'])

    const chip = await screen.findByLabelText('Include "react" in scoring')
    expect(chip.className).toContain('line-through')
  })

  it('clicking an already-excluded chip re-includes it', async () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, excludedAtsKeywords: ['react'] } })
    const preExcluded: AtsScoreResult = {
      total: 30,
      breakdown: { format: 20, keywordDensity: 0, keywordPlacement: 0, metrics: 5 },
      matchedKeywords: [],
      missingKeywords: ['typescript'],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: ['react'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(preExcluded))
      .mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByLabelText('Include "react" in scoring')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Include "react" in scoring'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.excludedKeywords).toEqual([])
    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual([])
  })
})
