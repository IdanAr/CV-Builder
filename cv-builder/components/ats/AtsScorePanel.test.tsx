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
  jdKeywords: ['react', 'typescript'],
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

describe('AtsScorePanel text status label', () => {
  it('shows a text status label alongside a low score, not color alone', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(screen.getByText(/needs work|poor match/i)).toBeInTheDocument())
  })

  it('shows "Good match" for a high score', async () => {
    const highScore: AtsScoreResult = {
      total: 85,
      breakdown: { format: 25, keywordDensity: 35, keywordPlacement: 20, metrics: 5 },
      matchedKeywords: ['react', 'typescript'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(highScore))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(screen.getByText(/good match/i)).toBeInTheDocument())
  })
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

describe('AtsScorePanel Apply All Verified', () => {
  it('applies only fixes with no pendingApprovals, leaving flagged ones for individual review', async () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, work: [{ highlights: ['Built a system.'] }] },
    })
    const workFix: AtsFix = {
      id: 'fix-work',
      section: 'work',
      kind: 'edit',
      workIndex: 0,
      highlightIndex: 0,
      original: 'Built a system.',
      suggested: 'Built a scalable system.',
      targetKeywords: ['react'],
      pendingApprovals: [],
    }
    const flaggedSummaryFix: AtsFix = {
      ...generateFix,
      id: 'fix-summary-flagged',
      suggested: 'Grew revenue by 45%.',
      pendingApprovals: ['45%'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse([workFix, flaggedSummaryFix]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByText(/missing keywords/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/tailor with ai/i))
    const applyAllButton = await screen.findByRole('button', { name: /apply all verified/i })
    expect(applyAllButton.textContent).toContain('(1)')

    fireEvent.click(applyAllButton)

    const { data } = useResumeEditorStore.getState()
    expect(data.work?.[0].highlights?.[0]).toBe('Built a scalable system.')
    expect(data.basics?.summary).toBeUndefined()
    // The flagged fix is still awaiting individual review, not silently dropped.
    expect(screen.getByText(/not in your original text/i)).toBeInTheDocument()
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
      jdKeywords: ['react', 'typescript'],
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
    // The jdKeywords from the first /ats-score response are re-sent, proving
    // the exclude-toggle re-score reuses the cached AI extraction instead of
    // triggering a fresh one server-side.
    expect(secondCallBody.jdKeywords).toEqual(['react', 'typescript'])
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
      jdKeywords: ['react', 'typescript'],
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
    expect(secondCallBody.jdKeywords).toEqual(['react', 'typescript'])
    expect(useResumeEditorStore.getState().meta.excludedAtsKeywords).toEqual([])
  })
})

describe('AtsScorePanel semantic match', () => {
  it('clicking Semantic Match calls the endpoint, re-analyzes, and styles the confirmed chip distinctly', async () => {
    const afterSemantic: AtsScoreResult = {
      total: 55,
      breakdown: { format: 20, keywordDensity: 35, keywordPlacement: 25, metrics: 5 },
      matchedKeywords: ['react'],
      missingKeywords: ['typescript'],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi
      .fn()
      // 1st call: POST /ats-score (initial Analyze)
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      // 2nd call: POST /ats-semantic-match
      .mockResolvedValueOnce(jsonResponse({ confirmedMatches: ['react'] }))
      // 3rd call: POST /ats-score (re-analyze after semantic match)
      .mockResolvedValueOnce(jsonResponse(afterSemantic))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByText(/semantic match/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/semantic match/i))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const semanticCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(semanticCallBody.missingKeywords).toEqual(['react', 'typescript'])
    const rescoreCallBody = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(rescoreCallBody.semanticMatches).toEqual(['react'])
    // The re-score after Semantic Match also reuses the cached jdKeywords
    // from the initial Analyze, instead of triggering a fresh AI extraction.
    expect(rescoreCallBody.jdKeywords).toEqual(['react', 'typescript'])

    const reactChip = await screen.findByLabelText('Exclude "react" from scoring')
    await waitFor(() => expect(reactChip.className).toContain('teal'))
    await waitFor(() => expect(screen.queryByText(/semantic match/i)).not.toBeInTheDocument())
  })

  it('shows an error message when the semantic match request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByText(/semantic match/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText(/semantic match/i))

    const errorMessage = await screen.findByText(/semantic match failed/i)
    expect(errorMessage).toBeInTheDocument()
    // Sits inside the bg-red-50 missing-keywords container, where text-red-600
    // falls just under AA contrast (~4.42:1) — must be red-700 (~5.92:1).
    expect(errorMessage.className).toContain('text-red-700')
    expect(errorMessage.className).not.toContain('text-red-600')
  })
})

