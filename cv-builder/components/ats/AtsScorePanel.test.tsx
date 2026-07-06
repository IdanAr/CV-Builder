// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AtsScorePanel } from './AtsScorePanel'
import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'
import type { AtsScoreResult } from '@/lib/ats/scorer'

const scoreResult: AtsScoreResult = {
  total: 42,
  breakdown: { format: 20, keywordDensity: 10, keywordPlacement: 7, metrics: 5 },
  matchedKeywords: [],
  missingKeywords: ['react', 'typescript'],
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