describe('AtsScorePanel missing-keyword ignore hint', () => {
  it('shows a hint explaining that clicking a missing keyword ignores it everywhere', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() =>
      expect(screen.getByText(/click a keyword you don't have to ignore it/i)).toBeInTheDocument()
    )
  })

  it('does not show the hint when there are no missing keywords', async () => {
    const noMissing: AtsScoreResult = {
      total: 90,
      breakdown: { format: 25, keywordDensity: 35, keywordPlacement: 25, metrics: 5 },
      matchedKeywords: ['react', 'typescript'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['react', 'typescript'],
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(noMissing))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(screen.getByText(/matched keywords/i)).toBeInTheDocument())
    expect(screen.queryByText(/click a keyword you don't have to ignore it/i)).not.toBeInTheDocument()
  })
})

describe('AtsScorePanel jdKeywords caching', () => {
  it('a fresh Analyze click always sends an empty jdKeywords cache, letting the server extract fresh', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(scoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstCallBody.jdKeywords).toEqual([])
  })

  it('re-analyzing after editing the job description resets the cache rather than reusing stale keywords', async () => {
    const secondScoreResult: AtsScoreResult = {
      total: 60,
      breakdown: { format: 20, keywordDensity: 20, keywordPlacement: 15, metrics: 5 },
      matchedKeywords: ['mixpanel'],
      missingKeywords: [],
      excludedMatchedKeywords: [],
      excludedMissingKeywords: [],
      jdKeywords: ['mixpanel'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scoreResult))
      .mockResolvedValueOnce(jsonResponse(secondScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    const textarea = screen.getByPlaceholderText(/paste the full job description/i)
    fireEvent.change(textarea, { target: { value: 'Looking for a React + TypeScript engineer.' } })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(textarea, { target: { value: 'Analytics role needing Mixpanel expertise.' } })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.jdKeywords).toEqual([])
  })
})

describe('AtsScorePanel missing-keyword priority coloring', () => {
  const priorityScoreResult = {
    ...scoreResult,
    missingKeywords: ['react', 'typescript', 'agile'],
    keywordPriorities: { react: 'must', typescript: 'nice-to-have' }, // agile intentionally absent
  }

  it('colors a must-have missing keyword red', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    const reactChip = await screen.findByLabelText('Exclude "react" from scoring')
    expect(reactChip.className).toContain('red')
    expect(reactChip.className).not.toContain('yellow')
  })

  it('colors a nice-to-have missing keyword yellow', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    const tsChip = await screen.findByLabelText('Exclude "typescript" from scoring')
    expect(tsChip.className).toContain('yellow')
    expect(tsChip.className).not.toContain('red')
  })

  it('colors a missing keyword with no priority entry (ambiguous) red, same as must-have', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    const agileChip = await screen.findByLabelText('Exclude "agile" from scoring')
    expect(agileChip.className).toContain('red')
    expect(agileChip.className).not.toContain('yellow')
  })

  it('shows a legend explaining the red/yellow priority coloring', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(screen.getByText(/nice-to-have/i)).toBeInTheDocument())
    expect(screen.getByText(/must-have/i)).toBeInTheDocument()
  })

  it('caches and forwards keywordPriorities on a re-score of the same job description', async () => {
    const afterExclusion = {
      ...priorityScoreResult,
      missingKeywords: ['typescript', 'agile'],
      excludedMissingKeywords: ['react'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(priorityScoreResult))
      .mockResolvedValueOnce(jsonResponse(afterExclusion))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))
    await waitFor(() => expect(screen.getByLabelText('Exclude "react" from scoring')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Exclude "react" from scoring'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondCallBody.keywordPriorities).toEqual({ react: 'must', typescript: 'nice-to-have' })
  })

  it('a fresh Analyze click sends an empty keywordPriorities cache', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(priorityScoreResult))
    vi.stubGlobal('fetch', fetchMock)

    render(<AtsScorePanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the full job description/i), {
      target: { value: 'Looking for a React + TypeScript engineer.' },
    })
    fireEvent.click(screen.getByText('Analyze'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(firstCallBody.keywordPriorities).toEqual({})
  })
})
